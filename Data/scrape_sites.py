#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrape asking prices for properties for sale in Bangkok and the metropolitan
area from four listing sites. Each site is a separate resumable run.

Usage:
    python scrape_sites.py --site ddproperty        # full run, resumable
    python scrape_sites.py --site hipflat --target 200 --max-pages 2   # smoke test

Sites:
    ddproperty     __NEXT_DATA__ listingsData, 20 per page
    hipflat        HTML snippet cards, 30 per page, 5000-item cap per query
    livinginsider  Next.js RSC payload, 48 per page, zone-filtered
    baania         __NEXT_DATA__ Elasticsearch hits, 48 per page, 10000-item cap per query

Outputs (per site):
    Data/<site>_raw.jsonl       one line per listing, appended as pages finish
    Data/<site>_done.txt        finished (job:page) keys for resume
    Data/<site>_listings.csv    deduplicated by listing_id
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote

import pandas as pd
from curl_cffi import requests

HERE = os.path.dirname(os.path.abspath(__file__))
TZ = timezone(timedelta(hours=7))

METRO = ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "นครปฐม"]
TAG_RE = re.compile(r"<[^>]+>")
NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def fetch(url, retries=4):
    for attempt in range(retries):
        try:
            r = requests.get(url, impersonate="chrome", timeout=60)
            if r.status_code == 200:
                return r.text
            if r.status_code == 404:
                return ""  # past the last page
        except Exception:
            pass
        time.sleep(2 * (attempt + 1))
    return None


def next_data(html):
    m = NEXT_DATA_RE.search(html or "")
    return json.loads(m.group(1)) if m else None


def num(s):
    m = re.search(r"\d[\d,]*(?:\.\d+)?", s or "")
    return float(m.group(0).replace(",", "")) if m else None


def row(**kw):
    base = {k: None for k in (
        "listing_id", "url", "title", "project_name", "property_type", "type_slug",
        "bedrooms", "bathrooms", "area_sqm", "land_sqwa", "price_thb", "price_per_sqm",
        "sub_district", "district", "province", "latitude", "longitude", "date_posted",
        "description", "source", "source_page")}
    base.update(kw)
    return base


# ---------------------------------------------------------------- ddproperty
DD_BASE = "https://www.ddproperty.com/รวมประกาศขาย/ใน"
DD_PROVINCES = ["กรุงเทพ-th10", "นนทบุรี-th12", "ปทุมธานี-th13", "สมุทรปราการ-th11",
                "สมุทรสาคร-th74", "นครปฐม-th73"]


def dd_jobs():
    return [(p, f"{DD_BASE}{p}?page={{page}}") for p in DD_PROVINCES]


def dd_parse(html, job, page):
    d = next_data(html)
    if not d:
        return []
    data = d["props"]["pageProps"]["pageData"]["data"]
    if page > (data.get("paginationData") or {}).get("totalPages", page):
        return []  # site recycles listings past the last real page
    items = data.get("listingsData") or []
    rows = []
    for it in items:
        x = it.get("listingData") or {}
        if not x.get("id") or x.get("typeCode") != "SALE":
            continue
        add = x.get("additionalData") or {}
        posted = (x.get("postedOn") or {}).get("unix")
        rows.append(row(
            listing_id=str(x["id"]),
            url=x.get("url"),
            title=x.get("localizedTitle"),
            property_type=(x.get("property") or {}).get("subTypeText"),
            bedrooms=x.get("bedrooms"),
            bathrooms=x.get("bathrooms"),
            area_sqm=x.get("floorArea"),
            price_thb=(x.get("price") or {}).get("value"),
            price_per_sqm=num((x.get("pricePerArea") or {}).get("localeStringValue")),
            sub_district=add.get("areaText"),
            district=add.get("districtText"),
            province={"กรุงเทพ": "กรุงเทพมหานคร"}.get(add.get("regionText"), add.get("regionText")),
            date_posted=datetime.fromtimestamp(posted, TZ).isoformat() if posted else None,
            source="ddproperty",
            source_page=f"{job}?page={page}",
        ))
    return rows


# ------------------------------------------------------------------- hipflat
HF_BASE = "https://www.hipflat.co.th"
HF_TYPES = ["ขายคอนโด", "ขายบ้าน", "ขายทาวน์เฮาส์", "ขายวิลล่า", "ขายที่ดิน",
            "ขายอพาร์ทเม้นท์", "ขายอาคารพาณิชย์"]
HF_PROVINCES = {"กรุงเทพฯ": "กรุงเทพมหานคร", "นนทบุรี": "นนทบุรี", "ปทุมธานี": "ปทุมธานี",
                "สมุทรปราการ": "สมุทรปราการ", "สมุทรสาคร": "สมุทรสาคร", "นครปฐม": "นครปฐม"}
HF_BEDROOMS = ["สตูดิโอ", "1ห้องนอน", "2ห้องนอน", "3ห้องนอน", "4ห้องนอน"]
HF_CAP = 5000  # site returns nothing past page 167 (30 x 167)
HF_SNIPPET_RE = re.compile(r"<div class='snippet'>(.*?)<ul class=\"snippet-info\">(.*?)</ul>", re.S)


def hf_count(html):
    m = re.search(r"มี\s*\S+\s*([\d,]+)", TAG_RE.sub(" ", html))
    return int(m.group(1).replace(",", "")) if m else 0


def hf_jobs():
    """Split (type, province) until every query is under the 5000-item cap."""
    jobs = []
    for t in HF_TYPES:
        for prov in HF_PROVINCES:
            base = f"/{t}/{prov}"
            html = fetch(HF_BASE + base) or ""
            if hf_count(html) <= HF_CAP:
                jobs.append((base, HF_BASE + base + "?page={page}"))
                continue
            dists = sorted(set(unquote(h) for h in re.findall(rf'href="({base}/[^"]+)"', html)))
            dists = [d for d in dists if "ห้องนอน" not in d and "สตูดิโอ" not in d]
            for dist in dists:
                if hf_count(fetch(HF_BASE + dist) or "") <= HF_CAP:
                    jobs.append((dist, HF_BASE + dist + "?page={page}"))
                else:
                    jobs += [(f"{dist}/{b}", f"{HF_BASE}{dist}/{b}?page={{page}}") for b in HF_BEDROOMS]
    return jobs


def hf_parse(html, job, page):
    rows = []
    prov_slug = job.split("/")[2]
    for head, info in HF_SNIPPET_RE.findall(html):
        m = re.search(r"href='([^']*/ads/([a-z0-9]+))'", head)
        if not m:
            continue
        get = lambda cls: (re.search(rf"class=['\"]{cls}['\"]>(.*?)</p>", head, re.S) or [None, None])[1]
        addr = [a.strip() for a in (get("snippet-address") or "").split(",")]
        desc = re.findall(r'class="snippet-description-2 snippet-description">(.*?)</p>', head, re.S)
        li = dict(re.findall(r'alt="([^"]+)"/>\s*([^<]*)</li>', info))
        r = row(
            listing_id=m.group(2), url=m.group(1), title=get("snippet-title"),
            property_type=li.get("property type"),
            bedrooms=int(num(li["beds"])) if li.get("beds") else None,
            bathrooms=int(num(li["baths"])) if li.get("baths") else None,
            area_sqm=num(li.get("space")),
            price_thb=num(get("snippet-price")),
            district=addr[0] if len(addr) > 1 else None,
            province=HF_PROVINCES.get(prov_slug, prov_slug),
            description=TAG_RE.sub("", desc[0]).strip() if desc else None,
            source="hipflat", source_page=f"{job}?page={page}",
        )
        if r["price_thb"] and r["area_sqm"]:
            r["price_per_sqm"] = round(r["price_thb"] / r["area_sqm"])
        rows.append(r)
    return rows


# ------------------------------------------------------------- livinginsider
LI_BASE = "https://www.livinginsider.com"
LI_ZONES = {  # zone slug -> province (zones straddle borders; nearest province)
    "rama-8-samsen-ratchawat": "กรุงเทพมหานคร", "siam-paragon-chulalongkornsamyan": "กรุงเทพมหานคร",
    "silom-saladaeng-bangrak": "กรุงเทพมหานคร", "witthayuploenchit-langsuan": "กรุงเทพมหานคร",
    "ratchathewiphayathai": "กรุงเทพมหานคร", "ari-anusaowaree": "กรุงเทพมหานคร",
    "sapankwaijatujak": "กรุงเทพมหานคร", "ratchadapisek-huaikwang-suttisan": "กรุงเทพมหานคร",
    "rama9-rca-petchaburi": "กรุงเทพมหานคร", "nana-north-nanasukhumvit13-soi-nana": "กรุงเทพมหานคร",
    "sukhumvit-asoke-thonglor": "กรุงเทพมหานคร", "onnut-udomsuk": "กรุงเทพมหานคร",
    "khlongtoei-kluaynamthai": "กรุงเทพมหานคร", "sathorn-narathiwat": "กรุงเทพมหานคร",
    "rama3-riversidesatupadit": "กรุงเทพมหานคร", "pha-nakorn-yaowarat": "กรุงเทพมหานคร",
    "kasetsart-ratchayothin": "กรุงเทพมหานคร", "kaset-nawaminladplakao": "กรุงเทพมหานคร",
    "yothinpattanacdc": "กรุงเทพมหานคร", "nawamin-ramindra": "กรุงเทพมหานคร",
    "ladprao-central-ladprao": "กรุงเทพมหานคร", "ladprao-48-chokchai-4-ladprao-71": "กรุงเทพมหานคร",
    "ladprao101-the-mall-bang-kapi": "กรุงเทพมหานคร", "vipawadee-don-mueang-lak-si": "กรุงเทพมหานคร",
    "pattanakan-srinakarin": "กรุงเทพมหานคร", "bangna-lasalle-bearing": "กรุงเทพมหานคร",
    "ramkhamhaeng-hua-mak": "กรุงเทพมหานคร", "ramkhamhaeng-nida-seri-thai": "กรุงเทพมหานคร",
    "min-buri-romklao": "กรุงเทพมหานคร", "samrong-samut-prakan": "สมุทรปราการ",
    "ladkrabang-suwannaphum-airport": "กรุงเทพมหานคร", "wongwianyai-charoennakor": "กรุงเทพมหานคร",
    "thaphra-wutthakat": "กรุงเทพมหานคร", "pinklao-charansanitwong": "กรุงเทพมหานคร",
    "daokanongbang-bon": "กรุงเทพมหานคร", "rathburana-suksawat": "กรุงเทพมหานคร",
    "rama-2-bang-khun-thian": "กรุงเทพมหานคร", "bang-kae-phetkasem": "กรุงเทพมหานคร",
    "bang-sue-wong-sawang": "กรุงเทพมหานคร", "rattanathibet-sanambinna": "นนทบุรี",
    "bangkruai-ratchapruek": "นนทบุรี", "chaengwatana-muangthong": "นนทบุรี",
    "bangbuathong-sainoi": "นนทบุรี", "rangsit-pathum-thani": "ปทุมธานี",
    "phutthamonthon-salaya": "นครปฐม", "nakhon-pathom": "นครปฐม", "samut-sakhon": "สมุทรสาคร",
}
LI_RSC_RE = re.compile(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', re.S)
LI_ITEM_RE = re.compile(r'\{"id":\d+,"listing":\{"post_type"')
LI_TYPES = {"condo": "คอนโด", "house": "บ้านเดี่ยว", "townhome": "ทาวน์โฮม", "land": "ที่ดิน",
            "apartment": "อพาร์ทเม้นท์", "commercial": "อาคารพาณิชย์", "office": "สำนักงาน",
            "factory": "โรงงาน", "hotel": "โรงแรม", "semi-detached-house": "บ้านแฝด"}


def li_jobs():
    return [(z, f"{LI_BASE}/zone/{z}-property-buysell/{{page}}") for z in LI_ZONES]


def li_objects(html):
    payload = "".join(json.loads('"' + m.group(1) + '"') for m in LI_RSC_RE.finditer(html))
    for m in LI_ITEM_RE.finditer(payload):
        depth, i = 0, m.start()
        for j in range(i, len(payload)):
            depth += payload[j] == "{"
            depth -= payload[j] == "}"
            if depth == 0:
                try:
                    yield json.loads(payload[i:j + 1])
                except json.JSONDecodeError:
                    pass
                break


def li_parse(html, job, page):
    rows = []
    for o in li_objects(html):
        slug = (o.get("content") or {}).get("slug") or ""
        if "-for-sale-" not in slug:
            continue
        pricing = (o.get("commerce") or {}).get("pricing") or {}
        specs = o.get("specs") or {}
        area = specs.get("area_size") or {}
        kind = slug.split("-for-sale-")[0]
        rows.append(row(
            listing_id=str(o["id"]), url=f"{LI_BASE}/detail/{slug}-{o['id']}",
            title=(o.get("content") or {}).get("title"),
            property_type=LI_TYPES.get(kind, kind), type_slug=kind,
            bedrooms=(specs.get("room") or {}).get("value"),
            bathrooms=specs.get("bathroom"),
            area_sqm=specs.get("useful_space"),
            land_sqwa=(area.get("rai") or 0) * 400 + (area.get("ngan") or 0) * 100 + (area.get("square_wa") or 0)
            if kind != "condo" and area else None,
            price_thb=pricing.get("current") or pricing.get("full"),
            price_per_sqm=((o.get("commerce") or {}).get("price_per_sqm") or {}).get("sale"),
            sub_district=(o.get("zone") or {}).get("name"),
            province=LI_ZONES[job],
            date_posted=((o.get("activity") or {}).get("timeline") or {}).get("created_date"),
            source="livinginsider", source_page=f"{job}/{page}",
        ))
    return rows


# -------------------------------------------------------------------- baania
BA_BASE = "https://www.baania.com/s/ทั้งหมด/listing?listingType=for-sale&province={pid}&min_price={lo}&max_price={hi}"
BA_PROVINCES = {3781: "กรุงเทพมหานคร", 3372: "นนทบุรี", 3599: "ปทุมธานี", 3498: "สมุทรปราการ",
                3555: "สมุทรสาคร", 3667: "นครปฐม"}
BA_CAP = 10000  # Elasticsearch stops paging past 10000 hits
BA_MAX_PRICE = 4_000_000_000


def ba_count(pid, lo, hi):
    d = next_data(fetch(BA_BASE.format(pid=pid, lo=lo, hi=hi)))
    return d["props"]["pageProps"]["defaultData"]["hits"]["total"]["value"] if d else 0


def ba_jobs():
    """Split each province by price until every query is under the 10000-hit cap."""
    jobs = []
    for pid in BA_PROVINCES:
        stack = [(0, BA_MAX_PRICE)]
        while stack:
            lo, hi = stack.pop()
            n = ba_count(pid, lo, hi)
            if n == 0:
                continue
            if n < BA_CAP or hi - lo <= 10_000:
                jobs.append((f"{pid}:{lo}-{hi}", BA_BASE.format(pid=pid, lo=lo, hi=hi) + "&page={page}"))
            else:
                mid = (lo + hi) // 2
                stack += [(mid + 1, hi), (lo, mid)]
    return jobs


def ba_parse(html, job, page):
    d = next_data(html)
    if not d:
        return []
    rows = []
    for h in d["props"]["pageProps"]["defaultData"]["hits"]["hits"]:
        s = h["_source"]
        v = s.get("view_data") or {}
        addr = s.get("address") or {}
        area = v.get("area_total") or {}
        f = s.get("filter") or {}
        price = num(str((f.get("price") or [None])[0] or v.get("price_start") or ""))
        ptype = (v.get("property_type") or [{}])[0].get("th")
        rai, ngan, wa = (num(str(area.get(k))) for k in ("rai", "ngan", "wa"))
        area_sqm = num(str(v.get("area_usable"))) if v.get("area_usable") else None
        land_sqwa = None
        if ptype == "คอนโด":
            area_sqm = area_sqm or rai  # bank NPA condo feeds put sqm in the rai slot
        elif area:
            land_sqwa = (rai or 0) * 400 + (ngan or 0) * 100 + (wa or 0)
        r = row(
            listing_id=h["_id"],
            url=f"https://www.baania.com/listing/{(v.get('url') or {}).get('alias_th')}-{h['_id']}",
            title=(v.get("title") or {}).get("th"),
            property_type=ptype,
            bedrooms=v.get("bedroom"), bathrooms=v.get("bathroom"),
            area_sqm=area_sqm,
            land_sqwa=land_sqwa,
            price_thb=price,
            sub_district=((addr.get("subdistrict") or {}).get("title") or {}).get("th"),
            district=((addr.get("district") or {}).get("title") or {}).get("th"),
            province=((addr.get("province") or {}).get("title") or {}).get("th"),
            latitude=(s.get("location") or {}).get("lat"),
            longitude=(s.get("location") or {}).get("lon"),
            date_posted=f.get("created"),
            source="baania", source_page=f"{job}&page={page}",
        )
        if r["price_thb"] and r["area_sqm"]:
            r["price_per_sqm"] = round(r["price_thb"] / r["area_sqm"])
        rows.append(r)
    return rows


SITES = {
    "ddproperty": (dd_jobs, dd_parse, 3300),
    "hipflat": (hf_jobs, hf_parse, 167),
    "livinginsider": (li_jobs, li_parse, 400),
    "baania": (ba_jobs, ba_parse, 209),
}


# -------------------------------------------------------------------- runner
def load_done(path):
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def load_ids(path):
    ids = set()
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                ids.add(json.loads(line)["listing_id"])
    return ids


def scrape_job(parse, url_tpl, job, page):
    url = url_tpl.format(page=page)
    if page == 1:
        url = url.replace("?page=1", "")  # hipflat returns an empty list for ?page=1
    html = fetch(url)
    if html is None:
        return page, None
    rows = parse(html, job, page)
    if not rows:  # confirm before treating as the last page: a challenge page can also parse empty
        time.sleep(3)
        html = fetch(url)
        rows = parse(html, job, page) if html else []
    return page, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, choices=SITES)
    ap.add_argument("--target", type=int, default=50000, help="stop after this many unique listings")
    ap.add_argument("--max-pages", type=int, default=None, help="cap pages per job")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--delay", type=float, default=0.3)
    args = ap.parse_args()

    plan, parse, site_cap = SITES[args.site]
    max_pages = args.max_pages or site_cap
    raw_path = os.path.join(HERE, f"{args.site}_raw.jsonl")
    done_path = os.path.join(HERE, f"{args.site}_done.txt")

    done = load_done(done_path)
    ids = load_ids(raw_path)
    raw = open(raw_path, "a", encoding="utf-8")
    done_f = open(done_path, "a", encoding="utf-8")

    jobs = plan()
    print(f"{len(jobs)} jobs planned, {len(ids)} listings already saved", flush=True)
    for job, url_tpl in jobs:
        if len(ids) >= args.target:
            break
        if f"{job}:END" in done:
            continue
        page = 1
        finished = exhausted = False
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            while not finished and len(ids) < args.target:
                batch = []
                while len(batch) < args.workers:
                    if page > max_pages:
                        finished = True
                        break
                    if f"{job}:{page}" in done:
                        page += 1
                        continue
                    batch.append(ex.submit(scrape_job, parse, url_tpl, job, page))
                    page += 1
                    time.sleep(args.delay)
                if not batch:
                    break
                for fut in as_completed(batch):
                    pg, rows = fut.result()
                    if rows is None:
                        print(f"FAIL {job} page {pg}", file=sys.stderr, flush=True)
                        continue
                    if not rows:
                        finished = exhausted = True
                        continue
                    for r in rows:
                        raw.write(json.dumps(r, ensure_ascii=False) + "\n")
                        ids.add(r["listing_id"])
                    done_f.write(f"{job}:{pg}\n")
                raw.flush()
                done_f.flush()
        if finished:
            done_f.write(f"{job}:END\n")
            done_f.flush()
        print(f"{job}: done through page {page - 1}, unique so far {len(ids)}", flush=True)

    raw.close()
    done_f.close()
    build_csv(args.site, raw_path)


def build_csv(site, raw_path):
    rows = []
    with open(raw_path, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    df = pd.DataFrame(rows).drop_duplicates(subset="listing_id", keep="last")
    df["province"] = df["province"].replace({"กรุงเทพ": "กรุงเทพมหานคร", "BANGKOK": "กรุงเทพมหานคร"})
    df = df[df["province"].isin(METRO)]  # baania's province filter leaks other provinces
    out = os.path.join(HERE, f"{site}_listings.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"wrote {len(df)} unique listings to {out}", flush=True)


if __name__ == "__main__":
    main()
