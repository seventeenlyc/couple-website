-- SQLite schema for couple-website
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  private_password_hash TEXT,
  partner_id TEXT,
  birthday TEXT,
  avatar TEXT,
  balance INTEGER NOT NULL DEFAULT 1000,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_checkin TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  streak_days INTEGER NOT NULL DEFAULT 1,
  reward INTEGER NOT NULL DEFAULT 10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, business_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reward INTEGER NOT NULL DEFAULT 10,
  category TEXT DEFAULT 'daily',
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_daily_instances (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward INTEGER NOT NULL,
  completed_by TEXT DEFAULT '[]',
  confirmed_by TEXT DEFAULT '[]',
  reward_given INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_date, task_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'virtual',
  stock INTEGER NOT NULL DEFAULT -1,
  image TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_price INTEGER NOT NULL,
  paid_price INTEGER NOT NULL,
  discount_rate REAL DEFAULT 1.0,
  discount_reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  idempotency_key TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS virtual_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused',
  used_at DATETIME,
  confirmed_by TEXT,
  confirmed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  order_id TEXT,
  rating INTEGER NOT NULL,
  content TEXT NOT NULL,
  reply TEXT,
  reply_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS album_folders (
  id TEXT PRIMARY KEY,
  context TEXT NOT NULL DEFAULT 'album',
  user_id TEXT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  parent_path TEXT NOT NULL DEFAULT '/',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context, user_id, path)
);

CREATE TABLE IF NOT EXISTS album_photos (
  id TEXT PRIMARY KEY,
  folder_path TEXT NOT NULL DEFAULT '/',
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  thumbnail_path TEXT,
  title TEXT,
  description TEXT,
  tags TEXT,
  uploaded_by TEXT NOT NULL,
  size INTEGER,
  width INTEGER,
  height INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS private_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS private_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_path TEXT NOT NULL DEFAULT '/',
  original_name TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS whispers (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS story_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'manual',
  type TEXT NOT NULL DEFAULT 'custom',
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  photos TEXT DEFAULT '[]',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  pair_code TEXT,
  pair_failures INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  agent TEXT,
  ip TEXT,
  approved_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS device_bindings (
  user_id TEXT PRIMARY KEY,
  first_bound_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS device_rates (
  rate_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  until_epoch INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, business_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_date ON task_daily_instances(business_date);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_items_user ON virtual_items(user_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_folder ON album_photos(folder_path);
CREATE INDEX IF NOT EXISTS idx_private_notes_user ON private_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_private_files_user ON private_files(user_id);
CREATE INDEX IF NOT EXISTS idx_whispers_receiver ON whispers(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_device_records_user ON device_records(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
