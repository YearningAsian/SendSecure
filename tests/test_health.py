from __future__ import annotations


def test_healthz(client) -> None:
    response = client.get("/v1/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz(client) -> None:
    response = client.get("/v1/readyz")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
