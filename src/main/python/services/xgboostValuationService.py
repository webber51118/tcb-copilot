"""
INPUT:  ValuationRequest（district, building_type, area_ping, property_age, floor, has_parking, rooms）
OUTPUT: 估價結果（estimated_value, confidence_interval, ltv_ratio, risk_level）
POS:    Day 1 推論服務 - 載入 XGBoost 模型，提供個別物件估價

依賴：models/xgboost_valuation.json、models/xgboost_encoders.pkl
模型不存在時自動降級為 Demo 模式（基於行政區查表 + Monte Carlo）
"""

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from pathlib import Path
from datetime import datetime

from src.main.python.inference.monte_carlo import run_monte_carlo
from src.main.python.utils.region_price_table import (
    DISTRICT_TO_REGION,
    DISTRICT_PRICE_MULTIPLIER,
    REGION_BASE_PRICE,
    BUILDING_TYPE_MULTIPLIER,
    age_depreciation_factor,
    floor_adjustment_factor,
)

MODEL_PATH    = Path("models/xgboost_valuation.json")
ENCODERS_PATH = Path("models/xgboost_encoders.pkl")

FEATURE_COLS = ["district", "building_type", "area_ping", "property_age",
                "floor", "total_floors", "has_parking", "rooms", "year", "quarter"]

_model    = None
_encoders = None


def _load():
    global _model, _encoders
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"找不到模型 {MODEL_PATH}，請先執行 train_xgboost.py"
            )
        _model = xgb.XGBRegressor()
        _model.load_model(str(MODEL_PATH))
        _encoders = joblib.load(ENCODERS_PATH)


def _encode(col: str, value: str) -> int:
    """對類別欄位做 Label Encoding，遇未知值回傳 0"""
    le = _encoders.get(col)
    if le is None:
        return 0
    try:
        return int(le.transform([str(value)])[0])
    except ValueError:
        # 未見過的類別：回傳最常見類別的 index（0）
        return 0


def _demo_price_per_ping(
    district: str,
    building_type: str,
    property_age: int,
    floor: int,
) -> float:
    """
    Demo 模式：以行政區查表估算單價（元/坪）

    當 XGBoost 模型尚未訓練時作為 fallback，
    使用縣市基準單價 × 行政區乘數 × 建物類型乘數 × 屋齡折舊 × 樓層係數
    """
    region      = DISTRICT_TO_REGION.get(district, "")
    unit_price  = REGION_BASE_PRICE.get(region, 20.0)           # 萬/坪
    dist_mult   = DISTRICT_PRICE_MULTIPLIER.get(district, 1.00)
    bldg_mult   = BUILDING_TYPE_MULTIPLIER.get(building_type, 1.00)
    age_factor  = age_depreciation_factor(property_age)
    flr_factor  = floor_adjustment_factor(floor, building_type)

    price_per_ping = unit_price * dist_mult * bldg_mult * age_factor * flr_factor * 10_000
    return float(price_per_ping)


def valuate_xgboost(
    district: str,
    building_type: str,
    area_ping: float,
    property_age: int,
    floor: int,
    total_floors: int,
    has_parking: bool,
    rooms: int,
    loan_amount: float,
) -> dict:
    """
    XGBoost 個別物件估價

    若模型已訓練（models/xgboost_valuation.json 存在）→ XGBoost 推論
    否則 → Demo 模式（行政區查表），確保 Hackathon Demo 可正常運作

    Returns:
        {
            estimated_value: float,          # P50 估值（元）
            confidence_interval: {p5, p50, p95},
            ltv_ratio: float,
            risk_level: str,
            price_per_ping: float,           # 估計單價（元/坪）
            model: "xgboost" | "demo"
        }
    """
    model_tag = "xgboost"

    if MODEL_PATH.exists():
        # ── 正式模式：XGBoost 推論 ──────────────────────────────
        _load()
        now     = datetime.now()
        year    = now.year
        quarter = (now.month - 1) // 3 + 1

        row = pd.DataFrame([{
            "district":      _encode("district",      district),
            "building_type": _encode("building_type", building_type),
            "area_ping":     area_ping,
            "property_age":  property_age,
            "floor":         floor,
            "total_floors":  total_floors,
            "has_parking":   int(has_parking),
            "rooms":         rooms,
            "year":          year,
            "quarter":       quarter,
        }])[FEATURE_COLS]

        log_pred       = float(_model.predict(row)[0])
        price_per_ping = float(np.expm1(log_pred))
    else:
        # ── Demo 模式：行政區查表 ────────────────────────────────
        price_per_ping = _demo_price_per_ping(district, building_type, property_age, floor)
        model_tag      = "demo"

    estimated_value = price_per_ping * area_ping

    # Monte Carlo GBM 信心區間（Layer 4）
    ci, risk_level = run_monte_carlo(spot_value=estimated_value)

    # LTV 計算
    ltv_ratio = loan_amount / ci.p50 if ci.p50 > 0 else 0.0

    # 高 LTV 升一級
    if ltv_ratio > 0.80 and risk_level == "低風險":
        risk_level = "中風險"

    return {
        "estimated_value": round(ci.p50),
        "confidence_interval": {
            "p5":  round(ci.p5),
            "p50": round(ci.p50),
            "p95": round(ci.p95),
        },
        "ltv_ratio":     round(ltv_ratio, 4),
        "risk_level":    risk_level,
        "price_per_ping": round(price_per_ping),
        "model":         model_tag,
    }
