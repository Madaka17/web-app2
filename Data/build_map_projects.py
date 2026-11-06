#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build public/projects.json for the map's project pins.

Reads the trained project table in ml/models/projects.json, keeps the projects
that have coordinates, and writes a compact copy the frontend can fetch.

Usage (from the repo root):
    python -I Data/build_map_projects.py
"""

import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "ml", "models", "projects.json")
OUT = os.path.join(ROOT, "public", "projects.json")
KEEP = ("key", "name", "kind", "grade", "n", "ppsqm", "price", "area",
        "province", "district", "sub_district", "lat", "lng")


def main() -> None:
    with open(SRC, encoding="utf-8") as f:
        projects = json.load(f)["projects"]

    out = []
    for p in projects:
        if p.get("lat") is None or p.get("lng") is None:
            continue
        row = {k: p.get(k) for k in KEEP}
        row["lat"] = round(row["lat"], 6)
        row["lng"] = round(row["lng"], 6)
        out.append(row)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} projects written")


if __name__ == "__main__":
    main()
