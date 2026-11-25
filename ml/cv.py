"""
Honest out-of-sample checks for the served ensemble: spatial and temporal CV.

The headline test fold (prepare_data.split) is untouched here. CV runs on the
rows the served model is fitted on (train_models.serve_rows: fit and validation,
never the calibration fold, whose price range would otherwise be scored on data
that set it), and each held-out block is priced by a model that never saw it:

  spatial   GroupKFold over province|district|sub_district. A whole neighbourhood
            is held out, so comparables for it must come from elsewhere.
  temporal  the newest days are held out; the model is trained on earlier posts.

Ensemble weights are fixed to the served bundle's weights; nothing is searched
inside a fold. Intervals use the served bundle's per-type calibration (q10 / q90).

    python cv.py [--iterations N] [--folds 5] [--days 90]
"""
from __future__ import annotations

import argparse
import json
import sys
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from evaluation import coverage, iaao, spatial_groups, temporal_split
from prepare_data import CATEGORICAL, FEATURES, TARGET, build_reference, build_training_frame, clean, load_raw, log_ppsqm, split
from train_models import OUT, app_views, build_models, fit_all, as_categorical, metrics, predict_prices, serve_rows


def _intervals(types: np.ndarray, pred: np.ndarray, calibration: dict) -> tuple[np.ndarray, np.ndarray]:
    default = calibration["__default__"]
    q10 = np.array([calibration.get(t, default)["q10"] for t in types], dtype=float)
    q90 = np.array([calibration.get(t, default)["q90"] for t in types], dtype=float)
    return pred * q10, pred * q90


def _run(fit_rows: pd.DataFrame, hold_rows: pd.DataFrame, categories: dict,
         weights: dict, calibration: dict, iterations: int) -> dict:
    """Fit the served recipe on fit_rows, price hold_rows as the app would."""
    fit_frame = build_training_frame(fit_rows)
    ref = build_reference(fit_rows)
    hold = app_views(hold_rows, ref)["click"]

    X_fit = fit_frame[FEATURES]
    models = build_models(iterations)
    fit_all(models, X_fit, as_categorical(X_fit, categories), log_ppsqm(fit_frame))

    X_hold = hold[FEATURES]
    parts = predict_prices(models, X_hold, as_categorical(X_hold, categories),
                           hold["area_sqm"].to_numpy(dtype=float))
    pred = sum(weights[n] * p for n, p in parts.items())
    actual = hold[TARGET].to_numpy(dtype=float)
    types = hold["collateral_type"].to_numpy()
    lower, upper = _intervals(types, pred, calibration)
    return {"fit_rows": len(fit_frame), "holdout_rows": len(hold),
            "actual": actual, "pred": pred, "types": types, "lower": lower, "upper": upper}


def _score(r: dict) -> dict:
    return {"rows": len(r["actual"]), **metrics(r["actual"], r["pred"]),
            "iaao": iaao(r["pred"], r["actual"]),
            "coverage": coverage(r["actual"], r["lower"], r["upper"])}


def _by_type(r: dict) -> dict:
    out = {}
    for t in sorted(set(r["types"].tolist())):
        m = r["types"] == t
        mm = metrics(r["actual"][m], r["pred"][m])
        out[t] = {"rows": int(m.sum()), "MdAPE": mm["MdAPE"], "Within_20Pct": mm["Within_20Pct"],
                  "coverage": coverage(r["actual"][m], r["lower"][m], r["upper"][m])}
    return out


def _pool(runs: list[dict]) -> dict:
    cat = {k: np.concatenate([r[k] for r in runs]) for k in ("actual", "pred", "types", "lower", "upper")}
    return cat


def _print_table(title: str, rows: list[tuple[str, dict]]) -> None:
    print(f"\n{title}")
    print(f"{'block':<14}{'rows':>9}{'MdAPE':>9}{'±20%':>8}{'R2':>8}{'COD':>8}{'PRD':>8}{'medRatio':>10}{'cover%':>9}")
    print("-" * 85)
    for label, s in rows:
        print(f"{label:<14}{s['rows']:>9,}{s['MdAPE']:>8.2f}%{s['Within_20Pct']:>7.1f}%{s['R2']:>8.4f}"
              f"{s['iaao']['COD']:>8.2f}{s['iaao']['PRD']:>8.3f}{s['iaao']['median_ratio']:>10.3f}{s['coverage']:>8.1f}%")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--iterations", type=int, default=2000)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--days", type=int, default=90)
    args = ap.parse_args()

    bundle = joblib.load(OUT / "ensemble.joblib")
    weights = {k: float(v) for k, v in bundle["weights"].items()}
    calibration = bundle["calibration"]

    df, _ = clean(load_raw())
    train_all, _ = split(df)
    pool = serve_rows(train_all).reset_index(drop=True)
    categories = {c: sorted(train_all[c].unique()) for c in CATEGORICAL}
    print(f"cv pool {len(pool):,} rows (fit + validation; test and calibration held out)", flush=True)

    # --- spatial: whole sub-districts held out ----------------------------
    groups = spatial_groups(pool)
    folds, runs = [], []
    for i, (tr, te) in enumerate(GroupKFold(n_splits=args.folds).split(pool, groups=groups), 1):
        t = time.time()
        r = _run(pool.iloc[tr], pool.iloc[te], categories, weights, calibration, args.iterations)
        runs.append(r)
        secs = time.time() - t
        print(f"spatial fold {i}/{args.folds}: fit {r['fit_rows']:,} holdout {r['holdout_rows']:,} "
              f"in {secs:.1f}s", flush=True)
        folds.append({"fold": i, "seconds": round(secs, 1), **_score(r)})
    pooled_run = _pool(runs)
    spatial = {"folds": folds, "pooled": _score(pooled_run), "by_type": _by_type(pooled_run)}

    # --- temporal: newest days held out -----------------------------------
    t = time.time()
    no_hipflat = pool[pool["source"] != "hipflat"]
    cutoff = (no_hipflat["posted"].max() - pd.Timedelta(days=args.days)).date().isoformat()
    tr, ho = temporal_split(pool, days=args.days)
    r = _run(tr, ho, categories, weights, calibration, args.iterations)
    print(f"temporal split (cutoff {cutoff}): fit {r['fit_rows']:,} holdout {r['holdout_rows']:,} "
          f"in {time.time() - t:.1f}s", flush=True)
    temporal = {"cutoff": cutoff, "train_rows": r["fit_rows"], "holdout_rows": r["holdout_rows"],
                **_score(r), "by_type": _by_type(r)}

    # --- report ------------------------------------------------------------
    _print_table("spatial CV (GroupKFold by sub-district)",
                 [(f"fold {f['fold']}", f) for f in folds] + [("pooled", spatial["pooled"])])
    _print_table(f"temporal CV (holdout posted on or after {cutoff})", [("holdout", temporal)])

    out = {"spatial": spatial, "temporal": temporal,
           "settings": {"folds": args.folds, "days": args.days, "iterations": args.iterations,
                        "weights": weights, "group": "province|district|sub_district"}}
    (OUT / "cv_metrics.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    metrics_path = OUT / "metrics.json"
    merged = json.loads(metrics_path.read_text(encoding="utf-8"))
    merged["cv"] = out
    metrics_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nsaved {OUT / 'cv_metrics.json'}")
    print(f"merged into {metrics_path} under 'cv'")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
