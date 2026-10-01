import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let globalDb = null;

export function initDb(dbPath) {
  if (globalDb) {
    return globalDb;
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Auto-migrate users columns if created with older schema
  const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userColumns.includes('total_earned')) {
    db.exec("ALTER TABLE users ADD COLUMN total_earned INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes('total_spent')) {
    db.exec("ALTER TABLE users ADD COLUMN total_spent INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes('streak_days')) {
    db.exec("ALTER TABLE users ADD COLUMN streak_days INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes('last_checkin')) {
    db.exec("ALTER TABLE users ADD COLUMN last_checkin TEXT");
  }

  globalDb = db;
  return db;
}

export function getDb() {
  if (!globalDb) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return globalDb;
}

export function closeDb() {
  if (globalDb) {
    try {
      globalDb.close();
    } finally {
      globalDb = null;
    }
  }
}
