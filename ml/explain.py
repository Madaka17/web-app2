"""Per-property SHAP for the three-model blend, grouped by factor.

Uses each library's native SHAP output (no `shap` package). SHAP values are in
log price-per-sqm, the models' target, so they add up exactly:
    base + phi.sum(1) == model prediction (log ppsqm)
and the blend is additive too, with the bundle's weights.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import xgboost
from catboost import Pool

from prepare_data import CATEGORICAL, FEATURES
from train_models import as_categorical

GROUPS: dict[str, list[str]] = {
    "location": [
        "province", "district", "sub_district", "province_ppsqm", "district_ppsqm",
        "dt_ppsqm", "dt_n", "dt_iqr", "sd_ppsqm", "sd_n", "latitude", "longitude",
        "transit_m", "geo1_ppsqm", "geo1_n", "geo2_ppsqm", "geo2_n", "knn_ppsqm",
        "knn_dist_m",
    ],
    "comparables": [
        "band_ppsqm", "band_n", "comp_ppsqm", "comp_n", "comp_age", "comp_gap",
        "comp2_ppsqm", "comp2_n", "nn_ppsqm", "nn_dist",
    ],
    "size": ["area_sqm", "log_area", "area_per_unit", "n_units"],
    "unit": ["bedrooms", "bathrooms", "building_age"],
    "type_project": [
        "collateral_type", "type_ppsqm", "prov_type_ppsqm", "estate", "proj_ppsqm", "proj_n",
    ],
    "time": ["year"],
}


def shap_each_catboost(model, featured: pd.DataFrame, shap_mode: str = "Auto") -> np.ndarray:
    """Raw CatBoost ShapValues (n x F+1). "NoPreCalc" skips the per-tree precompute
    that pays off for big batches; it is exact, and faster for a few rows."""
    return np.asarray(model.get_feature_importance(
        Pool(featured[FEATURES], cat_features=CATEGORICAL),
        type="ShapValues", shap_mode=shap_mode), dtype=float)


def shap_each(bundle: dict, featured: pd.DataFrame,
              shap_mode: str = "Auto") -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Per model: (phi n x F in FEATURES order, base n). Last native column is the base.
    `shap_mode` only affects CatBoost (see shap_each_catboost)."""
    X_raw = featured[FEATURES]
    X_cat = as_categorical(X_raw, bundle["categories"])
    out: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for name, model in bundle["models"].items():
        if name == "CatBoost":
            raw = shap_each_catboost(model, featured, shap_mode)
        elif name == "LightGBM":
            raw = model.predict(X_cat, pred_contrib=True)
        elif name == "XGBoost":
            raw = model.get_booster().predict(
                xgboost.DMatrix(X_cat, enable_categorical=True), pred_contribs=True)
        else:
            raise ValueError(f"no native SHAP for model {name!r}")
        raw = np.asarray(raw, dtype=float)
        out[name] = (raw[:, :-1], raw[:, -1])
    return out


def ensemble_shap(bundle: dict, featured: pd.DataFrame,
                  shap_mode: str = "Auto") -> tuple[np.ndarray, np.ndarray]:
    """Weighted blend: phi = sum_m w_m phi_m, base = sum_m w_m base_m."""
    weights = bundle["weights"]
    phi_total = 0.0
    base_total = 0.0
    for name, (phi, base) in shap_each(bundle, featured, shap_mode).items():
        w = float(weights[name])
        phi_total = phi_total + w * phi
        base_total = base_total + w * base
    return np.asarray(phi_total, dtype=float), np.asarray(base_total, dtype=float)


def group_shap(phi: np.ndarray) -> pd.DataFrame:
    """Sum the per-feature SHAP values into one column per factor group."""
    col = {f: i for i, f in enumerate(FEATURES)}
    return pd.DataFrame(
        {g: phi[:, [col[f] for f in fs]].sum(axis=1) for g, fs in GROUPS.items()},
        columns=list(GROUPS),
    )
