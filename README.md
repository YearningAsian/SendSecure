# SendSecure

SendSecure is a secure messaging workspace with a FastAPI backend, a React frontend, and a SQLite data store.

## Stack

- FastAPI for authentication, secure messages, and audit events
- SQLite for local persistence
- React and Vite for the browser UI
- Pydantic settings for runtime configuration
- Standard-library cryptography primitives for password hashing and signed access tokens

## Environment

Copy [.env.example](.env.example) to `.env` and set values for your local environment.

Required backend values:

- `APP_SECRET_KEY`

Runtime values shared by the browser and API:

- `CORS_ORIGINS`
- `VITE_API_BASE_URL`
- `VITE_APP_NAME`
- `VITE_APP_TAGLINE`
- `VITE_SUPPORT_EMAIL`
- `VITE_DOCS_URL`

## Commands

- `python -m pytest`
- `python -m ruff check src tests`
- `python -m ruff format src tests`
- `python -m uvicorn sendsecure.api:create_app --factory --reload`
- `npm run build`
- `bash scripts/dev.sh`

## Browser Flow

- Register or log in with the authentication panel.
- Create, edit, archive, and delete secure messages.
- Review the audit trail for authentication and message activity.
