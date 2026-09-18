# Model service

CatBoost + LightGBM + XGBoost ensemble that prices a property for the web app.

## What it is trained on

Asking prices scraped from four listing sites (`Data/*_listings.csv`, Bangkok +
ปริมณฑล, scraped 2026-09-18; see `Data/scrape_dotproperty.py` and
`Data/scrape_sites.py`): dotproperty, ddproperty, hipflat and baania. After
type filtering and cross-site de-duplication that is 141,200 listings, 76
districts. Livinginsider was scraped too but its list pages carry no district,
so it cannot feed a district-keyed model. The target is the **asking price**,
not a recorded appraisal.

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

Almost every listing is a 2569 snapshot of one market, so the newest year is
dealt out at random with a fixed seed (`prepare_data.assign_folds`): 70% of
2569 plus all older years to fit, 10% to pick ensemble weights, 20% scored once
at the end. A fit row is still described only by earlier years, so it can never
look itself up.

| model | MAPE | MdAPE | R² | within ±20% |
|---|---|---|---|---|
| CatBoost | 53.2% | 27.4% | 0.581 | 37.3% |
| LightGBM | 59.2% | 23.8% | 0.739 | 43.0% |
| XGBoost | 51.7% | 25.0% | 0.637 | 40.8% |
| **Ensemble** | **52.8%** | **25.7%** | **0.625** | **39.4%** |

Against the previous model, fit on dotproperty alone (15k fit rows, scored on
the whole of 2569): MAPE 63.2% → 52.8%, R² 0.587 → 0.625, MdAPE 26.3% → 25.7%.

By property type (held-out fold, served model):

| segment | n | MdAPE | within ±20% |
|---|---|---|---|
| คอนโด | 13,498 | 24.5% | 41.8% |
| ทาวน์เฮ้าส์ | 1,734 | 22.6% | 45.5% |
| บ้านเดี่ยว | 2,497 | 28.5% | 36.9% |
| ที่ดิน | 421 | 41.0% | 25.9% |

Asking prices are noisier than appraisals: the same unit is listed at very
different prices by different agents, which caps how well any model can do.

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
| `prepare_data.py` | load four sources, clean, fold split, comparable features |
| `train_models.py` | trains the three models, picks weights, scores on test |
| `calibrate.py` | prediction intervals from out-of-sample error |
| `build_location_map.py` | TIS-1099 subdistrict id → district/province |
| `eval_breakdown.py` | accuracy by type, province, area, value band |
| `api.py` | Flask serving layer |
| `test_pipeline.py` | 18 tests over cleaning, splitting, features, bundle |

## Limits worth repeating

- Predictions are a starting figure, not an official appraisal.
- Appraisal value is not market price.
- Listings from before 2568 are thin; 2569 dominates.
- A property with no comparable on record — an unusual size in a thin district —
  falls back to district and province statistics and is predicted worse. The
  `comp_n` and `nn_dist` features tell the model when it is in that position.
- Hipflat listings carry no posting date and are dated at the scrape.
