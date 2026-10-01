import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { getNowDateTimeString } from '../../utils/date.js';
import {
  normalizePath,
  normalizeFolderPath,
  escapeLike,
  folderPathVariants,
  filePathVariants
} from '../../utils/folder-path.js';

export { escapeLike };

export function listFolders(db, context = 'album', userId = null) {
  if (context === 'private') {
    return db.prepare("SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? ORDER BY path ASC").all(userId);
  }
  return db.prepare("SELECT * FROM album_folders WHERE context = 'album' ORDER BY path ASC").all();
}

/** `column = ? OR column = ?` clauses plus their parameters, one per spelling. */
function exactMatch(column, values) {
  return {
    sql: values.map(() => `${column} = ?`).join(' OR '),
    params: [...values]
  };
}

/** `column LIKE ? ESCAPE '\'` clauses plus their escaped subtree patterns. */
function subtreeMatch(column, values) {
  const patterns = values.filter(Boolean).map(v => `${escapeLike(v)}/%`);
  return {
    sql: patterns.map(() => `${column} LIKE ? ESCAPE '\\'`).join(' OR '),
    params: patterns
  };
}

export function createFolder(db, context, userId, name, parentPath = '') {
  const cleanName = (name || '').trim().replace(/[\/\\:*?"<>|]/g, '');
  if (!cleanName) {
    return { success: false, message: '文件夹名称无效' };
  }

  const cleanParent = normalizePath(parentPath);
  const folderPath = cleanParent === '' ? `/${cleanName}` : `/${cleanParent}/${cleanName}`;
  const parentPathDb = cleanParent === '' ? '/' : `/${cleanParent}`;

  try {
    const id = `f_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.prepare(`
      INSERT INTO album_folders (id, context, user_id, name, path, parent_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, context, context === 'private' ? userId : null, cleanName, folderPath, parentPathDb, getNowDateTimeString());

    return {
      success: true,
      folder: { id, name: cleanName, path: folderPath, parent_path: parentPathDb },
      message: '创建成功'
    };
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return { success: false, message: '同名文件夹已存在' };
    }
    return { success: false, message: '创建文件夹失败: ' + e.message };
  }
}

export function renameFolder(db, context, userId, rawOldPath, newName) {
  if (!rawOldPath) return { success: false, message: '原路径不能为空' };
  const cleanName = (newName || '').trim().replace(/[\/\\:*?"<>|]/g, '');
  if (!cleanName) return { success: false, message: '名称无效' };

  return db.transaction(() => {
    // The caller may send either spelling; legacy rows use "a/b", rows created
    // through the Node API use "/a/b".
    const lookup = exactMatch('path', folderPathVariants(rawOldPath));
    const existing = context === 'private'
      ? db.prepare(`SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? AND (${lookup.sql})`).get(userId, ...lookup.params)
      : db.prepare(`SELECT * FROM album_folders WHERE context = 'album' AND (${lookup.sql})`).get(...lookup.params);

    if (!existing) {
      return { success: false, message: '文件夹不存在' };
    }

    const currentOldPath = existing.path;
    const parentNorm = normalizePath(existing.parent_path);
    const newPath = parentNorm === '' ? `/${cleanName}` : `/${parentNorm}/${cleanName}`;

    db.prepare("UPDATE album_folders SET name = ?, path = ? WHERE id = ?").run(cleanName, newPath, existing.id);

    // Descendants: rebuild each path from the variant that actually matched.
    const variants = [...new Set([currentOldPath, ...folderPathVariants(currentOldPath)])].filter(Boolean);

    const movedFolders = new Set();
    for (const variant of variants) {
      const childFolders = context === 'private'
        ? db.prepare("SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? AND path LIKE ? ESCAPE '\\'").all(userId, `${escapeLike(variant)}/%`)
        : db.prepare("SELECT * FROM album_folders WHERE context = 'album' AND path LIKE ? ESCAPE '\\'").all(`${escapeLike(variant)}/%`);

      for (const cf of childFolders) {
        if (movedFolders.has(cf.id)) continue;
        movedFolders.add(cf.id);
        const updatedPath = newPath + cf.path.substring(variant.length);
        const updatedParent = (cf.parent_path && cf.parent_path.startsWith(variant))
          ? newPath + cf.parent_path.substring(variant.length)
          : cf.parent_path;
        db.prepare("UPDATE album_folders SET path = ?, parent_path = ? WHERE id = ?").run(updatedPath, updatedParent, cf.id);
      }
    }

    // Photos / files: exact matches cover rows stored with the page's
    // no-leading-slash format, then every descendant subtree is relocated.
    if (context === 'album') {
      const exact = exactMatch('folder_path', filePathVariants(currentOldPath));
      db.prepare(`UPDATE album_photos SET folder_path = ? WHERE ${exact.sql}`).run(newPath, ...exact.params);

      const moved = new Set();
      for (const variant of variants) {
        const rows = db.prepare("SELECT id, folder_path FROM album_photos WHERE folder_path LIKE ? ESCAPE '\\'").all(`${escapeLike(variant)}/%`);
        for (const cp of rows) {
          if (moved.has(cp.id)) continue;
          moved.add(cp.id);
          db.prepare('UPDATE album_photos SET folder_path = ? WHERE id = ?').run(newPath + cp.folder_path.substring(variant.length), cp.id);
        }
      }
    } else {
      const exact = exactMatch('folder_path', filePathVariants(currentOldPath));
      db.prepare(`UPDATE private_files SET folder_path = ? WHERE user_id = ? AND (${exact.sql})`).run(newPath, userId, ...exact.params);

      const moved = new Set();
      for (const variant of variants) {
        const rows = db.prepare("SELECT id, folder_path FROM private_files WHERE user_id = ? AND folder_path LIKE ? ESCAPE '\\'").all(userId, `${escapeLike(variant)}/%`);
        for (const cf of rows) {
          if (moved.has(cf.id)) continue;
          moved.add(cf.id);
          db.prepare('UPDATE private_files SET folder_path = ? WHERE id = ?').run(newPath + cf.folder_path.substring(variant.length), cf.id);
        }
      }
    }

    return { success: true, message: '重命名成功', new_path: newPath };
  })();
}

export function deleteFolder(db, context, userId, rawTargetPath) {
  if (!rawTargetPath) return { success: false, message: '目标路径不能为空' };
  const variants = folderPathVariants(rawTargetPath).filter(Boolean);
  const folderExact = exactMatch('path', variants);
  const folderSubtree = subtreeMatch('path', variants);
  const fileExact = exactMatch('folder_path', filePathVariants(rawTargetPath));
  const fileSubtree = subtreeMatch('folder_path', variants);

  return db.transaction(() => {
    if (context === 'private') {
      db.prepare(`
        DELETE FROM album_folders
        WHERE context = 'private' AND user_id = ?
          AND (${folderExact.sql} OR ${folderSubtree.sql})
      `).run(userId, ...folderExact.params, ...folderSubtree.params);

      db.prepare(`
        UPDATE private_files
        SET folder_path = '/'
        WHERE user_id = ?
          AND (${fileExact.sql} OR ${fileSubtree.sql})
      `).run(userId, ...fileExact.params, ...fileSubtree.params);
    } else {
      db.prepare(`
        DELETE FROM album_folders
        WHERE context = 'album'
          AND (${folderExact.sql} OR ${folderSubtree.sql})
      `).run(...folderExact.params, ...folderSubtree.params);

      db.prepare(`
        UPDATE album_photos
        SET folder_path = '/'
        WHERE ${fileExact.sql} OR ${fileSubtree.sql}
      `).run(...fileExact.params, ...fileSubtree.params);
    }
    return { success: true, message: '删除成功' };
  })();
}

export function getAlbumPhotos(db, folderPath = null, tag = null) {
  let query = 'SELECT * FROM album_photos WHERE 1=1';
  const params = [];

  if (folderPath !== null && folderPath !== undefined) {
    const match = exactMatch('folder_path', filePathVariants(folderPath));
    query += ` AND (${match.sql})`;
    params.push(...match.params);
  }

  query += ' ORDER BY created_at DESC';
  const photos = db.prepare(query).all(...params);

  if (tag) {
    return photos.filter(p => {
      const tags = (p.tags || '').split(',').map(t => t.trim());
      return tags.includes(tag);
    });
  }

  return photos;
}

export function deleteAlbumPhoto(db, rootDir, photoId) {
  return db.transaction(() => {
    const photo = db.prepare('SELECT * FROM album_photos WHERE id = ?').get(photoId);
    if (!photo) {
      return { success: false, message: '照片不存在' };
    }

    // Try deleting physical files
    if (photo.original_path) {
      const fullOriginal = path.join(rootDir, photo.original_path);
      if (fs.existsSync(fullOriginal)) {
        try { fs.unlinkSync(fullOriginal); } catch (e) {}
      }
    }
    if (photo.thumbnail_path) {
      const fullThumb = path.join(rootDir, photo.thumbnail_path);
      if (fs.existsSync(fullThumb)) {
        try { fs.unlinkSync(fullThumb); } catch (e) {}
      }
    }

    db.prepare('DELETE FROM album_photos WHERE id = ?').run(photoId);
    return { success: true, message: '照片删除成功' };
  })();
}

export async function processAndSavePhoto(db, rootDir, uploadsDir, fileBuffer, originalFilename, folderPath, tags, uploadedBy) {
  const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
  const fileId = crypto.randomUUID();
  const storedFilename = `${fileId}${ext}`;

  const photosDir = path.join(uploadsDir, 'photos');
  const thumbsDir = path.join(uploadsDir, 'thumbnails');
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
  if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

  const originalFullPath = path.join(photosDir, storedFilename);
  const thumbFullPath = path.join(thumbsDir, storedFilename);

  // Write original
  fs.writeFileSync(originalFullPath, fileBuffer);

  let width = 0;
  let height = 0;
  let hasThumb = false;

  try {
    const metadata = await sharp(fileBuffer).metadata();
    width = metadata.width || 0;
    height = metadata.height || 0;

    // Generate thumbnail
    await sharp(fileBuffer)
      .resize({ width: 300, height: 300, fit: 'cover' })
      .toFile(thumbFullPath);
    hasThumb = true;
  } catch (e) {
    console.warn('Sharp thumbnail generation warning:', e.message);
  }

  const relativeOriginal = `uploads/photos/${storedFilename}`;
  const relativeThumb = hasThumb ? `uploads/thumbnails/${storedFilename}` : relativeOriginal;

  // Store the canonical form so later reads, renames and deletes always agree.
  const canonicalFolder = normalizeFolderPath(folderPath);

  const photoId = `photo_${fileId}`;
  db.prepare(`
    INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, tags, uploaded_by, size, width, height, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    photoId,
    canonicalFolder,
    originalFilename,
    relativeOriginal,
    relativeThumb,
    path.parse(originalFilename).name,
    Array.isArray(tags) ? tags.join(',') : (tags || ''),
    uploadedBy,
    fileBuffer.length,
    width,
    height,
    getNowDateTimeString()
  );

  return {
    id: photoId,
    filename: originalFilename,
    url: relativeOriginal,
    thumbnail: relativeThumb,
    folder_path: canonicalFolder,
    width,
    height
  };
}
