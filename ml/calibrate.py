"""
Derive prediction intervals from the served model's out-of-sample error.

The served ensemble is never fitted on the calibration fold ("cal") or the test
fold (prepare_data.assign_folds), so actual/predicted there is an honest picture
of how wrong it is. The price range is set on "cal" only: per property type,
split conformal bounds on actual/predicted (evaluation.conformal_ratio_bounds)
give the 10th and 90th percentile ratio. The "test" fold is then scored once
against those bounds: coverage (should land near the nominal 80%) and IAAO ratio
statistics, written to metrics.json as test_coverage.

Intervals are measured separately for the two ways the app is used
(train_models.app_views): a map click ("calibration") and the sub-district
dropdown alone ("calibration_dropdown"), which is markedly less precise.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np

from decision import components, decide, fit_thresholds, screening, wqs
from evaluation import conformal_ratio_bounds, coverage, iaao
from prepare_data import FEATURES, TARGET, clean, load_raw, split, to_price
from train_models import app_views, as_categorical

BUNDLE = Path("models/ensemble.joblib")
# Interval level: the 10th to 90th percentile of the ratio is an 80% interval.
NOMINAL_PCT = 80.0
# Rows of a property type needed before it gets its own interval.
MIN_ROWS = 200
# Which app view each stored calibration key is measured on.
VIEWS = {"calibration": "click", "calibration_dropdown": "dropdown"}


def predict_each(bundle: dict, featured) -> dict[str, np.ndarray]:
    """Each served model's price for each row of a featured view."""
    area = featured["area_sqm"].to_numpy(dtype=float)
    X_raw = featured[FEATURES]
    X_cat = as_categorical(X_raw, bundle["categories"])
    return {
        n: to_price(m.predict(X_raw if n == "CatBoost" else X_cat), area)
        for n, m in bundle["models"].items()
    }


def _blend(bundle: dict, per_model: dict[str, np.ndarray]) -> np.ndarray:
    return sum(bundle["weights"][n] * p for n, p in per_model.items())


def predict(bundle: dict, featured) -> np.ndarray:
    """The served ensemble's blended price for each row of a featured view."""
    return _blend(bundle, predict_each(bundle, featured))


def _masks(featured) -> dict[str, np.ndarray]:
    """Row masks: one per property type with MIN_ROWS rows, then __default__ for all."""
    types = featured["collateral_type"].to_numpy()
    masks = {}
    for ptype in np.unique(types):
        mask = types == ptype
        if mask.sum() >= MIN_ROWS:
            masks[ptype] = mask
    masks["__default__"] = np.ones(len(types), dtype=bool)
    return masks


def fit_view(bundle: dict, cal) -> dict:
    """Price range per segment, set on the calibration fold."""
    pred = predict(bundle, cal)
    actual = cal[TARGET].to_numpy(dtype=float)
    ratio = actual / np.clip(pred, 1, None)
    ape = np.abs(pred - actual) / actual * 100

    calibration = {}
    for key, mask in _masks(cal).items():
        lo, hi = conformal_ratio_bounds(ratio[mask])
        calibration[key] = {
            "n": int(mask.sum()),
            "q10": lo,
            "q90": hi,
            "median_actual_over_pred": float(np.median(ratio[mask])),
            "MdAPE": float(np.median(ape[mask])),
            "within_20pct": float(np.mean(ape[mask] <= 20) * 100),
        }
    return calibration


def score_view(bundle: dict, calibration: dict, test) -> dict:
    """Score the test fold against the calibrated range of each segment. Segments
    are the calibration keys, so every interval gets a coverage figure."""
    pred = predict(bundle, test)
    actual = test[TARGET].to_numpy(dtype=float)
    types = test["collateral_type"].to_numpy()
    scores = {}
    for key, stats in calibration.items():
        mask = np.ones(len(types), dtype=bool) if key == "__default__" else types == key
        if not mask.any():
            continue
        p, a = pred[mask], actual[mask]
        scores[key] = {
            "n": int(mask.sum()),
            "coverage_pct": coverage(a, p * stats["q10"], p * stats["q90"]),
            "nominal_pct": NOMINAL_PCT,
            **iaao(p, a),
        }
    return scores


def fit_decision(bundle: dict, cal) -> dict:
    """One accept/reject threshold pair for the whole view, fitted on the
    calibration fold. Per-type pairs collapse to the segment average, so the
    single pair is the only one used."""
    per_model = predict_each(bundle, cal)
    ensemble = _blend(bundle, per_model)
    score = wqs(components(per_model, ensemble, cal))
    actual = cal[TARGET].to_numpy(dtype=float)
    ape = np.abs(ensemble - actual) / actual * 100
    return {"__default__": fit_thresholds(score, ape)}


def score_decision(bundle: dict, decision: dict, test) -> dict:
    """Label every test row with the view's __default__ thresholds, then screen
    those labels within each property type segment (and __default__ for all
    rows), so the per-type tables show how the global labels distribute."""
    per_model = predict_each(bundle, test)
    pred = _blend(bundle, per_model)
    score = wqs(components(per_model, pred, test))
    actual = test[TARGET].to_numpy(dtype=float)
    thresholds = decision["__default__"]
    labels = decide(score, thresholds["alpha"], thresholds["beta"])
    report = {}
    for key, mask in _masks(test).items():
        if not mask.any():
            continue
        report[key] = screening(labels[mask], pred[mask], actual[mask])
    return report


def main() -> None:
    bundle = joblib.load(BUNDLE)
    df, _ = clean(load_raw())
    train_all, test = split(df)
    # The calibration fold was never fitted on and never used to pick weights;
    # the bundle's reference was built without it, so both views are honest.
    cal_views = app_views(train_all[train_all.fold == "cal"], bundle["reference"])
    test_views = app_views(test, bundle["reference"])

    out = {key: fit_view(bundle, cal_views[view]) for key, view in VIEWS.items()}
    coverage_out = {key: score_view(bundle, out[key], test_views[view])
                    for key, view in VIEWS.items()}
    decision = {key: fit_decision(bundle, cal_views[view]) for key, view in VIEWS.items()}
    decision_test = {key: score_decision(bundle, decision[key], test_views[view])
                     for key, view in VIEWS.items()}
    bundle.update(out)
    bundle["decision"] = decision
    joblib.dump(bundle, BUNDLE, compress=3)

    for key, calibration in out.items():
        print(f"\n{key}")
        print(f"{'segment':<44}{'n':>8}{'q10':>8}{'q90':>8}{'MdAPE':>9}{'±20%':>8}")
        print("-" * 85)
        for k, v in calibration.items():
            print(f"{k[:42]:<44}{v['n']:>8,}{v['q10']:>8.2f}{v['q90']:>8.2f}"
                  f"{v['MdAPE']:>8.1f}%{v['within_20pct']:>7.1f}%")

    for key, scores in coverage_out.items():
        print(f"\n{key}: test-fold coverage (nominal {NOMINAL_PCT:.0f}%)")
        print(f"{'segment':<44}{'n':>8}{'cover%':>9}{'median':>8}{'COD':>8}{'PRD':>8}")
        print("-" * 85)
        for k, v in scores.items():
            print(f"{k[:42]:<44}{v['n']:>8,}{v['coverage_pct']:>8.1f}%"
                  f"{v['median_ratio']:>8.3f}{v['COD']:>8.2f}{v['PRD']:>8.3f}")

    for key in VIEWS:
        v = decision[key]["__default__"]
        a = "-" if v["alpha"] is None else f"{v['alpha']:.3f}"
        b = "-" if v["beta"] is None else f"{v['beta']:.3f}"
        print(f"\n{key}: one decision threshold pair per view (fit on cal)")
        print(f"alpha {a}   beta {b}   cal n {v['n']:,}")
        print(f"\n{key}: global labels screened on test, per segment")
        print(f"{'segment':<34}{'label':<10}{'n':>8}{'share':>8}{'MdAPE':>9}{'±20%':>8}")
        print("-" * 77)
        for seg, labels in decision_test[key].items():
            for label, s in labels.items():
                print(f"{seg[:32]:<34}{label:<10}{s['n']:>8,}{s['share_pct']:>7.1f}%"
                      f"{s['MdAPE']:>8.1f}%{s['within_20pct']:>7.1f}%")

    m = json.loads(Path("models/metrics.json").read_text(encoding="utf-8"))
    m.update(out)
    m["test_coverage"] = coverage_out
    m["decision"] = decision
    m["decision_test"] = decision_test
    m["decision_note"] = (
        "Accept/reject thresholds are fit on the calibration fold (accept: within-20% >= 80%, "
        "reject: <= 50%, each group >= 5% of rows) and screened on the test fold; defer is the rest."
    )
    m["calibration_note"] = (
        "split conformal: bounds from the calibration fold, coverage measured on the test fold. "
        "Per property type: 'calibration' for a map click, 'calibration_dropdown' for the "
        "sub-district list alone; test_coverage scores the same intervals on the test fold. "
        "In 'calibration', median_actual_over_pred is actual/predicted on the calibration fold; "
        "in 'test_coverage', median_ratio is the IAAO ratio predicted/actual on the test fold."
    )
    Path("models/metrics.json").write_text(
        json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\nupdated models/ensemble.joblib and models/metrics.json")


if __name__ == "__main__":
    main()
