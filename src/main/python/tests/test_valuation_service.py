"""
測試 services/valuationService.py
涵蓋：端對端鑑價流程、LTV 計算、風險等級升級邏輯、breakdown 鍵完整性
"""

import pytest
from src.main.python.models.valuation_schema import ValuationRequest
from src.main.python.services.valuationService import valuate


def make_request(**kwargs):
    """建立帶預設值的 ValuationRequest"""
    defaults = {
        "area_ping": 30.0,
        "property_age": 10,
        "building_type": "大樓",
        "floor": 8,
        "has_parking": False,
        "layout": "3房2廳",
        "region": "台北市",
        "loan_amount": 8_000_000.0,
    }
    defaults.update(kwargs)
    return ValuationRequest(**defaults)


# ─────────────────────────────────────────────────────────────────
class TestValuate:
    def test_returns_valuation_result(self):
        result = valuate(make_request())
        assert result is not None

    def test_estimated_value_positive(self):
        result = valuate(make_request())
        assert result.estimated_value > 0

    def test_confidence_interval_ordering(self):
        result = valuate(make_request())
        ci = result.confidence_interval
        assert ci.p5 < ci.p50 < ci.p95

    def test_estimated_value_equals_p50(self):
        result = valuate(make_request())
        assert result.estimated_value == result.confidence_interval.p50

    def test_ltv_calculation_correct(self):
        loan = 8_000_000.0
        result = valuate(make_request(loan_amount=loan))
        expected_ltv = loan / result.estimated_value
        assert abs(result.ltv_ratio - expected_ltv) < 0.0001

    def test_mode_is_demo(self):
        result = valuate(make_request())
        assert result.mode == "demo"

    def test_region_preserved(self):
        result = valuate(make_request(region="台中市"))
        assert result.region == "台中市"

    def test_building_type_preserved(self):
        result = valuate(make_request(building_type="公寓"))
        assert result.building_type == "公寓"

    def test_high_ltv_upgrades_low_risk_to_medium(self):
        # 超高貸款金額確保 LTV > 0.8 → 若原為低風險應升為中風險
        result = valuate(make_request(loan_amount=50_000_000.0))
        assert result.ltv_ratio > 0.80
        assert result.risk_level in ("中風險", "高風險")

    def test_breakdown_has_all_required_keys(self):
        result = valuate(make_request())
        for key in [
            "unit_price_per_ping", "area_ping", "building_multiplier",
            "age_depreciation", "floor_factor", "layout_efficiency",
            "main_value", "parking_premium",
        ]:
            assert key in result.breakdown, f"breakdown 缺少鍵：{key}"

    def test_sentiment_score_in_range(self):
        result = valuate(make_request())
        assert -1.0 <= result.sentiment_score <= 1.0

    def test_base_value_positive(self):
        result = valuate(make_request())
        assert result.base_value > 0

    def test_lstm_index_positive(self):
        result = valuate(make_request())
        assert result.lstm_index > 0

    def test_risk_level_valid(self):
        result = valuate(make_request())
        assert result.risk_level in ("低風險", "中風險", "高風險")

    def test_larger_area_higher_estimated_value(self):
        result_small = valuate(make_request(area_ping=20.0))
        result_large = valuate(make_request(area_ping=50.0))
        assert result_large.estimated_value > result_small.estimated_value

    def test_older_property_lower_base_value(self):
        result_new = valuate(make_request(property_age=3))
        result_old = valuate(make_request(property_age=40))
        assert result_new.base_value > result_old.base_value

    def test_all_22_regions_produce_positive_value(self):
        from src.main.python.utils.region_price_table import REGION_BASE_PRICE
        for region in REGION_BASE_PRICE:
            result = valuate(make_request(region=region))
            assert result.estimated_value > 0, f"{region} 鑑價應為正值"
