#!/usr/bin/env bash
###############################################################################
# scripts/deploy.sh
#
# Pull the latest code, build the Docker image, run database migrations and
# restart the app + worker. Designed to run as the deploy user on the VPS.
#
# Usage (on VPS):
#   cd /srv/linkforge && ./scripts/deploy.sh
#
# Usage (from laptop via SSH):
#   ssh -p 2222 nurbek@164.92.240.90 'cd /srv/linkforge && ./scripts/deploy.sh'
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)

if [[ ! -f .env.production ]]; then
  echo ".env.production missing; create it from .env.example first." >&2
  exit 1
fi

echo "==> Pulling latest"
git fetch --all --prune
if [[ -n "${DEPLOY_REF:-}" ]]; then
  git checkout --force "${DEPLOY_REF}"
  git reset --hard "${DEPLOY_REF}"
else
  git checkout main 2>/dev/null || git checkout -B main
  git pull --ff-only origin main || git pull --ff-only
fi

echo "==> Building image"
"${COMPOSE[@]}" build app

echo "==> Starting dependencies (postgres/redis) if needed"
"${COMPOSE[@]}" up -d postgres redis

echo "==> Waiting for postgres"
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-linkforge}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Running database migrations"
"${COMPOSE[@]}" run --rm --no-deps app \
  node_modules/.bin/prisma migrate deploy

echo "==> Rolling restart app + worker"
"${COMPOSE[@]}" up -d --no-deps --build app worker
"${COMPOSE[@]}" up -d nginx certbot

echo "==> Reloading nginx (if running)"
"${COMPOSE[@]}" exec -T nginx nginx -t 2>/dev/null && \
  "${COMPOSE[@]}" exec -T nginx nginx -s reload || true

echo "==> Pruning old images"
docker image prune -f >/dev/null || true

echo "==> Deploy done. Health check:"
sleep 3
curl -fsS "${APP_URL:-https://linkforge.kebruni.me}/api/health" || \
  curl -fsS http://127.0.0.1/api/health || \
  echo "(health endpoint not reachable yet — check: docker compose -f docker-compose.prod.yml logs app)"
