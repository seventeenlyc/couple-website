import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';

test('root guide and public assets are served without a session', async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'couple-login-'));
  fs.mkdirSync(path.join(rootDir, 'assets/js'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'index.html'), '<html>Root guide</html>');
  fs.writeFileSync(path.join(rootDir, 'assets/js/api-client.js'), 'window.loginClient = true;');
  fs.writeFileSync(path.join(rootDir, 'secret.txt'), 'must not be public');
  const app = await buildApp({ dbPath: ':memory:', rootDir, secureCookie: false });
  t.after(async () => {
    await app.close();
    closeDb();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });
  for (const url of ['/index.html?redirect=%2Fh5%2Findex.html', '/']) {
    const res = await app.inject({ url });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.body, /Root guide/);
  }
  const deviceLogin = await app.inject({ url: '/device-login.php' });
  assert.equal(deviceLogin.statusCode, 302);
  assert.equal(deviceLogin.headers.location, '/desktop/login.html');
  const asset = await app.inject({ url: '/assets/js/api-client.js?v=test' });
  assert.equal(asset.statusCode, 200);
  assert.match(asset.headers['content-type'], /javascript/);
  assert.match(asset.body, /loginClient/);
  for (const url of ['/assets/missing.js', '/secret.txt', '/assets/%2e%2e/secret.txt']) {
    assert.equal((await app.inject({ url })).statusCode, 404);
  }
});
