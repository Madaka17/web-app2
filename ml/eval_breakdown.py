"""Per-segment accuracy of the served ensemble on the held-out test years."""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd

from prepare_data import CATEGORICAL, FEATURES, TARGET, add_features, clean, load_raw, split, to_price
from train_models import as_categorical, metrics

bundle = joblib.load("models/ensemble.joblib")
df, _ = clean(load_raw())
_, test = split(df)

featured = add_features(test, bundle["reference"])
area = featured["area_sqm"].to_numpy(dtype=float)
X_raw = featured[FEATURES]
X_cat = as_categorical(X_raw, bundle["categories"])
preds = {n: to_price(m.predict(X_raw if n == "CatBoost" else X_cat), area)
         for n, m in bundle["models"].items()}
y = test[TARGET].to_numpy(dtype=float)
pred = sum(bundle["weights"][n] * p for n, p in preds.items())

def row(label, mask):
    if mask.sum() < 50:
        return
    m = metrics(y[mask], pred[mask])
    print(f"{label:<44}{mask.sum():>8,}{m['MdAPE']:>9.1f}%{m['MAPE']:>9.1f}%"
          f"{m['Within_20Pct']:>9.1f}%{m['R2']:>8.3f}")

print(f"{'segment':<44}{'n':>8}{'MdAPE':>10}{'MAPE':>10}{'±20%':>10}{'R2':>8}")
print("-" * 90)
row("ALL", np.ones(len(test), bool))
print()
for t in test.collateral_type.unique():
    row(f"type: {t[:36]}", (test.collateral_type == t).to_numpy())
print()
for p in ["กรุงเทพมหานคร", "นนทบุรี", "สมุทรปราการ", "ชลบุรี", "เชียงใหม่"]:
    row(f"province: {p}", (test.province == p).to_numpy())
print()
q = test.area_sqm
for lo, hi, lbl in [(0, 60, "<60"), (60, 150, "60-150"), (150, 400, "150-400"),
                    (400, 1500, "400-1500"), (1500, 1e9, ">1500")]:
    row(f"area {lbl} sqm", ((q >= lo) & (q < hi)).to_numpy())
print()
v = test[TARGET]
for lo, hi, lbl in [(0, 2e6, "<2M"), (2e6, 5e6, "2-5M"), (5e6, 15e6, "5-15M"),
                    (15e6, 1e12, ">15M")]:
    row(f"value {lbl} THB", ((v >= lo) & (v < hi)).to_numpy())
