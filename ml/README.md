# Model service

CatBoost + LightGBM + XGBoost ensemble that prices a property for the web app.

## What it is trained on

`Data/appraisal_2561-2569.parquet`, written by `Data/generate_appraisal_dataset.py`.

**Its prices are real. Its rows are not.** Both halves matter:

- The price levels come from the Treasury Department's published appraisals
  (Open Data Common, [catalog.treasury.go.th](https://catalog.treasury.go.th)),
  reduced to `Data/price_tables.json` by `Data/build_price_tables.py`:

  | source | what it gives | size |
  |---|---|---|
  | ราคาประเมินห้องชุด | appraisal per sqm of each of 8,481 real buildings, by district | 83,269 residential units |
  | ราคาประเมินที่ดิน | appraisal per sqm by province | 5.2M parcels |
  | ราคาประเมินสิ่งปลูกสร้าง | construction cost per sqm by type and province | 5 residential types |

- The rows are invented: which property was appraised, how big it was, how often
  it came back, and in which year. The Treasury publishes a price *level*, one
  snapshot, not a transaction history — and the comparable features below need a
  history to work at all. The year trend (2.5%/yr) is an assumption, not a
  measurement.

So read a prediction as *"an appraisal of this kind, in this district, plausibly
lands here"*. It is not a record of an appraisal that happened, and it is not a
market price. `Data/price_tables.json` is committed; the 220 MB of source CSVs
and the generated parquet are not, and both rebuild from the scripts.

Two structural facts about condos were found by watching the metrics rather than
assumed, and the generator would be wrong without either:

- **Price belongs to the building, not the district.** Units in one building sit
  within 1.08x of each other; buildings within one district spread 4.29x from
  p10 to p90. Drawing each unit's price from the district distribution made
  condos the *worst*-predicted segment, which is backwards.
- **Each project sells its own floor plans.** That is what lets an exact
  comparable identify a building from a size alone, which is the only reason
  condos are predictable when the form never asks which project you mean.

## What the model can and cannot see

| Web form field | Used by the model? |
|---|---|
| ประเภทอสังหาริมทรัพย์ | ✅ `collateral_type` |
| ขนาดพื้นที่ | ✅ `area_sqm` |
| จำนวนหน่วย | ✅ `n_units` |
| ปีที่ประเมิน | ✅ `year` |
| ทำเล (ตำบล) | ✅ mapped to `district` + `province` |

That is the whole form. ห้องนอน, ห้องน้ำ, ชั้น, อายุอาคาร, ที่จอดรถ and ระยะ BTS
were asked for once but the data has no such column, so they were removed rather
than collected and discarded: a form field that silently does nothing is worse
than no field.

## How six columns are made to go further

An appraiser does not price a plot from its attributes. They find what
comparable properties nearby were valued at and adjust. `prepare_data.py` does
the same thing, looking every row up at four widths:

| feature | comparable |
|---|---|
| `comp_ppsqm` | same district, type, unit count **and exact size** |
| `comp2_ppsqm` | same district, type and exact size, any unit count |
| `nn_ppsqm` + `nn_dist` | the closest size on record in that district, and how far off it is |
| `band_ppsqm`, `dt_ppsqm`, … | same size band, then the district, province and type |

Each level is shrunk toward the wider one by its row count, so a district with
three condo appraisals cannot outvote its province while one with three hundred
can. The four comparable features are the top of the importance table by a wide
margin (`comp2_ppsqm` 33%, `comp_ppsqm` 13%, `comp_gap` 9%).

A training row must not be able to look **itself** up, or the models learn to
copy an answer that will not exist at serve time. So the comparables for a row
in year Y are built only from years before Y (`build_training_frame`). The
earliest year has no history and is dropped.

The target is log **price per sqm** rather than log price, because area is known
exactly and the trees should not spend their depth re-deriving it; and the loss
is absolute rather than squared error, because MAPE and MdAPE are median-shaped
and a handful of 200M appraisals drag a squared-error fit upward.

## Accuracy

Fit on 2562–2566, ensemble weights picked on 2567, scored once on 2568–2569
(years the model never saw). A random split would leak same-year comparables.

| model | MAPE | MdAPE | R² | within ±10% | within ±20% | weight |
|---|---|---|---|---|---|---|
| CatBoost | 54.4% | 15.2% | 0.841 | 35.8% | 59.4% | 20% |
| LightGBM | 54.6% | 15.3% | 0.835 | 35.7% | 59.0% | 10% |
| XGBoost | 54.2% | 16.0% | 0.837 | 34.5% | 57.8% | 70% |
| **Ensemble** | **54.1%** | **15.5%** | **0.839** | **35.2%** | **58.6%** | |

By property type, on the **served** model (fit through 2567), which is what the
API returns and what `calibrate.py` measures:

| segment | n | MdAPE | within ±20% |
|---|---|---|---|
| ห้องชุด (คอนโด) | 14,030 | **11.1%** | 72.2% |
| ที่ดิน/สิ่งปลูกสร้าง | 53,986 | 15.7% | 57.9% |
| all | 68,016 | 14.5% | 60.8% |

**MAPE is far above MdAPE on purpose.** It is an average over a long tail: real
land appraisals run down to 400 THB/sqm in Nakhon Pathom, and a percentage error
on a 300k-baht plot is enormous however close the prediction. Half of all
predictions land within 14.5%. The original appraisal extract this pipeline was
written against had the same shape (MAPE 49.4% against MdAPE 24.3%); an earlier
version of the generator did not, and that was a sign it was too easy.

Prediction intervals are the 10th–90th percentile of `actual / predicted` on the
held-out years, per property type — not an invented ±6% band.

## Cleaning

| | rows |
|---|---|
| generated | 534,586 |
| dropped: value outside 50k–200M | 15,283 |
| dropped: area outside 10–20,000 sqm | 20,306 |
| **usable** | **498,997** |

Fit 312,757 · validation 52,123 · test 68,016.

## Hyperparameters

`tune_params.py` searches on the validation year only — it never loads the test
years, so no parameter is chosen because it happened to score well on the number
being reported. Every candidate early-stops against 2567.

The search was flat: all twelve candidates landed within 0.3 pp of each other.
What it actually bought was speed. Each model was running a fixed 2,000 rounds
and needed 220–400, so training went from 530s to 140s at equal accuracy.

## Market estimate (optional)

`Data/scrape_listings.py` collects for-sale listings and
`Data/build_market_ratio.py` turns them into `models/market_ratio.json`:

    ratio = median asking price per sqm / median official appraisal per sqm

The API multiplies its prediction by that and returns it alongside as `market`.
**Asking is not sold price** — a board price is the start of a negotiation, and
Thai sold prices are not published by anyone, so this overstates the market by an
unknown amount. A cell with under 30 listings is dropped rather than shown, and
with no ratio file at all the API returns `market: null` and the web app shows
the appraisal alone. That is the normal state, not a failure.

The scraper reads `robots.txt` on every run and skips what it disallows. It does
not touch sites that answer with a bot challenge.

## Running it

```bash
cd ml
python api.py          # http://127.0.0.1:8000
```

The web app reads `VITE_API_URL`, defaulting to `http://127.0.0.1:8000`.

| endpoint | |
|---|---|
| `GET /api/health` | what is loaded, weights, row counts, whether a market ratio exists |
| `GET /api/metrics` | the full metrics.json |
| `POST /api/predict` | `{subdistrictId, area, propertyType, nUnits?, year?}` |

## Rebuilding from scratch

```bash
python ../Data/build_price_tables.py        # only when the Treasury republishes
python ../Data/generate_appraisal_dataset.py
python train_models.py                      # ~2.5 min, writes models/ensemble.joblib
python calibrate.py                         # intervals from held-out error
python build_location_map.py
python -m pytest test_pipeline.py -q        # 18 tests
```

## Files

| | |
|---|---|
| `../Data/build_price_tables.py` | Treasury open data → `price_tables.json` |
| `../Data/generate_appraisal_dataset.py` | price tables → the training parquet |
| `../Data/scrape_listings.py` | for-sale listings → `listings.csv` |
| `../Data/build_market_ratio.py` | listings + appraisals → `market_ratio.json` |
| `prepare_data.py` | load, clean, time-based split, comparable features |
| `train_models.py` | trains the three models, picks weights, scores on test |
| `tune_params.py` | hyperparameter search on the validation year |
| `calibrate.py` | prediction intervals from out-of-sample error |
| `build_location_map.py` | TIS-1099 subdistrict id → district/province |
| `eval_breakdown.py` | accuracy by type, province, area, value band |
| `api.py` | Flask serving layer |
| `test_pipeline.py` | 18 tests over cleaning, splitting, features, bundle |

## Limits worth repeating

- Predictions are a starting figure, not an official appraisal.
- Appraisal value is not market price.
- **Land prices are provincial.** The Treasury's land file is keyed by UTM map
  sheet with no district name, so land is spread across districts using the
  condo price gradient — a district where condos appraise high is assumed to
  have dearer land. That is an assumption, and it is the weakest link left.
- The year trend is assumed, not measured. The Treasury data is one snapshot.
- A property with no comparable on record — an unusual size in a thin district —
  falls back to district and province statistics and is predicted worse. The
  `comp_n` and `nn_dist` features tell the model when it is in that position.
- 6 of the 79 districts have too few condos for the Treasury to publish, and fall
  back to provincial figures.
