#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch official construction material prices for the /build-cost page.

Source: Trade Policy and Strategy Office (สนค.), Ministry of Commerce,
"ราคาวัสดุก่อสร้างรายจังหวัด", region type 10 (ส่วนกลาง). Prices are cash,
ex-VAT and ex-transport. The page behind it is
https://index.tpso.go.th/construction-material-prices/prices-building-materials

Some categories (tiles, sand, sanitary ware, timber) stopped updating for the
central region in 2569, so each item keeps its own latest month within the
last 13 months, and the page shows that month per line.

Reads the commodity codes from src/data/buildCost.json and writes only those
items to src/data/materialPrices.json.

Usage (from the repo root), once a month:
    python -I Data/fetch_material_prices.py
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SPEC = os.path.join(ROOT, "src", "data", "buildCost.json")
OUT = os.path.join(ROOT, "src", "data", "materialPrices.json")
API = "https://index.tpso.go.th/api/cmip"
PAGE = "https://index.tpso.go.th/construction-material-prices/prices-building-materials"
REGION = "10"  # ส่วนกลาง
HEADERS = {"User-Agent": "openplot-price-fetch/1.0", "Content-Type": "application/json"}


def call(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{API}/{path}", data=data, headers=HEADERS,
                                 method="GET" if body is None else "POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def latest_prices(rows):
    """{code: {name, unit, price, month 'YYYY-MM' (CE)}} from a /filter response."""
    out = {}
    for e in rows:
        best = None
        for y in e.get("years") or []:
            for m in y.get("months") or []:
                if m.get("priceCur") is None:
                    continue
                key = (y["year"], m["month"])
                if best is None or key > best[0]:
                    best = (key, float(m["priceCur"]))
        if best:
            (be_year, month), price = best
            out[e["commodityCode"]] = {
                "name": " ".join(e["commodityNameTH"].split()),
                "unit": e.get("unitName") or "",
                "price": price,
                "month": f"{be_year - 543}-{month:02d}",
            }
    return out


def main() -> None:
    with open(SPEC, encoding="utf-8") as f:
        codes = {i["code"] for i in json.load(f)["items"].values() if i.get("code")}

    master = call("master")
    end = master["period"]["end"]
    end_y, end_m = int(end["year"]), int(end["month"])
    start_y, start_m = (end_y - 1, end_m) if end_m < 12 else (end_y, 1)
    heads = sorted({c[:2] for c in codes})
    rows = call("filter", {
        "YearBase": 2558, "Categories": [], "Search": "", "Types": [REGION],
        "HeadCategories": heads, "TimeOption": True,
        "Period": {"StartYear": str(start_y), "StartMonth": str(start_m),
                   "EndYear": str(end_y), "EndMonth": str(end_m)},
    })
    prices = {c: p for c, p in latest_prices(rows).items() if c in codes}

    missing = sorted(codes - prices.keys())
    if missing:
        print("No price in the last 13 months for:", ", ".join(missing), file=sys.stderr)
        sys.exit(1)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "source": PAGE,
            "region": "ส่วนกลาง",
            "basis": "ราคาเงินสด ไม่รวมภาษีมูลค่าเพิ่ม ไม่รวมค่าขนส่ง",
            "latest_month": f"{end_y - 543}-{end_m:02d}",
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "items": dict(sorted(prices.items())),
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{len(prices)} prices written to {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
