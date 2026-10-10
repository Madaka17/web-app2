# web-app2

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-syqaoeah)

## Model service

Price predictions come from a CatBoost + LightGBM + XGBoost ensemble trained on
scraped asking prices (dotproperty, ddproperty, hipflat, baania), each priced
against comparable listings in the same project and within 1–2 km. Test R² 0.869 when the location is a map click (0.751 from the sub-district list alone).

`npm run dev` starts the API as well (http://127.0.0.1:3030, proxied at `/api`)
once `ml/models/ensemble.joblib` exists. To run it alone:

```bash
cd ml && .venv/bin/python api.py     # Windows: .venv\Scripts\python api.py
```

See [ml/README.md](ml/README.md) for accuracy figures, what the model does and
does not use, and how to retrain.

## Development

```bash
npm run dev        # vite
npm run typecheck
npm run lint
npm test           # vitest
npm run build
```
