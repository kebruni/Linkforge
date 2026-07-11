# Linkforge — Production deployment guide

Target host:

| Field           | Value                       |
| --------------- | --------------------------- |
| Domain          | `linkforge.kebruni.me`       |
| VPS IP          | `164.92.240.90`             |
| SSH port        | `2222`                      |
| Deploy user     | `nurbek` (sudo, key-based)  |
| OS              | Ubuntu 24.04 LTS            |
| Container stack | Docker + Docker Compose v2  |

> ⚠️ **Never** commit secrets. Real credentials are configured via:
>
> - GitHub Actions secrets (`DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`,
>   `DEPLOY_SSH_KEY`, `LETSENCRYPT_EMAIL`, all `*_SECRET` and `*_KEY` envs).
> - `/srv/linkforge/.env.production` on the VPS, owned by `nurbek`,
>   `chmod 600`. This file is **not** in git.
> - Deploy scripts use `docker compose … --env-file .env.production`.

---

## 1. DNS

Set the following records on the registrar of `kebruni.me` (e.g. Cloudflare):

| Type | Name      | Value           | Proxy   | TTL   |
| ---- | --------- | --------------- | ------- | ----- |
| A    | `linkforge`| `164.92.240.90` | DNS only | Auto |

Wildcard for future custom-domain feature (out of MVP):

| Type | Name      | Value           |
| ---- | --------- | --------------- |
| A    | `*.linkforge` | `164.92.240.90` |

After saving, verify with `dig +short linkforge.kebruni.me`.

---

## 2. First-time VPS bootstrap (run as `root` over the existing SSH access)

```bash
# 1) Connect (replace key path / port as configured)
ssh -p 2222 root@164.92.240.90

# 2) Update + install base tools
apt-get update && apt-get -y upgrade
apt-get install -y curl git ufw fail2ban unattended-upgrades \
    ca-certificates gnupg lsb-release software-properties-common \
    jq htop tmux

# 3) Create deploy user (skip if `nurbek` already exists)
adduser --disabled-password --gecos "" nurbek
usermod -aG sudo nurbek
mkdir -p /home/nurbek/.ssh && chmod 700 /home/nurbek/.ssh

# 4) Authorise your public key for nurbek
#    From your laptop:
#      cat ~/.ssh/id_ed25519.pub | ssh -p 2222 root@164.92.240.90 \
#        'cat >> /home/nurbek/.ssh/authorized_keys'
chown -R nurbek:nurbek /home/nurbek/.ssh
chmod 600 /home/nurbek/.ssh/authorized_keys

# 5) Harden SSH
sed -i \
    -e 's/^#\?Port .*/Port 2222/' \
    -e 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' \
    -e 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' \
    -e 's/^#\?KbdInteractiveAuthentication .*/KbdInteractiveAuthentication no/' \
    -e 's/^#\?ChallengeResponseAuthentication .*/ChallengeResponseAuthentication no/' \
    /etc/ssh/sshd_config
systemctl restart ssh

# 6) Firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable

# 7) fail2ban — protect SSH
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled  = true
port     = 2222
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl restart fail2ban

# 8) Automatic security updates
dpkg-reconfigure --priority=low unattended-upgrades

# 9) Install Docker Engine + Compose plugin
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker nurbek
systemctl enable --now docker

# 10) Disk locations (canonical path: /srv/linkforge)
install -d -o nurbek -g nurbek /srv/linkforge
install -d -o nurbek -g nurbek /srv/linkforge/backups
install -d -o nurbek -g nurbek /srv/linkforge/letsencrypt/conf
install -d -o nurbek -g nurbek /srv/linkforge/letsencrypt/www
```

The `scripts/setup-vps.sh` in this repo packages steps 2–10 idempotently so
they can be re-run safely.

---

## 3. First deploy

From now on we work as `nurbek`:

```bash
ssh -p 2222 nurbek@164.92.240.90

# 1) Clone the repo into the app root (or pull if already cloned)
git clone https://github.com/kebruni/Linkforge.git /srv/linkforge
cd /srv/linkforge

# 2) Create the production env file
cp .env.example .env.production
chmod 600 .env.production
# Required: POSTGRES_PASSWORD, DATABASE_URL (host = postgres),
# REDIS_URL (host = redis), AUTH_SECRET, APP_URL
# Security (prod): TRUST_PROXY=true (behind Nginx), FEATURE_BILLING_DEMO=false
# Optional billing: FEATURE_BILLING=true + Stripe keys + price IDs
# Optional email: SMTP_* (password reset / verification)
# See the production block at the bottom of .env.example
$EDITOR .env.production

# 3) First TLS cert (HTTP-only nginx → certbot → full HTTPS config)
EMAIL=admin@kebruni.me bash scripts/ssl-init.sh

# 4) Build, migrate, start app + worker + nginx
bash scripts/deploy.sh

# 5) Optional seed (dev-ish themes / reserved slugs — skip on real prod if you prefer)
docker compose -f docker-compose.prod.yml --env-file .env.production \
    exec app node_modules/.bin/prisma db seed
```

`docker-compose.prod.yml` brings up:

- `app` – Next.js (port 3000, Docker network only)
- `worker` – BullMQ + analytics stream workers
- `postgres` – Postgres 16 (named volume `postgres-data`)
- `redis` – Redis 7 (named volume `redis-data`, AOF)
- `nginx` – reverse proxy, TLS termination, `:80` + `:443`
- `certbot` – Let's Encrypt renew loop (webroot)

---

## 4. SSL — first issuance and auto-renewal

```bash
# Bootstrap the cert. Initially nginx serves a temporary HTTP-only config
# that just exposes /.well-known/acme-challenge.
bash scripts/ssl-init.sh linkforge.kebruni.me admin@kebruni.me

# After success, nginx reloads with the full HTTPS config (HTTP/2,
# strict TLS, HSTS) and certbot installs a renew timer.
docker compose -f docker-compose.prod.yml --env-file .env.production \
    exec nginx nginx -t && \
docker compose -f docker-compose.prod.yml --env-file .env.production \
    exec nginx nginx -s reload
```

Renewal is automatic (twice-daily certbot run inside the `certbot` container).
The `nginx` container picks up new certs via `inotifywait` reload.

Verify TLS:

```bash
curl -I https://linkforge.kebruni.me           # 200 + HSTS header
curl -I http://linkforge.kebruni.me            # 301 → https://...
openssl s_client -connect linkforge.kebruni.me:443 -servername linkforge.kebruni.me \
    < /dev/null | openssl x509 -noout -dates
```

---

## 5. CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every PR and push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`

`.github/workflows/deploy.yml` runs on push to `main` (or `workflow_dispatch`):

1. SSH into the VPS (GitHub secrets `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` / `VPS_PORT`).
2. Run `scripts/deploy.sh` at `/srv/linkforge` (git fetch → build → migrate → restart).
3. Smoke-test `https://linkforge.kebruni.me/api/health`.

Required GitHub Actions secrets:

| Name            | Value                                              |
| --------------- | -------------------------------------------------- |
| `VPS_HOST`      | `164.92.240.90`                                    |
| `VPS_PORT`      | `2222`                                             |
| `VPS_USER`      | `nurbek`                                           |
| `VPS_SSH_KEY`   | private key matching `nurbek`'s `authorized_keys`  |

Application secrets live only in `/srv/linkforge/.env.production` on the VPS
(not in GitHub), unless you later wire them into the workflow yourself.

---

## 6. Backups

`scripts/backup-db.sh` is run nightly from cron on the host:

```cron
# crontab -e   (as nurbek)
0 3 * * *  /srv/linkforge/scripts/backup-db.sh
```

It performs:

1. `docker compose exec -T postgres pg_dump …` piped to a gzipped file under
   `/srv/linkforge/backups/`.
2. Removes backups older than 14 days.
3. Optionally uploads to S3 if `AWS_S3_BUCKET` is set.

Restore:

```bash
bash scripts/restore-db.sh /srv/linkforge/backups/linkforge-YYYYMMDDTHHMMSSZ.sql.gz
```

---

## 7. Day-2 operations

### Logs

```bash
cd /srv/linkforge
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f worker
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f nginx
journalctl -u docker -f
fail2ban-client status sshd
```

### Health checks

- `https://linkforge.kebruni.me/api/health` — JSON `{ ok, db, redis }`.
- Add an external uptime probe to alert when this returns non-200.

### Shell into containers

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app sh
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres psql -U linkforge
docker compose -f docker-compose.prod.yml --env-file .env.production exec redis redis-cli
```

### Migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec app node_modules/.bin/prisma migrate deploy
```

Never run `prisma migrate dev` against production — only `migrate deploy`.

### Manual rollback

```bash
cd /srv/linkforge
git fetch --all
git reset --hard <previous-good-sha>
docker compose -f docker-compose.prod.yml --env-file .env.production \
    up -d --no-deps --build app worker
```

If you need to rollback Postgres schema, restore from backup (see §6).

### Reload Nginx without downtime

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -t \
 && docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload
```

---

## 8. Hardening checklist

- [x] SSH on non-default port (2222), key-only, root login restricted.
- [x] UFW blocks everything except 2222/80/443 outbound-allow.
- [x] fail2ban watches sshd and (optionally) nginx auth zones.
- [x] Unattended-upgrades enabled.
- [x] Docker daemon runs without exposing the API socket; containers run
      as a non-root user; capabilities dropped where possible.
- [x] Postgres bound only to the docker network.
- [x] Redis bound only to the docker network, password-protected
      (`REDIS_PASSWORD` in env, propagated to `REDIS_URL`).
- [x] `.env.production` `chmod 600`, owned by `nurbek` only.
- [x] Backups encrypted at rest if shipped off-host (`age`/`gpg`).
- [x] HSTS preloaded after a few weeks of green deploys.

---

## 9. Scaling beyond a single VPS

When the single-host setup becomes insufficient:

1. Move Postgres to a managed service (Neon, RDS, Cloud SQL). Update
   `DATABASE_URL` only — Prisma is unchanged.
2. Move Redis to Upstash / Redis Cloud / ElastiCache. Update `REDIS_URL`.
3. Add a second VPS, deploy `web` + `worker` to both, point Nginx (or move
   to a CDN like Cloudflare / Bunny) at both as upstreams. The same image
   runs on every node — no code change.
4. Once you have ≥3 nodes, switch to k3s/k8s using the existing Dockerfile;
   a starter Helm chart is on the roadmap (v1.3).
5. Put a CDN in front of `/u/:slug` and `_next/static`. The Nginx `Cache-
   Control` headers are already correct.

---

## 10. Quick reference — common commands

```bash
# Open SSH
ssh -p 2222 nurbek@164.92.240.90

# Update to latest main and redeploy
cd /srv/linkforge && bash scripts/deploy.sh

# Tail app logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app

# Get into a Postgres shell
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres psql -U linkforge

# Backup now
bash /srv/linkforge/scripts/backup-db.sh

# Restart Nginx after editing config
docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -t && \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload
```
