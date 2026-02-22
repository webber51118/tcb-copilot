"""
測試 core/app.py — FastAPI 路由端點
涵蓋：GET /health 健康檢查、POST /valuate 鑑價 API
"""

import pytest
from fastapi.testclient import TestClient
from src.main.python.core.app import app

client = TestClient(app)

VALID_PAYLOAD = {
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
class TestHealthEndpoint:
    def test_health_returns_200(self):
        res = client.get("/health")
        assert res.status_code == 200

    def test_health_status_ok(self):
        res = client.get("/health")
        data = res.json()
        assert data["status"] == "ok"

    def test_health_mode_demo(self):
        res = client.get("/health")
        data = res.json()
        assert data["mode"] == "demo"

    def test_health_port_8001(self):
        res = client.get("/health")
        data = res.json()
        assert data["port"] == 8001


# ─────────────────────────────────────────────────────────────────
class TestValuateEndpoint:
    def test_valid_request_returns_200(self):
        res = client.post("/valuate", json=VALID_PAYLOAD)
        assert res.status_code == 200

    def test_response_has_estimated_value(self):
        res = client.post("/valuate", json=VALID_PAYLOAD)
        data = res.json()
        assert "estimated_value" in data
        assert data["estimated_value"] > 0

    def test_response_has_confidence_interval(self):
        res = client.post("/valuate", json=VALID_PAYLOAD)
        data = res.json()
        ci = data["confidence_interval"]
        assert ci["p5"] < ci["p50"] < ci["p95"]

    def test_response_has_risk_level(self):
        res = client.post("/valuate", json=VALID_PAYLOAD)
        data = res.json()
        assert data["risk_level"] in ("低風險", "中風險", "高風險")

    def test_response_mode_is_demo(self):
        res = client.post("/valuate", json=VALID_PAYLOAD)
        data = res.json()
        assert data["mode"] == "demo"

    def test_invalid_building_type_returns_422(self):
        res = client.post("/valuate", json={**VALID_PAYLOAD, "building_type": "豪宅"})
        assert res.status_code == 422

    def test_zero_area_ping_returns_422(self):
        res = client.post("/valuate", json={**VALID_PAYLOAD, "area_ping": 0})
        assert res.status_code == 422

    def test_zero_loan_amount_returns_422(self):
        res = client.post("/valuate", json={**VALID_PAYLOAD, "loan_amount": 0})
        assert res.status_code == 422

    def test_with_parking_returns_higher_value(self):
        res_no = client.post("/valuate", json={**VALID_PAYLOAD, "has_parking": False})
        res_yes = client.post("/valuate", json={**VALID_PAYLOAD, "has_parking": True})
        assert res_yes.json()["estimated_value"] > res_no.json()["estimated_value"]
