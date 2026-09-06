# Model service

CatBoost + LightGBM + XGBoost ensemble that prices a property for the web app.

## What it is trained on

`/Users/vexila/Desktop/Data real/appraisal_2561-2569.parquet` — 302,702 recorded
appraisals, 2561–2569. This is the only file on this machine carrying **real**
prices.

It was chosen over `real_estate_platform/sample_data/real_estate_enriched.csv`,
whose `price_thb` is produced by a hedonic formula in `data_generator.py`. A
model trained on that column re-learns the formula (hence its R² of 0.995) and
tells you nothing about the market. That is stated in the header of
`real_estate_platform/enrich_real_data.py` too.

`project/data.xlsx` has no price column at all, so it cannot train anything.

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
than no field. The source spreadsheets were re-checked for anything else usable
and hold nothing beyond these six columns.

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
can. An exact comparable exists for 57% of the held-out rows.

The catch is that a training row must not be able to look **itself** up, or the
models learn to copy an answer that will not exist at serve time. So the
comparables for a row in year Y are built only from years before Y
(`build_training_frame`). The earliest year has no history and is dropped, which
costs 38,654 rows — the served model fits on 212,043.

Two other changes came with it: the target is log **price per sqm** rather than
log price, because area is known exactly and the trees should not spend their
depth re-deriving it; and the loss is absolute rather than squared error,
because MAPE and MdAPE are median-shaped and a handful of 200M appraisals drag a
squared-error fit upward.

## Accuracy, measured honestly

Fit on 2561–2566, ensemble weights picked on 2567, scored once on 2568–2569
(years the model never saw). A random split would leak same-year comparables.

| model | MAPE | MdAPE | R² | within ±20% |
|---|---|---|---|---|
| CatBoost | 49.5% | 24.5% | 0.595 | 43.5% |
| LightGBM | 50.6% | 24.8% | 0.601 | 43.3% |
| XGBoost | 50.4% | 25.2% | 0.600 | 42.7% |
| **Ensemble** | **49.4%** | **24.3%** | **0.599** | **43.7%** |

Against the previous version of this model, which had neither the comparables
nor the price-per-sqm target:

| | before | after |
|---|---|---|
| MAPE | 56.6% | 49.4% |
| MdAPE | 31.6% | 24.3% |
| R² | 0.502 | 0.599 |
| within ±10% | 17.5% | 25.8% |
| within ±20% | 33.6% | 43.7% |

By property type — the split that matters. These are the **served** model, fit
on 2561–2567 and scored on 2568–2569, so they run a little ahead of the table
above:

| segment | n | MdAPE | within ±20% | R² |
|---|---|---|---|---|
| ห้องชุด (คอนโด) | 7,903 | **12.8%** | 66.6% | 0.780 |
| ที่ดิน/สิ่งปลูกสร้าง | 31,469 | 25.8% | 42.5% | 0.628 |

Condos still predict about twice as well as land: a 45 sqm unit in a tower has
hundreds of near-identical comparables, a 3-rai plot has none.

Where the gain actually comes from, on the same held-out years:

| | n | MdAPE | within ±20% | R² |
|---|---|---|---|---|
| an exact comparable exists | 24,750 | **16.2%** | 56.9% | 0.830 |
| none, but a near-identical size does | 13,747 | 34.5% | 31.6% | 0.453 |
| nothing near this size in the district | 875 | 41.2% | 24.9% | 0.519 |

This is the honest shape of the improvement. Properties get re-appraised, and a
row whose exact size has been valued in that district before is now priced very
well. A genuinely novel property — an unusual size in a thin district — is
predicted about as well as the old model managed, which is to say not very. Two
thirds of real traffic falls in the first row; the model reports which case it
is in through `comp_n` and `nn_dist`.

MAPE stays far above MdAPE because it is an average over a long tail — the
cheapest rows (under 2M THB) carry a MAPE of 116% and drag it up on their own.
Half of all predictions land within 24.3%.

Prediction intervals are the 10th–90th percentile of `actual / predicted` on the
held-out years, per property type — not an invented ±6% band.

## Ensemble weights

CatBoost 80% · LightGBM 10% · XGBoost 10%, chosen on the validation year.

Unconstrained, the search drops LightGBM (0.8 / 0 / 0.2). A minimum weight of
10% is enforced so all three models genuinely contribute; the cost is +0.03 pp
MAPE on validation.

## Running it

```bash
cd ml
.venv/bin/python api.py          # http://127.0.0.1:8000
```

The web app reads `VITE_API_URL`, defaulting to `http://127.0.0.1:8000`.

| endpoint | |
|---|---|
| `GET /api/health` | what is loaded, weights, row counts |
| `GET /api/metrics` | the full metrics.json |
| `POST /api/predict` | `{subdistrictId, area, propertyType, nUnits?, year?}` |

## Retraining

```bash
.venv/bin/python train_models.py      # ~8 min, writes models/ensemble.joblib
.venv/bin/python calibrate.py         # intervals from held-out error
.venv/bin/python build_location_map.py
.venv/bin/python -m pytest test_pipeline.py -q
```

## Files

| | |
|---|---|
| `prepare_data.py` | load, clean, time-based split, comparable features |
| `train_models.py` | trains the three models, picks weights, scores on test |
| `calibrate.py` | prediction intervals from out-of-sample error |
| `build_location_map.py` | TIS-1099 subdistrict id → district/province |
| `eval_breakdown.py` | accuracy by type, province, area, value band |
| `api.py` | Flask serving layer |
| `test_pipeline.py` | 18 tests over cleaning, splitting, features, bundle |

## Limits worth repeating

- Predictions are a starting figure, not an official appraisal.
- Appraisal value is not market price.
- 2569 has only 10,998 rows (partial year).
- A property with no comparable on record — an unusual size in a thin district —
  falls back to district and province statistics and is predicted worse. The
  `comp_n` and `nn_dist` features tell the model when it is in that position.
- บางเสาธง (สมุทรปราการ) is the one district in `locations.ts` absent from the
  training data; it falls back to province-level statistics.
