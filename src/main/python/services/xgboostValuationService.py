"""
INPUT:  ValuationRequest（district, building_type, area_ping, property_age, floor, has_parking, rooms）
OUTPUT: 估價結果（estimated_value, confidence_interval, ltv_ratio, risk_level）
POS:    Day 1 推論服務 - 載入 XGBoost 模型，提供個別物件估價

依賴：models/xgboost_valuation.json、models/xgboost_encoders.pkl
模型不存在時自動降級為 Demo 模式（基於行政區查表 + Monte Carlo）
"""

import numpy as np
from pathlib import Path
from datetime import datetime
# pandas / xgboost / joblib 在 _load() 中延遲載入，Demo 模式不需要這些套件

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

FEATURE_LABELS = {
    "district":      "行政區",
    "building_type": "建物類型",
    "area_ping":     "坪數",
    "property_age":  "屋齡",
    "floor":         "樓層",
    "total_floors":  "總樓層數",
    "has_parking":   "車位",
    "rooms":         "房間數",
    "year":          "成交年份",
    "quarter":       "季節",
}

_model     = None
_encoders  = None
_explainer = None


def _load():
    global _model, _encoders, _explainer
    if _model is None:
        import joblib
        import xgboost as xgb
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"找不到模型 {MODEL_PATH}，請先執行 train_xgboost.py"
            )
        _model = xgb.XGBRegressor()
        _model.load_model(str(MODEL_PATH))
        _encoders = joblib.load(ENCODERS_PATH)
        try:
            import shap
            _explainer = shap.TreeExplainer(_model)
        except ImportError:
            _explainer = None


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


def _shap_factors_live(row) -> list[dict]:
    """XGBoost 模式：用 SHAP TreeExplainer 計算前三大貢獻因子。"""
    if _explainer is None:
        return []
    try:
        import shap
        shap_vals = _explainer.shap_values(row)
        vals = shap_vals[0] if isinstance(shap_vals, list) else shap_vals[0]
        total = float(np.sum(np.abs(vals))) or 1.0
        ranked = sorted(enumerate(vals), key=lambda x: abs(x[1]), reverse=True)[:3]
        result = []
        for idx, val in ranked:
            feat  = FEATURE_COLS[idx]
            ratio = round(float(val) / total, 4)
            result.append({
                "label":        FEATURE_LABELS.get(feat, feat),
                "contribution": ratio,
                "direction":    "拉高" if val > 0 else "拉低",
            })
        return result
    except Exception:
        return []


def _shap_factors_demo(property_age: int, floor: int, district: str) -> list[dict]:
    """Demo 模式：規則近似 SHAP，回傳前三大影響因子。"""
    factors = []

    age_contrib = round(-min(property_age * 0.004, 0.30), 4)
    factors.append({"label": "屋齡", "contribution": age_contrib,
                    "direction": "拉低" if age_contrib < 0 else "拉高"})

    flr_contrib = round((floor - 5) * 0.012, 4)
    factors.append({"label": "樓層", "contribution": flr_contrib,
                    "direction": "拉高" if flr_contrib > 0 else "拉低"})

    high_price = {"信義區", "大安區", "中正區", "中山區", "松山區"}
    low_price  = {"文山區", "萬華區", "北投區"}
    if district in high_price:
        dist_contrib = 0.20
    elif district in low_price:
        dist_contrib = -0.10
    else:
        dist_contrib = 0.05
    factors.append({"label": "行政區", "contribution": dist_contrib,
                    "direction": "拉高" if dist_contrib > 0 else "拉低"})

    return sorted(factors, key=lambda x: abs(x["contribution"]), reverse=True)


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
        import pandas as pd
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

        # ── SHAP 解釋（若可用）──────────────────────────────────
        shap_factors = _shap_factors_live(row)
    else:
        # ── Demo 模式：行政區查表 ────────────────────────────────
        price_per_ping = _demo_price_per_ping(district, building_type, property_age, floor)
        model_tag      = "demo"
        shap_factors   = _shap_factors_demo(property_age, floor, district)

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
        "ltv_ratio":      round(ltv_ratio, 4),
        "risk_level":     risk_level,
        "price_per_ping": round(price_per_ping),
        "model":          model_tag,
        "shap_factors":   shap_factors,
    }


def explain_valuation_zh(
    district: str,
    building_type: str,
    area_ping: float,
    property_age: int,
    floor: int,
    price_per_ping: float,
    estimated_value: float,
    ltv_ratio: float,
    risk_level: str,
    loan_amount: float,
    ollama_url: str = "http://127.0.0.1:11434",
    model: str = "qwen2.5:14b",
) -> str:
    """
    呼叫本地 Ollama Qwen2.5 模型，以白話中文解釋 XGBoost 估價結果。

    Returns:
        str — 2-3 段白話說明（失敗時回傳空字串，不中斷主流程）
    """
    import json as _json
    import urllib.request as _req

    prompt = f"""你是一位專業的不動產估價師，請用白話中文（2-3 段，共約 150 字）向銀行行員解釋以下估價結果，說明影響價格的主要因素，並評估貸款風險。

物件資訊：
- 行政區：{district}（{building_type}）
- 面積：{area_ping:.1f} 坪，屋齡：{property_age} 年，{floor} 樓
- 估計單價：{price_per_ping:,.0f} 元/坪
- 估計市值：{estimated_value/10000:.0f} 萬元
- 申請貸款：{loan_amount/10000:.0f} 萬元（LTV {ltv_ratio*100:.1f}%）
- 風險評級：{risk_level}

請直接輸出說明文字，不需標題或條列格式。"""

    payload = _json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 350},
    }).encode()

    try:
        req = _req.Request(
            f"{ollama_url}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with _req.urlopen(req, timeout=45) as resp:
            result = _json.loads(resp.read())
            return result.get("message", {}).get("content", "").strip()
    except Exception:
        return ""
