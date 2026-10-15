/**
 * 三阶段复审缺陷回归（服务端与静态面）。
 *
 * 测试分工（回应复审“测试未覆盖实际组件/依赖外部服务”的意见）：
 *   - Defect 3 / Defect 6 的真实组件执行：server/tests/frontend-real-dom.test.js
 *     （加载真实 desktop/h5 页面脚本，点击真实渲染出的卡片与候选按钮）
 *   - 内联事件处理器插值的正确解析与收敛：server/tests/frontend-inline-handler-safety.test.js
 *   - 常驻服务真实 HTTP 检查（默认跳过、可配置地址）：server/tests/live-service.integration.test.js
 *   - 回忆检索地点/日期限定：server/tests/agent-memory-constraints.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { closeDb } from '../src/storage/db.js';
import { chatWithCoupleAgent } from '../src/modules/ai/ai.service.js';

const require = createRequire(import.meta.url);
const DeviceRouter = require('../../assets/js/device-router.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const schemaPath = path.resolve(__dirname, '../src/storage/schema.sql');

test('Review 9 Defects Systematic Fix Verification Suite', async (t) => {
  let app;
  let testDbPath = path.join(__dirname, 'test-defects-review.db');

  t.before(async () => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    app = await buildApp({
      dbPath: testDbPath,
      port: 19085,
      allowedOrigins: ['http://localhost:19085', 'http://127.0.0.1:19085']
    });
  });

  t.after(async () => {
    if (app) await app.close();
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  // =========================================================================
  // Defect 1: 配置与敏感文件泄露防护（注入式 HTTP 检查；常驻服务检查见
  // live-service.integration.test.js，默认跳过、可配置地址）
  // =========================================================================
  await t.test('Defect 1: Static sensitive files are rejected by the app instance', async () => {
    // Injected Fastify checks
    const resConfig = await app.inject({ method: 'GET', url: '/data/config.json' });
    assert.equal(resConfig.statusCode, 404, 'Must reject /data/config.json');

    const resDb = await app.inject({ method: 'GET', url: '/data/couple.db' });
    assert.equal(resDb.statusCode, 404, 'Must reject database file');

    const resServer = await app.inject({ method: 'GET', url: '/server/src/app.js' });
    assert.equal(resServer.statusCode, 404, 'Must reject server source code');

    const resDocs = await app.inject({ method: 'GET', url: '/docs/reviews/2026-10-03-three-stage-review.md' });
    assert.equal(resDocs.statusCode, 404, 'Must reject internal docs');

    const resAssets = await app.inject({ method: 'GET', url: '/assets/js/device-router.js' });
    assert.equal(resAssets.statusCode, 200, 'Frontend asset is served');
  });

  // =========================================================================
  // Defect 2: CORS 权限控制 (自定义 allowedOrigins 白名单与未授权拒绝)
  // =========================================================================
  await t.test('Defect 2: Custom allowedOrigins white-listing and unauthorized origin rejection', async () => {
    // 1. loadConfig preserves allowedOrigins
    const customConfig = loadConfig({ allowedOrigins: ['https://trusted.review.example'] });
    assert.deepEqual(customConfig.allowedOrigins, ['https://trusted.review.example'], 'loadConfig preserves allowedOrigins');

    // 2. buildApp with custom allowedOrigins
    const customApp = await buildApp({
      allowedOrigins: ['https://trusted.review.example']
    });

    try {
      // 2a. Preflight from custom allowed origin returns 204 with CORS headers
      const resAllowed = await customApp.inject({
        method: 'OPTIONS',
        url: '/api/tasks',
        headers: {
          origin: 'https://trusted.review.example',
          'access-control-request-method': 'GET'
        }
      });
      assert.equal(resAllowed.statusCode, 204, 'Allowed custom origin gets 204');
      assert.equal(resAllowed.headers['access-control-allow-origin'], 'https://trusted.review.example');
      assert.equal(resAllowed.headers['access-control-allow-credentials'], 'true');
      assert.equal(resAllowed.headers['vary'], 'Origin');

      // 2b. Preflight from untrusted origin returns 403
      const resUntrusted = await customApp.inject({
        method: 'OPTIONS',
        url: '/api/tasks',
        headers: {
          origin: 'https://untrusted.review.example',
          'access-control-request-method': 'GET'
        }
      });
      assert.equal(resUntrusted.statusCode, 403, 'Untrusted origin preflight returns 403');

      // 2c. Origin: null request has no allow-origin
      const resNull = await customApp.inject({
        method: 'GET',
        url: '/api/csrf-token.php',
        headers: { origin: 'null' }
      });
      assert.equal(resNull.headers['access-control-allow-origin'], undefined, 'null origin must be rejected');
    } finally {
      await customApp.close();
    }
  });

  // =========================================================================
  // Defect 3: 脚本注入消除与真实 DOM 事件点击执行验证
  // 真实组件覆盖已迁移至 frontend-real-dom.test.js：
  //   - 加载真实 desktop/h5 页面脚本并自然启动，只替换网络层；
  //   - 恶意目录名经过真实 renderFoldersRow / renderAlbumView 渲染；
  //   - 点击真实卡片、✎ 重命名、✕ 删除，并用真实 API 调用记录断言；
  //   - 内联事件属性插值的正确解析见 frontend-inline-handler-safety.test.js。
  // 这里保留一个轻量守卫：产品源码不得再出现“把变量插进 onclick 属性”的写法。
  // =========================================================================
  await t.test('Defect 3: no raw variable interpolation remains in inline onclick handlers', () => {
    const desktopJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');
    const h5Js = fs.readFileSync(path.join(rootDir, 'h5/js/app.js'), 'utf8');

    // 正确解析 HTML 属性边界（双引号属性内部的单引号不会结束属性），
    // 并要求唯一允许的写法 safeInlineArg(...)，详见 frontend-inline-handler-safety.test.js
    for (const [label, source] of [['desktop/js/app.js', desktopJs], ['h5/js/app.js', h5Js]]) {
      const head = /\bon[a-z]+\s*=\s*(["'])/g;
      let match;
      while ((match = head.exec(source)) !== null) {
        const quote = match[1];
        const valueStart = match.index + match[0].length;
        const valueEnd = source.indexOf(quote, valueStart);
        if (valueEnd === -1) break;
        const value = source.slice(valueStart, valueEnd);
        for (const interpolation of value.matchAll(/\$\{([^{}]*)\}/g)) {
          assert.match(
            interpolation[1].trim(),
            /^safeInlineArg\(/,
            `${label}: inline handler interpolation must use safeInlineArg(...)`
          );
        }
        head.lastIndex = valueEnd + 1;
      }
    }
  });

  // =========================================================================
  // Defect 4: H5 index.html 不再覆盖 openSinglePhotoViewer
  // =========================================================================
  await t.test('Defect 4: H5 index.html does not override openSinglePhotoViewer', async () => {
    const h5Html = fs.readFileSync(path.join(rootDir, 'h5/index.html'), 'utf8');
    const h5Js = fs.readFileSync(path.join(rootDir, 'h5/js/app.js'), 'utf8');

    assert.ok(!h5Html.includes('function openSinglePhotoViewer'), 'h5/index.html must not redefine openSinglePhotoViewer');
    assert.ok(h5Js.includes('function openSinglePhotoViewer(title, dateMeta, typeOrUrl)'), 'H5 app.js provides unified openSinglePhotoViewer');
    assert.ok(h5Js.includes('url: isUrl ?'), 'Sets url field for real images');
  });

  // =========================================================================
  // Defect 5: 移动端设备切换卡片 insertBefore 节点正确
  // =========================================================================
  await t.test('Defect 5: h5/js/device-switch.js uses valid reference node for insertBefore', async () => {
    const switchJs = fs.readFileSync(path.join(rootDir, 'h5/js/device-switch.js'), 'utf8');
    assert.ok(switchJs.includes('logoutBtn.parentElement.insertBefore(switchCard, logoutBtn)'), 'Inserts switchCard before logoutBtn');
    assert.ok(!switchJs.includes('logoutBtn.parentElement.insertBefore(switchCard, logoutBtn.parentElement)'), 'Must not pass parentElement as reference node');
  });

  // =========================================================================
  // Defect 6: 草稿三选一控件与多行格式保护
  // 真实控件覆盖已迁移至 frontend-real-dom.test.js：双端调用真实
  // openAgentActionMenu + triggerActionMenuWhisper，点击真实渲染出的候选按钮，
  // 断言 textarea 保留多行文本与选中态。这里不再自行重写一遍渲染逻辑。
  // =========================================================================

  // =========================================================================
  // Defect 7: 直接执行 DeviceRouter.isSafeLocalRedirect 严格校验
  // =========================================================================
  await t.test('Defect 7: Direct execution of DeviceRouter.isSafeLocalRedirect rejects protocol-relative backslash URLs', async () => {
    // Directly execute exported DeviceRouter method without mock or re-implementation
    assert.equal(typeof DeviceRouter.isSafeLocalRedirect, 'function', 'DeviceRouter exports isSafeLocalRedirect');

    // Rejects backslash and cross-origin attempts
    assert.equal(DeviceRouter.isSafeLocalRedirect('/\\untrusted.example'), false, 'Rejects /\\untrusted.example');
    assert.equal(DeviceRouter.isSafeLocalRedirect('/\\example.com'), false, 'Rejects /\\example.com');
    assert.equal(DeviceRouter.isSafeLocalRedirect('//example.com'), false, 'Rejects protocol-relative //example.com');
    assert.equal(DeviceRouter.isSafeLocalRedirect('https://evil.com'), false, 'Rejects absolute https:// URL');
    assert.equal(DeviceRouter.isSafeLocalRedirect('javascript:alert(1)'), false, 'Rejects javascript scheme');
    assert.equal(DeviceRouter.isSafeLocalRedirect('/path\r\nHost: evil.com'), false, 'Rejects newline control chars');

    // Allows legitimate safe relative local paths
    assert.equal(DeviceRouter.isSafeLocalRedirect('/h5/index.html'), true, 'Allows /h5/index.html');
    assert.equal(DeviceRouter.isSafeLocalRedirect('/desktop/index.html?ref=device'), true, 'Allows /desktop/index.html with params');
  });

  // =========================================================================
  // Defect 8: 智能回忆搜索词提取与旅行/纪念日意图识别
  // =========================================================================
  await t.test('Defect 8: Trip and sunset queries correctly retrieve memories without stopword over-stripping', async () => {
    const testDb = new Database(':memory:');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    testDb.exec(schemaSql);
    testDb.prepare("INSERT INTO site_config (key, value) VALUES ('startDate', '2025-02-05')").run();
    testDb.prepare("INSERT INTO users (id, username, password_hash, birthday) VALUES ('u1', 'name1', 'hash1', '01-01'), ('u2', 'name2', 'hash2', '02-14')").run();

    // Insert photos
    testDb.prepare(`
      INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('trip1', '/厦门旅行', 'sunset.jpg', 'uploads/photos/sunset.jpg', 'uploads/thumbnails/sunset.jpg', '厦门旅行看海日落', '晚风很舒服', '旅行,海边', 'name1', '2026-09-28 18:00:00');

    // 1. "看海日落" query must keep "看" in title search
    const resSunset = await chatWithCoupleAgent(testDb, '找海边看日落的照片', [], 'name1');
    assert.equal(resSunset.success, true);
    assert.equal(resSunset.source, 'local_memory', 'Must match local_memory');
    assert.ok(resSunset.reply.includes('厦门旅行看海日落'), 'Mentions retrieved photo');

    // 2. Query containing both '旅行' and '照片'
    const resTrip = await chatWithCoupleAgent(testDb, '找厦门旅行的照片', [], 'name1');
    assert.equal(resTrip.success, true);
    assert.equal(resTrip.source, 'local_memory', 'Trip photo search matches local_memory, not date plan');
    assert.equal(resTrip.memoryRef.title, '厦门旅行看海日落');

    // 3. Pure date planning request matches date plan
    const resDate = await chatWithCoupleAgent(testDb, '想想周末怎么过', [], 'name1');
    assert.equal(resDate.draft?.type, 'date_plan', 'Pure weekend query matches date plan');

    testDb.close();
  });

  // =========================================================================
  // Defect 9: 桌面大图入口使用原图地址 (mem.url)
  // =========================================================================
  await t.test('Defect 9: Desktop viewer uses original photo url (mem.url), not thumbnail', async () => {
    const desktopJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');
    assert.ok(desktopJs.includes('api.resolveAssetUrl(mem.url || mem.thumb || \'\')'), 'Resolves original photo url first');
    assert.ok(desktopJs.includes('openImageViewerForMemory(mem.title || \'回忆\', mem.date || \'\', memOriginalUrl)'), 'Passes original photo url to viewer');
  });
});
