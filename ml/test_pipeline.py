"""Tests for the data pipeline and the served ensemble."""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

from prepare_data import (
    CATEGORICAL, FEATURES, MAX_VALUE, MIN_VALUE, TARGET, TEST_YEARS,
    add_features, build_reference, build_training_frame, clean, split, to_price,
)

HERE = Path(__file__).parent


def _ensemble_members(bundle: dict, frame: pd.DataFrame) -> dict[str, float]:
    """Run one row through the served bundle, the way api.py does."""
    featured = add_features(frame, bundle["reference"])
    area = featured["area_sqm"].to_numpy(dtype=float)
    X_raw = featured[FEATURES]
    X_cat = X_raw.copy()
    for c in CATEGORICAL:
        X_cat[c] = pd.Categorical(X_cat[c], categories=bundle["categories"][c])
    return {n: float(to_price(m.predict(X_raw if n == "CatBoost" else X_cat), area)[0])
            for n, m in bundle["models"].items()}


@pytest.fixture(scope="module")
def bundle():
    return joblib.load(HERE / "models/ensemble.joblib")


@pytest.fixture(scope="module")
def sample():
    """A small hand-made frame - the tests must not depend on the 300k file."""
    return pd.DataFrame({
        "collateral_type": ["ห้องชุด (คอนโดมิเนียม)"] * 4 + ["ที่ดิน/สิ่งปลูกสร้าง/ที่ดินพร้อมสิ่งปลูกสร้าง"] * 4,
        "province": ["กรุงเทพมหานคร"] * 8,
        "district": ["คลองเตย"] * 4 + ["สวนหลวง"] * 4,
        "appraisal_value": [3e6, 5e6, 0.01, 9e9, 8e6, 12e6, 4e6, 6e6],
        "area_sqm": [45.0, 70.0, 60.0, 80.0, 200.0, 300.0, 1.0, 250.0],
        "n_units": [1, 1, 1, 1, 1, 2, 1, 1],
        "year": [2561, 2565, 2563, 2564, 2566, 2567, 2568, 2569],
        "parent_case_id": ["a", "b", "c", "d", "e", "f", "g", "h"],
    })


class TestClean:
    def test_drops_values_outside_the_sane_range(self, sample):
        out, report = clean(sample)
        assert out[TARGET].min() >= MIN_VALUE
        assert out[TARGET].max() <= MAX_VALUE
        assert report["dropped_value_range"] == 2  # 0.01 and 9e9

    def test_drops_implausible_areas(self, sample):
        out, _ = clean(sample)
        assert (out.area_sqm >= 10).all()

    def test_reports_row_counts_that_add_up(self, sample):
        out, report = clean(sample)
        assert report["rows_out"] == len(out)
        assert report["rows_in"] == len(sample)


class TestSplit:
    def test_test_set_holds_only_the_held_out_years(self, sample):
        out, _ = clean(sample)
        train, test = split(out)
        assert set(test.year).issubset(set(TEST_YEARS))
        assert not set(train.year) & set(TEST_YEARS)

    def test_no_row_is_in_both_halves(self, sample):
        out, _ = clean(sample)
        train, test = split(out)
        assert len(train) + len(test) == len(out)


class TestDerivedFeatures:
    def test_produces_every_declared_feature(self, sample):
        out, _ = clean(sample)
        ref = build_reference(out)
        assert set(FEATURES).issubset(add_features(out, ref).columns)

    def test_no_feature_is_ever_nan(self, sample):
        out, _ = clean(sample)
        featured = add_features(out, build_reference(out))
        assert featured[FEATURES].notna().all().all()

    def test_unknown_location_falls_back_instead_of_nan(self, sample):
        out, _ = clean(sample)
        ref = build_reference(out)
        unknown = out.head(1).copy()
        unknown["district"] = "ไม่มีเขตนี้"
        unknown["province"] = "ไม่มีจังหวัดนี้"
        derived = add_features(unknown, ref)
        assert derived[FEATURES].notna().all().all()
        assert derived["province_ppsqm"].iloc[0] == pytest.approx(ref["global"])
        # Nothing comparable has ever been valued there, and the row says so.
        assert derived["comp_n"].iloc[0] == 0
        assert derived["nn_dist"].iloc[0] == 9.0

    def test_area_per_unit_never_divides_by_zero(self, sample):
        out, _ = clean(sample)
        out.loc[:, "n_units"] = 0
        derived = add_features(out, build_reference(out))
        assert np.isfinite(derived["area_per_unit"]).all()


class TestTrainingFrame:
    def test_drops_the_earliest_year_which_has_no_history(self, sample):
        out, _ = clean(sample)
        train, _ = split(out)
        frame = build_training_frame(train)
        assert frame.year.min() > train.year.min()

    def test_a_fit_row_never_sees_its_own_year(self, sample):
        """The whole point of the backward window: a row must not be able to
        look itself up, or the model learns to copy an answer serving lacks."""
        out, _ = clean(sample)
        train, _ = split(out)
        row = train[train.year == train.year.max()]
        hist = train[train.year < train.year.max()]
        featured = add_features(row, build_reference(hist))
        assert (featured["comp_age"] >= 0).all()


class TestServedBundle:
    def test_carries_all_three_models(self, bundle):
        assert set(bundle["models"]) == {"CatBoost", "LightGBM", "XGBoost"}

    def test_every_model_has_a_non_zero_weight(self, bundle):
        # A three-model ensemble with a zeroed member is a two-model ensemble.
        assert all(w > 0 for w in bundle["weights"].values())
        assert sum(bundle["weights"].values()) == pytest.approx(1.0)

    def test_calibration_covers_both_property_types(self, bundle):
        calib = bundle["calibration"]
        assert "__default__" in calib
        for v in calib.values():
            assert 0 < v["q10"] < 1 < v["q90"]

    def test_predicts_a_positive_price_for_a_normal_condo(self, bundle):
        frame = pd.DataFrame([{
            "collateral_type": "ห้องชุด (คอนโดมิเนียม)",
            "province": "กรุงเทพมหานคร", "district": "คลองเตย",
            "area_sqm": 65.0, "n_units": 1, "year": 2567,
        }])
        preds = _ensemble_members(bundle, frame)
        assert all(p > 0 for p in preds.values())
        blend = sum(bundle["weights"][n] * p for n, p in preds.items())
        assert 1e6 < blend < 1e8

    def test_price_rises_with_area(self, bundle):
        def price(area: float) -> float:
            frame = pd.DataFrame([{
                "collateral_type": "ห้องชุด (คอนโดมิเนียม)",
                "province": "กรุงเทพมหานคร", "district": "คลองเตย",
                "area_sqm": area, "n_units": 1, "year": 2567,
            }])
            preds = _ensemble_members(bundle, frame)
            return sum(bundle["weights"][n] * p for n, p in preds.items())
        assert price(120) > price(40)


class TestMetricsFile:
    def test_reports_the_honest_test_years(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        assert m["protocol"]["test_years"] == list(TEST_YEARS)
        assert m["protocol"]["validation_year"] not in m["protocol"]["test_years"]

    def test_feature_importance_sums_to_one(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        assert sum(m["feature_importance"].values()) == pytest.approx(1.0, abs=1e-3)
