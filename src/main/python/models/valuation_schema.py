"""
INPUT:  HTTP JSON Body
OUTPUT: ValuationRequest（輸入驗證）、ValuationResult（API 回應）
POS:    資料模型層，定義鑑價引擎的 Pydantic Schema
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal


class ValuationRequest(BaseModel):
    """鑑價請求 Schema（對應 POST /valuate body）"""

    area_ping: float = Field(..., gt=0, le=1000, description="坪數（大於 0，不超過 1000）")
    property_age: int = Field(..., ge=0, le=80, description="屋齡（年）")
    building_type: str = Field(..., description="建物類型：大樓 / 華廈 / 公寓 / 透天 / 別墅")
    floor: int = Field(..., ge=1, le=99, description="樓層")
    has_parking: bool = Field(..., description="是否含車位")
    layout: str = Field(..., min_length=2, description="格局（例：3房2廳）")
    region: str = Field(..., min_length=2, description="縣市名稱（例：台北市）")
    loan_amount: float = Field(..., gt=0, description="申請貸款金額（元）")

    @field_validator("building_type")
    @classmethod
    def validate_building_type(cls, v: str) -> str:
        allowed = {"大樓", "華廈", "公寓", "透天", "別墅"}
        if v not in allowed:
            raise ValueError(f"建物類型須為：{', '.join(sorted(allowed))}")
        return v


class ValuationConfidenceInterval(BaseModel):
    """蒙地卡羅信心區間"""

    p5: float = Field(..., description="P5 悲觀估值（元）")
    p50: float = Field(..., description="P50 中位估值（元）")
    p95: float = Field(..., description="P95 樂觀估值（元）")


class ValuationResult(BaseModel):
    """鑑價結果 Schema（API 回應）"""

    # 核心估值
    estimated_value: float = Field(..., description="建議鑑估值（P50，元）")
    confidence_interval: ValuationConfidenceInterval = Field(..., description="蒙地卡羅信心區間")

    # 風險評估
    ltv_ratio: float = Field(..., description="貸款成數（loan_amount / estimated_value）")
    risk_level: Literal["低風險", "中風險", "高風險"] = Field(..., description="風險等級")

    # 模型分數
    lstm_index: float = Field(..., description="LSTM 市場指數（Demo：線性趨勢近似）")
    sentiment_score: float = Field(..., ge=-1.0, le=1.0, description="RF+SDE 情緒分數（-1 ~ 1）")

    # 基準值明細
    base_value: float = Field(..., description="基準估值（未套用市場指數，元）")
    breakdown: dict = Field(..., description="各係數明細")

    # 元資料
    mode: Literal["demo", "production"] = Field(default="demo", description="運算模式")
    region: str = Field(..., description="縣市")
    building_type: str = Field(..., description="建物類型")
