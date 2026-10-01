import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runImport } from '../scripts/import-legacy.js';
import { runReconcile } from '../scripts/reconcile.js';
import { closeDb, initDb } from '../src/storage/db.js';
import { ROOT_DIR } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Legacy Data Import and Reconcile Integrity', async (t) => {
  const testDbPath = path.join(__dirname, 'test-migration.db');
  closeDb();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  t.after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  await t.test('Initial import from data directory populates SQLite', () => {
    closeDb();
    const rep = runImport({
      dbPath: testDbPath,
      dataDir: path.join(ROOT_DIR, 'data')
    });

    assert.equal(rep.users, 2);
    assert.equal(rep.products, 11);
    assert.equal(rep.tasks, 8);
    closeDb();
  });

  await t.test('Second import is idempotent and does not duplicate records', () => {
    closeDb();
    const rep2 = runImport({
      dbPath: testDbPath,
      dataDir: path.join(ROOT_DIR, 'data')
    });
    closeDb();

    const db = initDb(testDbPath);
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const prodCount = db.prepare('SELECT COUNT(*) as cnt FROM products').get().cnt;
    const taskCount = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get().cnt;
    closeDb();

    assert.equal(userCount, 2);
    assert.equal(prodCount, 11);
    assert.equal(taskCount, 8);
  });

  await t.test('Reconcile passes with 0 discrepancies', () => {
    closeDb();
    const rec = runReconcile({
      dbPath: testDbPath,
      dataDir: path.join(ROOT_DIR, 'data')
    });
    closeDb();

    assert.equal(rec.ok, true);
    assert.equal(rec.discrepancies.length, 0);
  });

  await t.test('Legacy private file metadata with stored_name and storage_path imports cleanly', () => {
    closeDb();
    const tempDir = path.join(__dirname, 'test-legacy-private-temp');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const conf = {
      users: {
        '测试用户': { id: 'u_priv_test', password: 'pwd', privatePassword: 'priv' }
      }
    };
    fs.writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify(conf));

    const privData = {
      notes: [],
      folders: [],
      files: [
        {
          id: 'pf_legacy_1',
          original_name: 'secret.txt',
          stored_name: 'secret-hash.txt',
          storage_path: 'uploads/private/u_priv_test/secret-hash.txt',
          uploaded_at: '2026-09-20 10:00:00',
          folder_path: '/',
          size: 42
        }
      ]
    };
    fs.writeFileSync(path.join(tempDir, 'private_u_priv_test.json'), JSON.stringify(privData));

    const legacyDbPath = path.join(tempDir, 'temp.db');
    runImport({ dbPath: legacyDbPath, dataDir: tempDir });
    closeDb();

    const db = initDb(legacyDbPath);
    const row = db.prepare('SELECT * FROM private_files WHERE id = ?').get('pf_legacy_1');
    closeDb();

    assert.ok(row);
    assert.equal(row.stored_filename, 'secret-hash.txt');
    assert.equal(row.stored_path, 'uploads/private/u_priv_test/secret-hash.txt');
    assert.equal(row.created_at, '2026-09-20 10:00:00');

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  });
});
