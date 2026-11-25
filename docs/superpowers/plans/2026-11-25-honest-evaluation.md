# Honest Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the thesis numbers a committee cannot call leaky: a price range calibrated on its own fold (split conformal) with measured coverage, spatial and temporal cross-validation, and IAAO ratio statistics, all reported through `models/metrics.json` and `/api/metrics`.

**Architecture:** A new pure-function module `ml/evaluation.py` holds the statistics (IAAO, coverage, conformal bounds, CV splits). `prepare_data.py` gains a `cal` fold and two bookkeeping columns. `train_models.py` keeps `cal` out of the served model, `calibrate.py` fits the range on `cal` and scores it on `test`, and a new `ml/cv.py` runs spatial and temporal CV with the full ensemble.

**Tech Stack:** Python 3.14 venv (`ml/.venv`), pandas, numpy, scikit-learn (`GroupKFold`), CatBoost / LightGBM / XGBoost, pytest, Flask API.

**Spec:** Decisions taken in chat on 2026-11-25 (no separate doc):
1. Spatial CV: `GroupKFold`, 5 folds, grouped by sub-district.
2. Temporal CV: hold out the latest 90 days by `date_posted`; hipflat rows excluded (they carry the scrape date, not a posting date).
3. Retrain the served model with a separate calibration fold: fit / val / cal / test. Range = split-conformal 10th/90th percentile of actual/predicted per property type, measured on `cal` with the served model; empirical coverage reported on `test`.
4. CV folds train the full CatBoost + LightGBM + XGBoost ensemble.

## Global Constraints

- Run everything from `e:\web-app2-main\web-app2\ml` with `.venv/Scripts/python.exe`.
- Training data: the 2026-11-04 scrape at `C:\Users\user\Desktop\web-app2-thesis\data\raw\{baania,ddproperty,dotproperty,hipflat}_listings.csv`, copied into `e:\web-app2-main\web-app2\Data\` (gitignored by `Data/*.csv`). Do not commit CSVs.
- The `test` fold must contain exactly the same rows as before this change (same seed 42, same `u < 0.20` rule). `val` keeps `0.20 <= u < 0.30`. `cal` is new: `0.30 <= u < 0.40`.
- Interval level stays 80% (q10 / q90), per property type, `__default__` fallback for types with fewer than 200 rows, same dict shape the API reads (`q10`, `q90` keys under `bundle["calibration"]` and `bundle["calibration_dropdown"]`).
- IAAO ratio = predicted / actual (assessment / sale). COD and PRD as defined in Task 1.
- CV ensemble weights: fixed to the served bundle's weights (`bundle["weights"]`, currently 0.8 / 0.1 / 0.1). No weight search inside CV folds.
- Existing 39 tests in `test_pipeline.py` keep passing.
- Commit messages: conventional prefix, end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `feat/land-only-map` (current).

## Review Focus

1. Rows with sub-district `"ไม่ระบุ"` (NO_SUBDISTRICT) must not form one giant spatial group; they group by district instead. Test in Task 3.
2. A sub-district name that repeats in two districts is two groups, not one (group key includes province + district). Test in Task 3.
3. The served refit must exclude both `cal` and `test` rows, or the conformal range is fitted on rows the model learned from. Test in Task 2.
4. Temporal holdout with hipflat rows present: hipflat rows appear in neither train nor holdout. Test in Task 3.
5. Conformal bounds on a tiny calibration set (n < 10) must still return finite bounds inside the observed ratios (clip the finite-sample quantile level to [0, 1]). Test in Task 1.

---

### Task 1: Evaluation statistics module

**Files:**
- Create: `ml/evaluation.py`
- Test: `ml/test_evaluation.py`

**Interfaces:**
- Produces:
  - `iaao(pred: np.ndarray, actual: np.ndarray) -> dict` with keys `median_ratio`, `COD`, `PRD`, `n`.
  - `coverage(actual: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> float` (percent, 0-100, inclusive bounds).
  - `conformal_ratio_bounds(ratio: np.ndarray, lo: float = 0.10, hi: float = 0.90) -> tuple[float, float]`.

- [ ] **Step 1: Install pytest in the venv** (not in `requirements.txt`; dev only)

Run: `.venv/Scripts/python.exe -m pip install -q pytest`
Expected: exits 0.

- [ ] **Step 2: Write the failing tests in `ml/test_evaluation.py`**

```python
import numpy as np
from evaluation import conformal_ratio_bounds, coverage, iaao

def test_iaao_perfect_prediction():
    a = np.array([1e6, 2e6, 3e6])
    m = iaao(a.copy(), a)
    assert m["median_ratio"] == 1.0 and m["COD"] == 0.0 and m["PRD"] == 1.0 and m["n"] == 3

def test_iaao_known_values():
    pred, actual = np.array([90., 110., 100., 120.]), np.array([100.] * 4)
    m = iaao(pred, actual)
    assert m["median_ratio"] == 1.05
    assert np.isclose(m["COD"], 100 * np.mean(np.abs(pred / actual - 1.05)) / 1.05)
    assert np.isclose(m["PRD"], np.mean(pred / actual) / (pred.sum() / actual.sum()))

def test_coverage_inclusive_bounds():
    assert coverage(np.array([1., 2., 3., 4.]), np.array([1., 1., 1., 1.]), np.array([3., 3., 3., 3.])) == 75.0

def test_conformal_bounds_finite_sample_levels():
    ratio = np.arange(1, 101) / 100          # 0.01 .. 1.00, n = 100
    lo, hi = conformal_ratio_bounds(ratio)
    # levels floor(101*0.10)/100 = 0.10 and ceil(101*0.90)/100 = 0.91, method "higher"/"lower"
    assert lo == np.quantile(ratio, 0.10, method="lower")
    assert hi == np.quantile(ratio, 0.91, method="higher")

def test_conformal_bounds_tiny_sample_stay_inside_data():
    ratio = np.array([0.8, 1.0, 1.2])
    lo, hi = conformal_ratio_bounds(ratio)
    assert 0.8 <= lo <= hi <= 1.2
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest test_evaluation.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'evaluation'`.

- [ ] **Step 4: Implement `ml/evaluation.py`**

- `iaao`: `r = pred / actual`; `median_ratio = median(r)`; `COD = 100 * mean(|r - median_ratio|) / median_ratio`; `PRD = mean(r) / (sum(pred) / sum(actual))`. Module docstring: one sentence each on what the three mean and the IAAO acceptable ranges (median ratio 0.90-1.10, COD residential ≤ 15, PRD 0.98-1.03).
- `conformal_ratio_bounds`: with `n = len(ratio)`, lower level `floor((n + 1) * lo) / n`, upper level `ceil((n + 1) * hi) / n`, both clipped to `[0, 1]`; `np.quantile(..., method="lower")` for the lower bound and `method="higher"` for the upper. Docstring cites split conformal (Angelopoulos & Bates, 2023).

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest test_evaluation.py -q`
Expected: `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add ml/evaluation.py ml/test_evaluation.py
git commit -m "feat(ml): add IAAO, coverage and split-conformal helpers"
```

---

### Task 2: Calibration fold, served model and calibrated range

**Files:**
- Modify: `ml/prepare_data.py` (`FOLD_FRACTIONS`, `assign_folds`, `split`, `load_raw` return frame)
- Modify: `ml/train_models.py` (`main`: serving refit rows; record `cal` in `protocol`)
- Modify: `ml/calibrate.py` (fit range on `cal`, score on `test`)
- Test: `ml/test_pipeline.py` (add tests to the existing file)

**Interfaces:**
- Consumes: `iaao`, `coverage`, `conformal_ratio_bounds` from Task 1.
- Produces:
  - `assign_folds(df) -> pd.Series` with values `"fit" | "val" | "cal" | "test"`.
  - `split(df) -> (train, test)`; `train["fold"]` in `{"fit", "val", "cal"}`.
  - `load_raw()` frame gains `source: str` (one of `SOURCES`) and `posted: pd.Timestamp` (UTC, parsed `date_posted`). Neither is in `FEATURES`.
  - `serve_rows(train: pd.DataFrame) -> pd.DataFrame` in `train_models.py`: `train[train.fold != "cal"]`.
  - `calibrate.py` writes, per view key (`calibration`, `calibration_dropdown`), the per-type dict with keys `n, q10, q90, median_ratio, MdAPE, within_20pct` (q10/q90 now from `conformal_ratio_bounds` on `cal`), and adds to `metrics.json` a `test_coverage` dict per view: `{type: {"n", "coverage_pct", "nominal_pct": 80.0, **iaao(...)}}` including `__default__`.

- [ ] **Step 1: Write failing tests (append to `test_pipeline.py`)**

```python
def test_cal_fold_leaves_test_rows_unchanged(sample_years):
    fold = assign_folds(sample_years)
    u = np.random.default_rng(FOLD_SEED).random((sample_years.year.isin(TEST_YEARS)).sum())
    assert (fold[sample_years.year.isin(TEST_YEARS)].to_numpy() == "test").sum() == (u < 0.20).sum()
    assert set(fold.unique()) <= {"fit", "val", "cal", "test"}
    assert (fold == "cal").sum() == ((u >= 0.30) & (u < 0.40)).sum()

def test_serve_rows_exclude_cal_and_test(sample_years):
    train, test = split(sample_years)
    served = serve_rows(train)
    assert "cal" not in set(served.fold) and len(served) + (train.fold == "cal").sum() == len(train)
```

`sample_years`: a new module fixture — 1,000 synthetic rows, `year` 2569 for 900 rows and 2568 for 100, other columns copied from the existing `sample` fixture pattern (only `year` matters to `assign_folds`). Import `assign_folds`, `FOLD_SEED` from `prepare_data` and `serve_rows` from `train_models`.

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest test_pipeline.py -q -k "cal_fold or serve_rows"`
Expected: FAIL (`serve_rows` import error / no `cal` fold).

- [ ] **Step 3: Implement**

- `prepare_data.py`: `FOLD_FRACTIONS = {"test": 0.20, "val": 0.10, "cal": 0.10}`; `assign_folds` assigns `cal` for `0.30 <= u < 0.40` with the same single `u` draw (so `test`/`val` are unchanged). Update the comment block above it: `cal` is held out from every model and only used to set the price range. `load_raw` adds `source` (the `src` loop variable, set before concat) and `posted` (the parsed UTC date) to the returned frame.
- `train_models.py`: add `serve_rows`; the refit block builds `serve_frame`/`serve_ref` from `serve_rows(train_all)`; `protocol` gains `"calibration": "10% of (2569,) rows, seed 42, never trained on; sets the price range"`; print line says "refitting on fit + validation rows (cal and test held out)".
- `calibrate.py`: build views from `train_all[train_all.fold == "cal"]` for the bounds (using `bundle["reference"]`), compute q10/q90 with `conformal_ratio_bounds` per type, then on the `test` views compute per-type `coverage(actual, pred*q10, pred*q90)` and `iaao(pred, actual)`; write both into the bundle and `metrics.json` (`calibration_note` rewritten: "split conformal: bounds from the calibration fold, coverage measured on the test fold"). Print a coverage table.

- [ ] **Step 4: Run all ml tests**

Run: `.venv/Scripts/python.exe -m pytest test_pipeline.py test_evaluation.py -q`
Expected: all pass (39 existing + 2 new + 5).

- [ ] **Step 5: Commit**

```bash
git add ml/prepare_data.py ml/train_models.py ml/calibrate.py ml/test_pipeline.py
git commit -m "feat(ml): hold out a calibration fold and fit the price range on it"
```

---

### Task 3: Spatial and temporal cross-validation script

**Files:**
- Modify: `ml/evaluation.py` (add split helpers)
- Modify: `ml/train_models.py` (`build_models(iterations: int = 2000)`)
- Create: `ml/cv.py`
- Test: `ml/test_evaluation.py`

**Interfaces:**
- Consumes: `load_raw`, `clean`, `split`, `build_training_frame`, `build_reference`, `NO_SUBDISTRICT` (prepare_data); `app_views`, `build_models`, `fit_all`, `predict_prices`, `as_categorical`, `metrics` (train_models); `iaao`, `coverage` (Task 1); the served bundle `models/ensemble.joblib` for `weights`, `categories` and `calibration` after Task 2 ran.
- Produces:
  - `spatial_groups(df: pd.DataFrame) -> np.ndarray` (str key per row: `province|district|sub_district`, or `province|district|*` when sub_district is `NO_SUBDISTRICT` or NaN).
  - `temporal_split(df: pd.DataFrame, days: int = 90) -> tuple[pd.DataFrame, pd.DataFrame]`: drops `source == "hipflat"`, cutoff = `max(posted) - days`, returns `(posted < cutoff, posted >= cutoff)`.
  - `cv.py` CLI: `python cv.py [--iterations N] [--folds 5] [--days 90]`; writes `models/cv_metrics.json` and merges it into `models/metrics.json` under key `"cv"`.

- [ ] **Step 1: Write failing tests (append to `test_evaluation.py`)**

```python
def test_spatial_groups_split_unknown_subdistrict_by_district():
    df = pd.DataFrame({"province": ["ก"] * 3, "district": ["A", "B", "A"],
                       "sub_district": ["ไม่ระบุ", "ไม่ระบุ", "x"]})
    g = spatial_groups(df)
    assert g[0] != g[1] and g[0] != g[2]

def test_spatial_groups_same_name_different_district():
    df = pd.DataFrame({"province": ["ก", "ก"], "district": ["A", "B"], "sub_district": ["x", "x"]})
    g = spatial_groups(df)
    assert g[0] != g[1]

def test_temporal_split_drops_hipflat_and_cuts_at_days():
    posted = pd.to_datetime(["2026-01-01", "2026-09-01", "2026-10-30", "2026-10-30"], utc=True)
    df = pd.DataFrame({"posted": posted, "source": ["baania", "ddproperty", "dotproperty", "hipflat"]})
    train, hold = temporal_split(df, days=90)
    assert list(train.source) == ["baania"] and list(hold.source) == ["ddproperty", "dotproperty"]
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest test_evaluation.py -q`
Expected: FAIL (`spatial_groups` not defined).

- [ ] **Step 3: Implement**

- `evaluation.py`: `spatial_groups`, `temporal_split` per the Interfaces block.
- `train_models.py`: `build_models(iterations: int = 2000)` passes `iterations` to all three (`iterations` / `n_estimators`). Default keeps current behaviour.
- `cv.py`: load + clean once; drop the `test` fold (`_, test = split(df)` is not used for CV — CV runs on `train` rows only, so the test fold stays untouched for the headline number). For each spatial fold (`GroupKFold(n_splits=folds)` on `spatial_groups(train)`) and for the temporal split: `fit_frame = build_training_frame(fit_rows)`, `ref = build_reference(fit_rows)`, `hold = app_views(holdout_rows, ref)["click"]`; train `build_models(iterations)` with `fit_all`, predict, blend with `bundle["weights"]`. Per fold and pooled over spatial folds, record `metrics(...)`, `iaao(...)`, and served-range coverage `coverage(actual, pred*q10, pred*q90)` using `bundle["calibration"]` per type (`__default__` fallback); also per-type pooled MdAPE / within_20pct / coverage. JSON shape: `{"spatial": {"folds": [...], "pooled": {...}, "by_type": {...}}, "temporal": {"cutoff": "YYYY-MM-DD", "train_rows", "holdout_rows", ...same metric keys}, "settings": {"folds", "days", "iterations", "weights", "group": "province|district|sub_district"}}`. Print one table per CV kind. Log per-fold wall time (`flush=True`).

- [ ] **Step 4: Run tests, then a smoke run**

Run: `.venv/Scripts/python.exe -m pytest test_evaluation.py test_pipeline.py -q`
Expected: all pass.
Run: `.venv/Scripts/python.exe cv.py --iterations 50 --folds 2 --days 90`
Expected: finishes, prints both tables, writes `models/cv_metrics.json` with keys `spatial`, `temporal`, `settings`. (Revert `models/metrics.json` / delete `cv_metrics.json` before committing — the real run is Task 4.)

- [ ] **Step 5: Commit**

```bash
git add ml/evaluation.py ml/train_models.py ml/cv.py ml/test_evaluation.py
git commit -m "feat(ml): spatial (by sub-district) and temporal cross-validation"
```

---

### Task 4: Full run, API check and README numbers

**Files:**
- Data (not committed): copy the four CSVs into `e:\web-app2-main\web-app2\Data\`
- Regenerated: `ml/models/ensemble.joblib`, `ml/models/metrics.json`, `ml/models/cv_metrics.json`
- Modify: `ml/README.md` ("Accuracy, measured honestly" section, "Retraining" commands, "Files" table)

**Interfaces:**
- Consumes: everything above; `/api/metrics` already returns the whole `metrics.json`, `/api/predict` reads `bundle["calibration"][type]["q10"/"q90"]`.

- [ ] **Step 1: Put the 2026-11-04 data in place and check row counts**

Copy the four `*_listings.csv` from the thesis folder into `web-app2/Data/`. Run `.venv/Scripts/python.exe prepare_data.py`.
Expected: prints train/test rows close to the thesis figures (≈134,634 clean rows; test ≈17,808). Stop and report if they differ by more than 1%.

- [ ] **Step 2: Retrain, calibrate, cross-validate** (long; run in background, log to `ml/train.log`, gitignored)

Run in order: `train_models.py` (~15-20 min), `calibrate.py`, `build_location_map.py`, `projects.py`, `cv.py` (~1-2 h).
Expected: each exits 0; `metrics.json` has `test_coverage` and `cv`; test-fold map-click R² / MdAPE printed by `train_models.py` are recorded for Step 4.

- [ ] **Step 3: Tests and live API**

Run: `.venv/Scripts/python.exe -m pytest -q` → all pass.
Restart the model API (stop the running `api.py` on port 3030 — ask the user if a process must be killed), then `curl -s http://127.0.0.1:3030/api/health` → `"status":"ok"`; `curl -s http://127.0.0.1:3030/api/metrics` contains `"test_coverage"` and `"cv"`; one `POST /api/predict` for a Bangkok condo click returns a price with `low < price < high`.

- [ ] **Step 4: Update `ml/README.md`**

Replace the accuracy section's protocol paragraph with the fit / val / cal / test description and add three tables with the real numbers from Step 2: (a) test fold, map click, overall + per type (R², MdAPE, ±20%, median ratio, COD, PRD); (b) range coverage on test per type vs nominal 80%; (c) spatial CV pooled and temporal holdout (same columns + coverage), with one sentence on what each answers (new location / future months). Add `cv.py` and `evaluation.py` to the Files table and `cv.py` to Retraining. Plain English, no claims the numbers do not support.

- [ ] **Step 5: Commit**

```bash
git add ml/README.md ml/models/ensemble.joblib ml/models/metrics.json ml/models/cv_metrics.json ml/models/location_map.json ml/models/projects.json
git commit -m "chore(ml): retrain with calibration fold, report coverage and CV results"
```
