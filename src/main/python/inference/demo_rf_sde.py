"""
INPUT:  region（縣市）、building_type（建物類型）、property_age（屋齡）、
        lstm_adjusted_value（LSTM 調整後估值，元）
OUTPUT: rf_adjusted_value（RF+SDE 情緒分數調整後估值，元）、sentiment_score（-1~1）
POS:    推論層 — Demo RF+SDE（斜率公式計算市場情緒分數）

Demo 模式說明：
    依縣市年化成長率計算近 3 個月斜率（slope），
    加上建物類型需求修正與屋齡修正，合成情緒分數。
    偏多（>0.15）→ 調升 3%；中性（-0.15~0.15）→ 不動；偏空（<-0.15）→ 調降 5%。

真實替換步驟：
    1. pip install scikit-learn（取消 requirements.txt 中的注解）
    2. 以下全部替換為：
       from joblib import load
       rf_model = load("models/rf_sentiment.joblib")
       features = extract_features(region, building_type, property_age)
       sentiment_score = float(rf_model.predict([features])[0])
       # SDE 隨機項（已在 monte_carlo.py 處理，這裡僅輸出 RF 情緒分數）
    3. `extract_features` 應輸出與訓練資料同格式的 numpy array
"""

import math
from typing import Tuple
from src.main.python.inference.demo_lstm import REGION_ANNUAL_GROWTH

# ────────────────────────────────────────────────
# 建物需求修正（需求強 → 情緒加成）
# ────────────────────────────────────────────────
BUILDING_DEMAND_FACTOR: dict[str, float] = {
    "大樓":  0.10,   # 主流需求最高
    "華廈":  0.05,
    "公寓":  0.00,
    "透天": -0.05,   # 流動性較差
    "別墅": -0.02,
}

# 屋齡情緒修正（新屋買氣較佳）
def age_sentiment_factor(property_age: int) -> float:
    if property_age <= 5:
        return 0.08
    elif property_age <= 15:
        return 0.03
    elif property_age <= 30:
        return -0.05
    else:
        return -0.12


def run_demo_rf_sde(
    region: str,
    building_type: str,
    property_age: int,
    lstm_adjusted_value: float,
) -> Tuple[float, float]:
    """
    Demo RF+SDE：斜率公式計算市場情緒分數

    公式：
        monthly_rate  = annual_growth / 12
        prev_3m_index = BASE_INDEX × (1 + monthly_rate)^(YEARS×12 - 3)
        curr_index    = BASE_INDEX × (1 + monthly_rate)^(YEARS×12)
        slope_3m      = (curr_index - prev_3m_index) / prev_3m_index
        sentiment     = clip(slope + building_demand + age_factor, -1.0, 1.0)
        adjustment    = 偏多→1.03 / 中性→1.00 / 偏空→0.95

    Args:
        region:               縣市名稱
        building_type:        建物類型
        property_age:         屋齡（年）
        lstm_adjusted_value:  LSTM 調整後估值（元）

    Returns:
        Tuple[rf_adjusted_value（元）, sentiment_score（-1~1）]

    # [REPLACE_RF_SDE_START]
    # 真實替換時：
    #   features = extract_features(region, building_type, property_age)
    #   sentiment_score = float(rf_model.predict([features])[0])
    # [REPLACE_RF_SDE_END]
    """
    annual_growth = REGION_ANNUAL_GROWTH.get(region, 0.035)
    monthly_rate  = annual_growth / 12.0

    months_elapsed = YEARS_ELAPSED_MONTHS = 11 * 12  # 132 個月

    # 模擬近 3 個月指數斜率
    from src.main.python.inference.demo_lstm import BASE_INDEX
    curr_index   = BASE_INDEX * math.pow(1.0 + monthly_rate, months_elapsed)
    prev_3m_idx  = BASE_INDEX * math.pow(1.0 + monthly_rate, months_elapsed - 3)
    slope_3m     = (curr_index - prev_3m_idx) / prev_3m_idx  # 約等於 monthly_rate × 3

    # 建物與屋齡修正
    demand_factor = BUILDING_DEMAND_FACTOR.get(building_type, 0.0)
    age_factor    = age_sentiment_factor(property_age)

    # 合成情緒分數（clip 到 -1 ~ 1）
    raw_sentiment   = slope_3m + demand_factor + age_factor
    sentiment_score = max(-1.0, min(1.0, raw_sentiment))

    # 情緒分數 → 估值調整
    if sentiment_score > 0.15:
        adjustment = 1.03    # 偏多：調升 3%
    elif sentiment_score < -0.15:
        adjustment = 0.95    # 偏空：調降 5%
    else:
        adjustment = 1.00    # 中性：不動

    rf_adjusted_value = lstm_adjusted_value * adjustment

    return round(rf_adjusted_value, 0), round(sentiment_score, 4)


# 暴露 YEARS_ELAPSED_MONTHS 常數供其他模組使用
YEARS_ELAPSED = 11
