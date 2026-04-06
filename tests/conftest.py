from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sendsec.api import create_app
from sendsec.config import Settings


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    return Settings(
        APP_NAME="SendSec Test",
        ENVIRONMENT="test",
        LOG_LEVEL="DEBUG",
        DATABASE_PATH=str(tmp_path / "sendsec.db"),
        APP_SECRET_KEY="test-secret-key-that-is-long-enough",
        TOKEN_TTL_MINUTES=60,
        JWT_ISSUER="sendsec-test",
        JWT_AUDIENCE="sendsec-test-api",
    )


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    app = create_app(settings=settings)
    return TestClient(app)
