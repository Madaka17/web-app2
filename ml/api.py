"""
Prediction API for the web app.

Serves the CatBoost + LightGBM + XGBoost ensemble trained by train_models.py on
Data/appraisal_2561-2569.parquet.

Its PRICES come from the Treasury Department's published appraisals; its ROWS
do not - Data/generate_appraisal_dataset.py invents which property was appraised
and when, because the Treasury publishes price levels rather than a transaction
history. So a figure here is the right order of magnitude for that district and
type, and is not a record of any appraisal that took place. The strings below
say exactly that rather than letting the web app imply either extreme.

    GET  /api/health   liveness + what is loaded
    GET  /api/metrics  honest accuracy figures from the held-out years
    POST /api/predict  {subdistrictId, area, propertyType, nUnits?, year?}

Those five are the whole input: they are exactly the columns the training data
has. The form asks for nothing else, so no value a user types is silently
discarded.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from prepare_data import CATEGORICAL, FEATURES, add_features, to_price

HERE = Path(__file__).parent
BUNDLE = joblib.load(HERE / "models/ensemble.joblib")
# Optional: written by Data/build_market_ratio.py once listings have been
# collected. Absent is the normal state - the app then shows the appraisal on
# its own rather than a market figure it cannot back up.
_ratio_path = HERE / "models/market_ratio.json"
MARKET_RATIO = json.loads(_ratio_path.read_text(encoding="utf-8")) if _ratio_path.exists() else None
LOCATIONS = json.loads((HERE / "models/location_map.json").read_text(encoding="utf-8"))
METRICS = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))

# The web form's property choices -> the categories the model was trained on.
PROPERTY_TYPES = {
    "condo": "ห้องชุด (คอนโดมิเนียม)",
    "house": "ที่ดิน/สิ่งปลูกสร้าง/ที่ดินพร้อมสิ่งปลูกสร้าง",
    "townhome": "ที่ดิน/สิ่งปลูกสร้าง/ที่ดินพร้อมสิ่งปลูกสร้าง",
    "land": "ที่ดิน/สิ่งปลูกสร้าง/ที่ดินพร้อมสิ่งปลูกสร้าง",
}
LATEST_YEAR = max(METRICS["protocol"]["served_model_fit_years"])
# The span the appraisal data actually covers, fit years plus the held-out ones.
YEAR_MIN = min(METRICS["protocol"]["fit_years"])
YEAR_MAX = max(METRICS["protocol"]["test_years"])

MODEL_COLORS = {"CatBoost": "#f97316", "LightGBM": "#22c55e", "XGBoost": "#3b82f6"}

# Feature labels for the UI, in the model's own importance order.
FEATURE_LABELS = {
    "comp_ppsqm": ("ราคาทรัพย์ขนาดเดียวกันในอดีต", "Building2"),
    "comp2_ppsqm": ("ราคาทรัพย์ขนาดเดียวกัน", "Building2"),
    "comp_gap": ("ส่วนต่างจากค่ากลางของเขต", "Building2"),
    "comp_n": ("จำนวนทรัพย์เทียบเคียง", "Building2"),
    "comp2_n": ("จำนวนทรัพย์ขนาดเดียวกัน", "Building2"),
    "comp_age": ("อายุของข้อมูลเทียบเคียง", "CalendarClock"),
    "nn_ppsqm": ("ราคาทรัพย์ขนาดใกล้เคียงที่สุด", "Maximize"),
    "nn_dist": ("ความต่างของขนาดกับทรัพย์เทียบเคียง", "Maximize"),
    "band_ppsqm": ("ราคาต่อ ตร.ม. ของช่วงขนาดเดียวกัน", "Maximize"),
    "band_n": ("จำนวนข้อมูลในช่วงขนาด", "Maximize"),
    "dt_ppsqm": ("ราคาต่อ ตร.ม. ของเขต ตามประเภททรัพย์", "MapPin"),
    "dt_n": ("จำนวนข้อมูลของเขต", "MapPin"),
    "dt_iqr": ("การกระจายราคาในเขต", "MapPin"),
    "district_ppsqm": ("ราคาต่อ ตร.ม. ของเขต", "MapPin"),
    "province_ppsqm": ("ราคาต่อ ตร.ม. ของจังหวัด", "MapPin"),
    "prov_type_ppsqm": ("ราคาต่อ ตร.ม. ของจังหวัด ตามประเภททรัพย์", "MapPin"),
    "type_ppsqm": ("ราคาต่อ ตร.ม. ตามประเภททรัพย์", "Building2"),
    "area_sqm": ("พื้นที่ใช้สอย", "Maximize"),
    "log_area": ("พื้นที่ใช้สอย (log)", "Maximize"),
    "area_per_unit": ("พื้นที่ต่อหน่วย", "Maximize"),
    "n_units": ("จำนวนหน่วย", "Building2"),
    "district": ("เขต / อำเภอ", "MapPin"),
    "province": ("จังหวัด", "MapPin"),
    "collateral_type": ("ประเภททรัพย์", "Building2"),
    "year": ("ปีที่ประเมิน", "CalendarClock"),
}
# The model has 23 features; a bar chart of all of them is a wall, not an
# explanation. The panel shows the ones that actually move a prediction.
FEATURES_SHOWN = 8

app = Flask(__name__)
CORS(app)


def _predict_each(frame: pd.DataFrame) -> dict[str, float]:
    """Comparables are looked up from the reference tables in the bundle, the
    same tables and the same code path the models were fitted under."""
    featured = add_features(frame, BUNDLE["reference"])
    area = featured["area_sqm"].to_numpy(dtype=float)
    X_raw = featured[FEATURES]
    X_cat = X_raw.copy()
    for c in CATEGORICAL:
        X_cat[c] = pd.Categorical(X_cat[c], categories=BUNDLE["categories"][c])
    return {
        name: float(to_price(model.predict(X_raw if name == "CatBoost" else X_cat), area)[0])
        for name, model in BUNDLE["models"].items()
    }


def market_estimate(price: float, collateral_type: str, province: str) -> dict | None:
    """Scale the appraisal by what sellers in this province are asking.

    Returns None whenever the ratio is missing or too thin to stand behind. A
    caller showing "-" is telling the truth; one showing a number built from a
    dozen listings is not.
    """
    if not MARKET_RATIO:
        return None
    cell = MARKET_RATIO["cells"].get(f"{collateral_type}|{province}")
    if cell is None:
        cell = MARKET_RATIO["__default__"]
        scope = "ค่ากลางรวมทุกจังหวัด"
    else:
        scope = f"{province} · {'คอนโด' if 'ห้องชุด' in collateral_type else 'บ้าน/ที่ดิน'}"
    return {
        "price": round(price * cell["ratio"], -3),
        "ratio": cell["ratio"],
        "listings": cell["n"],
        "scope": scope,
        "basis": "ราคาประกาศขาย ไม่ใช่ราคาที่ซื้อขายจริง",
    }


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "models": list(BUNDLE["models"]),
        "weights": {k: float(v) for k, v in BUNDLE["weights"].items()},
        "trained_on": "ราคาประเมินกรมธนารักษ์ + รายการจำลอง (Data/appraisal_2561-2569.parquet)",
        "fit_years": METRICS["protocol"]["served_model_fit_years"],
        "rows_trained": METRICS["rows"]["fit"] + METRICS["rows"]["validation"],
        "market_ratio_loaded": bool(MARKET_RATIO),
    })


@app.get("/api/metrics")
def metrics():
    return jsonify(METRICS)


@app.post("/api/predict")
def predict():
    body = request.get_json(silent=True) or {}

    try:
        area = float(body.get("area", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "area must be a number"}), 400
    if not 10 <= area <= 20000:
        return jsonify({"error": "area must be between 10 and 20000 sqm"}), 400

    subdistrict_id = str(body.get("subdistrictId", ""))
    location = LOCATIONS.get(subdistrict_id)
    if location is None:
        return jsonify({"error": f"unknown subdistrictId: {subdistrict_id}"}), 400

    key = str(body.get("propertyType", "condo"))
    if key not in PROPERTY_TYPES:
        return jsonify({"error": f"propertyType must be one of {sorted(PROPERTY_TYPES)}"}), 400
    collateral_type = PROPERTY_TYPES[key]

    try:
        n_units = max(1, min(4, int(body.get("nUnits", 1) or 1)))
        year = int(body.get("year", LATEST_YEAR))
    except (TypeError, ValueError):
        return jsonify({"error": "nUnits and year must be integers"}), 400
    if not YEAR_MIN <= year <= YEAR_MAX:
        return jsonify({"error": f"year must be between {YEAR_MIN} and {YEAR_MAX}"}), 400

    frame = pd.DataFrame([{
        "collateral_type": collateral_type,
        "province": location["province"],
        "district": location["district"],
        "area_sqm": area,
        "n_units": n_units,
        "year": year,
    }])

    per_model = _predict_each(frame)
    weights = {k: float(v) for k, v in BUNDLE["weights"].items()}
    price = sum(weights[n] * p for n, p in per_model.items())

    calib = BUNDLE["calibration"].get(collateral_type, BUNDLE["calibration"]["__default__"])
    lower, upper = price * calib["q10"], price * calib["q90"]

    market = market_estimate(price, collateral_type, location["province"])

    importance = list(METRICS["feature_importance"].items())[:FEATURES_SHOWN]
    features = [
        {"label": FEATURE_LABELS.get(k, (k, "MapPin"))[0],
         "value": v,
         "icon": FEATURE_LABELS.get(k, (k, "MapPin"))[1]}
        for k, v in importance
    ]

    return jsonify({
        "predictedPrice": round(price, -3),
        "lowerBound": round(lower, -3),
        "upperBound": round(upper, -3),
        # Share of held-out cases this segment lands within 20% - a measured
        # hit rate, not a confidence score invented for the UI.
        "confidence": round(calib["within_20pct"], 1),
        "contributions": [
            {"name": n, "weight": weights[n], "color": MODEL_COLORS[n],
             "prediction": round(p, -3)}
            for n, p in sorted(per_model.items(), key=lambda kv: -weights[kv[0]])
        ],
        "features": features,
        "market": market,
        "meta": {
            "province": location["province"],
            "district": location["district"],
            "subdistrict": location["subdistrict"],
            "district_in_training_data": location["in_training_data"],
            "collateral_type": collateral_type,
            "median_abs_pct_error": round(calib["MdAPE"], 1),
            "within_20pct": round(calib["within_20pct"], 1),
            "sample_size": calib["n"],
            "source": "ราคาอ้างอิงราคาประเมินทางการ (กรมธนารักษ์) รายการเป็นข้อมูลจำลอง",
        },
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)
