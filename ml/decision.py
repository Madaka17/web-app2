"""Quality score and three-way decision for asking-price predictions.

WQS-lite: a weighted quantile sum in the spirit of Yao (2010), reduced to an
equal-weight mean of four components, each in [0, 1]:
- agreement: how closely the per-model prices agree, relative to the ensemble.
- local / size / district: how many comparable sales back the estimate, on a
  log scale that saturates at DEPTH_FULL comparables.

Decision thresholds (alpha for accept, beta for reject) are fitted on the
calibration fold only, so the held-out evaluation stays untouched. A group is
accepted when its within-20% rate reaches ACCEPT_HIT and rejected when it stays
at or below REJECT_HIT; each group must hold at least MIN_SHARE of the rows.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SPREAD_FULL = 0.30
DEPTH_FULL = 30
ACCEPT_HIT = 80.0
REJECT_HIT = 50.0
MIN_SHARE = 0.05

_DEPTH_COLUMNS = {"local": "sd_n", "size": "band_n", "district": "dt_n"}


def _depth(values: np.ndarray) -> np.ndarray:
    return np.minimum(1.0, np.log1p(values) / np.log1p(DEPTH_FULL))


def components(
    per_model: dict[str, np.ndarray], ensemble: np.ndarray, featured: pd.DataFrame
) -> pd.DataFrame:
    """Four score components per row, each in [0, 1].

    `ensemble` must be positive and finite: the spread is divided by it.
    """
    stacked =np.vstack([np.asarray(p, dtype=float) for p in per_model.values()])
    ens = np.asarray(ensemble, dtype=float)
    spread = (stacked.max(axis=0) - stacked.min(axis=0)) / ens
    out = {"agreement": np.clip(1.0 - spread / SPREAD_FULL, 0.0, 1.0)}
    for name, column in _DEPTH_COLUMNS.items():
        out[name] = _depth(featured[column].to_numpy(dtype=float))
    return pd.DataFrame(out, index=featured.index)[["agreement", "local", "size", "district"]]


def wqs(comp: pd.DataFrame) -> np.ndarray:
    return comp[["agreement", "local", "size", "district"]].mean(axis=1).to_numpy()


def _within20(ape: np.ndarray, mask: np.ndarray) -> float:
    if not mask.any():
        return 0.0
    return 100.0 * float(np.mean(ape[mask] <= 20.0))


def fit_thresholds(score: np.ndarray, ape: np.ndarray) -> dict:
    score = np.asarray(score, dtype=float)
    ape = np.asarray(ape, dtype=float)
    if len(score) == 0:
        return {"alpha": None, "beta": None, "n": 0}
    candidates = np.unique(np.quantile(score, np.linspace(0.01, 0.99, 99)))

    alpha = None
    for c in candidates:
        mask = score >= c
        if mask.mean() >= MIN_SHARE and _within20(ape, mask) >= ACCEPT_HIT:
            alpha = float(c)
            break

    beta = None
    for c in candidates[::-1]:
        if alpha is not None and not c < alpha:
            continue
        mask = score < c
        if mask.mean() >= MIN_SHARE and _within20(ape, mask) <= REJECT_HIT:
            beta = float(c)
            break

    return {"alpha": alpha, "beta": beta, "n": int(len(score))}


def decide(score: np.ndarray, alpha: float | None, beta: float | None) -> np.ndarray:
    score = np.asarray(score, dtype=float)
    labels = np.full(len(score), "defer", dtype=object)
    accept = np.zeros(len(score), dtype=bool) if alpha is None else score >= alpha
    reject = np.zeros(len(score), dtype=bool) if beta is None else score < beta
    labels[reject & ~accept] = "reject"
    labels[accept] = "accept"
    return labels


def screening(labels: np.ndarray, pred: np.ndarray, actual: np.ndarray) -> dict:
    labels = np.asarray(labels, dtype=object)
    pred = np.asarray(pred, dtype=float)
    actual = np.asarray(actual, dtype=float)
    ape = np.abs(pred - actual) / actual * 100.0
    total = len(labels)
    report = {}
    for label in dict.fromkeys(labels.tolist()):
        mask = labels == label
        report[label] = {
            "n": int(mask.sum()),
            "share_pct": 100.0 * float(mask.sum()) / total,
            "MdAPE": float(np.median(ape[mask])),
            "within_20pct": 100.0 * float(np.mean(ape[mask] <= 20.0)),
        }
    return report
