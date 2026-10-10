"""
Train CatBoost, LightGBM and XGBoost on the scraped listings and blend them.

Protocol, chosen so the reported numbers mean something (prepare_data.assign_folds):
  fit    every year before 2569 plus 70% of 2569
  weight 10% of 2569          (validation - picks the ensemble weights)
  score  20% of 2569          (test - touched only once, at the end)

The target is log price per sqm (see prepare_data.log_ppsqm) and the loss is
absolute error, not squared. Squared error fits the conditional mean, which the
few enormous appraisals drag upward; MAPE and MdAPE are median-shaped measures
and absolute error is their match. All reported metrics are computed back on
baht.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from lightgbm import LGBMRegressor
from xgboost import XGBRegressor

from sklearn.neighbors import BallTree

from prepare_data import (
    CATEGORICAL, FEATURES, FOLD_FRACTIONS, FOLD_SEED, TARGET, TEST_YEARS, UNKNOWN,
    add_features, build_reference, form_view,
    build_training_frame, clean, load_raw, log_ppsqm, split, to_price,
)

OUT = Path(__file__).parent / "models"
OUT.mkdir(exist_ok=True)

SEED = 42


def as_categorical(df: pd.DataFrame, categories: dict | None = None) -> pd.DataFrame:
    """LightGBM and XGBoost need pandas `category` dtype, with the SAME category
    list at train and predict time or the codes silently mean different things."""
    out = df.copy()
    for c in CATEGORICAL:
        if categories is None:
            out[c] = out[c].astype("category")
        else:
            out[c] = pd.Categorical(out[c], categories=categories[c])
    return out


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    err = y_pred - y_true
    ape = np.abs(err) / y_true * 100
    return {
        "RMSE": float(np.sqrt(np.mean(err**2))),
        "MAE": float(np.mean(np.abs(err))),
        "R2": float(1 - np.sum(err**2) / np.sum((y_true - y_true.mean()) ** 2)),
        "MAPE": float(np.mean(ape)),
        "MdAPE": float(np.median(ape)),
        "Within_10Pct": float(np.mean(ape <= 10) * 100),
        "Within_20Pct": float(np.mean(ape <= 20) * 100),
    }


def build_models() -> dict:
    return {
        "CatBoost": CatBoostRegressor(
            iterations=2000, learning_rate=0.04, depth=10, l2_leaf_reg=3.0,
            loss_function="MAE", random_seed=SEED, verbose=False,
            cat_features=CATEGORICAL,
        ),
        "LightGBM": LGBMRegressor(
            n_estimators=2000, learning_rate=0.04, num_leaves=127,
            min_child_samples=30, subsample=0.9, colsample_bytree=0.9,
            objective="regression_l1", random_state=SEED, verbose=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=2000, learning_rate=0.04, max_depth=10,
            subsample=0.9, colsample_bytree=0.9, min_child_weight=5,
            objective="reg:absoluteerror", random_state=SEED,
            enable_categorical=True, tree_method="hist",
        ),
    }


def fit_all(models: dict, X_raw: pd.DataFrame, X_cat: pd.DataFrame,
            y: np.ndarray) -> dict:
    timings = {}
    for name, model in models.items():
        t = time.time()
        if name == "CatBoost":
            model.fit(X_raw, y)
        elif name == "LightGBM":
            model.fit(X_cat, y, categorical_feature=CATEGORICAL)
        else:
            model.fit(X_cat, y)
        timings[name] = time.time() - t
        print(f"{name} trained in {timings[name]:.1f}s", flush=True)
    return timings


def predict_prices(models: dict, X_raw: pd.DataFrame, X_cat: pd.DataFrame,
                   area: np.ndarray) -> dict:
    return {n: to_price(m.predict(X_raw if n == "CatBoost" else X_cat), area)
            for n, m in models.items()}


# Building-age buckets (years) for the depreciation curve.
AGE_BUCKETS = [(0, 2), (3, 5), (6, 10), (11, 15), (16, 20), (21, 30), (31, 80)]


def depreciation_curve(frame: pd.DataFrame) -> list[dict]:
    """How much a building's age takes off its price, measured, not assumed.

    Each listing with a known completion year is compared with its own
    sub-district's going rate (sd_ppsqm, built from other rows), so location is
    held fixed; the median gap per age bucket, relative to a new building, is
    the depreciation factor.
    """
    known = frame[frame["building_age"] != UNKNOWN]
    gap = log_ppsqm(known) - known["sd_ppsqm"].to_numpy(dtype=float)
    age = known["building_age"].to_numpy(dtype=float)
    rows = []
    for lo, hi in AGE_BUCKETS:
        mask = (age >= lo) & (age <= hi)
        if mask.sum() >= 30:
            rows.append({"age_lo": lo, "age_hi": hi, "n": int(mask.sum()),
                         "gap": float(np.median(gap[mask]))})
    base = rows[0]["gap"] if rows else 0.0
    for r in rows:
        r["factor"] = round(float(np.exp(r.pop("gap") - base)), 4)
    return rows


def map_points(df: pd.DataFrame) -> pd.DataFrame:
    """Every pinned listing, for the map's radius summaries."""
    pinned = df.dropna(subset=["latitude", "longitude"])
    return pd.DataFrame({
        "lat": pinned["latitude"].to_numpy(dtype=float),
        "lng": pinned["longitude"].to_numpy(dtype=float),
        "type": pinned["collateral_type"].to_numpy(),
        "price": pinned[TARGET].to_numpy(dtype=float),
        "area": pinned["area_sqm"].to_numpy(dtype=float),
        "age": pinned["building_age"].to_numpy(dtype=float),
        "province": pinned["province"].to_numpy(),
        "district": pinned["district"].to_numpy(),
        "sub_district": pinned["sub_district"].to_numpy(),
    })


def app_views(rows: pd.DataFrame, ref: dict) -> dict[str, pd.DataFrame]:
    """The same held-out rows described three ways:
      click     what the app sends after a map click: pin, type, size, place -
                no project, rooms or age (the project is snapped from the pin)
      dropdown  sub-district from the list, no pin
      listing   every fact the listing itself states
    "click" is scored only on rows that really have a pin; a click always has one."""
    pinned = rows["latitude"].notna()
    return {
        "click": add_features(form_view(rows[pinned]), ref),
        "dropdown": add_features(form_view(rows).assign(latitude=np.nan, longitude=np.nan), ref),
        "listing": add_features(rows, ref),
    }


# Weights are picked, and the headline "test" figures reported, on this view.
PRIMARY_VIEW = "click"


def main() -> None:
    df, report = clean(load_raw())
    train_all, test = split(df)

    # Comparables for a fit row come from the years before it; for validation
    # and test they come from every year the model was allowed to see. That is
    # what serving does, so it is what the score has to be measured under.
    fit_rows = train_all[train_all.fold == "fit"]
    fit_frame = build_training_frame(fit_rows)
    fit_ref = build_reference(fit_rows)
    val_frame = app_views(train_all[train_all.fold == "val"], fit_ref)[PRIMARY_VIEW]
    test_views = app_views(test, fit_ref)
    test_frame = test_views[PRIMARY_VIEW]

    print(f"fit {len(fit_frame):,} | val {len(val_frame):,} | test {len(test_frame):,}")
    print(f"exact comparable present: fit {(fit_frame.comp_n > 0).mean():.1%}  "
          f"val {(val_frame.comp_n > 0).mean():.1%}  "
          f"test {(test_frame.comp_n > 0).mean():.1%}\n")

    categories = {c: sorted(train_all[c].unique()) for c in CATEGORICAL}
    y_fit = log_ppsqm(fit_frame)

    X_fit_raw = fit_frame[FEATURES]
    X_val_raw = val_frame[FEATURES]
    X_test_raw = test_frame[FEATURES]
    X_fit_cat = as_categorical(X_fit_raw, categories)
    X_val_cat = as_categorical(X_val_raw, categories)
    X_test_cat = as_categorical(X_test_raw, categories)

    models = build_models()
    timings = fit_all(models, X_fit_raw, X_fit_cat, y_fit)

    # --- ensemble weights, chosen on validation only -----------------------
    val_area = val_frame["area_sqm"].to_numpy(dtype=float)
    val_pred = predict_prices(models, X_val_raw, X_val_cat, val_area)
    y_val = val_frame[TARGET].to_numpy(dtype=float)

    # Every model must carry at least MIN_WEIGHT. Left unconstrained the search
    # zeroes members out entirely; a three-model ensemble where one model is
    # switched off is not a three-model ensemble, and the accuracy it buys is
    # within noise (printed below as the cost).
    MIN_WEIGHT = 0.10
    best, best_r2 = None, -np.inf
    unconstrained, unconstrained_r2 = None, -np.inf
    grid = np.arange(0, 1.01, 0.05)
    for wc in grid:
        for wl in grid:
            wx = 1 - wc - wl
            if wx < -1e-9:
                continue
            wx = max(wx, 0.0)
            blend = wc * val_pred["CatBoost"] + wl * val_pred["LightGBM"] + wx * val_pred["XGBoost"]
            # R2 on baht is the accuracy target this project is held to.
            r2 = metrics(y_val, blend)["R2"]
            if r2 > unconstrained_r2:
                unconstrained_r2, unconstrained = r2, (wc, wl, wx)
            if min(wc, wl, wx) < MIN_WEIGHT - 1e-9:
                continue
            if r2 > best_r2:
                best_r2, best = r2, (float(round(wc, 2)), float(round(wl, 2)), float(round(wx, 2)))
    weights = {"CatBoost": best[0], "LightGBM": best[1], "XGBoost": best[2]}
    print(f"\nensemble weights (from validation, min {MIN_WEIGHT:.0%} each): {weights}")
    print(f"  val R2 constrained   {best_r2:.4f}")
    print(f"  val R2 unconstrained {unconstrained_r2:.4f}  "
          f"(weights {tuple(round(float(w), 2) for w in unconstrained)})")
    print(f"  cost of keeping all three: {unconstrained_r2 - best_r2:+.4f}")

    # --- final scoring on the untouched test years -------------------------
    y_test = test_frame[TARGET].to_numpy(dtype=float)
    test_area = test_frame["area_sqm"].to_numpy(dtype=float)
    test_pred = predict_prices(models, X_test_raw, X_test_cat, test_area)
    ens_test = sum(weights[n] * p for n, p in test_pred.items())

    results = {n: {"test": metrics(y_test, p), "weight": weights[n],
                   "train_seconds": round(timings[n], 1)} for n, p in test_pred.items()}
    results["Ensemble"] = {"test": metrics(y_test, ens_test), "weight": 1.0}

    view_scores = {}
    for vname, vf in test_views.items():
        vx = vf[FEATURES]
        vp = predict_prices(models, vx, as_categorical(vx, categories), vf["area_sqm"].to_numpy(dtype=float))
        ens = sum(weights[n] * p for n, p in vp.items())
        view_scores[vname] = {"rows": len(vf), **metrics(vf[TARGET].to_numpy(dtype=float), ens)}
    print(f"\ntest R2 by input view (ensemble; headline = {PRIMARY_VIEW}):")
    for vname, m in view_scores.items():
        print(f"  {vname:<9} n={m['rows']:>6,}  R2 {m['R2']:.4f}  MdAPE {m['MdAPE']:.2f}%  ±20% {m['Within_20Pct']:.1f}%")

    print("\n" + "=" * 78)
    print(f"{'model':<12}{'MAPE':>9}{'MdAPE':>9}{'R2':>9}{'MAE':>14}{'±10%':>9}{'±20%':>9}")
    print("-" * 78)
    for n in ["CatBoost", "LightGBM", "XGBoost", "Ensemble"]:
        m = results[n]["test"]
        print(f"{n:<12}{m['MAPE']:>8.2f}%{m['MdAPE']:>8.2f}%{m['R2']:>9.4f}"
              f"{m['MAE']:>14,.0f}{m['Within_10Pct']:>8.1f}%{m['Within_20Pct']:>8.1f}%")
    print("=" * 78)

    # --- refit on every training year for the artifact we actually serve ---
    print("\nrefitting on fit + validation rows for serving...", flush=True)
    serve_frame = build_training_frame(train_all)
    serve_ref = build_reference(train_all)
    y_all = log_ppsqm(serve_frame)
    X_all_raw = serve_frame[FEATURES]
    X_all_cat = as_categorical(X_all_raw, categories)
    serve_models = build_models()
    fit_all(serve_models, X_all_raw, X_all_cat, y_all)

    importance = dict(zip(FEATURES, serve_models["CatBoost"].get_feature_importance()))
    total = sum(importance.values()) or 1.0
    importance = {k: round(v / total, 4) for k, v in sorted(
        importance.items(), key=lambda kv: -kv[1])}

    depreciation = depreciation_curve(serve_frame)
    print("\ndepreciation (price vs a new building, same sub-district):")
    for r in depreciation:
        print(f"  {r['age_lo']:>2}-{r['age_hi']:<2} yrs  x{r['factor']:.3f}  (n={r['n']:,})")
    points = map_points(df)

    joblib.dump({
        "models": serve_models,
        "depreciation": depreciation,
        "points": points,
        "locator": BallTree(np.radians(points[["lat", "lng"]].to_numpy()), metric="haversine"),
        # Display name per project key, for telling the user which building a click snapped to.
        "project_names": df.dropna(subset=["project_key", "project_name"])
                           .groupby("project_key")["project_name"].first().to_dict(),
        "weights": weights,
        "features": FEATURES,
        "categorical": CATEGORICAL,
        "categories": categories,
        "reference": serve_ref,
        "log_target": "log_ppsqm",
    }, OUT / "ensemble.joblib", compress=3)

    (OUT / "metrics.json").write_text(json.dumps({
        "protocol": {
            "fit_years": sorted(int(y) for y in fit_frame.year.unique()),
            "validation": f"{FOLD_FRACTIONS['val']:.0%} of {TEST_YEARS} rows, seed {FOLD_SEED}",
            "test": f"{FOLD_FRACTIONS['test']:.0%} of {TEST_YEARS} rows, seed {FOLD_SEED}",
            "test_years": sorted(int(y) for y in test.year.unique()),
            "served_model_fit_years": sorted(int(y) for y in train_all.year.unique()),
        },
        "rows": {"fit": len(fit_frame), "validation": len(val_frame), "test": len(test_frame)},
        "views": view_scores,
        "primary_view": PRIMARY_VIEW,
        "cleaning": report,
        "features": FEATURES,
        "feature_importance": importance,
        "results": results,
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nsaved {OUT/'ensemble.joblib'}")
    print(f"saved {OUT/'metrics.json'}")
    print("\nfeature importance (CatBoost):")
    for k, v in importance.items():
        print(f"  {k:20s} {v:6.1%}")


if __name__ == "__main__":
    main()
