import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is parent of server/
export const ROOT_DIR = path.resolve(__dirname, '../..');
export const SERVER_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
export const DEFAULT_DB_PATH = path.join(SERVER_DIR, 'data', 'couple.db');

export function loadConfig(overrides = {}) {
  const dbPath = process.env.COUPLE_DB_PATH || overrides.dbPath || DEFAULT_DB_PATH;
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return {
    port: Number(process.env.PORT || overrides.port || 19085),
    host: process.env.HOST || overrides.host || '127.0.0.1',
    dbPath,
    sessionSecret: process.env.SESSION_SECRET || overrides.sessionSecret || 'c0uple-w3bs1te-sup3r-s3cur3-s3ss10n-k3y-2026!',
    trustProxy: overrides.trustProxy ?? (process.env.TRUST_PROXY === 'true' || true),
    rootDir: overrides.rootDir || ROOT_DIR,
    dataDir: overrides.dataDir || DATA_DIR,
    uploadsDir: overrides.uploadsDir || UPLOADS_DIR,
    deviceCookieMaxAge: 15552000, // 180 days in seconds
    sessionCookieMaxAge: 86400 * 7, // 7 days in seconds
    timeZone: 'Asia/Shanghai'
  };
}
