import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatWithCoupleAgent, searchMemories, generateWhisperDrafts, generateDatePlanDraft } from '../src/modules/ai/ai.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../src/storage/schema.sql');

test('Agent Real Memory & Drafts Suite', async (t) => {
  let db;

  t.beforeEach(() => {
    db = new Database(':memory:');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    db.prepare("INSERT INTO site_config (key, value) VALUES ('startDate', '2025-02-05')").run();
    db.prepare("INSERT INTO users (id, username, password_hash, birthday) VALUES ('u1', 'name1', 'hash1', '01-01'), ('u2', 'name2', 'hash2', '02-14')").run();
  });

  t.afterEach(() => {
    if (db) db.close();
  });

  await t.test('1. searchMemories returns empty without hallucinations when searching non-existent memory', () => {
    const mem = searchMemories(db, '找一段关于潜水冲浪的回忆');
    assert.equal(mem.primaryMemory, null);
    assert.equal(mem.memoryRef, null);
  });

  await t.test('2. searchMemories retrieves real photo and constructs correct memoryRef', () => {
    db.prepare(`
      INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('p1', '/厦门旅行', 'sunset.jpg', 'uploads/photos/sunset.jpg', 'uploads/thumbnails/sunset.jpg', '海边看日落', '吹着晚风很舒服', '旅行,日落', 'name1', '2026-09-28 18:30:00');

    const mem = searchMemories(db, '海边看日落的那张照片');
    assert.ok(mem.primaryMemory, 'Must find memory');
    assert.equal(mem.primaryMemory.title, '海边看日落');
    assert.equal(mem.primaryMemory.location, '厦门旅行');
    assert.equal(mem.memoryRef.thumb, 'uploads/thumbnails/sunset.jpg');
    assert.equal(mem.memoryRef.url, 'uploads/photos/sunset.jpg');
    assert.equal(mem.memoryRef.type, 'photo');
  });

  await t.test('3. chatWithCoupleAgent generates message draft with whisper structure', async () => {
    const res = await chatWithCoupleAgent(db, '帮我写一句话', [], 'name1');
    assert.equal(res.success, true);
    assert.ok(res.reply.includes('留言短句'));
    assert.ok(res.draft, 'Must include draft');
    assert.equal(res.draft.type, 'whisper');
    assert.ok(Array.isArray(res.draft.options));
    assert.equal(res.draft.options.length, 3);
  });

  await t.test('4. chatWithCoupleAgent generates structured date plan draft', async () => {
    const res = await chatWithCoupleAgent(db, '想想周末怎么过', [], 'name1');
    assert.equal(res.success, true);
    assert.ok(res.reply.includes('周末漫步提案') || res.reply.includes('咖啡'));
    assert.ok(res.draft);
    assert.equal(res.draft.type, 'date_plan');
  });

  await t.test('5. chatWithCoupleAgent answers memory query with real record and memoryRef', async () => {
    db.prepare(`
      INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('p2', '/日常', 'cat.jpg', 'uploads/photos/cat.jpg', 'uploads/thumbnails/cat.jpg', '偶遇小花猫', '在路口趴着晒太阳', '日常,猫咪', 'name1', '2026-10-01 14:00:00');

    const res = await chatWithCoupleAgent(db, '找一段回忆', [], 'name1');
    assert.equal(res.success, true);
    assert.ok(res.reply.includes('偶遇小花猫'));
    assert.ok(res.reply.includes('2026.10.01'));
    assert.ok(res.memoryRef);
    assert.equal(res.memoryRef.id, 'p2');
    assert.equal(res.memoryRef.title, '偶遇小花猫');
    assert.equal(res.memoryRef.type, 'photo');
  });

  await t.test('6. chatWithCoupleAgent truthfully informs when specific memory is not found', async () => {
    const res = await chatWithCoupleAgent(db, '找找我们去滑雪的照片', [], 'name1');
    assert.equal(res.success, true);
    assert.ok(res.reply.includes('暂时还没有找到相关的记录') || res.reply.includes('没有找到'));
    assert.equal(res.memoryRef, null);
  });
});
