#!/usr/bin/env bash
# docker-entrypoint.sh — container startup script
#
# 1. Injects $PORT into the nginx config template.
# 2. Validates the resulting nginx config.
# 3. Hands control to supervisord which keeps nginx + uvicorn running.
set -euo pipefail

PORT="${PORT:-8080}"

echo "[entrypoint] Configuring nginx on port ${PORT}..."
envsubst '$PORT' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[entrypoint] Validating nginx config..."
nginx -t

echo "[entrypoint] Starting supervisord (nginx + uvicorn)..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
