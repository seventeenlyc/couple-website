import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

test('Issue 1: 出示物品的弹窗层级与背包层叠修复验证', async (t) => {
  const cssPath = path.join(ROOT_DIR, 'desktop/css/desktop-gallery.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // 1. 验证 appDialogOverlay 具备最高层级 (9999)，避免被 backpackModal (3000) 遮挡
  assert.match(css, /#appDialogOverlay\s*\{\s*z-index:\s*9999;\s*\}/, 'CSS 中必须为 #appDialogOverlay 声明最高 z-index: 9999');

  const htmlPath = path.join(ROOT_DIR, 'desktop/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('id="appDialogOverlay"'), '页面中存在 appDialogOverlay');
  assert.ok(html.includes('id="backpackModal"'), '页面中存在 backpackModal');
  assert.ok(html.includes('style="z-index:9999;"'), 'appDialogOverlay 行内具备 9999 保险层级');

  const appJsPath = path.join(ROOT_DIR, 'desktop/js/app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');
  assert.ok(appJs.includes('triggerUseItem'), 'app.js 包含 triggerUseItem 函数');
  assert.ok(appJs.includes('confirmUseItem'), 'app.js 包含 confirmUseItem 函数');
});

test('Issue 2: 信件业务隔离验证 - 发送方主页不挂未读，接收方主页才挂未读，已读后立即消除', async (t) => {
  // 创建全新内存数据库进行真实接口与逻辑测试
  const db = new Database(':memory:');
  
  // 初始化 schema
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      partner_id TEXT,
      password_hash TEXT,
      created_at TEXT
    );
    CREATE TABLE whispers (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 插入一对情侣：用户 A (小林: user_a) 和 用户 B (小鹿: user_b)
  db.prepare("INSERT INTO users VALUES ('user_a', '小林', 'user_b', null, datetime('now'))").run();
  db.prepare("INSERT INTO users VALUES ('user_b', '小鹿', 'user_a', null, datetime('now'))").run();

  const { sendWhisper, checkUnreadWhispers, getWhisperHistory, markWhispersRead } = await import('../src/modules/whispers/whisper.service.js');

  // 1. 用户 A (小林) 写了一封信发给 用户 B (小鹿)
  const sendRes = sendWhisper(db, 'user_a', '小鹿，这是我想对你说的第一封悄悄话');
  assert.equal(sendRes.success, true);
  const whisperId = sendRes.whisper.id;

  // 2. 检查发送方 用户 A (小林) 的未读信件检查：
  // 核心：用户 A 自己写的信，绝对不能算在用户 A 自己的未读信件里！
  const unreadA = checkUnreadWhispers(db, 'user_a');
  assert.equal(unreadA.has_unread, false, '发送方 A 的未读信件应该为 0');
  assert.equal(unreadA.count, 0, '发送方 A 的未读信件数量必须为 0');

  // 3. 检查发送方 用户 A (小林) 的信箱历史记录：
  // 历史记录中这封信必须被明确标记为 is_from_me = true, unread_for_me = false
  const historyA = getWhisperHistory(db, 'user_a');
  assert.equal(historyA.whispers.length, 1);
  assert.equal(historyA.whispers[0].is_from_me, true, '对 A 而言是自己寄出的信');
  assert.equal(historyA.whispers[0].is_to_me, false, '对 A 而言不是发给自己的信');
  assert.equal(historyA.whispers[0].unread_for_me, false, '对 A 而言绝不是未读信件！');

  // 4. 检查接收方 用户 B (小鹿) 的未读信件检查：
  // 核心：这封信必须准确挂在接收方 用户 B 的主页上！
  const unreadB = checkUnreadWhispers(db, 'user_b');
  assert.equal(unreadB.has_unread, true, '接收方 B 的主页必须有未读提示');
  assert.equal(unreadB.count, 1, '接收方 B 的未读信件数量为 1');
  assert.equal(unreadB.whispers[0].id, whisperId);

  // 5. 检查接收方 用户 B (小鹿) 的信箱历史记录：
  const historyB = getWhisperHistory(db, 'user_b');
  assert.equal(historyB.whispers.length, 1);
  assert.equal(historyB.whispers[0].is_from_me, false, '对 B 而言是对方发来的信');
  assert.equal(historyB.whispers[0].is_to_me, true, '对 B 而言是发给自己的信');
  assert.equal(historyB.whispers[0].unread_for_me, true, '对 B 而言是未读信件！');

  // 6. 接收方 用户 B (小鹿) 阅读信件并标记已读
  const markRes = markWhispersRead(db, 'user_b', whisperId);
  assert.equal(markRes.success, true);

  // 7. 再次检查接收方 用户 B 的未读状态：
  // 核心：已读后，这封信立即从主页未读提示中消失，不再挂在主页！
  const unreadBAfter = checkUnreadWhispers(db, 'user_b');
  assert.equal(unreadBAfter.has_unread, false, 'B 阅读后未读提示立即消除');
  assert.equal(unreadBAfter.count, 0, 'B 的未读信件数量变为 0');

  const historyBAfter = getWhisperHistory(db, 'user_b');
  assert.equal(historyBAfter.whispers[0].read, true, '已读标记为 true');
  assert.equal(historyBAfter.whispers[0].unread_for_me, false, '已读后不再为未读');

  // 8. 前端逻辑：无未读信件时 banner 必须 display: none，彻底不挂在主页
  const desktopAppJs = fs.readFileSync(path.join(ROOT_DIR, 'desktop/js/app.js'), 'utf8');
  assert.ok(desktopAppJs.includes("banner.style.display = 'none'"), '无未读信件时主页 banner 必须隐藏');
  assert.ok(desktopAppJs.includes("banner.style.display = 'flex'"), '有未读来信时主页 banner 展示');

  db.close();
});
