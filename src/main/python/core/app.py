"""
INPUT:  HTTP 請求（GET /health、POST /valuate）
OUTPUT: JSON 回應
POS:    FastAPI 進入點（port 8001）

啟動方式：
    cd <project_root>
    uvicorn src.main.python.core.app:app --port 8001 --reload

或透過 npm script（未來整合）：
    npm run start:valuation
"""

import sys
import os

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from src.main.python.models.valuation_schema import ValuationRequest, ValuationResult
from src.main.python.services.valuationService import valuate


class XGBoostExplainRequest(BaseModel):
    """XGBoost 估價白話解釋請求"""
    district:       str   = Field(..., description="行政區")
    building_type:  str   = Field(..., description="建物型態")
    area_ping:      float = Field(..., gt=0)
    property_age:   int   = Field(..., ge=0)
    floor:          int   = Field(..., ge=1)
    price_per_ping: float = Field(..., gt=0, description="估計單價（元/坪）")
    estimated_value: float = Field(..., gt=0, description="估計市值（元）")
    ltv_ratio:      float = Field(..., ge=0, description="LTV 比率")
    risk_level:     str   = Field(..., description="風險評級")
    loan_amount:    float = Field(..., gt=0, description="申請貸款金額（元）")


class XGBoostValuationRequest(BaseModel):
    """XGBoost 個別物件鑑價請求（輸入地址行政區 + 物件屬性）"""
    district:      str   = Field(..., description="行政區（如：信義區、板橋區）")
    building_type: str   = Field(..., description="建物型態：大樓/華廈/公寓/透天/別墅")
    area_ping:     float = Field(..., gt=0, description="坪數")
    property_age:  int   = Field(..., ge=0, le=80, description="屋齡（年）")
    floor:         int   = Field(..., ge=1, le=99, description="樓層")
    total_floors:  int   = Field(..., ge=1, le=99, description="總樓層數")
    has_parking:   bool  = Field(..., description="是否含車位")
    rooms:         int   = Field(default=3, ge=0, le=10, description="房間數")
    loan_amount:   float = Field(..., gt=0, description="申請貸款金額（元）")

app = FastAPI(
    title       = "ML 鑑價 SubAgent",
    description = "台灣房貸鑑價引擎：Demo LSTM + Demo RF+SDE + 完整 GBM Monte Carlo",
    version     = "1.0.0",
)

# CORS（允許 Node.js 後端呼叫）
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["GET", "POST"],
    allow_headers  = ["*"],
)


@app.get("/health")
async def health_check() -> dict:
    """服務健康檢查"""
    return {
        "status":  "ok",
        "service": "ML 鑑價 SubAgent",
        "mode":    "production",
        "port":    8001,
    }


@app.post("/valuate", response_model=ValuationResult)
async def valuate_property(request: ValuationRequest) -> ValuationResult:
    """
    房產鑑價 API

    Request Body（snake_case）：
        - area_ping:      坪數（float，>0）
        - property_age:   屋齡（int，0~80）
        - building_type:  建物類型（大樓/華廈/公寓/透天/別墅）
        - floor:          樓層（int，1~99）
        - has_parking:    是否含車位（bool）
        - layout:         格局（str，例：3房2廳）
        - region:         縣市（str，例：台北市）
        - loan_amount:    申請貸款金額（float，元）

    Returns:
        ValuationResult（JSON）
    """
    try:
        result = valuate(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"鑑價計算失敗：{str(e)}")


@app.post("/valuate/xgboost")
async def valuate_xgboost_property(request: XGBoostValuationRequest) -> dict:
    """
    XGBoost 個別物件鑑價 API（實價登錄訓練）

    Request Body：
        - district:      行政區（如：信義區）
        - building_type: 建物型態（大樓/華廈/公寓/透天/別墅）
        - area_ping:     坪數
        - property_age:  屋齡（年）
        - floor:         樓層
        - total_floors:  總樓層數
        - has_parking:   是否含車位
        - rooms:         房間數（預設 3）
        - loan_amount:   申請貸款金額（元）

    Returns:
        { estimated_value, confidence_interval, ltv_ratio, risk_level,
          price_per_ping, model }
    """
    try:
        from src.main.python.services.xgboostValuationService import valuate_xgboost
        result = valuate_xgboost(
            district      = request.district,
            building_type = request.building_type,
            area_ping     = request.area_ping,
            property_age  = request.property_age,
            floor         = request.floor,
            total_floors  = request.total_floors,
            has_parking   = request.has_parking,
            rooms         = request.rooms,
            loan_amount   = request.loan_amount,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"XGBoost 鑑價失敗：{str(e)}")


@app.post("/valuate/xgboost/explain")
async def explain_xgboost_valuation(request: XGBoostExplainRequest) -> dict:
    """
    Qwen2.5 白話解釋 XGBoost 估價結果

    呼叫本地 Ollama Qwen2.5 模型，產生 2-3 段中文說明。
    若 Ollama 未啟動，回傳 explanation: ""（不中斷主流程）。
    """
    from src.main.python.services.xgboostValuationService import explain_valuation_zh
    explanation = explain_valuation_zh(
        district        = request.district,
        building_type   = request.building_type,
        area_ping       = request.area_ping,
        property_age    = request.property_age,
        floor           = request.floor,
        price_per_ping  = request.price_per_ping,
        estimated_value = request.estimated_value,
        ltv_ratio       = request.ltv_ratio,
        risk_level      = request.risk_level,
        loan_amount     = request.loan_amount,
    )
    return {"explanation": explanation}
