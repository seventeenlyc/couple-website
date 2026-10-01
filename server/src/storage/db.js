import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../utils/html.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let globalDb = null;

const ALBUM_METADATA_COLUMNS = ['filename', 'title', 'description', 'tags'];

/**
 * Photo metadata is stored HTML-escaped (see album.service.js), but rows written
 * before that was enforced may still hold raw values that album.html injects via
 * innerHTML. Only values containing a literal `<` or `>` are rewritten, and the
 * escaped result never contains one, so this migration is idempotent.
 */
function escapeLegacyAlbumMetadata(db) {
  const columns = ALBUM_METADATA_COLUMNS;
  const suspectRows = db.prepare(`
    SELECT id, ${columns.join(', ')} FROM album_photos
    WHERE ${columns.map(c => `instr(${c}, '<') > 0 OR instr(${c}, '>') > 0`).join(' OR ')}
  `).all();
  if (suspectRows.length === 0) return 0;

  const update = db.prepare(`UPDATE album_photos SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`);
  for (const row of suspectRows) {
    update.run(...columns.map(c => (typeof row[c] === 'string' ? escapeHtml(row[c]) : row[c])), row.id);
  }
  return suspectRows.length;
}

/** private.html renders original_name through innerHTML, same rule as above. */
function escapeLegacyPrivateFileNames(db) {
  const suspectRows = db.prepare(`
    SELECT id, original_name FROM private_files
    WHERE instr(original_name, '<') > 0 OR instr(original_name, '>') > 0
  `).all();
  if (suspectRows.length === 0) return 0;

  const update = db.prepare('UPDATE private_files SET original_name = ? WHERE id = ?');
  for (const row of suspectRows) {
    update.run(escapeHtml(row.original_name), row.id);
  }
  return suspectRows.length;
}

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

  // Album metadata written before upload sanitization may still be raw.
  escapeLegacyAlbumMetadata(db);
  escapeLegacyPrivateFileNames(db);

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
