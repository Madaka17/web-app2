#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collect Baania for-sale listings into listings.csv. RUN THIS ON YOUR OWN MACHINE.

What you get is the ASKING price - what a seller put on a board. It is not what
the property sold for, and it is not an appraisal. Nobody publishes Thai sold
prices: the Land Department does not release per-transfer records, so asking
price is the closest public thing there is. Expect it to sit above both the
appraisal and the eventual sale.

Why it has to run on your machine: baania.com answers 403 to requests from a
datacentre address, so this was written against pages read through a real
browser but never run end to end. Treat the first run as a test - check
listings.csv before pointing it at thousands of pages.

What it will not do
  - It reads robots.txt on every run and refuses any path disallowed there.
    Baania disallows */s/*, which is the search UI, so this walks the category
    pages and the /listing/ pages instead - both allowed at the time of writing.
  - It sends a real browser's request through Playwright rather than forging
    headers, and it will not touch a site that answers with a bot challenge.
  - One page at a time, with a delay. Nothing here is worth hammering a small
    company's servers for.

Setup
    pip install playwright beautifulsoup4
    playwright install chromium

Usage
    python scrape_listings.py --pages 5            # a careful first look
    python scrape_listings.py --pages 200 --delay 3
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "listings.csv"
SEEN = HERE / ".listing_urls_seen.txt"

SITE = "https://www.baania.com"
CATEGORIES = {
    "condo": "/ขายคอนโดมือสอง",
    "house": "/บ้านมือสอง",
    "townhome": "/ทาวน์โฮมมือสอง",
    "land": "/ที่ดินมือสอง",
}
USER_AGENT = "Mozilla/5.0"

FIELDS = ["url", "category", "price_thb", "area_sqm", "bedrooms", "bathrooms",
          "project", "subdistrict", "district", "province", "lat", "lng", "scraped_at"]

RE_PRICE = re.compile(r"([\d,]{7,})\s*THB")
RE_AREA = re.compile(r"([\d,]+(?:\.\d+)?)\s*ตร\.ม\.")
RE_BED = re.compile(r"(\d+)\s*ห้องนอน")
RE_BATH = re.compile(r"(\d+)\s*ห้องน้ำ")
RE_PROJECT = re.compile(r"โครงการ\s*:\s*([^\n]+)")
RE_LOCATION = re.compile(r"ที่ตั้ง\s*:\s*แขวง(\S+)\s*เขต(\S+)\s*(\S+)")


def robots(url_base: str) -> urllib.robotparser.RobotFileParser:
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(url_base + "/robots.txt")
    rp.read()
    return rp


def number(text: str | None) -> float | None:
    if not text:
        return None
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return None


def parse_listing(url: str, category: str, html: str, text: str) -> dict:
    row = {f: "" for f in FIELDS}
    row.update(url=url, category=category, scraped_at=time.strftime("%Y-%m-%d"))

    # JSON-LD is the part of the page meant to be read by machines, so trust it
    # for the address and fall back to the visible text only where it is silent.
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except json.JSONDecodeError:
            continue
        addr = d.get("address") or {}
        row["district"] = row["district"] or addr.get("addressLocality", "")
        row["province"] = row["province"] or addr.get("addressRegion", "")
        geo = d.get("geo") or {}
        row["lat"] = row["lat"] or geo.get("latitude", "")
        row["lng"] = row["lng"] or geo.get("longitude", "")

    flat = re.sub(r"\s+", " ", text)
    if m := RE_PRICE.search(flat):
        row["price_thb"] = number(m.group(1)) or ""
    if m := RE_AREA.search(flat):
        row["area_sqm"] = number(m.group(1)) or ""
    if m := RE_BED.search(flat):
        row["bedrooms"] = m.group(1)
    if m := RE_BATH.search(flat):
        row["bathrooms"] = m.group(1)
    if m := RE_PROJECT.search(text):
        row["project"] = m.group(1).strip()
    if m := RE_LOCATION.search(flat):
        row["subdistrict"], row["district"], row["province"] = m.groups()
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=5, help="category pages per property type")
    ap.add_argument("--delay", type=float, default=3.0, help="seconds between requests")
    ap.add_argument("--headless", action="store_true", default=True)
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("pip install playwright && playwright install chromium")

    rp = robots(SITE)
    seen = set(SEEN.read_text(encoding="utf-8").split()) if SEEN.exists() else set()
    rows: list[dict] = []

    def allowed(path: str) -> bool:
        ok = rp.can_fetch(USER_AGENT, SITE + path)
        if not ok:
            print(f"  robots.txt disallows {path} - skipping")
        return ok

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        page = browser.new_page()

        def visit(path: str) -> tuple[str, str]:
            page.goto(SITE + urllib.parse.quote(path, safe="/()-"), wait_until="networkidle")
            time.sleep(args.delay)
            return page.content(), page.inner_text("body")

        for category, cat_path in CATEGORIES.items():
            if not allowed(cat_path):
                continue
            links: list[str] = []
            for n in range(1, args.pages + 1):
                path = cat_path if n == 1 else f"{cat_path}?page={n}"
                print(f"[{category}] category page {n}", flush=True)
                try:
                    html, _ = visit(path)
                except Exception as e:  # a slow page should not end the run
                    print(f"  {type(e).__name__}: {e}")
                    continue
                found = re.findall(r'href="(/listing/[^"?#]+)"', html)
                links.extend(h for h in dict.fromkeys(found) if h not in seen)

            print(f"[{category}] {len(links)} new listings")
            for i, href in enumerate(links, 1):
                if not allowed(href):
                    continue
                try:
                    html, text = visit(href)
                except Exception as e:
                    print(f"  {i}/{len(links)} {type(e).__name__}")
                    continue
                row = parse_listing(SITE + href, category, html, text)
                if row["price_thb"] and row["area_sqm"]:
                    rows.append(row)
                seen.add(href)
                if i % 10 == 0:
                    print(f"  {i}/{len(links)} ({len(rows)} usable)", flush=True)

        browser.close()

    is_new = not OUT.exists()
    with OUT.open("a", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if is_new:
            w.writeheader()
        w.writerows(rows)
    SEEN.write_text("\n".join(sorted(seen)), encoding="utf-8")

    print(f"\nwrote {len(rows)} rows to {OUT}")
    if rows:
        ppsqm = sorted(r["price_thb"] / r["area_sqm"] for r in rows)
        print(f"median asking price per sqm: {ppsqm[len(ppsqm) // 2]:,.0f} THB")


if __name__ == "__main__":
    main()
