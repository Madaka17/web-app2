#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrape asking prices for properties for sale in Bangkok and the metropolitan
area from dotproperty.co.th listing pages (JSON-LD ItemList + card details).

Usage:
    python scrape_dotproperty.py                 # full run, resumable
    python scrape_dotproperty.py --max-pages 3   # smoke test

Outputs:
    Data/dotproperty_raw.jsonl       one line per listing, appended as pages finish
    Data/dotproperty_done.txt        finished (type/province:page) keys for resume
    Data/dotproperty_listings.csv    deduplicated by listing_id
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import requests

BASE = "https://www.dotproperty.co.th"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept-Language": "th,en;q=0.8",
}

PROVINCES = {
    "bangkok": "กรุงเทพมหานคร",
    "nonthaburi": "นนทบุรี",
    "pathum-thani": "ปทุมธานี",
    "samut-prakan": "สมุทรปราการ",
    "samut-sakhon": "สมุทรสาคร",
    "nakhon-pathom": "นครปฐม",
}
TYPES = [
    "condos-for-sale",
    "houses-for-sale",
    "townhouses-for-sale",
    "land-for-sale",
    "villas-for-sale",
    "apartments-for-sale",
    "commercial-property-for-sale",
]

BANGKOK_DISTRICTS = [
    "bang-bon", "bang-kapi", "bang-khae", "bang-khen", "bang-kho-laem", "bang-khun-thian",
    "bang-na", "bang-phlat", "bang-rak", "bang-sue", "bangkok-noi", "bangkok-yai", "bueng-kum",
    "chatuchak", "chom-thong", "din-daeng", "don-mueang", "dusit", "huai-khwang", "khan-na-yao",
    "khlong-sam-wa", "khlong-san", "khlong-toei", "lak-si", "lat-krabang", "lat-phrao", "min-buri",
    "nong-chok", "nong-khaem", "pathum-wan", "phasi-charoen", "phaya-thai", "phra-khanong",
    "phra-nakhon", "pom-prap-sattru-phai", "prawet", "rat-burana", "ratchathewi", "sai-mai",
    "samphanthawong", "saphan-sung", "sathon", "suan-luang", "taling-chan", "thawi-watthana",
    "thon-buri", "thung-khru", "wang-thonglang", "watthana", "yan-nawa",
]
BEDROOM_SLUGS = ["studio", "1-bedroom", "2-bedrooms", "3-bedrooms", "4-bedrooms", "5-bedrooms"]
PAGE_CAP = 333          # site returns recycled listings past this page
MAX_ITEMS = PAGE_CAP * 30

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_PATH = os.path.join(HERE, "dotproperty_raw.jsonl")
DONE_PATH = os.path.join(HERE, "dotproperty_done.txt")
CSV_PATH = os.path.join(HERE, "dotproperty_listings.csv")

LD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
CARD_RE = re.compile(r'data-testid="unit-search-result-item-details"[^>]*>(.*?)</div>', re.S)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(path, retries=4):
    for attempt in range(retries):
        try:
            r = requests.get(BASE + "/" + path, headers=HEADERS, timeout=40)
            if r.status_code == 200:
                return r.text
            if r.status_code == 404:
                return ""  # past the last page
        except requests.RequestException:
            pass
        time.sleep(2 * (attempt + 1))
    return None


def parse_card(text):
    # card text looks like: 3 ห้องนอน • 2 ห้องน้ำ • 128 ตรม. • ฿14,844/ตรม. • ทาวน์เฮ้าส์
    parts = [p.strip() for p in TAG_RE.sub("|", text).split("|")]
    parts = [p for p in parts if p and p != "•"]
    out = {"bedrooms": None, "bathrooms": None, "area_sqm": None,
           "price_per_sqm": None, "property_type": None}
    for p in parts:
        m = re.search(r"\d[\d,]*(?:\.\d+)?", p)
        num = m.group(0).replace(",", "") if m else ""
        if p == "สตูดิโอ":
            out["bedrooms"] = 0
        elif p.endswith("ห้องนอน"):
            out["bedrooms"] = int(num)
        elif p.endswith("ห้องน้ำ"):
            out["bathrooms"] = int(num)
        elif p.endswith("/ตรม."):
            out["price_per_sqm"] = float(num) if num else None
        elif p.endswith("ตรม."):
            out["area_sqm"] = float(num) if num else None
        elif not num:
            out["property_type"] = p
    return out


def parse_page(html, prov_slug, type_slug, page):
    items = None
    for m in LD_RE.finditer(html):
        t = m.group(1)
        if '"ItemList"' in t:
            items = json.loads(t).get("itemListElement", [])
            break
    if not items:
        return []
    cards = [parse_card(c) for c in CARD_RE.findall(html)]
    rows = []
    for i, li in enumerate(items):
        it = li.get("item", {})
        about = it.get("about", {}) or {}
        addr = about.get("address", {}) or {}
        geo = about.get("geo", {}) or {}
        offer = it.get("offers", {}) or {}
        card = cards[i] if i < len(cards) else parse_card("")
        url = it.get("url", "")
        rows.append({
            "listing_id": url.rsplit("_", 1)[-1] if "_" in url else url,
            "url": url,
            "title": it.get("name"),
            "project_name": (about.get("containedInPlace") or {}).get("name"),
            "property_type": card["property_type"],
            "type_slug": type_slug,
            "bedrooms": about.get("numberOfBedrooms", card["bedrooms"]),
            "bathrooms": card["bathrooms"],
            "area_sqm": card["area_sqm"],
            "price_thb": float(offer["price"]) if offer.get("price") else None,
            "price_per_sqm": card["price_per_sqm"],
            "sub_district": addr.get("streetAddress"),
            "district": addr.get("addressLocality"),
            "province": addr.get("addressRegion") or PROVINCES[prov_slug],
            "latitude": geo.get("latitude"),
            "longitude": geo.get("longitude"),
            "date_posted": it.get("datePosted"),
            "description": it.get("description"),
            "source": "dotproperty",
            "source_page": f"{type_slug}/{prov_slug}?page={page}",
        })
    return rows


def scrape_job(path, prov_slug, type_slug, page):
    html = fetch(f"{path}?page={page}")
    if html is None:
        return page, None
    return page, parse_page(html, prov_slug, type_slug, page)


def count_items(path):
    html = fetch(path)
    m = re.search(r'"numberOfItems":\s*(\d+)', html or "")
    return int(m.group(1)) if m else 0


def plan_jobs():
    """Split each (type, province) query until every job is under PAGE_CAP pages;
    the site recycles listings past page ~333, so bigger queries lose rows."""
    jobs = []
    for type_slug in TYPES:
        for prov_slug in PROVINCES:
            base = f"{type_slug}/{prov_slug}"
            if count_items(base) <= MAX_ITEMS or prov_slug != "bangkok":
                jobs.append((base, prov_slug, type_slug))
                continue
            for dist in BANGKOK_DISTRICTS:
                path = f"{base}/{dist}"
                if count_items(path) <= MAX_ITEMS:
                    jobs.append((path, prov_slug, type_slug))
                else:
                    jobs += [(f"{path}/{b}", prov_slug, type_slug) for b in BEDROOM_SLUGS]
    return jobs


def load_done():
    if not os.path.exists(DONE_PATH):
        return set()
    with open(DONE_PATH, encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-pages", type=int, default=PAGE_CAP,
                    help=f"cap pages per job (site recycles past {PAGE_CAP})")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--delay", type=float, default=0.5)
    args = ap.parse_args()

    done = load_done()
    raw = open(RAW_PATH, "a", encoding="utf-8")
    done_f = open(DONE_PATH, "a", encoding="utf-8")
    total = 0

    jobs = plan_jobs()
    print(f"{len(jobs)} jobs planned", flush=True)
    for path, prov_slug, type_slug in jobs:
        if f"{path}:END" in done:
            continue
        page = 1
        finished = False
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            while not finished:
                batch = []
                while len(batch) < args.workers:
                    if page > args.max_pages:
                        finished = True
                        break
                    if f"{path}:{page}" in done:
                        page += 1
                        continue
                    batch.append(ex.submit(scrape_job, path, prov_slug, type_slug, page))
                    page += 1
                    time.sleep(args.delay)
                if not batch:
                    break
                for fut in as_completed(batch):
                    pg, rows = fut.result()
                    if rows is None:
                        print(f"FAIL {path} page {pg}", file=sys.stderr, flush=True)
                        continue
                    if not rows:
                        finished = True
                        continue
                    for r in rows:
                        raw.write(json.dumps(r, ensure_ascii=False) + "\n")
                    done_f.write(f"{path}:{pg}\n")
                    total += len(rows)
                raw.flush()
                done_f.flush()
        done_f.write(f"{path}:END\n")
        done_f.flush()
        print(f"{path}: done through page {page - 1}, rows so far {total}", flush=True)

    raw.close()
    done_f.close()
    build_csv()


def build_csv():
    rows = []
    with open(RAW_PATH, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    df = pd.DataFrame(rows).drop_duplicates(subset="listing_id", keep="last")
    df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")
    print(f"wrote {len(df)} unique listings to {CSV_PATH}", flush=True)


if __name__ == "__main__":
    main()
