# 2026-10-23 旧版 PHP 清理记录

用户明确确认不再回滚 PHP 版本，授权删除旧 PHP API、`includes/` 和相关运维文件。本次在独立工作树、已合并的 `origin/main` 提交 `b84b82f03e5ef09a825d435354947abb305d84c3` 上实施，原工作区未改动。

删除前的 Git 提交是可核验、可恢复的源文件快照。任一文件可用 `git show b84b82f:<路径>` 查看；若需要恢复，可用 `git restore --source=b84b82f -- <路径>`。这次仅清理仓库跟踪文件，没有连接服务器、删除线上数据或执行旧版数据导入。

删除范围共 **79 个跟踪文件**：旧 `api/` 24 个、`includes/` 21 个、旧 PHP/设备脚本与专用测试、Apache `.htaccess`、旧 JSON 配置示例与种子文本、已退役的 JSON→SQLite 导入和对账脚本及其测试、误导当前部署的旧版操作/实施方案。完整路径如下：

```text
.htaccess
api/anniversary-reminders.php
api/app-config.php
api/balance.php
api/checkin.php
api/csrf-token.php
api/daily-quote.php
api/devices.php
api/folders.php
api/login.php
api/logout.php
api/orders.php
api/photos.php
api/ping.php
api/private-auth.php
api/private-files.php
api/private-notes.php
api/reviews.php
api/shop.php
api/story.php
api/tasks.php
api/upload-avatar.php
api/upload-photo.php
api/virtual-items.php
api/whispers.php
data/.htaccess
data/ai_config.json.example
data/cache/.gitkeep
data/config.json.example
data/logs/.gitkeep
data/products.txt
data/tasks.txt
device-gateway.php
device-login.php
docs/device-authorization-design.md
docs/device-authorization-operations.md
docs/project-improvement-design.md
docs/project-improvement-requirements.md
docs/superpowers/plans/2026-07-14-album-upload-folder-selection.md
docs/superpowers/plans/2026-10-01-backend-js-migration.md
generated-quotes.txt
includes/.htaccess
includes/ai-config.php
includes/ai-helper.php
includes/anniversary-helper.php
includes/auth.php
includes/avatar-helper.php
includes/checkin-helper.php
includes/config.php
includes/currency-helper.php
includes/device-auth.php
includes/folder-helper.php
includes/json-helper.php
includes/order-helper.php
includes/photo-tag-helper.php
includes/review-helper.php
includes/session.php
includes/shop-helper.php
includes/task-helper.php
includes/thumbnail-helper.php
includes/virtual-item-helper.php
includes/whisper-helper.php
server/scripts/import-legacy.js
server/scripts/reconcile.js
server/tests/legacy-migration.test.js
server/tests/legacy-tasks-migration.test.js
tests/device-auth-test.php
tests/device-concurrency-test.php
tests/device-http-router.php
tests/device-http-test.py
tests/device-nginx-test.py
tests/folder-helper-test.php
tests/photo-tag-helper-test.php
tools/deploy-device-auth.py
tools/device-admin.php
tools/device-nginx.conf
tools/install-device-auth.py
uploads/.htaccess
uploads/private/.htaccess
```

`device-access.php` 原文件虽有 PHP 扩展名，但包含当前设备授权页面。已迁移为纯 HTML `device-access.html`，Node 仍通过 `/device-access.php` URL 提供该页面。前端使用的其他 `.php` 结尾 URL 也由 Node 路由处理；这些 URL 不代表仓库保留 PHP 实现。历史评审记录保留为当时的审计证据，不作为现行操作说明。
