from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator

from .config import Settings
from .domain import Actor, MessageStatus
from .logging import configure_logging
from .repository import SQLiteRepository
from .services import (
    AuditService,
    AuthError,
    AuthService,
    ConflictError,
    ForbiddenError,
    MessageService,
    NotFoundError,
)

bearer_scheme = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=20_000)
    recipient_email: EmailStr
    expires_at: datetime | None = None

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("expires_at must include a timezone offset")
        return value


class MessageUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=20_000)
    recipient_email: EmailStr
    status: MessageStatus
    expires_at: datetime | None = None

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("expires_at must include a timezone offset")
        return value


class MessageResponse(BaseModel):
    id: str
    owner_id: str
    title: str
    body: str
    recipient_email: EmailStr
    status: MessageStatus
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AuditEventResponse(BaseModel):
    id: str
    actor_id: str | None
    action: str
    resource_type: str
    resource_id: str | None
    metadata: dict[str, str]
    created_at: datetime


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repository(request: Request) -> SQLiteRepository:
    return request.app.state.repository


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


def get_message_service(request: Request) -> MessageService:
    return request.app.state.message_service


def get_audit_service(request: Request) -> AuditService:
    return request.app.state.audit_service


def get_current_actor(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> Actor:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        return auth_service.authenticate_token(credentials.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def build_router() -> APIRouter:
    router = APIRouter()

    @router.get("/healthz")
    def healthz(repository: Annotated[SQLiteRepository, Depends(get_repository)]) -> dict[str, str]:
        if repository.health_check():
            return {"status": "ok"}
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unhealthy")

    @router.get("/readyz")
    def readyz(repository: Annotated[SQLiteRepository, Depends(get_repository)]) -> dict[str, str]:
        if repository.health_check():
            return {"status": "ready"}
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Not ready")

    @router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
    def register(
        payload: RegisterRequest,
        auth_service: Annotated[AuthService, Depends(get_auth_service)],
    ) -> AuthResponse:
        try:
            user, token = auth_service.register(email=payload.email, password=payload.password)
        except ConflictError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

        return AuthResponse(
            access_token=token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                role=user.role,
                created_at=user.created_at,
            ),
        )

    @router.post("/auth/login", response_model=AuthResponse)
    def login(
        payload: LoginRequest,
        auth_service: Annotated[AuthService, Depends(get_auth_service)],
    ) -> AuthResponse:
        try:
            user, token = auth_service.login(email=payload.email, password=payload.password)
        except AuthError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

        return AuthResponse(
            access_token=token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                role=user.role,
                created_at=user.created_at,
            ),
        )

    @router.get("/auth/me", response_model=UserResponse)
    def me(actor: Annotated[Actor, Depends(get_current_actor)]) -> UserResponse:
        return UserResponse(
            id=actor.id,
            email=actor.email,
            role=actor.role,
            created_at=actor.created_at,
        )

    @router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
    def create_message(
        payload: MessageCreateRequest,
        actor: Annotated[Actor, Depends(get_current_actor)],
        message_service: Annotated[MessageService, Depends(get_message_service)],
    ) -> MessageResponse:
        try:
            message = message_service.create_message(
                actor=actor,
                title=payload.title,
                body=payload.body,
                recipient_email=payload.recipient_email,
                expires_at=payload.expires_at,
            )
        except ForbiddenError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
        return _message_response(message)

    @router.get("/messages", response_model=list[MessageResponse])
    def list_messages(
        actor: Annotated[Actor, Depends(get_current_actor)],
        message_service: Annotated[MessageService, Depends(get_message_service)],
    ) -> list[MessageResponse]:
        messages = message_service.list_messages(actor=actor)
        return [_message_response(message) for message in messages]

    @router.get("/messages/{message_id}", response_model=MessageResponse)
    def get_message(
        message_id: str,
        actor: Annotated[Actor, Depends(get_current_actor)],
        message_service: Annotated[MessageService, Depends(get_message_service)],
    ) -> MessageResponse:
        try:
            message = message_service.get_message(actor=actor, message_id=message_id)
        except NotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ForbiddenError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
        return _message_response(message)

    @router.patch("/messages/{message_id}", response_model=MessageResponse)
    def update_message(
        message_id: str,
        payload: MessageUpdateRequest,
        actor: Annotated[Actor, Depends(get_current_actor)],
        message_service: Annotated[MessageService, Depends(get_message_service)],
    ) -> MessageResponse:
        try:
            message = message_service.update_message(
                actor=actor,
                message_id=message_id,
                title=payload.title,
                body=payload.body,
                recipient_email=payload.recipient_email,
                status=payload.status,
                expires_at=payload.expires_at,
            )
        except NotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ForbiddenError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
        return _message_response(message)

    @router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_message(
        message_id: str,
        actor: Annotated[Actor, Depends(get_current_actor)],
        message_service: Annotated[MessageService, Depends(get_message_service)],
    ) -> None:
        try:
            message_service.delete_message(actor=actor, message_id=message_id)
        except NotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ForbiddenError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    @router.get("/audit-events", response_model=list[AuditEventResponse])
    def list_audit_events(
        actor: Annotated[Actor, Depends(get_current_actor)],
        audit_service: Annotated[AuditService, Depends(get_audit_service)],
    ) -> list[AuditEventResponse]:
        events = audit_service.list_events(actor=actor)
        return [
            AuditEventResponse(
                id=event.id,
                actor_id=event.actor_id,
                action=event.action,
                resource_type=event.resource_type,
                resource_id=event.resource_id,
                metadata=event.metadata,
                created_at=event.created_at,
            )
            for event in events
        ]

    return router


def create_app(*, settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)
    repository = SQLiteRepository(settings.resolved_database_path())
    repository.initialize()

    app = FastAPI(title=settings.app_name, version="0.1.0")
    app.state.settings = settings
    app.state.repository = repository
    app.state.auth_service = AuthService(repository, settings)
    app.state.message_service = MessageService(repository)
    app.state.audit_service = AuditService(repository)
    app.include_router(build_router(), prefix="/v1")
    return app


def _message_response(message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        owner_id=message.owner_id,
        title=message.title,
        body=message.body,
        recipient_email=message.recipient_email,
        status=message.status,
        expires_at=message.expires_at,
        created_at=message.created_at,
        updated_at=message.updated_at,
    )
