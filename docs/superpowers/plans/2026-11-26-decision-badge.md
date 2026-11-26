# Three-Way Decision Badge (WQS-lite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each estimate carries a transparent quality score (WQS-lite) and a three-way decision (accept / defer to an appraiser / reject, after Yao 2010). The decision shows as a badge in the price panel, and map pins can be colored by it.

**Architecture:** A pure module `ml/decision.py` turns per-property signals into a score in [0, 1]. It also learns two thresholds per segment on the calibration fold and scores how well the classes separate on the test fold. `calibrate.py` stores the thresholds in the bundle and the screening report in `metrics.json`. `api.py` returns a `decision` object with every prediction. `ml/score_listings.py` runs the same API in process over `public/listings.json` and writes `public/decisions.json`. The map reads that file to color pins.

**Tech Stack:** Python 3 (numpy, pandas, Flask test client, pytest), React 18 + Vite + Tailwind, TypeScript lib code tested with Vitest.

**Spec:** The user's answers in this session, 2026-11-26. No separate spec file.
- The badge judges the reliability of the estimate, not whether the asking price is cheap.
- The score uses per-property signals only: model disagreement, comparable depth, and whether the district is known.
- Thresholds are learned on the cal fold. The target is that the accept group has within-±20% of at least 80%. Results are reported per class on the test fold.
- The badge shows in the price panel, and map pins are colored by decision.
- Thesis background: Ch.3 describes WQS feeding Yao's (2010) three-way decision with upper and lower thresholds, used together with conformal interval width.

## Global Constraints

- Decision labels (API, JSON, TS): exactly `"accept"`, `"defer"`, `"reject"`.
- Score components, equal weight, each in [0, 1]:
  - `agreement = clip(1 - spread / 0.30, 0, 1)`, where `spread = (max_i p_i - min_i p_i) / ensemble`.
  - `local = min(1, log1p(sd_n) / log1p(30))`.
  - `size = min(1, log1p(band_n) / log1p(30))`.
  - `district = min(1, log1p(dt_n) / log1p(30))`.
  - `score = mean of the four`.
- Threshold targets:
  - The accept group has within-±20% ≥ 80.0%.
  - The reject group has within-±20% ≤ 50.0%.
  - Each group holds at least 5% of the segment's rows.
- Segments are the calibration keys: per property type with ≥ 200 rows (`calibrate.MIN_ROWS`), plus `__default__`. Each view is handled separately: `"calibration"` for a map click and `"calibration_dropdown"` for the dropdown alone.
- Colors:
  - accept `#16a34a`
  - defer `#f59e0b`
  - reject `#DC2626`
  - unscored pin `#9ca3af`
- Run Python as `.venv/Scripts/python.exe -X utf8` from `ml/`.
- Never commit `Data/*.csv` or anything under `C:\Users\user\.cloudflared`.
- Do not start, stop or kill servers. The controller restarts the API.
- No new user-facing string without i18n keys in all three languages (th, en, zh) in `src/i18n.jsx`.

## Review Focus

1. Old bundle with no `"decision"` key: the API must still answer 200, with `"decision": null`. The panel then hides the badge. (Task 3 test.)
2. A segment where no threshold meets its target: `alpha` or `beta` is `None`. In that case nobody is accepted (or rejected) and the JSON stays valid, with no `Infinity`. (Task 1 test.)
3. `public/decisions.json` missing or failing to load: the map still loads its listings, and every pin's decision is `null`. (Task 4 test.)
4. A listing with no area, type "other", or a position outside coverage: the listing is skipped by `score_listings.py` and shown gray in decision mode. (Task 4 test.)
5. A dropdown prediction (no lat/lng): it uses the `"calibration_dropdown"` thresholds, not the click thresholds. (Task 3 test.)

---

### Task 1: `ml/decision.py` (pure functions)

**Files:**
- Create: `ml/decision.py`
- Test: `ml/test_decision.py`

**Interfaces:**
- Produces:
  - `SPREAD_FULL = 0.30`, `DEPTH_FULL = 30`, `ACCEPT_HIT = 80.0`, `REJECT_HIT = 50.0`, `MIN_SHARE = 0.05`
  - `components(per_model: dict[str, np.ndarray], ensemble: np.ndarray, featured: pd.DataFrame) -> pd.DataFrame` returns columns `agreement, local, size, district`. It reads `sd_n`, `band_n` and `dt_n` from `featured`.
  - `wqs(comp: pd.DataFrame) -> np.ndarray`: the row mean of the four columns.
  - `fit_thresholds(score: np.ndarray, ape: np.ndarray) -> dict` returns `{"alpha": float | None, "beta": float | None, "n": int}`.
  - `decide(score: np.ndarray, alpha: float | None, beta: float | None) -> np.ndarray`, an array of label strings.
  - `screening(labels: np.ndarray, pred: np.ndarray, actual: np.ndarray) -> dict` returns, for each label present, `{"n", "share_pct", "MdAPE", "within_20pct"}`.

`fit_thresholds` works as follows:
- `ape` is the absolute % error. Candidates are `np.unique(np.quantile(score, np.linspace(0.01, 0.99, 99)))`.
- `alpha` is the smallest candidate `c` where `mean(score >= c) >= MIN_SHARE` and within-20 of `score >= c` is `>= ACCEPT_HIT`. If no candidate qualifies, `alpha` is `None`.
- `beta` is the largest candidate `c` with `c < alpha` (or any `c` when `alpha` is `None`), where `mean(score < c) >= MIN_SHARE` and within-20 of `score < c` is `<= REJECT_HIT`. If no candidate qualifies, `beta` is `None`.

`decide` works as follows:
- `score >= alpha` gives `accept`. When `alpha` is `None`, no row is accepted.
- Otherwise `score < beta` gives `reject`. When `beta` is `None`, no row is rejected.
- Any other row gives `defer`.

- [ ] **Step 1: Write failing tests in `ml/test_decision.py`**

```python
def test_agreement_is_one_when_models_agree_and_zero_at_full_spread():
    # per_model all equal -> agreement 1.0; spread 0.30 or more -> 0.0
def test_depth_components_saturate_at_30_and_are_zero_for_empty():
    # sd_n=0 -> local 0.0; sd_n=30 -> 1.0; sd_n=300 -> 1.0
def test_wqs_is_mean_of_four_components_in_unit_range():
def test_fit_thresholds_accept_group_meets_target():
    # synthetic: score uniform 0..1, ape = 40*(1-score); accepted rows' within-20 >= 80
def test_fit_thresholds_returns_none_when_target_unreachable():
    # ape all 50 -> alpha None; then decide(...) never returns "accept"; json.dumps(result) works
def test_decide_three_way_boundaries():
    # decide([0.1, 0.5, 0.9], alpha=0.8, beta=0.3) == ["reject", "defer", "accept"]
    # decide(..., alpha=None, beta=None) -> all "defer"
def test_screening_reports_each_present_label():
    # shares add to 100; MdAPE and within_20pct per label
```

- [ ] **Step 2: Run** `.venv/Scripts/python.exe -X utf8 -m pytest test_decision.py -q`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `ml/decision.py`. Put a module docstring at the top. It names WQS-lite and Yao (2010), and says that the thresholds come from the cal fold.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then run the full `-m pytest -q`. Expected: no regressions.
- [ ] **Step 5: Commit** with the message `feat(ml): WQS-lite score and three-way decision thresholds`.

### Task 2: Learn thresholds in `ml/calibrate.py` and run it

**Files:**
- Modify: `ml/calibrate.py`
- Regenerate: `ml/models/ensemble.joblib`, `ml/models/metrics.json`

**Interfaces:**
- Consumes the Task 1 functions.
- Produces:
  - `predict_each(bundle, featured) -> dict[str, np.ndarray]`: the per-model price arrays. Refactor `predict` to use it: `predict = Σ weight * predict_each`.
  - `bundle["decision"] = {"calibration": {segment: {"alpha", "beta", "n"}}, "calibration_dropdown": {...}}`. It uses the same segment keys as `bundle["calibration"]`.
  - `metrics.json["decision"]` holds the same thresholds. `metrics.json["decision_test"][view_key][segment][label]` holds the `screening` output on the test fold. `metrics.json["decision_note"]` is a one-sentence explanation.

Steps:
- [ ] **Step 1:** Add `fit_decision(bundle, cal) -> dict` and `score_decision(bundle, decision, test) -> dict` next to `fit_view` and `score_view`. Both use `_masks` for segments. A test row falls in its type segment when that key exists, and always in `__default__`.
- [ ] **Step 2:** Wire both functions into `main()`. Print a table for each view: segment, alpha, beta, then n / MdAPE / ±20% per label.
- [ ] **Step 3:** Run `.venv/Scripts/python.exe -X utf8 calibrate.py`. Expected: it finishes and prints the tables. Then run the full pytest. Expected: no regressions.
- [ ] **Step 4:** Commit `ml/calibrate.py` and the two regenerated model files with the message `feat(ml): learn decision thresholds on the calibration fold, screen on test`. Put the printed tables in the report.

### Task 3: Return `decision` from `/api/predict`

**Files:**
- Modify: `ml/api.py`, `ml/test_pipeline.py`, `src/lib/api.ts`

**Interfaces:**
- Consumes `components`, `wqs` and `decide` from Task 1, and `bundle["decision"]` from Task 2.
- Produces response field `"decision"`: either `null`, or `{"label": "accept"|"defer"|"reject", "score": float (3 dp), "components": {"agreement","local","size","district"} (3 dp), "alpha": float|None, "beta": float|None}`.
- Thresholds come from the same view key as `table`, which is `"calibration"` when `lat` is set and `"calibration_dropdown"` otherwise. The segment is `collateral_type`, falling back to `__default__`.
- Compute the decision from `per_model` after the estate adjustment, and from `price`.
- If `BUNDLE` has no `"decision"` key, the field is `None`.
- In TS, add `export interface Decision {...}` and `decision?: Decision | null` on `ApiPrediction`.

- [ ] **Step 1:** Write the tests in `test_pipeline.py`, in the class with `client`:
  - `test_predict_returns_a_decision`: the label is in the set, the score is in [0, 1], and there are 4 components.
  - `test_dropdown_uses_dropdown_thresholds`: POST with `subdistrictId` "103301" and no lat. The `alpha` and `beta` must equal `bundle["decision"]["calibration_dropdown"][seg]`.
  - `test_missing_decision_table_gives_null`: monkeypatch `api.BUNDLE` to a copy without `"decision"`. Expect 200 and `decision is None`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the change.
- [ ] **Step 4:** Run the full pytest. Expected: PASS. Run `npm test` and `npm run build` from the repo root. Expected: both pass.
- [ ] **Step 5:** Commit with the message `feat(api): three-way decision with every prediction`.

### Task 4: Pin decisions (`score_listings.py` and `mapData.ts`)

**Files:**
- Create: `ml/score_listings.py`, `public/decisions.json` (generated)
- Modify: `src/lib/mapData.ts`, `src/lib/__tests__/mapData.test.ts`, `ml/test_decision.py`

**Interfaces:**
- `score_listings.py`:
  - `body_for(row: dict) -> dict | None` builds the same body the panel sends for a listing pin. Mirror `src/lib/priceForm.ts` and `mapData.normalizeListing`:
    - Type map: `{"คอนโด":"condo","บ้าน":"house","บ้านแฝด":"house","ทาวน์โฮม":"townhome","ที่ดิน":"land"}`. Any other type returns `None`.
    - `area = area_sqm or land_sqwa*4`. If there is no area, return `None`. Clamp area to [10, 20000].
    - `nUnits` is 1 and `year` is 2569.
    - Send `bedrooms` and `bathrooms` only when they are not null, clamped to [0, 20].
    - Send `lat` and `lng`.
    - Coverage box is lat 13.4–14.3 and lng 99.8–101.0. A listing outside it returns `None`.
  - `main()`:
    - POST each body through `api.app.test_client()`.
    - Write `../public/decisions.json` as `{listing_id: label}`, compact and UTF-8. Skipped or non-200 rows are left out.
    - Print the counts per label.
  - Add a test `test_body_for_skips_unpriceable_rows` to `ml/test_decision.py` covering:
    - type "สำนักงาน" gives None
    - no area gives None
    - lat 15.0 gives None
    - a condo row gives a body with `propertyType == "condo"` and `area` clamped
- `mapData.ts`:
  - `export type DecisionLabel = "accept" | "defer" | "reject"`.
  - `MapListing.decision: DecisionLabel | null`.
  - `export const DECISION_LEGEND: [DecisionLabel, string][]` uses the Global colors.
  - `export type ColorBy = "type" | "decision"`.
  - `pinColor(p: MapPoint, colorBy: ColorBy = "type")`. In decision mode, a listing with `decision === null` is `#9ca3af`, and projects keep their colors.
  - `loadListings` also fetches `/decisions.json`. Any failure gives an empty map, and the listings still load.
  - `normalizeListing(raw, decisions = {})`.
- Tests in `mapData.test.ts`:
  - `pinColor` decision mode gives three colors plus gray.
  - Type mode is unchanged.
  - `normalizeListing` without decisions gives `decision: null`.
  - `loadListings` with the decisions fetch rejected still returns listings. Stub `fetch` with `vi.stubGlobal`.

- [ ] **Step 1:** Write the tests (Python and TS). Run them. Expected: FAIL.
- [ ] **Step 2:** Implement the change. Run `.venv/Scripts/python.exe -X utf8 score_listings.py`. Expected: it writes the file and prints the counts.
- [ ] **Step 3:** Run pytest, `npm test` and `npm run build`. Expected: all pass.
- [ ] **Step 4:** Commit with the message `feat(map): precomputed decision per listing pin`.

### Task 5: UI, with the badge in the panel and decision colors on the map

**Files:**
- Modify: `src/components/PricePanel.jsx`, `src/components/MapCanvas.jsx`, `src/pages/MapPage.jsx`, `src/i18n.jsx`

**Interfaces:**
- Consumes `result.decision` (Task 3), and `ColorBy`, `DECISION_LEGEND` and `pinColor(p, colorBy)` (Task 4).
- Add these i18n keys (th / en / zh):
  - `decisionAccept`: ยอมรับราคาประเมิน / Accept estimate / 接受估价
  - `decisionDefer`: ส่งผู้ประเมินตรวจ / Refer to appraiser / 交由估价师复核
  - `decisionReject`: ไม่ควรใช้ราคานี้ / Do not rely on estimate / 不建议采用此估价
  - `decisionAcceptHint`: โมเดลเห็นตรงกันและมีทรัพย์เทียบเคียงพอ / Models agree and comparables are plentiful / 模型一致且可比样本充足
  - `decisionDeferHint`: สัญญาณปนกัน ควรให้ผู้ประเมินดูอีกครั้ง / Mixed signals; have an appraiser check it / 信号不一，建议估价师复核
  - `decisionRejectHint`: โมเดลเห็นต่างกันมากหรือทรัพย์เทียบเคียงน้อย / Models disagree or comparables are scarce / 模型分歧大或可比样本稀少
  - `decisionScore`: คะแนนคุณภาพ (WQS) / Quality score (WQS) / 质量分 (WQS)
  - `decisionAgreement`: โมเดลเห็นตรงกัน / Model agreement / 模型一致性
  - `decisionLocal`: ทรัพย์ในตำบล / Sub-district comparables / 街道可比样本
  - `decisionSize`: ทรัพย์ขนาดใกล้กัน / Same-size comparables / 同面积可比样本
  - `decisionDistrict`: ทรัพย์ในอำเภอ / District comparables / 区可比样本
  - `colorByType`: ประเภท / Type / 类型
  - `colorByDecision`: ความน่าเชื่อถือ / Reliability / 可靠性
  - `decisionUnscored`: ไม่ได้ประเมิน / Not scored / 未评估
- PricePanel:
  - Add `DecisionBadge({ decision })` in the same file, rendered inside the hero card under the price and above the RangeBar. Render nothing when `!decision`.
  - The pill uses the color tint `bg-emerald-50 text-[#16a34a]` / `bg-amber-50 text-amber-700` / `bg-red-50 text-[#DC2626]`. Icons: lucide `CheckCircle2` / `HelpCircle` / `XCircle`, size 14, `aria-hidden`.
  - Next to the pill, show the score as `decisionScore` + `score.toFixed(2)`.
  - Below the pill, show the hint line in `text-[11px] text-ink-secondary`.
  - Add a `<details>` with the four component bars, using the same bar style as the comparables rows.
  - The badge root has `role="status"` and `aria-label` = label + score.
- MapCanvas: add a `colorBy` prop (default `"type"`) passed to `pinColor`. Marker icons must re-render when it changes (add it to the effect deps that build the markers).
- MapPage:
  - Add `const [colorBy, setColorBy] = useState('type')` and pass it to MapCanvas.
  - Inside the legend body, above the list, add a two-button segmented toggle (`colorByType` / `colorByDecision`, `aria-pressed`).
  - In decision mode the list shows `DECISION_LEGEND` with `decisionAccept`/`decisionDefer`/`decisionReject`, plus a gray `decisionUnscored` row.

- [ ] **Step 1:** Implement the change.
- [ ] **Step 2:** Run `npm test` and `npm run build`. Expected: both pass. Check that there is no horizontal scroll at 360px: the badge row wraps (`flex-wrap`).
- [ ] **Step 3:** Commit with the message `feat: decision badge in price panel and decision-colored pins`.

### Task 6: Document it in `ml/README.md`

**Files:** Modify `ml/README.md`.
- [ ] **Step 1:** Add a section "Three-way decision (WQS-lite)". It covers the component formulas (Global Constraints), the threshold rule, and the per-view, per-segment table of alpha and beta. It also includes the test-fold screening table (n, share, MdAPE, ±20% per label), with numbers copied from `metrics.json["decision_test"]`. Add one hedged sentence on what the separation shows, and one limitation: pin decisions are computed for listings that may sit in the training data.
- [ ] **Step 2:** Commit with the message `docs(ml): three-way decision protocol and test results`.
