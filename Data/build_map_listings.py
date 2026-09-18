#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build public/listings.json for the "บ้านมือสอง" map: a few thousand current
for-sale listings that carry a photo and coordinates.

Baania is the one scraped site whose list pages give both, so the file is
fetched fresh from it (newest first) rather than cut from baania_raw.jsonl,
which predates the image_url column.

Usage:
    python build_map_listings.py                 # ~2,000 listings, ~1 min
    python build_map_listings.py --pages 5       # smoke test
"""

import argparse
import json
import os

from scrape_sites import BA_BASE, BA_MAX_PRICE, BA_PROVINCES, ba_parse, fetch

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "listings.json")
# Bangkok carries most of the market; the ring provinces get a page count each.
PAGES = {3781: 25, 3372: 5, 3599: 5, 3498: 5, 3555: 2, 3667: 2}
KEEP = ("listing_id", "url", "title", "property_type", "bedrooms", "bathrooms", "area_sqm",
        "land_sqwa", "price_thb", "sub_district", "district", "province", "latitude",
        "longitude", "date_posted", "image_url")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=None, help="cap pages per province")
    args = ap.parse_args()

    rows, seen = [], set()
    for pid, n_pages in PAGES.items():
        base = BA_BASE.format(pid=pid, lo=0, hi=BA_MAX_PRICE) + "&sort.updated=desc"
        for page in range(1, min(n_pages, args.pages or n_pages) + 1):
            html = fetch(f"{base}&page={page}")
            for r in ba_parse(html or "", f"map:{pid}", page):
                if r["listing_id"] in seen or not all(
                        r[k] for k in ("latitude", "longitude", "image_url", "price_thb")):
                    continue
                seen.add(r["listing_id"])
                rows.append({k: r[k] for k in KEEP})
        print(f"{BA_PROVINCES[pid]}: {len(rows)} so far", flush=True)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(rows)} listings to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
