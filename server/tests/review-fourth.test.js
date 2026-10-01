import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';
import { confirmVirtualItemUse } from '../src/modules/shop/shop.service.js';
import { getTodayDateString } from '../src/utils/date.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Regression coverage for the fourth review round:
//   FOURTH-002 legacy album/private folder paths stored without a leading slash
//   FOURTH-003 story.html form + summary + photo object contract
//   FOURTH-004 virtual item use must be confirmed by the partner, not the owner
test('FOURTH-002/003/004: legacy paths, story page contract, virtual item confirmation', async (t) => {
  const workDir = path.join(__dirname, 'test-fourth-review');
  const dbPath = path.join(workDir, 'fixture.db');
  const uploadsDir = path.join(workDir, 'uploads');
  const rootDir = workDir;
  const today = getTodayDateString();
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
    'base64'
  );

  closeDb();
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(uploadsDir, 'photos'), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, 'photos', 'audit.png'), pixel);

  const app = await buildApp({ dbPath, rootDir, uploadsDir, secureCookie: false });
  const db = app.db;

  const hash = bcrypt.hashSync('pass123', 10);
  const privHash = bcrypt.hashSync('priv123', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance) VALUES (?,?,?,?,?,?)')
    .run('u1', '拾柒', hash, privHash, 'u2', 1000);
  db.prepare('INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance) VALUES (?,?,?,?,?,?)')
    .run('u2', '伴侣', hash, privHash, 'u1', 1000);
  db.prepare('INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance) VALUES (?,?,?,?,?,?)')
    .run('u3', '路人', hash, privHash, null, 1000);
  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('startDate', '2025-02-05')");
  db.prepare("INSERT INTO products (id, name, description, price, category, stock) VALUES ('p_virtual', '抱抱券', '兑换一个抱抱', 20, 'virtual', 10)").run();
  db.prepare(`
    INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, uploaded_by, created_at)
    VALUES ('p_root', '/', 'audit.png', 'uploads/photos/audit.png', 'uploads/photos/audit.png', '测试照片', '拾柒', ?)
  `).run(`${today} 12:00:00`);

  t.after(async () => {
    await app.close();
    closeDb();
    if (fs.existsSync(workDir)) {
      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  class Browser {
    constructor() { this.cookies = {}; this.csrf = ''; }
    async request(method, url, payload, headers = {}) {
      const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await app.inject({
        method,
        url,
        payload,
        headers: { ...headers, ...(cookie ? { cookie } : {}) }
      });
      for (const val of [].concat(res.headers['set-cookie'] || [])) {
        const m = String(val).match(/^([^=]+)=([^;]*)/);
        if (m) this.cookies[m[1]] = m[2];
      }
      return res;
    }
    async login(you, baby) {
      this.csrf = (await this.request('GET', '/api/csrf-token.php')).json().csrf_token;
      const res = await this.request('POST', '/api/login.php', {
        you, baby, password: 'pass123', csrf_token: this.csrf
      });
      assert.ok(res.json().success, `fixture login failed: ${res.body}`);
    }
    post(url, body) { return this.request('POST', url, { ...body, csrf_token: this.csrf }); }
    get(url) { return this.request('GET', url); }
  }

  const user1 = new Browser();
  const user2 = new Browser();
  await user1.login('拾柒', '伴侣');
  await user2.login('伴侣', '拾柒');

  function multipartPayload(fields, file) {
    const boundary = '----FourthReviewBoundary';
    const chunks = [];
    for (const [name, value] of Object.entries(fields)) {
      chunks.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    }
    if (file) {
      chunks.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n`
      ));
      chunks.push(file.buffer);
      chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return {
      payload: Buffer.concat(chunks),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }
    };
  }

  // ---------------------------------------------------------------- FOURTH-002
  await t.test('legacy folder subtree count includes children stored without a leading slash', () => {
    db.prepare("INSERT INTO album_folders (id, context, name, path, parent_path) VALUES ('legacy_parent', 'album', 'legacy', 'legacy', '')").run();
    db.prepare("INSERT INTO album_folders (id, context, name, path, parent_path) VALUES ('legacy_child', 'album', 'child', 'legacy/child', 'legacy')").run();

    const view = db.prepare('INSERT INTO album_photos (id, folder_path, filename, original_path, uploaded_by) VALUES (?,?,?,?,?)');
    view.run('p_legacy', 'legacy/child', 'a.png', 'uploads/photos/audit.png', '拾柒');
    view.run('p_sibling', '/legacy/child', 'b.png', 'uploads/photos/audit.png', '拾柒');

    return user1.get('/api/folders.php?action=list&context=album&path=').then(res => {
      const legacy = res.json().folders.find(f => f.id === 'legacy_parent');
      assert.ok(legacy, 'legacy parent folder must be listed at the root');
      assert.equal(legacy.path, 'legacy');
      assert.equal(legacy.file_count, 2);
    });
  });

  await t.test('legacy folder delete removes descendants and moves its photos to the root', async () => {
    const res = await user1.post('/api/folders.php?action=delete&context=album', { folder_path: 'legacy' });
    assert.equal(res.json().success, true);

    assert.equal(db.prepare('SELECT id FROM album_folders WHERE id = ?').get('legacy_child'), undefined);
    assert.equal(db.prepare('SELECT id FROM album_folders WHERE id = ?').get('legacy_parent'), undefined);

    for (const id of ['p_legacy', 'p_sibling']) {
      const row = db.prepare('SELECT folder_path FROM album_photos WHERE id = ?').get(id);
      assert.ok(row, `${id} must survive the folder delete`);
      assert.ok(['', '/'].includes(row.folder_path), `${id} must move to the root, got ${row.folder_path}`);
    }

    // The wildcard isolation fix from the previous round must keep working.
    db.prepare("INSERT INTO album_folders (id, context, name, path, parent_path) VALUES ('wd_parent', 'album', 'A_B', '/A_B', '/')").run();
    db.prepare("INSERT INTO album_folders (id, context, name, path, parent_path) VALUES ('wd_other', 'album', 'AXB', '/AXB', '/')").run();
    db.prepare("INSERT INTO album_folders (id, context, name, path, parent_path) VALUES ('wd_child', 'album', 'child', '/AXB/child', '/AXB')").run();
    await user1.post('/api/folders.php?action=delete&context=album', { folder_path: '/A_B' });
    assert.ok(db.prepare('SELECT id FROM album_folders WHERE id = ?').get('wd_child'), 'unrelated folder must not be deleted');
    db.prepare("DELETE FROM album_folders WHERE id IN ('wd_parent','wd_other','wd_child')").run();
  });

  await t.test('renaming a folder relocates photos uploaded with the page path format', async () => {
    const created = await user1.post('/api/folders.php?action=create&context=album', { name: 'normal_upload', parent_path: '' });
    assert.equal(created.json().success, true);
    assert.equal(db.prepare("SELECT path FROM album_folders WHERE name = 'normal_upload'").get().path, '/normal_upload');

    // album.html sends all_folders paths without a leading slash (normalized in list responses).
    const allFolders = (await user1.get('/api/folders.php?action=list&context=album&path=&include_all_folders=1')).json().all_folders;
    const option = allFolders.find(f => f.name === 'normal_upload');
    assert.equal(option.path, 'normal_upload');

    db.prepare('UPDATE album_photos SET folder_path = ? WHERE id = ?').run('normal_upload', 'p_legacy');

    const renamed = await user1.post('/api/folders.php?action=rename&context=album', {
      folder_path: 'normal_upload',
      new_name: 'renamed_upload'
    });
    assert.equal(renamed.json().success, true);

    const photo = db.prepare('SELECT folder_path FROM album_photos WHERE id = ?').get('p_legacy');
    assert.ok(['renamed_upload', '/renamed_upload'].includes(photo.folder_path), `photo left behind at ${photo.folder_path}`);

    // The renamed folder must be navigable: list its new path and see the photo.
    const listing = (await user1.get(`/api/folders.php?action=list&context=album&path=${photo.folder_path.replace(/^\//, '')}`)).json();
    assert.ok(listing.files.some(f => f.id === 'p_legacy'), 'photo must be visible in the renamed folder');

    db.prepare("DELETE FROM album_folders WHERE name = 'renamed_upload'").run();
    db.prepare("UPDATE album_photos SET folder_path = '/' WHERE id = 'p_legacy'").run();
  });

  await t.test('private space delete and rename also match legacy paths', async () => {
    const unlock = await user1.post('/api/private-auth.php', { action: 'verify', password: 'priv123' });
    assert.ok(unlock.json().success);

    db.prepare("INSERT INTO album_folders (id, context, user_id, name, path, parent_path) VALUES ('pf_root', 'private', 'u1', 'priv', 'priv', '')").run();
    db.prepare("INSERT INTO album_folders (id, context, user_id, name, path, parent_path) VALUES ('pf_child', 'private', 'u1', 'child', 'priv/child', 'priv')").run();
    db.prepare(`
      INSERT INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, size)
      VALUES ('priv_file', 'u1', 'priv/child', 'secret.txt', 'secret.txt', 'uploads/private/u1/secret.txt', 1)
    `).run();

    const counted = (await user1.get('/api/folders.php?action=list&context=private&path=')).json();
    assert.equal(counted.folders.find(f => f.id === 'pf_root').file_count, 1);

    const renamed = await user1.post('/api/folders.php?action=rename&context=private', {
      folder_path: 'priv/child',
      new_name: 'renamed_child'
    });
    assert.equal(renamed.json().success, true);
    const file = db.prepare('SELECT folder_path FROM private_files WHERE id = ?').get('priv_file');
    assert.ok(['priv/renamed_child', '/priv/renamed_child'].includes(file.folder_path), `private file left behind at ${file.folder_path}`);

    const deleted = await user1.post('/api/folders.php?action=delete&context=private', { folder_path: 'priv' });
    assert.equal(deleted.json().success, true);
    assert.equal(db.prepare('SELECT id FROM album_folders WHERE id = ?').get('pf_child'), undefined);
    const afterDelete = db.prepare('SELECT folder_path FROM private_files WHERE id = ?').get('priv_file');
    assert.ok(['', '/'].includes(afterDelete.folder_path), `private file must return to the root, got ${afterDelete.folder_path}`);
  });

  // ---------------------------------------------------------------- FOURTH-003
  await t.test('story GET returns the summary fields story.html renders', async () => {
    const story = (await user1.get('/api/story.php')).json();
    assert.ok(story.summary, 'summary object is required by story.html');
    assert.equal(story.summary.start_date, '2025-02-05');
    assert.equal(story.summary.today, today);
    assert.equal(typeof story.summary.total_days, 'number');
    assert.equal(typeof story.summary.years, 'number');
    assert.equal(typeof story.summary.months, 'number');
    assert.equal(typeof story.summary.days, 'number');
    assert.equal(story.summary.event_count, story.events.length);

    const uploadEvent = story.events.find(e => e.source === 'upload' || e.type === 'upload');
    assert.ok(uploadEvent, 'the album photo must produce an upload event');
    assert.equal(uploadEvent.type, 'upload');
    assert.equal(typeof uploadEvent.photos[0], 'object');
    assert.ok(uploadEvent.photos[0].path, 'photo objects need a path');
    assert.ok(uploadEvent.photos[0].thumb_path, 'photo objects need a thumb_path');
    assert.equal(typeof uploadEvent.photos[0].title, 'string');
  });

  await t.test('story multipart form without a photo creates a manual event', async () => {
    const { payload, headers } = multipartPayload({
      title: '第四轮故事',
      date: '2026-09-30',
      content: '隔离测试内容',
      csrf_token: user1.csrf
    });
    const res = await user1.request('POST', '/api/story.php', payload, headers);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().success, true);

    const story = (await user1.get('/api/story.php')).json();
    const created = story.events.find(e => e.title === '第四轮故事');
    assert.ok(created, 'the event must survive a reload');
    assert.equal(created.date, '2026-09-30');
    assert.equal(created.type, 'manual');
    assert.equal(created.photos.length, 0);
    // story.html prints created_by verbatim ("由 X 贴上").
    assert.equal(created.created_by, '拾柒');

    db.prepare("DELETE FROM story_events WHERE title = '第四轮故事'").run();
  });

  await t.test('story multipart form with a photo stores a photo object', async () => {
    const { payload, headers } = multipartPayload({
      title: '带照片的故事',
      date: '2026-09-29',
      content: '一张照片',
      csrf_token: user1.csrf
    }, {
      field: 'photo',
      filename: 'pixel.png',
      contentType: 'image/png',
      buffer: pixel
    });

    const res = await user1.request('POST', '/api/story.php', payload, headers);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().success, true);

    const story = (await user1.get('/api/story.php')).json();
    const created = story.events.find(e => e.title === '带照片的故事');
    assert.ok(created);
    assert.equal(created.photos.length, 1);
    assert.equal(typeof created.photos[0], 'object');
    assert.match(created.photos[0].path, /^uploads\/story\//);
    assert.ok(fs.existsSync(path.join(rootDir, created.photos[0].path)), 'uploaded story photo must exist on disk');

    db.prepare("DELETE FROM story_events WHERE title = '带照片的故事'").run();
    const storyDir = path.join(uploadsDir, 'story');
    if (fs.existsSync(storyDir)) fs.rmSync(storyDir, { recursive: true, force: true });
  });

  await t.test('story multipart form rejects an invalid date and an empty submission', async () => {
    const badDate = multipartPayload({
      title: '坏日期', date: '2026-02-30', content: 'x', csrf_token: user1.csrf
    });
    const badDateRes = await user1.request('POST', '/api/story.php', badDate.payload, badDate.headers);
    assert.equal(badDateRes.statusCode, 400, badDateRes.body);

    const empty = multipartPayload({
      title: '', date: '2026-09-28', content: '', csrf_token: user1.csrf
    });
    const emptyRes = await user1.request('POST', '/api/story.php', empty.payload, empty.headers);
    assert.equal(emptyRes.statusCode, 400, emptyRes.body);

    const noCsrf = multipartPayload({ title: 'x', date: '2026-09-28', content: 'x' });
    const noCsrfRes = await user1.request('POST', '/api/story.php', noCsrf.payload, noCsrf.headers);
    assert.equal(noCsrfRes.statusCode, 403, noCsrfRes.body);
  });

  await t.test('story JSON POST keeps working for existing callers', async () => {
    const res = await user1.post('/api/story.php', {
      title: 'JSON 故事',
      date: '2026-09-27',
      content: '兼容 JSON'
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().success, true);
    db.prepare("DELETE FROM story_events WHERE title = 'JSON 故事'").run();
  });

  // ---------------------------------------------------------------- FOURTH-004
  await t.test('virtual item use cannot be confirmed by its owner', async () => {
    const purchase = await user1.post('/api/shop.php?action=purchase', { product_id: 'p_virtual' });
    assert.equal(purchase.json().success, true, purchase.body);
    const item = (await user1.get('/api/virtual-items.php?action=get_my_items')).json().items[0];
    assert.equal((await user1.post('/api/virtual-items.php?action=use', { item_id: item.id })).json().success, true);

    const selfConfirm = await user1.post('/api/virtual-items.php?action=confirm_use', { item_id: item.id });
    assert.equal(selfConfirm.json().success, false);
    assert.equal(db.prepare('SELECT status FROM virtual_items WHERE id = ?').get(item.id).status, 'pending');

    // A user with no partner relationship must not be able to confirm either.
    const stranger = confirmVirtualItemUse(db, 'u3', item.id);
    assert.equal(stranger.success, false);
    assert.equal(db.prepare('SELECT status FROM virtual_items WHERE id = ?').get(item.id).status, 'pending');

    const partnerConfirm = await user2.post('/api/virtual-items.php?action=confirm_use', { item_id: item.id });
    assert.equal(partnerConfirm.json().success, true);
    assert.equal(db.prepare('SELECT status FROM virtual_items WHERE id = ?').get(item.id).status, 'used');
    assert.equal(db.prepare('SELECT confirmed_by FROM virtual_items WHERE id = ?').get(item.id).confirmed_by, 'u2');

    const repeat = await user2.post('/api/virtual-items.php?action=confirm_use', { item_id: item.id });
    assert.equal(repeat.json().success, false);
  });
});
