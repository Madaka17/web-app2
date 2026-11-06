# web-app2

The OpenPlot map frontend. The main page is a map of Bangkok and the ring
provinces with two kinds of pins:

- **Land mode (บ้านมือสอง):** current resale listings, one pin each.
- **Future mode (โครงการ):** real projects, one pin each.

Click a pin, or click an empty spot on the map, and a price panel opens beside
the map. For a pin, the panel shows an estimated asking price and how far the
listing's asking price sits above or below that estimate. For an empty spot,
it shows the estimate for a property you describe. On a phone the panel opens
as a bottom sheet.

Prices are **asking-price estimates**, built from scraped listings. They are
not official appraisals and should not be used as one.

## Coverage

Bangkok and the ring provinces only. Clicks outside that area get an
out-of-coverage notice and no price, and no request is sent to the model.

## Model service

Price predictions come from a CatBoost + LightGBM + XGBoost ensemble trained on
scraped asking prices (dotproperty, ddproperty, hipflat, baania), each priced
against comparable listings in the same project and within 1–2 km. Test R² 0.858 when the location is a map click (0.763 from the sub-district list alone).

See [ml/README.md](ml/README.md) for accuracy figures, what the model does and
does not use, and how to retrain.

### Running the app

```bash
npm install
npm run dev
```

`npm run dev` also starts the model API (http://127.0.0.1:3030, reached through
the dev server at `/api`). It only starts when `ml/models/ensemble.joblib`
exists. The API takes up to a minute to load the model, so price requests fail
for a short time after startup until it is ready. The API is started
with `ml/.venv/Scripts/python.exe` on Windows or `ml/.venv/bin/python` when
those exist, and otherwise with `python` on your PATH on Windows or `python3` elsewhere.

To run the API on its own:

```bash
cd ml && .venv/bin/python api.py     # Windows: .venv\Scripts\python api.py
```

### Python packages for the API

The API (`ml/api.py`) and the data scripts need the packages in
`ml/requirements.txt`. The versions are pinned because `ml/models/ensemble.joblib`
may not load with others. They need Python 3.12 or newer. Create the environment
before the first `npm run dev`:

```bash
python3 -m venv ml/.venv                         # Windows: python -m venv ml\.venv
ml/.venv/bin/pip install -r ml/requirements.txt  # Windows: ml\.venv\Scripts\pip install -r ml\requirements.txt
```

On macOS, also run `brew install libomp`. LightGBM and XGBoost need it. macOS setup has not been tested yet.

The model test suite (`ml/test_pipeline.py`) also uses pytest, which is not in the requirements file.

### Hosting the API separately

The frontend calls `VITE_API_URL` when it is set, and `/api` otherwise. To use
an API hosted elsewhere, set `VITE_API_URL` to its base URL at build time.

## Map data

The map reads two static files from `public/`:

- `public/listings.json` for the land-mode pins.
- `public/projects.json` for the future-mode pins.

Rebuild them from the repo root:

```bash
python Data/build_map_listings.py    # fetches current listings from baania
python Data/build_map_projects.py    # reads ml/models/projects.json
```

`build_map_listings.py` needs network access to baania. `build_map_projects.py`
only reads files already in the repo, so run `ml/projects.py` first if
`ml/models/projects.json` is out of date.

## Map tiles and attribution

The map uses these tile providers. All are keyless. Each one is attributed on the map.

- **Satellite:** Esri World Imagery, with Esri World Boundaries and Places as
  the label layer.
- **Street:** OpenStreetMap.
- **Terrain:** OpenTopoMap.

For a public production site, check each provider's usage terms before launch.
The OpenStreetMap tile servers are not for heavy production use, so a busy
public site should move to a tile host it has agreed terms with.

## Template pages

`/new-land`, `/news`, and the other template pages (`/contact`,
`/privacy-policy`, `/terms-of-service`, `/auth/login`) still show the
template's invented sample content. They are not real. Replace them before
this site goes public.

## Development

```bash
npm run dev        # vite, plus the model API
npm run typecheck
npm run lint
npm test           # vitest
npm run build      # writes dist/, including listings.json and projects.json
```
