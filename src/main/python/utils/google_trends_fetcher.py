"""
INPUT:  台灣房市相關關鍵字（4個）
OUTPUT: svi_composite（SVI 合成指數，0~100）
POS:    工具層 — Google Trends SVI 整合 Stub

論文依據：
    蔡繡容（2023）《預測台灣房地產市場趨勢之模型—應用深度學習技術》
    SVI（Search Volume Index）作為輔助情緒指標整合至 RF+SDE 情緒分數。

Stub 說明：
    目前返回固定模擬值，未來替換為 pytrends 真實數據。
    替換區塊標記：[REPLACE_GOOGLE_TRENDS_START] / [REPLACE_GOOGLE_TRENDS_END]
"""

from typing import Dict


# 台灣房市關鍵字（蔡繡容論文建議的代理變數）
TAIWAN_REAL_ESTATE_KEYWORDS = [
    "買房",        # 購屋意圖
    "房價",        # 市場關注度
    "房貸利率",    # 資金成本敏感度
    "預售屋",      # 新案市場活絡度
]

# 各關鍵字權重（根據論文相關性設定）
KEYWORD_WEIGHTS: Dict[str, float] = {
    "買房":     0.35,
    "房價":     0.25,
    "房貸利率": 0.25,
    "預售屋":   0.15,
}


def fetch_trends_svi(
    keywords: list[str] | None = None,
    geo: str = "TW",
    timeframe: str = "today 3-m",
) -> Dict[str, float]:
    """
    取得 Google Trends SVI 數值

    Args:
        keywords:  搜尋關鍵字列表（預設使用台灣房市關鍵字）
        geo:       地區代碼（預設 TW）
        timeframe: 時間範圍（預設近 3 個月）

    Returns:
        Dict[keyword, svi_value]（0~100 標準化值）

    # [REPLACE_GOOGLE_TRENDS_START]
    # 真實替換步驟：
    #   1. pip install pytrends
    #   2. 取消下方注解，刪除 Stub 返回值
    #
    #   from pytrends.request import TrendReq
    #   pytrends = TrendReq(hl='zh-TW', tz=480)
    #   kw_list = keywords or TAIWAN_REAL_ESTATE_KEYWORDS
    #   pytrends.build_payload(kw_list, cat=0, timeframe=timeframe, geo=geo)
    #   df = pytrends.interest_over_time()
    #   if df.empty:
    #       return {kw: 50.0 for kw in kw_list}
    #   return {kw: float(df[kw].mean()) for kw in kw_list if kw in df.columns}
    # [REPLACE_GOOGLE_TRENDS_END]
    """
    kw_list = keywords or TAIWAN_REAL_ESTATE_KEYWORDS

    # Stub：返回固定模擬值（模擬 2024 Q4 台灣房市穩健熱度）
    stub_values: Dict[str, float] = {
        "買房":     62.5,
        "房價":     71.0,
        "房貸利率": 58.3,
        "預售屋":   55.8,
    }
    return {kw: stub_values.get(kw, 50.0) for kw in kw_list}


def get_composite_sentiment_index(
    keywords: list[str] | None = None,
    geo: str = "TW",
) -> float:
    """
    計算加權合成 SVI 情緒指數

    Args:
        keywords:  搜尋關鍵字列表（預設使用台灣房市關鍵字）
        geo:       地區代碼

    Returns:
        composite_svi（0~100，>60 偏多、40~60 中性、<40 偏空）
    """
    svi_dict = fetch_trends_svi(keywords=keywords, geo=geo)

    weighted_sum = 0.0
    total_weight = 0.0

    for kw, svi_val in svi_dict.items():
        weight = KEYWORD_WEIGHTS.get(kw, 1.0 / len(svi_dict))
        weighted_sum += svi_val * weight
        total_weight += weight

    if total_weight == 0:
        return 50.0

    return round(weighted_sum / total_weight, 2)
