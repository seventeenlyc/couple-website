# 本地与生产环境一致性及同步可行性评估

检查日期：2026-10-15，Asia/Shanghai；末次证据采集约 19:55。工作区：`G:\CODE\couple-website-main`。

## 结论

**当前不一致；可以准备按功能拆分的源码同步包，但不满足直接发布条件，禁止整个工作区覆盖生产。**

已检查的线上源码与本地已提交 HEAD 内容一致，实际功能差异来自本地未提交的前端、兼容接口、拾光助手及调试工具。服务器具备现有 Node/Fastify/SQLite 运行基础；当前证据不能证明新增依赖及全部新版功能在 Linux 生产条件下通过验收。

本次只检查并新增本报告。没有同步、部署、提交、合并、重启、安装依赖，也没有修改线上配置、业务数据、防火墙或云资源；未调用模型或向量计费 API。健康请求可能产生服务器常规访问日志。SQLite 使用只读连接，未调用生产应用初始化、导入或迁移函数。

## 1. 工作区与版本证据

未在仓库及 `G:\`、`G:\CODE\` 祖先位置发现适用的 `AGENTS.md`。参考 `code-reviewer` 的代码及配置检查方法，按证据区分本地、生产 HTTP 和未验证部分。

| 项目 | 实测结果 |
| --- | --- |
| 当前分支 | `codex/production-login-compat` |
| HEAD | `e875459734ff5fe79246a152928989c27a904258` |
| HEAD 说明 | `fix: preserve legacy passwordless login during Node migration` |
| 上游 | `origin/main`，本地 ahead 1 |
| 本地上游引用及只读远端查询 | 均为 `0054bc5d62dc42e416736d3188a475e3b8dbe54a` |
| 已跟踪修改 | 14 个文件，1944 行新增、889 行删除 |
| 未跟踪 | 新增本报告前 143 个文件，含源码、文档、截图、DB/WAL/SHM、测试产物 |
| 暂存区 | 0 个文件 |
| 既有 worktree | 主目录，以及 `medical-retrieval-debug`、`shiguang-rag` 两个 detached HEAD 工作区；未改动 |

业务分类如下；这些都是检查时既有内容，不能归因于本次评估。

| 类别 | 已跟踪修改及未跟踪内容 | 同步性质 |
| --- | --- | --- |
| 登录及设备分流 | 修改 `index.html`、`home.html`、`assets/js/api-client.js`；新增 `assets/js/device-router.js` | 登录后转向新版页面，必须与目标页面和服务路由配套 |
| H5、桌面新版 | `h5/`、`desktop/`，各自 HTML、CSS、API client、app、device-switch | 线上不存在；属于整组新功能，不是单页修补 |
| 展示资源 | Markdown JS/CSS、marked、DOMPurify、motion 资源 | Markdown 资源是新版页面直接依赖；motion 资源按实际引用决定是否纳入 |
| 后端启动及资源路由 | `server/src/app.js`、`config.js`、`compat/gateway-routes.js` | 新增 CORS、静态服务、前端入口、H5/desktop 路由 |
| 业务接口 | `compat/content-routes.js`、`economy-routes.js`、`modules/whispers/whisper.service.js` | 相册计数和参数兼容、上传字段优先级及批内去重、私密笔记读路由、任务 list 别名、留言数据兼容 |
| 拾光助手 | `modules/ai/ai.service.js`，新增 `/api/agent/chat`、`/api/agent-chat.php` | 真实回忆筛选、留言及约会草稿、模型调用；新增约 690 行，需独立验收 |
| 依赖 | `server/package.json`、`package-lock.json` | 新增生产依赖 `@fastify/static` 和开发依赖 `jsdom`，须配对处理 |
| 测试 | 修改 `server/tests/content-gateway.test.js`、`review-fifth.test.js`；新增多组前端、助手、医疗测试和 `test/` 验收页 | 属验证材料，默认不放入公网运行包 |
| 医疗检索 | `server/src/modules/medical/`、`server/public/medical-debug/`、两个 scripts、医疗 fixtures 和 tests | 独立的本机调试工具，未接入主应用医疗回答 |
| 非运行内容 | `design/`、`docs/`、`h5_multipage_backup/`、`package/lib/mcp/model.js`、`verify-parity.mjs`、设备路由测试页等 | 按文档、备份、来源待确认文件、测试脚本分别保留，默认排除运行包 |
| 用户及测试数据 | 根 `data/couple.db*`、`server/data/` 数据库与评测 JSON、两层 `tests/test-*-db/`、上传缩略图 | 禁止当作源码同步 |

### 内容对比，而非仅比较提交号

通过线上 Python 只读生成选定 JS/MJS/HTML/CSS/SQL/JSON 文件的 SHA-256；排除了数据目录、uploads、node_modules、Git 和敏感配置内容。对 CRLF/LF 做归一化后比较，避免 Windows 换行产生假差异。

- 线上扫描得到 57 项，其中 1 项为线上独有 `DEPLOYED_REVISION`。
- 其余 56 个选定文件：42 个与本地当前内容相同，14 个与本地未提交修改相对应；56 个均与本地 HEAD 对应内容相同。
- 本地已提交的 `server/tests/production-passwordless.test.js` 在线上文件清单中不存在。版本标记与主要源码吻合，不代表测试文件齐备。
- 这是一组明确范围的源码内容对比，不是整个磁盘或用户数据的一致性证明。

关键 LF 归一化 SHA-256：

| 文件 | 线上及本地 HEAD | 本地工作区 |
| --- | --- | --- |
| `server/package.json` | `ac01c24a1d3787d7132d301b5984d63f4b85528cba390d2f85a3c0bd1ad365a4` | `d59a1612f3ba9fab5629828b9b9b14127b7a80bbe4f42254db3fb89b55d78063` |
| `server/package-lock.json` | `af45a317f1d58ab9aa52ee368ce524546873013138d83961a4a78720920be2d8` | `b2c0f4f47702f2e310785c934a2002b8b22792b97182dac3dba1ea13f1628cb8` |
| `server/src/storage/schema.sql` | `3b26efa19221f1c0ec4c0cd39b4d950911cacaa228a71e3aa8370b2a21bb427e` | 相同 |

## 2. 真实线上运行状态

以下由本次 SSH 读取 systemd、`/proc/<pid>`、Nginx 展开配置及实际文件确认，不以部署文档或 release 文件夹名称推定版本。

| 项目 | 实测结果 |
| --- | --- |
| 站点 | `https://lyczwc520.site` |
| OS / 架构 | Linux，内核 `6.6.92-34.1.oc9.x86_64`，x86_64，glibc 2.38 |
| Nginx 站点根 | `/opt/couple-website/releases/0054bc5-node22` |
| Nginx 上游 | `http://127.0.0.1:19085` |
| 服务 | `couple.service`，active/running，`NRestarts=0`；末次复核仍 active |
| 运行用户/组 | `www:www` |
| 工作目录 | `/opt/couple-website/releases/0054bc5-node22/server` |
| 进程可执行文件 | `/opt/nodejs/node-v22.23.3-linux-x64/bin/node` |
| 启动文件 | `src/start.js` |
| 实际版本标记 | `DEPLOYED_REVISION=e875459734ff5fe79246a152928989c27a904258`；不是文件夹名称中的旧 SHA |
| 配置文件位置 | `/etc/couple-website/backend.env`，未输出内容 |
| 生产 DB | `/var/lib/couple-website/couple.db`，约 3.56 MB 主文件；进程 fd 确实打开该 DB、WAL、SHM |
| uploads | release 内 `uploads` 是符号链接，实际指向 `/www/wwwroot/lyczwc520.site/uploads` |
| 下载内部映射 | `/_device_files/` 为 internal，alias 当前 release 根；需要与 uploads 链接和后端配置共同保持一致 |

必要非敏感环境值：`NODE_ENV=production`、`HOST=127.0.0.1`、`PORT=19085`、`COUPLE_DB_PATH=/var/lib/couple-website/couple.db`、`TRUST_PROXY=true`、`USE_X_ACCEL_REDIRECT=true`。

应用环境名称还包括 `SESSION_SECRET`，其值未输出。其余进程环境主要为 systemd/用户/PATH 等运行变量；本地检查进程没有上述应用变量，根 `.env` 与 `server/.env` 均不存在。代码没有自动读取 dotenv；本地默认 DB 来自 `server/src/config.js:13`，不能把启动目录内任意 DB 当作实际使用的 DB。

`ALLOWED_ORIGINS` 是本地新增配置，生产进程当前没有该变量。主站同源部署与跨端口本地开发应分别验证，不能直接复制本地开发 Origin 列表上线。现有生产 SESSION_SECRET 和 HTTPS Cookie 行为应保留。

## 3. Node、依赖与原生模块

| 项目 | 本地 Windows | 生产 Linux |
| --- | --- | --- |
| Node | v24.14.0 | v22.23.3，进程实际版本与 shell 一致 |
| npm | 11.9.0 | 10.9.9 |
| 模块 ABI | 137 | 127 |
| fastify | 5.12.5 | 5.12.5 |
| better-sqlite3 | 11.10.0 | 11.10.0 |
| sharp | 0.33.5 | 0.33.5 |
| `@fastify/static` | 10.1.5，已安装，新增生产依赖 | 未安装、当前 package 未声明 |
| jsdom | 29.1.1，开发依赖 | 未安装 |
| 锁文件 | lockfileVersion=3，182 个 packages 条目 | lockfileVersion=3，126 个 packages 条目 |

两侧 `npm ls --omit=dev --depth=0` 成功。其余既有直接依赖版本也相同：cookie 11.1.2、formbody 8.0.2、multipart 9.4.0、session 11.1.3、bcryptjs 3.0.3。

两侧均成功加载自己环境中的 better-sqlite3，并在 `:memory:` 上执行 SQL，SQLite 版本均为 3.49.2。线上模块是 Linux x86_64 ELF 文件。**包版本相同不等于二进制可复用，Windows 的 node_modules 不能复制到 Linux。** sharp 同样有平台相关依赖；本次未执行图片处理验收。

已安装 jsdom 的 engines 为 `^20.19.0 || ^22.13.0 || >=24.0.0`，sharp 为 `^18.17.0 || ^20.3.0 || >=21.0.0`，两侧 Node 满足这些已检查约束。尚未在独立 Linux Node 22 环境对候选锁文件执行干净安装和完整检查，不能据此宣布全部依赖可发布。没有在生产运行 npm install/ci，也没有替换本地 node_modules。

当前代码属于直接运行 JS、直接提供 HTML/CSS/JS 的应用，package 未提供 build 脚本；不应套用另一个项目的 Vite 构建部署流程。建议候选包先以生产 Node 22/npm 10 组合验证，是否升级生产 Node 属另一个变更。

## 4. 数据库结构与持久化边界

- 本次以只读连接查询 `sqlite_master`，并把源码 schema 在内存数据库中展开后比较。源码包含 20 张业务表、11 个显式索引，均与生产对应对象定义一致，忽略格式空白后无差异。
- 生产额外保留 `legacy_source_documents`、`migration_metadata`、`migration_notes` 三张迁移审计表，不能因为本地没有就删除。
- 本地 `server/data/couple.db` 和根 `data/couple.db` 的 20 张业务表及 11 个显式索引也与生产对应对象相符；结构相符不代表账号、余额、照片、配置或业务记录相同。本次未读取或比较这些个人内容。
- 生产 `PRAGMA user_version=0`、`schema_version=34`；两个本地主业务 DB 为 `user_version=0`、`schema_version=31`。schema_version 是 SQLite 内部结构变化计数，不能把 34/31 当成有序应用迁移号；本次据实际对象定义比较，而非据数字迁移。
- 生产和两个本地主业务 DB 均 `quick_check=ok`，foreign_key_check 返回 0 条异常。这是检查时的轻量完整性证据，不替代可恢复备份或全量业务一致性验收。
- `server/src/storage/db.js` 未修改，启动仍会执行 schema、缺列兼容和历史元数据转义逻辑，包含可能写入数据的步骤。本次未在线上执行初始化，也未执行 import/reconcile。

`server/data/couple.db` 约 274 KB，根 `data/couple.db` 约 254 KB；生产主文件约 3.56 MB，并且有活跃 WAL。**不能拿任意本地 DB 覆盖生产，不能只拷贝活跃主 DB 文件充当一致备份，也不能上传/删除 WAL/SHM 来“同步”。**

生产持久化边界有两处：DB 在 `/var/lib/couple-website/`；用户上传在 `/www/wwwroot/lyczwc520.site/uploads`。release 自身的 `data/` 也存在，默认排除，不能假定其中历史 JSON 是当前权威或可以清空。现有 uploads 链接、所有者和读写权限必须在未来新 release 中保持。

### 医疗语料另算

本地独立 `server/data/medical-knowledge.db` 约 27.8 MB，当前复核到 766 条 medical_documents、3257 条 medical_chunks，以及 FTS 和导入记录对象。它与生产主业务 DB 不是同一数据库。

`server/scripts/medical-debug.js` 默认仅监听 `127.0.0.1:19086`；debug-app 有本机 Host/Origin 限制，读取只读语料，可选读取指定配置库。当前主应用没有导入该模块，生产也没有该模块目录。检索代码使用 FTS5、双语概念扩展及可选查询改写，未发现向量检索接入；本次未请求模型、生成向量或重跑语料评测。

这些工具可以作为单独研发交付物保存；不能把它们算作已上线的医疗回答，也不能直接公开调试端口或把用户 Downloads 的原始资料包混入网站发布。

## 5. 当前验证证据

### 本地

1. `cd server; npm run check`：33 个 JS 文件语法检查通过，只检查 src/scripts。
2. 下列选定测试执行成功：47 tests、47 pass、0 fail、0 skipped。事先检查其使用内存库、临时测试库或模拟模型/DOM，未启动真实模型调用。临时库位于系统临时目录，未运行会写入仓库既有 test-*-db 目录的套件。

```powershell
cd G:\CODE\couple-website-main\server
node --test tests/medical-search.test.js tests/medical-rewrite.test.js tests/medical-debug-http.test.js tests/medical-debug-dom.test.js tests/shiguang-markdown.test.js tests/agent-memory-constraints.test.js tests/agent-real-memory.test.js tests/login-static.test.js tests/frontend-inline-handler-safety.test.js tests/frontend-real-dom.test.js
```

覆盖医疗调试 11 项、Markdown 安全显示及复制、回忆地点/日期约束、留言/约会草稿、登录资源入口、DOM 注入与真实页面脚本的模拟 DOM 交互。这里的 HTTP 检查部分使用 Fastify inject，DOM 使用 jsdom，不是浏览器或生产登录验证。

3. 对 index/home/desktop login/desktop index/H5 index 的 script/link 检查：24 个本地引用均存在，路径组件大小写未发现差异；不包含 JS 动态请求、CSS 内部引用、所有 CDN 资源或真实浏览器加载。
4. 使用 `buildApp({dbPath: ':memory:'})` 做候选主应用注入检查：ready、登录入口、H5/desktop 页面、设备路由 JS、Markdown vendor 均返回 200；匿名 home 返回 302，data/server/docs 返回 404。未连接用户的本地业务 DB。
5. 同一检查发现 `/deploy/nginx.conf` 返回 200，`/test/api-verification.html` 返回 200，见风险项。
6. `git diff --check` 退出码 1：现有 home/index/content-routes/ai.service 共 9 处行尾空白。没有擅自格式化；这不是功能运行故障，但不能写成所有检查全绿。

### 生产只读 HTTP

从服务器同时请求回环后端和 HTTPS 正式域名，结果一致；均不带用户 Cookie，不接收/输出会话凭据，未返回 Set-Cookie。

| 路径 | 回环后端 | 正式 HTTPS |
| --- | --- | --- |
| `/health/live` | 200，status=ok | 200，status=ok |
| `/health/ready` | 200，status=ready，db=connected | 同左 |
| `/api/balance.php`，匿名 | 401 | 401 |
| `/data/couple.db` | 404 | 404 |
| `/server/src/app.js` | 404 | 404 |
| `/h5/index.html` | 404 | 404 |
| `/desktop/index.html` | 404 | 404 |
| `/assets/js/device-router.js` | 404 | 404 |

这是从服务器到其自身后端/域名的真实 HTTP 证据；没有覆盖用户终端到网站的网络路径。没有执行登录、打卡、上传、购买、留言、助手调用或任何产生业务记录的探测。

### 未验证

没有全量 npm test、候选代码的 Linux 干净安装、生产条件下新版端到端、真实浏览器或 Android/iOS 设备验收、图片处理、模型供应商真实调用、跨域携带 Cookie、语义向量检索性能、医疗正确率或生产备份恢复演练。历史 20/25 检索记录不等于本次复跑结果，更不等于临床准确率。

## 6. 阻塞项与风险

| 严重度 | 项目及证据 | 发布前处理 |
| --- | --- | --- |
| High | 运行依赖未配套：`app.js:4` import `@fastify/static`，生产没有该包；package/lock 均与线上不同 | 只同步 src 会启动失败。在独立 Linux release/验收环境按候选锁文件安装平台依赖，再验收；不能在当前生产目录边运行边安装 |
| High | 登录路由成组依赖：`index.html:205,274`、`home.html:53,77` 引用 DeviceRouter；目标 H5/desktop/路由在线上均缺失、HTTP 404 | 登录入口、新页面、共用资源、API 和路由作为完整候选包验证，最后统一切换；禁止先单独覆盖 index/home |
| High | 发布清单未冻结：14 个修改、143 个未跟踪内容，根 DB 和 uploads 缩略图未被 ignore | 先按功能明确源码白名单和内容哈希，排除全部数据及临时内容；不能 `git add .` 或上传整个目录 |
| High | 候选代码的 Linux Node 22 安装/完整业务验收缺失，47 项本地测试只是限定范围 | 补齐真实目标环境验收；保留未验证边界，不能把通过本地测试作为正式发布放行依据 |
| Medium | 根静态服务暴露边界扩大：`server/src/app.js:90-96` 使用项目根；本地 `/deploy/nginx.conf`=200，公网 Nginx 当前对 deploy/tests/tools 等目录另有 404 拦截 | 检查两层规则与打包白名单；不把测试页、内部配置、脚本放进公网可达资源。此项目前没有证明现有公网泄露配置，但不能依赖当前反代掩盖后端规则差异 |
| Medium | 新增 CORS 与开发 API base 规则：`config.js:27`、`assets/js/api-client.js`；本地非 19085 显式端口会指向客户端 127.0.0.1 | 正式 HTTPS 同源优先；如需跨域/非标准端口，再验证来源、Cookie 和端口策略，不直接搬本地设置 |
| Medium | 模型配置只确认存在和字段形状：两侧 enabled=true 且有 api_key，字段集合不同；未核对具体值或调用 | 不拷贝本地配置库/JSON，保留生产设置；上线助手前单独进行经授权的供应商与超时/失败行为验证 |
| Low | 9 处 diff 行尾空白 | 后续代码整理时处理，本轮不修改 |

这是环境和发布准备度评估，不是全量安全审计或代码质量打分。

## 7. 可以同步什么，必须排除什么

“可以同步”在这里指适合整理进未来候选包，不是已获本次执行部署授权或已通过上线验收。

### 可作为候选源码包

- 前端适配组：`index.html`、`home.html`、`assets/js/api-client.js`、`assets/js/device-router.js`，以及 `desktop/`、`h5/` 的运行文件。
- Markdown 显示组：`assets/css/shiguang-markdown.css`、`assets/js/shiguang-markdown.js`、`assets/vendor/marked/marked.umd.js`、`assets/vendor/dompurify/purify.min.js`，并保留其 LICENSE；须随引用这些资源的页面/app.js 一起交付。
- 后端兼容及助手组：本次列明的 `server/src/app.js`、`config.js`、三份 compat 修改、`modules/ai/ai.service.js`、`modules/whispers/whisper.service.js`，以及配套 `server/package.json`、`package-lock.json`。可再拆为兼容修补与助手功能，但需要具体 hunk 清单，不能仅按整个文件假定独立。
- 医疗检索的代码、fixtures、文档和 tests 可以另作研发包；本次建议不混入网站生产发布，尤其不启用调试服务。
- 文档、设计及测试可同步到版本管理或独立验收包；默认不发布到网站可服务的根目录。无需把全部未跟踪内容变成同一个提交。

### 从网站运行包硬性排除

```text
.git/、.agents/、所有现有 worktrees
任何 node_modules/、本地 Node 运行时、平台原生 .node 二进制
.env、私钥/证书私钥、Token/Cookie、云凭据、SSH 配置及其他个人配置
data/（含 config.json、任何 DB/WAL/SHM、日志缓存、历史 JSON）
server/data/（含 couple.db*、medical-knowledge.db、医疗评测 JSON）
uploads/ 的实际用户内容及本地 thumbnails/（保留生产目录和链接，不覆盖/清理）
tests/test-*-db/、server/tests/test-*-db/ 及任何测试 DB/上传产物
h5_multipage_backup/、*.bak、*.backup、*.tmp、日志、截图和复现记录
用户 Downloads 内原始医疗语料及任何本地绝对路径依赖
package/lib/mcp/model.js（来源及用途未验证）
```

运行包默认还排除 `design/`、`docs/`、`test/`、`tests/`、`server/tests/`、验收 HTML、`device-router-test.html`、`verify-parity.mjs`。schema.sql 和必要服务源码不是数据文件，按源码白名单保留。既有模板/legacy 文件若主应用仍读取，须保留实际依赖，不能按扩展名批量删除。

`git check-ignore` 复核：`server/data/couple.db` 和 medical DB 被现有规则忽略，但根 `data/couple.db*` 和新增 uploads/thumbnails 文件未被保护。ignore 不是部署白名单；本次没有修改 ignore。

## 8. 建议的最小同步顺序、验证与回滚

以下全部为后续执行建议，本次没有实施。

1. **冻结范围。** 保持主工作区及历史 worktree 原样，在单独候选目录/分支整理明确功能白名单、依赖清单及哈希；区分可运行源码、测试包、文档。记录生产真实版本 e875459、systemd/Nginx 的相关路径及非敏感配置，不把旧 release 名当目标版本。
2. **先验证目标环境。** 使用独立 Linux x86_64、Node 22.23.3/npm 10.9.9 环境安装候选锁文件；生产依赖按生产模式验收，开发测试需要 jsdom 时在验收环境安装。检查 better-sqlite3、sharp、Fastify 插件启动和大小写路径。使用内存库/专用测试 DB 及虚构测试数据，绝不使用本地个人库或连生产写接口做测试。
3. **准备新 release，不覆盖旧 release。** 以后若获部署授权，再在新目录放置已验收源码与 Linux 依赖；DB 仍由生产 COUPLE_DB_PATH 指向原持久化路径；uploads 链接仍指向既有生产上传目录。保留生产密钥、运行用户、权限和 X-Accel 行为。不运行 legacy import/reconcile，不做本地 DB 回灌。
4. **建立可恢复点后统一切换。** DB 采用能正确处理 WAL 的一致备份方法，上传文件配套保存可恢复状态；记录恢复流程。Nginx 当前 root 和 internal alias、systemd 工作目录都指向具体 release，必须协调切换，避免前端走新目录、API/下载仍走旧目录。适配页只在配套后端及资源可用时切换，禁止逐文件覆盖运行站点。
5. **验证门槛。** 先 ready/live、服务 active 和重启计数、生产 DB 实际 fd、上传链接及权限；再测试站点登录和已有设备/免密码兼容，桌面/H5 的路由、相册、私密内容隔离、上传与下载、任务/商店/留言、拾光的权限和失败状态。涉及业务写入/费用的验收需另有明确授权和可清理测试账号，不沿用本轮匿名只读探测。检查 data/server/docs/deploy/tests 等敏感路径的两层拒绝规则和前端资源完整性，最后补真实设备验证。
6. **回滚条件。** ready 非 200、服务重启循环或依赖加载失败、登录/设备授权异常、页面或资源 404、权限泄露、上传路径变更、下载失败、SQLite 完整性错误，均停止放量并按预案回切。未发生不兼容数据变更时，优先将 systemd/Nginx 相关路径成组切回旧 Node release，继续使用当前生产 DB 和 uploads；不能用旧 DB 快照直接丢弃发布后的合法写入。若需要数据恢复，应先暂停相关写入、保全新增记录，再走经确认的一致恢复流程。不能把回滚到旧 PHP/JSON 当作无成本回退。

**最终判定：源码基线一致，工作区功能及运行环境不一致；具备分组同步的基础，当前不放行直接同步上线。** 本次交付止于检查与报告，所列未验证事项、依赖配套及发布白名单是后续部署前置条件。
