# 部署与运维说明 (Node.js + Fastify + SQLite)

本目录包含 Node.js 后端部署与 Nginx 网关反向代理配置文件。

## 1. 环境准备

- Node.js 24 LTS (或 Node.js >= 20)
- Nginx >= 1.20
- SQLite 3 (已内置于 better-sqlite3)

## 2. 安装与导入

### 全新站点：首次上线配置

先按第 3 节安装 `couple.service`，并设置 `COUPLE_DB_PATH` 为持久化 SQLite 文件位置，确保服务用户能写入其目录。启动时服务会自动建立空数据库和表结构。创建一个仅供此次安装使用的随机密钥，放入服务端环境文件：

```bash
sudo install -d -m 700 /etc/couple-website
sudo sh -c 'umask 077; printf "SETUP_TOKEN=%s\n" "$(openssl rand -hex 32)" > /etc/couple-website/setup.env'
sudo systemctl daemon-reload
sudo systemctl restart couple.service
```

在服务器上读取安装密钥，然后通过 HTTPS 打开 `https://你的域名/setup`。填写密钥、开始日期、双方称呼与各自的登录密码和私密空间密码，再选择管理员。完成后使用管理员账号登录；首次成功登录会绑定当前浏览器，其他浏览器要由管理员在设备页批准。**不要把安装密钥放入网页 URL、仓库或公开日志。**

```bash
sudo cat /etc/couple-website/setup.env
```

配置完成后移除该环境文件并重启服务。即使密钥仍存在，已有数据的数据库也会拒绝再次初始化；移除密钥可让入口完全关闭。

```bash
sudo rm /etc/couple-website/setup.env
sudo systemctl restart couple.service
```

本页面只初始化当前 `COUPLE_DB_PATH` 指向的 SQLite 数据库，不接收数据库连接字符串或文件路径。已有用户、站点配置或其他业务数据的数据库不会显示安装页，也不会被覆盖。生产服务器应只通过 HTTPS 暴露网站；`COUPLE_DB_PATH` 必须指向持久化目录，不能随发布目录替换而丢失。

### 旧站迁移

以下导入命令只适用于从旧版 JSON 数据迁移的站点。已有业务数据时不要使用首次上线配置页，也不要对当前数据库重新执行导入。

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
