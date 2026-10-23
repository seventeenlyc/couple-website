import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';
import { authenticateUser } from '../src/modules/auth/auth.service.js';
import { isUserAdmin } from '../src/modules/devices/device.service.js';

test('first-run setup creates two accounts and closes permanently', async t => {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'couple-setup-'));
  const app = await buildApp({dbPath: path.join(dir, 'site.db'), setupToken: 'a'.repeat(48), secureCookie: false});
  t.after(async () => { await app.close(); closeDb(); fs.rmSync(dir, {recursive: true, force: true}); });

  const page = await app.inject({method: 'GET', url: '/setup'});
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /初次上线配置/);
  assert.equal((await app.inject({method:'GET',url:'/setup.html'})).statusCode, 404);
  const csrf = await app.inject({method: 'GET', url: '/api/csrf-token.php'});
  const setCookie = csrf.headers['set-cookie'];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie || '').split(';')[0];
  const token = csrf.json().csrf_token;
  assert.ok(cookie && token, JSON.stringify({headers: csrf.headers, token}));
  const payload = {setup_token: 'a'.repeat(48), csrf_token: token, start_date: '2025-02-14',
    admin: 'second', first_name: '甲', first_password: 'long-pass-1234', first_private_password: 'private-1234', first_birthday: '01-01',
    second_name: '乙', second_password: 'long-pass-5678', second_private_password: 'private-5678', second_birthday: '02-14'};
  const headers = {cookie};
  assert.equal((await app.inject({method:'POST',url:'/api/setup',headers,payload:{...payload,csrf_token:''}})).statusCode, 403);
  const rejected = await app.inject({method: 'POST', url: '/api/setup', headers, payload: {...payload, setup_token: 'wrong'}});
  assert.equal(rejected.statusCode, 403);
  assert.equal((await app.inject({method:'POST',url:'/api/setup',headers,payload:{...payload,admin:'third'}})).statusCode, 400);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
  const created = await app.inject({method: 'POST', url: '/api/setup', headers, payload});
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM users').get().n, 2);
  assert.equal(app.db.prepare("SELECT value FROM site_config WHERE key='startDate'").get().value, '2025-02-14');
  const first = app.db.prepare("SELECT * FROM users WHERE username='甲'").get();
  const second = app.db.prepare("SELECT * FROM users WHERE username='乙'").get();
  assert.match(first.password_hash, /^\$2/);
  assert.notEqual(first.private_password_hash, 'private-1234');
  assert.equal(authenticateUser(app.db, '甲', '乙', 'long-pass-1234').success, true);
  assert.equal(authenticateUser(app.db, '乙', '甲', 'long-pass-5678').success, true);
  assert.equal(isUserAdmin(app.db, first.id), false);
  assert.equal(isUserAdmin(app.db, second.id), true);
  async function login(name, partner, password) {
    const cookies = new Map();
    const request = async opts => {
      const response = await app.inject({...opts, headers: {...opts.headers, cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ')}});
      for (const value of [].concat(response.headers['set-cookie'] || [])) {
        const pair = value.split(';')[0];
        const index = pair.indexOf('=');
        cookies.set(pair.slice(0,index), pair.slice(index+1));
      }
      return response;
    };
    const csrfResponse = await request({method:'GET',url:'/api/csrf-token.php'});
    const loggedIn = await request({method:'POST',url:'/api/login.php',payload:{you:name,baby:partner,password,csrf_token:csrfResponse.json().csrf_token}});
    assert.equal(loggedIn.json().success, true, loggedIn.body);
    return request({method:'GET',url:'/api/csrf-token.php'});
  }
  assert.equal((await login('甲','乙','long-pass-1234')).json().is_admin, false);
  assert.equal((await login('乙','甲','long-pass-5678')).json().is_admin, true);
  assert.equal((await app.inject({method: 'GET', url: '/setup'})).statusCode, 404);
  assert.equal((await app.inject({method: 'POST', url: '/api/setup', headers, payload})).statusCode, 409);
});

test('setup is unavailable without a server token and refuses existing data', async t => {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'couple-setup-'));
  const app = await buildApp({dbPath: path.join(dir, 'site.db'), setupToken: '', secureCookie: false});
  t.after(async () => { await app.close(); closeDb(); fs.rmSync(dir, {recursive: true, force: true}); });
  assert.equal((await app.inject({method: 'GET', url: '/setup'})).statusCode, 404);
  app.db.prepare("INSERT INTO site_config(key,value) VALUES ('startDate','2020-01-01')").run();
  assert.equal((await app.inject({method: 'GET', url: '/setup'})).statusCode, 404);
});
