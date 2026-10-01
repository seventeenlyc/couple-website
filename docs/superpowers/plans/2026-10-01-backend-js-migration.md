# JavaScript 后端迁移分析与重构规划

日期：2026-10-01。状态：方案草案；本轮只分析和规划，未实施后端迁移。

**Goal:** 将当前 PHP 后端迁移到 Node.js，在保留现有页面、双人业务、历史数据和设备授权规则的基础上，提高可维护性与数据一致性。

**Architecture:** 推荐同源部署的模块化单体：Nginx + Node.js/Fastify + SQLite + 受控文件存储。现有 HTML 和旧 API 协议作为兼容层保留；迁移在隔离环境逐模块完成，生产环境短暂停写后整体切换。

**Tech Stack:** JavaScript ESM、JSDoc、Node.js 24 LTS、Fastify 5、SQLite、better-sqlite3、Sharp、服务端持久化 Session、node:test、Playwright。

**Spec:** 本文的目标架构、兼容约束和验收标准共同构成提议的设计基线。它不是已批准、已验证可部署的实施结果。

## 1. 分析范围与假设

- 基于当前工作区实际文件，而不是仅依据 Git HEAD。当前分支为 `codex/commercial-installable-baseline`，包含多处未提交修改和设备授权新增文件。
- 已检查 API、业务 helper、公共请求客户端、页面调用点、Nginx 网关配置及现有测试。
- 本轮未连接生产服务器，未读取真实密码、AI 密钥或私密内容，未执行数据导入与部署。
- 本地业务 JSON 文件不完整，不能用本地目录推断线上数据量、完整数据结构和历史质量。
- 暂按“保留现有功能与页面、统一 JavaScript 技术栈”规划。换语言的具体动机、服务器资源、可接受维护窗口和会话连续性要求仍需在实施前明确。
- 既有 `docs/project-improvement-design.md` 和 requirements 是计划文档，其中的 PHP 8.2、公共 bootstrap、文件事务等目标不能当作已实现能力。此次迁移会替代其中的 PHP 运行时方案，保留兼容、安全、备份和验收目标。

## 2. 当前后端是什么

| 层 | 现状 | 对迁移的影响 |
| --- | --- | --- |
| 页面 | 7 个 HTML 页面，原生 JS，大量内联业务逻辑 | 第一阶段保留 UI，集中处理后端协议兼容 |
| 请求客户端 | `assets/js/api-client.js`，另有直接 fetch/XHR | 只改公共客户端不能覆盖全部请求 |
| API | `api/` 下 24 个 PHP 文件 | 需要按方法、action、参数来源和响应逐个登记 |
| 业务代码 | `includes/` 下 20 个 PHP 文件；API 与 helper 合计约一万行 | 有领域逻辑可复用为规则，但不能机械翻译 |
| 业务数据 | JSON 文件与 TXT 配置/文案，图片和私密文件存磁盘 | 需要数据导入、关系校验、文件清单和回滚设计 |
| 会话 | PHP Session，登录和私密认证写在服务端 | Node Session 不会自动兼容 PHP 会话 |
| 设备授权 | 站点根目录外的独立状态文件，独占锁与原子替换 | 备份仅覆盖 `data/` 不完整 |
| 访问控制 | Nginx → `device-gateway.php` → API/私有页面/文件；文件经内部重定向交付 | 迁移 API 时必须同步替换资源访问保护 |
| 自动测试 | 设备单元/并发/HTTP/Nginx 测试，相册文件夹/标签和登录 JS 回归 | 可以保留场景，部分脚本需更新适配 Node |

### 已确认的重点问题

1. `includes/json-helper.php` 的普通业务写入使用固定 `.tmp` 路径和替换，但没有把完整读改写包在锁内。原子替换不能防止并发覆盖；设备存储已经有锁，不能把两者混为一谈。
2. `includes/checkin-helper.php:34` 先保存签到日期/连续天数，再调用 `addBalance()` 发奖励；失败时可能已签到但未入账。
3. `includes/shop-helper.php:100` 将扣款、扣库存、建订单分开执行；退款/恢复库存属于补偿，且虚拟商品创建结果未检查。
4. `includes/task-helper.php:148` 给双方发奖励后才保存任务，发放逻辑写死 `id1/id2`；必须先核对真实账号 ID 和历史数据，不能自动把生产账号改名来适配代码。
5. `api/tasks.php?action=get_today` 会在当日任务缺失时生成并写入；AI 查询也可能写缓存、历史和统计。按 GET/POST 分类不足以判断是否只读。
6. 旧协议并不统一：登录是表单；业务写入多用 JSON；上传用 multipart；action 可能来自 query/body；成功字段通常位于顶层。改成统一 `data` 包装会破坏已有页面。
7. `api/logout.php` 当前销毁会话后重定向。改为 POST + CSRF 是有价值的行为调整，但应作为单独可验收变更，不能在兼容迁移时悄悄改协议。

这些是源码风险，不代表本轮已复现线上故障。

## 3. 三种路线

| 路线 | 优点 | 代价 | 建议 |
| --- | --- | --- | --- |
| Node.js + 原 JSON | 数据格式改动小，较快完成语言替换 | 仍需跨进程锁、跨文件事务和恢复协议；实现后还要再次迁移存储 | 仅在明确要求暂时保留 JSON 时采用 |
| Node.js + SQLite，保留页面和旧协议 | 事务与唯一约束可以解决核心一致性问题；部署仍适合单机 | 需要迁移工具、对账和维护窗口 | 推荐 |
| Node.js + PostgreSQL，并重写前端 | 适合明确的多人服务、多个应用实例和独立前端产品需求 | 接口、数据库、页面和部署同时变化，范围明显增大 | 有这些需求时另行规划 |

SQLite 是基于当前双人、单机使用场景的判断。若实际目标为多租户、多主机或持续大量并发写入，应在建表前选择 PostgreSQL；不要把 SQLite 放到网络共享目录再部署多个写实例。

## 4. 推荐架构

```text
浏览器（现有 HTML + 原生 JavaScript）
                  │ 同源 HTTPS
                  ▼
              Nginx
       ┌──────────┴──────────┐
       ▼                     ▼
公开登录页 / assets       Node.js / Fastify
                          │
                    路由和兼容适配
                          │
                 会话 / CSRF / 权限
                          │
                      领域服务
                     ┌────┴────┐
                     ▼         ▼
                  SQLite    文件存储 / AI
                               │
                        授权后内部文件交付
```

- 使用 JavaScript `.js` + ESM；JSDoc 和静态检查辅助维护。TypeScript 是可选后续决策，不默认扩大“换成 JS”的要求。
- Node.js 24 LTS 是当前推荐运行时，实施时固定受支持的安全补丁版本和依赖锁文件。
- Fastify 负责路由、Schema 校验、日志和插件组织；`@fastify/cookie`、`@fastify/session` 配合 SQLite 持久化 store。生产不用默认内存 Session store。
- SQLite 使用外键、短事务、WAL、busy timeout；写冲突有界重试。better-sqlite3 的同步调用只用于短数据库操作，图片处理、文件 I/O 和 AI 请求均在事务外执行。
- Sharp 处理缩略图和图片重编码；上传大小、像素和并发有界，保留原图与现有 URL。GIF 动画等行为用样本验证后确定，不能默默丢失。
- 一个 Node 服务进程由 systemd 管理，监听 loopback；Nginx 提供 HTTPS。启动检查、优雅退出、重启、备份与恢复纳入部署交付。
- 健康检查新增内部 `/health/live` 和 `/health/ready`；不要把旧 `/api/ping.php` 直接当作公开健康接口，现有网关会保护它。

### 拟新增目录

```text
server/
  package.json / package-lock.json
  src/
    app.js                    可供测试启动的应用工厂
    start.js                  生产启动与优雅退出
    config.js                 环境变量、旧配置兼容和启动校验
    plugins/                  Session、CSRF、错误、日志、数据库
    compat/                   旧 .php URL、action 和响应适配
    modules/
      auth/ devices/          登录、设备状态机、私密二次认证
      wallet/ tasks/ shop/    余额、签到、任务、购买、订单、背包、评价
      album/ media/           文件夹、照片、头像、上传和下载
      private/ whispers/      用户隔离的笔记、文件、悄悄话
      story/ ai/              时间线、提醒、文案与供应商适配
    storage/                  数据库访问、Session store、文件接口
  migrations/                 可编号、可审计的 SQL 迁移
  scripts/                    导入、对账、备份、恢复、启动检查
  tests/                      合同、领域、HTTP、故障和迁移测试
deploy/                       Nginx、systemd、部署说明
```

按领域组织 route/service/repository；领域 service 不依赖 HTTP，不直接拼 JSON 响应。已有 PHP 文件在切换与回滚验证完成前保留。

## 5. 必须保留的兼容边界

### API 与页面

- 新后端继续接受 `/api/*.php`。URL 后缀并不决定执行语言，Nginx 可以将其代理到 Node。
- 保留旧方法、参数名、query/body 优先级、表单/JSON/multipart、状态码、重定向和响应形状。为每个 action 建契约；内部使用一致的错误类型，外层兼容旧返回。
- 不同时统一旧接口 URL、包装全部响应、重写 HTML 或替换前端框架。新协议后续通过单独版本逐页迁移。
- 直接 fetch/XHR、`device-access.php`、`device-login.php`、私密下载链接和现有媒体 URL 都属于兼容范围。

### 认证与设备

- 保留设备 Cookie 名生成规则、`id.secret` 格式、SHA-256 secret hash、Secure/HttpOnly/SameSite、有效期与账号绑定。
- 迁入现有 `bound` 首次绑定账本，防止导入后把后续设备误当首次设备自动授权。
- 保留首次绑定、后续 pending、管理员核对审批、denied/revoked/expired、撤销后重新申请的完整状态机；旧撤销凭证继续失效。
- 设备角色从稳定用户 ID 配置读取，代替源码/前端里的显示名称判断；保持当前管理员权限归属。
- 认证请求实时核对设备状态，撤销后旧 Session 不应继续访问。
- 登录仍要求旧凭据；旧 PHP bcrypt/Argon2 哈希逐类验证兼容。明文只做迁移兼容读取并按明确策略升级，不能对哈希字符串再次哈希。
- CSRF 与 Session 绑定；保留登录仅对 `403 + code: csrf_invalid` 刷新令牌后重试一次，以及 no-store。
- 保留 `/maintaining.html` 的旧客户端 HEAD 兼容行为，缺失时返回 410，避免重定向触发登录刷新循环。

PHP Session 和 Node Session 不直接共享。默认低复杂度方案为：导入设备记录，使用独立 Node Session Cookie，用户切换后重新登录一次，已授权设备不再次审批。这是待确认的体验假设，不能承诺无感切换。

如果实施要求保持当前登录态，需增加临时、仅本机可访问的 PHP 验证桥：验证旧 Session 和设备，短期一次性签发 Node 会话，使用过的凭据防重放，保留私密认证规则，设置撤除期限。避免直接依赖 PHP Session 序列化文件；桥接应单独测试和验收。

### 资源保护

公开资源只包含明确白名单；业务 HTML、相册原图/缩略图、头像、故事媒体、私密附件继续经服务端授权。`data/`、数据库、外部设备状态、日志、脚本、测试、备份和 `.env` 均不能由 Web 直链读取。

Nginx 内部文件 location 保持 `internal`；Node 授权后使用 `X-Accel-Redirect`。覆盖 URL 解码、路径穿越、符号链接、跨账号下载、缓存头与附件文件名；不能把整个 `uploads/` 配为公开静态目录。

## 6. 数据重构

| 旧数据 | 目标实体 | 迁移注意事项 |
| --- | --- | --- |
| `config.json` | 站点配置、用户/关系/角色 | 兼容 `startDate` 和 `site.start_date`；冲突报告，不静默覆盖 |
| `user_currency.json` | 钱包、流水、签到 | 保留余额、汇总、连续天数、历史日期与零奖励签到；差异报告，不自动补发 |
| `tasks.json` | 任务池、每日实例、完成/确认/奖励 | 保留历史奖励、随机任务实例和双方真实 ID |
| `products.json` / `orders.json` | 商品、库存、订单、价格快照 | 保留订单当时价格和折扣，防止从现价重算历史 |
| `virtual_items.json` / `reviews.json` | 背包/使用确认、评价 | 保留订单关系、状态、评价资格和已有评分 |
| `album.json` | 文件夹、照片、标签 | 保留 ID、嵌套路径、上传日期、缩略图和选定上传目录 |
| `private_<userId>.json` | 私密笔记、文件和文件夹 | 每项带 owner；保留用户隔离及文件路径 |
| `whispers.json` | 悄悄话、已读状态 | 检查旧代码涉及的私密归档关系，防止重复归档 |
| `story_events.json` | 手动事件 | 自动纪念日和上传历史保留派生规则，避免重复写入 |
| 外部设备 `state.json` | devices、bindings、限流状态 | 保留 secret hash 与审批/撤销记录；明确限流过期策略 |
| AI 配置、缓存、TXT | 非敏感配置、缓存、文案历史 | 密钥迁到环境变量；保留本地回退及去重来源 |

数据库具体字段需要用脱敏线上样本冻结；没有样本时不生成“最终 schema”。文本 ID 原样导入，不重编号。导入记录源快照哈希、schema 版本、数量和对账结果，可 dry-run、重复运行且不重复插入。

### 核心事务

1. 签到：`UNIQUE(user_id, business_date)`；签到记录、连续天数、奖励流水与钱包在同一事务提交。业务日期统一 Asia/Shanghai，禁止用 UTC 日期截取代替。
2. 每日任务：一天一组已保存的任务实例，唯一约束防止同时生成两组；导入后不重新抽取当日任务。
3. 任务确认：状态变更、双方奖励和流水同一事务；奖励唯一键防重复发放；校验完成者与确认者关系。
4. 购买：带条件扣余额/库存，订单、流水、虚拟物品同一事务；余额与库存不允许负值。现有折扣若有非整数值，先冻结舍入规则，再用固定精度整数单位存储，不能简单 `parseInt`。
5. 虚拟物品：校验所有者、确认者和状态转换；效果执行与结果记录幂等。
6. 网络重试：客户端为一次购买生成固定 idempotency key，服务端保存请求摘要及结果；相同 key + 不同 payload 拒绝。旧客户端没有 key 时不能宣称购买已具备完整幂等，应安排最小前端配套更新。

### 文件与数据库的一致性

文件系统操作不属于 SQLite 事务。上传先入 staging，验证后移动，再提交元数据，失败补偿并有定期孤儿文件检查；删除先标记，提交后执行文件清理，失败可重试。迁移时对所有文件生成路径/大小/哈希清单，不重压历史原图。

不要通过流水重新计算并覆盖历史余额。若历史汇总、流水和当前余额不一致，导入前阻断验收并输出差异，另行决定修复方式。

## 7. 分阶段实施

### 阶段 0：冻结现状与迁移基线

交付：接口契约表、业务规则表、脱敏 fixtures、备份清单、恢复演练报告。

- 固定迁移输入版本；在独立 worktree 工作，先明确当前未提交修改如何进入迁移基线，不丢失或混入无关工作。
- 重新检查线上 Nginx/PHP/磁盘/CPU/内存、配置及外部设备路径；本轮本地配置不是线上快照。
- 对每个 API action 登记 method、身份/设备/私密权限、CSRF、输入来源、响应、错误与副作用。
- 确认是否允许短暂停写以及一次重新登录；若不允许，增加独立的增量同步或会话桥接方案和预算。
- 备份 `data/`、`uploads/`、设备状态、AI 文案历史和有效部署配置，并实际恢复到隔离环境。

验收：两账号完整流程可回放；重要历史数据有数量/余额/库存/关系基线；恢复流程可用。

### 阶段 1：Node 应用与迁移工具

拟新增：`server/src/app.js`、`start.js`、`config.js`、`plugins/`、`storage/`、`migrations/`、`scripts/import-legacy.js`、`scripts/reconcile.js`。

- 建立 ESM 项目、锁文件、应用工厂、错误/日志/Schema、启动检查和内部健康检查。
- 创建数据库迁移和持久化 Session store；在 Windows 开发与目标 Linux 环境验证数据库/图片原生依赖。
- 实现导入 dry-run、幂等导入、差异报告、受控媒体根目录。
- 使用 fixture 运行失败/重复导入与恢复测试，然后实现对应能力；真实数据仅在隔离副本验证。

验收：数据导入不改旧文件；二次导入不重复；不一致输入明确报错；数据库恢复后对账通过。

### 阶段 2：完整认证与网关

拟新增：`server/src/modules/auth/`、`devices/`、`plugins/csrf.js`、`storage/session-store.js`、`compat/auth-routes.js`、`deploy/nginx.conf`。

- 迁移 login/logout/csrf/devices/private-auth、device-access 页面路由、Session、限流、管理员权限和设备账本。
- 在既有设备场景基础上先编写 HTTP 回归，再实现 Node 对应流程。
- 补齐 HTML/媒体/附件访问保护及 Nginx 内部交付；验证 HTTPS 终止代理与 Cookie 设置，trustProxy 仅信任已知代理。
- 登录失效、重新申请、审批、撤销、两账号隔离、服务重启和必要时的会话桥接均覆盖。

验收：旧有效设备凭据继续识别，撤销凭据仍无效；未授权页面/照片/附件无法读取；私密二次认证必须针对当前用户。

### 阶段 3：签到、任务和小铺作为一个事务边界

拟新增：`server/src/modules/wallet/`、`tasks/`、`shop/`、`compat/economy-routes.js`。按需要最小修改 `assets/js/api-client.js` 和 `shop.html` 的购买幂等键，不改 UI。

- 迁移 balance/checkin/tasks/shop/orders/virtual-items/reviews；保留原业务规则与旧响应。
- 将双方账号从配置关系解析，消除 `id1/id2` 写死。
- 每类流程先写并发、重复请求和中途失败测试，再实现事务。
- 对特殊日期折扣、历史价格、评价资格与虚拟物品状态逐项回归。

验收：同用户同日只奖励一次；任务双方同时确认不重复入账；买最后一件库存只成功一次；模拟失败后余额/库存/订单/背包不出现部分提交。

### 阶段 4：相册、文件和内容

拟新增：`server/src/modules/album/`、`media/`、`private/`、`whispers/`、`story/` 及对应 compat 路由。

- 迁移 folders/photos/upload-photo/upload-avatar/private-files/private-notes/whispers/story。
- 保留文件夹 rename/move/delete 对后代与照片关系的影响，以及上传时用户选中的目录。
- 上传支持原 multipart 字段、大小/类型/像素限制和 XHR 进度，验证路径和所有者。
- 时间线保留手动、纪念日、上传历史三类事件排序与日期规则。
- 先覆盖跨账号访问、路径穿越、上传失败/中断、元数据失败和文件清理失败，再实现。

验收：照片和私密文件数量、路径、哈希可对账；原链接与下载行为可用；嵌套目录操作后无孤儿关系；动态文本不引入 XSS。

### 阶段 5：AI、配置与运维

拟新增：`server/src/modules/ai/`、配置/提醒 compat 路由、`scripts/backup.js`、`restore.js`、`doctor.js`、`deploy/couple.service`。

- 迁移 app-config/daily-quote/anniversary-reminders 及实际用到的供应商协议。
- 使用 Node fetch、AbortController、超时、同日请求合并和缓存；AI 服务不可用仍返回有效本地内容。
- 密钥与私密正文不进日志；结构化日志包含 request ID。
- 提供数据库一致备份与文件清单；WAL 模式下使用备份 API或经过验证的停机备份，不只复制 `.db`。
- 交付启动、重启、维护、恢复和故障排查说明，完成全站浏览器回归。

验收：AI 超时不阻塞关键操作；服务重启不丢设备/会话数据；新环境可按文档安装并恢复。

### 阶段 6：演练、切换和回滚

- 使用同一脱敏快照在 PHP 与 Node 环境分别回放；只对副作用安全的查询做差异比较。
- GET 任务生成、AI 生成/缓存、设备 last_seen 等不能直接在真实状态上双重回放。
- 生产短暂停写时覆盖所有隐式写入、设备审批/撤销/限流/Session 更新；停止旧写入者和后台任务，排空在途请求。
- 获取最后一致快照，导入 SQLite、校验文件与关系、对账，然后切换 Nginx 的 API/页面/文件保护路径。
- 新后端只读冒烟通过后再开放写入；观测实际登录、相册、签到、任务、购买、私密下载和 AI 回退。
- 切换后稳定运行并验证回滚工具，再清理 PHP 路由/运行时及临时兼容桥；`.php` URL 可继续保留为协议兼容。

验收：线上操作产生的结果与数据库/媒体实际一致；旧缓存页面能使用；访问保护、备份、进程恢复均通过。

## 8. 回滚不是只改 Nginx

分三种情况：

1. Node 尚未产生业务新写入：停止 Node，恢复 PHP 路由和原一致快照即可。
2. Node 已有新业务写入：先停写并排空，再用经过演练的 SQLite → 旧 JSON 导出工具同步业务数据、设备状态及文件清单，校验后启动 PHP。不能直接恢复旧备份丢掉新数据。
3. 无法安全反向导出：维持维护状态，修复 Node 或恢复包含新写入的数据；不能声称“一键无损回退”。

反向导出工具应在允许生产写入前交付并演练；兼容期避免引入旧 PHP 无法表达的数据状态。Session 根据选定方案重新登录或桥接，不跨运行时同时写同一 Session。

不推荐按流量随机把同一个用户请求分到 PHP 和 Node；两个运行时的 Session、业务存储和文件锁不同。渐进迁移指隔离环境中的模块实施，生产写路径只保留一个权威后端。

## 9. 验证矩阵与完成标准

| 类别 | 核心检查 |
| --- | --- |
| 契约 | 24 个旧接口及所有 action 的参数、响应、状态、权限、重定向与上传字段 |
| 认证 | 有效/撤销设备、重新申请、审批、并发首次登录、CSRF 一次重试、私密认证、重启 |
| 事务 | 并发签到/确认/购买、幂等键冲突、数据库忙、失败不部分提交 |
| 数据迁移 | 重复导入、真实 ID、零奖励签到、旧价格、余额差异、文件哈希与关系 |
| 文件安全 | 跨用户读取、编码路径穿越、符号链接、脚本伪装、超大文件、原图与缩略图 |
| 时间 | Asia/Shanghai 午夜边界、月份切换、闰年、连续签到、纪念日与折扣 |
| 外部依赖 | AI 超时/异常/限流、本地回退，图片处理失败 |
| 部署 | Nginx 真实路由、HTTPS Cookie、私密资源无直链、备份/恢复/反向导出 |
| 浏览器 | 两账号在手机与桌面的登录→相册→签到/任务→小铺→私密空间完整流程 |

拟建立 `npm run check`、`npm test`、`npm run test:integration`、`npm run test:browser` 命令；这些是未来工程交付约定，当前仓库尚没有该 Node 项目或脚本。本轮未运行迁移实现测试。

完成标准：旧页面实际可用、重要历史数据对账通过、所有新写入具有正确事务/状态约束、现有设备安全规则保留、线上文件访问受控、完整恢复与切换后回滚演练通过。单元测试或服务能启动均不足以单独代表迁移完成。

## 10. 工作量与建议首个交付

在单人实施、保留现有前端、单机部署、允许短维护窗口及一次重新登录的前提下，初步按约 3–5 周有效工作量规划。它是范围估计，非交付承诺；线上数据质量、运行环境与会话无感迁移可能增加工作量。

首个可验收交付建议为：迁移基线 + Node 基础应用 + dry-run 导入/对账 + 完整设备认证/资源网关。它能最早验证 PHP→Node 兼容和部署风险；通过后再集中完成经济系统事务与其余业务。

## 11. 官方资料

- Node.js 运行时与 LTS 状态：[Node.js Releases](https://nodejs.org/en/about/previous-releases)。
- Fastify 支持周期：[Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/)。
- 服务端 Session store 与代理配置：[fastify/session](https://github.com/fastify/session)。
- 单机数据库适用边界：[SQLite Appropriate Uses](https://www.sqlite.org/whentouse.html)。
- WAL 和一致备份：[SQLite WAL](https://www.sqlite.org/wal.html)、[SQLite Backup API](https://www.sqlite.org/backup.html)。
- Node 数据库与图片工具：[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)、[Sharp](https://sharp.pixelplumbing.com/)。
