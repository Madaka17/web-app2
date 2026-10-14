"""Project index and grades: every หมู่บ้านจัดสรร and condo project on record,
graded by price, with what the listings say about location, security and
management. Writes models/projects.json, which api.py serves for the village
search and the grade comparison.

    .venv/bin/python projects.py      # ~1 min, no retraining needed

Grades (estate.py): villages by median asking price, condos by median baht per
sqm. A grade says what a project asks, not how good it is; the quality signals
sit beside it so the two can be compared:
  transit_m   median distance to a rail station (where the site gives it)
  security    share of listings that mention guards, CCTV, key cards, 24h
  juristic    share that mention a juristic person, common fee, clubhouse
Construction quality is not in the data and is not scored.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from estate import CONDO_GRADES, ESTATE_TYPES, VILLAGE_GRADES, grade
from prepare_data import TARGET, clean, load_raw

OUT = Path(__file__).parent / "models" / "projects.json"
CONDO = "คอนโด"
# The model's 1% top trim (prepare_data.PPSQM_TRIM) cuts exactly the Ultimate
# Class condos (Ritz-Carlton, Four Seasons, Scope at 550-750k/sqm); grading
# keeps them and drops only the top 0.1%, where the typos are.
PPSQM_TRIM = (0.01, 0.999)
# A grade's figures use projects with at least this many listings; one listing
# is one agent's asking price, not the project's.
MIN_LISTINGS = 3
EXAMPLES = 6


def _num(x, nd: int = 0):
    return None if pd.isna(x) else round(float(x), nd)


def build_projects(df: pd.DataFrame) -> list[dict]:
    names = (df.dropna(subset=["project_key", "project_name"])
             .groupby("project_key")["project_name"].first().to_dict())
    rows = []
    for kind, mask in [("village", df["collateral_type"].isin(ESTATE_TYPES)),
                       ("condo", df["collateral_type"] == CONDO)]:
        d = df[mask & df["project_key"].notna()]
        d = d.assign(ppsqm=d[TARGET] / d["area_sqm"])
        mode = lambda s: s.mode().iat[0]
        g = d.groupby("project_key").agg(
            n=("ppsqm", "size"), ppsqm=("ppsqm", "median"), price=(TARGET, "median"),
            area=("area_sqm", "median"), transit_m=("transit_m", "median"),
            security=("security", "mean"), juristic=("juristic", "mean"),
            province=("province", mode), district=("district", mode), sub_district=("sub_district", mode),
            lat=("latitude", "median"), lng=("longitude", "median"),
            types=("collateral_type", lambda s: sorted(s.unique())))
        for key, r in g.iterrows():
            value = r["price"] if kind == "village" else r["ppsqm"]
            rows.append({
                "key": key, "name": names.get(key, key), "kind": kind,
                "grade": grade(value, VILLAGE_GRADES if kind == "village" else CONDO_GRADES),
                "types": r["types"], "n": int(r["n"]),
                "price": _num(r["price"], -3), "ppsqm": _num(r["ppsqm"], -2), "area": _num(r["area"], 1),
                "transit_m": _num(r["transit_m"]),
                "security": round(float(r["security"]), 3), "juristic": round(float(r["juristic"]), 3),
                "province": r["province"], "district": r["district"], "sub_district": r["sub_district"],
                "lat": _num(r["lat"], 6), "lng": _num(r["lng"], 6),
            })
    return sorted(rows, key=lambda r: -r["n"])


def grade_summary(projects: list[dict], kind: str) -> list[dict]:
    """One row per grade, highest first: how many projects, what they ask, and
    what their listings say about location, security and management."""
    bands = VILLAGE_GRADES if kind == "village" else CONDO_GRADES
    p = pd.DataFrame([r for r in projects if r["kind"] == kind])
    solid = p[p["n"] >= MIN_LISTINGS]
    out = []
    for gid, label, lo, hi in bands:
        g = solid[solid["grade"] == gid]
        row = {"grade": gid, "label": label, "low": lo, "high": None if np.isinf(hi) else hi,
               "projects": int((p["grade"] == gid).sum()), "graded_projects": len(g),
               "listings": int(g["n"].sum())}
        if len(g):
            w = g["n"].to_numpy(dtype=float)
            row.update({
                "price_median": _num(g["price"].median(), -3),
                "price_p25": _num(g["price"].quantile(0.25), -3),
                "price_p75": _num(g["price"].quantile(0.75), -3),
                "ppsqm_median": _num(g["ppsqm"].median(), -2),
                "area_median": _num(g["area"].median(), 1),
                "transit_m_median": _num(g["transit_m"].median()),
                # Listing-weighted: a 40-listing village says more than a 3-listing one.
                "security_share": round(float(np.average(g["security"], weights=w)), 3),
                "juristic_share": round(float(np.average(g["juristic"], weights=w)), 3),
                "examples": [{"key": r["key"], "name": r["name"], "district": r["district"],
                              "price": r["price"], "ppsqm": r["ppsqm"], "n": r["n"]}
                             for r in g.nlargest(EXAMPLES, "n").to_dict("records")],
            })
        out.append(row)
    # Each grade against the one below it, per sqm: the step up the ladder costs.
    for hi_row, lo_row in zip(out, out[1:]):
        if hi_row.get("ppsqm_median") and lo_row.get("ppsqm_median"):
            hi_row["ppsqm_vs_next_pct"] = round((hi_row["ppsqm_median"] / lo_row["ppsqm_median"] - 1) * 100, 1)
    return out


def main() -> None:
    df, _ = clean(load_raw(), ppsqm_trim=PPSQM_TRIM)
    projects = build_projects(df)
    summary = {kind: grade_summary(projects, kind) for kind in ("village", "condo")}
    OUT.write_text(json.dumps({"min_listings": MIN_LISTINGS, "projects": projects, "grades": summary},
                              ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT}: {sum(p['kind'] == 'village' for p in projects):,} villages, "
          f"{sum(p['kind'] == 'condo' for p in projects):,} condo projects")
    for kind, rows in summary.items():
        print(f"\n{kind} grades (projects with >= {MIN_LISTINGS} listings):")
        for r in rows:
            if not r["graded_projects"]:
                print(f"  {r['label']:<18} -")
                continue
            print(f"  {r['label']:<18} {r['graded_projects']:>5} proj  median {r['price_median']:>13,.0f} ฿  "
                  f"{r['ppsqm_median']:>9,.0f} ฿/sqm  transit {r['transit_m_median'] or 0:>6,.0f} m  "
                  f"security {r['security_share']:.0%}  juristic {r['juristic_share']:.0%}  "
                  f"vs next {r.get('ppsqm_vs_next_pct', '-')}%")


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    main()
