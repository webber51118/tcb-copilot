"""
測試 inference/demo_rf_sde.py
涵蓋：屋齡情緒修正邊界、建物需求係數、RF+SDE 情緒分數、估值調整邏輯
"""

import pytest
from src.main.python.inference.demo_rf_sde import (
    age_sentiment_factor,
    run_demo_rf_sde,
    BUILDING_DEMAND_FACTOR,
)


# ─────────────────────────────────────────────────────────────────
class TestAgeSentimentFactor:
    def test_brand_new_highest_sentiment(self):
        assert age_sentiment_factor(0) == 0.08

    def test_5_year_still_new(self):
        assert age_sentiment_factor(5) == 0.08

    def test_6_year_mid_range(self):
        assert age_sentiment_factor(6) == 0.03

    def test_15_year_still_mid(self):
        assert age_sentiment_factor(15) == 0.03

    def test_16_year_negative(self):
        assert age_sentiment_factor(16) == -0.05

    def test_30_year_still_mid_negative(self):
        assert age_sentiment_factor(30) == -0.05

    def test_31_year_most_negative(self):
        assert age_sentiment_factor(31) == -0.12

    def test_very_old_most_negative(self):
        assert age_sentiment_factor(50) == -0.12
        assert age_sentiment_factor(80) == -0.12

    def test_monotone_decreasing(self):
        assert age_sentiment_factor(0) > age_sentiment_factor(10)
        assert age_sentiment_factor(10) > age_sentiment_factor(20)
        assert age_sentiment_factor(20) > age_sentiment_factor(40)


# ─────────────────────────────────────────────────────────────────
class TestBuildingDemandFactor:
    def test_apartment_highest_demand(self):
        # 大樓需求最高
        assert BUILDING_DEMAND_FACTOR["大樓"] == 0.10

    def test_townhouse_negative_demand(self):
        # 透天流動性較差
        assert BUILDING_DEMAND_FACTOR["透天"] < 0

    def test_all_5_building_types_defined(self):
        for bt in ["大樓", "華廈", "公寓", "透天", "別墅"]:
            assert bt in BUILDING_DEMAND_FACTOR


# ─────────────────────────────────────────────────────────────────
class TestRunDemoRfSde:
    def test_returns_tuple_of_two(self):
        result = run_demo_rf_sde("台北市", "大樓", 5, 10_000_000)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_sentiment_score_in_range(self):
        _, score = run_demo_rf_sde("台北市", "大樓", 5, 10_000_000)
        assert -1.0 <= score <= 1.0

    def test_rf_adjusted_value_positive(self):
        val, _ = run_demo_rf_sde("台北市", "大樓", 5, 10_000_000)
        assert val > 0

    def test_high_demand_region_bullish_sentiment(self):
        # 高成長區（新竹市）+ 大樓 + 新屋 → 情緒分數應為正
        _, score = run_demo_rf_sde("新竹市", "大樓", 1, 10_000_000)
        assert score > 0

    def test_low_demand_bearish_sentiment(self):
        # 低成長區（連江縣）+ 透天 + 舊屋 → 情緒分數應為負
        _, score = run_demo_rf_sde("連江縣", "透天", 50, 10_000_000)
        assert score < 0

    def test_bullish_adjustment_up_3pct(self):
        # 偏多（sentiment > 0.15）→ 估值調升 3%
        val, score = run_demo_rf_sde("新竹市", "大樓", 1, 10_000_000)
        if score > 0.15:
            assert val == pytest.approx(10_000_000 * 1.03, rel=0.001)

    def test_bearish_adjustment_down_5pct(self):
        # 偏空（sentiment < -0.15）→ 估值調降 5%
        val, score = run_demo_rf_sde("連江縣", "透天", 50, 10_000_000)
        if score < -0.15:
            assert val == pytest.approx(10_000_000 * 0.95, rel=0.001)

    def test_neutral_no_adjustment(self):
        # 中性情緒 → 估值不變
        val, score = run_demo_rf_sde("台北市", "公寓", 15, 10_000_000)
        if -0.15 <= score <= 0.15:
            assert val == pytest.approx(10_000_000, rel=0.001)

    def test_unknown_building_type_neutral_demand(self):
        # 未知建物類型使用 0.0（中性需求）
        val, score = run_demo_rf_sde("台北市", "未知建物", 10, 10_000_000)
        assert -1.0 <= score <= 1.0
        assert val > 0

    def test_sentiment_clipped_to_max_1(self):
        # 即使累計因子大於 1.0，情緒分數應被 clip
        _, score = run_demo_rf_sde("新竹市", "大樓", 0, 10_000_000)
        assert score <= 1.0

    def test_sentiment_clipped_to_min_minus_1(self):
        # 即使累計因子小於 -1.0，情緒分數應被 clip
        _, score = run_demo_rf_sde("連江縣", "透天", 80, 10_000_000)
        assert score >= -1.0
