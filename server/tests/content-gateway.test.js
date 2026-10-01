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

test('Content and Gateway Access Control', async (t) => {
  const testDbPath = path.join(__dirname, 'test-content.db');
  const testUploadsDir = path.join(__dirname, 'test-uploads');
  const testRootDir = path.join(__dirname, 'test-root');

  closeDb();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testUploadsDir)) fs.rmSync(testUploadsDir, { recursive: true, force: true });
  if (fs.existsSync(testRootDir)) fs.rmSync(testRootDir, { recursive: true, force: true });

  fs.mkdirSync(testUploadsDir, { recursive: true });
  fs.mkdirSync(testRootDir, { recursive: true });

  // Create a mock home.html in root dir
  fs.writeFileSync(path.join(testRootDir, 'home.html'), '<html><body>Mock Home</body></html>');

  const app = await buildApp({
    dbPath: testDbPath,
    rootDir: testRootDir,
    uploadsDir: testUploadsDir,
    secureCookie: false
  });
  const db = app.db;

  const pwdHash = bcrypt.hashSync('pass123', 10);
  const privHash = bcrypt.hashSync('priv123', 10);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, birthday, balance)
    VALUES ('u1', '拾柒', ?, ?, 'u2', '01-01', 1000)
  `).run(pwdHash, privHash);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, birthday, balance)
    VALUES ('u2', '伴侣', ?, ?, 'u1', '02-14', 1000)
  `).run(pwdHash, privHash);

  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('startDate', '2025-02-05')");

  t.after(async () => {
    await app.close();
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
    if (fs.existsSync(testUploadsDir)) {
      try { fs.rmSync(testUploadsDir, { recursive: true, force: true }); } catch (e) {}
    }
    if (fs.existsSync(testRootDir)) {
      try { fs.rmSync(testRootDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  class MockBrowser {
    constructor() {
      this.cookies = {};
      this.csrf = '';
    }
    async request(opts) {
      const cookieHeader = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      const headers = { ...opts.headers };
      if (cookieHeader) headers.cookie = cookieHeader;
      const res = await app.inject({ ...opts, headers });
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const list = Array.isArray(setCookies) ? setCookies : [setCookies];
        for (const str of list) {
          const m = str.match(/^([^=]+)=([^;]+)/);
          if (m) this.cookies[m[1]] = m[2];
        }
      }
      return res;
    }
    async login(you, baby) {
      const cRes = await this.request({ method: 'GET', url: '/api/csrf-token.php' });
      this.csrf = cRes.json().csrf_token;
      return this.request({
        method: 'POST',
        url: '/api/login.php',
        payload: { you, baby, password: 'pass123', csrf_token: this.csrf }
      });
    }
  }

  const anon = new MockBrowser();
  const user1 = new MockBrowser();
  await user1.login('拾柒', '伴侣');

  await t.test('Gateway protects HTML pages from unauthorized access', async () => {
    // Unauthenticated user is redirected to /device-login.php
    const unauthRes = await anon.request({ method: 'GET', url: '/home.html' });
    assert.equal(unauthRes.statusCode, 302);
    assert.equal(unauthRes.headers.location, '/device-login.php');

    // Authenticated user can read home.html
    const authRes = await user1.request({ method: 'GET', url: '/home.html' });
    assert.equal(authRes.statusCode, 200);
    assert.ok(authRes.payload.includes('Mock Home'));
  });

  await t.test('Gateway protects uploaded media and prevents path traversal', async () => {
    // Put a test photo in testUploadsDir/photos/test.jpg
    const photosDir = path.join(testUploadsDir, 'photos');
    fs.mkdirSync(photosDir, { recursive: true });
    fs.writeFileSync(path.join(photosDir, 'test.jpg'), 'fake-image-bytes');

    // Unauthenticated access -> 401
    const unauthMedia = await anon.request({ method: 'GET', url: '/uploads/photos/test.jpg' });
    assert.equal(unauthMedia.statusCode, 401);

    // Authenticated access -> 200
    const authMedia = await user1.request({ method: 'GET', url: '/uploads/photos/test.jpg' });
    assert.equal(authMedia.statusCode, 200);
    assert.equal(authMedia.payload, 'fake-image-bytes');

    // Path traversal attempt -> 404
    const traversal = await user1.request({ method: 'GET', url: '/uploads/../../package.json' });
    assert.equal(traversal.statusCode, 404);
  });

  await t.test('Folder management: create, list, rename, delete', async () => {
    // Create album folder
    const createRes = await user1.request({
      method: 'POST',
      url: '/api/folders.php',
      payload: {
        action: 'create',
        context: 'album',
        name: '旅游',
        parent_path: '/',
        csrf_token: user1.csrf
      }
    });
    assert.ok(createRes.json().success);

    // List folders
    const listRes = await user1.request({ method: 'GET', url: '/api/folders.php?action=list&context=album' });
    assert.equal(listRes.json().folders.length, 1);
    assert.equal(listRes.json().folders[0].name, '旅游');

    // Rename folder
    const renameRes = await user1.request({
      method: 'POST',
      url: '/api/folders.php',
      payload: {
        action: 'rename',
        context: 'album',
        path: '/旅游',
        new_name: '2026旅行',
        csrf_token: user1.csrf
      }
    });
    assert.ok(renameRes.json().success);

    // Delete folder
    const delRes = await user1.request({
      method: 'POST',
      url: '/api/folders.php',
      payload: {
        action: 'delete',
        context: 'album',
        path: '/2026旅行',
        csrf_token: user1.csrf
      }
    });
    assert.ok(delRes.json().success);
    const listAfter = await user1.request({ method: 'GET', url: '/api/folders.php?action=list&context=album' });
    assert.equal(listAfter.json().folders.length, 0);
  });

  await t.test('Whispers API: send, check unread, history, mark read', async () => {
    const user2 = new MockBrowser();
    await user2.login('伴侣', '拾柒');

    // 1. User1 sends whisper to User2
    const sendRes = await user1.request({
      method: 'POST',
      url: '/api/whispers.php',
      payload: { action: 'send', content: '今天想吃火锅吗？', csrf_token: user1.csrf }
    });
    assert.ok(sendRes.json().success);

    // 2. User2 checks unread
    const unreadRes = await user2.request({ method: 'GET', url: '/api/whispers.php?action=check_unread' });
    assert.equal(unreadRes.json().has_unread, true);
    assert.equal(unreadRes.json().count, 1);

    // 3. User2 marks as read
    const markRes = await user2.request({
      method: 'POST',
      url: '/api/whispers.php',
      payload: { action: 'mark_read', csrf_token: user2.csrf }
    });
    assert.ok(markRes.json().success);

    // 4. Verify unread count is 0
    const checkAfter = await user2.request({ method: 'GET', url: '/api/whispers.php?action=check_unread' });
    assert.equal(checkAfter.json().has_unread, false);

    // 5. History has 1 whisper
    const historyRes = await user1.request({ method: 'GET', url: '/api/whispers.php?action=get_history' });
    assert.equal(historyRes.json().whispers.length, 1);
    assert.equal(historyRes.json().whispers[0].content, '今天想吃火锅吗？');
  });

  await t.test('Story timeline and AI daily quotes', async () => {
    // Story timeline
    const storyRes = await user1.request({ method: 'GET', url: '/api/story.php' });
    assert.equal(storyRes.statusCode, 200);
    assert.ok(storyRes.json().success);
    assert.ok(storyRes.json().events.length >= 1);
    assert.ok(storyRes.json().events.some(e => e.type === 'start'));

    // Create story event
    const createStory = await user1.request({
      method: 'POST',
      url: '/api/story.php',
      payload: {
        title: '看海日记',
        content: '今天在海边看日落',
        date: '2026-05-01',
        csrf_token: user1.csrf
      }
    });
    assert.ok(createStory.json().success);

    // Timeline now includes custom event
    const storyAfter = await user1.request({ method: 'GET', url: '/api/story.php' });
    const custom = storyAfter.json().events.find(e => e.title === '看海日记');
    assert.ok(custom);

    // Daily quote
    const quoteRes = await user1.request({ method: 'GET', url: '/api/daily-quote.php' });
    assert.equal(quoteRes.statusCode, 200);
    assert.ok(quoteRes.json().quote);

    // Anniversary reminders
    const remRes = await user1.request({ method: 'GET', url: '/api/anniversary-reminders.php' });
    assert.equal(remRes.statusCode, 200);
    assert.ok(remRes.json().reminders.length >= 1);
  });

  await t.test('Health check endpoints work without authentication', async () => {
    const live = await anon.request({ method: 'GET', url: '/health/live' });
    assert.equal(live.statusCode, 200);
    assert.equal(live.json().status, 'ok');

    const ready = await anon.request({ method: 'GET', url: '/health/ready' });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().status, 'ready');
  });
});
