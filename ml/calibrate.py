"""
Derive prediction intervals from the model's real out-of-sample error.

The served ensemble has never seen the held-out test fold (prepare_data.
assign_folds), so the ratio actual/predicted there is an honest picture of how
wrong it is.
We store the 10th/90th percentile of that ratio per property type and use them
as the low/high bounds instead of an invented +/-6% band.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np

from prepare_data import FEATURES, TARGET, add_features, clean, load_raw, split, to_price
from train_models import as_categorical

BUNDLE = Path("models/ensemble.joblib")


def main() -> None:
    bundle = joblib.load(BUNDLE)
    df, _ = clean(load_raw())
    _, test = split(df)

    featured = add_features(test, bundle["reference"])
    area = featured["area_sqm"].to_numpy(dtype=float)
    X_raw = featured[FEATURES]
    X_cat = as_categorical(X_raw, bundle["categories"])
    pred = sum(
        bundle["weights"][n] * to_price(m.predict(X_raw if n == "CatBoost" else X_cat), area)
        for n, m in bundle["models"].items()
    )
    actual = test[TARGET].to_numpy(dtype=float)
    ratio = actual / np.clip(pred, 1, None)

    calibration = {}
    for ptype in test.collateral_type.unique():
        mask = (test.collateral_type == ptype).to_numpy()
        if mask.sum() < 200:
            continue
        r = ratio[mask]
        ape = np.abs(pred[mask] - actual[mask]) / actual[mask] * 100
        calibration[ptype] = {
            "n": int(mask.sum()),
            "q10": float(np.quantile(r, 0.10)),
            "q90": float(np.quantile(r, 0.90)),
            "median_ratio": float(np.median(r)),
            "MdAPE": float(np.median(ape)),
            "within_20pct": float(np.mean(ape <= 20) * 100),
        }

    r = ratio
    ape = np.abs(pred - actual) / actual * 100
    calibration["__default__"] = {
        "n": int(len(r)),
        "q10": float(np.quantile(r, 0.10)),
        "q90": float(np.quantile(r, 0.90)),
        "median_ratio": float(np.median(r)),
        "MdAPE": float(np.median(ape)),
        "within_20pct": float(np.mean(ape <= 20) * 100),
    }

    bundle["calibration"] = calibration
    joblib.dump(bundle, BUNDLE, compress=3)

    print(f"{'segment':<44}{'n':>8}{'q10':>8}{'q90':>8}{'MdAPE':>9}{'±20%':>8}")
    print("-" * 85)
    for k, v in calibration.items():
        print(f"{k[:42]:<44}{v['n']:>8,}{v['q10']:>8.2f}{v['q90']:>8.2f}"
              f"{v['MdAPE']:>8.1f}%{v['within_20pct']:>7.1f}%")

    m = json.loads(Path("models/metrics.json").read_text(encoding="utf-8"))
    m["calibration"] = calibration
    m["calibration_note"] = (
        "Intervals are the 10th-90th percentile of actual/predicted on the "
        "held-out test years, per property type."
    )
    Path("models/metrics.json").write_text(
        json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\nupdated models/ensemble.joblib and models/metrics.json")


if __name__ == "__main__":
    main()
