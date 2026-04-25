"""Health/root endpoint smoke tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_root_returns_app_info(client: TestClient) -> None:
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] is True
    assert body["data"]["app"]
    assert body["data"]["version"]


def test_health_endpoint_ok(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] is True
    assert body["data"]["status"] == "ok"
