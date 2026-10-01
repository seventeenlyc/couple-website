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

test('Economy System: Wallet, Checkin, Tasks, Shop, and Virtual Items', async (t) => {
  const testDbPath = path.join(__dirname, 'test-economy.db');
  closeDb();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const app = await buildApp({
    dbPath: testDbPath,
    secureCookie: false
  });
  const db = app.db;

  const pwdHash = bcrypt.hashSync('pass123', 10);
  db.prepare(`
    INSERT INTO users (id, username, password_hash, partner_id, birthday, balance)
    VALUES ('u_boy', '男孩', ?, 'u_girl', '01-01', 500)
  `).run(pwdHash);
  db.prepare(`
    INSERT INTO users (id, username, password_hash, partner_id, birthday, balance)
    VALUES ('u_girl', '女孩', ?, 'u_boy', '02-14', 500)
  `).run(pwdHash);

  // Site config
  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('startDate', '2025-02-05')");
  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('specialDates', ?)").run(
    JSON.stringify({
      anniversary: { date: '02-05', name: '纪念日', discount: 0.5 },
      birthdays: [{ date: '01-01', name: '男孩生日', discount: 0.6 }]
    })
  );

  // Products
  db.prepare(`
    INSERT INTO products (id, name, description, price, category, stock, image, sort_order)
    VALUES ('p_hug', '抱抱券', '可以随时索要抱抱', 50, 'virtual', 10, 'assets/hug.png', 1)
  `).run();
  db.prepare(`
    INSERT INTO products (id, name, description, price, category, stock, image, sort_order)
    VALUES ('p_expensive', '昂贵礼物', '昂贵的限定商品', 1000, 'physical', 1, 'assets/gift.png', 2)
  `).run();

  // Tasks
  db.prepare(`
    INSERT INTO tasks (id, title, description, reward, category, sort_order)
    VALUES ('t_walk', '一起散步', '晚饭后散步30分钟', 20, 'daily', 1)
  `).run();

  t.after(async () => {
    await app.close();
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
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

  const boy = new MockBrowser();
  const girl = new MockBrowser();
  await boy.login('男孩', '女孩');
  await girl.login('女孩', '男孩');

  await t.test('Daily checkin rewards user and blocks duplicate checkin today', async () => {
    // Initial balance check
    const bRes = await boy.request({ method: 'GET', url: '/api/balance.php' });
    assert.equal(bRes.statusCode, 200);
    assert.equal(bRes.json().balance, 500);
    assert.equal(bRes.json().checked_in_today, false);

    // Perform checkin
    const chkRes = await boy.request({
      method: 'POST',
      url: '/api/checkin.php',
      payload: { csrf_token: boy.csrf }
    });
    assert.equal(chkRes.statusCode, 200);
    const chkJson = chkRes.json();
    assert.ok(chkJson.success);
    assert.equal(chkJson.reward, 10);
    assert.equal(chkJson.streak_days, 1);
    assert.equal(chkJson.balance, 510);

    // Duplicate checkin on same day is rejected
    const dupRes = await boy.request({
      method: 'POST',
      url: '/api/checkin.php',
      payload: { csrf_token: boy.csrf }
    });
    assert.equal(dupRes.statusCode, 400);
    assert.equal(dupRes.json().already_checked_in, true);

    // Balance now reflects checkin
    const afterRes = await boy.request({ method: 'GET', url: '/api/balance.php' });
    assert.equal(afterRes.json().balance, 510);
    assert.equal(afterRes.json().checked_in_today, true);
    assert.equal(afterRes.json().total_earned, 10);
  });

  let dailyInstanceId = '';

  await t.test('Daily tasks: fetch, complete by boy, confirm by partner grants mutual reward', async () => {
    const tasksRes = await boy.request({ method: 'GET', url: '/api/tasks.php?action=get_today' });
    assert.equal(tasksRes.statusCode, 200);
    const tasks = tasksRes.json().tasks;
    assert.ok(tasks.length > 0);
    dailyInstanceId = tasks[0].id;
    assert.equal(tasks[0].state, 'pending');

    // Boy completes task
    const markRes = await boy.request({
      method: 'POST',
      url: '/api/tasks.php',
      payload: { action: 'mark_complete', task_id: dailyInstanceId, csrf_token: boy.csrf }
    });
    assert.ok(markRes.json().success);

    // Boy sees state is my_completed
    const boyView = await boy.request({ method: 'GET', url: '/api/tasks.php?action=get_today' });
    const boyTask = boyView.json().tasks.find(t => t.id === dailyInstanceId);
    assert.equal(boyTask.state, 'my_completed');

    // Girl sees state is pending_partner
    const girlView = await girl.request({ method: 'GET', url: '/api/tasks.php?action=get_today' });
    const girlTask = girlView.json().tasks.find(t => t.id === dailyInstanceId);
    assert.equal(girlTask.state, 'pending_partner');

    // Girl confirms task
    const confirmRes = await girl.request({
      method: 'POST',
      url: '/api/tasks.php',
      payload: { action: 'confirm_partner', task_id: dailyInstanceId, csrf_token: girl.csrf }
    });
    assert.ok(confirmRes.json().success);
    assert.equal(confirmRes.json().reward, 20);

    // Both received 20 coins
    const boyBal = await boy.request({ method: 'GET', url: '/api/balance.php' });
    assert.equal(boyBal.json().balance, 530); // 510 + 20

    const girlBal = await girl.request({ method: 'GET', url: '/api/balance.php' });
    assert.equal(girlBal.json().balance, 520); // 500 + 20

    // Task is now marked done for both
    const finalView = await boy.request({ method: 'GET', url: '/api/tasks.php?action=get_today' });
    assert.equal(finalView.json().tasks.find(t => t.id === dailyInstanceId).state, 'done');
  });

  let purchasedOrderId = '';
  let virtualItemId = '';

  await t.test('Shop: purchase product, inventory creation, stock deduction, and idempotency', async () => {
    // 1. Insufficient balance fails
    const failBuy = await boy.request({
      method: 'POST',
      url: '/api/shop.php',
      payload: { action: 'buy', product_id: 'p_expensive', csrf_token: boy.csrf }
    });
    assert.equal(failBuy.statusCode, 400);
    assert.equal(failBuy.json().message, '爱心币不足');

    // 2. Successful purchase of virtual item
    const buyRes = await boy.request({
      method: 'POST',
      url: '/api/shop.php',
      payload: {
        action: 'buy',
        product_id: 'p_hug',
        idempotency_key: 'idem_key_123',
        csrf_token: boy.csrf
      }
    });
    assert.equal(buyRes.statusCode, 200);
    const buyJson = buyRes.json();
    assert.ok(buyJson.success);
    purchasedOrderId = buyJson.order_id;
    assert.ok(purchasedOrderId);

    // Balance deducted: was 530, item is 50 -> 480
    assert.equal(buyJson.balance, 480);

    // Stock was 10, now 9
    const prod = db.prepare('SELECT stock FROM products WHERE id = ?').get('p_hug');
    assert.equal(prod.stock, 9);

    // Idempotent retry with same key does not deduct again
    const retryRes = await boy.request({
      method: 'POST',
      url: '/api/shop.php',
      payload: {
        action: 'buy',
        product_id: 'p_hug',
        idempotency_key: 'idem_key_123',
        csrf_token: boy.csrf
      }
    });
    assert.equal(retryRes.statusCode, 200);
    assert.equal(retryRes.json().balance, 480); // still 480!

    // Check virtual items in backpack
    const vitemsRes = await boy.request({ method: 'GET', url: '/api/virtual-items.php?action=get_my_items' });
    assert.equal(vitemsRes.statusCode, 200);
    const vitems = vitemsRes.json().items;
    assert.equal(vitems.length, 1);
    assert.equal(vitems[0].name, '抱抱券');
    assert.equal(vitems[0].status, 'unused');
    virtualItemId = vitems[0].id;

    // Check orders list
    const ordersRes = await boy.request({ method: 'GET', url: '/api/orders.php?action=get_my_orders' });
    assert.equal(ordersRes.json().orders.length, 1);
    assert.equal(ordersRes.json().orders[0].product_name, '抱抱券');
  });

  await t.test('Virtual item workflow: use by boy, confirmed by girl', async () => {
    // Boy requests use
    const useRes = await boy.request({
      method: 'POST',
      url: '/api/virtual-items.php',
      payload: { action: 'use', item_id: virtualItemId, csrf_token: boy.csrf }
    });
    assert.ok(useRes.json().success);

    // Girl confirms use
    const confirmRes = await girl.request({
      method: 'POST',
      url: '/api/virtual-items.php',
      payload: { action: 'confirm_use', item_id: virtualItemId, csrf_token: girl.csrf }
    });
    assert.ok(confirmRes.json().success);

    // Status is now used
    const vitemsRes = await boy.request({ method: 'GET', url: '/api/virtual-items.php?action=get_my_items' });
    assert.equal(vitemsRes.json().items[0].status, 'used');
  });

  await t.test('Product reviews: purchaser can review, non-purchaser cannot', async () => {
    // Girl hasn't purchased p_hug, so review fails
    const girlReview = await girl.request({
      method: 'POST',
      url: '/api/reviews.php',
      payload: {
        action: 'add',
        product_id: 'p_hug',
        rating: 5,
        content: '特别温暖',
        csrf_token: girl.csrf
      }
    });
    assert.equal(girlReview.statusCode, 400);

    // Boy has purchased p_hug, review succeeds
    const boyReview = await boy.request({
      method: 'POST',
      url: '/api/reviews.php',
      payload: {
        action: 'add',
        product_id: 'p_hug',
        rating: 5,
        content: '超级喜欢这个抱抱券！',
        csrf_token: boy.csrf
      }
    });
    assert.equal(boyReview.statusCode, 200);
    assert.ok(boyReview.json().success);

    // Check reviews list
    const listReviews = await girl.request({ method: 'GET', url: '/api/reviews.php?action=get_by_product&product_id=p_hug' });
    assert.equal(listReviews.json().reviews.length, 1);
    assert.equal(listReviews.json().reviews[0].content, '超级喜欢这个抱抱券！');
  });
});
