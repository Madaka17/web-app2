#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build an appraisal dataset for ml/ whose PRICES ARE REAL and whose ROWS ARE NOT.

Every baht in here traces to the Treasury Department's published appraisals
(price_tables.json, built by build_price_tables.py from catalog.treasury.go.th).
What is invented is the row: which property was appraised, how big it was, and
in which year. The Treasury publishes one snapshot of price levels, not a
transaction history, and the model needs a history to learn from.

So read a number out of this file as: "an appraisal of this kind, in this
district, plausibly lands here". Do not read it as a record of an appraisal that
happened. In particular the year trend is assumed, not measured.

What comes from the real tables
  condo      the appraisal per sqm of a REAL BUILDING in that district - all
             8,481 of them are in the table, and a unit inherits its building's
             rate, because that is how the Treasury actually prices them
  land       the appraisal per sqm of that province's parcels, again the real
             distribution, shifted across districts by the condo gradient
  buildings  the official construction cost per sqm for that province

What is invented
  which properties exist, their sizes, how often each is re-appraised, the split
  of rows across 2561-2569, the year-on-year trend, and a small per-appraisal
  noise term standing in for two appraisers disagreeing.

The invented parts are what let prepare_data.py's comparable features work at
all: a property has to be appraised more than once, in more than one year, for
"what did this exact size fetch here before" to mean anything.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
TABLES = HERE / "price_tables.json"
LOCATION_MAP = HERE.parent / "ml" / "models" / "location_map.json"
OUT = HERE / "appraisal_2561-2569.parquet"

N_ROWS = 534_586
SEED = 2569

CONDO = "ห้องชุด (คอนโดมิเนียม)"
LAND = "ที่ดิน/สิ่งปลูกสร้าง/ที่ดินพร้อมสิ่งปลูกสร้าง"

# Share of rows that are condos, matching the composition of the appraisal
# extract this pipeline was written against (7,903 condo rows of 39,372).
CONDO_SHARE = 0.20

# Row share per year, from that same extract's cleaned counts. 2569 is a partial
# year there and stays partial here.
YEAR_SHARE = {
    2561: 0.1333, 2562: 0.1252, 2563: 0.1252, 2564: 0.1252,
    2565: 0.1252, 2566: 0.1253, 2567: 0.1048, 2568: 0.0979, 2569: 0.0379,
}
# ASSUMPTION. The Treasury tables are a 2567-round snapshot, so the level is
# real but its movement over 2561-2569 is not in the data. Appraisal rounds move
# slowly; 2.5%/yr is deliberately milder than any market index.
YEAR_TREND = 0.025
BASE_YEAR = 2567

# Two appraisers on the same property do not write the same number, but they are
# not far apart either: the real spread already lives in the sampled tables, so
# this is only the disagreement on top.
SIGMA_ROW = 0.09
# Units within one building span about 8% top to bottom in the Treasury data
# (floor, view, balcony share), which is this much in log terms.
SIGMA_BUILDING = 0.025

# A district where condos appraise at twice the provincial norm is taken to have
# land that is dearer too. Clipped because a district with a single luxury tower
# would otherwise drag its land with it.
GRADIENT_CLIP = (0.45, 2.6)

# Land rows are a mix of bare plots and plots with a house on them; the app
# prices both under one collateral type.
P_HAS_BUILDING = 0.62
FLOOR_RATIO = (0.25, 0.85)   # floor area as a fraction of land area
DEPRECIATION = (0.55, 1.0)   # age discount on the construction cost

AREA_LOGN = {CONDO: (45.0, 0.45), LAND: (220.0, 0.95)}
AREA_CLIP = {CONDO: (22.0, 420.0), LAND: (40.0, 19_000.0)}
PLANS_PER_BUILDING = 4       # layouts a project draws up and repeats
FALLBACK_BUILDINGS = 12      # notional buildings for a district with no data
ROWS_PER_PROPERTY = {CONDO: 2.0, LAND: 1.6}

# Rows the cleaning step in prepare_data.py is meant to drop.
SHARE_BAD_VALUE = 0.003
SHARE_TINY_AREA = 0.030
SHARE_HUGE_AREA = 0.009

rng = np.random.default_rng(SEED)


def load_tables() -> dict:
    if not TABLES.exists():
        raise SystemExit(f"{TABLES.name} is missing - run build_price_tables.py first")
    return json.loads(TABLES.read_text(encoding="utf-8"))


def districts(tables: dict) -> pd.DataFrame:
    """The province/district pairs the app serves, with the weights and the
    price gradient each one draws its prices from."""
    loc = json.loads(LOCATION_MAP.read_text(encoding="utf-8"))
    counts: dict[tuple[str, str], int] = {}
    for v in loc.values():
        counts[(v["province"], v["district"])] = counts.get((v["province"], v["district"]), 0) + 1

    condo_d = tables["condo_ppsqm_by_district"]
    condo_p = tables["condo_ppsqm_by_province"]
    qs = np.array(tables["quantiles"])
    mid = int(np.argmin(np.abs(qs - 0.5)))

    rows = []
    for (prov, dist), n_sub in counts.items():
        entry = condo_d.get(f"{prov}|{dist}")
        # 6 of the 79 districts have too few condos to summarise. They fall back
        # to the provincial level, which is what the served model does too.
        gradient = 1.0
        if entry:
            gradient = float(np.clip(entry["q"][mid] / condo_p[prov]["median"], *GRADIENT_CLIP))
        rows.append({
            "province": prov,
            "district": dist,
            "subdistricts": n_sub,
            "condo_units": entry["n"] if entry else 0,
            "has_condo_prices": entry is not None,
            "gradient": gradient,
        })

    df = pd.DataFrame(rows).sort_values(["province", "district"]).reset_index(drop=True)
    # Condo rows follow where the condos actually are; land rows have no such
    # count published, so they follow how much of the map each district covers.
    df["condo_weight"] = df["condo_units"] / df["condo_units"].sum()
    df["land_weight"] = df["subdistricts"] / df["subdistricts"].sum()
    return df


def sample_quantiles(q: list[float], qs: np.ndarray, n: int) -> np.ndarray:
    """Draw from a distribution given only its quantiles, by inverting them."""
    return np.interp(rng.random(n), qs, np.asarray(q, dtype=float))


def condo_buildings(dist: pd.DataFrame, tables: dict) -> tuple[pd.DataFrame, np.ndarray]:
    """One row per real building, with the floor plans only it sells.

    Both halves matter. The price is the building's, because the Treasury
    prices a building and its units land within 8% of each other. The sizes are
    the building's too, because a project draws up four layouts and repeats
    them up the tower - so "45.3 sqm in Huai Khwang" names one project, not a
    hundred. That is what lets prepare_data.py's exact-comparable feature find
    the right building from a size, and it is why condos are predictable at all
    when the form never asks which project you mean.
    """
    condo_d = tables["condo_ppsqm_by_district"]
    condo_p = tables["condo_ppsqm_by_province"]
    rows = []
    for i, row in dist.iterrows():
        entry = condo_d.get(f"{row.province}|{row.district}")
        if entry:
            pairs = zip(entry["buildings"], entry["building_units"])
        else:
            # 6 districts have too few condos to publish; give them a handful of
            # notional buildings around the provincial median.
            base = condo_p[row.province]["median"] * row.gradient
            pairs = ((base * x, 30) for x in rng.lognormal(0.0, 0.25, FALLBACK_BUILDINGS))
        rows.extend((i, float(price), int(units)) for price, units in pairs)

    b = pd.DataFrame(rows, columns=["d", "ppsqm", "units"])
    med, sigma = AREA_LOGN[CONDO]
    lo, hi = AREA_CLIP[CONDO]
    plans = np.round(np.clip(
        rng.lognormal(np.log(med), sigma, size=(len(b), PLANS_PER_BUILDING)), lo, hi), 1)
    return b, plans


def land_ppsqm(dist: pd.DataFrame, tables: dict, d_idx: np.ndarray) -> np.ndarray:
    qs = np.array(tables["quantiles"])
    land = tables["land_ppsqm_by_province"]
    out = np.empty(len(d_idx), dtype=float)
    for i in np.unique(d_idx):
        row = dist.iloc[int(i)]
        mask = d_idx == i
        drawn = sample_quantiles(land[row.province]["q"], qs, int(mask.sum()))
        out[mask] = drawn * row.gradient
    return out


def construction_ppsqm(dist: pd.DataFrame, tables: dict, d_idx: np.ndarray) -> np.ndarray:
    table = tables["construction_ppsqm_by_province"]
    out = np.empty(len(d_idx), dtype=float)
    for i in np.unique(d_idx):
        row = dist.iloc[int(i)]
        mask = d_idx == i
        prices = np.array(list(table[row.province].values()), dtype=float)
        out[mask] = rng.choice(prices, size=int(mask.sum()))
    return out


def property_pool(kind: str, n_rows: int, dist: pd.DataFrame, tables: dict) -> pd.DataFrame:
    """The stock of properties rows are drawn from, with repeats.

    A condo unit takes its size from the small set of floor plans its district
    offers, so unrelated units match each other exactly. A plot of land does
    not: its area is whatever the survey says, and the only thing that matches
    it is itself, re-appraised in a later year. That difference is why condos
    score about twice as well as land in the final metrics.
    """
    n_props = int(round(n_rows / ROWS_PER_PROPERTY[kind]))
    med, sigma = AREA_LOGN[kind]
    lo, hi = AREA_CLIP[kind]
    weight = (dist["condo_weight"] if kind == CONDO else dist["land_weight"]).to_numpy()

    if kind == CONDO:
        # Pick a building first; the district and the price and the sizes on
        # offer all follow from it.
        buildings, plans = condo_buildings(dist, tables)
        p_building = buildings["units"].to_numpy(dtype=float)
        p_building /= p_building.sum()
        b = rng.choice(len(buildings), size=n_props, p=p_building)
        d = buildings["d"].to_numpy()[b]
        area = plans[b, rng.integers(0, PLANS_PER_BUILDING, size=n_props)]
        n_units = rng.choice([1, 2, 3], size=n_props, p=[0.94, 0.05, 0.01])
        ppsqm = (buildings["ppsqm"].to_numpy()[b]
                 * np.exp(rng.normal(0.0, SIGMA_BUILDING, size=n_props)))
        floor_area = np.zeros(n_props)
        constr = np.zeros(n_props)
    else:
        d = rng.choice(len(dist), size=n_props, p=weight)
        # To 0.1 sqm: a survey does not hand back whole numbers, and rounding to
        # one would make unrelated plots collide as if they were comparable.
        area = np.round(np.clip(rng.lognormal(np.log(med), sigma, size=n_props), lo, hi), 1)
        n_units = rng.choice([1, 2, 3, 4], size=n_props, p=[0.84, 0.11, 0.04, 0.01])
        ppsqm = land_ppsqm(dist, tables, d)
        has_building = rng.random(n_props) < P_HAS_BUILDING
        floor_area = np.where(has_building, area * rng.uniform(*FLOOR_RATIO, n_props), 0.0)
        floor_area = np.minimum(floor_area, 2_000.0)  # a house, not an estate
        constr = construction_ppsqm(dist, tables, d) * rng.uniform(*DEPRECIATION, n_props)

    return pd.DataFrame({
        "d": d, "area_sqm": area, "n_units": n_units,
        "ppsqm": ppsqm, "floor_area": floor_area, "constr_ppsqm": constr,
    })


def build(kind: str, n: int, dist: pd.DataFrame, tables: dict) -> pd.DataFrame:
    pool = property_pool(kind, n, dist, tables)
    p = rng.integers(0, len(pool), size=n)
    d = pool["d"].to_numpy()[p]
    area = pool["area_sqm"].to_numpy()[p]
    n_units = pool["n_units"].to_numpy()[p]
    year = rng.choice(list(YEAR_SHARE), size=n,
                      p=np.array(list(YEAR_SHARE.values())) / sum(YEAR_SHARE.values()))

    trend = (1 + YEAR_TREND) ** (year - BASE_YEAR)
    noise = np.exp(rng.normal(0.0, SIGMA_ROW, size=n))
    land_part = area * pool["ppsqm"].to_numpy()[p]
    build_part = pool["floor_area"].to_numpy()[p] * pool["constr_ppsqm"].to_numpy()[p]
    value = (land_part + build_part) * n_units * trend * noise

    return pd.DataFrame({
        "appraisal_value": np.round(value, -3),
        "area_sqm": area.astype(float),
        "collateral_type": kind,
        "district": dist["district"].to_numpy()[d],
        "province": dist["province"].to_numpy()[d],
        "n_units": n_units.astype("int64"),
        "year": year.astype("int64"),
    })


def spoil(df: pd.DataFrame) -> pd.DataFrame:
    """Plant the unusable rows a real extract carries, for clean() to drop."""
    n = len(df)
    idx = rng.permutation(n)
    bad_value = idx[:int(n * SHARE_BAD_VALUE)]
    tiny = idx[len(bad_value):len(bad_value) + int(n * SHARE_TINY_AREA)]
    huge = idx[len(bad_value) + len(tiny):len(bad_value) + len(tiny) + int(n * SHARE_HUGE_AREA)]

    df.loc[bad_value, "appraisal_value"] = np.round(rng.uniform(0.01, 49_000, len(bad_value)), 2)
    df.loc[tiny, "area_sqm"] = np.round(rng.uniform(0.5, 9.9, len(tiny)), 1)
    df.loc[huge, "area_sqm"] = np.round(rng.uniform(20_001, 900_000, len(huge)))
    return df


def main() -> None:
    tables = load_tables()
    dist = districts(tables)
    print(f"districts {len(dist)}  ({int(dist.has_condo_prices.sum())} with their own condo prices)")

    n_condo = int(round(N_ROWS * CONDO_SHARE))
    df = pd.concat([build(CONDO, n_condo, dist, tables),
                    build(LAND, N_ROWS - n_condo, dist, tables)], ignore_index=True)
    df = df.iloc[rng.permutation(len(df))].reset_index(drop=True)
    df = spoil(df)
    df.to_parquet(OUT, index=False)

    print(f"\nwrote {OUT}  rows {len(df):,}")
    ok = df[df.appraisal_value > 50_000]
    summary = ok.assign(ppsqm=ok.appraisal_value / ok.area_sqm).groupby(
        ["collateral_type", "province"]).agg(
        n=("appraisal_value", "size"),
        median_value=("appraisal_value", "median"),
        median_ppsqm=("ppsqm", "median"))
    pd.set_option("display.float_format", lambda x: f"{x:,.0f}")
    print(summary.to_string())


if __name__ == "__main__":
    main()
