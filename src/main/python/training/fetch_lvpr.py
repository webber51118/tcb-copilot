"""
INPUT:  無（自動抓取最近 8 季內政部實價登錄資料）
OUTPUT: data/lvpr/cleaned_lvpr.parquet（清洗後合併資料集）
POS:    Day 1 資料管線 - 下載、解壓、清洗、合併

執行方式：
    cd <project_root>
    python -m src.main.python.training.fetch_lvpr
"""

import io
import zipfile
import requests
import pandas as pd
import numpy as np
import re
from pathlib import Path

# ─── 常數 ──────────────────────────────────────────────────
BASE_URL    = "https://plvr.land.moi.gov.tw/DownloadOpenData"
DATA_DIR    = Path("data/lvpr/raw")
OUTPUT_PATH = Path("data/lvpr/cleaned_lvpr.parquet")

# 下載近 8 季（民國 112Q1 ~ 113Q4，即 2023~2024）
QUARTERS = [
    ("112", "1"), ("112", "2"), ("112", "3"), ("112", "4"),
    ("113", "1"), ("113", "2"), ("113", "3"), ("113", "4"),
]

PING_PER_SQM = 1 / 3.30579  # 1 sqm ≈ 0.3025 坪

# 建物型態標準化對照表
BUILDING_TYPE_MAP = {
    "住宅大樓(11層含以上有電梯)":  "大樓",
    "住宅大樓(11層含以上有電梯。)": "大樓",
    "華廈(10層含以下有電梯)":       "華廈",
    "華廈(10層含以下有電梯。)":      "華廈",
    "公寓(5樓含以下非電梯)":        "公寓",
    "公寓(5樓含以下非電梯。)":       "公寓",
    "透天厝":                        "透天",
    "別墅":                          "別墅",
}

# 過濾備註關鍵字（特殊交易，不具代表性）
EXCLUDE_NOTES = ["親友", "夫妻", "特殊", "危老", "都更", "法拍", "共有", "瑕疵", "繼承", "拍賣"]


# ─── 工具函式 ───────────────────────────────────────────────

def parse_roc_date(date_str: str) -> int:
    """民國年月日（如 '1130115'）→ 西元年（2024）"""
    try:
        s = str(date_str).strip()
        if len(s) >= 7:
            roc_year = int(s[:3])
            return roc_year + 1911
        return 0
    except Exception:
        return 0


CN_NUM = {"零":0,"一":1,"二":2,"三":3,"四":4,"五":5,
          "六":6,"七":7,"八":8,"九":9,"十":10}

def parse_floor(floor_str: str) -> int:
    """將中文或數字樓層字串解析為整數（如 '七層'→7, '十三層'→13, '三十五層'→35）"""
    if pd.isna(floor_str):
        return 0
    s = str(floor_str).strip().replace("層", "").replace("F", "").replace("f", "")
    # 純數字
    if s.isdigit():
        return int(s)
    # 取範圍中的第一個數字（如 '一至三'→1）
    s = re.split(r"[至~～~、]", s)[0]
    # 中文數字轉換
    try:
        if "十" in s:
            parts = s.split("十")
            tens = CN_NUM.get(parts[0], 1) if parts[0] else 1
            ones = CN_NUM.get(parts[1], 0) if len(parts) > 1 and parts[1] else 0
            return tens * 10 + ones
        return CN_NUM.get(s, 0)
    except Exception:
        return 0


def download_quarter(roc_year: str, quarter: str) -> pd.DataFrame | None:
    """下載單季實價登錄 ZIP 並回傳 DataFrame（建物買賣，_a 檔）"""
    filename = f"{roc_year}S{quarter}_lvr_land_a.zip"
    url = f"{BASE_URL}?type=zip&fileName={filename}"
    print(f"  下載 {filename} ...")

    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code != 200:
            print(f"    ❌ HTTP {resp.status_code}，跳過")
            return None

        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
            if not csv_names:
                print(f"    ❌ ZIP 內無 CSV，跳過")
                return None

            dfs = []
            for name in csv_names:
                with zf.open(name) as f:
                    try:
                        df = pd.read_csv(f, encoding="utf-8-sig", low_memory=False)
                        dfs.append(df)
                    except Exception:
                        pass
            if not dfs:
                return None
            df = pd.concat(dfs, ignore_index=True)
            df["_quarter"] = f"{roc_year}Q{quarter}"
            print(f"    ✅ {len(df):,} 筆")
            return df

    except Exception as e:
        print(f"    ❌ 下載失敗：{e}")
        return None


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """清洗實價登錄原始資料"""
    # ── 1. 重命名關鍵欄位 ──────────────────────────────────
    rename_map = {
        "鄉鎮市區":             "district",
        "建物型態":              "building_type_raw",
        "建物移轉總面積平方公尺": "area_sqm",
        "建築完成年月":          "completion_date",
        "交易年月日":            "transaction_date",
        "移轉層次":              "floor_raw",
        "總樓層數":              "total_floors_raw",
        "建物現況格局-房":       "rooms",
        "單價元平方公尺":        "price_per_sqm",
        "車位移轉總面積平方公尺": "parking_sqm",
        "備註":                  "notes",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    # ── 2. 過濾建物型態 ────────────────────────────────────
    if "building_type_raw" not in df.columns:
        return pd.DataFrame()
    df["building_type"] = df["building_type_raw"].map(BUILDING_TYPE_MAP)
    df = df[df["building_type"].notna()].copy()

    # ── 3. 過濾特殊備註 ────────────────────────────────────
    if "notes" in df.columns:
        pattern = "|".join(EXCLUDE_NOTES)
        df = df[~df["notes"].fillna("").str.contains(pattern, na=False)].copy()

    # ── 4. 數值欄位轉換 ────────────────────────────────────
    df["price_per_sqm"] = pd.to_numeric(df["price_per_sqm"], errors="coerce")
    df["area_sqm"]      = pd.to_numeric(df["area_sqm"],      errors="coerce")
    df["parking_sqm"]   = pd.to_numeric(df.get("parking_sqm", 0), errors="coerce").fillna(0)
    df["rooms"]         = pd.to_numeric(df.get("rooms", 0),   errors="coerce").fillna(0)

    # ── 5. 過濾無效單價與面積 ──────────────────────────────
    df = df[(df["price_per_sqm"] > 0) & (df["area_sqm"] > 10)].copy()

    # ── 6. 坪數轉換 ───────────────────────────────────────
    df["area_ping"] = (df["area_sqm"] * PING_PER_SQM).round(2)

    # ── 7. 目標變數：單價元/坪 ──────────────────────────────
    df["price_per_ping"] = (df["price_per_sqm"] / PING_PER_SQM).round(0)

    # ── 8. 屋齡計算 ───────────────────────────────────────
    df["transaction_year"] = df["transaction_date"].apply(parse_roc_date)
    df["completion_year"]  = df["completion_date"].apply(parse_roc_date)
    df["property_age"]     = (df["transaction_year"] - df["completion_year"]).clip(0, 80)

    # ── 9. 樓層解析 ───────────────────────────────────────
    df["floor"]        = df["floor_raw"].apply(parse_floor)
    df["total_floors"] = df["total_floors_raw"].apply(parse_floor)

    # ── 10. 停車位 ─────────────────────────────────────────
    df["has_parking"] = (df["parking_sqm"] > 0).astype(int)

    # ── 11. 時間特徵 ───────────────────────────────────────
    tx = df["transaction_date"].astype(str)
    df["year"]    = tx.str[:3].apply(lambda x: int(x) + 1911 if x.isdigit() else 0)
    df["quarter"] = tx.str[3:5].apply(
        lambda m: (int(m) - 1) // 3 + 1 if m.isdigit() else 0
    )

    # ── 12. 過濾異常值（1%-99% 分位數）───────────────────
    lo = df["price_per_ping"].quantile(0.01)
    hi = df["price_per_ping"].quantile(0.99)
    df = df[(df["price_per_ping"] >= lo) & (df["price_per_ping"] <= hi)].copy()

    # ── 13. 選出最終欄位 ───────────────────────────────────
    keep = ["district", "building_type", "area_ping", "property_age",
            "floor", "total_floors", "has_parking", "rooms",
            "year", "quarter", "price_per_ping"]
    df = df[[c for c in keep if c in df.columns]].dropna()

    return df


# ─── 主流程 ────────────────────────────────────────────────

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("═" * 50)
    print("  實價登錄資料下載與清洗")
    print("═" * 50)

    all_dfs = []
    for roc_year, quarter in QUARTERS:
        df_raw = download_quarter(roc_year, quarter)
        if df_raw is not None:
            df_clean = clean(df_raw)
            if len(df_clean) > 0:
                all_dfs.append(df_clean)
                print(f"    清洗後：{len(df_clean):,} 筆")

    if not all_dfs:
        print("❌ 無任何有效資料，請檢查網路或 API")
        return

    result = pd.concat(all_dfs, ignore_index=True)
    result.to_parquet(OUTPUT_PATH, index=False)

    print()
    print(f"✅ 合併完成：{len(result):,} 筆 → {OUTPUT_PATH}")
    print(f"   建物型態分布：\n{result['building_type'].value_counts().to_string()}")
    print(f"   單價範圍：{result['price_per_ping'].min():,.0f} ~ {result['price_per_ping'].max():,.0f} 元/坪")


if __name__ == "__main__":
    main()
