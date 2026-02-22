"""
測試 inference/demo_lstm.py
涵蓋：地區成長率字典、LSTM 市場指數計算、估值調整比例
"""

import pytest
from src.main.python.inference.demo_lstm import (
    run_demo_lstm,
    REGION_ANNUAL_GROWTH,
    BASE_INDEX,
    YEARS_ELAPSED,
    SCALE_FACTOR,
)


# ─────────────────────────────────────────────────────────────────
class TestRegionAnnualGrowth:
    def test_all_22_regions_defined(self):
        assert len(REGION_ANNUAL_GROWTH) == 22

    def test_growth_rates_positive(self):
        for region, rate in REGION_ANNUAL_GROWTH.items():
            assert rate > 0, f"{region} 成長率應大於 0"

    def test_taipei_defined(self):
        assert "台北市" in REGION_ANNUAL_GROWTH

    def test_hsinchu_highest_annual_growth(self):
        # 新竹市科技業帶動，年化成長率 6.2% 為最高
        assert REGION_ANNUAL_GROWTH["新竹市"] == pytest.approx(0.062)

    def test_lienchiang_lowest_annual_growth(self):
        # 連江縣年化成長率 2.0% 為最低
        assert REGION_ANNUAL_GROWTH["連江縣"] == pytest.approx(0.020)

    def test_hsinchu_higher_than_taipei(self):
        # 新竹市成長率 > 台北市成長率
        assert REGION_ANNUAL_GROWTH["新竹市"] > REGION_ANNUAL_GROWTH["台北市"]


# ─────────────────────────────────────────────────────────────────
class TestRunDemoLstm:
    def test_returns_tuple_of_two(self):
        result = run_demo_lstm("台北市", 10_000_000)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_adjusted_value_positive(self):
        adj_val, _ = run_demo_lstm("台北市", 5_000_000)
        assert adj_val > 0

    def test_lstm_index_positive(self):
        _, lstm_idx = run_demo_lstm("台北市", 5_000_000)
        assert lstm_idx > 0

    def test_unknown_region_uses_default_rate(self):
        # 未知地區使用 0.035 預設值，仍應回傳正值
        adj_val, lstm_idx = run_demo_lstm("外太空市", 5_000_000)
        assert adj_val > 0
        assert lstm_idx > 0

    def test_larger_base_value_gives_larger_adjusted(self):
        adj_small, _ = run_demo_lstm("台北市", 5_000_000)
        adj_large, _ = run_demo_lstm("台北市", 10_000_000)
        assert adj_large > adj_small

    def test_higher_growth_region_higher_index(self):
        # 新竹市年化成長率 6.2% > 連江縣 2.0%
        _, idx_hsinchu = run_demo_lstm("新竹市", 5_000_000)
        _, idx_lienchiang = run_demo_lstm("連江縣", 5_000_000)
        assert idx_hsinchu > idx_lienchiang

    def test_adjusted_value_proportional_to_base(self):
        # 相同地區 + 相同公式，估值應成比例
        adj_a, _ = run_demo_lstm("台中市", 4_000_000)
        adj_b, _ = run_demo_lstm("台中市", 8_000_000)
        ratio = adj_b / adj_a
        assert abs(ratio - 2.0) < 0.01, f"比例應接近 2.0，實際：{ratio}"

    def test_all_22_regions_return_positive(self):
        for region in REGION_ANNUAL_GROWTH:
            adj_val, lstm_idx = run_demo_lstm(region, 5_000_000)
            assert adj_val > 0, f"{region} 調整估值應為正值"
            assert lstm_idx > 0, f"{region} LSTM 指數應為正值"

    def test_base_index_is_100(self):
        assert BASE_INDEX == 100.0

    def test_years_elapsed_is_11(self):
        assert YEARS_ELAPSED == 11

    def test_scale_factor_reasonable(self):
        # 縮放因子應在合理範圍（避免過度偏移）
        assert 0.0 < SCALE_FACTOR <= 1.0
