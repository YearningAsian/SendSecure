# SendSec

SendSec is a backend-first service for securely managing user accounts, secure messages, and audit events.

## Stack

- FastAPI for the HTTP API
- SQLite for local persistence
- Pydantic settings for configuration
- Standard-library cryptography primitives for password hashing and signed access tokens

## Environment

Copy [.env.example](.env.example) to `.env` and set values for your local environment.

## Commands

- `python -m pytest`
- `python -m ruff check src tests`
- `python -m ruff format src tests`
- `python -m uvicorn sendsec.api:create_app --factory --reload`
