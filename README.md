# web-app2

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-syqaoeah)

## Model service

Price predictions come from a CatBoost + LightGBM + XGBoost ensemble trained on
212,043 real appraisals (2562–2567), each priced against comparable appraisals
from earlier years. Start it before using the app:

```bash
cd ml && .venv/bin/python api.py     # http://127.0.0.1:8000
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
