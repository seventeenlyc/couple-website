import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { initDb, closeDb } from '../src/storage/db.js';
import fs from 'node:fs';
import path from 'node:path';

class TestClient {
  constructor(app) {
    this.app = app;
    this.cookies = {};
    this.csrfToken = '';
  }

  async request(opts) {
    const headers = { ...(opts.headers || {}) };
    if (Object.keys(this.cookies).length > 0) {
      headers.cookie = Object.entries(this.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    if (this.csrfToken && !headers['x-csrf-token'] && ['POST', 'PUT', 'DELETE'].includes((opts.method || 'GET').toUpperCase())) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    const res = await this.app.inject({
      ...opts,
      headers
    });

    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const str of arr) {
        const parts = str.split(';')[0].split('=');
        if (parts.length >= 2) {
          this.cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      }
    }

    return res;
  }

  async get(url, headers = {}) {
    return this.request({ method: 'GET', url, headers });
  }

  async post(url, payload = {}, headers = {}) {
    return this.request({
      method: 'POST',
      url,
      payload: { ...payload, csrf_token: payload.csrf_token || this.csrfToken },
      headers
    });
  }

  async initSession() {
    const res = await this.get('/api/csrf-token.php');
    const json = JSON.parse(res.body);
    this.csrfToken = json.csrf_token;
    return json;
  }
}

test('H5 Mobile Gallery Full Backend API Integration Suite', async (t) => {
  const testDbDir = path.resolve('tests/test-h5-db');
  fs.mkdirSync(testDbDir, { recursive: true });
  const testDbPath = path.join(testDbDir, 'h5-test.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = initDb(testDbPath);

  // Setup test couple users: 拾柒 (boy/admin) & 小鹿 (girl/member)
  db.prepare(`
    INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance, birthday, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('u_boy', '拾柒', '', 'priv123', 'u_girl', 520, '01-01', 'assets/images/avatar/boy.png');

  db.prepare(`
    INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance, birthday, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('u_girl', '小鹿', '', 'priv456', 'u_boy', 520, '11-12', 'assets/images/avatar/girl.png');

  db.prepare(`
    INSERT INTO site_config (key, value) VALUES ('startDate', '2025-04-30')
  `).run();

  db.prepare(`
    INSERT INTO site_config (key, value) VALUES ('specialDates', '{"anniversary":{"date":"04-30","name":"恋爱纪念日","discount":0.6},"birthdays":[{"date":"11-12","name":"小鹿生日","discount":0.6}]}')
  `).run();

  // Add a task
  db.prepare(`
    INSERT INTO tasks (id, title, description, reward, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run('task_1', '周末一起去海边散步看落日', '远离屏幕，走走散心', 20, 1);

  // Add shop product
  db.prepare(`
    INSERT INTO products (id, name, description, price, stock, is_active, category)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('p_hug', '温暖拥抱券', '随时发起一个超过30秒的温暖拥抱', 50, 999, 1, 'virtual');

  const app = await buildApp({
    db,
    dbPath: testDbPath,
    secureCookie: false
  });

  const boyClient = new TestClient(app);
  const girlClient = new TestClient(app);

  await t.test('1. Static assets for H5 mobile application are served cleanly', async () => {
    const htmlRes = await boyClient.get('/h5/index.html');
    assert.equal(htmlRes.statusCode, 200);
    assert.match(htmlRes.headers['content-type'], /text\/html/);

    const cssRes = await boyClient.get('/h5/css/gallery-h5.css');
    assert.equal(cssRes.statusCode, 200);
    assert.match(cssRes.headers['content-type'], /text\/css/);

    const jsApiRes = await boyClient.get('/h5/js/api-client.js');
    assert.equal(jsApiRes.statusCode, 200);
    assert.match(jsApiRes.headers['content-type'], /application\/javascript/);

    const jsAppRes = await boyClient.get('/h5/js/app.js');
    assert.equal(jsAppRes.statusCode, 200);
    assert.match(jsAppRes.headers['content-type'], /application\/javascript/);
  });

  await t.test('2. Authentication establishing session for boy and girl', async () => {
    await boyClient.initSession();
    const loginBoy = await boyClient.post('/api/login.php', {
      you: '拾柒',
      baby: '小鹿'
    });
    assert.equal(loginBoy.statusCode, 200);
    const boyJson = JSON.parse(loginBoy.body);
    assert.equal(boyJson.success, true);

    await girlClient.initSession();
    const loginGirl = await girlClient.post('/api/login.php', {
      you: '小鹿',
      baby: '拾柒'
    });
    assert.equal(loginGirl.statusCode, 200);
    const girlJson = JSON.parse(loginGirl.body);
    assert.equal(girlJson.success, true);
  });

  await t.test('3. App config, anniversary reminders, and daily quote APIs', async () => {
    const cfgRes = await boyClient.get('/api/app-config.php');
    assert.equal(cfgRes.statusCode, 200);
    const cfg = JSON.parse(cfgRes.body);
    assert.equal(cfg.success, true);
    assert.equal(cfg.startDate, '2025-04-30');
    assert.ok(cfg.love_days > 0);

    const quoteRes = await boyClient.get('/api/daily-quote.php');
    assert.equal(quoteRes.statusCode, 200);
    const quote = JSON.parse(quoteRes.body);
    assert.equal(quote.success, true);
    assert.ok(typeof quote.quote === 'string');

    const remRes = await boyClient.get('/api/anniversary-reminders.php');
    assert.equal(remRes.statusCode, 200);
    const rem = JSON.parse(remRes.body);
    assert.equal(rem.success, true);
    assert.ok(Array.isArray(rem.reminders));
  });

  await t.test('4. Balance, checkin, tasks and economy workflows', async () => {
    // Balance
    const balRes = await boyClient.get('/api/balance.php');
    assert.equal(balRes.statusCode, 200);
    const bal = JSON.parse(balRes.body);
    assert.equal(bal.balance, 520);

    // Checkin
    const chkRes = await boyClient.post('/api/checkin.php');
    assert.equal(chkRes.statusCode, 200);
    const chk = JSON.parse(chkRes.body);
    assert.equal(chk.success, true);
    assert.equal(chk.reward, 10);
    assert.equal(chk.balance, 530);

    // Tasks list
    const tasksRes = await boyClient.get('/api/tasks.php?action=get_today');
    assert.equal(tasksRes.statusCode, 200);
    const tasksData = JSON.parse(tasksRes.body);
    assert.equal(tasksData.success, true);
    assert.ok(tasksData.tasks.length > 0);
    const firstTask = tasksData.tasks[0];

    // Boy completes task
    const markRes = await boyClient.post('/api/tasks.php?action=mark_complete', {
      task_id: firstTask.id
    });
    assert.equal(markRes.statusCode, 200);

    // Girl confirms task
    const confirmRes = await girlClient.post('/api/tasks.php?action=confirm_partner', {
      task_id: firstTask.id
    });
    assert.equal(confirmRes.statusCode, 200);
    const confJson = JSON.parse(confirmRes.body);
    assert.equal(confJson.success, true);
  });

  await t.test('5. Shop purchase and virtual items inventory', async () => {
    const shopRes = await boyClient.get('/api/shop.php?action=get_all');
    assert.equal(shopRes.statusCode, 200);
    const shopData = JSON.parse(shopRes.body);
    assert.equal(shopData.success, true);
    assert.ok(shopData.products.length > 0);

    const buyRes = await boyClient.post('/api/shop.php?action=buy', {
      product_id: 'p_hug'
    });
    assert.equal(buyRes.statusCode, 200);
    const buyJson = JSON.parse(buyRes.body);
    assert.equal(buyJson.success, true);

    const bagRes = await boyClient.get('/api/virtual-items.php?action=get_my_items');
    assert.equal(bagRes.statusCode, 200);
    const bagJson = JSON.parse(bagRes.body);
    assert.equal(bagJson.success, true);
    assert.ok(bagJson.items.length > 0);
  });

  await t.test('6. Whispers / Letters read and write', async () => {
    // Boy sends whisper
    const sendRes = await boyClient.post('/api/whispers.php?action=send', {
      content: '海边的风很轻，有你在身边真好。'
    });
    assert.equal(sendRes.statusCode, 200);

    // Girl checks unread
    const unreadRes = await girlClient.get('/api/whispers.php?action=check_unread');
    assert.equal(unreadRes.statusCode, 200);
    const unreadJson = JSON.parse(unreadRes.body);
    assert.equal(unreadJson.has_unread, true);

    // Girl marks read
    const historyRes = await girlClient.get('/api/whispers.php?action=get_history');
    const histJson = JSON.parse(historyRes.body);
    assert.ok(histJson.whispers.length > 0);
    const wid = histJson.whispers[0].id;

    const readRes = await girlClient.post('/api/whispers.php?action=mark_read', {
      whisper_id: wid
    });
    assert.equal(readRes.statusCode, 200);
  });

  await t.test('7. Story Timeline events creation and listing', async () => {
    const createRes = await boyClient.post('/api/story.php', {
      title: '环岛路漫步看落日',
      content: '那天没有计划，只是牵着手走了很久很久。',
      event_date: '2026-09-28'
    });
    assert.equal(createRes.statusCode, 200);

    const listRes = await boyClient.get('/api/story.php');
    assert.equal(listRes.statusCode, 200);
    const listJson = JSON.parse(listRes.body);
    assert.equal(listJson.success, true);
    assert.ok(listJson.events.some(e => e.title === '环岛路漫步看落日'));
  });

  await t.test('8. Private space verification and encrypted notes', async () => {
    const authRes = await boyClient.post('/api/private-auth.php', {
      action: 'verify',
      password: 'priv123'
    });
    assert.equal(authRes.statusCode, 200);
    const authJson = JSON.parse(authRes.body);
    assert.equal(authJson.authenticated, true);

    const addNote = await boyClient.post('/api/private-notes.php', {
      action: 'add',
      title: '秘密旅行心愿单',
      content: '1. 去看雪山\n2. 去吃热腾腾的寿喜烧'
    });
    assert.equal(addNote.statusCode, 200);

    const listNotes = await boyClient.post('/api/private-notes.php', {
      action: 'list'
    });
    assert.equal(listNotes.statusCode, 200);
    const notesJson = JSON.parse(listNotes.body);
    assert.equal(notesJson.success, true);
    assert.ok(notesJson.notes.some(n => n.title === '秘密旅行心愿单'));

    const noteToDelete = notesJson.notes.find(n => n.title === '秘密旅行心愿单');
    assert.ok(noteToDelete);
    const delRes = await boyClient.post('/api/private-notes.php', {
      action: 'delete',
      note_id: noteToDelete.id
    });
    assert.equal(delRes.statusCode, 200);
    const delJson = JSON.parse(delRes.body);
    assert.equal(delJson.success, true);
  });

  await t.test('9. Device security status inspection', async () => {
    const devRes = await boyClient.post('/api/devices.php', {
      action: 'status'
    });
    assert.equal(devRes.statusCode, 200);
    const devJson = JSON.parse(devRes.body);
    assert.equal(devJson.success, true);
  });

  await app.close();
  closeDb();
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (_) {}
  }
});
