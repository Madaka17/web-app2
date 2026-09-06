#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Boil the Treasury Department's open appraisal data down to price_tables.json.

Source (Open Data Common, https://catalog.treasury.go.th):

  condominium-valuation  ราคาประเมินห้องชุด      per building, with province /
                         district / subdistrict and VAL_AMT_P_MET, the official
                         appraisal in baht per square metre.
  land-valuation         ราคาประเมินที่ดิน        per parcel, EVAPRICE in baht
                         per ตารางวา. Keyed by UTM map sheet, so the province is
                         known (one file each) but the district is not.
  building-valuation     ราคาประเมินสิ่งปลูกสร้าง construction cost per square
                         metre by structure type and province.

The condo file carries district names, so condo prices are kept per district.
The land file does not, so land is kept per province and spread across districts
later using the condo gradient - the assumption being that a district where
condos appraise high has expensive land too. That is an assumption, not a
measurement, and it is the weakest link in the chain.

Downloads ~220 MB and writes a ~90 KB table. Run it again only when the Treasury
publishes a new round; the committed price_tables.json is what the generator
reads.
"""

import io
import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE / "price_tables.json"
CACHE = HERE / ".treasury_cache"

BASE = "https://catalog.treasury.go.th/dataset"
CONDO_URL = f"{BASE}/74a5e3a4-ebaa-4602-aac8-5b93c8647730/resource/b115b105-58c6-4c3d-8ca8-687f7501e296/download/condo_all_20240805.csv"
CONSTRUCT_URL = f"{BASE}/83038253-61e8-431e-947b-6931cc689c3a/resource/cf687667-5386-4813-8062-429fb0cd4acf/download/construct_all_20240805.csv"
LAND_URLS = {
    "กรุงเทพมหานคร": f"{BASE}/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/00da1ca3-2c41-436d-a426-d0c06f8cae03/download/land_10_bangkok.csv",
    "สมุทรปราการ": f"{BASE}/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/9919be07-ecdd-4542-bd67-6d408691dbd0/download/land_11_samut-prakan.csv",
    "นนทบุรี": f"{BASE}/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/1385f623-15c9-4253-b659-093ace6840da/download/land_12_nonthaburi.csv",
    "ปทุมธานี": f"{BASE}/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/bb55833f-6dd0-491a-bbce-48a3301fb303/download/land_13_pathum-thani.csv",
    "นครปฐม": f"{BASE}/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/16b9866c-c457-4845-8437-d6694bbe8338/download/land_73_nakhon-pathom.csv",
    "สมุทรสาคร": f"{BASE}/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/0355472e-c037-41bd-a34c-d6006d4dd79d/download/land_74_samut-sakhon.csv",
}

PROVINCES = list(LAND_URLS)
SQW_PER_SQM = 4.0  # 1 ตารางวา = 4 ตารางเมตร
QUANTILES = [round(q, 2) for q in np.arange(0.05, 1.0, 0.05)]

# Residential structures only. The table also prices warehouses and factories,
# which no one values through this app.
HOUSE_TYPES = [
    "บ้านพักอาศัยตึกสองชั้น",
    "บ้านพักอาศัยตึกชั้นเดียว",
    "บ้านพักอาศัยครึ่งตึกครึ่งไม้สองชั้น",
    "ตึกแถวสองชั้น",
    "ตึกแถวสามชั้น",
]


def fetch(url: str, name: str) -> bytes:
    """Downloads are big and the source is slow; keep them next to the script."""
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print(f"  downloading {name} ...", flush=True)
        with urllib.request.urlopen(url) as r:
            path.write_bytes(r.read())
    return path.read_bytes()


def read_csv(raw: bytes, **kw) -> pd.DataFrame:
    """The Treasury exports are TIS-620 in places and UTF-8 in others."""
    for enc in ("utf-8", "cp874"):
        try:
            return pd.read_csv(io.BytesIO(raw), encoding=enc, low_memory=False, **kw)
        except UnicodeDecodeError:
            continue
    raise ValueError("neither utf-8 nor cp874 decoded this file")


def quantile_table(values: np.ndarray) -> list[float]:
    return [round(float(np.quantile(values, q)), 1) for q in QUANTILES]


def condo_tables() -> tuple[dict, dict]:
    df = read_csv(fetch(CONDO_URL, "condo_all.csv"))
    df = df[df.CHANGWAT_NAME.isin(PROVINCES)]
    df = df[df.USE_CATG.fillna("").str.contains("พักอาศัย")]
    df = df[df.VAL_AMT_P_MET > 0]

    # Price is a property of the BUILDING, not the district: units in one
    # building sit within 8% of each other while buildings in one district
    # spread 4.3x from p10 to p90. Drawing a unit's price straight from the
    # district distribution throws that away and makes condos look
    # unpredictable. There are only 8,483 buildings in these six provinces, so
    # keep every one of them and let the generator pick a real building.
    # Carry the unit count with each building. A tower and a low-rise are one
    # row each here, but the published district median is a median over UNITS,
    # so buildings have to be drawn in proportion to how many units they hold or
    # the generated level lands well below the real one.
    building = (df.groupby(["CHANGWAT_NAME", "AMPHUR_NAME", "CONDO_ID", "BUILD_NAME"])
                  .VAL_AMT_P_MET.agg(["median", "size"]))

    by_district = {}
    for (prov, dist), g in df.groupby(["CHANGWAT_NAME", "AMPHUR_NAME"]):
        v = g.VAL_AMT_P_MET.to_numpy(dtype=float)
        if len(v) < 20:
            continue
        b = building.loc[prov, dist].sort_values("median")
        by_district[f"{prov}|{dist}"] = {
            "n": int(len(v)),
            "q": quantile_table(v),
            "buildings": [round(float(x), 1) for x in b["median"]],
            "building_units": [int(x) for x in b["size"]],
        }

    by_province = {}
    for prov, g in df.groupby("CHANGWAT_NAME"):
        v = g.VAL_AMT_P_MET.to_numpy(dtype=float)
        by_province[prov] = {"n": int(len(v)), "median": round(float(np.median(v)), 1)}

    n_b = sum(len(v["buildings"]) for v in by_district.values())
    print(f"  condo: {len(df):,} residential units in {n_b:,} buildings, "
          f"{len(by_district)} districts")
    return by_district, by_province


def land_table() -> dict:
    out = {}
    for prov, url in LAND_URLS.items():
        name = "land_" + url.rsplit("/", 1)[-1].split("_")[1] + ".csv"
        df = read_csv(fetch(url, name), usecols=["EVAPRICE"])
        v = df.EVAPRICE.dropna().to_numpy(dtype=float)
        v = v[v > 0] / SQW_PER_SQM  # baht per sqm
        out[prov] = {"n": int(len(v)), "q": quantile_table(v)}
        print(f"  land {prov}: {len(v):,} parcels, median {np.median(v):,.0f} /sqm")
    return out


def construction_table() -> dict:
    df = read_csv(fetch(CONSTRUCT_URL, "construct_all.csv"))
    df = df[df.CHANGWAT_NAME.isin(PROVINCES) & df.NAME_CONSTR.isin(HOUSE_TYPES)]
    out = {}
    for prov, g in df.groupby("CHANGWAT_NAME"):
        out[prov] = {r.NAME_CONSTR: float(r.PRICE_CONSTR) for r in g.itertuples()}
    print(f"  construction: {len(HOUSE_TYPES)} residential types x {len(out)} provinces")
    return out


def main() -> None:
    print("building price tables from Treasury open data")
    condo_district, condo_province = condo_tables()
    tables = {
        "source": {
            "publisher": "กรมธนารักษ์ (Treasury Department)",
            "licence": "Open Data Common",
            "catalog": "https://catalog.treasury.go.th",
            "snapshot": "2024-08-05",
            "note": "One snapshot, not a time series. The year trend in the "
                    "generator is an assumption laid on top of these levels.",
        },
        "quantiles": QUANTILES,
        "condo_ppsqm_by_district": condo_district,
        "condo_ppsqm_by_province": condo_province,
        "land_ppsqm_by_province": land_table(),
        "construction_ppsqm_by_province": construction_table(),
    }
    OUT.write_text(json.dumps(tables, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nwrote {OUT}  ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
