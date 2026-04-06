from __future__ import annotations

from fastapi.testclient import TestClient
from sendsec.api import create_app
from sendsec.config import Settings


def test_cors_allows_configured_frontend_origin(tmp_path) -> None:
    settings = Settings(
        APP_NAME="SendSecure Test",
        ENVIRONMENT="test",
        LOG_LEVEL="DEBUG",
        DATABASE_PATH=str(tmp_path / "sendsec.db"),
        APP_SECRET_KEY="test-secret-key-that-is-long-enough",
        TOKEN_TTL_MINUTES=60,
        JWT_ISSUER="sendsec-test",
        JWT_AUDIENCE="sendsec-test-api",
        CORS_ORIGINS="http://127.0.0.1:5173",
    )
    app = create_app(settings=settings)
    client = TestClient(app)

    response = client.get(
        "/v1/healthz",
        headers={"Origin": "http://127.0.0.1:5173"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"