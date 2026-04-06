from __future__ import annotations


def test_register_and_me(client) -> None:
    response = client.post(
        "/v1/auth/register",
        json={"email": "alice@example.com", "password": "very-strong-password"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["user"]["email"] == "alice@example.com"

    me_response = client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["email"] == "alice@example.com"


def test_login_rejects_bad_password(client) -> None:
    client.post(
        "/v1/auth/register",
        json={"email": "alice@example.com", "password": "very-strong-password"},
    )

    response = client.post(
        "/v1/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
