# Frontend Setup

## Overview

This workspace now includes a frontend build for SendSecure. The UI is driven by runtime configuration and does not rely on mocked data.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Runtime Variables

Set these values in your local environment before running the app:

- `VITE_APP_NAME`
- `VITE_APP_TAGLINE`
- `VITE_API_BASE_URL`
- `VITE_SUPPORT_EMAIL`
- `VITE_DOCS_URL`

## Behavior

- When `VITE_API_BASE_URL` is set, the dashboard loads live metrics and activity from the backend.
- When the API is unavailable, the UI falls back to empty states and guidance instead of fake data.
- Transfer submissions are posted to the configured backend endpoint only.

## Next Frontend Steps

- Add browser automation for the transfer workflow.
- Split the dashboard panels into smaller components once the API contract stabilizes.
- Add client-side validation rules that mirror the backend contract.