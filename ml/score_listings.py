"""Precompute the three-way decision for every map listing pin.

Runs each listing through the real /api/predict route in-process and writes
public/decisions.json as {listing_id: label}. Rows the panel cannot price
(unmapped type, no area, outside coverage) are left out.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

TYPE_MAP = {
    "คอนโด": "condo",
    "บ้าน": "house",
    "บ้านแฝด": "house",
    "ทาวน์โฮม": "townhome",
    "ที่ดิน": "land",
}
AREA_MIN, AREA_MAX = 10, 20000
YEAR = 2569
COVERAGE = {"latMin": 13.4, "latMax": 14.3, "lngMin": 99.8, "lngMax": 101.0}
SQM_PER_SQWA = 4

OUTPUT = Path(__file__).parent.parent / "public" / "decisions.json"
LISTINGS = Path(__file__).parent.parent / "public" / "listings.json"


def _clamp(value: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, value))


def body_for(row: dict) -> dict | None:
    """The /api/predict body the panel sends for a listing pin, or None if unpriceable."""
    property_type = TYPE_MAP.get(row.get("property_type"))
    if property_type is None:
        return None

    area = row.get("area_sqm")
    if area is None and row.get("land_sqwa") is not None:
        area = row["land_sqwa"] * SQM_PER_SQWA
    if area is None:
        return None

    lat, lng = row["latitude"], row["longitude"]
    if not (COVERAGE["latMin"] <= lat <= COVERAGE["latMax"] and COVERAGE["lngMin"] <= lng <= COVERAGE["lngMax"]):
        return None

    body = {
        "propertyType": property_type,
        "area": _clamp(area, AREA_MIN, AREA_MAX),
        "nUnits": 1,
        "year": YEAR,
        "lat": lat,
        "lng": lng,
    }
    for key, src in (("bedrooms", "bedrooms"), ("bathrooms", "bathrooms")):
        value = row.get(src)
        if value is not None:
            body[key] = _clamp(value, 0, 20)
    return body


def main() -> None:
    import api  # lazy: loads the model bundle and Flask

    rows = json.loads(LISTINGS.read_text(encoding="utf-8"))
    client = api.app.test_client()
    decisions: dict[str, str] = {}
    counts: Counter[str] = Counter()
    skipped = 0

    for row in rows:
        body = body_for(row)
        if body is None:
            skipped += 1
            continue
        resp = client.post("/api/predict", json=body)
        if resp.status_code != 200:
            skipped += 1
            continue
        decision = resp.get_json().get("decision")
        if not decision:
            skipped += 1
            continue
        label = decision["label"]
        decisions[row["listing_id"]] = label
        counts[label] += 1

    OUTPUT.write_text(
        json.dumps(decisions, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    for label in ("accept", "defer", "reject"):
        print(f"{label}: {counts.get(label, 0)}")
    print(f"skipped: {skipped}")
    print(f"wrote {len(decisions)} decisions to {OUTPUT}")


if __name__ == "__main__":
    sys.exit(main())
