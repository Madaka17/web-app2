"""
Prediction API for the web app.

Serves the CatBoost + LightGBM + XGBoost ensemble trained by train_models.py on
the real appraisal data (Data real/appraisal_2561-2569.parquet).

    GET  /api/health   liveness + what is loaded
    GET  /api/metrics  honest accuracy figures from the held-out years
    POST /api/predict  {subdistrictId | lat+lng, area, propertyType, nUnits?, year?,
                        bedrooms?, bathrooms?, buildingAge?}
    GET  /api/projects ?q=&kind=village|condo&grade=&province=&district=&limit=  search projects
    GET  /api/project-areas ?kind=  provinces and districts that have projects, with counts
    GET  /api/grades                village and condo grades, compared
    GET  /api/estate                in-estate price premium, measured per type
    GET  /api/nearby   ?lat=&lng=&radius=1000|2000&type=condo&buildingAge=
                       what listings within the radius ask, per sqm, with an
                       optional building-age (ค่าเสื่อม) adjustment

Every input maps onto a column the training data has; the optional ones are
treated as unknown when absent, exactly as unstated listings were in training.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from estate import ESTATE_TYPES, IN_ESTATE, OUT_ESTATE
from prepare_data import CATEGORICAL, EARTH_M, FEATURES, GEO_RADII_M, _squash, add_features, to_price

HERE = Path(__file__).parent
BUNDLE = joblib.load(HERE / "models/ensemble.joblib")
LOCATIONS = json.loads((HERE / "models/location_map.json").read_text(encoding="utf-8"))
METRICS = json.loads((HERE / "models/metrics.json").read_text(encoding="utf-8"))
# Built by projects.py; independent of the models, so it can be refreshed alone.
# Without it the API still prices; only village search and grades come back empty.
_project_file = HERE / "models/projects.json"
PROJECT_INDEX = (json.loads(_project_file.read_text(encoding="utf-8")) if _project_file.exists()
                 else {"min_listings": 0, "projects": [], "grades": {"village": [], "condo": []}})

# The web form's property choices -> the categories the model was trained on.
PROPERTY_TYPES = {
    "condo": "คอนโด",
    "house": "บ้านเดี่ยว",
    "townhome": "ทาวน์เฮ้าส์",
    "land": "ที่ดิน",
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
    "sd_ppsqm": ("ราคาต่อ ตร.ม. ของแขวง", "MapPin"),
    "sd_n": ("จำนวนข้อมูลของแขวง", "MapPin"),
    "sub_district": ("แขวง / ตำบล", "MapPin"),
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
    "proj_ppsqm": ("ราคาต่อ ตร.ม. ในโครงการเดียวกัน", "Building2"),
    "proj_n": ("จำนวนประกาศในโครงการเดียวกัน", "Building2"),
    "geo1_ppsqm": ("ราคาต่อ ตร.ม. ในรัศมี 1 กม.", "MapPin"),
    "geo1_n": ("จำนวนประกาศในรัศมี 1 กม.", "MapPin"),
    "geo2_ppsqm": ("ราคาต่อ ตร.ม. ในรัศมี 2 กม.", "MapPin"),
    "geo2_n": ("จำนวนประกาศในรัศมี 2 กม.", "MapPin"),
    "knn_ppsqm": ("ราคาต่อ ตร.ม. ของ 15 ประกาศที่ใกล้ที่สุด", "MapPin"),
    "knn_dist_m": ("ระยะถึงประกาศเทียบเคียง", "MapPin"),
    "latitude": ("ละติจูด", "MapPin"),
    "longitude": ("ลองจิจูด", "MapPin"),
    "bedrooms": ("ห้องนอน", "BedDouble"),
    "bathrooms": ("ห้องน้ำ", "Bath"),
    "building_age": ("อายุอาคาร (ค่าเสื่อม)", "CalendarClock"),
    "transit_m": ("ระยะถึงรถไฟฟ้า", "MapPin"),
    "estate": ("อยู่ในหมู่บ้านจัดสรรหรือไม่", "Home"),
}
# The model has 42 features; a bar chart of all of them is a wall, not an
# explanation. The panel shows the ones that actually move a prediction.
FEATURES_SHOWN = 8

TYPE_LABELS = {v: k for k, v in PROPERTY_TYPES.items()}
POINTS = BUNDLE["points"]
PROJECTS = PROJECT_INDEX["projects"]
PROJECTS_BY_KEY = {p["key"]: p for p in PROJECTS if p["kind"] == "village"}
# Searchable text per project: its name (both halves) and where it is.
PROJECT_SEARCH = [(_squash(f"{p['name']}{p['key']}"), _squash(f"{p['district']}{p['sub_district']}"), p)
                  for p in PROJECTS]
ESTATE_VALUES = {"in": IN_ESTATE, "out": OUT_ESTATE}


def depreciation_factor(age: float) -> float:
    """Price relative to a new building, from the measured curve in the bundle."""
    for r in BUNDLE["depreciation"]:
        if r["age_lo"] <= age <= r["age_hi"]:
            return r["factor"]
    return BUNDLE["depreciation"][-1]["factor"] if age > 0 and BUNDLE["depreciation"] else 1.0


# Share cut from each end before averaging nearby listings: one mansion or a
# mistyped price would otherwise move a small sample's mean by millions.
NEARBY_TRIM = 0.1


def trimmed_mean(values: np.ndarray, trim: float = NEARBY_TRIM) -> float:
    v = np.sort(values)
    k = int(len(v) * trim)
    return float(v[k:len(v) - k].mean())


def nearest_location(lat: float, lng: float) -> dict:
    """The sub-district of the closest pinned listing - where a map click lands."""
    _, ix = BUNDLE["locator"].query(np.radians([[lat, lng]]), k=1)
    p = POINTS.iloc[int(ix[0][0])]
    return {"province": p["province"], "district": p["district"],
            "subdistrict": p["sub_district"], "in_training_data": True}


def _optional_float(body: dict, key: str, lo: float, hi: float) -> float | None:
    """None when absent; ValueError when present but not a number in [lo, hi]."""
    raw = body.get(key)
    if raw in (None, ""):
        return None
    value = float(raw)
    if not lo <= value <= hi:
        raise ValueError(f"{key} must be between {lo:g} and {hi:g}")
    return value


app = Flask(__name__)
CORS(app)


def _predict_each(featured: pd.DataFrame) -> dict[str, float]:
    """Comparables are looked up from the reference tables in the bundle, the
    same tables and the same code path the models were fitted under."""
    area = featured["area_sqm"].to_numpy(dtype=float)
    X_raw = featured[FEATURES]
    X_cat = X_raw.copy()
    for c in CATEGORICAL:
        X_cat[c] = pd.Categorical(X_cat[c], categories=BUNDLE["categories"][c])
    return {
        name: float(to_price(model.predict(X_raw if name == "CatBoost" else X_cat), area)[0])
        for name, model in BUNDLE["models"].items()
    }


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "models": list(BUNDLE["models"]),
        "weights": {k: float(v) for k, v in BUNDLE["weights"].items()},
        "trained_on": "Data/{dotproperty,ddproperty,hipflat,baania}_listings.csv",
        "fit_years": METRICS["protocol"]["served_model_fit_years"],
        "rows_trained": METRICS["rows"]["fit"] + METRICS["rows"]["validation"],
    })


@app.get("/api/projects")
def projects():
    """Villages (หมู่บ้านจัดสรร, the default) or condo projects whose name - or
    district - contains the query, best first: a name that starts with it,
    then one that contains it, then a district match; ties go to the project
    with more listings behind its figures. An empty query lists the largest."""
    q = _squash(request.args.get("q", ""))
    kind = request.args.get("kind", "village")
    want_grade = request.args.get("grade") or None
    want_province = request.args.get("province") or None
    want_district = request.args.get("district") or None
    if kind not in ("village", "condo"):
        return jsonify({"error": "kind must be village or condo"}), 400
    try:
        limit = max(1, min(200, int(request.args.get("limit", 12))))
    except ValueError:
        limit = 12
    hits = []
    for name, place, p in PROJECT_SEARCH:
        if p["kind"] != kind or (want_grade and p["grade"] != want_grade):
            continue
        if (want_province and p["province"] != want_province) or (want_district and p["district"] != want_district):
            continue
        if not q:
            rank = 0
        elif name.startswith(q):
            rank = 0
        elif q in name:
            rank = 1
        elif q in place:
            rank = 2
        else:
            continue
        hits.append((rank, -p["n"], p))
    hits.sort(key=lambda h: h[:2])
    return jsonify({"total": len(hits), "results": [h[2] for h in hits[:limit]]})


@app.get("/api/project-areas")
def project_areas():
    """Provinces, and the districts within them, that have projects of this
    kind - the village search's จังหวัด / อำเภอ filters - largest first."""
    kind = request.args.get("kind", "village")
    counts: dict[str, dict[str, int]] = {}
    for p in PROJECTS:
        if p["kind"] == kind:
            d = counts.setdefault(p["province"], {})
            d[p["district"]] = d.get(p["district"], 0) + 1
    areas = [{"province": prov, "n": sum(ds.values()),
              "districts": [{"district": k, "n": v} for k, v in sorted(ds.items(), key=lambda kv: -kv[1])]}
             for prov, ds in counts.items()]
    return jsonify(sorted(areas, key=lambda a: -a["n"]))


@app.get("/api/estate")
def estate():
    """What being inside a หมู่บ้านจัดสรร is worth, per sqm, measured against
    comparable listings (same type, sub-district and size band)."""
    return jsonify({"premium": METRICS.get("estate_premium", {}),
                    "views": METRICS.get("estate_views", {}),
                    "estates": len(PROJECTS_BY_KEY)})


@app.get("/api/grades")
def grades():
    """Villages graded by median asking price, condos by median baht per sqm,
    each grade with what its listings say about transit, security and
    management (projects.py)."""
    return jsonify({"min_listings": PROJECT_INDEX["min_listings"], **PROJECT_INDEX["grades"]})


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

    try:
        lat = _optional_float(body, "lat", -90, 90)
        lng = _optional_float(body, "lng", -180, 180)
        bedrooms = _optional_float(body, "bedrooms", 0, 20)
        bathrooms = _optional_float(body, "bathrooms", 0, 20)
        building_age = _optional_float(body, "buildingAge", 0, 100)
    except (TypeError, ValueError) as e:
        return jsonify({"error": str(e)}), 400
    if (lat is None) != (lng is None):
        return jsonify({"error": "lat and lng must be given together"}), 400

    # A chosen หมู่บ้าน names the project outright; without a click its pin
    # stands in for the location.
    project_key = body.get("project") or None
    estate_project = None
    if project_key is not None:
        estate_project = PROJECTS_BY_KEY.get(str(project_key))
        if estate_project is None:
            return jsonify({"error": f"unknown project: {project_key}"}), 400
        if lat is None and estate_project["lat"] is not None:
            lat, lng = estate_project["lat"], estate_project["lng"]
    estate_raw = body.get("estate") or None
    if estate_project is not None:
        estate_raw = "in"
    if estate_raw is not None and estate_raw not in ESTATE_VALUES:
        return jsonify({"error": "estate must be 'in', 'out' or omitted"}), 400

    # A map click is more precise than the dropdown, so it wins when both are sent.
    subdistrict_id = str(body.get("subdistrictId") or "")
    if lat is not None:
        location = nearest_location(lat, lng)
    else:
        location = LOCATIONS.get(subdistrict_id)
        if location is None:
            return jsonify({"error": f"unknown subdistrictId: {subdistrict_id}"}), 400

    key = str(body.get("propertyType", "condo"))
    if key not in PROPERTY_TYPES:
        return jsonify({"error": f"propertyType must be one of {sorted(PROPERTY_TYPES)}"}), 400
    collateral_type = PROPERTY_TYPES[key]
    # Estates are a house and townhouse thing; for a condo or land it is ignored.
    if collateral_type not in ESTATE_TYPES:
        estate_raw, project_key = None, None

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
        "sub_district": location["subdistrict"],
        "area_sqm": area,
        "n_units": n_units,
        "year": year,
        "latitude": lat,
        "longitude": lng,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "building_age": building_age,
        "project_key": project_key,
        "estate": ESTATE_VALUES[estate_raw] if estate_raw else np.nan,
    }])

    featured = add_features(frame, BUNDLE["reference"])
    per_model = _predict_each(featured)
    weights = {k: float(v) for k, v in BUNDLE["weights"].items()}
    price = sum(weights[n] * p for n, p in per_model.items())

    # Outside a หมู่บ้านจัดสรร. The models barely use the flag (0.2% importance):
    # a house's comparables are mostly estate listings, so the prediction sits
    # at estate level (held-out estate houses: actual/predicted 1.00), and the
    # few listings that say "outside" (278) cannot teach a tree much. So the
    # measured gap (estate.estate_premium, in vs stated outside, same type,
    # district and size) is applied here, like ค่าเสื่อม on the map.
    estate_adjustment = None
    premium = METRICS.get("estate_premium", {}).get(collateral_type)
    if estate_raw == "out" and premium and premium.get("vs_out"):
        factor = 1 / (1 + premium["vs_out"]["pct"] / 100)
        price *= factor
        per_model = {n: p * factor for n, p in per_model.items()}
        estate_adjustment = {"factor": round(factor, 4), "pct": round((factor - 1) * 100, 1),
                             "basis": premium["vs_out"]}

    # The comparables the models were handed, back in baht per sqm, so the UI
    # can say what the district goes for and how far this estimate sits from it.
    f = featured.iloc[0]
    ppsqm = lambda col: round(float(np.exp(f[col])), -2)
    district_ppsqm = ppsqm("dt_ppsqm")
    comparables = {
        "district_ppsqm": district_ppsqm,
        "district_n": int(f["dt_n"]),
        "subdistrict_ppsqm": ppsqm("sd_ppsqm"),
        "subdistrict_n": int(f["sd_n"]),
        "size_band_ppsqm": ppsqm("band_ppsqm"),
        "size_band_n": int(f["band_n"]),
        "exact_size_ppsqm": ppsqm("comp_ppsqm"),
        "exact_size_n": int(f["comp_n"]),
        "nearest_size_ppsqm": ppsqm("nn_ppsqm"),
        "province_type_ppsqm": ppsqm("prov_type_ppsqm"),
        "predicted_ppsqm": round(price / area, -2),
        "vs_district_pct": round((price / area / district_ppsqm - 1) * 100, 1),
    }

    # A map click prices far more tightly than the dropdown alone; each has its
    # own measured interval (calibrate.py).
    table = BUNDLE["calibration"] if lat is not None else BUNDLE["calibration_dropdown"]
    calib = table.get(collateral_type, table["__default__"])
    snapped = f["project_key"]
    project = BUNDLE["project_names"].get(snapped, snapped) if isinstance(snapped, str) else None
    estate_used = {IN_ESTATE: "in", OUT_ESTATE: "out"}.get(float(f["estate"]))
    lower, upper = price * calib["q10"], price * calib["q90"]

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
        "comparables": comparables,
        "meta": {
            "project": project,
            "estate": estate_used,
            "estate_premium": premium,
            "estate_adjustment": estate_adjustment,
            "location_from": ("project" if estate_project is not None and body.get("lat") in (None, "")
                              else "map" if lat is not None else "subdistrict"),
            "province": location["province"],
            "district": location["district"],
            "subdistrict": location["subdistrict"],
            "district_in_training_data": location["in_training_data"],
            "collateral_type": collateral_type,
            "median_abs_pct_error": round(calib["MdAPE"], 1),
            "within_20pct": round(calib["within_20pct"], 1),
            "sample_size": calib["n"],
            "source": "asking prices (dotproperty, ddproperty, hipflat, baania)",
        },
    })


@app.get("/api/nearby")
def nearby():
    """Asking prices within 1 or 2 km of a map click, per property type.

    With buildingAge, each listing's price per sqm is first brought back to a
    new-building equivalent (divided by its own age factor, where its age is
    known) and then aged to the requested building - so a 3-year-old condo is
    not priced off 25-year-old neighbours unadjusted.
    """
    try:
        lat = float(request.args["lat"])
        lng = float(request.args["lng"])
        radius = float(request.args.get("radius", GEO_RADII_M[0]))
        age = _optional_float(request.args, "buildingAge", 0, 100)
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": f"lat, lng required as numbers; radius 1000 or 2000; {e}"}), 400
    if radius not in GEO_RADII_M:
        return jsonify({"error": f"radius must be one of {list(GEO_RADII_M)}"}), 400
    type_key = request.args.get("type")
    if type_key and type_key not in PROPERTY_TYPES:
        return jsonify({"error": f"type must be one of {sorted(PROPERTY_TYPES)}"}), 400

    ix = BUNDLE["locator"].query_radius(np.radians([[lat, lng]]), r=radius / EARTH_M)[0]
    near = POINTS.iloc[ix]
    if type_key:
        near = near[near["type"] == PROPERTY_TYPES[type_key]]

    groups = []
    for ctype, g in near.groupby("type"):
        ppsqm = (g["price"] / g["area"]).to_numpy()
        entry = {
            "type": TYPE_LABELS.get(ctype, ctype),
            "label": ctype,
            "n": int(len(g)),
            "median_ppsqm": round(float(np.median(ppsqm)), -2),
            "p25_ppsqm": round(float(np.quantile(ppsqm, 0.25)), -2),
            "p75_ppsqm": round(float(np.quantile(ppsqm, 0.75)), -2),
            "median_price": round(float(g["price"].median()), -3),
            "median_area": round(float(g["area"].median()), 1),
            "mean_price": round(trimmed_mean(g["price"].to_numpy()), -3),
            "mean_ppsqm": round(trimmed_mean(ppsqm), -2),
            "mean_area": round(trimmed_mean(g["area"].to_numpy()), 1),
            "n_with_age": int(g["age"].notna().sum()),
            "median_age": float(g["age"].median()) if g["age"].notna().any() else None,
        }
        if age is not None:
            own = g["age"].map(lambda a: depreciation_factor(a) if pd.notna(a) else np.nan)
            # Unknown age: assume the area's typical stock, i.e. no correction.
            own = own.fillna(depreciation_factor(entry["median_age"]) if entry["median_age"] is not None else 1.0)
            adjusted = ppsqm / own.to_numpy() * depreciation_factor(age)
            entry["adjusted_ppsqm"] = round(float(np.median(adjusted)), -2)
            entry["mean_adjusted_ppsqm"] = round(trimmed_mean(adjusted), -2)
            entry["age_factor"] = depreciation_factor(age)
        groups.append(entry)
    groups.sort(key=lambda e: -e["n"])

    location = nearest_location(lat, lng) if len(POINTS) else None
    return jsonify({
        "lat": lat, "lng": lng, "radius_m": radius, "buildingAge": age,
        "total": int(len(near)),
        "groups": groups,
        "location": location,
        "depreciation": BUNDLE["depreciation"],
        "trim": NEARBY_TRIM,
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3030, debug=False)
