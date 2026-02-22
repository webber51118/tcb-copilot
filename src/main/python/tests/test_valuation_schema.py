"""
測試 models/valuation_schema.py
涵蓋：Pydantic 輸入驗證、建物類型校驗、邊界值測試
"""

import pytest
from pydantic import ValidationError
from src.main.python.models.valuation_schema import (
    ValuationRequest,
    ValuationResult,
    ValuationConfidenceInterval,
)

VALID_REQUEST = {
    "area_ping": 30.0,
    "property_age": 10,
    "building_type": "大樓",
    "floor": 8,
    "has_parking": False,
    "layout": "3房2廳",
    "region": "台北市",
    "loan_amount": 8_000_000.0,
}


# ─────────────────────────────────────────────────────────────────
class TestValuationRequest:
    def test_valid_request_accepted(self):
        req = ValuationRequest(**VALID_REQUEST)
        assert req.area_ping == 30.0
        assert req.region == "台北市"
        assert req.building_type == "大樓"

    def test_invalid_building_type_raises(self):
        with pytest.raises(ValidationError) as exc_info:
            ValuationRequest(**{**VALID_REQUEST, "building_type": "豪宅"})
        assert "建物類型" in str(exc_info.value)

    def test_zero_area_ping_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "area_ping": 0})

    def test_area_ping_exceeds_1000_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "area_ping": 1001})

    def test_area_ping_max_boundary_accepted(self):
        req = ValuationRequest(**{**VALID_REQUEST, "area_ping": 1000})
        assert req.area_ping == 1000

    def test_negative_property_age_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "property_age": -1})

    def test_property_age_zero_accepted(self):
        req = ValuationRequest(**{**VALID_REQUEST, "property_age": 0})
        assert req.property_age == 0

    def test_property_age_exceeds_80_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "property_age": 81})

    def test_property_age_max_boundary_accepted(self):
        req = ValuationRequest(**{**VALID_REQUEST, "property_age": 80})
        assert req.property_age == 80

    def test_floor_zero_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "floor": 0})

    def test_floor_exceeds_99_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "floor": 100})

    def test_floor_max_boundary_accepted(self):
        req = ValuationRequest(**{**VALID_REQUEST, "floor": 99})
        assert req.floor == 99

    def test_zero_loan_amount_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "loan_amount": 0})

    def test_negative_loan_amount_raises(self):
        with pytest.raises(ValidationError):
            ValuationRequest(**{**VALID_REQUEST, "loan_amount": -1})

    def test_all_building_types_accepted(self):
        for bt in ["大樓", "華廈", "公寓", "透天", "別墅"]:
            req = ValuationRequest(**{**VALID_REQUEST, "building_type": bt})
            assert req.building_type == bt

    def test_parking_true_accepted(self):
        req = ValuationRequest(**{**VALID_REQUEST, "has_parking": True})
        assert req.has_parking is True

    def test_parking_false_accepted(self):
        req = ValuationRequest(**{**VALID_REQUEST, "has_parking": False})
        assert req.has_parking is False


# ─────────────────────────────────────────────────────────────────
class TestValuationConfidenceInterval:
    def test_valid_ci_accepted(self):
        ci = ValuationConfidenceInterval(p5=100.0, p50=110.0, p95=120.0)
        assert ci.p5 == 100.0
        assert ci.p50 == 110.0
        assert ci.p95 == 120.0
