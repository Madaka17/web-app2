from __future__ import annotations

import json

import numpy as np
import pandas as pd

from decision import (
    ACCEPT_HIT,
    DEPTH_FULL,
    MIN_SHARE,
    REJECT_HIT,
    SPREAD_FULL,
    components,
    decide,
    fit_thresholds,
    screening,
    wqs,
)


def _featured(sd=0.0, band=0.0, dt=0.0, n=1) -> pd.DataFrame:
    return pd.DataFrame({
        "sd_n": [float(sd)] * n,
        "band_n": [float(band)] * n,
        "dt_n": [float(dt)] * n,
    })


def test_constants_match_spec():
    assert SPREAD_FULL == 0.30
    assert DEPTH_FULL == 30
    assert ACCEPT_HIT == 80.0
    assert REJECT_HIT == 50.0
    assert MIN_SHARE == 0.05


def test_agreement_is_one_when_models_agree_and_zero_at_full_spread():
    ens = np.array([100.0])
    agree = components({"a": np.array([100.0]), "b": np.array([100.0])}, ens, _featured())
    assert agree["agreement"].iloc[0] == 1.0

    # spread = (130 - 100) / 100 = 0.30 -> full spread -> agreement 0.0
    full = components({"a": np.array([100.0]), "b": np.array([130.0])}, ens, _featured())
    assert full["agreement"].iloc[0] == 0.0

    # spread 0.15 -> halfway -> agreement 0.5
    half = components({"a": np.array([100.0]), "b": np.array([115.0])}, ens, _featured())
    assert abs(half["agreement"].iloc[0] - 0.5) < 1e-9


def test_components_have_expected_columns():
    comp = components({"a": np.array([100.0])}, np.array([100.0]), _featured())
    assert list(comp.columns) == ["agreement", "local", "size", "district"]


def test_depth_components_saturate_at_30_and_are_zero_for_empty():
    ens = np.array([100.0])
    pm = {"a": np.array([100.0])}

    empty = components(pm, ens, _featured(sd=0, band=0, dt=0))
    assert empty["local"].iloc[0] == 0.0
    assert empty["size"].iloc[0] == 0.0
    assert empty["district"].iloc[0] == 0.0

    at_full = components(pm, ens, _featured(sd=30, band=30, dt=30))
    assert at_full["local"].iloc[0] == 1.0
    assert at_full["size"].iloc[0] == 1.0
    assert at_full["district"].iloc[0] == 1.0

    beyond = components(pm, ens, _featured(sd=300, band=300, dt=300))
    assert beyond["local"].iloc[0] == 1.0


def test_wqs_is_mean_of_four_components_in_unit_range():
    comp = pd.DataFrame({
        "agreement": [1.0, 0.0],
        "local": [0.5, 0.0],
        "size": [0.5, 1.0],
        "district": [0.0, 1.0],
    })
    score = wqs(comp)
    assert isinstance(score, np.ndarray)
    assert np.allclose(score, [0.5, 0.5])
    assert np.all((score >= 0.0) & (score <= 1.0))


def test_fit_thresholds_accept_group_meets_target():
    # score uniform 0..1, ape = 40 * (1 - score): within-20 means ape <= 20, i.e. score >= 0.5
    score = np.linspace(0.0, 1.0, 1001)
    ape = 40.0 * (1.0 - score)
    result = fit_thresholds(score, ape)

    assert result["n"] == 1001
    assert result["alpha"] is not None
    # smallest cut where accepted within-20 reaches 80%: 0.38 (0.37 gives 79.4%)
    assert abs(result["alpha"] - 0.38) < 1e-6
    assert np.mean(ape[score >= 0.37] <= 20.0) * 100 < ACCEPT_HIT

    accepted = score >= result["alpha"]
    assert accepted.mean() >= MIN_SHARE
    assert np.mean(ape[accepted] <= 20.0) * 100 >= ACCEPT_HIT

    # largest candidate below alpha that still holds >= 5% of rows
    assert result["beta"] is not None
    assert abs(result["beta"] - 0.37) < 1e-6


def test_fit_thresholds_returns_none_when_target_unreachable():
    score = np.linspace(0.0, 1.0, 200)
    ape = np.full_like(score, 50.0)
    result = fit_thresholds(score, ape)

    assert result["alpha"] is None
    labels = decide(score, result["alpha"], result["beta"])
    assert "accept" not in set(labels)
    assert json.loads(json.dumps(result)) == result


def test_decide_three_way_boundaries():
    assert list(decide(np.array([0.1, 0.5, 0.9]), alpha=0.8, beta=0.3)) == [
        "reject",
        "defer",
        "accept",
    ]
    # boundaries: score == alpha is accept, score == beta is defer
    assert list(decide(np.array([0.8, 0.3]), alpha=0.8, beta=0.3)) == ["accept", "defer"]


def test_decide_with_none_thresholds_defers_everything():
    labels = decide(np.array([0.1, 0.5, 0.9]), alpha=None, beta=None)
    assert list(labels) == ["defer", "defer", "defer"]


def test_screening_reports_each_present_label():
    labels = np.array(["accept", "accept", "defer", "reject"])
    pred = np.array([110.0, 90.0, 150.0, 50.0])
    actual = np.array([100.0, 100.0, 100.0, 100.0])
    # ape = 10, 10, 50, 50

    report = screening(labels, pred, actual)

    assert set(report) == {"accept", "defer", "reject"}
    assert report["accept"]["n"] == 2
    assert report["accept"]["share_pct"] == 50.0
    assert report["accept"]["MdAPE"] == 10.0
    assert report["accept"]["within_20pct"] == 100.0

    assert report["defer"]["share_pct"] == 25.0
    assert report["defer"]["MdAPE"] == 50.0
    assert report["defer"]["within_20pct"] == 0.0

    assert report["reject"]["share_pct"] == 25.0
    assert report["reject"]["within_20pct"] == 0.0

    assert sum(v["share_pct"] for v in report.values()) == 100.0


def test_screening_omits_labels_not_present():
    report = screening(
        np.array(["accept", "accept"]),
        np.array([100.0, 100.0]),
        np.array([100.0, 100.0]),
    )
    assert set(report) == {"accept"}


def test_fit_thresholds_alpha_none_when_only_qualifying_group_is_under_share_gate():
    # only the top 3% of rows are within 20%; any group holding >= 5% of rows
    # has at most 60% within-20, so no candidate reaches 80% with the share gate met
    score = np.linspace(0.0, 1.0, 1000)
    ape = np.where(score >= 0.97, 5.0, 50.0)
    result = fit_thresholds(score, ape)
    assert result["alpha"] is None


def test_fit_thresholds_beta_none_when_low_scores_are_accurate():
    # every row is within 20%, so no low-score group can sit at or below 50% within-20
    score = np.linspace(0.0, 1.0, 1000)
    ape = np.full_like(score, 10.0)
    result = fit_thresholds(score, ape)
    assert result["alpha"] is not None
    assert result["beta"] is None


def test_fit_thresholds_empty_input_returns_none_thresholds():
    result = fit_thresholds(np.array([]), np.array([]))
    assert result == {"alpha": None, "beta": None, "n": 0}
