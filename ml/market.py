"""
Market price: what comparable listings around this property are asking.

The model's prediction answers "what should this property be listed at, given
its type, size and location". The market price answers a different, simpler
question: "what are similar listings nearby actually asking". Showing both is
what lets the web app tell a user whether a listing is cheap or expensive.

Both come from the same comparables the model was handed (add_features), so
the market figure is never built from data the model could not see.
"""
from __future__ import annotations

import math
from typing import Mapping

# Most specific comparable first. A level is used only when it has at least
# `min_n` listings behind it; otherwise the next, wider level is tried.
LEVELS: list[tuple[str, str, str, int, str]] = [
    ("exact", "comp_ppsqm", "comp_n", 3, "ขนาดเดียวกันในเขตเดียวกัน"),
    ("size_band", "band_ppsqm", "band_n", 5, "ขนาดใกล้เคียงในเขตเดียวกัน"),
    ("subdistrict", "sd_ppsqm", "sd_n", 5, "ทั้งแขวง/ตำบล"),
    ("district", "dt_ppsqm", "dt_n", 1, "ทั้งเขต/อำเภอ"),
]

# dt_iqr is the interquartile range of log price per sqm across the district.
# Below this many district listings the IQR is too noisy to print as a range.
MIN_N_FOR_RANGE = 8


def market_price(f: Mapping[str, float], area_sqm: float) -> dict:
    """Market price for one featured row (values in log baht per sqm).

    Returns the asking-price level of the most specific comparable group with
    enough listings, the P25-P75 band of that market, and which group it is.
    """
    chosen = None
    for level, col, n_col, min_n, label in LEVELS:
        n = int(f.get(n_col, 0) or 0)
        if n >= min_n:
            chosen = (level, col, n, label)
            break
    if chosen is None:
        # Nothing in the district at all: the province's figure for this type.
        chosen = ("province_type", "prov_type_ppsqm", 0, "ทั้งจังหวัด ประเภทเดียวกัน")

    level, col, n, label = chosen
    log_med = float(f[col])
    ppsqm = math.exp(log_med)

    iqr = float(f.get("dt_iqr", 0) or 0)
    has_range = iqr > 0 and int(f.get("dt_n", 0) or 0) >= MIN_N_FOR_RANGE
    if has_range:
        low_ppsqm = math.exp(log_med - iqr / 2)
        high_ppsqm = math.exp(log_med + iqr / 2)
    else:
        low_ppsqm = high_ppsqm = None

    def price(v: float | None) -> float | None:
        return None if v is None else round(v * area_sqm, -3)

    return {
        "level": level,
        "basis": label,
        "n": n,
        "ppsqm": round(ppsqm, -2),
        "price": price(ppsqm),
        "low": price(low_ppsqm),
        "high": price(high_ppsqm),
    }
