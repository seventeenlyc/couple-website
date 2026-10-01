import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadConfig } from '../src/config.js';
import { initDb, closeDb } from '../src/storage/db.js';

export function runReconcile(options = {}) {
  const dataDir = options.dataDir || DATA_DIR;
  const dbPath = options.dbPath || loadConfig().dbPath;

  if (!fs.existsSync(dbPath)) {
    console.error(`Database file does not exist at ${dbPath}`);
    return { ok: false, error: 'Database does not exist' };
  }

  const db = initDb(dbPath);
  console.log(`=== Reconciling SQLite Database with Legacy Data ===`);
  console.log(`Database: ${dbPath}`);
  console.log(`Data Dir: ${dataDir}`);

  const discrepancies = [];

  // Check config
  const configPath = path.join(dataDir, 'config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const legacyConfig = JSON.parse(raw);
    const usersCount = Object.keys(legacyConfig.users || {}).length;
    const dbUsersCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    if (dbUsersCount !== usersCount) {
      discrepancies.push(`User count mismatch: legacy=${usersCount}, db=${dbUsersCount}`);
    } else {
      console.log(`✔ Users match (${dbUsersCount})`);
    }
  }

  // Check products
  const dbProducts = db.prepare('SELECT COUNT(*) as cnt FROM products').get().cnt;
  console.log(`✔ Products in DB: ${dbProducts}`);

  // Check tasks
  const dbTasks = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get().cnt;
  console.log(`✔ Tasks in DB: ${dbTasks}`);

  // Check balance integrity (no negative balances)
  const negativeBalances = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE balance < 0').get().cnt;
  if (negativeBalances > 0) {
    discrepancies.push(`Found ${negativeBalances} users with negative balance!`);
  } else {
    console.log(`✔ User balance check passed (no negative balances)`);
  }

  // Check orphan virtual items
  const orphanItems = db.prepare(`
    SELECT COUNT(*) as cnt FROM virtual_items v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE u.id IS NULL
  `).get().cnt;
  if (orphanItems > 0) {
    discrepancies.push(`Found ${orphanItems} orphan virtual items with no valid user!`);
  } else {
    console.log(`✔ Virtual items integrity passed`);
  }

  const ok = discrepancies.length === 0;
  if (ok) {
    console.log(`\n🎉 Reconcile passed! All integrity checks clean.`);
  } else {
    console.warn(`\n⚠️ Reconcile found discrepancies:`);
    discrepancies.forEach(d => console.warn(`  - ${d}`));
  }

  return { ok, discrepancies };
}

if (process.argv[1] && process.argv[1].endsWith('reconcile.js')) {
  try {
    const result = runReconcile();
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error('Reconcile failed with error:', err);
    process.exit(1);
  }
}
