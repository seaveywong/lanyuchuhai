#!/bin/bash
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/lanyuchuhai}
APP_HOST=${APP_HOST:-lanyu888888.com}
PORT=${PORT:-3000}
SOURCE_DIR=${SOURCE_DIR:-$(pwd)}
FRONTEND_ORIGIN=${FRONTEND_ORIGIN:-https://lanyu.one}
BASE_URL=${BASE_URL:-https://${APP_HOST}}
ADMIN_DEFAULT_USERNAME=${ADMIN_DEFAULT_USERNAME:-admin}
ADMIN_DEFAULT_PASSWORD=${ADMIN_DEFAULT_PASSWORD:-$(openssl rand -base64 18 | tr -d '=+/ ' | cut -c1-18)}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:-$(openssl rand -hex 32)}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}
CARD_ENCRYPTION_KEY=${CARD_ENCRYPTION_KEY:-$(openssl rand -hex 32)}

if [ "$EUID" -ne 0 ]; then echo "Run as root or sudo."; exit 1; fi
if [ ! -d "$SOURCE_DIR/server" ]; then echo "SOURCE_DIR must contain server/."; exit 1; fi

apt-get update
apt-get install -y ca-certificates curl gnupg nginx rsync openssl certbot python3-certbot-nginx
NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
if ! command -v node >/dev/null 2>&1 || [ "$NODE_MAJOR" -lt 18 ]; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; fi
npm i -g pm2

mkdir -p "$APP_DIR/server"
rsync -a --delete "$SOURCE_DIR/server/" "$APP_DIR/server/" --exclude node_modules --exclude .env --exclude prisma/dev.db --exclude prod.db

if [ -f "$APP_DIR/server/.env" ]; then
  OLD_ADMIN_PASSWORD=$(grep -E '^ADMIN_DEFAULT_PASSWORD=' "$APP_DIR/server/.env" | tail -1 | cut -d= -f2- || true)
  OLD_JWT_ACCESS=$(grep -E '^JWT_ACCESS_SECRET=' "$APP_DIR/server/.env" | tail -1 | cut -d= -f2- || true)
  OLD_JWT_REFRESH=$(grep -E '^JWT_REFRESH_SECRET=' "$APP_DIR/server/.env" | tail -1 | cut -d= -f2- || true)
  OLD_CARD_KEY=$(grep -E '^CARD_ENCRYPTION_KEY=' "$APP_DIR/server/.env" | tail -1 | cut -d= -f2- || true)
  [ -n "${OLD_ADMIN_PASSWORD:-}" ] && ADMIN_DEFAULT_PASSWORD="$OLD_ADMIN_PASSWORD"
  [ -n "${OLD_JWT_ACCESS:-}" ] && JWT_ACCESS_SECRET="$OLD_JWT_ACCESS"
  [ -n "${OLD_JWT_REFRESH:-}" ] && JWT_REFRESH_SECRET="$OLD_JWT_REFRESH"
  [ -n "${OLD_CARD_KEY:-}" ] && CARD_ENCRYPTION_KEY="$OLD_CARD_KEY"
fi

cat > "$APP_DIR/server/.env" <<ENVEOF
APP_NAME="BlueReach"
NODE_ENV=production
PORT=${PORT}
BASE_URL=${BASE_URL}
CORS_ORIGINS=${FRONTEND_ORIGIN}
TRUST_PROXY=1
BODY_LIMIT=1mb
CALLBACK_BODY_LIMIT=256kb
ORDER_PIN_SALT_ROUNDS=10
DATABASE_URL="file:./prod.db"
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
JWT_ISSUER=keygo-api
JWT_AUDIENCE=keygo-admin
CARD_ENCRYPTION_KEY=${CARD_ENCRYPTION_KEY}
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
MERCHANT_WALLET_ADDRESS=${MERCHANT_WALLET_ADDRESS:-}
USDT_EXCHANGE_RATE=${USDT_EXCHANGE_RATE:-7}
USDT_MIN_CONFIRMATIONS=19
USDT_LOOKBACK_MINUTES=180
ADMIN_DEFAULT_USERNAME=${ADMIN_DEFAULT_USERNAME}
ADMIN_DEFAULT_PASSWORD=${ADMIN_DEFAULT_PASSWORD}
ENVEOF
chmod 600 "$APP_DIR/server/.env"

cd "$APP_DIR/server"
npm ci
npx prisma generate
npx prisma db push
node prisma/seed.js
pm2 delete bluereach >/dev/null 2>&1 || true
pm2 start src/app.js --name bluereach --time --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null || true

cat > /etc/nginx/sites-available/bluereach <<NGINXEOF
server {
    listen 80;
    server_name ${APP_HOST};
    client_max_body_size 2m;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    location = / { return 200 'BlueReach API'; add_header Content-Type text/plain; }
    location = /health { proxy_pass http://127.0.0.1:${PORT}/api/health; }
    location /api/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location ~ /\.(?!well-known) { deny all; }
    location ~* (\.env|package\.json|package-lock\.json)$ { deny all; }
    location ~* /(prisma|node_modules|src)/ { deny all; }
}
NGINXEOF
ln -sf /etc/nginx/sites-available/bluereach /etc/nginx/sites-enabled/bluereach
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
certbot --nginx -d "$APP_HOST" --non-interactive --agree-tos -m "admin@$APP_HOST" --redirect || true
nginx -t && systemctl reload nginx

echo "BACKEND_DEPLOY_OK"
echo "API=https://${APP_HOST}/api/health"
echo "CORS=${FRONTEND_ORIGIN}"
echo "ADMIN_USER=${ADMIN_DEFAULT_USERNAME}"
echo "ADMIN_PASSWORD=${ADMIN_DEFAULT_PASSWORD}"
