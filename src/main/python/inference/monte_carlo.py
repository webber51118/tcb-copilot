"""
INPUT:  spot_value（當前估值，元）、mu（年化漂移率）、sigma（年化波動率）、
        n_paths（路徑數，預設 1000）、n_steps（交易日數，預設 252）
OUTPUT: ValuationConfidenceInterval（P5 / P50 / P95）、risk_level（低/中/高風險）
POS:    推論層 — 完整 GBM 蒙地卡羅實作（零 Demo 替換需求，直接上 Production）

算法說明：
    幾何布朗運動（GBM）精確公式：
        S[t+1] = S[t] × exp((mu - 0.5×sigma²)×dt + sigma×sqrt(dt)×Z)
        Z ~ N(0,1)，固定 seed=42 確保可重現

    風險等級判斷（spread_ratio = (P95-P5)/P50）：
        < 0.15  → 低風險
        < 0.30  → 中風險
        >= 0.30 → 高風險
"""

import numpy as np
from dataclasses import dataclass

# GBM 預設參數（依台灣住宅市場估算）
DEFAULT_MU    = 0.045   # 年化漂移率 4.5%（長期房價年增率）
DEFAULT_SIGMA = 0.080   # 年化波動率 8.0%（住宅市場波動）

RISK_THRESHOLD_LOW  = 0.15
RISK_THRESHOLD_HIGH = 0.30


@dataclass
class ConfidenceInterval:
    """GBM 模擬信心區間"""
    p5:  float
    p50: float
    p95: float


def run_monte_carlo(
    spot_value: float,
    mu: float = DEFAULT_MU,
    sigma: float = DEFAULT_SIGMA,
    n_paths: int = 1000,
    n_steps: int = 252,
    seed: int = 42,
) -> tuple[ConfidenceInterval, str]:
    """
    幾何布朗運動蒙地卡羅模擬

    公式（對數精確型）：
        dt = 1 / n_steps                           # 每步時間間隔（年）
        drift  = (mu - 0.5 × sigma²) × dt
        diffusion = sigma × sqrt(dt) × Z           # Z ~ N(0,1)
        log_returns = drift + diffusion
        S_T = spot_value × exp(cumsum(log_returns)[-1])

    Args:
        spot_value: 起始估值（元），使用 RF+SDE 調整後估值
        mu:         年化漂移率（預設 4.5%）
        sigma:      年化波動率（預設 8.0%）
        n_paths:    模擬路徑數（預設 1000）
        n_steps:    模擬步數（預設 252，對應一個交易年）
        seed:       隨機種子（固定 42，確保可重現）

    Returns:
        Tuple[ConfidenceInterval（P5/P50/P95），risk_level（低/中/高風險）]
    """
    rng = np.random.default_rng(seed)

    dt = 1.0 / n_steps  # 每步時間間隔（以年為單位）

    # 生成標準常態隨機矩陣 shape=(n_paths, n_steps)
    Z = rng.standard_normal(size=(n_paths, n_steps))

    # GBM 對數收益率
    drift     = (mu - 0.5 * sigma ** 2) * dt
    diffusion = sigma * np.sqrt(dt) * Z          # shape=(n_paths, n_steps)

    # 累積對數收益率 → 期末價格
    log_returns   = drift + diffusion             # shape=(n_paths, n_steps)
    cum_log_return = np.sum(log_returns, axis=1)  # shape=(n_paths,)
    final_values   = spot_value * np.exp(cum_log_return)

    # 百分位數
    p5  = float(np.percentile(final_values, 5))
    p50 = float(np.percentile(final_values, 50))
    p95 = float(np.percentile(final_values, 95))

    ci = ConfidenceInterval(
        p5  = round(p5,  0),
        p50 = round(p50, 0),
        p95 = round(p95, 0),
    )

    # 風險等級判斷
    spread_ratio = (p95 - p5) / p50 if p50 > 0 else 0.0
    if spread_ratio < RISK_THRESHOLD_LOW:
        risk_level = "低風險"
    elif spread_ratio < RISK_THRESHOLD_HIGH:
        risk_level = "中風險"
    else:
        risk_level = "高風險"

    return ci, risk_level
