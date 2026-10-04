"""Tests for the market-price block served alongside each prediction."""
from __future__ import annotations

import math

import pandas as pd
import pytest

from market import market_price


def row(**overrides) -> pd.Series:
    """A featured row: log baht/sqm per comparable level, with listing counts."""
    base = {
        "comp_ppsqm": math.log(100_000), "comp_n": 0,
        "band_ppsqm": math.log(90_000), "band_n": 0,
        "sd_ppsqm": math.log(80_000), "sd_n": 0,
        "dt_ppsqm": math.log(70_000), "dt_n": 0,
        "prov_type_ppsqm": math.log(50_000),
        "dt_iqr": 0.4,
    }
    base.update(overrides)
    return pd.Series(base)


@pytest.mark.parametrize("counts, level, ppsqm", [
    ({"comp_n": 3, "band_n": 9, "sd_n": 20, "dt_n": 50}, "exact", 100_000),
    ({"comp_n": 2, "band_n": 5, "sd_n": 20, "dt_n": 50}, "size_band", 90_000),
    ({"comp_n": 1, "band_n": 4, "sd_n": 5, "dt_n": 50}, "subdistrict", 80_000),
    ({"comp_n": 0, "band_n": 0, "sd_n": 4, "dt_n": 1}, "district", 70_000),
    ({}, "province_type", 50_000),
])
def test_picks_most_specific_level_with_enough_listings(counts, level, ppsqm):
    m = market_price(row(**counts), area_sqm=30)
    assert m["level"] == level
    assert m["ppsqm"] == ppsqm
    assert m["price"] == ppsqm * 30


def test_range_brackets_the_market_price():
    m = market_price(row(comp_n=5, dt_n=40), area_sqm=50)
    assert m["low"] < m["price"] < m["high"]
    # Symmetric in log space: the geometric mean of the band is the median.
    assert math.sqrt(m["low"] * m["high"]) == pytest.approx(m["price"], rel=1e-3)


def test_no_range_for_a_thin_district():
    m = market_price(row(comp_n=5, dt_n=7), area_sqm=50)
    assert m["low"] is None and m["high"] is None
    assert m["price"] == 5_000_000
