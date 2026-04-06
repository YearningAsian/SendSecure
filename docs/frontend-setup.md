# Frontend Setup

## Overview

The frontend is a live React client for the FastAPI backend. It uses runtime configuration and only renders data returned by the API.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `bash scripts/dev.sh`

## Runtime Variables

Set these values in your local environment before running the app:

- `VITE_APP_NAME`
- `VITE_APP_TAGLINE`
- `VITE_API_BASE_URL`
- `VITE_SUPPORT_EMAIL`
- `VITE_DOCS_URL`

## Behavior

- When `VITE_API_BASE_URL` is set, the client loads the backend health status, authenticates users, and fetches live messages and audit events.
- When the API is unavailable, the UI shows empty states and connection guidance instead of mock data.
- Message create, edit, and delete actions are sent to the configured backend endpoint only.

## Next Frontend Steps

- Split the authenticated workspace into smaller route-based panels.
- Add browser automation around the auth and message lifecycle.
- Add client-side validation that mirrors the backend constraints.