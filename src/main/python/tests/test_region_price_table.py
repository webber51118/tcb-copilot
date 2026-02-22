"""
測試 utils/region_price_table.py
涵蓋：屋齡折舊、樓層係數、格局效率、基準估值計算
"""

import pytest
from src.main.python.utils.region_price_table import (
    age_depreciation_factor,
    floor_adjustment_factor,
    layout_efficiency_factor,
    calculate_base_value,
    REGION_BASE_PRICE,
    BUILDING_TYPE_MULTIPLIER,
)


# ─────────────────────────────────────────────────────────────────
class TestAgeDepreciationFactor:
    def test_brand_new_no_depreciation(self):
        assert age_depreciation_factor(0) == 1.00

    def test_1_year_old(self):
        assert age_depreciation_factor(1) == pytest.approx(0.99)

    def test_5_year_old(self):
        assert age_depreciation_factor(5) == pytest.approx(0.95)

    def test_10_year_old_mid_range(self):
        # 0.95 - (10-5)*0.02 = 0.95 - 0.10 = 0.85
        assert age_depreciation_factor(10) == pytest.approx(0.85)

    def test_20_year_boundary(self):
        # 0.95 - (20-5)*0.02 = 0.95 - 0.30 = 0.65
        assert age_depreciation_factor(20) == pytest.approx(0.65)

    def test_30_year_old(self):
        # 0.65 - (30-20)*0.005 = 0.65 - 0.05 = 0.60
        assert age_depreciation_factor(30) == pytest.approx(0.60)

    def test_40_year_old(self):
        # 0.65 - (40-20)*0.005 = 0.65 - 0.10 = 0.55
        assert age_depreciation_factor(40) == pytest.approx(0.55)

    def test_very_old_minimum_55_percent(self):
        assert age_depreciation_factor(60) == 0.55
        assert age_depreciation_factor(80) == 0.55

    def test_younger_property_higher_factor(self):
        assert age_depreciation_factor(5) > age_depreciation_factor(20)
        assert age_depreciation_factor(20) > age_depreciation_factor(40)


# ─────────────────────────────────────────────────────────────────
class TestFloorAdjustmentFactor:
    def test_first_floor_discount(self):
        assert floor_adjustment_factor(1, "大樓") == 0.88

    def test_second_floor_low_premium(self):
        assert floor_adjustment_factor(2, "大樓") == 0.95

    def test_third_floor_low_premium(self):
        assert floor_adjustment_factor(3, "大樓") == 0.95

    def test_mid_floor_base_rate(self):
        assert floor_adjustment_factor(5, "大樓") == 1.00
        assert floor_adjustment_factor(7, "大樓") == 1.00

    def test_high_floor_premium(self):
        assert floor_adjustment_factor(10, "大樓") == 1.05
        assert floor_adjustment_factor(15, "大樓") == 1.05

    def test_very_high_floor_higher_premium(self):
        assert floor_adjustment_factor(20, "大樓") == 1.08
        assert floor_adjustment_factor(25, "大樓") == 1.08

    def test_penthouse_top_premium(self):
        assert floor_adjustment_factor(30, "大樓") == 1.10
        assert floor_adjustment_factor(50, "大樓") == 1.10

    def test_townhouse_floor_irrelevant(self):
        assert floor_adjustment_factor(1, "透天") == 1.00
        assert floor_adjustment_factor(10, "透天") == 1.00

    def test_villa_floor_irrelevant(self):
        assert floor_adjustment_factor(3, "別墅") == 1.00

    def test_mansion_uses_floor_logic(self):
        # 華廈不在透天/別墅清單，使用樓層邏輯
        assert floor_adjustment_factor(1, "華廈") == 0.88
        assert floor_adjustment_factor(10, "華廈") == 1.05


# ─────────────────────────────────────────────────────────────────
class TestLayoutEfficiencyFactor:
    def test_studio_slight_discount(self):
        assert layout_efficiency_factor("套房") == 0.95

    def test_one_bedroom(self):
        assert layout_efficiency_factor("1房1廳") == 0.95

    def test_two_bedroom_highest_efficiency(self):
        assert layout_efficiency_factor("2房1廳") == 1.05
        assert layout_efficiency_factor("2房2廳") == 1.05

    def test_three_bedroom_main_stream(self):
        assert layout_efficiency_factor("3房2廳") == 1.02
        assert layout_efficiency_factor("3房") == 1.02

    def test_four_bedroom_large_unit(self):
        assert layout_efficiency_factor("4房2廳") == 0.97
        assert layout_efficiency_factor("4房2廳2衛") == 0.97

    def test_unknown_layout_baseline(self):
        assert layout_efficiency_factor("頂樓複式") == 1.00
        assert layout_efficiency_factor("特殊格局") == 1.00


# ─────────────────────────────────────────────────────────────────
class TestCalculateBaseValue:
    def _calc(self, **kwargs):
        defaults = {
            "region": "台北市",
            "building_type": "大樓",
            "property_age": 10,
            "floor": 8,
            "layout": "3房2廳",
            "has_parking": False,
            "area_ping": 30,
        }
        defaults.update(kwargs)
        return calculate_base_value(**defaults)

    def test_positive_base_value(self):
        val, _ = self._calc()
        assert val > 0

    def test_breakdown_has_all_keys(self):
        _, bd = self._calc()
        for key in [
            "unit_price_per_ping", "area_ping", "building_multiplier",
            "age_depreciation", "floor_factor", "layout_efficiency",
            "main_value", "parking_premium",
        ]:
            assert key in bd

    def test_taipei_highest_unit_price(self):
        """台北市單價 160 萬/坪，為全台最高"""
        _, bd = self._calc(region="台北市")
        assert bd["unit_price_per_ping"] == 160.0

    def test_parking_adds_premium_taipei(self):
        val_no, _ = self._calc(has_parking=False)
        val_yes, _ = self._calc(has_parking=True)
        assert val_yes - val_no == 3_000_000  # 台北市車位 300 萬

    def test_default_parking_premium_unknown_region(self):
        val_no, _ = self._calc(region="外太空市", has_parking=False)
        val_yes, _ = self._calc(region="外太空市", has_parking=True)
        assert val_yes - val_no == 500_000  # 預設車位 50 萬

    def test_unknown_region_uses_default_price(self):
        _, bd = self._calc(region="外太空市")
        assert bd["unit_price_per_ping"] == 10.0

    def test_larger_area_higher_value(self):
        val_small, _ = self._calc(area_ping=20)
        val_large, _ = self._calc(area_ping=50)
        assert val_large > val_small

    def test_older_property_lower_value(self):
        val_new, _ = self._calc(property_age=3)
        val_old, _ = self._calc(property_age=40)
        assert val_new > val_old

    def test_taipei_higher_than_rural(self):
        val_taipei, _ = self._calc(region="台北市")
        val_rural, _ = self._calc(region="南投縣")
        assert val_taipei > val_rural

    def test_apartment_lower_than_standard(self):
        val_apt, _ = self._calc(building_type="公寓")
        val_std, _ = self._calc(building_type="大樓")
        assert val_apt < val_std

    def test_villa_higher_than_standard(self):
        val_villa, _ = self._calc(building_type="別墅")
        val_std, _ = self._calc(building_type="大樓")
        assert val_villa > val_std

    def test_all_22_regions_positive(self):
        """22 個縣市都應回傳正值"""
        for region in REGION_BASE_PRICE:
            val, _ = self._calc(region=region)
            assert val > 0, f"{region} 回傳非正值：{val}"
