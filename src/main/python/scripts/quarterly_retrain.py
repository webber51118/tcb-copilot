"""
INPUT:  --dry-run（可選）、--region（可選，指定縣市）
OUTPUT: 更新後的模型與成長率參數（dry-run 模式下僅記錄）
POS:    腳本層 — 季度滾動視窗模型更新 Stub

論文依據：
    蔡繡容（2023）建議每季以最新實價登錄資料滾動更新 LSTM 與 RF 模型，
    以維持 <0.6% 預測誤差與 93.35% 情緒分類準確率。

Stub 說明：
    所有外部 API 呼叫均為 Stub，需分別替換以下 4 個區塊：
    1. [REPLACE_LVPR_API_START/END]       - 內政部實價登錄 API
    2. [REPLACE_REGION_GROWTH_START/END]  - 縣市成長率更新
    3. [REPLACE_GOOGLE_TRENDS_START/END]  - pytrends SVI 數據
    4. [REPLACE_TENSORFLOW_RETRAIN_START/END] - TensorFlow LSTM 重訓
"""

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
MODELS_DIR   = PROJECT_ROOT / "src" / "main" / "python" / "models"
DATA_DIR     = PROJECT_ROOT / "data" / "real_estate"


def fetch_lvpr_data(region: str | None = None, dry_run: bool = False) -> list[dict]:
    """
    取得內政部實價登錄資料

    # [REPLACE_LVPR_API_START]
    # 真實替換步驟：
    #   import requests
    #   url = "https://plvr.land.moi.gov.tw/DownloadSeason"
    #   params = {"type": "JSON", "season": get_latest_season()}
    #   resp = requests.get(url, params=params, timeout=30)
    #   data = resp.json()
    #   if region:
    #       data = [d for d in data if d.get("鄉鎮市區", "").startswith(region)]
    #   return data
    # [REPLACE_LVPR_API_END]
    """
    logger.info("[Stub] fetch_lvpr_data: region=%s, dry_run=%s", region, dry_run)
    # Stub：返回空列表（不影響現有 Demo 模式）
    return []


def update_region_growth_rates(lvpr_data: list[dict], dry_run: bool = False) -> dict[str, float]:
    """
    依實價登錄資料更新縣市年化成長率

    # [REPLACE_REGION_GROWTH_START]
    # 真實替換步驟：
    #   from src.main.python.inference.demo_lstm import REGION_ANNUAL_GROWTH
    #   # 計算各縣市近 4 季平均成長率
    #   updated_rates = {}
    #   for region, transactions in group_by_region(lvpr_data).items():
    #       q_prices = [t["總價元"] / t["建物移轉總面積平方公尺"] for t in transactions]
    #       if len(q_prices) >= 4:
    #           yoy_growth = (q_prices[-1] / q_prices[-5] - 1) if len(q_prices) >= 5 else 0.035
    #           updated_rates[region] = round(yoy_growth, 4)
    #   return updated_rates
    # [REPLACE_REGION_GROWTH_END]
    """
    logger.info("[Stub] update_region_growth_rates: %d 筆資料", len(lvpr_data))
    return {}


def fetch_svi_training_data(dry_run: bool = False) -> dict:
    """
    取得 Google Trends SVI 訓練資料

    # [REPLACE_GOOGLE_TRENDS_START]
    # 真實替換步驟：
    #   from src.main.python.utils.google_trends_fetcher import fetch_trends_svi
    #   svi_data = fetch_trends_svi(timeframe="today 12-m")
    #   return svi_data
    # [REPLACE_GOOGLE_TRENDS_END]
    """
    logger.info("[Stub] fetch_svi_training_data: dry_run=%s", dry_run)
    return {}


def retrain_lstm_model(lvpr_data: list[dict], dry_run: bool = False) -> dict:
    """
    重新訓練 LSTM 時序模型

    # [REPLACE_TENSORFLOW_RETRAIN_START]
    # 真實替換步驟：
    #   import tensorflow as tf
    #   from src.main.python.inference.demo_lstm import build_lstm_model
    #   X_train, y_train = prepare_sequences(lvpr_data, window=9)
    #   model = build_lstm_model(input_shape=(9, len(FEATURES)))
    #   model.fit(X_train, y_train, epochs=50, batch_size=32, validation_split=0.2)
    #   model.save(str(MODELS_DIR / "lstm_housing.h5"))
    #   mse = model.evaluate(X_val, y_val)
    #   logger.info("LSTM 重訓完成，驗證 MSE: %.6f", mse)
    #   return {"mse": float(mse), "trained_at": datetime.utcnow().isoformat()}
    # [REPLACE_TENSORFLOW_RETRAIN_END]
    """
    logger.info("[Stub] retrain_lstm_model: %d 筆資料, dry_run=%s", len(lvpr_data), dry_run)
    return {"status": "stub", "trained_at": datetime.utcnow().isoformat()}


def run_quarterly_retrain(region: str | None = None, dry_run: bool = False) -> None:
    """季度更新主流程"""
    start_time = datetime.utcnow()
    logger.info("=== 季度滾動視窗更新開始 ===" + (" [DRY-RUN]" if dry_run else ""))
    logger.info("縣市篩選: %s", region or "全台")

    # Step 1: 取得實價登錄資料
    lvpr_data = fetch_lvpr_data(region=region, dry_run=dry_run)
    logger.info("實價登錄資料：%d 筆", len(lvpr_data))

    # Step 2: 更新縣市成長率
    updated_rates = update_region_growth_rates(lvpr_data, dry_run=dry_run)
    if updated_rates and not dry_run:
        logger.info("縣市成長率更新：%d 縣市", len(updated_rates))
    else:
        logger.info("[Stub] 縣市成長率：使用現有 Demo 值")

    # Step 3: 取得 SVI 訓練資料
    svi_data = fetch_svi_training_data(dry_run=dry_run)
    logger.info("SVI 資料：%d 關鍵字", len(svi_data))

    # Step 4: 重訓 LSTM
    lstm_result = retrain_lstm_model(lvpr_data, dry_run=dry_run)
    logger.info("LSTM 結果：%s", json.dumps(lstm_result, ensure_ascii=False))

    elapsed = (datetime.utcnow() - start_time).total_seconds()
    logger.info("=== 季度更新完成（%.1f 秒）===", elapsed)


def main() -> None:
    parser = argparse.ArgumentParser(description="季度滾動視窗模型更新")
    parser.add_argument("--dry-run", action="store_true", help="僅記錄，不實際更新模型")
    parser.add_argument("--region", type=str, default=None, help="指定縣市（例：台北市）")
    args = parser.parse_args()

    run_quarterly_retrain(region=args.region, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
