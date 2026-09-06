"""
Search hyperparameters for the three models on the validation year.

Scored on 2567 only. The test years 2568-2569 are not loaded here at all - a
parameter picked because it happened to score well on the test set makes the
final number meaningless, and that is the easiest way to fool yourself.

Every candidate trains with early stopping against the same validation year, so
n_estimators stops being a guess: the search reports the round each config
actually needed. Run it, then copy the winners into train_models.build_models().
"""
from __future__ import annotations

import time

import numpy as np
from catboost import CatBoostRegressor
from lightgbm import LGBMRegressor, early_stopping
from xgboost import XGBRegressor

from prepare_data import (
    CATEGORICAL, FEATURES, TARGET, add_features, build_reference,
    build_training_frame, clean, load_raw, log_ppsqm, split, to_price,
)
from train_models import SEED, VAL_YEAR, as_categorical

MAX_ROUNDS = 6000
PATIENCE = 150

CATBOOST_GRID = [
    {"depth": 8},
    {"depth": 10},
    {"depth": 12},
    {"depth": 10, "l2_leaf_reg": 8.0},
]
LIGHTGBM_GRID = [
    {"num_leaves": 127},
    {"num_leaves": 255},
    {"num_leaves": 511},
    {"num_leaves": 255, "min_child_samples": 60},
]
XGBOOST_GRID = [
    {"max_depth": 8},
    {"max_depth": 10},
    {"max_depth": 12},
    {"max_depth": 10, "min_child_weight": 20},
]


def val_mape(pred_log: np.ndarray, area: np.ndarray, y: np.ndarray) -> float:
    pred = to_price(pred_log, area)
    return float(np.mean(np.abs(pred - y) / y * 100))


def main() -> None:
    df, _ = clean(load_raw())
    train_all, _ = split(df)
    hist = train_all[train_all.year < VAL_YEAR]

    fit_frame = build_training_frame(hist)
    val_frame = add_features(train_all[train_all.year == VAL_YEAR], build_reference(hist))
    categories = {c: sorted(train_all[c].unique()) for c in CATEGORICAL}

    y_fit = log_ppsqm(fit_frame)
    y_val_log = log_ppsqm(val_frame)
    y_val = val_frame[TARGET].to_numpy(dtype=float)
    area = val_frame["area_sqm"].to_numpy(dtype=float)

    X_fit_raw, X_val_raw = fit_frame[FEATURES], val_frame[FEATURES]
    X_fit_cat = as_categorical(X_fit_raw, categories)
    X_val_cat = as_categorical(X_val_raw, categories)

    print(f"fit {len(fit_frame):,} | val {len(val_frame):,}\n")
    print(f"{'model':<10}{'params':<42}{'rounds':>8}{'val MAPE':>10}{'sec':>7}")
    print("-" * 77)

    results = {}
    for name, grid in [("CatBoost", CATBOOST_GRID), ("LightGBM", LIGHTGBM_GRID),
                       ("XGBoost", XGBOOST_GRID)]:
        for params in grid:
            t = time.time()
            # A grid entry overrides a default of the same name, so the two
            # dicts are merged before the constructor sees either.
            if name == "CatBoost":
                m = CatBoostRegressor(**{
                    "iterations": MAX_ROUNDS, "learning_rate": 0.04,
                    "l2_leaf_reg": 3.0, "loss_function": "MAE",
                    "random_seed": SEED, "verbose": False,
                    "cat_features": CATEGORICAL,
                    "early_stopping_rounds": PATIENCE, **params})
                m.fit(X_fit_raw, y_fit, eval_set=(X_val_raw, y_val_log))
                rounds = m.get_best_iteration()
                pred = m.predict(X_val_raw)
            elif name == "LightGBM":
                m = LGBMRegressor(**{
                    "n_estimators": MAX_ROUNDS, "learning_rate": 0.04,
                    "min_child_samples": 30, "subsample": 0.9,
                    "colsample_bytree": 0.9, "objective": "regression_l1",
                    "random_state": SEED, "verbose": -1, **params})
                m.fit(X_fit_cat, y_fit, eval_set=[(X_val_cat, y_val_log)],
                      eval_metric="l1", categorical_feature=CATEGORICAL,
                      callbacks=[early_stopping(PATIENCE, verbose=False)])
                rounds = m.best_iteration_
                pred = m.predict(X_val_cat)
            else:
                m = XGBRegressor(**{
                    "n_estimators": MAX_ROUNDS, "learning_rate": 0.04,
                    "subsample": 0.9, "colsample_bytree": 0.9,
                    "min_child_weight": 5, "objective": "reg:absoluteerror",
                    "random_state": SEED, "enable_categorical": True,
                    "tree_method": "hist",
                    "early_stopping_rounds": PATIENCE, **params})
                m.fit(X_fit_cat, y_fit, eval_set=[(X_val_cat, y_val_log)], verbose=False)
                rounds = m.best_iteration
                pred = m.predict(X_val_cat)

            mape = val_mape(pred, area, y_val)
            secs = time.time() - t
            print(f"{name:<10}{str(params):<42}{rounds:>8}{mape:>9.3f}%{secs:>7.0f}", flush=True)
            if mape < results.get(name, (np.inf,))[0]:
                results[name] = (mape, params, rounds)

    print("\nbest per model (validation MAPE):")
    for name, (mape, params, rounds) in results.items():
        print(f"  {name:<10}{mape:>8.3f}%  rounds={rounds}  {params}")


if __name__ == "__main__":
    main()
