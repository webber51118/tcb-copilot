"""
INPUT:  data/lvpr/cleaned_lvpr.parquet（fetch_lvpr.py 產出）
OUTPUT: models/xgboost_valuation.json（XGBoost 模型）
        models/xgboost_encoders.pkl（Label Encoder 對照表）
POS:    Day 1 模型訓練 - 特徵工程、XGBoost 訓練、MAPE 評估、模型儲存

執行方式：
    cd <project_root>
    python -m src.main.python.training.train_xgboost
"""

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_percentage_error

# ─── 路徑設定 ──────────────────────────────────────────────
DATA_PATH     = Path("data/lvpr/cleaned_lvpr.parquet")
MODEL_PATH    = Path("models/xgboost_valuation.json")
ENCODERS_PATH = Path("models/xgboost_encoders.pkl")

# 類別型特徵（需 Label Encoding）
CAT_COLS = ["district", "building_type"]

# 數值型特徵
NUM_COLS = ["area_ping", "property_age", "floor", "total_floors",
            "has_parking", "rooms", "year", "quarter"]

FEATURE_COLS = CAT_COLS + NUM_COLS
TARGET_COL   = "log_price_per_ping"  # log 轉換後的目標


# ─── XGBoost 超參數（參考文獻最佳實踐）──────────────────────
XGB_PARAMS = {
    "objective":        "reg:squarederror",
    "n_estimators":     500,
    "learning_rate":    0.05,
    "max_depth":        6,
    "min_child_weight": 5,
    "subsample":        0.8,
    "colsample_bytree": 0.8,
    "reg_alpha":        0.1,
    "reg_lambda":       1.0,
    "random_state":     42,
    "n_jobs":           -1,
    "early_stopping_rounds": 30,
}


# ─── 工具函式 ───────────────────────────────────────────────

def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """計算 MAPE（%）"""
    return mean_absolute_percentage_error(y_true, y_pred) * 100


def hit_rate(y_true: np.ndarray, y_pred: np.ndarray, threshold: float = 0.10) -> float:
    """在 threshold 誤差內的命中率（%）"""
    errors = np.abs(y_true - y_pred) / y_true
    return (errors <= threshold).mean() * 100


# ─── 主流程 ────────────────────────────────────────────────

def main():
    print("═" * 50)
    print("  XGBoost 鑑價模型訓練")
    print("═" * 50)

    # ── 1. 載入資料 ────────────────────────────────────────
    if not DATA_PATH.exists():
        print(f"❌ 找不到 {DATA_PATH}，請先執行 fetch_lvpr.py")
        return

    df = pd.read_parquet(DATA_PATH)
    print(f"✅ 載入 {len(df):,} 筆資料")

    # ── 2. Log 轉換目標變數 ────────────────────────────────
    df[TARGET_COL] = np.log1p(df["price_per_ping"])

    # ── 3. Label Encoding 類別特徵 ─────────────────────────
    encoders = {}
    for col in CAT_COLS:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
        print(f"   {col}：{len(le.classes_)} 個類別")

    # ── 4. 時序切分（用年份，不隨機，避免未來資料洩漏）──────
    split_year = df["year"].max() - 1  # 最後 1 年作為測試集
    df_train = df[df["year"] <= split_year]
    df_test  = df[df["year"] >  split_year]
    print(f"\n訓練集：{len(df_train):,} 筆（≤{split_year}）")
    print(f"測試集：{len(df_test):,} 筆（>{split_year}）")

    X_train = df_train[FEATURE_COLS]
    y_train = df_train[TARGET_COL]
    X_test  = df_test[FEATURE_COLS]
    y_test  = df_test[TARGET_COL]

    # ── 5. 訓練 XGBoost ────────────────────────────────────
    print("\n訓練中...")
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.1, random_state=42
    )

    model = xgb.XGBRegressor(**XGB_PARAMS)
    model.fit(
        X_tr, y_tr,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    # ── 6. 評估（反 log 轉換回原始單位）──────────────────────
    y_pred_log = model.predict(X_test)
    y_pred     = np.expm1(y_pred_log)
    y_true     = np.expm1(y_test.values)

    mape_val    = mape(y_true, y_pred)
    hit10_val   = hit_rate(y_true, y_pred, 0.10)
    hit20_val   = hit_rate(y_true, y_pred, 0.20)

    print("\n" + "─" * 40)
    print(f"  MAPE          : {mape_val:.2f}%")
    print(f"  命中率（10%） : {hit10_val:.1f}%")
    print(f"  命中率（20%） : {hit20_val:.1f}%")
    print("─" * 40)

    # ── 7. 特徵重要性 ──────────────────────────────────────
    importance = pd.Series(
        model.feature_importances_,
        index=FEATURE_COLS
    ).sort_values(ascending=False)
    print("\n特徵重要性 Top 8：")
    print(importance.head(8).to_string())

    # ── 8. 儲存模型與 Encoder ─────────────────────────────
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(MODEL_PATH))
    joblib.dump(encoders, ENCODERS_PATH)
    print(f"\n✅ 模型儲存：{MODEL_PATH}")
    print(f"✅ Encoder 儲存：{ENCODERS_PATH}")


if __name__ == "__main__":
    main()
