#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Work out how far asking prices sit above official appraisals, per province and
property type, and write ml/models/market_ratio.json.

    ratio = median asking price per sqm (listings.csv, from scrape_listings.py)
          / median appraisal per sqm   (price_tables.json, from the Treasury)

The app multiplies its appraisal prediction by this to show a second, rougher
figure beside it. Three things about that number are worth saying plainly:

  - Asking is not sold. A seller's board price is the start of a negotiation,
    so this ratio overstates the market, by an unknown amount. Nobody publishes
    Thai sold prices, so there is no way to correct it from public data.
  - It is a median over a whole province, not a valuation of anything. A cell
    with few listings is dropped rather than shown, because a ratio built from
    nine listings would be noise wearing a number's clothes.
  - Listings are today's; the appraisal round is 2567. Part of what this ratio
    measures is simply the years in between.

If listings.csv does not exist, or no cell clears MIN_LISTINGS, this writes
nothing and the app carries on showing the appraisal alone - which is the
correct behaviour, not a failure.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
LISTINGS = HERE / "listings.csv"
TABLES = HERE / "price_tables.json"
OUT = HERE.parent / "ml" / "models" / "market_ratio.json"

CONDO = "ห้องชุด (คอนโดมิเนียม)"
LAND = "ที่ดิน/สิ่งปลูกสร้าง/ที่ดินพร้อมสิ่งปลูกสร้าง"
# scrape_listings.py's four categories collapse onto the model's two types.
CATEGORY_TO_TYPE = {"condo": CONDO, "house": LAND, "townhome": LAND, "land": LAND}

MIN_LISTINGS = 30        # per province+type cell
MIN_DEFAULT = 60         # for the catch-all
RATIO_CLIP = (1.0, 4.0)  # below 1.0 or above 4x, assume the scrape went wrong


def load_listings() -> list[dict]:
    if not LISTINGS.exists():
        raise SystemExit(f"{LISTINGS.name} not found - run scrape_listings.py first")
    rows = []
    with LISTINGS.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            try:
                price, area = float(r["price_thb"]), float(r["area_sqm"])
            except (ValueError, KeyError):
                continue
            kind = CATEGORY_TO_TYPE.get(r.get("category", ""))
            # A 3 sqm listing or a 900M one is a typo or a portfolio, not a home.
            if not kind or not (10 <= area <= 20_000) or not (50_000 <= price <= 200_000_000):
                continue
            rows.append({"type": kind, "province": r.get("province", "").strip(),
                         "ppsqm": price / area})
    return rows


def appraisal_ppsqm(tables: dict) -> dict[tuple[str, str], float]:
    """Median official appraisal per sqm, keyed the same way as the listings."""
    qs = tables["quantiles"]
    mid = min(range(len(qs)), key=lambda i: abs(qs[i] - 0.5))
    out: dict[tuple[str, str], float] = {}
    for prov, v in tables["condo_ppsqm_by_province"].items():
        out[(CONDO, prov)] = float(v["median"])
    for prov, v in tables["land_ppsqm_by_province"].items():
        out[(LAND, prov)] = float(v["q"][mid])
    return out


def main() -> None:
    listings = load_listings()
    tables = json.loads(TABLES.read_text(encoding="utf-8"))
    appraisal = appraisal_ppsqm(tables)

    grouped: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in listings:
        grouped[(r["type"], r["province"])].append(r["ppsqm"])

    cells, all_ratios = {}, []
    for (kind, prov), values in sorted(grouped.items()):
        base = appraisal.get((kind, prov))
        if base is None or len(values) < MIN_LISTINGS:
            continue
        ratio = median(values) / base
        if not RATIO_CLIP[0] <= ratio <= RATIO_CLIP[1]:
            print(f"  skipped {kind[:12]} / {prov}: ratio {ratio:.2f} outside {RATIO_CLIP}")
            continue
        cells[f"{kind}|{prov}"] = {
            "ratio": round(ratio, 3),
            "n": len(values),
            "asking_ppsqm": round(median(values)),
            "appraisal_ppsqm": round(base),
        }
        all_ratios.extend([ratio] * len(values))

    if not cells or len(all_ratios) < MIN_DEFAULT:
        raise SystemExit(f"not enough listings yet "
                         f"({len(listings)} rows, {len(cells)} usable cells) - "
                         f"scrape more before the app can show a market figure")

    out = {
        "note": "asking price / official appraisal. Asking is not sold price.",
        "built_from": {"listings": len(listings), "cells": len(cells)},
        "cells": cells,
        "__default__": {"ratio": round(median(all_ratios), 3), "n": len(all_ratios)},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{len(listings):,} listings -> {len(cells)} cells\n")
    print(f"{'type':<14}{'province':<16}{'n':>7}{'asking':>12}{'appraisal':>12}{'ratio':>8}")
    for key, v in cells.items():
        kind, prov = key.split("|")
        short = "condo" if kind == CONDO else "land/house"
        print(f"{short:<14}{prov:<16}{v['n']:>7,}{v['asking_ppsqm']:>12,}"
              f"{v['appraisal_ppsqm']:>12,}{v['ratio']:>8.2f}")
    print(f"\ndefault ratio {out['__default__']['ratio']:.2f}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
