# BlueReach / 蓝域出海项目规范

## 项目定位

本项目是蓝域出海商城系统，负责账号资源、库存卡密、订单、支付配置、客服配置和后台运营。

## 线上域名

- 前台商城：`https://lanyu.one`
- 后台管理：`https://lanyu888888.com`
- 后端 API：后台同域 `/api/*`
- 前台 API：`https://lanyu.one/api/*` 通过 Cloudflare Pages Function 转发，浏览器不直接暴露后端域名。

## 架构边界

- `client`：React + Vite 前端。
- `client/functions`：Cloudflare Pages Functions，仅做前台 API 安全转发。
- `server`：Node/Express 后端，负责业务 API、订单、库存、支付和后台鉴权。
- `server/prisma`：SQLite/Prisma 数据模型与初始化数据。

API 中转站不放在本项目里开发。API 中转站独立为 `D:\dev\Token`，未来使用独立域名 `api.lanyu.one`。

## 部署边界

- 前台部署到 Cloudflare Pages 项目 `lanyu-one`。
- 后台静态资源部署到 VPS `/var/www/lanyuchuhai/admin`。
- 后端服务部署到 VPS `/var/www/lanyuchuhai/server`，PM2 进程名 `bluereach`。
- Nginx 负责 `lanyu888888.com` 的静态后台和 `/api` 反代。

## 安全要求

- 不提交 `.env`、数据库、SSH 密码、Cloudflare Token、支付密钥、管理员密码明文到 Git。
- 卡密库存默认不回显明文。
- 若后续需要明文核对，必须采用二次验证、审计日志、限时显示和最小权限。
- 前台构建产物不得包含 `lanyu888888.com` 字符串。
- 后台入口不得出现在 `lanyu.one` 路由下。

## 版本与备份规范

每次变更必须遵守：

1. 先创建本地归档备份。
2. 再修改代码或配置。
3. 本地构建通过后部署。
4. Git 提交必须写清楚变更范围。
5. 推送到 GitHub，保证每个线上版本都有提交记录。
6. 禁止把临时部署脚本、密钥脚本、环境文件、数据库文件提交到 GitHub。

推荐备份路径：

```text
D:\dev\FB_backups\FB-before-<change>-YYYYMMDD-HHmmss.tar.gz
```

## Git 提交建议

提交信息格式：

```text
feat(scope): summary
fix(scope): summary
docs(scope): summary
chore(deploy): summary
```

示例：

```text
feat(admin): add inventory batch delete and category management
```

## 当前风险

- `tronweb` 传递依赖仍触发 npm audit high 级别漏洞；自动 `npm audit fix --force` 不能完全解决。
- 建议后续将 USDT 链上查询从 `tronweb` 迁移为 TronGrid HTTP API + 原生 `fetch`，减少高危依赖链。
