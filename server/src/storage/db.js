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
