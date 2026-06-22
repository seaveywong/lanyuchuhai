#!/bin/bash
# 蓝域出海 BlueReach — VPS 一键部署脚本
# 用法: chmod +x deploy.sh && sudo ./deploy.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  蓝域出海 BlueReach 部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请用 sudo 运行${NC}"
  exit 1
fi

# 获取域名
read -p "前端域名 (如 shop.example.com): " FRONTEND_DOMAIN
read -p "API域名 (如 api.example.com): " API_DOMAIN

# 更新系统
echo ">>> 更新系统..."
apt update && apt upgrade -y

# 安装依赖
echo ">>> 安装基础环境..."
apt install -y nginx certbot python3-certbot-nginx nodejs npm

# 安装 PM2
npm i -g pm2

# 创建目录
APP_DIR=/var/www/bluereach
mkdir -p $APP_DIR

# 假定代码在当前目录的 server-src/ 和 client-dist/
echo ">>> 部署代码..."
cp -r server-src/* $APP_DIR/server/ 2>/dev/null || echo "请将 server-src/ 放到当前目录"
cp -r client-dist $APP_DIR/ 2>/dev/null || echo "请将 client-dist/ 放到当前目录"

cd $APP_DIR/server

# 安装后端依赖
npm install

# 生成密钥
echo ">>> 生成安全密钥..."
JWT_ACCESS=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CARD_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 写入 .env
cat > .env << ENVEOF
NODE_ENV=production
PORT=3000
DATABASE_URL="file:./prod.db"
CORS_ORIGINS=https://${FRONTEND_DOMAIN}
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
CARD_ENCRYPTION_KEY=${CARD_KEY}
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123
ENVEOF

echo -e "${RED}>>> 请编辑 .env 填写 USDT 配置:${NC}"
echo "    nano $APP_DIR/server/.env"
echo "    TRONGRID_API_KEY=..."
echo "    MERCHANT_WALLET_ADDRESS=TRx..."

# 初始化数据库
npx prisma generate
npx prisma db push
node prisma/seed.js

# 启动后端
pm2 start src/app.js --name bluereach -i 2
pm2 save
pm2 startup

# Nginx 配置
cat > /etc/nginx/sites-available/bluereach << NGINXEOF
server {
    listen 80;
    server_name ${API_DOMAIN};

    # 前端静态文件
    root ${APP_DIR}/client-dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/bluereach /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL
certbot --nginx -d ${API_DOMAIN} --non-interactive --agree-tos -m admin@${API_DOMAIN} || true

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "前端: https://${API_DOMAIN}"
echo "API:  https://${API_DOMAIN}/api/health"
echo "后台: https://${API_DOMAIN}/admin/login"
echo ""
echo -e "${RED}重要：请立即执行以下操作：${NC}"
echo "1. 编辑 .env: nano $APP_DIR/server/.env"
echo "   - 填写 USDT 配置"
echo "   - 修改 ADMIN_DEFAULT_PASSWORD"
echo "2. 备份 CARD_ENCRYPTION_KEY: ${CARD_KEY}"
echo "3. 到 Cloudflare 添加 DNS 记录，开启橙色云朵"
echo "4. 在 Cloudflare WAF 中添加速率限制规则"
