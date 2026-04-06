from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class MessageStatus(str, Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


@dataclass(slots=True)
class User:
    id: str
    email: str
    password_hash: str
    role: str
    created_at: datetime
    disabled_at: datetime | None = None


@dataclass(slots=True)
class SecureMessage:
    id: str
    owner_id: str
    title: str
    body: str
    recipient_email: str
    status: MessageStatus
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class AuditEvent:
    id: str
    actor_id: str | None
    action: str
    resource_type: str
    resource_id: str | None
    metadata: dict[str, str]
    created_at: datetime


@dataclass(slots=True)
class Actor:
    id: str
    email: str
    role: str
    created_at: datetime
