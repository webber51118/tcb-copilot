"""
INPUT:  ValuationRequest（來自 FastAPI 路由）
OUTPUT: ValuationResult（完整鑑價結果）
POS:    服務層 — 三層模型協調器
        Layer 1: region_price_table → base_value
        Layer 2: demo_lstm          → lstm_adjusted_value
        Layer 3: demo_rf_sde        → rf_adjusted_value
        Layer 4: monte_carlo        → confidence_interval + risk_level
"""

import sys
import os

# 確保從任意工作目錄執行時 Python 路徑正確
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from src.main.python.utils.region_price_table import calculate_base_value
from src.main.python.inference.demo_lstm import run_demo_lstm
from src.main.python.inference.demo_rf_sde import run_demo_rf_sde
from src.main.python.inference.monte_carlo import run_monte_carlo
from src.main.python.models.valuation_schema import (
    ValuationRequest,
    ValuationResult,
    ValuationConfidenceInterval,
)


def valuate(request: ValuationRequest) -> ValuationResult:
    """
    三層模型鑑價協調器

    執行順序：
        1. 計算基準估值（縣市單價 × 坪數 × 各係數）
        2. Demo LSTM：市場指數調整
        3. Demo RF+SDE：情緒分數調整
        4. Monte Carlo GBM：1000 路徑，產出 P5/P50/P95 信心區間
        5. 計算 LTV & 風險等級

    Args:
        request: ValuationRequest（已通過 Pydantic 驗證）

    Returns:
        ValuationResult
    """
    # ── Layer 1：基準估值 ──────────────────────────────────────
    base_value, breakdown = calculate_base_value(
        region        = request.region,
        building_type = request.building_type,
        property_age  = request.property_age,
        floor         = request.floor,
        layout        = request.layout,
        has_parking   = request.has_parking,
        area_ping     = request.area_ping,
    )

    # ── Layer 2：Demo LSTM 市場指數調整 ────────────────────────
    lstm_adjusted_value, lstm_index = run_demo_lstm(
        region     = request.region,
        base_value = base_value,
    )

    # ── Layer 3：Demo RF+SDE 情緒分數調整 ─────────────────────
    rf_adjusted_value, sentiment_score = run_demo_rf_sde(
        region               = request.region,
        building_type        = request.building_type,
        property_age         = request.property_age,
        lstm_adjusted_value  = lstm_adjusted_value,
    )

    # ── Layer 4：Monte Carlo GBM 信心區間 ─────────────────────
    ci, risk_level = run_monte_carlo(spot_value=rf_adjusted_value)

    # ── 後處理：LTV 計算 ───────────────────────────────────────
    estimated_value = ci.p50
    ltv_ratio = round(request.loan_amount / estimated_value, 4) if estimated_value > 0 else 1.0

    # 若 LTV > 0.8 且風險等級為低，提升至中風險
    if ltv_ratio > 0.80 and risk_level == "低風險":
        risk_level = "中風險"

    return ValuationResult(
        estimated_value     = estimated_value,
        confidence_interval = ValuationConfidenceInterval(
            p5  = ci.p5,
            p50 = ci.p50,
            p95 = ci.p95,
        ),
        ltv_ratio       = ltv_ratio,
        risk_level      = risk_level,
        lstm_index      = lstm_index,
        sentiment_score = sentiment_score,
        base_value      = base_value,
        breakdown       = breakdown,
        mode            = "demo",
        region          = request.region,
        building_type   = request.building_type,
    )
