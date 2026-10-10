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
        "sub_district": ["คลองเตย"] * 4 + ["สวนหลวง"] * 2 + ["อ่อนนุช"] * 2,
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


class TestRentFilter:
    def test_drops_rentals_posted_as_sales(self):
        frame = pd.DataFrame({
            "collateral_type": ["คอนโด"] * 3, "province": ["กรุงเทพมหานคร"] * 3,
            "district": ["คลองเตย"] * 3, "sub_district": ["คลองเตย"] * 3,
            "area_sqm": [34.0, 34.0, 34.0], "n_units": [1] * 3, "year": [2569] * 3,
            # monthly rent in the title; rent typed into the price box; a real sale
            "appraisal_value": [13_000.0 * 300, 25_000.0 * 10, 5_200_000.0],
            "rent_like": [True, False, False],
        })
        out, report = clean(frame)
        assert len(out) == 1 and out[TARGET].iloc[0] == 5_200_000.0
        # 250k for 34 sqm is 7,353 baht/sqm - under the condo floor, so rent too.
        assert report["dropped_rent"] == 2

    def test_rent_title_detection(self):
        from prepare_data import _rent_like
        titles = pd.Series(["Diamond สุขุมวิท ราคา 13,000 บาทต่อเดือน", "1 bed condo for rent BTS",
                            "ขาย - ให้เช่า คอนโด Aspire", "ขายคอนโด Noble Ploenchit"])
        assert _rent_like(titles).tolist() == [True, True, False, False]


class TestProjectSnap:
    def test_a_click_on_a_tower_takes_its_project(self):
        from prepare_data import snap_to_project
        hist = pd.DataFrame({
            "collateral_type": ["คอนโด"] * 2, "province": ["กรุงเทพมหานคร"] * 2,
            "district": ["คลองเตย"] * 2, "sub_district": ["คลองเตย"] * 2,
            "area_sqm": [40.0, 40.0], "n_units": [1, 1], "year": [2569, 2569],
            "appraisal_value": [6e6, 6.2e6], "project_key": ["tower", "tower"],
            "latitude": [13.7300, 13.7300], "longitude": [100.5600, 100.5600],
        })
        ref = build_reference(hist)
        clicks = pd.DataFrame({"latitude": [13.7303, 13.7400], "longitude": [100.5600, 100.5600],
                               "project_key": [np.nan, np.nan]})
        assert snap_to_project(clicks, ref).tolist() == ["tower", None]  # ~33 m vs ~1.1 km


class TestSplit:
    def test_test_set_holds_only_the_held_out_years(self, sample):
        out, _ = clean(sample)
        train, test = split(out)
        assert set(test.year).issubset(set(TEST_YEARS))
        assert (train.fold != "test").all()

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
    def test_keeps_every_training_row(self, sample):
        out, _ = clean(sample)
        train, _ = split(out)
        assert len(build_training_frame(train)) == len(train)

    def test_a_fit_row_never_sees_itself(self, sample):
        """Out-of-fold: a row's comparables come from the other folds, so a
        row alone in its project finds no project comparable at all."""
        out, _ = clean(sample)
        out["project_key"] = [f"p{i}" for i in range(len(out))]
        train, _ = split(out)
        frame = build_training_frame(train)
        assert (frame["proj_n"] == 0).all()


class TestGeoFeatures:
    def test_counts_listings_within_each_radius(self):
        # Three condos ~0.5 km apart on a line, one 30 km away.
        hist = pd.DataFrame({
            "collateral_type": ["คอนโด"] * 4, "province": ["กรุงเทพมหานคร"] * 4,
            "district": ["คลองเตย"] * 4, "sub_district": ["คลองเตย"] * 4,
            "area_sqm": [40.0] * 4, "n_units": [1] * 4, "year": [2569] * 4,
            "appraisal_value": [4e6, 4.4e6, 4.8e6, 2e6],
            "latitude": [13.720, 13.7245, 13.729, 14.0], "longitude": [100.56] * 4,
        })
        ref = build_reference(hist)
        probe = hist.head(1).drop(columns="appraisal_value")
        f = add_features(probe, ref)
        assert f["geo1_n"].iloc[0] == 2  # itself + 0.5 km; 1.0 km is just outside
        assert f["geo2_n"].iloc[0] == 3
        assert f[FEATURES].notna().all().all()

    def test_a_row_without_a_pin_falls_back(self, sample):
        out, _ = clean(sample)
        f = add_features(out, build_reference(out))
        assert (f["geo1_n"] == 0).all()
        assert (f["latitude"] == -1).all()


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
            "collateral_type": "คอนโด",
            "province": "กรุงเทพมหานคร", "district": "คลองเตย", "sub_district": "คลองเตย",
            "area_sqm": 65.0, "n_units": 1, "year": 2569,
        }])
        preds = _ensemble_members(bundle, frame)
        assert all(p > 0 for p in preds.values())
        blend = sum(bundle["weights"][n] * p for n, p in preds.items())
        assert 1e6 < blend < 1e8

    def test_price_rises_with_area(self, bundle):
        def price(area: float) -> float:
            frame = pd.DataFrame([{
                "collateral_type": "คอนโด",
                "province": "กรุงเทพมหานคร", "district": "คลองเตย", "sub_district": "คลองเตย",
                "area_sqm": area, "n_units": 1, "year": 2569,
            }])
            preds = _ensemble_members(bundle, frame)
            return sum(bundle["weights"][n] * p for n, p in preds.items())
        assert price(120) > price(40)

    def test_depreciation_starts_at_one_for_a_new_building(self, bundle):
        curve = bundle["depreciation"]
        assert curve and curve[0]["age_lo"] == 0
        assert curve[0]["factor"] == pytest.approx(1.0)


@pytest.fixture(scope="module")
def client():
    from api import app
    return app.test_client()


class TestApi:
    def test_nearby_reports_listings_in_the_radius(self, client):
        r = client.get("/api/nearby?lat=13.7245&lng=100.5600&radius=1000&type=condo&buildingAge=10")
        assert r.status_code == 200
        body = r.get_json()
        assert body["total"] > 0
        g = body["groups"][0]
        assert g["p25_ppsqm"] <= g["median_ppsqm"] <= g["p75_ppsqm"]
        assert "adjusted_ppsqm" in g

    def test_nearby_rejects_an_odd_radius(self, client):
        assert client.get("/api/nearby?lat=13.7&lng=100.5&radius=1500").status_code == 400

    def test_predict_from_a_map_click(self, client):
        r = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo",
            "bedrooms": 1, "buildingAge": 5})
        assert r.status_code == 200
        assert r.get_json()["predictedPrice"] > 0

class TestMetricsFile:
    def test_reports_the_honest_test_years(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        assert m["protocol"]["test_years"] == list(TEST_YEARS)
        assert m["protocol"]["validation"] != m["protocol"]["test"]

    def test_feature_importance_sums_to_one(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        assert sum(m["feature_importance"].values()) == pytest.approx(1.0, abs=1e-3)
