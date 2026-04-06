from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

PBKDF2_ITERATIONS = 210_000


@dataclass(slots=True)
class TokenPayload:
    subject: str
    email: str
    role: str
    issued_at: datetime
    expires_at: datetime
    issuer: str
    audience: str


def _urlsafe_b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _urlsafe_b64decode(encoded: str) -> bytes:
    padding = "=" * (-len(encoded) % 4)
    return base64.urlsafe_b64decode(encoded + padding)


def hash_password(password: str, salt: bytes | None = None) -> str:
    if not password:
        raise ValueError("Password cannot be empty")

    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}"
        f"${_urlsafe_b64encode(salt)}${_urlsafe_b64encode(digest)}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    algorithm, iterations_text, salt_text, digest_text = password_hash.split("$")
    if algorithm != "pbkdf2_sha256":
        return False

    salt = _urlsafe_b64decode(salt_text)
    expected_digest = _urlsafe_b64decode(digest_text)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        int(iterations_text),
    )
    return hmac.compare_digest(digest, expected_digest)


def create_signed_token(
    *,
    subject: str,
    email: str,
    role: str,
    secret_key: str,
    issuer: str,
    audience: str,
    ttl_minutes: int,
    now: datetime | None = None,
) -> str:
    issued_at = now or datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=ttl_minutes)
    payload = {
        "aud": audience,
        "email": email,
        "exp": int(expires_at.timestamp()),
        "iat": int(issued_at.timestamp()),
        "iss": issuer,
        "role": role,
        "sub": subject,
        "nonce": secrets.token_urlsafe(12),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_part = _urlsafe_b64encode(payload_bytes)
    signature = hmac.new(secret_key.encode("utf-8"), payload_part.encode("ascii"), hashlib.sha256)
    return f"{payload_part}.{_urlsafe_b64encode(signature.digest())}"


def verify_signed_token(token: str, *, secret_key: str, issuer: str, audience: str) -> TokenPayload:
    payload_part, signature_part = token.split(".")
    expected_signature = hmac.new(
        secret_key.encode("utf-8"), payload_part.encode("ascii"), hashlib.sha256
    ).digest()
    provided_signature = _urlsafe_b64decode(signature_part)
    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("Invalid token signature")

    payload = json.loads(_urlsafe_b64decode(payload_part).decode("utf-8"))
    now_timestamp = int(datetime.now(timezone.utc).timestamp())
    if payload["iss"] != issuer or payload["aud"] != audience:
        raise ValueError("Invalid token audience or issuer")
    if now_timestamp >= int(payload["exp"]):
        raise ValueError("Token has expired")

    issued_at = datetime.fromtimestamp(int(payload["iat"]), tz=timezone.utc)
    expires_at = datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc)
    return TokenPayload(
        subject=str(payload["sub"]),
        email=str(payload["email"]),
        role=str(payload["role"]),
        issued_at=issued_at,
        expires_at=expires_at,
        issuer=str(payload["iss"]),
        audience=str(payload["aud"]),
    )
