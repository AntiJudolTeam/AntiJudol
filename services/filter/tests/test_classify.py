"""HTTP-level tests for the /api/v1/classify endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_predict_blocks_gambling(client: TestClient) -> None:
    res = client.post("/api/v1/classify/predict", json={"text": "slot gacor maxwin"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] is True
    assert body["data"]["label"] == 1
    assert body["data"]["gambling"] > 0.5
    assert body["data"]["text"] == "slot gacor maxwin"


def test_predict_allows_clean_text(client: TestClient) -> None:
    res = client.post("/api/v1/classify/predict", json={"text": "halo selamat malam"})
    body = res.json()
    assert res.status_code == 200
    assert body["data"]["label"] == 0
    assert body["data"]["gambling"] < 0.5


def test_predict_rejects_empty_string(client: TestClient) -> None:
    res = client.post("/api/v1/classify/predict", json={"text": ""})
    assert res.status_code == 422
    body = res.json()
    assert body["status"] is False
    assert body["message"] == "Validation error"


def test_predict_rejects_missing_field(client: TestClient) -> None:
    res = client.post("/api/v1/classify/predict", json={})
    assert res.status_code == 422


def test_batch_returns_per_item_results(client: TestClient) -> None:
    res = client.post(
        "/api/v1/classify/predict/batch",
        json={"texts": ["slot gacor", "halo bang", "rtp slot"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] is True
    assert len(body["data"]) == 3
    assert body["data"][0]["label"] == 1
    assert body["data"][1]["label"] == 0


def test_batch_rejects_empty_list(client: TestClient) -> None:
    res = client.post("/api/v1/classify/predict/batch", json={"texts": []})
    assert res.status_code == 422
