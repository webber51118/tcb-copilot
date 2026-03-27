"""
INPUT:  ValuationRequest（district, building_type, area_ping, property_age, floor, has_parking, rooms）
OUTPUT: 估價結果（estimated_value, confidence_interval, ltv_ratio, risk_level）
POS:    Day 1 推論服務 - 載入 XGBoost 模型，提供個別物件估價

依賴：models/xgboost_valuation.json、models/xgboost_encoders.pkl
"""

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from pathlib import Path
from datetime import datetime

from src.main.python.inference.monte_carlo import run_monte_carlo

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

    Returns:
        {
            estimated_value: float,          # P50 估值（元）
            confidence_interval: {p5, p50, p95},
            ltv_ratio: float,
            risk_level: str,
            price_per_ping: float,           # 估計單價（元/坪）
            model: "xgboost"
        }
    """
    _load()

    now = datetime.now()
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

    # XGBoost 推論（log 轉換空間）
    log_pred      = float(_model.predict(row)[0])
    price_per_ping = float(np.expm1(log_pred))
    estimated_value = price_per_ping * area_ping

    # Monte Carlo 信心區間（複用現有 Layer 4）
    mc = run_monte_carlo(spot_value=estimated_value)

    ltv_ratio  = loan_amount / mc["p50"] if mc["p50"] > 0 else 0
    spread     = (mc["p95"] - mc["p5"]) / mc["p50"] if mc["p50"] > 0 else 0
    risk_level = (
        "低風險" if spread < 0.15 else
        "中風險" if spread < 0.30 else
        "高風險"
    )
    # 高 LTV 升一級
    if ltv_ratio > 0.80 and risk_level == "低風險":
        risk_level = "中風險"

    return {
        "estimated_value": round(mc["p50"]),
        "confidence_interval": {
            "p5":  round(mc["p5"]),
            "p50": round(mc["p50"]),
            "p95": round(mc["p95"]),
        },
        "ltv_ratio":     round(ltv_ratio, 4),
        "risk_level":    risk_level,
        "price_per_ping": round(price_per_ping),
        "model":         "xgboost",
    }
