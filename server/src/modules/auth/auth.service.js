import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export function verifyPassword(plain, hashed) {
  if (!plain || !hashed) return false;
  if (typeof plain !== 'string' || typeof hashed !== 'string') return false;

  if (hashed.startsWith('$2a$') || hashed.startsWith('$2b$') || hashed.startsWith('$2y$')) {
    return bcrypt.compareSync(plain, hashed);
  }

  // Timing safe equal for plaintext fallback
  const bufA = Buffer.from(plain);
  const bufB = Buffer.from(hashed);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function authenticateUser(db, you, baby, password) {
  if (!you || !baby) {
    return { success: false, message: '请输入你和对方的称呼' };
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(you);
  if (!user) {
    return { success: false, message: '身份验证失败，请检查称呼' };
  }

  // Check partner match
  let partnerValid = false;
  if (user.partner_id) {
    const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(user.partner_id);
    if (partner && (partner.username === baby || partner.id === baby)) {
      partnerValid = true;
    }
  }
  if (!partnerValid) {
    // Check if baby exists as user and has user.id as partner_id
    const partner = db.prepare('SELECT * FROM users WHERE username = ?').get(baby);
    if (partner && partner.partner_id === user.id) {
      partnerValid = true;
    }
  }

  if (!partnerValid) {
    return { success: false, message: '身份验证失败，请检查称呼' };
  }

  // Check password if configured
  if (user.password_hash) {
    if (!password) {
      return { success: false, message: '请输入密码' };
    }
    if (!verifyPassword(password, user.password_hash)) {
      return { success: false, message: '密码错误' };
    }
  }

  return { success: true, user };
}

export function verifyPrivatePassword(db, userId, password) {
  if (!userId || !password) return false;
  const user = db.prepare('SELECT private_password_hash FROM users WHERE id = ?').get(userId);
  if (!user || !user.private_password_hash) return false;
  return verifyPassword(password, user.private_password_hash);
}
