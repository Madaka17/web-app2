"""Tests for the data pipeline and the served ensemble."""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

from prepare_data import (
    CATEGORICAL, FEATURES, FOLD_SEED, MAX_VALUE, MIN_VALUE, TARGET, TEST_YEARS,
    add_features, assign_folds, build_reference, build_training_frame, clean, split, to_price,
)
from train_models import serve_rows

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


@pytest.fixture(scope="module")
def sample_years():
    """1,000 rows across the two newest years; only `year` matters to assign_folds."""
    years = [2569] * 900 + [2568] * 100
    return pd.DataFrame({
        "collateral_type": ["คอนโด"] * 1000,
        "province": ["กรุงเทพมหานคร"] * 1000,
        "district": ["คลองเตย"] * 1000,
        "sub_district": ["คลองเตย"] * 1000,
        "appraisal_value": [5e6] * 1000,
        "area_sqm": [50.0] * 1000,
        "n_units": [1] * 1000,
        "year": years,
        "parent_case_id": [str(i) for i in range(1000)],
    })


def test_cal_fold_leaves_test_rows_unchanged(sample_years):
    fold = assign_folds(sample_years)
    in_test_years = sample_years.year.isin(TEST_YEARS)
    u = np.random.default_rng(FOLD_SEED).random(in_test_years.sum())
    assert (fold[in_test_years].to_numpy() == "test").sum() == (u < 0.20).sum()
    assert set(fold.unique()) <= {"fit", "val", "cal", "test"}
    assert (fold == "cal").sum() == ((u >= 0.30) & (u < 0.40)).sum()


def test_serve_rows_exclude_cal_and_test(sample_years):
    train, test = split(sample_years)
    served = serve_rows(train)
    assert "cal" not in set(served.fold) and len(served) + (train.fold == "cal").sum() == len(train)


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

    def test_nearby_averages_every_type_in_the_radius(self, client):
        r = client.get("/api/nearby?lat=13.7245&lng=100.5600&radius=1000")
        groups = r.get_json()["groups"]
        assert len({g["label"] for g in groups}) > 1
        for g in groups:
            assert g["mean_price"] > 0 and g["mean_ppsqm"] > 0 and g["mean_area"] > 0

    def test_trimmed_mean_drops_the_tails(self):
        from api import trimmed_mean
        assert trimmed_mean(np.array([1.0] * 9 + [1000.0]), 0.1) == 1.0

    def test_nearby_rejects_an_odd_radius(self, client):
        assert client.get("/api/nearby?lat=13.7&lng=100.5&radius=1500").status_code == 400

    def test_predict_from_a_map_click(self, client):
        r = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo",
            "bedrooms": 1, "buildingAge": 5})
        assert r.status_code == 200
        assert r.get_json()["predictedPrice"] > 0

    def test_village_search_finds_an_estate_by_name(self, client):
        body = client.get("/api/projects?q=พฤกษา").get_json()
        assert body["total"] > 0
        assert all("พฤกษา" in p["name"].replace(" ", "") or "pruksa" in p["name"].lower()
                   for p in body["results"][:3])

    def test_predict_in_a_named_village(self, client):
        village = client.get("/api/projects?q=พฤกษา").get_json()["results"][0]
        r = client.post("/api/predict", json={
            "area": 120, "propertyType": "house" if "บ้านเดี่ยว" in village["types"] else "townhome",
            "project": village["key"]})
        assert r.status_code == 200
        meta = r.get_json()["meta"]
        assert meta["estate"] == "in" and meta["location_from"] == "project"

    def test_outside_an_estate_takes_the_measured_discount(self, client):
        base = {"lat": 13.86, "lng": 100.67, "area": 160, "propertyType": "house"}
        plain = client.post("/api/predict", json=base).get_json()
        out = client.post("/api/predict", json={**base, "estate": "out"}).get_json()
        adj = out["meta"]["estate_adjustment"]
        from api import METRICS
        if adj is None and not (METRICS.get("estate_premium", {}).get("บ้านเดี่ยว") or {}).get("vs_out"):
            pytest.skip("this scrape has too few 'outside' houses to measure the gap")
        assert adj["factor"] < 1 and plain["meta"]["estate_adjustment"] is None
        # The model's own response to the flag is small; the discount dominates.
        assert out["predictedPrice"] / plain["predictedPrice"] == pytest.approx(adj["factor"], abs=0.05)

    def test_estate_out_without_measured_gap_is_flagged(self, client, monkeypatch):
        import api
        # Pin the data to "no measured gap for a single house" so the test does not
        # depend on whichever scrape is currently served.
        monkeypatch.setitem(api.METRICS, "estate_premium", {})
        base = {"lat": 13.80, "lng": 100.70, "area": 150, "propertyType": "house"}
        out = client.post("/api/predict", json={**base, "estate": "out"}).get_json()
        assert out["meta"]["estate_adjustment"] is None
        assert out["meta"]["estate_unmeasured"] is True
        plain = client.post("/api/predict", json=base).get_json()
        assert plain["meta"]["estate_unmeasured"] is False

    def test_estate_is_ignored_for_a_condo(self, client):
        r = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo", "estate": "in"})
        assert r.get_json()["meta"]["estate"] is None

    def test_estate_out_is_not_flagged_unmeasured_for_a_condo(self, client):
        # A condo has no estate flag, so "out" is dropped and nothing is unmeasured.
        r = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo", "estate": "out"})
        meta = r.get_json()["meta"]
        assert meta["estate"] is None
        assert meta["estate_unmeasured"] is False

    def test_rejects_an_unknown_village(self, client):
        r = client.post("/api/predict", json={"area": 120, "propertyType": "house", "project": "nope"})
        assert r.status_code == 400

    def test_predict_returns_a_decision(self, client):
        r = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo",
            "bedrooms": 1, "buildingAge": 5})
        d = r.get_json()["decision"]
        assert d["label"] in {"accept", "defer", "reject"}
        assert 0.0 <= d["score"] <= 1.0
        assert set(d["components"]) == {"agreement", "local", "size", "district"}

    def test_dropdown_uses_dropdown_thresholds(self, client, bundle):
        r = client.post("/api/predict", json={
            "subdistrictId": "103301", "area": 120, "propertyType": "house"})
        assert r.status_code == 200
        body = r.get_json()
        seg = body["meta"]["collateral_type"]
        table = bundle["decision"]["calibration_dropdown"]
        expected = table.get(seg, table["__default__"])
        assert body["decision"]["alpha"] == expected["alpha"]
        assert body["decision"]["beta"] == expected["beta"]

    def test_missing_decision_table_gives_null(self, client, monkeypatch):
        import api
        slim = {k: v for k, v in api.BUNDLE.items() if k != "decision"}
        monkeypatch.setattr(api, "BUNDLE", slim)
        r = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo"})
        assert r.status_code == 200
        assert r.get_json()["decision"] is None

    def test_predict_has_no_explanation(self, client):
        body = client.post("/api/predict", json={
            "lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo"}).get_json()
        assert "explanation" not in body

    def test_explain_rejects_bad_input(self, client):
        assert client.post("/api/explain", json={
            "area": 120, "propertyType": "spaceship"}).status_code == 400
        assert client.post("/api/explain", json={
            "area": 5, "propertyType": "house", "subdistrictId": "103301"}).status_code == 400

    def test_explain_explains_the_price(self, client):
        import math
        req = {"lat": 13.7245, "lng": 100.56, "area": 40, "propertyType": "condo",
               "bedrooms": 1, "buildingAge": 5}
        price = client.post("/api/predict", json=req).get_json()["predictedPrice"]
        ex = client.post("/api/explain", json=req).get_json()
        groups = ex["groups"]
        assert {g["key"] for g in groups} == {
            "location", "comparables", "size", "unit", "type_project", "time"}
        assert len(groups) == 6
        logs = [abs(g["log"]) for g in groups]
        assert logs == sorted(logs, reverse=True)
        assert len(ex["top_features"]) == 5
        for g in groups:
            assert all(math.isfinite(g[k]) for k in ("log", "pct"))
        for f in ex["top_features"]:
            assert f["label"] and f["icon"] and math.isfinite(f["pct"])
        assert math.isfinite(ex["base_price"]) and math.isfinite(ex["other_pct"])
        # base * the group effects * the unexplained rest rebuilds the price
        rebuilt = ex["base_price"]
        for g in groups:
            rebuilt *= 1 + g["pct"] / 100
        rebuilt *= 1 + ex["other_pct"] / 100
        assert rebuilt == pytest.approx(price, rel=0.02)

    def test_dropdown_explanation_is_finite(self, client):
        import math
        ex = client.post("/api/explain", json={
            "subdistrictId": "103301", "area": 120, "propertyType": "house"}).get_json()
        assert all(math.isfinite(g["log"]) and math.isfinite(g["pct"]) for g in ex["groups"])
        assert all(math.isfinite(f["pct"]) for f in ex["top_features"])
        assert math.isfinite(ex["other_pct"]) and math.isfinite(ex["base_price"])

    def test_estate_out_with_measured_gap_is_not_unmeasured(self, client, monkeypatch):
        import api
        premiums = {**api.METRICS.get("estate_premium", {}), "บ้านเดี่ยว": {"vs_out": {"pct": 25.0}}}
        monkeypatch.setitem(api.METRICS, "estate_premium", premiums)
        base = {"lat": 13.86, "lng": 100.67, "area": 160, "propertyType": "house"}
        out = client.post("/api/predict", json={**base, "estate": "out"}).get_json()
        assert out["meta"]["estate_adjustment"] is not None
        assert out["meta"]["estate_unmeasured"] is False

    def test_estate_out_lands_in_other(self, client, monkeypatch):
        import api
        # The scrape has no measured out-of-estate gap for a single house yet,
        # so inject one to exercise the estate-adjustment path.
        premiums = {**api.METRICS.get("estate_premium", {}), "บ้านเดี่ยว": {"vs_out": {"pct": 25.0}}}
        monkeypatch.setitem(api.METRICS, "estate_premium", premiums)
        base = {"lat": 13.86, "lng": 100.67, "area": 160, "propertyType": "house"}
        plain = client.post("/api/explain", json=base).get_json()
        out = client.post("/api/explain", json={**base, "estate": "out"}).get_json()
        # The model reads the estate flag, so each group moves a little (about
        # 0.012 log at most); the 20% discount itself must land in other_pct.
        by_key = lambda ex: {g["key"]: g["log"] for g in ex["groups"]}
        for k, v in by_key(plain).items():
            assert by_key(out)[k] == pytest.approx(v, abs=0.02)
        factor = client.post(
            "/api/predict", json={**base, "estate": "out"}).get_json()["meta"]["estate_adjustment"]["factor"]
        ratio = (1 + out["other_pct"] / 100) / (1 + plain["other_pct"] / 100)
        assert ratio == pytest.approx(factor, rel=0.01)


    def test_condo_search_and_grade_filter(self, client):
        body = client.get("/api/projects?kind=condo&grade=ultimate").get_json()
        assert body["total"] > 0
        assert all(p["kind"] == "condo" and p["grade"] == "ultimate" for p in body["results"])

    def test_grades_rise_with_price(self, client):
        body = client.get("/api/grades").get_json()
        for kind in ("village", "condo"):
            prices = [r["ppsqm_median"] for r in body[kind] if "ppsqm_median" in r]
            assert prices == sorted(prices, reverse=True)


class TestEstate:
    def test_grade_bands(self):
        from estate import CONDO_GRADES, VILLAGE_GRADES, grade
        assert grade(70e6, VILLAGE_GRADES) == "super_luxury"
        assert grade(150e6, VILLAGE_GRADES) == "super_luxury"
        assert grade(20e6, VILLAGE_GRADES) == "luxury"
        assert grade(4e6, VILLAGE_GRADES) == "economy"
        assert grade(2e6, VILLAGE_GRADES) == "entry"
        assert grade(600e3, CONDO_GRADES) == "ultimate"
        assert grade(100e3, CONDO_GRADES) == "main"
        assert grade(40e3, CONDO_GRADES) == "entry"

    def test_flag_prefers_a_stated_outside(self):
        from estate import estate_flag
        flag = estate_flag(pd.Series(["บ้านเดี่ยว", "บ้านเดี่ยว", "บ้านเดี่ยว", "คอนโด"]),
                           pd.Series([None, "x", None, "y"]),
                           pd.Series(["หมู่บ้าน ... บ้านสร้างเอง", "", "ขายบ้าน", "โครงการ"]))
        assert flag.iloc[0] == 0 and flag.iloc[1] == 1
        assert np.isnan(flag.iloc[2]) and np.isnan(flag.iloc[3])

    def test_premium_is_reported_for_both_house_types(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        for t in ("บ้านเดี่ยว", "ทาวน์เฮ้าส์"):
            assert m["estate_premium"][t]["vs_unnamed"]["cells"] >= 5


class TestMetricsFile:
    def test_reports_the_honest_test_years(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        assert m["protocol"]["test_years"] == list(TEST_YEARS)
        assert m["protocol"]["validation"] != m["protocol"]["test"]

    def test_feature_importance_sums_to_one(self):
        m = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
        assert sum(m["feature_importance"].values()) == pytest.approx(1.0, abs=1e-3)


def test_bundle_carries_decision_thresholds_for_both_views(bundle):
    for view in ("calibration", "calibration_dropdown"):
        segments = bundle["decision"][view]
        assert "__default__" in segments
        for seg in segments.values():
            for k in ("alpha", "beta"):
                assert seg[k] is None or 0.0 <= seg[k] <= 1.0
