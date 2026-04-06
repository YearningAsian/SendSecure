from __future__ import annotations


def test_message_crud(client) -> None:
    register_response = client.post(
        "/v1/auth/register",
        json={"email": "alice@example.com", "password": "very-strong-password"},
    )
    token = register_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/v1/messages",
        headers=headers,
        json={
            "title": "Quarterly report",
            "body": "Encrypted message body",
            "recipient_email": "bob@example.com",
            "expires_at": "2030-01-01T00:00:00+00:00",
        },
    )

    assert create_response.status_code == 201
    message = create_response.json()
    assert message["title"] == "Quarterly report"
    assert message["status"] == "draft"

    list_response = client.get("/v1/messages", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    message_id = message["id"]
    get_response = client.get(f"/v1/messages/{message_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["recipient_email"] == "bob@example.com"

    update_response = client.patch(
        f"/v1/messages/{message_id}",
        headers=headers,
        json={
            "title": "Quarterly report v2",
            "body": "Encrypted message body updated",
            "recipient_email": "bob@example.com",
            "status": "active",
            "expires_at": "2030-01-01T00:00:00+00:00",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "active"

    delete_response = client.delete(f"/v1/messages/{message_id}", headers=headers)
    assert delete_response.status_code == 204
