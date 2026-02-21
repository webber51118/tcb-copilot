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

from src.main.python.models.valuation_schema import ValuationRequest, ValuationResult
from src.main.python.services.valuationService import valuate

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
        "mode":    "demo",
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
