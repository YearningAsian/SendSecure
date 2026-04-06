from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sendsecure.api import create_app
from sendsecure.config import Settings


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    return Settings(
        APP_NAME="SendSecure Test",
        ENVIRONMENT="test",
        LOG_LEVEL="DEBUG",
        DATABASE_PATH=str(tmp_path / "sendsecure.db"),
        APP_SECRET_KEY="test-secret-key-that-is-long-enough",
        TOKEN_TTL_MINUTES=60,
        JWT_ISSUER="sendsecure-test",
        JWT_AUDIENCE="sendsecure-test-api",
    )


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    app = create_app(settings=settings)
    return TestClient(app)
