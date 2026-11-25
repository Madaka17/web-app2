from __future__ import annotations

import numpy as np
import pandas as pd

from evaluation import conformal_ratio_bounds, coverage, iaao, spatial_groups, temporal_split


def test_iaao_perfect_prediction():
    a = np.array([1e6, 2e6, 3e6])
    m = iaao(a.copy(), a)
    assert m["median_ratio"] == 1.0 and m["COD"] == 0.0 and m["PRD"] == 1.0 and m["n"] == 3


def test_iaao_known_values():
    pred, actual = np.array([90., 110., 100., 120.]), np.array([100.] * 4)
    m = iaao(pred, actual)
    assert m["median_ratio"] == 1.05
    assert np.isclose(m["COD"], 100 * np.mean(np.abs(pred / actual - 1.05)) / 1.05)
    assert np.isclose(m["PRD"], np.mean(pred / actual) / (pred.sum() / actual.sum()))


def test_coverage_inclusive_bounds():
    assert coverage(np.array([1., 2., 3., 4.]), np.array([1., 1., 1., 1.]), np.array([3., 3., 3., 3.])) == 75.0


def test_conformal_bounds_finite_sample_levels():
    ratio = np.arange(1, 101) / 100          # 0.01 .. 1.00, n = 100
    lo, hi = conformal_ratio_bounds(ratio)
    # levels floor(101*0.10)/100 = 0.10 and ceil(101*0.90)/100 = 0.91, method "higher"/"lower"
    assert lo == np.quantile(ratio, 0.10, method="lower")
    assert hi == np.quantile(ratio, 0.91, method="higher")


def test_conformal_bounds_tiny_sample_stay_inside_data():
    ratio = np.array([0.8, 1.0, 1.2])
    lo, hi = conformal_ratio_bounds(ratio)
    assert 0.8 <= lo <= hi <= 1.2


def test_spatial_groups_split_unknown_subdistrict_by_district():
    df = pd.DataFrame({"province": ["ก"] * 3, "district": ["A", "B", "A"],
                       "sub_district": ["ไม่ระบุ", "ไม่ระบุ", "x"]})
    g = spatial_groups(df)
    assert g[0] != g[1] and g[0] != g[2]

def test_spatial_groups_same_name_different_district():
    df = pd.DataFrame({"province": ["ก", "ก"], "district": ["A", "B"], "sub_district": ["x", "x"]})
    g = spatial_groups(df)
    assert g[0] != g[1]

def test_temporal_split_drops_hipflat_and_cuts_at_days():
    posted = pd.to_datetime(["2026-01-01", "2026-09-01", "2026-10-30", "2026-10-30"], utc=True)
    df = pd.DataFrame({"posted": posted, "source": ["baania", "ddproperty", "dotproperty", "hipflat"]})
    train, hold = temporal_split(df, days=90)
    assert list(train.source) == ["baania"] and list(hold.source) == ["ddproperty", "dotproperty"]
