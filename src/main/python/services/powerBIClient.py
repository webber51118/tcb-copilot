"""
INPUT:  三 Crew 推論結果（推薦 / 鑑估 / 防詐）
OUTPUT: True（推送成功）/ False（推送失敗，已記錄錯誤）
POS:    Power BI REST API 推送客戶端

功能：
    1. 使用 Service Principal（Client Credentials）取得 Azure AD Bearer Token
    2. 呼叫 Power BI REST API「Datasets PostRows」推送行員個案即時資料
    3. 支援三個 Tab 資料表：crew1_recommendations / crew2_valuation / crew3_fraud

環境變數（.env）：
    POWER_BI_TENANT_ID       Azure AD 租戶 ID
    POWER_BI_CLIENT_ID       應用程式（服務主體）Client ID
    POWER_BI_CLIENT_SECRET   應用程式 Client Secret
    POWER_BI_WORKSPACE_ID    Power BI 工作區 ID
    POWER_BI_DATASET_ID      Power BI 串流資料集 ID

參考：
    Power BI REST API — Datasets PostRows
    https://learn.microsoft.com/power-bi/developer/embedded/push-data
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

# ─── 環境變數 ──────────────────────────────────────────────────────

_TENANT_ID     = os.environ.get("POWER_BI_TENANT_ID", "")
_CLIENT_ID     = os.environ.get("POWER_BI_CLIENT_ID", "")
_CLIENT_SECRET = os.environ.get("POWER_BI_CLIENT_SECRET", "")
_WORKSPACE_ID  = os.environ.get("POWER_BI_WORKSPACE_ID", "")
_DATASET_ID    = os.environ.get("POWER_BI_DATASET_ID", "")

_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
_ROWS_URL  = (
    "https://api.powerbi.com/v1.0/myorg/groups/{workspace}"
    "/datasets/{dataset}/tables/{table}/rows"
)

# ─── Token 快取 ────────────────────────────────────────────────────

_cached_token: Optional[str] = None
_token_expires_at: float = 0.0


def _get_token() -> Optional[str]:
    """取得 Azure AD Bearer Token（有效期內快取，不重複請求）。"""
    global _cached_token, _token_expires_at
    import time

    if _cached_token and time.time() < _token_expires_at - 60:
        return _cached_token

    if not all([_TENANT_ID, _CLIENT_ID, _CLIENT_SECRET]):
        logger.warning("Power BI 認證環境變數未設定，跳過推送。")
        return None

    try:
        resp = requests.post(
            _TOKEN_URL.format(tenant=_TENANT_ID),
            data={
                "grant_type":    "client_credentials",
                "client_id":     _CLIENT_ID,
                "client_secret": _CLIENT_SECRET,
                "scope":         "https://analysis.windows.net/powerbi/api/.default",
            },
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
        _cached_token = payload["access_token"]
        _token_expires_at = time.time() + int(payload.get("expires_in", 3600))
        return _cached_token
    except Exception as e:
        logger.error("取得 Power BI Token 失敗：%s", e)
        return None


def _post_rows(table: str, rows: list[dict]) -> bool:
    """推送資料列到指定 Power BI 資料表。"""
    if not all([_WORKSPACE_ID, _DATASET_ID]):
        logger.warning("POWER_BI_WORKSPACE_ID / DATASET_ID 未設定，跳過推送。")
        return False

    token = _get_token()
    if token is None:
        return False

    url = _ROWS_URL.format(
        workspace=_WORKSPACE_ID,
        dataset=_DATASET_ID,
        table=table,
    )
    try:
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type":  "application/json",
            },
            data=json.dumps({"rows": rows}),
            timeout=15,
        )
        if resp.status_code == 200:
            logger.info("Power BI 推送成功：table=%s rows=%d", table, len(rows))
            return True
        logger.warning(
            "Power BI 推送失敗：table=%s status=%s body=%s",
            table, resp.status_code, resp.text[:200],
        )
        return False
    except Exception as e:
        logger.error("Power BI 推送例外：table=%s error=%s", table, e)
        return False


# ─── 公開介面 ──────────────────────────────────────────────────────

def push_crew1_recommendation(
    application_id: str,
    product_name: str,
    monthly_payment: int,
    priority_order: int,
    cross_sell: Optional[str] = None,
) -> bool:
    """
    Tab 1：CREW 1 行銷 PILOT — 推薦產品推送

    Args:
        application_id:  案件識別碼
        product_name:    推薦主要產品名稱
        monthly_payment: 估算月付金（元）
        priority_order:  優先排序（1 = 最優先）
        cross_sell:      交叉銷售建議（選填）

    Returns:
        True = 推送成功，False = 推送失敗或設定未完整
    """
    row = {
        "application_id":  application_id,
        "product_name":    product_name,
        "monthly_payment": monthly_payment,
        "priority_order":  priority_order,
        "cross_sell":      cross_sell or "",
        "timestamp":       datetime.now(timezone.utc).isoformat(),
    }
    return _post_rows("crew1_recommendations", [row])


def push_crew2_valuation(
    application_id: str,
    estimated_value: float,
    p5: float,
    p50: float,
    p95: float,
    ltv_ratio: float,
    max_loan_amount: float,
    risk_level: str,
) -> bool:
    """
    Tab 2：CREW 2 鑑估 PILOT — XGBoost + Monte Carlo 估價推送

    Args:
        application_id:  案件識別碼
        estimated_value: 基準點估（元）
        p5:              最壞情境（P5）
        p50:             中位數估值（P50）
        p95:             樂觀情境（P95）
        ltv_ratio:       LTV 比率
        max_loan_amount: 核貸上限（依 P5 計算）
        risk_level:      風險等級（低風險/中風險/高風險）

    Returns:
        True = 推送成功
    """
    row = {
        "application_id":  application_id,
        "estimated_value": estimated_value,
        "p5":              p5,
        "p50":             p50,
        "p95":             p95,
        "ltv_ratio":       round(ltv_ratio * 100, 2),  # 轉為百分比
        "max_loan_amount": max_loan_amount,
        "risk_level":      risk_level,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
    }
    return _post_rows("crew2_valuation", [row])


def push_crew3_fraud(
    application_id: str,
    fraud_score: float,
    risk_level: str,
    top_risk_factor_1: str,
    top_risk_factor_2: str,
    top_risk_factor_3: str,
    alert_level: int,
) -> bool:
    """
    Tab 3：CREW 3 防詐 PILOT — ML 異常評分推送

    Args:
        application_id:     案件識別碼
        fraud_score:        詐欺風險分數（0-1）
        risk_level:         風險等級（low/medium/high）
        top_risk_factor_1:  第一大風險因子說明
        top_risk_factor_2:  第二大風險因子說明
        top_risk_factor_3:  第三大風險因子說明
        alert_level:        警示等級（1=一鍵確認/2=資深行員/3=主管介入）

    Returns:
        True = 推送成功
    """
    row = {
        "application_id":     application_id,
        "fraud_score":        round(fraud_score, 4),
        "risk_level":         risk_level,
        "top_risk_factor_1":  top_risk_factor_1,
        "top_risk_factor_2":  top_risk_factor_2,
        "top_risk_factor_3":  top_risk_factor_3,
        "alert_level":        alert_level,
        "timestamp":          datetime.now(timezone.utc).isoformat(),
    }
    return _post_rows("crew3_fraud", [row])


def push_pilot_crew_result(
    application_id: str,
    crew1_result: Optional[dict] = None,
    crew2_result: Optional[dict] = None,
    crew3_result: Optional[dict] = None,
) -> dict[str, bool]:
    """
    一次性推送三 Crew 結果到 Power BI（行員個案即時儀表板）。

    Args:
        application_id: 案件識別碼
        crew1_result:   CREW 1 推薦結果 dict（可選）
        crew2_result:   CREW 2 鑑估結果 dict（可選）
        crew3_result:   CREW 3 防詐結果 dict（可選）

    Returns:
        { "crew1": bool, "crew2": bool, "crew3": bool }

    crew1_result 欄位：product_name, monthly_payment, priority_order, cross_sell
    crew2_result 欄位：estimated_value, p5, p50, p95, ltv_ratio, max_loan_amount, risk_level
    crew3_result 欄位：fraud_score, risk_level, top_risk_factors (list[dict]), alert_level
    """
    results = {"crew1": False, "crew2": False, "crew3": False}

    if crew1_result:
        results["crew1"] = push_crew1_recommendation(
            application_id=application_id,
            product_name=crew1_result.get("product_name", ""),
            monthly_payment=crew1_result.get("monthly_payment", 0),
            priority_order=crew1_result.get("priority_order", 1),
            cross_sell=crew1_result.get("cross_sell"),
        )

    if crew2_result:
        results["crew2"] = push_crew2_valuation(
            application_id=application_id,
            estimated_value=crew2_result.get("estimated_value", 0),
            p5=crew2_result.get("p5", 0),
            p50=crew2_result.get("p50", 0),
            p95=crew2_result.get("p95", 0),
            ltv_ratio=crew2_result.get("ltv_ratio", 0),
            max_loan_amount=crew2_result.get("max_loan_amount", 0),
            risk_level=crew2_result.get("risk_level", ""),
        )

    if crew3_result:
        factors = crew3_result.get("top_risk_factors", [])
        results["crew3"] = push_crew3_fraud(
            application_id=application_id,
            fraud_score=crew3_result.get("fraud_score", 0),
            risk_level=crew3_result.get("risk_level", ""),
            top_risk_factor_1=factors[0]["label"] if len(factors) > 0 else "",
            top_risk_factor_2=factors[1]["label"] if len(factors) > 1 else "",
            top_risk_factor_3=factors[2]["label"] if len(factors) > 2 else "",
            alert_level=crew3_result.get("alert_level", 1),
        )

    return results
