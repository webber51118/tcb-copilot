"""
測試 inference/monte_carlo.py
涵蓋：GBM 確定性（seed=42）、P5<P50<P95 順序、風險等級判斷、比例縮放
"""

import math
import pytest
from src.main.python.inference.monte_carlo import (
    run_monte_carlo,
    ConfidenceInterval,
    DEFAULT_MU,
    DEFAULT_SIGMA,
    RISK_THRESHOLD_LOW,
    RISK_THRESHOLD_HIGH,
)


# ─────────────────────────────────────────────────────────────────
class TestConfidenceInterval:
    def test_dataclass_fields(self):
        ci = ConfidenceInterval(p5=100.0, p50=110.0, p95=120.0)
        assert ci.p5 == 100.0
        assert ci.p50 == 110.0
        assert ci.p95 == 120.0

    def test_default_none_fields_assignable(self):
        ci = ConfidenceInterval(p5=1.0, p50=2.0, p95=3.0)
        assert ci.p5 < ci.p50 < ci.p95


# ─────────────────────────────────────────────────────────────────
class TestRunMonteCarlo:
    def test_p5_less_than_p50_less_than_p95(self):
        ci, _ = run_monte_carlo(10_000_000)
        assert ci.p5 < ci.p50 < ci.p95

    def test_all_values_positive(self):
        ci, _ = run_monte_carlo(10_000_000)
        assert ci.p5 > 0
        assert ci.p50 > 0
        assert ci.p95 > 0

    def test_deterministic_with_same_seed(self):
        ci1, risk1 = run_monte_carlo(10_000_000, seed=42)
        ci2, risk2 = run_monte_carlo(10_000_000, seed=42)
        assert ci1.p5 == ci2.p5
        assert ci1.p50 == ci2.p50
        assert ci1.p95 == ci2.p95
        assert risk1 == risk2

    def test_different_seeds_yield_different_results(self):
        ci1, _ = run_monte_carlo(10_000_000, seed=42)
        ci2, _ = run_monte_carlo(10_000_000, seed=99)
        # 不同種子幾乎必然產生不同 P50
        assert ci1.p50 != ci2.p50

    def test_risk_level_valid_values(self):
        _, risk = run_monte_carlo(10_000_000)
        assert risk in ("低風險", "中風險", "高風險")

    def test_low_sigma_yields_low_risk(self):
        # 極低波動率 → 低風險
        _, risk = run_monte_carlo(10_000_000, sigma=0.001)
        assert risk == "低風險"

    def test_high_sigma_yields_high_risk(self):
        # 極高波動率 → 高風險
        _, risk = run_monte_carlo(10_000_000, sigma=0.80)
        assert risk == "高風險"

    def test_proportional_to_spot_value(self):
        ci_small, _ = run_monte_carlo(5_000_000, seed=42)
        ci_large, _ = run_monte_carlo(10_000_000, seed=42)
        ratio = ci_large.p50 / ci_small.p50
        assert abs(ratio - 2.0) < 0.01, f"P50 比例應接近 2.0，實際：{ratio}"

    def test_p50_near_expected_gbm_value(self):
        # P50 ≈ spot × exp(mu × 1 year)（忽略擴散項的 1/2 sigma^2 修正）
        spot = 10_000_000
        ci, _ = run_monte_carlo(spot, mu=0.045, sigma=0.080, seed=42)
        expected = spot * math.exp(0.045)
        # 允許 ±5% 誤差
        assert abs(ci.p50 - expected) / expected < 0.05

    def test_default_mu_positive(self):
        assert DEFAULT_MU > 0

    def test_default_sigma_reasonable(self):
        # 住宅市場波動率應在合理範圍
        assert 0.01 < DEFAULT_SIGMA < 0.50

    def test_risk_thresholds_ordered(self):
        assert 0 < RISK_THRESHOLD_LOW < RISK_THRESHOLD_HIGH

    def test_returns_tuple_of_two(self):
        result = run_monte_carlo(10_000_000)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_confidence_interval_type(self):
        ci, _ = run_monte_carlo(10_000_000)
        assert isinstance(ci, ConfidenceInterval)

    def test_medium_sigma_medium_risk(self):
        # sigma=0.20 應產生中高波動，確認 risk 不為低風險
        _, risk = run_monte_carlo(10_000_000, sigma=0.20)
        assert risk in ("中風險", "高風險")
