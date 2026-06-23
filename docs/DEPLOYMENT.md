# 部署操作手册

## 前台 Cloudflare Pages

```powershell
cd D:\dev\FB\client
Set-Content .env.production "VITE_API_BASE_URL=/api`nVITE_APP_SURFACE=public`n"
npm run build
npx wrangler@latest pages deploy dist --project-name lanyu-one --commit-dirty=true
```

部署后检查：

```powershell
curl.exe -I https://lanyu.one/
curl.exe -I https://lanyu.one/api/health
curl.exe -I https://lanyu.one/admin
```

`/admin` 应返回 404。

## 后台静态资源

```powershell
cd D:\dev\FB\client
$env:VITE_APP_SURFACE='admin'
$env:VITE_API_BASE_URL='/api'
npm run build
Remove-Item Env:VITE_APP_SURFACE
Remove-Item Env:VITE_API_BASE_URL
```

将 `dist` 同步到服务器：

```text
/var/www/lanyuchuhai/admin
```

## 后端服务

服务器路径：

```text
/var/www/lanyuchuhai/server
```

部署后执行：

```bash
npm ci --omit=dev
npx prisma generate
npx prisma db push
node prisma/seed.js
pm2 restart bluereach --update-env
pm2 save
nginx -t
systemctl reload nginx
```

## 敏感文件

不得提交：

- `.env`
- `*.db`
- Cloudflare API 脚本中含 Token 的文件
- SSH 密码脚本
- 临时 tar 包
