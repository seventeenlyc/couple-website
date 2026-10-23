# Couple Website

供两人使用的私人网站，包含相册、每日任务、心愿、私密空间和故事时间线。服务端使用 Node.js、Fastify 和 SQLite。

## 首次使用

需要 Node.js 20 或更新版本。克隆仓库后，先生成并妥善保存一次性安装密钥，再在 `server/` 安装依赖并启动服务：

```bash
cd server
npm ci
export SETUP_TOKEN="$(openssl rand -hex 32)"
printf '本次安装密钥：%s\n' "$SETUP_TOKEN"
npm start
```

上面的命令仅示意本机启动；正式环境按[部署与运维说明](deploy/README.md)将密钥设置为服务端环境变量，并使用持久化的 `COUPLE_DB_PATH`、HTTPS 和服务管理器。不要把密钥提交到仓库。

打开 `http://127.0.0.1:19085/setup`（正式环境使用 `https://你的域名/setup`），填写安装密钥、开始日期、双方称呼、登录密码、私密空间密码，并选择管理员。密码均需至少 12 个字符。完成后访问 `/` 登录；首次登录会绑定当前浏览器，之后的新设备由管理员审批。

安装页只对空数据库开放。完成初始化后移除 `SETUP_TOKEN` 并重启服务。已有站点数据不可通过安装页覆盖。旧版 PHP/JSON 迁移工具已退役，请勿把旧 JSON 数据直接导入当前数据库。

## 项目目录

| 路径 | 用途 |
| --- | --- |
| `server/src/` | Fastify API、认证和 SQLite 存储 |
| `server/tests/` | 服务端及前端行为测试 |
| `h5/`、`desktop/`、`assets/` | 移动端、桌面端和共享资源 |
| `setup.html` | 首次安装页面，仅通过 `/setup` 提供 |
| `maintain.html` | 手动维护页源文件；不会自动作为线上路由开放 |
| `device-access.html` | 设备授权页面，由 Node 服务通过 `/device-access.php` 提供 |
| `deploy/` | Nginx、systemd 及运维说明 |

SQLite 数据库、上传内容、密码和服务端密钥必须存放在仓库之外或被 `.gitignore` 排除。数据库位置由 `COUPLE_DB_PATH` 指定；默认本机路径为 `server/data/couple.db`。不要使用公开可读的目录存放数据库。前端仍使用部分 `.php` 结尾的 API 地址；这些地址由 Node 服务处理，仓库中不再包含 PHP 实现。

## 验证

在 `server/` 运行：

```bash
npm run check
npm test
```

服务启动后，`/health/ready` 可用于检查进程与数据库连接。更多部署说明见 [deploy/README.md](deploy/README.md)。
