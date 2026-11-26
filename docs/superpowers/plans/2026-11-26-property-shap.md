# Per-Property SHAP Explanation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every estimate explains itself. The panel shows which factor groups push this property's price up or down. The README gets a global SHAP summary with a stability check for thesis Ch.4.

**Architecture:** `ml/explain.py` computes native SHAP for each of the three models and blends them with the served weights (0.8/0.1/0.1) in log-price-per-sqm space. It then sums the features into 6 factor groups. `api.py` returns an `explanation` object. `ml/shap_report.py` scores the test fold, writes `models/shap_metrics.json` and merges it into `metrics.json["shap"]`. The panel renders a group bar list and an expandable top-features list.

**Tech Stack:** CatBoost 1.2.10 `get_feature_importance(type="ShapValues")`, LightGBM 4.7 `predict(pred_contrib=True)`, XGBoost 3.4 `Booster.predict(DMatrix(..., enable_categorical=True), pred_contribs=True)`. Do not add the `shap` package. Frontend is React and Tailwind.

**Spec:** The user's answers on 2026-11-26:
- Blend all 3 models by weight.
- Present the explanation as factor groups.
- Also produce a global Ch.4 summary with stability.
- Thesis Ch.3 lists "เสถียรภาพของค่าความสำคัญ SHAP" as a WQS ingredient.

## Global Constraints

- Groups (key: features). Every one of the 43 features in `prepare_data.FEATURES` belongs to exactly one group:
  - `location`: province, district, sub_district, province_ppsqm, district_ppsqm, dt_ppsqm, dt_n, dt_iqr, sd_ppsqm, sd_n, latitude, longitude, transit_m, geo1_ppsqm, geo1_n, geo2_ppsqm, geo2_n, knn_ppsqm, knn_dist_m
  - `comparables`: band_ppsqm, band_n, comp_ppsqm, comp_n, comp_age, comp_gap, comp2_ppsqm, comp2_n, nn_ppsqm, nn_dist
  - `size`: area_sqm, log_area, area_per_unit, n_units
  - `unit`: bedrooms, bathrooms, building_age
  - `type_project`: collateral_type, type_ppsqm, prov_type_ppsqm, estate, proj_ppsqm, proj_n
  - `time`: year
- SHAP is in log price-per-sqm units, which is the model target.
- The ensemble SHAP is `Σ_m w_m · φ_m` and the ensemble base is `Σ_m w_m · base_m`, using the bundle's `weights`.
- A group's effect shown to users is `pct = (exp(φ_g) - 1) · 100`, rounded to 1 dp.
- `other_pct = (exp(log(price/area) - base - Σφ) - 1) · 100`. It is what the geometric blend and the estate adjustment leave unexplained.
- Run Python as `.venv/Scripts/python.exe -X utf8` from `ml/`. Do not add a dependency.
- Do not start, stop or kill servers. The controller restarts the API.
- New UI strings need i18n keys in th, en and zh.

## Review Focus

1. Per-model additivity: for each model, `base + Σφ` must equal that model's own log prediction within 1e-3. (Task 1 test.)
2. A row with unknown location (a dropdown request with no lat/lng): the explanation is still finite, with no NaN in the JSON. (Task 2 test.)
3. The estate "out" adjustment: it shows up in `other_pct`, not silently in a group. (Task 2 test.)
4. API latency: one explanation adds under 300 ms on this machine. Measure and report it in Task 2.
5. A missing `explanation` in an old API response: the panel hides the section. (Task 4.)

---

### Task 1: `ml/explain.py`

**Files:** Create `ml/explain.py` and `ml/test_explain.py`.

**Interfaces (produces):**
- `GROUPS: dict[str, list[str]]`, as in Global Constraints, in that key order.
- `shap_each(bundle: dict, featured: pd.DataFrame) -> dict[str, tuple[np.ndarray, np.ndarray]]` maps a model name to `(phi of shape n×F in FEATURES order, base of shape n)`.
  - CatBoost uses `X_raw = featured[FEATURES]` and `Pool(X_raw, cat_features=CATEGORICAL)`.
  - LightGBM and XGBoost use `train_models.as_categorical(X_raw, bundle["categories"])`.
  - The last column of each native output is the base.
- `ensemble_shap(bundle, featured) -> tuple[np.ndarray, np.ndarray]` returns the weighted phi and base.
- `group_shap(phi: np.ndarray) -> pd.DataFrame` returns n rows with one column per group key, summing the FEATURES columns.

- [ ] **Step 1:** Write tests in `ml/test_explain.py`. Use its own module fixture that loads `models/ensemble.joblib`. Build a 3-row frame the way `test_pipeline._ensemble_members` does: a Bangkok condo click, a house given by sub-district only (lat/lng NaN), and a land plot. Run it through `add_features(frame, bundle["reference"])`.
  - `test_groups_partition_features`: the union of the groups equals `set(FEATURES)` and no feature appears twice.
  - `test_each_model_is_additive`: for every model, `base + phi.sum(1)` is close to `model.predict(...)` (log ppsqm) with `atol=1e-3`.
  - `test_ensemble_is_weighted_sum`: the result equals `Σ w·φ_m` and `Σ w·base_m`.
  - `test_group_shap_sums_to_total`: the group columns sum to `phi.sum(1)`.
  - `test_unknown_location_is_finite`: every value is finite.
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run `test_explain.py` and the full pytest. Expected: PASS (the baseline is 69 passed, 1 skipped).
- [ ] **Step 3:** Commit with the message `feat(ml): per-property SHAP for the three-model blend, grouped by factor`.

### Task 2: `explanation` in `/api/predict`

**Files:** Modify `ml/api.py`, `ml/test_pipeline.py` and `src/lib/api.ts`.

**Interfaces:**
- The response field is `"explanation"` with this shape:
  - `base_price`: float, `round(exp(base) * area, -3)`.
  - `groups`: one entry per group key, sorted by `|log|` descending. Each is `{"key": str, "log": float 4dp, "pct": float 1dp}`.
  - `other_pct`: float, 1 dp.
  - `top_features`: the 5 largest `|φ|` features. Each is `{"key", "label", "icon", "pct"}`, where label and icon come from the existing `FEATURE_LABELS` (fallback: the key and "MapPin").
- Compute the explanation from the same `featured` row as the prediction. `price` is the final price after the estate adjustment.
- TS: `export interface Explanation {...}` and `explanation?: Explanation | null` on `ApiPrediction`.

- [ ] **Step 1:** Write the tests in the `client` class of `ml/test_pipeline.py`:
  - `test_predict_explains_itself`: 6 groups with the expected keys, sorted by |log|, 5 top_features, everything finite. Also check that `base_price * Π(1+pct/100) * (1+other_pct/100)` is within 2% of `predictedPrice`; the 2% covers rounding.
  - `test_dropdown_explanation_is_finite`: send `subdistrictId` "103301" and no lat.
  - `test_estate_out_lands_in_other`: the same house with `estate: "out"` and with no estate. The group logs are identical, and `other_pct` differs.
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run the full pytest, `npm test` and `npm run build`. Expected: all pass.
- [ ] **Step 3:** Measure the latency of 20 `/api/predict` calls through the test client, with and without the explanation. Put both medians in the report.
- [ ] **Step 4:** Commit with the message `feat(api): per-property explanation with every prediction`.

### Task 3: Global SHAP summary for Ch.4

**Files:** Create `ml/shap_report.py`. Modify `ml/models/metrics.json` and `ml/README.md`. Create `ml/models/shap_metrics.json` (generated).

**Interfaces:**
- `ml/shap_report.py` reads the test fold, click view (`app_views(test, bundle["reference"])["click"]`, as calibrate.py does) and writes `models/shap_metrics.json` with:
  - `importance[segment][group]`: the mean `|φ_g|` in log units, plus `pct_equiv = (exp(mean|φ_g|)-1)·100`. Segments are `__default__` plus each property type with ≥ 200 rows.
  - `model_agreement`: the Spearman rank correlation of `__default__` group importances between each pair of models (CatBoost–LightGBM, CatBoost–XGBoost, LightGBM–XGBoost). Use per-model φ and group importances.
  - `bootstrap`: 200 resamples of test rows with seed 42. For each group, report the share of resamples in which it holds its full-sample rank, and the rank's 5th–95th percentile.
  - `n` and a `note`.
- Merge the same object into `metrics.json["shap"]`.
- Ruling: stability is measured as agreement across the three models plus bootstrap rank stability on the test fold. It is not measured across refitted CV folds, because re-running cv.py costs about 45 minutes. The README says so.

- [ ] **Step 1:** Implement the script. Reuse `explain.shap_each`, `explain.ensemble_shap` and `explain.group_shap`. Run it and print the tables.
- [ ] **Step 2:** Add a test `test_shap_metrics_shape` in `ml/test_explain.py`. It loads `models/shap_metrics.json` and asserts:
  - all 6 groups are present in `__default__`
  - the correlations are in [-1, 1]
  - the bootstrap shares are in [0, 1]
- [ ] **Step 3:** Add an "## Explaining each estimate (SHAP)" section to `ml/README.md`, placed after the Three-way decision section. It covers the method, the group table, the per-type importance table, model agreement, bootstrap stability, and hedged reading. Copy every number from `shap_metrics.json`.
- [ ] **Step 4:** Commit with the message `feat(ml): global SHAP importance and stability for the test fold`.

### Task 4: Panel section

**Files:** Modify `src/components/PricePanel.jsx` and `src/i18n.jsx`.

- i18n keys (th / en / zh):
  - `explainTitle`: ปัจจัยที่มีผลต่อราคานี้ / What drives this estimate / 影响此估价的因素
  - `explainBase`: ราคาตั้งต้น (ค่ากลางของโมเดล) / Starting point (model average) / 起点（模型平均）
  - `explainOther`: ผลจากการรวมโมเดลและปรับหมู่บ้าน / Blending and estate adjustment / 模型融合与小区调整
  - `explainDetail`: ตัวแปรที่มีผลมากที่สุด / Strongest single factors / 影响最大的单项因素
  - `explainNote`: SHAP บอกว่าโมเดลใช้อะไร ไม่ใช่เหตุและผล / SHAP shows what the model used, not cause and effect / SHAP 显示模型依据，并非因果关系
  - `groupLocation`: ทำเล / Location / 地段
  - `groupComparables`: ทรัพย์เทียบเคียงขนาดเดียวกัน / Same-size comparables / 同面积可比
  - `groupSize`: ขนาด / Size / 面积
  - `groupUnit`: ห้องและอายุอาคาร / Rooms and building age / 房间与楼龄
  - `groupType_project`: ประเภทและโครงการ / Type and project / 类型与项目
  - `groupTime`: ปีที่ประกาศ / Listing year / 挂牌年份
  - Map group key to i18n key with an explicit object: `{location:'groupLocation', comparables:'groupComparables', size:'groupSize', unit:'groupUnit', type_project:'groupType_project', time:'groupTime'}`.
- New `Section` titled `explainTitle`, with lucide icon `BarChart3`. Place it after the Comparables section. Render it only when `result.explanation` is set.
  - The first line is `explainBase` with `fmtBaht(base_price)`.
  - Then one row per group: label, a diverging bar centred at 50%, and the signed `pct` (`+12.3%` / `−4.0%`, tabular-nums).
    - Bar width is `min(50, |pct| / maxAbsPct * 50)%`.
    - A positive effect is `bg-[#DC2626]/60` and grows right from the centre. A negative effect is `bg-ink-muted/50` and grows left.
  - Then an `other_pct` row in muted text.
  - A `<details>` with summary `explainDetail` lists the `top_features` labels and signed pct.
  - The footer is `explainNote` in `text-[11px] text-ink-muted`.
- No horizontal scroll at 360px. Decorative icons are `aria-hidden`.
- [ ] **Step 1:** Implement the section. Then run `npm test` and `npm run build`. Expected: both pass.
- [ ] **Step 2:** Commit with the message `feat: per-property explanation in the price panel`.
