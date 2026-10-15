import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';

test('public file routes serve only frontend files inside the configured root', async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'couple-public-'));
  const files = {
    'index.html': '<html>Fixture login</html>',
    'assets/js/app.js': 'window.fixture = true;',
    'assets/config.json': '{"secret":"fixture"}',
    'assets/.hidden.js': 'private fixture',
    'h5/index.html': '<html>Fixture mobile</html>',
    'h5/config.json': '{"secret":"fixture"}',
    'desktop/index.html': '<html>Fixture desktop</html>',
    'desktop/backup.txt': 'private fixture',
    'deploy/nginx.conf': 'private fixture',
    'test/api-verification.html': '<html>Internal test fixture</html>',
    'secret.txt': 'private fixture'
  };
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(rootDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  const app = await buildApp({ dbPath: ':memory:', rootDir, secureCookie: false });
  t.after(async () => {
    await app.close();
    closeDb();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });
  for (const url of ['/index.html', '/assets/js/app.js', '/h5/index.html', '/desktop/index.html']) {
    const response = await app.inject({ url });
    assert.equal(response.statusCode, 200, url);
    assert.match(response.body, /Fixture|fixture/, url);
  }
  for (const url of ['/deploy/nginx.conf', '/test/api-verification.html', '/verify-parity.mjs',
    '/secret.txt', '/assets/config.json', '/assets/.hidden.js', '/h5/config.json',
    '/desktop/backup.txt', '/assets/%2e%2e/secret.txt', '/h5/%2e%2e/secret.txt']) {
    assert.equal((await app.inject({ url })).statusCode, 404, url);
  }
});
