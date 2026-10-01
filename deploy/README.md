# 部署与运维说明 (Node.js + Fastify + SQLite)

本目录包含 Node.js 后端部署与 Nginx 网关反向代理配置文件。

## 1. 环境准备

- Node.js 24 LTS (或 Node.js >= 20)
- Nginx >= 1.20
- SQLite 3 (已内置于 better-sqlite3)

## 2. 安装与导入

在站点根目录：

```bash
cd server
npm install --omit=dev

# 运行数据导入 Dry-Run 校验
npm run import -- --dry-run

# 执行正式导入
npm run import

# 对账校验
npm run reconcile
```

## 3. 配置服务 (systemd)

将 `deploy/couple.service` 复制至 `/etc/systemd/system/couple.service`：

```bash
sudo cp deploy/couple.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable couple.service
sudo systemctl start couple.service
sudo systemctl status couple.service
```

## 4. Nginx 配置与切换

1. 将 `deploy/nginx.conf` 中的域名与路径替换为生产环境实际配置。
2. 运行 `nginx -t` 测试语法。
3. 重载 Nginx：`sudo systemctl reload nginx`。
4. 访问 `/health/ready` 验证 Node 进程已联通 SQLite 数据库。
