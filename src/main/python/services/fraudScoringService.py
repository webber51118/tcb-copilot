"""
INPUT:  POST /score（BorrowerFeatures）
OUTPUT: { fraud_score, risk_level, top_risk_factors }
POS:    CREW 3 防詐 PILOT — ML 異常評分服務（port 8002）

啟動方式：
    uvicorn src.main.python.services.fraudScoringService:app --port 8002 --reload

模型載入策略：
    - 有訓練模型（models/fraud_xgboost.json）→ XGBoost 推論 + SHAP 解釋
    - 無模型 → Demo 模式（規則加權評分，零依賴）
"""

import sys
import os

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── Pydantic 模型 ─────────────────────────────────────────────────

class BorrowerFeatures(BaseModel):
    """防詐評分輸入特徵（對應 CREW 3 防詐 PILOT）"""
    age:                  int   = Field(..., ge=18, le=99,    description="申請人年齡")
    occupation_code:      int   = Field(..., ge=0,  le=4,     description="職業代碼：0=其他/1=軍公教/2=受薪/3=自營/4=退休")
    monthly_income:       float = Field(..., gt=0,            description="月收入（萬元）")
    credit_inquiry_count: int   = Field(..., ge=0,            description="聯徵近 2 個月查詢次數")
    existing_bank_loans:  int   = Field(..., ge=0,            description="現有銀行借款筆數")
    has_real_estate:      bool  = Field(...,                  description="是否擁有不動產")
    document_match:       bool  = Field(...,                  description="證件與 MyData 比對一致")
    lives_in_branch_county: bool = Field(...,                 description="居住於分行服務縣市")
    has_salary_transfer:  bool  = Field(...,                  description="是否為薪轉客戶")
    loan_amount_wan:      Optional[float] = Field(None, gt=0, description="申請貸款金額（萬元），選填")


class FraudScoreResponse(BaseModel):
    """防詐 ML 評分結果"""
    fraud_score:       float       = Field(..., ge=0, le=1,   description="詐欺風險分數（0=低風險，1=高風險）")
    risk_level:        str         = Field(...,               description="風險等級：low / medium / high")
    top_risk_factors:  list[dict]  = Field(...,               description="前三大風險因子（SHAP 或規則貢獻）")
    mode:              str         = Field(...,               description="推論模式：live / demo")
    model:             str         = Field(...,               description="使用模型名稱")


# ─── 模型路徑 ──────────────────────────────────────────────────────

MODEL_PATH    = Path("models/fraud_xgboost.json")
ENCODERS_PATH = Path("models/fraud_encoders.pkl")

_model    = None
_explainer = None

FEATURE_NAMES = [
    "age", "occupation_code", "monthly_income",
    "credit_inquiry_count", "existing_bank_loans",
    "has_real_estate", "document_match",
    "lives_in_branch_county", "has_salary_transfer",
]

FEATURE_LABELS = {
    "age":                  "年齡",
    "occupation_code":      "職業穩定性",
    "monthly_income":       "月收入",
    "credit_inquiry_count": "聯徵查詢次數",
    "existing_bank_loans":  "現有借款筆數",
    "has_real_estate":      "不動產擁有情形",
    "document_match":       "證件比對一致性",
    "lives_in_branch_county": "居住縣市符合性",
    "has_salary_transfer":  "薪轉往來關係",
}


def _try_load():
    """嘗試載入訓練好的 XGBoost 模型，失敗靜默返回 None。"""
    global _model, _explainer
    if _model is not None:
        return _model
    if not MODEL_PATH.exists():
        return None
    try:
        import xgboost as xgb
        m = xgb.XGBClassifier()
        m.load_model(str(MODEL_PATH))
        _model = m
        try:
            import shap
            _explainer = shap.TreeExplainer(_model)
        except ImportError:
            _explainer = None
        return _model
    except Exception:
        return None


# ─── Demo 模式規則加權評分 ─────────────────────────────────────────

# 各特徵風險貢獻（方向：+ = 增加風險，值 = 最大貢獻幅度）
_RISK_WEIGHTS: dict[str, dict] = {
    "document_match": {
        "direction": "低 = 風險",
        "contribution": lambda v: 0.35 if not v else 0.0,
        "label": "證件比對不一致",
    },
    "credit_inquiry_count": {
        "direction": "高 = 風險",
        "contribution": lambda v: min(v * 0.06, 0.25),
        "label": "聯徵查詢次數過高",
    },
    "occupation_code": {
        "direction": "0/4 = 風險",
        "contribution": lambda v: 0.15 if v in (0, 4) else 0.0,
        "label": "職業穩定性不足",
    },
    "lives_in_branch_county": {
        "direction": "低 = 風險",
        "contribution": lambda v: 0.10 if not v else 0.0,
        "label": "非服務縣市居民",
    },
    "has_salary_transfer": {
        "direction": "低 = 風險",
        "contribution": lambda v: 0.08 if not v else 0.0,
        "label": "無薪轉往來",
    },
    "existing_bank_loans": {
        "direction": "高 = 風險",
        "contribution": lambda v: min(v * 0.04, 0.15),
        "label": "現有借款筆數多",
    },
    "has_real_estate": {
        "direction": "低 = 風險（信貸）",
        "contribution": lambda v: 0.05 if not v else 0.0,
        "label": "無不動產擔保",
    },
    "monthly_income": {
        "direction": "低 = 風險",
        "contribution": lambda v: 0.08 if v < 3.0 else (0.04 if v < 5.0 else 0.0),
        "label": "月收入偏低",
    },
    "age": {
        "direction": "極高/低 = 風險",
        "contribution": lambda v: 0.07 if v >= 65 or v < 22 else 0.0,
        "label": "年齡風險（高齡或過輕）",
    },
}


def _demo_score(feat: BorrowerFeatures) -> FraudScoreResponse:
    """Demo 模式：規則加權計算 fraud_score + 前三大風險因子。"""
    feat_dict = {
        "age":                  feat.age,
        "occupation_code":      feat.occupation_code,
        "monthly_income":       feat.monthly_income,
        "credit_inquiry_count": feat.credit_inquiry_count,
        "existing_bank_loans":  feat.existing_bank_loans,
        "has_real_estate":      feat.has_real_estate,
        "document_match":       feat.document_match,
        "lives_in_branch_county": feat.lives_in_branch_county,
        "has_salary_transfer":  feat.has_salary_transfer,
    }

    contributions = []
    for key, cfg in _RISK_WEIGHTS.items():
        val = feat_dict[key]
        contrib = cfg["contribution"](val)
        if contrib > 0:
            contributions.append({
                "feature":      key,
                "label":        cfg["label"],
                "contribution": round(contrib, 4),
            })

    raw_score = sum(c["contribution"] for c in contributions)
    fraud_score = round(min(raw_score, 1.0), 4)

    top3 = sorted(contributions, key=lambda x: x["contribution"], reverse=True)[:3]

    if fraud_score <= 0.4:
        risk_level = "low"
    elif fraud_score <= 0.7:
        risk_level = "medium"
    else:
        risk_level = "high"

    return FraudScoreResponse(
        fraud_score=fraud_score,
        risk_level=risk_level,
        top_risk_factors=top3,
        mode="demo",
        model="rule-based-weighted",
    )


def _live_score(feat: BorrowerFeatures, model) -> FraudScoreResponse:
    """Live 模式：XGBoost 推論 + SHAP（若可用）。"""
    X = np.array([[
        feat.age,
        feat.occupation_code,
        feat.monthly_income,
        feat.credit_inquiry_count,
        feat.existing_bank_loans,
        int(feat.has_real_estate),
        int(feat.document_match),
        int(feat.lives_in_branch_county),
        int(feat.has_salary_transfer),
    ]])

    proba = model.predict_proba(X)[0]
    fraud_score = round(float(proba[1]), 4)

    # SHAP 解釋
    top3 = []
    if _explainer is not None:
        try:
            shap_vals = _explainer.shap_values(X)
            vals = shap_vals[0] if isinstance(shap_vals, list) else shap_vals[0]
            factor_pairs = sorted(
                zip(FEATURE_NAMES, vals.tolist()),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:3]
            top3 = [
                {
                    "feature":      fname,
                    "label":        FEATURE_LABELS.get(fname, fname),
                    "contribution": round(abs(fval), 4),
                }
                for fname, fval in factor_pairs
            ]
        except Exception:
            top3 = []

    if fraud_score <= 0.4:
        risk_level = "low"
    elif fraud_score <= 0.7:
        risk_level = "medium"
    else:
        risk_level = "high"

    return FraudScoreResponse(
        fraud_score=fraud_score,
        risk_level=risk_level,
        top_risk_factors=top3,
        mode="live",
        model="xgboost-fraud-classifier",
    )


# ─── FastAPI 應用 ───────────────────────────────────────────────────

app = FastAPI(
    title       = "CREW 3 防詐 PILOT — ML 異常評分服務",
    description = "XGBoost / Isolation Forest 防詐評分 + SHAP 風險因子解釋",
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_methods = ["GET", "POST"],
    allow_headers = ["*"],
)


@app.get("/health")
async def health_check() -> dict:
    """服務健康檢查"""
    model = _try_load()
    return {
        "status":  "ok",
        "service": "CREW 3 防詐 PILOT ML 評分服務",
        "mode":    "live" if model else "demo",
        "port":    8002,
    }


@app.post("/score", response_model=FraudScoreResponse)
async def score_fraud_risk(features: BorrowerFeatures) -> FraudScoreResponse:
    """
    防詐 ML 評分 API

    Request Body：
        - age:                  申請人年齡
        - occupation_code:      職業代碼（0=其他/1=軍公教/2=受薪/3=自營/4=退休）
        - monthly_income:       月收入（萬元）
        - credit_inquiry_count: 聯徵近 2 個月查詢次數
        - existing_bank_loans:  現有銀行借款筆數
        - has_real_estate:      是否擁有不動產
        - document_match:       證件與 MyData 比對一致
        - lives_in_branch_county: 居住於分行服務縣市
        - has_salary_transfer:  是否為薪轉客戶

    Returns:
        FraudScoreResponse（fraud_score / risk_level / top_risk_factors）

    三級警示路由（對應 CREW 3 防詐 PILOT）：
        fraud_score ≤ 0.4  → Level 1（low）：行員一鍵確認
        fraud_score 0.4-0.7 → Level 2（medium）：指派資深行員
        fraud_score > 0.7  → Level 3（high）：Power Automate → Teams 主管警示
    """
    model = _try_load()
    if model is not None:
        return _live_score(features, model)
    return _demo_score(features)
