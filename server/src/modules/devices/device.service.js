import crypto from 'node:crypto';

export function deviceCookieName(userId) {
  const hash = crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 16);
  return `__Host-couple_device_${hash}`;
}

export function parseDeviceToken(token) {
  if (typeof token !== 'string') return null;
  if (!/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return null;
  return token.split('.');
}

export function deviceMatches(record, userId, token) {
  if (!token || !record) return false;
  if (record.user_id !== String(userId)) return false;
  const expectedHash = crypto.createHash('sha256').update(token[1]).digest('hex');
  const bufA = Buffer.from(record.secret_hash);
  const bufB = Buffer.from(expectedHash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function deviceSessionValid(db, session, cookies = {}) {
  const uid = session?.user_id;
  const devId = session?.device_id;
  if (!uid || !devId || !session?.logged_in) return false;

  const cookieName = deviceCookieName(uid);
  const rawCookie = cookies[cookieName] || cookies[cookieName.replace('__Host-', '')];
  const token = parseDeviceToken(rawCookie);
  if (!token || token[0] !== devId) return false;

  const record = db.prepare('SELECT * FROM device_records WHERE id = ?').get(devId);
  if (!record) return false;

  const now = Math.floor(Date.now() / 1000);
  const isValid = deviceMatches(record, uid, token) && record.status === 'active' && record.expires_at > now;

  if (isValid && now - record.last_seen > 300) {
    db.prepare('UPDATE device_records SET last_seen = ? WHERE id = ?').run(now, devId);
  }

  return isValid;
}

export function checkDeviceRateLimit(db, key, limit = 30) {
  const now = Math.floor(Date.now() / 1000);
  // Clean expired
  db.prepare('DELETE FROM device_rates WHERE until_epoch <= ?').run(now);

  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
  const row = db.prepare('SELECT count, until_epoch FROM device_rates WHERE rate_key = ?').get(hashedKey);

  if (!row) {
    const totalRates = db.prepare('SELECT COUNT(*) as cnt FROM device_rates').get().cnt;
    if (totalRates >= 1000) return false;

    db.prepare('INSERT INTO device_rates (rate_key, count, until_epoch) VALUES (?, 1, ?)').run(hashedKey, now + 900);
    return true;
  }

  const newCount = row.count + 1;
  db.prepare('UPDATE device_rates SET count = ? WHERE rate_key = ?').run(newCount, hashedKey);
  return newCount <= limit;
}

export function isUserAdmin(db, userId) {
  if (!userId) return false;
  // Look up username '拾柒' or admin config
  const adminUser = db.prepare("SELECT id FROM users WHERE username = '拾柒'").get();
  if (adminUser && String(adminUser.id) === String(userId)) return true;

  // Fallback: check site_config
  const cfg = db.prepare("SELECT value FROM site_config WHERE key = 'site'").get();
  if (cfg) {
    try {
      const site = JSON.parse(cfg.value);
      if (site.admin_id && String(site.admin_id) === String(userId)) return true;
    } catch (e) {}
  }
  return false;
}

export function authorizeDeviceLogin(db, user, cookies = {}, reqInfo = {}) {
  const uid = String(user.id);
  const cookieName = deviceCookieName(uid);
  const rawCookie = cookies[cookieName] || cookies[cookieName.replace('__Host-', '')];
  const token = parseDeviceToken(rawCookie);
  const now = Math.floor(Date.now() / 1000);

  // Clean inactive records expired > 24 hours
  db.prepare("DELETE FROM device_records WHERE status != 'active' AND expires_at < ?").run(now - 86400);

  // Check if current token is already valid
  if (token) {
    const existing = db.prepare('SELECT * FROM device_records WHERE id = ?').get(token[0]);
    if (existing && deviceMatches(existing, uid, token)) {
      if (existing.expires_at > now && (existing.status === 'active' || existing.status === 'pending')) {
        return {
          status: existing.status,
          id: token[0],
          code: existing.pair_code,
          cookieName
        };
      }
    }
  }

  // Check if first device binding
  const binding = db.prepare('SELECT first_bound_at FROM device_bindings WHERE user_id = ?').get(uid);
  const isFirst = !binding;

  // Check pending limits for non-first devices
  if (!isFirst) {
    const totalPending = db.prepare("SELECT COUNT(*) as cnt FROM device_records WHERE status = 'pending' AND expires_at > ?").get(now).cnt;
    const ownPending = db.prepare("SELECT COUNT(*) as cnt FROM device_records WHERE user_id = ? AND status = 'pending' AND expires_at > ?").get(uid, now).cnt;
    if (totalPending >= 20 || ownPending >= 5) {
      return { status: 'limited', cookieName };
    }
  }

  const newTokenId = crypto.randomBytes(16).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
  const pairCode = String(crypto.randomInt(10000000, 99999999));
  const status = isFirst ? 'active' : 'pending';
  const expiresAt = now + (isFirst ? 15552000 : 600);

  db.prepare(`
    INSERT INTO device_records (id, user_id, name, secret_hash, status, pair_code, pair_failures, created_at, expires_at, last_seen, agent, ip, approved_by)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    newTokenId,
    uid,
    user.username || user.name || '',
    secretHash,
    status,
    pairCode,
    now,
    expiresAt,
    now,
    (reqInfo.userAgent || 'Unknown browser').slice(0, 240),
    (reqInfo.ip || '').slice(0, 64),
    isFirst ? 'first-login' : null
  );

  if (isFirst) {
    db.prepare('INSERT OR REPLACE INTO device_bindings (user_id, first_bound_at) VALUES (?, ?)').run(uid, now);
  }

  return {
    status,
    id: newTokenId,
    code: pairCode,
    token: `${newTokenId}.${secret}`,
    cookieName
  };
}

export function handleDeviceAdminAction(db, adminUserId, action, deviceId, code = '') {
  if (!isUserAdmin(db, adminUserId)) {
    return { success: false, message: '仅拾柒管理员可以管理设备' };
  }

  const record = db.prepare('SELECT * FROM device_records WHERE id = ?').get(deviceId);
  if (!record) {
    return { success: false, message: '设备不存在' };
  }

  const now = Math.floor(Date.now() / 1000);

  if (action === 'approve') {
    if (record.status !== 'pending' || record.expires_at <= now) {
      return { success: false, message: '申请已失效' };
    }

    const bufCode = Buffer.from(code);
    const bufExpected = Buffer.from(record.pair_code || '');
    const isCodeMatch = bufCode.length === bufExpected.length && crypto.timingSafeEqual(bufCode, bufExpected);

    if (!isCodeMatch) {
      const failures = record.pair_failures + 1;
      if (failures >= 5) {
        db.prepare("UPDATE device_records SET pair_failures = ?, status = 'denied' WHERE id = ?").run(failures, deviceId);
      } else {
        db.prepare("UPDATE device_records SET pair_failures = ? WHERE id = ?").run(failures, deviceId);
      }
      return { success: false, message: '核对码错误' };
    }

    db.prepare(`
      UPDATE device_records 
      SET status = 'active', expires_at = ?, approved_by = ? 
      WHERE id = ?
    `).run(now + 15552000, String(adminUserId), deviceId);

    return { success: true };
  }

  if (action === 'deny' || action === 'revoke') {
    const newStatus = action === 'deny' ? 'denied' : 'revoked';
    db.prepare('UPDATE device_records SET status = ?, expires_at = ? WHERE id = ?').run(newStatus, now, deviceId);
    return { success: true };
  }

  return { success: false, message: '操作无效' };
}
