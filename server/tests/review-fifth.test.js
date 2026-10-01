import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { closeDb, initDb } from '../src/storage/db.js';
import { createFolder, renameFolder, deleteFolder } from '../src/modules/album/album.service.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
  'base64'
);

// Regression coverage for the fifth review round:
//   FIFTH-1 stored XSS through album filename/title/tags
//   FIFTH-2 case-insensitive LIKE touching a sibling Trip/trip subtree
//   FIFTH-3 JSON story POST silently dropping supplied photos
//   FIFTH-4 album uploads accepting non-images
test('FIFTH-1/2/3/4: album metadata, case-sensitive subtrees, story JSON photos, upload validation', async (t) => {
  const workDir = path.join(__dirname, 'test-fifth-review');
  const dbPath = path.join(workDir, 'fixture.db');
  const uploadsDir = path.join(workDir, 'uploads');
  const rootDir = workDir;

  closeDb();
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(uploadsDir, 'photos'), { recursive: true });

  const app = await buildApp({ dbPath, rootDir, uploadsDir, secureCookie: false });
  const db = app.db;

  const hash = bcrypt.hashSync('pass123', 10);
  const privHash = bcrypt.hashSync('priv123', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance) VALUES (?,?,?,?,?,?)')
    .run('u1', '拾柒', hash, privHash, 'u2', 1000);
  db.prepare('INSERT INTO users (id, username, password_hash, private_password_hash, partner_id, balance) VALUES (?,?,?,?,?,?)')
    .run('u2', '伴侣', hash, privHash, 'u1', 1000);
  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('startDate', '2025-02-05')");
  db.prepare(`
    INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, uploaded_by, created_at)
    VALUES ('p_root', '/', 'audit.png', 'uploads/photos/audit.png', 'uploads/photos/audit.png', '测试照片', '拾柒', '2026-10-01 12:00:00')
  `).run();

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
      const res = await this.request('POST', '/api/login.php', { you, baby, password: 'pass123', csrf_token: this.csrf });
      assert.ok(res.json().success, `fixture login failed: ${res.body}`);
    }
    post(url, body) { return this.request('POST', url, { ...body, csrf_token: this.csrf }); }
    get(url) { return this.request('GET', url); }

    upload(filename, bytes, contentType, fields = {}) {
      const boundary = '----FifthReviewBoundary';
      const chunks = [];
      for (const [name, value] of Object.entries({ csrf_token: this.csrf, ...fields })) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
      }
      chunks.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
      ));
      chunks.push(bytes);
      chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      return this.request('POST', '/api/upload-photo.php', Buffer.concat(chunks), {
        'content-type': `multipart/form-data; boundary=${boundary}`
      });
    }
  }

  const user1 = new Browser();
  await user1.login('拾柒', '伴侣');

  // ------------------------------------------------------------------ FIFTH-2
  for (const context of ['album', 'private']) {
    const uid = context === 'private' ? 'u1' : null;

    await t.test(`${context}: renaming Trip leaves the sibling trip subtree alone`, () => {
      createFolder(db, context, uid, 'Trip');
      createFolder(db, context, uid, 'trip');
      createFolder(db, context, uid, 'child', 'trip');
      if (context === 'album') {
        db.prepare("INSERT INTO album_photos (id, folder_path, filename, original_path, uploaded_by) VALUES ('p_upper', '/Trip', 'a.png', 'uploads/photos/audit.png', '拾柒')").run();
        db.prepare("INSERT INTO album_photos (id, folder_path, filename, original_path, uploaded_by) VALUES ('p_lower', '/trip', 'b.png', 'uploads/photos/audit.png', '拾柒')").run();
        db.prepare("INSERT INTO album_photos (id, folder_path, filename, original_path, uploaded_by) VALUES ('p_lower_child', '/trip/child', 'c.png', 'uploads/photos/audit.png', '拾柒')").run();
      } else {
        db.prepare("INSERT INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, size) VALUES ('f_upper', 'u1', '/Trip', 'a.png', 'a.png', 'uploads/private/u1/a.png', 1)").run();
        db.prepare("INSERT INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, size) VALUES ('f_lower', 'u1', '/trip', 'b.png', 'b.png', 'uploads/private/u1/b.png', 1)").run();
        db.prepare("INSERT INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, size) VALUES ('f_lower_child', 'u1', '/trip/child', 'c.png', 'c.png', 'uploads/private/u1/c.png', 1)").run();
      }

      const renamed = renameFolder(db, context, uid, 'Trip', 'Renamed');
      assert.equal(renamed.success, true);

      const child = db.prepare('SELECT path, parent_path FROM album_folders WHERE context = ? AND name = ?').get(context, 'child');
      assert.deepEqual(child, { path: '/trip/child', parent_path: '/trip' }, 'sibling subtree must not be renamed');

      const sibling = db.prepare('SELECT path FROM album_folders WHERE context = ? AND path = ?').get(context, '/trip');
      assert.ok(sibling, 'sibling /trip must survive');

      const childRow = db.prepare(`SELECT folder_path FROM ${context === 'album' ? 'album_photos' : 'private_files'} WHERE id = ?`)
        .get(context === 'album' ? 'p_lower_child' : 'f_lower_child');
      assert.equal(childRow.folder_path, '/trip/child', 'sibling file must stay in its folder');

      const siblingRow = db.prepare(`SELECT folder_path FROM ${context === 'album' ? 'album_photos' : 'private_files'} WHERE id = ?`)
        .get(context === 'album' ? 'p_lower' : 'f_lower');
      assert.equal(siblingRow.folder_path, '/trip', 'sibling file must stay in /trip');

      const movedRow = db.prepare(`SELECT folder_path FROM ${context === 'album' ? 'album_photos' : 'private_files'} WHERE id = ?`)
        .get(context === 'album' ? 'p_upper' : 'f_upper');
      assert.equal(movedRow.folder_path, '/Renamed');
    });

    await t.test(`${context}: deleting Trip leaves the sibling trip subtree alone`, () => {
      const deleted = deleteFolder(db, context, uid, 'Trip');
      assert.equal(deleted.success, true);

      assert.equal(db.prepare('SELECT id FROM album_folders WHERE context = ? AND path = ?').get(context, '/Trip'), undefined);
      assert.ok(db.prepare('SELECT id FROM album_folders WHERE context = ? AND path = ?').get(context, '/trip'), '/trip must survive the delete');
      assert.ok(db.prepare('SELECT id FROM album_folders WHERE context = ? AND path = ?').get(context, '/trip/child'), '/trip/child must survive the delete');
    });

    db.prepare('DELETE FROM album_folders WHERE context = ?').run(context);
    db.prepare(`DELETE FROM ${context === 'album' ? 'album_photos' : 'private_files'} WHERE ${context === 'album' ? "id IN ('p_upper','p_lower','p_lower_child')" : "id IN ('f_upper','f_lower','f_lower_child')"}`).run();
  }

  await t.test('album file_count does not include a case-distinct sibling subtree', () => {
    createFolder(db, 'album', null, 'Trip');
    createFolder(db, 'album', null, 'trip');
    createFolder(db, 'album', null, 'child', 'trip');
    db.prepare("INSERT INTO album_photos (id, folder_path, filename, original_path, uploaded_by) VALUES ('p_in_lower', '/trip/child', 'd.png', 'uploads/photos/audit.png', '拾柒')").run();

    return user1.get('/api/folders.php?action=list&context=album&path=').then(res => {
      const folders = res.json().folders;
      assert.equal(folders.find(f => f.name === 'Trip').file_count, 0, 'Trip must not count the /trip/child photo');
      assert.equal(folders.find(f => f.name === 'trip').file_count, 1);
      db.prepare("DELETE FROM album_photos WHERE id = 'p_in_lower'").run();
      db.prepare("DELETE FROM album_folders WHERE context = 'album' AND name IN ('Trip','trip','child')").run();
    });
  });

  // ------------------------------------------------------------------ FIFTH-3
  await t.test('JSON story POST keeps the photos array it was given', async () => {
    const res = await user1.post('/api/story.php', {
      title: 'JSON photo fixture',
      content: 'fixture',
      date: '2026-10-01',
      photos: [{ path: 'uploads/photos/audit.png' }]
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().event.photos.length, 1);
    assert.equal(res.json().event.photos[0].path, 'uploads/photos/audit.png');

    const stored = (await user1.get('/api/story.php')).json().events.find(e => e.title === 'JSON photo fixture');
    assert.ok(stored);
    assert.equal(stored.photos.length, 1);
    assert.equal(stored.photos[0].thumb_path, 'uploads/photos/audit.png');
    db.prepare("DELETE FROM story_events WHERE title = 'JSON photo fixture'").run();
  });

  await t.test('JSON story POST accepts a photo-only record and rejects photo-less empties', async () => {
    const photoOnly = await user1.post('/api/story.php', {
      date: '2026-10-01',
      photos: [{ path: 'uploads/photos/audit.png' }]
    });
    assert.equal(photoOnly.statusCode, 200, photoOnly.body);
    assert.equal(photoOnly.json().success, true);
    assert.equal(photoOnly.json().event.photos.length, 1);
    db.prepare("DELETE FROM story_events WHERE id = ?").run(photoOnly.json().event.id);

    // Entries without a usable path are not photos, so the record is empty.
    const empty = await user1.post('/api/story.php', {
      date: '2026-10-01',
      photos: [{ title: 'no path' }]
    });
    assert.equal(empty.statusCode, 400, empty.body);
    assert.equal(empty.json().success, false);
  });

  // ------------------------------------------------------------------ FIFTH-4
  await t.test('album upload rejects HTML sent as a photo', async () => {
    const res = await user1.upload('audit.html', Buffer.from('<script>document.body.dataset.activeUpload=1</script>'), 'text/html');
    assert.equal(res.json().success, false);
    assert.equal(res.statusCode, 400);

    assert.equal(db.prepare("SELECT COUNT(*) AS cnt FROM album_photos WHERE filename LIKE '%audit.html%'").get().cnt, 0);
    const strayFiles = fs.existsSync(path.join(uploadsDir, 'photos'))
      ? fs.readdirSync(path.join(uploadsDir, 'photos'))
      : [];
    assert.deepEqual(strayFiles, [], 'nothing may be written to disk for a rejected upload');
  });

  await t.test('album upload rejects wrong extensions and mismatched content types', async () => {
    const wrongExtension = await user1.upload('pixel.svg', PIXEL_PNG, 'image/svg+xml');
    assert.equal(wrongExtension.json().success, false);

    const wrongMime = await user1.upload('pixel.png', PIXEL_PNG, 'text/html');
    assert.equal(wrongMime.json().success, false);

    const notAnImage = await user1.upload('fake.png', Buffer.from('<html>not an image</html>'), 'image/png');
    assert.equal(notAnImage.json().success, false);
    assert.match(notAnImage.json().message, /图片/);
  });

  await t.test('album upload accepts a real image and stores a server-generated name', async () => {
    const res = await user1.upload('holiday.png', PIXEL_PNG, 'image/png');
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().success, true);

    const photo = res.json().uploaded[0];
    assert.match(photo.filename, /^[0-9a-f-]{36}\.png$/, 'filename must be server generated');
    assert.equal(photo.width, 1);
    assert.equal(photo.height, 1);
    assert.ok(fs.existsSync(path.join(rootDir, photo.url)));

    db.prepare('DELETE FROM album_photos WHERE id = ?').run(photo.id);
    fs.rmSync(path.join(uploadsDir, 'photos'), { recursive: true, force: true });
    fs.rmSync(path.join(uploadsDir, 'thumbnails'), { recursive: true, force: true });
  });

  await t.test('album batch upload reports per-file results', async () => {
    const boundary = '----FifthReviewBatch';
    const chunks = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${user1.csrf}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="ok.png"\r\nContent-Type: image/png\r\n\r\n`),
      PIXEL_PNG,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="bad.html"\r\nContent-Type: text/html\r\n\r\n`),
      Buffer.from('<b>nope</b>'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    const res = await user1.request('POST', '/api/upload-photo.php', Buffer.concat(chunks), {
      'content-type': `multipart/form-data; boundary=${boundary}`
    });

    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json().summary, { total: 2, success: 1, failed: 1 });
    assert.equal(res.json().results.length, 2);
    assert.equal(res.json().results[0].success, true);
    assert.equal(res.json().results[1].success, false);

    for (const row of db.prepare('SELECT id FROM album_photos').all()) {
      db.prepare('DELETE FROM album_photos WHERE id = ?').run(row.id);
    }
    fs.rmSync(path.join(uploadsDir, 'photos'), { recursive: true, force: true });
    fs.rmSync(path.join(uploadsDir, 'thumbnails'), { recursive: true, force: true });
  });

  await t.test('album upload without a file is rejected', async () => {
    const boundary = '----FifthReviewEmpty';
    const payload = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${user1.csrf}\r\n--${boundary}--\r\n`
    );
    const res = await user1.request('POST', '/api/upload-photo.php', payload, {
      'content-type': `multipart/form-data; boundary=${boundary}`
    });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().success, false);
  });

  // ------------------------------------------------------------------ FIFTH-1
  await t.test('album metadata cannot inject markup into the album page', async () => {
    const attackName = '<img src=x onerror=document.body.dataset.photoXss=1>.png';
    const attackTag = '<img src=x onerror=document.body.dataset.tagXss=1>';
    const res = await user1.upload(attackName, PIXEL_PNG, 'image/png', { tags: attackTag });
    assert.equal(res.json().success, true);

    const files = (await user1.get('/api/folders.php?action=list&context=album&all=1')).json().files;
    const row = files.find(f => f.id === res.json().uploaded[0].id);
    assert.ok(row);
    assert.ok(!row.title.includes('<img'), `title must be escaped, got ${row.title}`);
    assert.ok(!row.filename.includes('<'), `filename must not carry the client name, got ${row.filename}`);
    assert.ok(!row.tags.some(tag => tag.includes('<img')), `tags must be escaped, got ${JSON.stringify(row.tags)}`);
    assert.equal(row.title, '&lt;img src=x onerror=document.body.dataset.photoXss=1&gt;');
    assert.deepEqual(row.tags, ['&lt;img src=x onerror=document.body.dataset.tagXss=1&gt;']);

    const stored = db.prepare('SELECT filename, title, tags FROM album_photos WHERE id = ?').get(res.json().uploaded[0].id);
    assert.ok(!stored.filename.includes('<'));
    assert.ok(!stored.title.includes('<'));
    assert.ok(!stored.tags.includes('<'));
  });
  await t.test('private file names cannot inject markup either', async () => {
    const unlock = await user1.post('/api/private-auth.php', { action: 'verify', password: 'priv123' });
    assert.ok(unlock.json().success, unlock.body);

    const boundary = '----FifthReviewPrivate';
    const attackName = '<img src=x onerror=document.body.dataset.privateXss=1>.txt';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${user1.csrf}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${attackName}"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from('secret'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const res = await user1.request('POST', '/api/private-files.php', payload, {
      'content-type': `multipart/form-data; boundary=${boundary}`
    });
    assert.equal(res.json().success, true, res.body);
    assert.ok(!res.json().file.original_name.includes('<'), `upload response leaked the raw name: ${res.json().file.original_name}`);

    const listed = await user1.get('/api/private-files.php?action=list');
    const row = listed.json().files.find(f => f.id === res.json().file.id);
    assert.ok(row);
    assert.ok(!row.original_name.includes('<'), `private file name must be escaped, got ${row.original_name}`);
    assert.equal(row.original_name, '&lt;img src=x onerror=document.body.dataset.privateXss=1&gt;.txt');
  });
});

test('FIFTH-1: metadata stored before the fix is escaped once at startup', () => {
  const workDir = path.join(__dirname, 'test-fifth-migration');
  const dbPath = path.join(workDir, 'fixture.db');
  const rawTitle = '<img src=x onerror=document.body.dataset.legacyXss=1>';
  const rawTags = '旅行,<script>alert(1)</script>';
  const rawFileName = '<img src=x onerror=document.body.dataset.legacyPrivateXss=1>.txt';

  closeDb();
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  try {
    let db = initDb(dbPath);
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u1', '拾柒', 'x')").run();
    db.prepare(`
      INSERT INTO album_photos (id, folder_path, filename, original_path, uploaded_by, title, tags, description)
      VALUES ('legacy_raw', '/', '<img src=x>.png', 'uploads/photos/a.png', '拾柒', ?, ?, 'R&D 照片')
    `).run(rawTitle, rawTags);
    db.prepare(`
      INSERT INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, size)
      VALUES ('legacy_priv', 'u1', '/', ?, 'a.txt', 'uploads/private/u1/a.txt', 1)
    `).run(rawFileName);
    closeDb();

    // Startup migration escapes the raw rows. `&` is escaped too because a
    // suspect row is rewritten as a whole; entities decode back to the same text.
    db = initDb(dbPath);
    let row = db.prepare('SELECT * FROM album_photos WHERE id = ?').get('legacy_raw');
    assert.equal(row.title, '&lt;img src=x onerror=document.body.dataset.legacyXss=1&gt;');
    assert.equal(row.tags, '旅行,&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(row.filename, '&lt;img src=x&gt;.png');
    assert.equal(row.description, 'R&amp;D 照片');

    let privRow = db.prepare('SELECT * FROM private_files WHERE id = ?').get('legacy_priv');
    assert.equal(privRow.original_name, '&lt;img src=x onerror=document.body.dataset.legacyPrivateXss=1&gt;.txt');
    closeDb();

    // A second startup must not escape an already escaped row again.
    db = initDb(dbPath);
    row = db.prepare('SELECT * FROM album_photos WHERE id = ?').get('legacy_raw');
    assert.equal(row.title, '&lt;img src=x onerror=document.body.dataset.legacyXss=1&gt;');
    assert.equal(row.tags, '旅行,&lt;script&gt;alert(1)&lt;/script&gt;');
    privRow = db.prepare('SELECT * FROM private_files WHERE id = ?').get('legacy_priv');
    assert.equal(privRow.original_name, '&lt;img src=x onerror=document.body.dataset.legacyPrivateXss=1&gt;.txt');
  } finally {
    closeDb();
    if (fs.existsSync(workDir)) {
      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (e) {}
    }
  }
});
