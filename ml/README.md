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
| หมู่บ้านจัดสรร ใน / นอก / ไม่ระบุ (houses, townhouses) | `estate` (1 / 0 / -1) |
| ค้นหาหมู่บ้าน (optional) | `project_key` of the chosen village; its pin when no click |

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
| **map click** (headline) | pin, type, size; project snapped from the pin | 16,071 | **0.866** | **11.4%** | **72.2%** |
| sub-district dropdown | type, size, sub-district - no pin | 22,926 | 0.750 | 22.3% | 45.8% |
| full listing | everything the listing states | 22,926 | 0.833 | 13.2% | 65.9% |

Per model on the map-click view: CatBoost R² 0.872, LightGBM 0.869, XGBoost
0.845, ensemble (0.45 / 0.1 / 0.45) 0.866.

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

## หมู่บ้านจัดสรร (housing estates)

`estate.py` flags each house and townhouse listing: **in** an estate when it
names a project or its text mentions หมู่บ้าน / โครงการ / ค่าส่วนกลาง / รปภ. /
คลับเฮ้าส์; **out** only when the text says so (บ้านสร้างเอง, ปลูกสร้างเอง,
นอกโครงการ, ไม่มีค่าส่วนกลาง, …); unknown otherwise - most listings do not
say, and silence is not evidence either way. "Out" wins over "in": a self-built
house on an estate road is not priced like an estate home.

`estate_premium` measures the gap the way depreciation is measured - against
comparables, never as a raw average: median baht/sqm inside vs outside an
estate within the same type, sub-district (district for "out") and size band,
weighted by the smaller side of each cell, with a bootstrap interval over
cells.

| | in vs no estate named | in vs stated outside |
|---|---|---|
| houses + townhouses | +8.3% [+5.8..+11.3] | +23.0% [+12.6..+35.1] (n out 278) |
| บ้านเดี่ยว | +12.6% [+9.2..+17.7] | +29.7% [+16.8..+45.1] (n out 191) |
| ทาวน์เฮ้าส์ | +3.6% [+0.3..+7.2] | +7.1% [-2.2..+19.0] (n out 87) |

"No estate named" mixes estate homes whose listing just does not say so, so
that column is a lower bound.

`estate` is a model feature (blanked at random in fit rows like the other
optional facts, so "not told" stays neutral) but the models barely use it
(0.2% importance; held-out houses priced from a click with and without the
flag: MdAPE 17.07% vs 17.03%). A house's comparables are mostly estate
listings, so a prediction already sits at estate level - held-out estate
houses come in at actual/predicted 1.00, stated-outside ones at 0.82 - and 278
"outside" rows are too few for a tree to learn the gap. The API therefore
applies the measured gap itself when the form says **outside**: price ÷ (1 +
in-vs-outside premium) for that type (บ้านเดี่ยว ×0.77, ทาวน์เฮ้าส์ ×0.93),
reported as `meta.estate_adjustment`. "In" and "not told" are the model as is.

## Grades

`projects.py` writes `models/projects.json`: every village and condo project
on record, graded, for the village search and the grade page.

| villages (median asking price) | condos (median baht/sqm) |
|---|---|
| Super Luxury 50M+ | Ultimate Class 500k+ |
| Luxury 20-50M | Super Luxury 200-500k |
| Upper Medium 6-20M | High Class 120-200k |
| Economy 3-6M | Main Class 80-120k |
| below 3M: ต่ำกว่า Economy | Economy 50-80k, below: ต่ำกว่า Economy |

Each grade also reports what its listings say about the criteria for a good
village: median distance to rail, share mentioning security (รปภ., CCTV, key
cards, 24h) and share mentioning a juristic person / common fee / clubhouse.
Construction quality is not in the data and is not scored. Grading keeps the
top 1% of baht/sqm that model training trims (`PPSQM_TRIM`): that 1% is
exactly the Ultimate Class condos (Ritz-Carlton, Four Seasons, Scope at
550-750k/sqm).

## API

| | |
|---|---|
| `GET /api/health` | what is loaded, weights, row counts |
| `GET /api/metrics` | the full metrics.json |
| `POST /api/predict` | `{subdistrictId \| lat+lng, area, propertyType, nUnits?, year?, bedrooms?, bathrooms?, buildingAge?, estate?: "in"\|"out", project?}` |
| `GET /api/projects` | `?q&kind=village\|condo&grade?&limit?` - project search, with grade and quality signals |
| `GET /api/grades` | village and condo grades compared |
| `GET /api/estate` | measured in-estate premium per type |
| `GET /api/nearby` | `?lat&lng&radius=1000\|2000&type?&buildingAge?` - median, 25-75% range and age-adjusted price per sqm of listings in the radius |

`npm run dev` starts the API too (Vite plugin in `vite.config.ts`), once
`models/ensemble.joblib` exists.

## Retraining

```bash
.venv/bin/python train_models.py      # ~15 min, writes models/ensemble.joblib
.venv/bin/python calibrate.py         # intervals from held-out error
.venv/bin/python build_location_map.py
.venv/bin/python projects.py          # village/condo index and grades
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
| `estate.py` | in/out of a housing estate, premium, grade bands |
| `projects.py` | project index and grades → models/projects.json |
| `api.py` | Flask serving layer |
| `test_pipeline.py` | 39 tests over cleaning, rent filter, splitting, features, project snap, estates, grades, bundle, API |

## Limits worth repeating

- Predictions are a starting figure, not an official appraisal.
- Appraisal value is not market price.
- Listings from before 2568 are thin; 2569 dominates.
- A property with no comparable on record — an unusual size in a thin district —
  falls back to district and province statistics and is predicted worse. The
  `comp_n` and `nn_dist` features tell the model when it is in that position.
- Hipflat listings carry no posting date and are dated at the scrape.
