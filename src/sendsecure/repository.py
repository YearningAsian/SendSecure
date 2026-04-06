from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .domain import Actor, AuditEvent, MessageStatus, SecureMessage, User


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _from_iso(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


class SQLiteRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    disabled_at TEXT
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    recipient_email TEXT NOT NULL,
                    status TEXT NOT NULL,
                    expires_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS audit_events (
                    id TEXT PRIMARY KEY,
                    actor_id TEXT,
                    action TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT,
                    metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL
                );
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON;")
        return connection

    def health_check(self) -> bool:
        with self._connect() as connection:
            connection.execute("SELECT 1")
        return True

    def create_user(self, *, email: str, password_hash: str, role: str) -> User:
        user = User(
            id=str(uuid4()),
            email=email.lower(),
            password_hash=password_hash,
            role=role,
            created_at=_utc_now(),
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO users (id, email, password_hash, role, created_at, disabled_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    user.email,
                    user.password_hash,
                    user.role,
                    _to_iso(user.created_at),
                    None,
                ),
            )
        return user

    def get_user_by_email(self, email: str) -> User | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM users WHERE email = ?",
                (email.lower(),),
            ).fetchone()
        return self._row_to_user(row) if row else None

    def get_user_by_id(self, user_id: str) -> User | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        return self._row_to_user(row) if row else None

    def create_message(
        self,
        *,
        owner_id: str,
        title: str,
        body: str,
        recipient_email: str,
        status: MessageStatus = MessageStatus.draft,
        expires_at: datetime | None = None,
    ) -> SecureMessage:
        message = SecureMessage(
            id=str(uuid4()),
            owner_id=owner_id,
            title=title,
            body=body,
            recipient_email=recipient_email.lower(),
            status=status,
            expires_at=expires_at,
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO messages (
                    id, owner_id, title, body, recipient_email, status,
                    expires_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    message.id,
                    message.owner_id,
                    message.title,
                    message.body,
                    message.recipient_email,
                    message.status.value,
                    _to_iso(message.expires_at),
                    _to_iso(message.created_at),
                    _to_iso(message.updated_at),
                ),
            )
        return message

    def list_messages(self, *, owner_id: str) -> list[SecureMessage]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM messages WHERE owner_id = ? ORDER BY created_at DESC",
                (owner_id,),
            ).fetchall()
        return [self._row_to_message(row) for row in rows]

    def get_message(self, message_id: str) -> SecureMessage | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM messages WHERE id = ?",
                (message_id,),
            ).fetchone()
        return self._row_to_message(row) if row else None

    def update_message(
        self,
        *,
        message_id: str,
        title: str,
        body: str,
        recipient_email: str,
        status: MessageStatus,
        expires_at: datetime | None,
    ) -> SecureMessage | None:
        updated_at = _utc_now()
        with self._connect() as connection:
            result = connection.execute(
                """
                UPDATE messages
                SET title = ?, body = ?, recipient_email = ?, status = ?,
                    expires_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    title,
                    body,
                    recipient_email.lower(),
                    status.value,
                    _to_iso(expires_at),
                    _to_iso(updated_at),
                    message_id,
                ),
            )
            if result.rowcount == 0:
                return None
        return self.get_message(message_id)

    def delete_message(self, message_id: str) -> bool:
        with self._connect() as connection:
            result = connection.execute("DELETE FROM messages WHERE id = ?", (message_id,))
        return result.rowcount > 0

    def record_audit_event(
        self,
        *,
        actor_id: str | None,
        action: str,
        resource_type: str,
        resource_id: str | None,
        metadata: dict[str, str],
    ) -> AuditEvent:
        audit_event = AuditEvent(
            id=str(uuid4()),
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata,
            created_at=_utc_now(),
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO audit_events (
                    id, actor_id, action, resource_type, resource_id, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    audit_event.id,
                    audit_event.actor_id,
                    audit_event.action,
                    audit_event.resource_type,
                    audit_event.resource_id,
                    json.dumps(audit_event.metadata, sort_keys=True),
                    _to_iso(audit_event.created_at),
                ),
            )
        return audit_event

    def list_audit_events(self, *, actor_id: str | None = None) -> list[AuditEvent]:
        query = "SELECT * FROM audit_events"
        parameters: tuple[object, ...] = ()
        if actor_id is not None:
            query += " WHERE actor_id = ?"
            parameters = (actor_id,)
        query += " ORDER BY created_at DESC"
        with self._connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [self._row_to_audit_event(row) for row in rows]

    def actor_from_user(self, user: User) -> Actor:
        return Actor(id=user.id, email=user.email, role=user.role, created_at=user.created_at)

    def _row_to_user(self, row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            role=row["role"],
            created_at=_from_iso(row["created_at"]),
            disabled_at=_from_iso(row["disabled_at"]),
        )

    def _row_to_message(self, row: sqlite3.Row) -> SecureMessage:
        return SecureMessage(
            id=row["id"],
            owner_id=row["owner_id"],
            title=row["title"],
            body=row["body"],
            recipient_email=row["recipient_email"],
            status=MessageStatus(row["status"]),
            expires_at=_from_iso(row["expires_at"]),
            created_at=_from_iso(row["created_at"]),
            updated_at=_from_iso(row["updated_at"]),
        )

    def _row_to_audit_event(self, row: sqlite3.Row) -> AuditEvent:
        return AuditEvent(
            id=row["id"],
            actor_id=row["actor_id"],
            action=row["action"],
            resource_type=row["resource_type"],
            resource_id=row["resource_id"],
            metadata=json.loads(row["metadata_json"]),
            created_at=_from_iso(row["created_at"]),
        )
