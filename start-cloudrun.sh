#!/usr/bin/env bash
set -e

# Cloud Run injects $PORT (usually 8080). Substitute it into the nginx config
# template so nginx listens on the correct port.
echo "[start] Configuring nginx on port ${PORT:-8080}..."
envsubst '$PORT' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Verify nginx config is valid before handing off to supervisord.
nginx -t

echo "[start] Starting supervisord (nginx + uvicorn)..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
