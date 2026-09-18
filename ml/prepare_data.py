"""
Load and clean the scraped dotproperty listings (Data/dotproperty_listings.csv).

The appraisal parquet this pipeline was written for is not on this machine, so
load_raw() reshapes the listings into the same 7-column frame instead. The
target is the asking price (price_thb), not a recorded appraisal. Six columns
are usable as features: collateral_type, district, province, area_sqm, n_units
(always 1 - listings have no unit count), year (from date_posted).

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

from pathlib import Path
import numpy as np
import pandas as pd

DATA_PATH = Path(__file__).parent.parent / "Data/dotproperty_listings.csv"

# Listing types the app prices. Shops, warehouses, hotels etc. are dropped.
PROPERTY_TYPES = ("คอนโด", "บ้านเดี่ยว", "ทาวน์เฮ้าส์", "ที่ดิน")

CATEGORICAL = ["collateral_type", "province", "district"]
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
]
FEATURES = CATEGORICAL + NUMERIC
TARGET = "appraisal_value"

# Appraisals below this are data-entry noise (the raw min is 0.01 THB).
MIN_VALUE = 50_000
# Above this the rows are portfolios/estates, not the homes this app values.
MAX_VALUE = 200_000_000
MIN_AREA = 10.0
MAX_AREA = 20_000.0

# Held out for testing: the most recent year the model has never seen.
# Listings are concentrated in 2568-2569, so only one year can be spared.
TEST_YEARS = (2569,)

# Comparable lookups, narrowest first. Each is shrunk toward the next one out.
CELL = ["province", "district", "collateral_type"]
EXACT_KEY = CELL + ["n_units", "area_sqm"]
AREA_KEY = CELL + ["area_sqm"]
BAND_KEY = CELL + ["area_bin"]
# Width of a log-area band, ~28% either side - wide enough to hold neighbours,
# narrow enough that a plot and an estate never share one.
BAND_WIDTH = 0.25
# Rows needed before a cell's own median outweighs its parent's, per level.
# The narrower the cell the fewer rows it has, so it is trusted sooner.
SHRINK = {"prov_type": 20.0, "district": 20.0, "dt": 20.0, "band": 5.0, "exact": 2.0}


def load_raw() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH, usecols=[
        "project_name", "property_type", "bedrooms", "area_sqm", "price_thb",
        "district", "province", "date_posted",
    ])
    df = df[df["property_type"].isin(PROPERTY_TYPES)].dropna(subset=["date_posted"])
    # The same unit is often re-posted; keep one copy so it cannot sit in both
    # train and test.
    df = df.drop_duplicates(
        ["project_name", "property_type", "area_sqm", "price_thb", "bedrooms", "district"],
        keep="last")
    return pd.DataFrame({
        "collateral_type": df["property_type"],
        "province": df["province"],
        "district": df["district"],
        "area_sqm": df["area_sqm"],
        "n_units": 1,
        "year": (pd.to_datetime(df["date_posted"], utc=True).dt.year + 543).astype(int),
        TARGET: df["price_thb"],
    })


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


def split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Time-based split: train on older years, test on the newest.

    A random split would let the model see 2569 comparables while predicting
    2569, which flatters the score and is not how the app is used.
    """
    test = df[df["year"].isin(TEST_YEARS)]
    train = df[~df["year"].isin(TEST_YEARS)]
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
        "global": float(h["lppsqm"].median()),
        "type": h.groupby("collateral_type")["lppsqm"].median(),
        "province": h.groupby("province")["lppsqm"].median(),
        "prov_type": table(["province", "collateral_type"]),
        "district": table(["province", "district"]),
        "dt": table(CELL, extra=True),
        "band": table(BAND_KEY),
        "exact": table(EXACT_KEY),
        # Sorted once here so add_features can merge_asof against it directly.
        "by_area": (h.groupby(AREA_KEY)["lppsqm"].median().reset_index()
                    .rename(columns={"lppsqm": "nn_ppsqm", "area_sqm": "nn_area"})
                    .sort_values("nn_area")),
    }


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
    band_n = lookup(ref["band"], BAND_KEY, "n")
    band = _shrink(lookup(ref["band"], BAND_KEY, "med"), band_n, dt, SHRINK["band"])
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
    out["band_ppsqm"] = band
    out["band_n"] = np.nan_to_num(band_n)
    out["comp_ppsqm"] = exact
    out["comp_n"] = np.nan_to_num(exact_n)
    year = out["year"].to_numpy(dtype=float)
    out["comp_age"] = year - np.where(np.isnan(exact_last), year, exact_last)
    # How far this exact size sits from the district's going rate. Positive
    # means the size itself carries a premium the district median misses.
    out["comp_gap"] = exact - dt
    return out


def build_training_frame(train: pd.DataFrame) -> pd.DataFrame:
    """Feature rows for fitting, each described only by earlier years.

    Building the comparable tables from the whole training set would let a row
    look itself up and the models would learn to copy an answer they will not
    have at serve time. Each year is described by the years before it instead,
    which costs the earliest year - it has no history and is dropped.
    """
    years = sorted(train["year"].unique())
    parts = [add_features(train[train["year"] == y], build_reference(train[train["year"] < y]))
             for y in years[1:]]
    return pd.concat(parts, ignore_index=True)


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
