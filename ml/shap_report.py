"""Global SHAP importance and stability on the test fold (thesis Ch.4).

Reads the test fold's click view (what the app sends after a map click), explains
the served blend with native SHAP, and writes:
  - importance[segment][group]: mean |phi_g| in log price-per-sqm units, and
    pct_equiv = (exp(mean |phi_g|) - 1) * 100
  - model_agreement: Spearman rank correlation of __default__ group importances
    between each pair of the three models
  - bootstrap: 200 resamples of test rows (seed 42); for each group, the share of
    resamples in which it keeps its full-sample rank, and the 5th-95th percentile
    of its rank
into models/shap_metrics.json and metrics.json["shap"].
"""
from __future__ import annotations

import itertools
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from explain import GROUPS, group_shap, shap_each
from prepare_data import clean, load_raw, split
from train_models import app_views

BUNDLE = Path("models/ensemble.joblib")
OUT = Path("models/shap_metrics.json")
MIN_ROWS = 200
N_BOOT = 200
SEED = 42
NOTE = (
    "Stability is measured as agreement across the three models and bootstrap rank stabili"
    "ty on the test fold. It is not measured across refitted CV folds (re-running cv.py co"
    "sts about 45 minutes). The bootstrap resamples test rows with the three models held f"
    "ixed, so it measures only the sampling noise of the mean |phi| over about 13.9k rows,"
    " not variance from refitting (other training data, seeds, CV folds); its 1.000 retent"
    "ion values are therefore weak evidence of stability. The three models were trained on"
    " the same data with correlated learners, so their agreement is not independent eviden"
    "ce either. pct_equiv is the typical size of each group's contribution to the model's "
    "estimate, not a share of the price; groups are measured separately, so they are not c"
    "apped at 100% and do not sum to anything meaningful. SHAP shows what the model used, "
    "not cause and effect."
)


def _pct(mean_abs: np.ndarray) -> np.ndarray:
    return (np.exp(mean_abs) - 1.0) * 100.0


def _ranks(values: np.ndarray) -> np.ndarray:
    """1 = largest, per row (last axis)."""
    return (-values).argsort(axis=-1).argsort(axis=-1) + 1


def main() -> None:
    bundle = joblib.load(BUNDLE)
    df, _ = clean(load_raw())
    _, test = split(df)
    click = app_views(test, bundle["reference"])["click"]
    n = len(click)
    groups = list(GROUPS)

    # Per-model SHAP, computed once; the blend is sum_m w_m * phi_m as in explain.ensemble_shap.
    per_model = shap_each(bundle, click)
    weights = bundle["weights"]
    phi = sum(float(weights[name]) * p for name, (p, _) in per_model.items())
    gphi = group_shap(phi)
    gabs = gphi.abs()

    types = click["collateral_type"].to_numpy()
    masks = {"__default__": np.ones(n, dtype=bool)}
    for ptype in np.unique(types):
        mask = types == ptype
        if mask.sum() >= MIN_ROWS:
            masks[str(ptype)] = mask

    importance = {}
    for seg, mask in masks.items():
        mean_abs = gabs.to_numpy()[mask].mean(axis=0)
        pct = _pct(mean_abs)
        importance[seg] = {
            g: {"mean_abs": float(mean_abs[i]), "pct_equiv": float(pct[i])}
            for i, g in enumerate(groups)
        }

    # Model agreement on __default__ group importances.
    per_model_imp = {
        name: group_shap(p).abs().mean().to_numpy() for name, (p, _) in per_model.items()
    }
    model_agreement = {}
    for a, b in itertools.combinations(per_model_imp, 2):
        ra = pd.Series(per_model_imp[a]).rank().to_numpy()
        rb = pd.Series(per_model_imp[b]).rank().to_numpy()
        model_agreement[f"{a}-{b}"] = float(np.corrcoef(ra, rb)[0, 1])

    # Bootstrap over test rows: rank of each group's mean |phi| on the full sample vs resamples.
    full_imp = gabs.to_numpy().mean(axis=0)
    full_rank = _ranks(full_imp)
    rng = np.random.default_rng(SEED)
    values = gabs.to_numpy()
    boot_ranks = np.empty((N_BOOT, len(groups)), dtype=float)
    for b in range(N_BOOT):
        idx = rng.integers(0, n, n)
        boot_ranks[b] = _ranks(values[idx].mean(axis=0))
    bootstrap = {
        g: {
            "rank": int(full_rank[i]),
            "share_same_rank": float(np.mean(boot_ranks[:, i] == full_rank[i])),
            "rank_p05": float(np.percentile(boot_ranks[:, i], 5)),
            "rank_p95": float(np.percentile(boot_ranks[:, i], 95)),
        }
        for i, g in enumerate(groups)
    }

    out = {
        "n": int(n),
        "groups": groups,
        "importance": importance,
        "model_agreement": model_agreement,
        "bootstrap": bootstrap,
        "bootstrap_resamples": N_BOOT,
        "seed": SEED,
        "note": NOTE,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    m = json.loads(Path("models/metrics.json").read_text(encoding="utf-8"))
    m["shap"] = out
    Path("models/metrics.json").write_text(
        json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"test click view n={n:,}")
    print(f"\n{'segment':<34}{'group':<14}{'mean|phi|':>10}{'pct':>9}")
    print("-" * 67)
    for seg, row in importance.items():
        for g, v in row.items():
            print(f"{seg[:32]:<34}{g:<14}{v['mean_abs']:>10.3f}{v['pct_equiv']:>8.1f}%")
    print("\nmodel agreement (Spearman, __default__ group importances)")
    for k, v in model_agreement.items():
        print(f"{k:<28}{v:>8.3f}")
    print(f"\nbootstrap ({N_BOOT} resamples, seed {SEED})")
    print(f"{'group':<14}{'rank':>6}{'share same':>12}{'p05':>7}{'p95':>7}")
    for g, v in bootstrap.items():
        print(f"{g:<14}{v['rank']:>6}{v['share_same_rank']:>12.3f}"
              f"{v['rank_p05']:>7.1f}{v['rank_p95']:>7.1f}")
    print(f"\nwrote {OUT} and models/metrics.json[\"shap\"]")


if __name__ == "__main__":
    main()
