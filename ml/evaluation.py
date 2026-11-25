"""Evaluation statistics for asking-price models.

IAAO ratio statistics (International Association of Assessing Officers):
- median_ratio: the median of predicted/actual; the central tendency, with the
  IAAO acceptable range 0.90-1.10.
- COD (coefficient of dispersion): mean absolute deviation of the ratios from the
  median, as a percent of the median; uniformity, with an acceptable residential
  value of 15 or less.
- PRD (price-related differential): mean ratio divided by the aggregate ratio;
  a regressivity check, with an acceptable range of 0.98-1.03.

Split conformal prediction bounds follow Angelopoulos & Bates (2023), "Conformal
Prediction: A Gentle Introduction".
"""
from __future__ import annotations

import math

import numpy as np


def iaao(pred: np.ndarray, actual: np.ndarray) -> dict:
    pred = np.asarray(pred, dtype=float)
    actual = np.asarray(actual, dtype=float)
    r = pred / actual
    median_ratio = float(np.median(r))
    cod = 100 * float(np.mean(np.abs(r - median_ratio))) / median_ratio
    prd = float(np.mean(r)) / (float(pred.sum()) / float(actual.sum()))
    return {"median_ratio": median_ratio, "COD": cod, "PRD": prd, "n": int(len(r))}


def coverage(actual: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> float:
    actual = np.asarray(actual, dtype=float)
    inside = (actual >= np.asarray(lower, dtype=float)) & (actual <= np.asarray(upper, dtype=float))
    return 100 * float(np.mean(inside))


def conformal_ratio_bounds(ratio: np.ndarray, lo: float = 0.10, hi: float = 0.90) -> tuple[float, float]:
    """Finite-sample split conformal bounds on the ratio (Angelopoulos & Bates, 2023)."""
    ratio = np.asarray(ratio, dtype=float)
    n = len(ratio)
    lo_level = min(max(math.floor((n + 1) * lo) / n, 0.0), 1.0)
    hi_level = min(max(math.ceil((n + 1) * hi) / n, 0.0), 1.0)
    return (
        float(np.quantile(ratio, lo_level, method="lower")),
        float(np.quantile(ratio, hi_level, method="higher")),
    )
