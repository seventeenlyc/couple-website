import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';

async function fixture(t, aiConfig) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'shiguang-model-'));
  const dbPath = path.join(folder, 'test.db');
  const app = await buildApp({ dbPath, secureCookie: false });
  t.after(async () => {
    await app.close();
    closeDb();
    for (const name of ['test.db', 'test.db-wal', 'test.db-shm']) {
      const file = path.join(folder, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(folder);
  });
  app.db.prepare("INSERT INTO users(id,username,password_hash,partner_id) VALUES('test1','测试甲','','test2'),('test2','测试乙','','test1')").run();
  app.db.prepare("INSERT INTO site_config(key,value) VALUES('startDate','2025-02-05'),('ai',?)").run(JSON.stringify(aiConfig));
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const cookies = new Map();
  async function request(route, body) {
    const res = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Cookie: [...cookies.values()].join('; ') },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(55000)
    });
    for (const raw of res.headers.getSetCookie()) {
      const cookie = raw.split(';')[0];
      cookies.set(cookie.split('=')[0], cookie);
    }
    return { status: res.status, data: await res.json() };
  }
  const unauthenticated = await request('/api/agent/chat', { message: '你好' });
  assert.equal(unauthenticated.status, 401);
  const csrf = await request('/api/csrf-token.php');
  const login = await request('/api/login.php', {
    you: '测试甲', baby: '测试乙', password: '', csrf_token: csrf.data.csrf_token
  });
  assert.equal(login.data.success, true);
  return request;
}

test('authenticated chat waits beyond six seconds and still falls back on upstream failure', async (t) => {
  let mode = 'ok';
  const calls = [];
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({ url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) });
    if (mode === 'failure') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'temporarily unavailable' }));
      return;
    }
    if (mode === 'truncated') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '未完成的句子' } }] }));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 7000));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '今天辛苦了，我陪你慢慢休息。' } }] }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => upstream.close(resolve)));
  const request = await fixture(t, {
    enabled: true, base_url: `http://127.0.0.1:${upstream.address().port}/v1`,
    api_key: 'test-only-key', model: 'gemini-3.8-flash-tiered'
  });
  const result = await request('/api/agent/chat', { message: '帮我写一句话，告诉对方今天辛苦了', history: [] });
  assert.equal(result.status, 200);
  assert.equal(result.data.source, 'ai');
  assert.equal(result.data.reply, '今天辛苦了，我陪你慢慢休息。');
  assert.equal(result.data.draft.type, 'whisper');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/v1/chat/completions');
  assert.equal(calls[0].authorization, 'Bearer test-only-key');
  assert.equal(calls[0].body.model, 'gemini-3.8-flash-tiered');
    mode = 'truncated';
    const truncated = await request('/api/agent/chat', { message: '帮我写一句话', history: [] });
    assert.equal(truncated.data.source, 'local_agent');
    assert.notEqual(truncated.data.reply, '未完成的句子');
    mode = 'failure';
  const fallback = await request('/api/agent-chat.php', { message: '帮我写一句话', history: [] });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.data.source, 'local_agent');
  assert.equal(fallback.data.draft.type, 'whisper');
});

test('configured local model replies through both authenticated chat routes', {
  skip: process.env.SHIGUANG_LIVE_API !== '1'
}, async (t) => {
  assert.ok(process.env.SHIGUANG_CONFIG_DB, 'Provide the local configuration database');
  const configDb = new Database(process.env.SHIGUANG_CONFIG_DB, { readonly: true });
  let ai;
  try {
    ai = JSON.parse(configDb.prepare("SELECT value FROM site_config WHERE key='ai'").get().value);
  } finally {
    configDb.close();
  }
  assert.equal(ai.enabled, true);
  assert.equal(ai.base_url, 'http://127.0.0.1:8045/v1');
  assert.equal(ai.model, 'gemini-3.8-flash-tiered');
  const request = await fixture(t, ai);
  for (const [route, message] of [
    ['/api/agent/chat', '帮我写一句话，告诉对方今天辛苦了'],
    ['/api/agent-chat.php', '想想周末怎么过']
  ]) {
    const started = performance.now();
    const result = await request(route, { message, history: [] });
    assert.equal(result.status, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.source, 'ai', 'The response must come from the model');
    assert.ok(result.data.reply?.trim());
    assert.ok(result.data.draft);
    console.log(JSON.stringify({ route, source: result.data.source,
      elapsedSeconds: Math.round((performance.now() - started) / 10) / 100,
      reply: result.data.reply, draftType: result.data.draft.type }));
  }
});
