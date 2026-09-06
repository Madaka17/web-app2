"""
Map the web app's subdistrict ids (TIS-1099 codes in src/lib/locations.ts) onto
the province/district names the appraisal data uses.

The first two digits of a TIS code are the province, the next two the district,
so the mapping is derivable rather than hand-maintained. District names in both
sources are plain Thai ("คลองเตย"), so they join directly.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

from prepare_data import load_raw

LOCATIONS_TS = Path(__file__).parent.parent / "src/lib/locations.ts"
OUT = Path(__file__).parent / "models/location_map.json"

# TIS-1099 province prefixes present in locations.ts (Bangkok + ปริมณฑล).
PROVINCE_BY_PREFIX = {
    "10": "กรุงเทพมหานคร",
    "11": "สมุทรปราการ",
    "12": "นนทบุรี",
    "13": "ปทุมธานี",
    "73": "นครปฐม",
    "74": "สมุทรสาคร",
}


def parse_locations() -> list[dict]:
    """Pull (subdistrict id, name, district name) out of the TS data literal."""
    text = LOCATIONS_TS.read_text(encoding="utf-8")
    body = text[text.index("export const LOCATIONS"):]
    body = body[body.index("["): body.rindex("];") + 1]

    rows: list[dict] = []
    district_name: str | None = None
    district_id: str | None = None
    for block in re.finditer(r'"id":\s*"(\d+)",\s*\n\s*"name":\s*"([^"]+)"', body):
        code, name = block.group(1), block.group(2)
        if len(code) == 4:
            district_id, district_name = code, name
        elif len(code) == 6 and district_id:
            rows.append({
                "subdistrict_id": code,
                "subdistrict": name,
                "district_id": district_id,
                "district": district_name,
                "province": PROVINCE_BY_PREFIX.get(code[:2], "กรุงเทพมหานคร"),
            })
    return rows


def main() -> None:
    rows = parse_locations()
    real = load_raw()
    known = set(zip(real.province, real.district))

    matched = [r for r in rows if (r["province"], r["district"]) in known]
    unmatched = [r for r in rows if (r["province"], r["district"]) not in known]

    print(f"subdistricts in locations.ts : {len(rows):,}")
    print(f"  district found in appraisal : {len(matched):,}")
    print(f"  not found                   : {len(unmatched):,}")
    if unmatched:
        missing = sorted({(r["province"], r["district"]) for r in unmatched})
        print(f"  distinct missing districts   : {len(missing)}")
        for p, d in missing[:15]:
            print(f"      {p} / {d}")

    lookup = {r["subdistrict_id"]: {
        "subdistrict": r["subdistrict"],
        "district": r["district"],
        "province": r["province"],
        "in_training_data": (r["province"], r["district"]) in known,
    } for r in rows}

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(lookup, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nsaved {OUT}  ({len(lookup):,} subdistricts)")


if __name__ == "__main__":
    main()
