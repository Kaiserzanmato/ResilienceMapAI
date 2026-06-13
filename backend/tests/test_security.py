from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_ai_rate_limit_returns_429():
    settings = get_settings()
    client = TestClient(app)
    last = None
    for _ in range(settings.ai_rate_limit_requests + 5):
        last = client.post("/api/agent/query",
                           json={"message": "test", "persona": "citizen"})
    assert last.status_code == 429
    assert "Retry-After" in last.headers
    assert "rate limit" in last.json()["detail"].lower()


def test_dataset_upload_requires_role():
    client = TestClient(app)
    meta = {"name": "Test Dataset", "agency": "USGS", "category": "flood",
            "url": "https://example.usgs.gov/data", "confidence": "High", "records": 10}
    denied = client.post("/api/datasets/upload", json=meta)
    assert denied.status_code == 403
    allowed = client.post("/api/datasets/upload", json=meta,
                          headers={"x-role": "dataset_admin"})
    assert allowed.status_code == 200
    assert allowed.json()["dataset"]["status"] == "pending_review"


def test_dataset_upload_rejects_http_url():
    client = TestClient(app)
    meta = {"name": "Bad Dataset", "agency": "X", "category": "flood",
            "url": "http://insecure.example.com", "confidence": "High", "records": 1}
    resp = client.post("/api/datasets/upload", json=meta,
                       headers={"x-role": "dataset_admin"})
    assert resp.status_code == 422
