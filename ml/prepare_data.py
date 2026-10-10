"""
Load and clean the scraped asking-price listings in Data/*_listings.csv.

The appraisal parquet this pipeline was written for is not on this machine, so
load_raw() reshapes the listings into the same 7-column frame instead. The
target is the asking price (price_thb), not a recorded appraisal. Six columns
are usable as features: collateral_type, district, province, area_sqm, n_units
(always 1 - listings have no unit count), year (from date_posted).

Sources (all Bangkok + metropolitan area, scraped 2026-09-18):
  dotproperty, ddproperty, hipflat, baania - used.
  livinginsider - NOT used: its list pages carry a marketing "zone" but no
  district, and the location map the API serves is keyed by district.
Hipflat list pages carry no posting date; those rows are dated at the scrape,
which is when they were live.

It carries NO bedroom, bathroom, floor, building-age, parking or transit-distance
column, so the models cannot learn from those even though the web form collects
them. FEATURES below is the honest list of what actually drives a prediction.

Those six columns are thin, so most of FEATURES is built here rather than read:
every row is described by what past appraisals of comparable properties came out
at. An appraiser prices a plot by finding comparable sales; the features below
are that lookup, done at four widths (same size and unit count in the same
district, same size, same size band, the whole district) so the model can learn
how far to trust each one. Comparables are always drawn from years STRICTLY
BEFORE the row being described - see build_training_frame.
"""

from __future__ import annotations

import re
from pathlib import Path

import ahocorasick
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

DATA_DIR = Path(__file__).parent.parent / "Data"
SOURCES = ("dotproperty", "ddproperty", "hipflat", "baania")
SCRAPE_DATE = "2026-09-18"

# Listing types the app prices. Shops, warehouses, hotels etc. are dropped.
PROPERTY_TYPES = ("คอนโด", "บ้านเดี่ยว", "ทาวน์เฮ้าส์", "ที่ดิน")
# Each site labels the same four types differently.
TYPE_ALIASES = {"บ้าน": "บ้านเดี่ยว", "ทาวน์โฮม": "ทาวน์เฮ้าส์"}

CATEGORICAL = ["collateral_type", "province", "district", "sub_district"]
# Hipflat list pages carry no sub-district; its rows fall back to the district.
NO_SUBDISTRICT = "ไม่ระบุ"
# Everything below is derived in add_features(); none of it is a raw column.
NUMERIC = [
    "area_sqm",
    "log_area",
    "n_units",
    "year",
    "area_per_unit",
    "type_ppsqm",
    "province_ppsqm",
    "prov_type_ppsqm",
    "district_ppsqm",
    "dt_ppsqm",
    "dt_n",
    "dt_iqr",
    "sd_ppsqm",
    "sd_n",
    "band_ppsqm",
    "band_n",
    "comp_ppsqm",
    "comp_n",
    "comp_age",
    "comp_gap",
    "comp2_ppsqm",
    "comp2_n",
    "nn_ppsqm",
    "nn_dist",
    # Unit and building facts, -1 where the listing does not say.
    "bedrooms",
    "bathrooms",
    "building_age",
    "transit_m",
    "latitude",
    "longitude",
    # Same project, and same type within walking / short-drive distance.
    "proj_ppsqm",
    "proj_n",
    "geo1_ppsqm",
    "geo1_n",
    "geo2_ppsqm",
    "geo2_n",
    "knn_ppsqm",
    "knn_dist_m",
]
FEATURES = CATEGORICAL + NUMERIC
TARGET = "appraisal_value"

# Appraisals below this are data-entry noise (the raw min is 0.01 THB).
MIN_VALUE = 50_000
# Above this the rows are portfolios/estates, not the homes this app values.
MAX_VALUE = 200_000_000
MIN_AREA = 10.0
MAX_AREA = 20_000.0
# Price per sqm outside these quantiles of its property type is a data-entry
# slip (price typed in thousands, land priced per wa, area typed in rai):
# a condo at 1,200 THB/sqm is not a cheap condo.
PPSQM_TRIM = (0.01, 0.99)
PPSQM_FLOOR = {"คอนโด": 10_000.0, "บ้านเดี่ยว": 4_000.0, "ทาวน์เฮ้าส์": 4_000.0, "ที่ดิน": 300.0}

# Held out for testing: a fixed random 20% of the most recent year. Nearly every
# listing is a 2569 snapshot of the same market, so holding out the whole year
# would leave almost nothing to fit on; a 2569 fit row is still described only
# by earlier years (build_training_frame), so it cannot look itself up.
TEST_YEARS = (2569,)
FOLD_FRACTIONS = {"test": 0.20, "val": 0.10}  # of TEST_YEARS rows; the rest fit
FOLD_SEED = 42

# Comparable lookups, narrowest first. Each is shrunk toward the next one out.
CELL = ["province", "district", "collateral_type"]
SD_KEY = ["province", "district", "sub_district", "collateral_type"]
EXACT_KEY = CELL + ["n_units", "area_sqm"]
AREA_KEY = CELL + ["area_sqm"]
BAND_KEY = CELL + ["area_bin"]
# Width of a log-area band, ~28% either side - wide enough to hold neighbours,
# narrow enough that a plot and an estate never share one.
BAND_WIDTH = 0.25
# Rows needed before a cell's own median outweighs its parent's, per level.
# The narrower the cell the fewer rows it has, so it is trusted sooner.
SHRINK = {"prov_type": 20.0, "district": 20.0, "dt": 20.0, "sd": 10.0, "band": 5.0, "exact": 2.0,
          "proj": 3.0, "geo": 5.0}

# Bangkok + ปริมณฑล bounding box; a pin outside it is a mistake.
LAT_RANGE = (13.3, 14.4)
LON_RANGE = (99.8, 101.1)
EARTH_M = 6_371_000.0
# Radii the map page reports on, and the neighbour count for the nearest-k median.
GEO_RADII_M = (1000.0, 2000.0)
# A map click within this distance of a project's pin is taken to be that project.
PROJECT_SNAP_M = 75.0
KNN_K = 15
# Out-of-fold comparables for fit rows: each row is described by the other folds.
OOF_FOLDS = 5
# Stand-in for a fact the listing does not state; trees split it off cleanly.
UNKNOWN = -1.0
# Columns load_raw provides that a serve-time row may not have.
OPTIONAL = ["bedrooms", "bathrooms", "latitude", "longitude", "project_key",
            "building_age", "transit_m"]


def _squash(text: str) -> str:
    return re.sub(r"[\s\-–_.,()'\"@&/:]+", "", text).lower()


def project_key(name) -> str | None:
    """One spelling per project across sites. ddproperty titles read
    "MUNIQ Sukhumvit 23 : มิวนีค สุขุมวิท 23", dotproperty gives the Thai half only,
    so both are reduced to the Thai half with spacing and punctuation removed."""
    if not isinstance(name, str):
        return None
    if " : " in name:
        name = name.split(" : ", 1)[1]
    key = _squash(name)
    return key or None


# Shorter names ("ไอดีโอ", "ideo") are brands, not one building.
MIN_PROJECT_KEY = 8


def _match_projects(df: pd.DataFrame) -> pd.Series:
    """Find a known project's name in the title/description of listings that
    carry none (hipflat, baania). Both the Thai and the English spelling from
    ddproperty titles are searched; the longest match whose project sits in
    the listing's own district wins, so "ลุมพินีวิลล์ รามอินทรา" beats a
    same-brand building across town."""
    known = df[df["project_key"].notna()]
    districts = known.groupby("project_key")["district"].agg(set).to_dict()
    aliases = {k: k for k in districts}
    for name, key in zip(known["project_name"], known["project_key"]):
        if isinstance(name, str) and " : " in name:
            aliases.setdefault(_squash(name.split(" : ", 1)[0]), key)
    auto = ahocorasick.Automaton()
    for alias, key in aliases.items():
        if len(alias) >= MIN_PROJECT_KEY:
            auto.add_word(alias, (len(alias), key))
    auto.make_automaton()

    found = df["project_key"].copy()
    missing = found.isna().to_numpy()
    text = (df["title"].fillna("") + " " + df["description"].fillna("")).to_numpy()
    district = df["district"].to_numpy()
    for i in np.flatnonzero(missing):
        best = None
        for _, (n, key) in auto.iter(_squash(text[i])):
            if (best is None or n > best[0]) and (
                    not isinstance(district[i], str) or district[i] in districts[key]):
                best = (n, key)
        if best:
            found.iat[i] = best[1]
    return found


def _spread_by_project(df: pd.DataFrame) -> pd.DataFrame:
    """Copy facts about a building (completion year, rail distance, coordinates)
    from the listings that state them to every listing in the same project.
    These describe the building, not the price, so sharing them leaks nothing."""
    has_key = df["project_key"].notna()
    for col in ("built_year", "transit_m", "latitude", "longitude"):
        per_project = df[has_key].groupby("project_key")[col].median()
        fill = df["project_key"].map(per_project)
        df[col] = df[col].fillna(fill)
    return df


def load_raw() -> pd.DataFrame:
    cols = ["project_name", "property_type", "bedrooms", "bathrooms", "area_sqm", "price_thb",
            "sub_district", "district", "province", "date_posted", "latitude", "longitude",
            "built_year", "transit_m", "title", "description"]
    parts = []
    for src in SOURCES:
        df = pd.read_csv(DATA_DIR / f"{src}_listings.csv",
                         usecols=lambda c: c in cols or c == "land_sqwa")
        df["property_type"] = df["property_type"].replace(TYPE_ALIASES)
        if "land_sqwa" in df:
            # Land listings on baania give plot size in wa only (1 wa = 4 sqm).
            land = (df["property_type"] == "ที่ดิน") & df["area_sqm"].isna()
            df.loc[land, "area_sqm"] = df.loc[land, "land_sqwa"] * 4
        if src == "hipflat":
            df["date_posted"] = df["date_posted"].fillna(SCRAPE_DATE)
        df["sub_district"] = df["sub_district"].fillna(NO_SUBDISTRICT)
        parts.append(df.reindex(columns=cols))
    df = pd.concat(parts, ignore_index=True)
    df = df[df["property_type"].isin(PROPERTY_TYPES)].dropna(subset=["date_posted"])
    # Coordinates outside Bangkok + ปริมณฑล are a mis-pinned map marker.
    off_map = ~(df["latitude"].between(*LAT_RANGE) & df["longitude"].between(*LON_RANGE))
    df.loc[off_map, ["latitude", "longitude"]] = np.nan
    df["project_key"] = df["project_name"].map(project_key)
    df["project_key"] = _match_projects(df)
    df = _spread_by_project(df)
    # The same unit is often re-posted, on one site or across sites; keep one
    # copy so it cannot sit in both train and test.
    df = df.drop_duplicates(
        ["property_type", "area_sqm", "price_thb", "bedrooms", "district"],
        keep="last")
    date = pd.to_datetime(df["date_posted"], utc=True, format="ISO8601", errors="coerce")
    df = df[date.notna()]
    year = (date[date.notna()].dt.year + 543).astype(int)
    return pd.DataFrame({
        "collateral_type": df["property_type"],
        "province": df["province"],
        "district": df["district"],
        "sub_district": df["sub_district"],
        "area_sqm": df["area_sqm"],
        "n_units": 1,
        "year": year,
        "bedrooms": df["bedrooms"],
        "bathrooms": df["bathrooms"],
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "project_key": df["project_key"],
        "project_name": df["project_name"],
        # Completion year is CE on ddproperty; age is counted at the listing year.
        "building_age": (year - 543 - df["built_year"]).clip(lower=0),
        "transit_m": df["transit_m"],
        "rent_like": _rent_like(df["title"]),
        TARGET: df["price_thb"],
    })


# A monthly price in the title ("13,000 บาทต่อเดือน") or a rent-only title is a
# rental posted into the sale feed; its price is rent, not market value.
RENT_PRICED_RE = r"ต่อเดือน|/\s*เดือน|per month|/\s*month|/\s*mo\b"
RENT_WORD_RE = r"เช่า|for rent|\brent\b"
SALE_WORD_RE = r"ขาย|sale|sell"


def _rent_like(title: pd.Series) -> pd.Series:
    t = title.fillna("").str.lower()
    priced_per_month = t.str.contains(RENT_PRICED_RE, regex=True)
    rent_only = t.str.contains(RENT_WORD_RE, regex=True) & ~t.str.contains(SALE_WORD_RE, regex=True)
    return priced_per_month | rent_only


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Drop unusable rows. Returns the cleaned frame and a report of what went."""
    n0 = len(df)
    report = {"rows_in": n0}

    df = df.dropna(subset=[TARGET, "area_sqm", "collateral_type", "district", "province"])
    report["dropped_null"] = n0 - len(df)

    n = len(df)
    df = df[(df[TARGET] >= MIN_VALUE) & (df[TARGET] <= MAX_VALUE)]
    report["dropped_value_range"] = n - len(df)

    n = len(df)
    df = df[(df["area_sqm"] >= MIN_AREA) & (df["area_sqm"] <= MAX_AREA)]
    report["dropped_area_range"] = n - len(df)

    n = len(df)
    if "rent_like" in df:
        df = df[~df["rent_like"].astype(bool)]
    # Below these baht/sqm no sale in Bangkok + ปริมณฑล exists; a monthly rent
    # typed into the price box lands here even when the title does not say so.
    floor = df["collateral_type"].map(PPSQM_FLOOR).fillna(0.0)
    df = df[df[TARGET] / df["area_sqm"] >= floor]
    report["dropped_rent"] = n - len(df)

    n = len(df)
    ppsqm = df[TARGET] / df["area_sqm"]
    lo = ppsqm.groupby(df["collateral_type"]).transform(lambda s: s.quantile(PPSQM_TRIM[0]))
    hi = ppsqm.groupby(df["collateral_type"]).transform(lambda s: s.quantile(PPSQM_TRIM[1]))
    df = df[(ppsqm >= lo) & (ppsqm <= hi)]
    report["dropped_ppsqm_tails"] = n - len(df)

    # Rare categories can't be learned and break one-hot/target encoding at
    # serve time; fold anything under 50 rows into an explicit bucket.
    n = len(df)
    for col in CATEGORICAL:
        counts = df[col].value_counts()
        rare = counts[counts < 50].index
        df.loc[df[col].isin(rare), col] = "อื่น ๆ"
    report["folded_rare_categories"] = n - len(df)

    df = df.astype({c: "string" for c in CATEGORICAL})
    for c in CATEGORICAL:
        df[c] = df[c].astype(str)

    report["rows_out"] = len(df)
    return df.reset_index(drop=True), report


def assign_folds(df: pd.DataFrame) -> pd.Series:
    """'fit' / 'val' / 'test' per row. Older years are all 'fit'; TEST_YEARS
    rows are dealt out at random with a fixed seed so every script sees the
    same held-out set."""
    fold = pd.Series("fit", index=df.index)
    recent = df.index[df["year"].isin(TEST_YEARS)]
    u = pd.Series(np.random.default_rng(FOLD_SEED).random(len(recent)), index=recent)
    fold[u.index[u < FOLD_FRACTIONS["test"]]] = "test"
    fold[u.index[(u >= FOLD_FRACTIONS["test"])
                 & (u < FOLD_FRACTIONS["test"] + FOLD_FRACTIONS["val"])]] = "val"
    return fold


def split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hold out a fixed random slice of the newest year for testing.

    The test rows and the train rows are different listings of the same 2569
    market. A training row is still only ever described by earlier years, so
    the score measures how well comparables from the past price a listing the
    model has never seen - which is how the app is used.
    """
    fold = assign_folds(df)
    test = df[fold == "test"]
    train = df[fold != "test"].assign(fold=fold[fold != "test"])
    return train.reset_index(drop=True), test.reset_index(drop=True)


# --------------------------------------------------------------------------
# target
# --------------------------------------------------------------------------
def log_ppsqm(df: pd.DataFrame) -> np.ndarray:
    """The models predict log price per sqm, not log price.

    Area explains most of the spread in appraisal_value and is already a
    feature; asking the trees to re-derive it from splits wastes their depth on
    the one thing we know exactly.
    """
    return np.log(df[TARGET].to_numpy(dtype=float) / df["area_sqm"].to_numpy(dtype=float))


def to_price(pred_log_ppsqm: np.ndarray, area: np.ndarray) -> np.ndarray:
    return np.exp(pred_log_ppsqm) * np.asarray(area, dtype=float)


# --------------------------------------------------------------------------
# comparables
# --------------------------------------------------------------------------
def _with_helpers(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    # A caller (the API, a test) may know none of these; absent means unknown.
    for col in OPTIONAL:
        if col not in out:
            out[col] = np.nan
    # merge_asof refuses to join an int column against a float one, and a
    # caller passing area as a whole number is entirely reasonable.
    out["area_sqm"] = out["area_sqm"].astype(float)
    out["log_area"] = np.log(out["area_sqm"].to_numpy(dtype=float))
    out["area_bin"] = np.round(out["log_area"] / BAND_WIDTH)
    out["area_per_unit"] = out["area_sqm"] / out["n_units"].clip(lower=1)
    return out


def build_reference(hist: pd.DataFrame) -> dict:
    """Summarise past appraisals at every lookup width. Fit on history ONLY.

    Values are medians of log price per sqm, so they stay comparable across
    property sizes and blend on a sane scale.
    """
    h = _with_helpers(hist)
    h["lppsqm"] = log_ppsqm(h)

    def table(keys: list[str], extra: bool = False) -> pd.DataFrame:
        g = h.groupby(keys)["lppsqm"]
        cols = {"med": g.median(), "n": g.size()}
        if extra:
            cols["iqr"] = g.quantile(0.75) - g.quantile(0.25)
        cols["last"] = h.groupby(keys)["year"].max()
        return pd.DataFrame(cols)

    return {
        "proj": table(["collateral_type", "project_key"]),
        "proj_pins": _project_pins(h),
        "geo": _geo_index(h),
        "global": float(h["lppsqm"].median()),
        "type": h.groupby("collateral_type")["lppsqm"].median(),
        "province": h.groupby("province")["lppsqm"].median(),
        "prov_type": table(["province", "collateral_type"]),
        "district": table(["province", "district"]),
        "dt": table(CELL, extra=True),
        "sd": table(SD_KEY),
        "band": table(BAND_KEY),
        "exact": table(EXACT_KEY),
        # Sorted once here so add_features can merge_asof against it directly.
        "by_area": (h.groupby(AREA_KEY)["lppsqm"].median().reset_index()
                    .rename(columns={"lppsqm": "nn_ppsqm", "area_sqm": "nn_area"})
                    .sort_values("nn_area")),
    }


def _project_pins(h: pd.DataFrame) -> dict | None:
    """One pin per project (median of its listings' pins), for snapping a map click."""
    pins = (h.dropna(subset=["project_key", "latitude", "longitude"])
            .groupby("project_key")[["latitude", "longitude"]].median())
    if pins.empty:
        return None
    return {"tree": BallTree(np.radians(pins.to_numpy(dtype=float)), metric="haversine"),
            "keys": pins.index.to_numpy()}


def snap_to_project(df: pd.DataFrame, ref: dict, max_m: float = PROJECT_SNAP_M) -> pd.Series:
    """Project of each pinned row with none stated: the nearest project pin
    within max_m. A click on a condo tower lands on its own project."""
    # object dtype: an all-blank column arrives as float64 and refuses strings.
    keys = (df["project_key"] if "project_key" in df else pd.Series(None, index=df.index)).astype(object)
    pins = ref.get("proj_pins")
    if pins is None or "latitude" not in df:
        return keys
    need = (keys.isna() & df["latitude"].notna() & df["longitude"].notna()).to_numpy()
    if not need.any():
        return keys
    coords = np.radians(df.loc[need, ["latitude", "longitude"]].to_numpy(dtype=float))
    dist, ix = pins["tree"].query(coords, k=1)
    hit = dist[:, 0] * EARTH_M <= max_m
    snapped = np.where(hit, pins["keys"][ix[:, 0]], None)
    keys.loc[need] = snapped
    return keys


def _geo_index(h: pd.DataFrame) -> dict:
    """Per property type: a haversine BallTree over every listing with a map pin."""
    out = {}
    pinned = h.dropna(subset=["latitude", "longitude"])
    for ptype, g in pinned.groupby("collateral_type"):
        out[ptype] = {
            "tree": BallTree(np.radians(g[["latitude", "longitude"]].to_numpy(dtype=float)),
                             metric="haversine"),
            "lppsqm": g["lppsqm"].to_numpy(dtype=float),
        }
    return out


def radius_medians(index: dict, coords_deg: np.ndarray, radius_m: float,
                   chunk: int = 4000) -> tuple[np.ndarray, np.ndarray]:
    """Median log price per sqm and count of listings within radius_m of each point."""
    med = np.full(len(coords_deg), np.nan)
    cnt = np.zeros(len(coords_deg))
    X = np.radians(coords_deg)
    for start in range(0, len(X), chunk):
        idx = index["tree"].query_radius(X[start:start + chunk], r=radius_m / EARTH_M)
        for j, ix in enumerate(idx):
            if len(ix):
                med[start + j] = np.median(index["lppsqm"][ix])
                cnt[start + j] = len(ix)
    return med, cnt


def _geo_features(out: pd.DataFrame, ref: dict, fallback: np.ndarray) -> dict:
    """Neighbourhood prices for rows with a map pin; the sub-district for the rest."""
    n = len(out)
    res = {
        "geo1_ppsqm": fallback.copy(), "geo1_n": np.zeros(n),
        "geo2_ppsqm": fallback.copy(), "geo2_n": np.zeros(n),
        # 9.0 in log space and 50 km stand for "nothing nearby on record".
        "knn_ppsqm": fallback.copy(), "knn_dist_m": np.full(n, 50_000.0),
    }
    coords = out[["latitude", "longitude"]].to_numpy(dtype=float)
    pinned = ~np.isnan(coords).any(axis=1)
    types = out["collateral_type"].to_numpy()
    for ptype, index in ref["geo"].items():
        rows = np.flatnonzero(pinned & (types == ptype))
        if not len(rows):
            continue
        for name, radius in zip(("geo1", "geo2"), GEO_RADII_M):
            med, cnt = radius_medians(index, coords[rows], radius)
            res[f"{name}_ppsqm"][rows] = _shrink(med, cnt, fallback[rows], SHRINK["geo"])
            res[f"{name}_n"][rows] = cnt
        k = min(KNN_K, len(index["lppsqm"]))
        dist, ix = index["tree"].query(np.radians(coords[rows]), k=k)
        res["knn_ppsqm"][rows] = np.median(index["lppsqm"][ix], axis=1)
        res["knn_dist_m"][rows] = dist[:, -1] * EARTH_M
    return res


def _shrink(med: np.ndarray, n: np.ndarray, parent: np.ndarray, k: float) -> np.ndarray:
    """Pull a cell's median toward its parent's until the cell has enough rows.

    A district with three condo appraisals should not override the province;
    one with three hundred should. k is the row count at which the two weigh
    the same.
    """
    n = np.nan_to_num(n)
    med = np.where(np.isnan(med), parent, med)
    return (n * med + k * parent) / (n + k)


def add_features(df: pd.DataFrame, ref: dict) -> pd.DataFrame:
    """Attach every column in NUMERIC. Never returns NaN: each lookup that
    misses falls back to the next width out, and the widest is a constant."""
    out = _with_helpers(df)
    # A pin with no project named (a map click, an unlabelled listing) takes
    # the project it sits on - the same rule at fit, test and serve time.
    out["project_key"] = snap_to_project(out, ref)
    g = ref["global"]

    def lookup(table: pd.DataFrame, keys: list[str], col: str) -> np.ndarray:
        idx = pd.MultiIndex.from_frame(out[keys])
        return table[col].reindex(idx).to_numpy(dtype=float)

    typ = out["collateral_type"].map(ref["type"]).to_numpy(dtype=float)
    typ = np.where(np.isnan(typ), g, typ)
    prov = out["province"].map(ref["province"]).to_numpy(dtype=float)
    prov = np.where(np.isnan(prov), g, prov)

    pt = _shrink(lookup(ref["prov_type"], ["province", "collateral_type"], "med"),
                 lookup(ref["prov_type"], ["province", "collateral_type"], "n"),
                 typ, SHRINK["prov_type"])
    dist = _shrink(lookup(ref["district"], ["province", "district"], "med"),
                   lookup(ref["district"], ["province", "district"], "n"),
                   prov, SHRINK["district"])
    dt_n = lookup(ref["dt"], CELL, "n")
    dt = _shrink(lookup(ref["dt"], CELL, "med"), dt_n, pt, SHRINK["dt"])
    # Sub-district (แขวง): a district's condos can differ two-fold between its
    # ends, and the web form asks for exactly this.
    sd_n = lookup(ref["sd"], SD_KEY, "n")
    sd = _shrink(lookup(ref["sd"], SD_KEY, "med"), sd_n, dt, SHRINK["sd"])
    band_n = lookup(ref["band"], BAND_KEY, "n")
    band = _shrink(lookup(ref["band"], BAND_KEY, "med"), band_n, sd, SHRINK["band"])
    exact_n = lookup(ref["exact"], EXACT_KEY, "n")
    exact = _shrink(lookup(ref["exact"], EXACT_KEY, "med"), exact_n, band, SHRINK["exact"])
    exact_last = lookup(ref["exact"], EXACT_KEY, "last")

    # Same district, type and size but any unit count - wider than `exact`.
    by_area = ref["by_area"]
    area_tab = (by_area.set_index(CELL + ["nn_area"])["nn_ppsqm"])
    idx = pd.MultiIndex.from_frame(out[AREA_KEY])
    comp2_med = area_tab.reindex(idx).to_numpy(dtype=float)
    out["comp2_n"] = (~np.isnan(comp2_med)).astype(float)
    out["comp2_ppsqm"] = np.where(np.isnan(comp2_med), dt, comp2_med)

    # The closest size on record in this district - what an appraiser reaches
    # for when nothing of exactly this size has ever been valued here.
    left = out.reset_index().sort_values("area_sqm")
    merged = pd.merge_asof(left, by_area, left_on="area_sqm", right_on="nn_area",
                           by=CELL, direction="nearest")
    merged = merged.set_index("index").reindex(out.index)
    nn = merged["nn_ppsqm"].to_numpy(dtype=float)
    nn_area = merged["nn_area"].to_numpy(dtype=float)
    out["nn_ppsqm"] = np.where(np.isnan(nn), dt, nn)
    gap = np.abs(np.log(nn_area) - out["log_area"].to_numpy(dtype=float))
    # 9.0 = "no comparable at all", further than any real size difference.
    out["nn_dist"] = np.where(np.isnan(gap), 9.0, gap)

    out["type_ppsqm"] = typ
    out["province_ppsqm"] = prov
    out["prov_type_ppsqm"] = pt
    out["district_ppsqm"] = dist
    out["dt_ppsqm"] = dt
    out["dt_n"] = np.nan_to_num(dt_n)
    out["dt_iqr"] = np.nan_to_num(lookup(ref["dt"], CELL, "iqr"))
    out["sd_ppsqm"] = sd
    out["sd_n"] = np.nan_to_num(sd_n)
    out["band_ppsqm"] = band
    out["band_n"] = np.nan_to_num(band_n)
    out["comp_ppsqm"] = exact
    out["comp_n"] = np.nan_to_num(exact_n)
    year = out["year"].to_numpy(dtype=float)
    out["comp_age"] = year - np.where(np.isnan(exact_last), year, exact_last)
    # How far this exact size sits from the district's going rate. Positive
    # means the size itself carries a premium the district median misses.
    out["comp_gap"] = exact - dt

    proj_key = ["collateral_type", "project_key"]
    proj_n = lookup(ref["proj"], proj_key, "n")
    out["proj_ppsqm"] = _shrink(lookup(ref["proj"], proj_key, "med"), proj_n, sd, SHRINK["proj"])
    out["proj_n"] = np.nan_to_num(proj_n)
    out = out.assign(**_geo_features(out, ref, sd))
    for col in ("bedrooms", "bathrooms", "building_age", "transit_m", "latitude", "longitude"):
        out[col] = out[col].astype(float).fillna(UNKNOWN)
    return out


def build_training_frame(train: pd.DataFrame) -> pd.DataFrame:
    """Feature rows for fitting, each described only by OTHER rows.

    Building the comparable tables from the whole training set would let a row
    look itself up and the models would learn to copy an answer they will not
    have at serve time. Rows are dealt into OOF_FOLDS folds and each fold is
    described by the other folds - the same position a new listing is in when
    it is priced against everything on record.

    The rows being described also have their optional facts blanked at random
    (mask_optional): the web form rarely knows the project and often not the
    rooms or a map pin, and without this the models read "unknown" as "the
    kind of listing that never states it" instead of "not told".
    """
    rng = np.random.default_rng(FOLD_SEED)
    fold = rng.integers(0, OOF_FOLDS, len(train))
    parts = [add_features(mask_optional(train[fold == k], rng), build_reference(train[fold != k]))
             for k in range(OOF_FOLDS)]
    return pd.concat(parts, ignore_index=True)


# Facts a listing may state but a user of the form may not know, blanked
# together per group, each group independently with probability MASK_P.
MASK_GROUPS = [["project_key"], ["bedrooms", "bathrooms"], ["latitude", "longitude"],
               ["building_age", "transit_m"]]
MASK_P = 0.4
# What an empty form sends: no project, rooms or building facts. A map pin may
# still be there (the user clicked), so it is kept.
FORM_HIDDEN = ["project_key", "bedrooms", "bathrooms", "building_age", "transit_m"]


def mask_optional(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    out = df.copy()
    for group in MASK_GROUPS:
        hide = rng.random(len(out)) < MASK_P
        out.loc[hide, [c for c in group if c in out]] = np.nan
    return out


def form_view(df: pd.DataFrame) -> pd.DataFrame:
    """The rows as the web form would describe them, for an honest app score."""
    return df.assign(**{c: np.nan for c in FORM_HIDDEN})


if __name__ == "__main__":
    raw = load_raw()
    df, report = clean(raw)
    train, test = split(df)
    print("cleaning report:")
    for k, v in report.items():
        print(f"  {k:26s} {v:>8,}")
    print(f"\ntrain rows {len(train):,}  (years {sorted(train.year.unique())})")
    print(f"test  rows {len(test):,}  (years {sorted(test.year.unique())})")
    print(f"\ntarget: median {df[TARGET].median():,.0f}  mean {df[TARGET].mean():,.0f}")
    print(f"area:   median {df.area_sqm.median():,.1f}")
    print(f"\ncategories: " + ", ".join(f"{c}={df[c].nunique()}" for c in CATEGORICAL))

    frame = build_training_frame(train)
    print(f"\nfeature rows {len(frame):,} (earliest year dropped: no history)")
    print(f"exact comparable found for {(frame.comp_n > 0).mean():.1%} of them")
    assert frame[FEATURES].notna().all().all(), "features must never be NaN"
