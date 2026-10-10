# Model service

CatBoost + LightGBM + XGBoost ensemble that prices a property for the web app.

## What it is trained on

Asking prices scraped from four listing sites (`Data/*_listings.csv`, Bangkok +
ปริมณฑล, scraped 2026-10-08; see `Data/scrape_dotproperty.py` and
`Data/scrape_sites.py`): dotproperty, ddproperty, hipflat and baania.
Livinginsider was scraped too but its list pages carry no district, so it cannot
feed a district-keyed model. The target is the **asking price**, not a recorded
appraisal.

Besides price, size and location the listings carry:

| fact | source | how it reaches other listings |
|---|---|---|
| map pin (lat/lng) | dotproperty, baania | copied to every listing of the same project |
| project | ddproperty (id + name), dotproperty (name) | hipflat/baania titles and descriptions are searched for a known project name (`_match_projects`) |
| completion year → `building_age` | ddproperty badge "ปีที่สร้างเสร็จ" | copied by project |
| walk to rail → `transit_m` | ddproperty "400 ม. ถึง BL22 ..." | copied by project |
| bedrooms, bathrooms | all four | — |

## What the model can see

| Web form field | Feature |
|---|---|
| ประเภทอสังหาริมทรัพย์ | `collateral_type` |
| ขนาดพื้นที่ | `area_sqm` |
| จำนวนหน่วย | `n_units` |
| ปีที่ประเมิน | `year` |
| ทำเล (ตำบล) | `district` + `province` + `sub_district` |
| คลิกบนแผนที่ | `latitude`/`longitude` and every radius feature below |
| ห้องนอน / ห้องน้ำ (optional) | `bedrooms` / `bathrooms` |
| อายุอาคาร (optional) | `building_age` |

An optional field left blank is sent as unknown (-1), exactly how the many
listings that did not state it were seen in training.

## Comparables

An appraiser finds what comparable properties nearby go for and adjusts.
`prepare_data.py` does the same, at every width it can:

| feature | comparable |
|---|---|
| `proj_ppsqm` | same project (the strongest single feature) |
| `knn_ppsqm`, `knn_dist_m` | the 15 nearest pinned listings of the same type |
| `geo1_ppsqm`, `geo2_ppsqm` | same type within 1 km / 2 km |
| `comp_ppsqm`, `comp2_ppsqm`, `nn_ppsqm` | same district, type and (nearest) size |
| `band_ppsqm`, `sd_ppsqm`, `dt_ppsqm`, … | size band, sub-district, district, province, type |

Each level is shrunk toward the wider one by its row count, so a project with
two listings cannot outvote its sub-district while one with forty can.

A training row must not look **itself** up, or the models learn to copy an
answer that will not exist at serve time. Fit rows are dealt into 5 folds and
each fold is described by the other four (`build_training_frame`) - the same
position a new listing is in when priced against everything on record.
Validation and test rows are described by the fit rows only.

The target is log **price per sqm** and the loss is absolute error.

## Accuracy, measured honestly

Almost every listing is a 2569 snapshot of one market, so the newest year is
dealt out at random with a fixed seed (`prepare_data.assign_folds`): 70% of
2569 plus all older years to fit, 10% to pick ensemble weights (by R²), 20%
scored once at the end.

The same held-out rows are scored the three ways a price can be asked for
(`train_models.app_views`), because a listing states facts the web form does
not know:

| input | what the model gets | rows | R² | MdAPE | within ±20% |
|---|---|---|---|---|---|
| **map click** (headline) | pin, type, size; project snapped from the pin | 16,071 | **0.869** | **11.5%** | **72.0%** |
| sub-district dropdown | type, size, sub-district - no pin | 22,926 | 0.751 | 22.2% | 45.9% |
| full listing | everything the listing states | 22,926 | 0.837 | 13.1% | 65.7% |

Per model on the map-click view: CatBoost R² 0.872, LightGBM 0.869, XGBoost
0.848, ensemble (0.6 / 0.1 / 0.3) 0.869.

The dropdown alone cannot reach the same accuracy: within one sub-district a
condo can ask twice what the next one does, and only a pin says which.

Two data problems were found and fixed on the way: rentals posted into the
sale feed ("13,000 บาทต่อเดือน", rent typed as price; `clean` drops them as
`dropped_rent`), and "unknown" being read as "cheap" because the listings that
leave rooms/project blank were mostly the cheapest site's. Fit rows now have
those facts blanked at random (`mask_optional`) so blank means "not told".

By property type, map click (`calibrate.py`):

| segment | n | MdAPE | within ±20% |
|---|---|---|---|
| คอนโด | 11,267 | 9.6% | 80.4% |
| ทาวน์เฮ้าส์ | 1,704 | 16.3% | 58.0% |
| บ้านเดี่ยว | 2,656 | 17.3% | 54.7% |
| ที่ดิน | 444 | 34.8% | 28.6% |

Asking prices are noisier than appraisals: the same unit is listed at very
different prices by different agents, which caps how well any model can do.

## ค่าเสื่อม (building age)

`train_models.depreciation_curve` measures it instead of assuming a rate: each
listing with a known completion year is compared with its own sub-district's
going rate, and the median gap per age bucket, relative to a 0-2 year building,
is the factor (6-10 yrs ≈ ×0.85, 16-20 ≈ ×0.65, 31+ ≈ ×0.43). The map's
"หลังค่าเสื่อม" column brings each nearby listing back to a new-building
equivalent with its own age factor, then ages it to the requested building.

## API

| | |
|---|---|
| `GET /api/health` | what is loaded, weights, row counts |
| `GET /api/metrics` | the full metrics.json |
| `POST /api/predict` | `{subdistrictId \| lat+lng, area, propertyType, nUnits?, year?, bedrooms?, bathrooms?, buildingAge?}` |
| `GET /api/nearby` | `?lat&lng&radius=1000\|2000&type?&buildingAge?` - median, 25-75% range and age-adjusted price per sqm of listings in the radius |

`npm run dev` starts the API too (Vite plugin in `vite.config.ts`), once
`models/ensemble.joblib` exists.

## Retraining

```bash
.venv/bin/python train_models.py      # ~15 min, writes models/ensemble.joblib
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
| `test_pipeline.py` | 27 tests over cleaning, rent filter, splitting, features, project snap, bundle, API |

## Limits worth repeating

- Predictions are a starting figure, not an official appraisal.
- Appraisal value is not market price.
- Listings from before 2568 are thin; 2569 dominates.
- A property with no comparable on record — an unusual size in a thin district —
  falls back to district and province statistics and is predicted worse. The
  `comp_n` and `nn_dist` features tell the model when it is in that position.
- Hipflat listings carry no posting date and are dated at the scrape.
