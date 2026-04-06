from __future__ import annotations

from datetime import datetime

from .config import Settings
from .domain import Actor, AuditEvent, MessageStatus, SecureMessage, User
from .repository import SQLiteRepository
from .security import create_signed_token, hash_password, verify_password


class AuthError(Exception):
    pass


class NotFoundError(Exception):
    pass


class ForbiddenError(Exception):
    pass


class ConflictError(Exception):
    pass


class ValidationError(Exception):
    pass


class AuthService:
    def __init__(self, repository: SQLiteRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    def register(self, *, email: str, password: str) -> tuple[User, str]:
        existing_user = self.repository.get_user_by_email(email)
        if existing_user is not None:
            raise ConflictError("A user with that email already exists")

        user = self.repository.create_user(
            email=email,
            password_hash=hash_password(password),
            role="member",
        )
        token = self._issue_token(user)
        self.repository.record_audit_event(
            actor_id=user.id,
            action="auth.register",
            resource_type="user",
            resource_id=user.id,
            metadata={"email": user.email},
        )
        return user, token

    def login(self, *, email: str, password: str) -> tuple[User, str]:
        user = self.repository.get_user_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            raise AuthError("Invalid email or password")

        token = self._issue_token(user)
        self.repository.record_audit_event(
            actor_id=user.id,
            action="auth.login",
            resource_type="user",
            resource_id=user.id,
            metadata={"email": user.email},
        )
        return user, token

    def authenticate_token(self, token: str) -> Actor:
        from .security import verify_signed_token

        payload = verify_signed_token(
            token,
            secret_key=self.settings.app_secret_key,
            issuer=self.settings.jwt_issuer,
            audience=self.settings.jwt_audience,
        )
        user = self.repository.get_user_by_id(payload.subject)
        if user is None or user.disabled_at is not None:
            raise AuthError("User is unavailable")
        return self.repository.actor_from_user(user)

    def _issue_token(self, user: User) -> str:
        return create_signed_token(
            subject=user.id,
            email=user.email,
            role=user.role,
            secret_key=self.settings.app_secret_key,
            issuer=self.settings.jwt_issuer,
            audience=self.settings.jwt_audience,
            ttl_minutes=self.settings.token_ttl_minutes,
        )


class MessageService:
    def __init__(self, repository: SQLiteRepository) -> None:
        self.repository = repository

    def create_message(
        self,
        *,
        actor: Actor,
        title: str,
        body: str,
        recipient_email: str,
        expires_at: datetime | None,
    ) -> SecureMessage:
        message = self.repository.create_message(
            owner_id=actor.id,
            title=title,
            body=body,
            recipient_email=recipient_email,
            status=MessageStatus.draft,
            expires_at=expires_at,
        )
        self.repository.record_audit_event(
            actor_id=actor.id,
            action="message.create",
            resource_type="message",
            resource_id=message.id,
            metadata={"title": message.title, "recipient_email": message.recipient_email},
        )
        return message

    def list_messages(self, *, actor: Actor) -> list[SecureMessage]:
        return self.repository.list_messages(owner_id=actor.id)

    def get_message(self, *, actor: Actor, message_id: str) -> SecureMessage:
        message = self.repository.get_message(message_id)
        if message is None:
            raise NotFoundError("Message not found")
        self._ensure_can_access(actor, message)
        return message

    def update_message(
        self,
        *,
        actor: Actor,
        message_id: str,
        title: str,
        body: str,
        recipient_email: str,
        status: MessageStatus,
        expires_at: datetime | None,
    ) -> SecureMessage:
        message = self.repository.get_message(message_id)
        if message is None:
            raise NotFoundError("Message not found")
        self._ensure_can_access(actor, message)

        updated_message = self.repository.update_message(
            message_id=message_id,
            title=title,
            body=body,
            recipient_email=recipient_email,
            status=status,
            expires_at=expires_at,
        )
        if updated_message is None:
            raise NotFoundError("Message not found")
        self.repository.record_audit_event(
            actor_id=actor.id,
            action="message.update",
            resource_type="message",
            resource_id=updated_message.id,
            metadata={"status": updated_message.status.value},
        )
        return updated_message

    def delete_message(self, *, actor: Actor, message_id: str) -> None:
        message = self.repository.get_message(message_id)
        if message is None:
            raise NotFoundError("Message not found")
        self._ensure_can_access(actor, message)
        if not self.repository.delete_message(message_id):
            raise NotFoundError("Message not found")
        self.repository.record_audit_event(
            actor_id=actor.id,
            action="message.delete",
            resource_type="message",
            resource_id=message_id,
            metadata={"title": message.title},
        )

    def _ensure_can_access(self, actor: Actor, message: SecureMessage) -> None:
        if actor.role == "admin" or message.owner_id == actor.id:
            return
        raise ForbiddenError("You cannot access this message")


class AuditService:
    def __init__(self, repository: SQLiteRepository) -> None:
        self.repository = repository

    def list_events(self, *, actor: Actor) -> list[AuditEvent]:
        if actor.role == "admin":
            return self.repository.list_audit_events()
        return self.repository.list_audit_events(actor_id=actor.id)
