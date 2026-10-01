import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createTestDb(appDbPath) {
  closeDb();
  if (fs.existsSync(appDbPath)) {
    fs.unlinkSync(appDbPath);
  }
}

test('Authentication and Device State Machine', async (t) => {
  const testDbPath = path.join(__dirname, 'test-auth.db');
  createTestDb(testDbPath);

  const app = await buildApp({
    dbPath: testDbPath,
    secureCookie: false
  });

  const db = app.db;

  // Insert test users
  const pwdHash = bcrypt.hashSync('pass123', 10);
  const privHash = bcrypt.hashSync('priv123', 10);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, birthday, balance)
    VALUES ('id_admin', '拾柒', ?, ?, 'id_member', '01-01', 1000)
  `).run(pwdHash, privHash);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, birthday, balance)
    VALUES ('id_member', '测试伴侣', ?, ?, 'id_admin', '02-14', 1000)
  `).run(pwdHash, privHash);

  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('startDate', '2025-02-05')");

  t.after(async () => {
    await app.close();
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  // Helper for simulating browser sessions with cookies
  class MockBrowser {
    constructor() {
      this.cookies = {};
      this.csrf = '';
    }

    async request(opts) {
      const cookieHeader = Object.entries(this.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      const headers = { ...opts.headers };
      if (cookieHeader) headers.cookie = cookieHeader;

      const res = await app.inject({
        ...opts,
        headers
      });

      // Capture set-cookie
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const cookieList = Array.isArray(setCookies) ? setCookies : [setCookies];
        for (const str of cookieList) {
          const match = str.match(/^([^=]+)=([^;]+)/);
          if (match) {
            this.cookies[match[1]] = match[2];
          }
        }
      }

      return res;
    }

    async getCsrf() {
      const res = await this.request({ method: 'GET', url: '/api/csrf-token.php' });
      assert.equal(res.statusCode, 200);
      const json = res.json();
      assert.ok(json.success);
      this.csrf = json.csrf_token;
      return this.csrf;
    }

    async login(you, baby, password) {
      await this.getCsrf();
      return this.request({
        method: 'POST',
        url: '/api/login.php',
        payload: {
          you,
          baby,
          password,
          csrf_token: this.csrf
        }
      });
    }

    async device(action, extra = {}) {
      return this.request({
        method: 'POST',
        url: '/api/devices.php',
        payload: {
          action,
          csrf_token: this.csrf,
          ...extra
        }
      });
    }
  }

  await t.test('Login with invalid CSRF returns 403 csrf_invalid', async () => {
    const b = new MockBrowser();
    const res = await b.request({
      method: 'POST',
      url: '/api/login.php',
      payload: {
        you: '拾柒',
        baby: '测试伴侣',
        password: 'pass',
        csrf_token: 'invalid_token'
      }
    });
    assert.equal(res.statusCode, 403);
    const json = res.json();
    assert.equal(json.code, 'csrf_invalid');
  });

  let adminBrowser;
  let memberBrowser1;
  let memberBrowser2;

  await t.test('Admin first login auto-binds device and establishes session', async () => {
    adminBrowser = new MockBrowser();
    const res = await adminBrowser.login('拾柒', '测试伴侣', 'pass123');
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.ok(json.success);
    assert.equal(json.user, '拾柒');

    // Check device status
    const statusRes = await adminBrowser.device('status');
    assert.equal(statusRes.statusCode, 200);
    const statusJson = statusRes.json();
    assert.equal(statusJson.status, 'active');
    assert.equal(statusJson.admin, true);

    // Protected app-config accessible
    const cfgRes = await adminBrowser.request({ method: 'GET', url: '/api/app-config.php' });
    assert.equal(cfgRes.statusCode, 200);
  });

  await t.test('Member first login also auto-binds device as active', async () => {
    memberBrowser1 = new MockBrowser();
    const res = await memberBrowser1.login('测试伴侣', '拾柒', 'pass123');
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.ok(json.success);
    assert.equal(json.user, '测试伴侣');

    const statusRes = await memberBrowser1.device('status');
    const statusJson = statusRes.json();
    assert.equal(statusJson.status, 'active');
    assert.equal(statusJson.admin, false);

    // Non-admin cannot list devices
    const listRes = await memberBrowser1.device('list');
    assert.equal(listRes.statusCode, 403);
  });

  let pairCode = '';
  let pendingDevId = '';

  await t.test('Member second device login goes to pending status with pair code', async () => {
    memberBrowser2 = new MockBrowser();
    const res = await memberBrowser2.login('测试伴侣', '拾柒', 'pass123');
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, false);
    assert.equal(json.device_pending, true);

    // Cannot access protected API yet
    const cfgRes = await memberBrowser2.request({ method: 'GET', url: '/api/app-config.php' });
    assert.equal(cfgRes.statusCode, 401);

    // Polls status to get pairing code
    const statusRes = await memberBrowser2.device('status');
    const statusJson = statusRes.json();
    assert.equal(statusJson.status, 'pending');
    assert.ok(statusJson.code);
    pairCode = statusJson.code;
  });

  await t.test('Admin lists devices and approves member second device with pair code', async () => {
    const listRes = await adminBrowser.device('list');
    assert.equal(listRes.statusCode, 200);
    const listJson = listRes.json();
    assert.ok(Array.isArray(listJson.devices));

    const pendingDevice = listJson.devices.find(d => d.status === 'pending');
    assert.ok(pendingDevice);
    pendingDevId = pendingDevice.id;

    // Wrong code fails
    const failApprove = await adminBrowser.device('approve', { id: pendingDevId, code: '00000000' });
    assert.equal(failApprove.json().success, false);
    assert.equal(failApprove.json().message, '核对码错误');

    // Correct code succeeds
    const okApprove = await adminBrowser.device('approve', { id: pendingDevId, code: pairCode });
    assert.equal(okApprove.json().success, true);
  });

  await t.test('Approved member second device now becomes active on next status check and accesses APIs', async () => {
    const statusRes = await memberBrowser2.device('status');
    assert.equal(statusRes.statusCode, 200);
    const statusJson = statusRes.json();
    assert.equal(statusJson.status, 'active');

    // Now has access!
    const cfgRes = await memberBrowser2.request({ method: 'GET', url: '/api/app-config.php' });
    assert.equal(cfgRes.statusCode, 200);
  });

  await t.test('Admin revokes member second device, access is immediately blocked', async () => {
    const revokeRes = await adminBrowser.device('revoke', { id: pendingDevId });
    assert.equal(revokeRes.json().success, true);

    // Member second device now 401
    const cfgRes = await memberBrowser2.request({ method: 'GET', url: '/api/app-config.php' });
    assert.equal(cfgRes.statusCode, 401);
  });

  await t.test('Private password verification unlocks private space session', async () => {
    // Before verification
    const statusBefore = await adminBrowser.request({
      method: 'POST',
      url: '/api/private-auth.php',
      payload: { action: 'status', csrf_token: adminBrowser.csrf }
    });
    assert.equal(statusBefore.json().is_authenticated, false);

    // Wrong password
    const failVerify = await adminBrowser.request({
      method: 'POST',
      url: '/api/private-auth.php',
      payload: { action: 'verify', password: 'wrong', csrf_token: adminBrowser.csrf }
    });
    assert.equal(failVerify.statusCode, 401);

    // Correct password
    const okVerify = await adminBrowser.request({
      method: 'POST',
      url: '/api/private-auth.php',
      payload: { action: 'verify', password: 'priv123', csrf_token: adminBrowser.csrf }
    });
    assert.equal(okVerify.statusCode, 200);
    assert.equal(okVerify.json().success, true);

    // After verification
    const statusAfter = await adminBrowser.request({
      method: 'POST',
      url: '/api/private-auth.php',
      payload: { action: 'status', csrf_token: adminBrowser.csrf }
    });
    assert.equal(statusAfter.json().is_authenticated, true);
  });

  await t.test('Logout destroys session and redirects to index.html', async () => {
    const res = await adminBrowser.request({ method: 'GET', url: '/api/logout.php' });
    assert.equal(res.statusCode, 302);
    assert.ok(res.headers.location.includes('index.html'));

    // Check that session is gone
    const cfgRes = await adminBrowser.request({ method: 'GET', url: '/api/app-config.php' });
    assert.equal(cfgRes.statusCode, 401);
  });
});
