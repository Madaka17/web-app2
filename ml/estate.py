"""หมู่บ้านจัดสรร (housing estate) or not, for detached houses and townhouses.

A listing is "in" an estate when it names a project (ddproperty/dotproperty
carry the project field; the rest are matched from titles) or its text talks
about the estate - หมู่บ้าน, โครงการ, ค่าส่วนกลาง, รปภ., คลับเฮ้าส์. It is "out"
only when the text says so: บ้านสร้างเอง / ปลูกสร้างเอง, นอกโครงการ,
ไม่มีค่าส่วนกลาง and the like. Everything else is unknown - most listings simply
do not say, and silence is not evidence of either.

estate_premium() measures the price gap the way depreciation is measured:
against comparable listings, never as a raw average. A raw average mixes
outer-ring estates with inner-city shophouses and says almost nothing.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

ESTATE_TYPES = ("บ้านเดี่ยว", "ทาวน์เฮ้าส์")
IN_ESTATE = 1.0
OUT_ESTATE = 0.0

# Checked first: "หมู่บ้าน ... บ้านสร้างเอง" is a self-built house that happens to
# sit on an estate road, and is not priced like an estate home.
OUT_RE = (r"นอกโครงการ|นอกหมู่บ้าน|ไม่อยู่ในโครงการ|ไม่ได้อยู่ในโครงการ|ไม่อยู่ในหมู่บ้าน"
          r"|ไม่ได้อยู่ในหมู่บ้าน|ไม่ใช่หมู่บ้านจัดสรร|ไม่ใช่บ้านจัดสรร|ไม่มีค่าส่วนกลาง"
          r"|ปลูกสร้างเอง|บ้านสร้างเอง|บ้านปลูกเอง|สร้างเองทั้งหลัง")
IN_RE = r"หมู่บ้าน|โครงการ|village|ค่าส่วนกลาง|รปภ|คลับเฮ้าส์|clubhouse"

# Usable-area bands for matching: a 300 sqm house is not compared with a 90 sqm one.
AREA_BANDS = [0, 80, 120, 160, 220, 320, np.inf]


def estate_flag(property_type: pd.Series, project_key: pd.Series, text: pd.Series) -> pd.Series:
    """1 in an estate, 0 outside, NaN unknown or not a house type."""
    text = text.fillna("").str.lower()
    out = text.str.contains(OUT_RE)
    inside = project_key.notna() | text.str.contains(IN_RE)
    flag = pd.Series(np.nan, index=property_type.index)
    flag[inside] = IN_ESTATE
    flag[out] = OUT_ESTATE
    flag[~property_type.isin(ESTATE_TYPES)] = np.nan
    return flag


def _matched_gap(df: pd.DataFrame, other: pd.Series, by: list[str], min_n: int,
                 rng: np.random.Generator) -> dict | None:
    """Median in-estate price per sqm over the other group's, cell by cell
    (same type, place and size band), weighted by the smaller side of each cell.
    The interval resamples cells, so one odd sub-district cannot carry it."""
    inside = df["estate"] == IN_ESTATE
    keep = inside | other
    d = df[keep].assign(_in=inside[keep])
    diffs, weights = [], []
    for _, g in d.groupby(by, observed=True):
        a = g.loc[g["_in"], "ppsqm"]
        b = g.loc[~g["_in"], "ppsqm"]
        if len(a) >= min_n and len(b) >= min_n:
            diffs.append(np.log(a.median()) - np.log(b.median()))
            weights.append(min(len(a), len(b)))
    if len(diffs) < 5:
        return None
    diffs, weights = np.array(diffs), np.array(weights, dtype=float)
    est = np.average(diffs, weights=weights)
    boots = []
    for _ in range(1000):
        i = rng.integers(0, len(diffs), len(diffs))
        boots.append(np.average(diffs[i], weights=weights[i]))
    lo, hi = np.percentile(boots, [5, 95])
    pct = lambda x: round(float(np.expm1(x)) * 100, 1)
    return {"pct": pct(est), "lo": pct(lo), "hi": pct(hi),
            "cells": len(diffs), "pairs": int(weights.sum())}


def estate_premium(df: pd.DataFrame, target: str) -> dict:
    """In-estate premium per house type, against both comparison groups:
      vs_unnamed  listings that name no estate (large sample; a mix that is
                  mostly, not only, outside estates - so a lower bound)
      vs_out      listings that say they are outside one (small sample)"""
    rng = np.random.default_rng(0)
    houses = df[df["collateral_type"].isin(ESTATE_TYPES)].copy()
    houses["ppsqm"] = houses[target] / houses["area_sqm"]
    houses["band"] = pd.cut(houses["area_sqm"], AREA_BANDS)
    result = {}
    for ctype, g in [("__all__", houses)] + list(houses.groupby("collateral_type")):
        result[ctype] = {
            "n_in": int((g["estate"] == IN_ESTATE).sum()),
            "n_out": int((g["estate"] == OUT_ESTATE).sum()),
            "n_unknown": int(g["estate"].isna().sum()),
            "vs_unnamed": _matched_gap(g, g["estate"].isna(),
                                       ["collateral_type", "sub_district", "band"], 3, rng),
            # Few rows say "outside", so cells are a whole district wide.
            "vs_out": _matched_gap(g, g["estate"] == OUT_ESTATE,
                                   ["collateral_type", "district", "band"], 2, rng),
        }
    return result


# --------------------------------------------------------------------------
# Grades. Villages by their median asking price, condos by median baht/sqm -
# the bands the market uses. Below the lowest band is "entry"; a village above
# 100M stays super luxury (there is no grade above it).
# --------------------------------------------------------------------------
VILLAGE_GRADES = [  # (id, label, low, high) in baht
    ("super_luxury", "Super Luxury", 50e6, np.inf),
    ("luxury", "Luxury", 20e6, 50e6),
    ("upper_medium", "Upper Medium", 6e6, 20e6),
    ("economy", "Economy", 3e6, 6e6),
    ("entry", "ต่ำกว่า Economy", 0, 3e6),
]
CONDO_GRADES = [  # baht per sqm
    ("ultimate", "Ultimate Class", 500e3, np.inf),
    ("super_luxury", "Super Luxury", 200e3, 500e3),
    ("high", "High Class", 120e3, 200e3),
    ("main", "Main Class", 80e3, 120e3),
    ("economy", "Economy", 50e3, 80e3),
    ("entry", "ต่ำกว่า Economy", 0, 50e3),
]


def grade(value: float, bands: list[tuple]) -> str:
    for gid, _, lo, hi in bands:
        if lo <= value < hi:
            return gid
    return bands[-1][0]


# What a listing says about the things that make a village a good one. Only
# what the text states can be counted; construction quality is never stated
# in a way that can be read off a listing, so it is not scored.
SECURITY_RE = r"รปภ|รักษาความปลอดภัย|security|cctv|กล้องวงจรปิด|คีย์การ์ด|key ?card|24 ?ชม|24 ?hr|ป้อมยาม|ระบบสแกน"
JURISTIC_RE = r"นิติบุคคล|juristic|ค่าส่วนกลาง|common fee|คลับเฮ้าส์|clubhouse|สระว่ายน้ำ|ฟิตเนส|fitness"


def quality_flags(text: pd.Series) -> pd.DataFrame:
    text = text.fillna("").str.lower()
    return pd.DataFrame({"security": text.str.contains(SECURITY_RE),
                         "juristic": text.str.contains(JURISTIC_RE)}, index=text.index)
