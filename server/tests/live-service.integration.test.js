/**
 * 常驻服务真实 HTTP 集成检查（显式开关，默认跳过）。
 *
 * 复审建议：把“依赖外部进程的集成验证”与“无需外部进程的回归测试”分开，并提供明确的
 * 启动步骤与可配置地址。默认 `node --test server/tests/*.test.js` 不再因服务未启动而失败。
 *
 * 启用方式：
 *   1. 启动服务（默认端口 19085）：
 *        cd server && npm start
 *   2. 运行本文件：
 *        REVIEW_LIVE_SERVICE=1 node --test server/tests/live-service.integration.test.js
 *   3. 自定义地址：
 *        REVIEW_LIVE_SERVICE=1 REVIEW_LIVE_BASE_URL=http://127.0.0.1:19085 node --test ...
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = (process.env.REVIEW_LIVE_BASE_URL || 'http://127.0.0.1:19085').replace(/\/+$/, '');
const ENABLED = process.env.REVIEW_LIVE_SERVICE === '1';
const SKIP_REASON = `opt-in: start the service (cd server && npm start) then set REVIEW_LIVE_SERVICE=1 to probe ${BASE_URL}`;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${BASE_URL}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

test('Live service integration (real HTTP on the running 19085 process)', { skip: ENABLED ? false : SKIP_REASON }, async (t) => {
  await t.test('health/ready returns 200 ready', async () => {
    let res;
    try {
      res = await request('/health/ready');
    } catch (err) {
      assert.fail(`Live service at ${BASE_URL} is unreachable (${err.message}); start it with "cd server && npm start"`);
    }
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ready');
  });

  await t.test('sensitive static paths are rejected over real HTTP', async () => {
    for (const path of ['/data/config.json', '/data/couple.db', '/server/src/app.js', '/docs/reviews/2026-10-03-review.md']) {
      const res = await request(path);
      assert.equal(res.status, 404, `${path} must return 404 on the live service`);
    }
  });

  await t.test('frontend assets are still served', async () => {
    const res = await request('/assets/js/device-router.js');
    assert.equal(res.status, 200);
  });

  await t.test('untrusted origin preflight is rejected', async () => {
    const res = await request('/api/tasks', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.attacker.com', 'Access-Control-Request-Method': 'GET' }
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  await t.test('Origin: null never receives credentials', async () => {
    const res = await request('/api/csrf-token.php', { headers: { origin: 'null' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});
