import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getNowDateTimeString } from '../../utils/date.js';
import { normalizeFolderPath, filePathVariants } from '../../utils/folder-path.js';

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getPrivateNotes(db, userId) {
  return db.prepare('SELECT * FROM private_notes WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
}

export function addPrivateNote(db, userId, rawTitle, rawContent) {
  const id = `note_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = getNowDateTimeString();
  const title = escapeHtml((rawTitle || '').trim()) || '无标题';
  const content = escapeHtml((rawContent || '').trim());
  db.prepare(`
    INSERT INTO private_notes (id, user_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, content, now, now);

  return {
    success: true,
    note: { id, user_id: userId, title, content, created_at: now, updated_at: now },
    message: '保存成功'
  };
}

export function updatePrivateNote(db, userId, id, rawTitle, rawContent) {
  const note = db.prepare('SELECT * FROM private_notes WHERE id = ? AND user_id = ?').get(id, userId);
  if (!note) {
    return { success: false, message: '笔记不存在' };
  }
  const now = getNowDateTimeString();
  const title = escapeHtml((rawTitle || '').trim()) || '无标题';
  const content = escapeHtml((rawContent || '').trim());
  db.prepare('UPDATE private_notes SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
    title,
    content,
    now,
    id
  );
  return { success: true, message: '更新成功' };
}

export function deletePrivateNote(db, userId, id) {
  const note = db.prepare('SELECT * FROM private_notes WHERE id = ? AND user_id = ?').get(id, userId);
  if (!note) {
    return { success: false, message: '笔记不存在' };
  }
  db.prepare('DELETE FROM private_notes WHERE id = ?').run(id);
  return { success: true, message: '删除成功' };
}

export function getPrivateFiles(db, userId, folderPath = null) {
  let query = 'SELECT * FROM private_files WHERE user_id = ?';
  const params = [userId];
  if (folderPath !== null && folderPath !== undefined) {
    const variants = filePathVariants(folderPath);
    query += ` AND (${variants.map(() => 'folder_path = ?').join(' OR ')})`;
    params.push(...variants);
  }
  query += ' ORDER BY created_at DESC';
  const files = db.prepare(query).all(...params);

  return files.map(f => {
    const downloadUrl = `api/private-files.php?action=download&file_id=${encodeURIComponent(f.id)}`;
    return {
      ...f,
      download_url: downloadUrl,
      path: downloadUrl
    };
  });
}

export function savePrivateFile(db, uploadsDir, userId, fileBuffer, originalName, folderPath = '/') {
  const userPrivateDir = path.join(uploadsDir, 'private', userId);
  if (!fs.existsSync(userPrivateDir)) {
    fs.mkdirSync(userPrivateDir, { recursive: true });
  }

  const ext = path.extname(originalName).toLowerCase();
  const fileId = `pfile_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const storedFilename = `${fileId}${ext}`;
  const fullPath = path.join(userPrivateDir, storedFilename);

  fs.writeFileSync(fullPath, fileBuffer);

  const relativeStored = `uploads/private/${userId}/${storedFilename}`;
  const now = getNowDateTimeString();
  const canonicalFolder = normalizeFolderPath(folderPath);

  db.prepare(`
    INSERT INTO private_files (id, user_id, folder_path, original_name, stored_filename, stored_path, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fileId,
    userId,
    canonicalFolder,
    originalName,
    storedFilename,
    relativeStored,
    'application/octet-stream',
    fileBuffer.length,
    now
  );

  return {
    success: true,
    file: {
      id: fileId,
      original_name: originalName,
      folder_path: canonicalFolder,
      size: fileBuffer.length,
      download_url: `api/private-files.php?action=download&file_id=${encodeURIComponent(fileId)}`
    },
    message: '上传成功'
  };
}

export function deletePrivateFile(db, rootDir, userId, fileId) {
  const file = db.prepare('SELECT * FROM private_files WHERE id = ? AND user_id = ?').get(fileId, userId);
  if (!file) {
    return { success: false, message: '文件不存在' };
  }

  if (file.stored_path) {
    const full = path.join(rootDir, file.stored_path);
    if (fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch (e) {}
    }
  }

  db.prepare('DELETE FROM private_files WHERE id = ?').run(fileId);
  return { success: true, message: '删除成功' };
}
