import crypto from 'node:crypto';
import { getNowDateTimeString } from '../../utils/date.js';

export function sendWhisper(db, senderId, content) {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return { success: false, message: '内容不能为空' };
  }

  // Resolve partner
  const user = db.prepare('SELECT partner_id FROM users WHERE id = ?').get(senderId);
  let receiverId = user?.partner_id;
  if (!receiverId) {
    const partner = db.prepare('SELECT id FROM users WHERE partner_id = ?').get(senderId);
    receiverId = partner?.id;
  }
  if (!receiverId) {
    return { success: false, message: '未找到绑定的另一半账号' };
  }

  const id = `whisper_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = getNowDateTimeString();

  db.prepare(`
    INSERT INTO whispers (id, sender_id, receiver_id, content, is_read, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(id, senderId, receiverId, trimmed, now);

  return {
    success: true,
    message: '悄悄话已发送',
    whisper: {
      id,
      from_user: senderId,
      to_user: receiverId,
      content: trimmed,
      created_at: now,
      read: false
    }
  };
}

export function checkUnreadWhispers(db, userId) {
  const unreadRows = db.prepare('SELECT * FROM whispers WHERE receiver_id = ? AND is_read = 0 ORDER BY created_at DESC').all(userId);
  const formatted = unreadRows.map(r => ({
    id: r.id,
    from_user: r.sender_id,
    to_user: r.receiver_id,
    content: r.content,
    created_at: r.created_at,
    read: false
  }));
  return {
    success: true,
    whispers: formatted,
    has_new: formatted.length > 0,
    has_unread: formatted.length > 0,
    count: formatted.length,
    latest: formatted[0] || null
  };
}

export function markWhispersRead(db, userId, whisperId = null) {
  const now = getNowDateTimeString();
  if (whisperId) {
    db.prepare('UPDATE whispers SET is_read = 1, read_at = ? WHERE id = ? AND receiver_id = ?').run(now, whisperId, userId);
  } else {
    db.prepare('UPDATE whispers SET is_read = 1, read_at = ? WHERE receiver_id = ? AND is_read = 0').run(now, userId);
  }
  return { success: true, message: '已标记为已读' };
}

export function getWhisperHistory(db, userId) {
  const user = db.prepare('SELECT partner_id FROM users WHERE id = ?').get(userId);
  let partnerId = user?.partner_id;
  if (!partnerId) {
    const partner = db.prepare('SELECT id FROM users WHERE partner_id = ?').get(userId);
    partnerId = partner?.id;
  }

  const rows = db.prepare(`
    SELECT * FROM whispers 
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `).all(userId, partnerId || '', partnerId || '', userId);

  return {
    success: true,
    whispers: rows.map(r => ({
      id: r.id,
      from_user: r.sender_id,
      to_user: r.receiver_id,
      content: r.content,
      created_at: r.created_at,
      read: r.is_read === 1
    }))
  };
}
