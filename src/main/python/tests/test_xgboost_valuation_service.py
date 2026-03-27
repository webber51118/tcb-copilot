"""
測試 services/xgboostValuationService.py
涵蓋：Demo 模式（模型不存在時）、信心區間排序、LTV 計算、風險升級邏輯
"""

import pytest
from unittest.mock import patch
from pathlib import Path


def _valuate(**kwargs):
    """呼叫 valuate_xgboost，套用預設值"""
    from src.main.python.services.xgboostValuationService import valuate_xgboost
    defaults = dict(
        district="大安區",
        building_type="大樓",
        area_ping=30.0,
        property_age=10,
        floor=8,
        total_floors=12,
        has_parking=False,
        rooms=3,
        loan_amount=8_000_000.0,
    )
    defaults.update(kwargs)
    return valuate_xgboost(**defaults)


# ─── Demo 模式（模型檔案不存在）────────────────────────────────────

class TestDemoMode:
    """MODEL_PATH.exists() == False → 走行政區查表 Demo 路徑"""

    def test_returns_dict(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        assert isinstance(result, dict)

    def test_model_tag_is_demo(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        assert result["model"] == "demo"

    def test_estimated_value_positive(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        assert result["estimated_value"] > 0

    def test_confidence_interval_ordering(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        ci = result["confidence_interval"]
        assert ci["p5"] < ci["p50"] < ci["p95"]

    def test_estimated_value_equals_p50(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        assert result["estimated_value"] == result["confidence_interval"]["p50"]

    def test_ltv_calculation(self):
        loan = 8_000_000.0
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate(loan_amount=loan)
        p50 = result["confidence_interval"]["p50"]
        expected = round(loan / p50, 4) if p50 > 0 else 0
        assert abs(result["ltv_ratio"] - expected) < 0.001

    def test_risk_level_valid(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        assert result["risk_level"] in ("低風險", "中風險", "高風險")

    def test_high_ltv_upgrades_risk(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate(loan_amount=200_000_000.0)
        assert result["ltv_ratio"] > 0.80
        assert result["risk_level"] in ("中風險", "高風險")

    def test_price_per_ping_positive(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate()
        assert result["price_per_ping"] > 0

    def test_daan_higher_than_wanhua(self):
        """大安區單價應高於萬華區（乘數差異 1.35 vs 0.82）"""
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            daan   = _valuate(district="大安區",  area_ping=30.0)
            wanhua = _valuate(district="萬華區",  area_ping=30.0)
        assert daan["estimated_value"] > wanhua["estimated_value"]

    def test_unknown_district_returns_value(self):
        """未知行政區 → 使用預設單價，不崩潰"""
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            result = _valuate(district="火星區")
        assert result["estimated_value"] > 0

    def test_larger_area_higher_value(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            small = _valuate(area_ping=20.0)
            large = _valuate(area_ping=50.0)
        assert large["estimated_value"] > small["estimated_value"]

    def test_older_property_lower_value(self):
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            new_prop = _valuate(property_age=3)
            old_prop = _valuate(property_age=40)
        assert new_prop["estimated_value"] > old_prop["estimated_value"]

    def test_all_major_districts_no_crash(self):
        """主要行政區（DISTRICT_TO_REGION 中的）皆不崩潰且回傳正值"""
        from src.main.python.utils.region_price_table import DISTRICT_TO_REGION
        with patch("src.main.python.services.xgboostValuationService.MODEL_PATH") as mp:
            mp.exists.return_value = False
            for district in list(DISTRICT_TO_REGION.keys())[:15]:
                result = _valuate(district=district)
                assert result["estimated_value"] > 0, f"{district} 鑑價應為正值"
