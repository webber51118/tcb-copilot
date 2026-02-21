"""
INPUT:  region（縣市）、base_value（基準估值，元）
OUTPUT: adjusted_value（LSTM 市場指數調整後估值，元）、lstm_index（市場指數）
POS:    推論層 — Demo LSTM（線性成長率 + 季節波動）

Demo 模式說明：
    使用線性成長率 + sin 季節波動近似 LSTM 時序預測輸出。
    BASE_INDEX = 100（2014 年基準），模擬至 2025 年（第 11 年）。
    調整幅度使用縮放因子 0.30，避免過度偏移基準估值。

真實替換步驟：
    1. pip install tensorflow（取消 requirements.txt 中的注解）
    2. 以下全部替換為：
       from tensorflow.keras.models import load_model
       model = load_model("models/lstm_housing.h5")
       lstm_index = float(model.predict(sequence)[0][0])
    3. `sequence` 為近 9 個月市場指數正規化後的 shape=(1,9,1) 陣列
"""

import math
from typing import Tuple

# ────────────────────────────────────────────────
# 各縣市年化成長率（Demo 校正參數）
# 資料來源：近年住宅價格指數年增率估算
# ────────────────────────────────────────────────
REGION_ANNUAL_GROWTH: dict[str, float] = {
    "台北市":  0.045,  # 4.5%
    "新北市":  0.052,  # 5.2%
    "桃園市":  0.060,  # 6.0%
    "台中市":  0.058,  # 5.8%
    "台南市":  0.055,  # 5.5%
    "高雄市":  0.053,  # 5.3%
    "新竹市":  0.062,  # 6.2%（科技業人口帶動）
    "新竹縣":  0.058,
    "基隆市":  0.040,
    "苗栗縣":  0.030,
    "彰化縣":  0.033,
    "南投縣":  0.025,
    "雲林縣":  0.025,
    "嘉義市":  0.038,
    "嘉義縣":  0.028,
    "屏東縣":  0.030,
    "宜蘭縣":  0.042,
    "花蓮縣":  0.038,
    "台東縣":  0.028,
    "澎湖縣":  0.025,
    "金門縣":  0.022,
    "連江縣":  0.020,
}

BASE_INDEX    = 100.0   # 2014 年基準指數
YEARS_ELAPSED = 11      # 2014 → 2025
SEASON_AMP    = 0.03    # 季節波動振幅（±3%）
SCALE_FACTOR  = 0.30    # 縮放因子（避免指數調整過度放大基準估值）


def run_demo_lstm(region: str, base_value: float) -> Tuple[float, float]:
    """
    Demo LSTM：線性成長率 + 季節波動

    公式：
        annual_growth = REGION_ANNUAL_GROWTH.get(region, 0.035)
        lstm_index    = BASE_INDEX × (1 + annual_growth)^11 × (1 + sin 季節修正)
        index_adj     = (lstm_index / 180.0 - 1.0) × SCALE_FACTOR
        adjusted_value = base_value × (1 + index_adj)

    Args:
        region:     縣市名稱
        base_value: 基準估值（元）

    Returns:
        Tuple[adjusted_value（元）, lstm_index（市場指數）]

    # [REPLACE_LSTM_START]
    # 真實替換時，將此函式替換為：
    #   sequence = prepare_sequence(region)         # shape=(1,9,1)
    #   lstm_index = float(model.predict(sequence)[0][0])
    #   index_adj = (lstm_index / 180.0 - 1.0) * SCALE_FACTOR
    #   return base_value * (1 + index_adj), lstm_index
    # [REPLACE_LSTM_END]
    """
    annual_growth = REGION_ANNUAL_GROWTH.get(region, 0.035)

    # 線性成長趨勢
    trend_index = BASE_INDEX * math.pow(1.0 + annual_growth, YEARS_ELAPSED)

    # 季節修正（sin 波動，模擬 Q2/Q3 旺季微漲）
    import time
    current_month = (int(time.time()) // (30 * 24 * 3600)) % 12  # 粗估月份
    season_factor = 1.0 + SEASON_AMP * math.sin(2 * math.pi * current_month / 12)

    lstm_index = trend_index * season_factor

    # 調整幅度（以 180 作為正規化分母，使台北市約略持平）
    index_adj = (lstm_index / 180.0 - 1.0) * SCALE_FACTOR
    adjusted_value = base_value * (1.0 + index_adj)

    return round(adjusted_value, 0), round(lstm_index, 2)
