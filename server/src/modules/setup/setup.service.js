import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const ignoredTables = new Set(['sessions', 'device_rates']);

export function isFreshDatabase(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  return tables.every(({name}) => {
    if (ignoredTables.has(name)) return true;
    const quoted = `"${name.replaceAll('"', '""')}"`;
    return !db.prepare(`SELECT 1 FROM ${quoted} LIMIT 1`).get();
  });
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function member(body, prefix) {
  const name = typeof body[`${prefix}_name`] === 'string' ? body[`${prefix}_name`].trim() : '';
  const password = body[`${prefix}_password`];
  const privatePassword = body[`${prefix}_private_password`];
  const birthday = body[`${prefix}_birthday`] || null;
  if (!name || name.length > 40 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('成员称呼需为 1 到 40 个可见字符');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('登录密码需为 12 到 128 个字符');
  if (typeof privatePassword !== 'string' || privatePassword.length < 12 || privatePassword.length > 128) throw new Error('私密空间密码需为 12 到 128 个字符');
  if (birthday && !validDate(`2000-${birthday}`)) throw new Error('生日格式应为月-日');
  return {name, password, privatePassword, birthday};
}

export function validateSetup(body) {
  if (!validDate(body.start_date)) throw new Error('请选择有效的开始日期');
  if (body.admin !== 'first' && body.admin !== 'second') throw new Error('请选择一位管理员');
  const first = member(body, 'first');
  const second = member(body, 'second');
  if (first.name === second.name) throw new Error('两位成员的称呼不能相同');
  return {startDate: body.start_date, admin: body.admin, first, second};
}

export function createInitialSite(db, input) {
  const firstId = crypto.randomUUID();
  const secondId = crypto.randomUUID();
  const firstHash = bcrypt.hashSync(input.first.password, 12);
  const secondHash = bcrypt.hashSync(input.second.password, 12);
  const firstPrivateHash = bcrypt.hashSync(input.first.privatePassword, 12);
  const secondPrivateHash = bcrypt.hashSync(input.second.privatePassword, 12);
  const adminId = input.admin === 'first' ? firstId : secondId;
  const create = db.transaction(() => {
    if (!isFreshDatabase(db)) return false;
    const insert = db.prepare('INSERT INTO users (id,username,password_hash,private_password_hash,partner_id,birthday) VALUES (?,?,?,?,?,?)');
    insert.run(firstId, input.first.name, firstHash, firstPrivateHash, secondId, input.first.birthday);
    insert.run(secondId, input.second.name, secondHash, secondPrivateHash, firstId, input.second.birthday);
    db.prepare("INSERT INTO site_config (key,value) VALUES ('startDate',?)").run(input.startDate);
    db.prepare("INSERT INTO site_config (key,value) VALUES ('site',?)").run(JSON.stringify({admin_id: adminId}));
    return true;
  });
  return create.immediate();
}
