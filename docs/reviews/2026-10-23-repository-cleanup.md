# 2026-10-23 仓库清理记录

本次在独立工作树合入 `origin/main` 后清理，未触碰原工作区的未提交内容。删除的文件均为 Git 跟踪文件，可从清理前提交 `800b982` 恢复：`git restore --source=800b982 -- <路径>`。

| 删除文件 | 删除前 SHA-256 | 依据 |
| --- | --- | --- |
| `device-router-test.html` | `483F97CDC2EDE32AE9FDD79D650DC26F8BB4DFD4960635F6D0697BE8D61AC38F` | 旧手工测试页；当前 Node 网关没有该路由；仅有共享 API 客户端为它保留跳过登录的例外，已同时移除。 |
| `test/api-verification.html` | `368B4AEB62E99B8FDFF95B64A8FE2DAB10BEAF59C2A87AC3E76127EF8A322395` | 旧手工验收页；当前 Node 网关不提供 `/test/` 路由，`server/tests/public-file-boundary.test.js` 要求该路径返回 404。 |

同步移除了登录页面无效的预设账户、演示密码、预览用字段及旧站备案号，并将根 README 更新为 Node/SQLite 的首次安装流程。

`api/`、`includes/`、旧版配置示例、`generated-quotes.txt` 仍与 PHP 历史版本或迁移排查有关。设计稿、历史评审记录和 `maintain.html` 属于保留资料。上述内容没有按扩展名批量删除。
