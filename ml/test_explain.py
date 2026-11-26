"""Per-property SHAP for the three-model blend, grouped by factor."""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

from prepare_data import FEATURES, add_features
from explain import GROUPS, ensemble_shap, group_shap, shap_each

HERE = Path(__file__).parent


@pytest.fixture(scope="module")
def bundle():
    return joblib.load(HERE / "models/ensemble.joblib")


@pytest.fixture(scope="module")
def featured(bundle):
    """Three rows: a Bangkok condo click, a house known by sub-district only
    (no coordinates), and a land plot whose sub-district is not in the reference."""
    frame = pd.DataFrame({
        "collateral_type": ["คอนโด", "บ้านเดี่ยว", "ที่ดิน"],
        "province": ["กรุงเทพมหานคร"] * 3,
        "district": ["คลองเตย", "สวนหลวง", "สวนหลวง"],
        "sub_district": ["คลองเตย", "สวนหลวง", "ไม่มีในข้อมูลจริง"],
        "area_sqm": [45.0, 200.0, 800.0],
        "n_units": [1, 1, 1],
        "year": [2569, 2569, 2569],
        "latitude": [13.7224, np.nan, np.nan],
        "longitude": [100.5606, np.nan, np.nan],
        "bedrooms": [1.0, 3.0, np.nan],
        "bathrooms": [1.0, 2.0, np.nan],
        "building_age": [5.0, 10.0, np.nan],
        "project_key": [None, None, None],
        "estate": [np.nan, 1.0, np.nan],
    })
    return add_features(frame, bundle["reference"])


@pytest.fixture(scope="module")
def shaps(bundle, featured):
    return shap_each(bundle, featured)


def _model_input(name: str, bundle: dict, featured: pd.DataFrame) -> pd.DataFrame:
    from prepare_data import CATEGORICAL
    X_raw = featured[FEATURES]
    if name == "CatBoost":
        return X_raw
    X_cat = X_raw.copy()
    for c in CATEGORICAL:
        X_cat[c] = pd.Categorical(X_cat[c], categories=bundle["categories"][c])
    return X_cat


def test_groups_partition_features():
    members = [f for fs in GROUPS.values() for f in fs]
    assert len(members) == len(set(members)), "a feature appears in two groups"
    assert set(members) == set(FEATURES)


def test_each_model_is_additive(bundle, featured, shaps):
    for name, model in bundle["models"].items():
        phi, base = shaps[name]
        assert phi.shape == (len(featured), len(FEATURES))
        assert base.shape == (len(featured),)
        pred = np.asarray(model.predict(_model_input(name, bundle, featured)), dtype=float)
        np.testing.assert_allclose(base + phi.sum(1), pred, atol=1e-3, err_msg=name)


def test_ensemble_is_weighted_sum(bundle, shaps, featured):
    phi, base = ensemble_shap(bundle, featured)
    w = bundle["weights"]
    expected_phi = sum(w[n] * shaps[n][0] for n in bundle["models"])
    expected_base = sum(w[n] * shaps[n][1] for n in bundle["models"])
    np.testing.assert_allclose(phi, expected_phi, atol=1e-9)
    np.testing.assert_allclose(base, expected_base, atol=1e-9)


def test_group_shap_sums_to_total(bundle, shaps, featured):
    phi, _ = ensemble_shap(bundle, featured)
    grouped = group_shap(phi)
    assert list(grouped.columns) == list(GROUPS)
    assert len(grouped) == len(featured)
    np.testing.assert_allclose(grouped.sum(axis=1).to_numpy(), phi.sum(1), atol=1e-9)


def test_unknown_location_is_finite(bundle, featured):
    phi, base = ensemble_shap(bundle, featured)
    assert np.isfinite(phi).all()
    assert np.isfinite(base).all()
    assert np.isfinite(group_shap(phi).to_numpy()).all()


def test_nopreccalc_matches_auto_for_catboost(bundle, featured):
    from explain import shap_each_catboost
    auto = shap_each_catboost(bundle["models"]["CatBoost"], featured, shap_mode="Auto")
    single = shap_each_catboost(bundle["models"]["CatBoost"], featured, shap_mode="NoPreCalc")
    np.testing.assert_allclose(single, auto, atol=1e-6)


def test_shap_metrics_shape():
    import json
    from explain import GROUPS as G
    path = HERE / "models/shap_metrics.json"
    if not path.exists():
        pytest.skip("models/shap_metrics.json not generated yet (run shap_report.py)")
    m = json.loads(path.read_text(encoding="utf-8"))
    assert set(m["importance"]["__default__"]) == set(G)
    assert len(m["importance"]["__default__"]) == 6
    for rho in m["model_agreement"].values():
        assert -1.0 <= rho <= 1.0
    for stats in m["bootstrap"].values():
        assert 0.0 <= stats["share_same_rank"] <= 1.0
