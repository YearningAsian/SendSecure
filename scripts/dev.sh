#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

: "${APP_SECRET_KEY:?Set APP_SECRET_KEY in .env before starting SendSecure.}"

backend_host="${BACKEND_HOST:-127.0.0.1}"
backend_port="${BACKEND_PORT:-8000}"
frontend_host="${FRONTEND_HOST:-127.0.0.1}"
frontend_port="${FRONTEND_PORT:-5173}"

export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://${backend_host}:${backend_port}/v1}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://${frontend_host}:${frontend_port},http://localhost:${frontend_port}}"

cleanup() {
  jobs -pr | xargs -r kill
}

trap cleanup EXIT INT TERM

echo "Starting backend on http://${backend_host}:${backend_port}"
echo "Starting frontend on http://${frontend_host}:${frontend_port}"

auth_backend_cmd=(python -m uvicorn sendsec.api:create_app --factory --reload --host "$backend_host" --port "$backend_port")
frontend_cmd=(npm run dev -- --host "$frontend_host" --port "$frontend_port")

"${auth_backend_cmd[@]}" &
backend_pid=$!
"${frontend_cmd[@]}" &
frontend_pid=$!

wait "$backend_pid" "$frontend_pid"
