#!/usr/bin/env bash
###############################################################################
# scripts/ssl-init.sh
#
# Issue the very first Let's Encrypt certificate. Subsequent renewals are
# handled by the certbot container in docker-compose.prod.yml.
#
# Usage:
#   EMAIL=admin@kebruni.me ./scripts/ssl-init.sh
#   DOMAIN=linkforge.kebruni.me EMAIL=admin@kebruni.me ./scripts/ssl-init.sh
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-linkforge.kebruni.me}"
EMAIL="${EMAIL:?EMAIL env var is required}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)

if [[ ! -f .env.production ]]; then
  echo ".env.production missing; create it from .env.example first." >&2
  exit 1
fi

mkdir -p ./letsencrypt/conf ./letsencrypt/www

echo "==> Bringing up nginx with HTTP-only config (no certs yet)"

HTTP_ONLY=./nginx/conf.d/_init.conf
cat > "${HTTP_ONLY}" <<NGINX
server {
    listen 80 default_server;
    server_name ${DOMAIN};
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'linkforge ssl init';
        add_header Content-Type text/plain;
    }
}
NGINX

PROD_CONF="./nginx/conf.d/${DOMAIN}.conf"
PROD_CONF_DISABLED="${PROD_CONF}.disabled"
if [[ -f "${PROD_CONF}" ]]; then
  mv "${PROD_CONF}" "${PROD_CONF_DISABLED}"
fi

# Nginx only for ACME — app stack comes up later via deploy.sh. --no-deps so
# we don't try to build/start `app` (and its postgres/redis) before certs exist.
"${COMPOSE[@]}" up -d --no-deps nginx

echo "==> Requesting certificate for ${DOMAIN}"
"${COMPOSE[@]}" run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email "${EMAIL}" --agree-tos --no-eff-email \
  -d "${DOMAIN}"

echo "==> Restoring production nginx config"
rm -f "${HTTP_ONLY}"
if [[ -f "${PROD_CONF_DISABLED}" ]]; then
  mv "${PROD_CONF_DISABLED}" "${PROD_CONF}"
fi

# Do NOT reload nginx with the prod config here: the prod site conf references
# the `app` upstream which is not running yet (deploy.sh starts it). Stop nginx
# so it doesn't keep serving the HTTP-only _init config; deploy.sh will start
# it fresh with the app stack and the real TLS config.
"${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
echo "==> SSL ready for https://${DOMAIN}"
echo "    Now run: bash scripts/deploy.sh  (starts app + worker + nginx with TLS)"
