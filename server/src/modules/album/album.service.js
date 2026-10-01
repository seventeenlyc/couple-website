import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { getNowDateTimeString } from '../../utils/date.js';

export function listFolders(db, context = 'album', userId = null) {
  if (context === 'private') {
    return db.prepare("SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? ORDER BY path ASC").all(userId);
  }
  return db.prepare("SELECT * FROM album_folders WHERE context = 'album' ORDER BY path ASC").all();
}

export function createFolder(db, context, userId, name, parentPath = '/') {
  const cleanName = name.trim().replace(/[\/\\:*?"<>|]/g, '');
  if (!cleanName) {
    return { success: false, message: '文件夹名称无效' };
  }

  const cleanParent = parentPath === '/' ? '/' : '/' + parentPath.replace(/^\/+|\/+$/g, '');
  const folderPath = cleanParent === '/' ? `/${cleanName}` : `${cleanParent}/${cleanName}`;

  try {
    const id = `f_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.prepare(`
      INSERT INTO album_folders (id, context, user_id, name, path, parent_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, context, context === 'private' ? userId : null, cleanName, folderPath, cleanParent, getNowDateTimeString());

    return {
      success: true,
      folder: { id, name: cleanName, path: folderPath, parent_path: cleanParent },
      message: '创建成功'
    };
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return { success: false, message: '同名文件夹已存在' };
    }
    return { success: false, message: '创建文件夹失败: ' + e.message };
  }
}

export function renameFolder(db, context, userId, oldPath, newName) {
  const cleanName = newName.trim().replace(/[\/\\:*?"<>|]/g, '');
  if (!cleanName) return { success: false, message: '名称无效' };

  return db.transaction(() => {
    const parentPath = path.posix.dirname(oldPath);
    const newPath = parentPath === '/' ? `/${cleanName}` : `${parentPath}/${cleanName}`;

    const updateFolder = context === 'private'
      ? db.prepare("UPDATE album_folders SET name = ?, path = ? WHERE context = 'private' AND user_id = ? AND path = ?")
      : db.prepare("UPDATE album_folders SET name = ?, path = ? WHERE context = 'album' AND path = ?");

    if (context === 'private') {
      updateFolder.run(cleanName, newPath, userId, oldPath);
    } else {
      updateFolder.run(cleanName, newPath, oldPath);
    }

    // Update child folders
    const childFolders = context === 'private'
      ? db.prepare("SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? AND path LIKE ?").all(userId, `${oldPath}/%`)
      : db.prepare("SELECT * FROM album_folders WHERE context = 'album' AND path LIKE ?").all(`${oldPath}/%`);

    for (const cf of childFolders) {
      const updatedChildPath = newPath + cf.path.substring(oldPath.length);
      const updatedChildParent = newPath + cf.parent_path.substring(oldPath.length);
      db.prepare("UPDATE album_folders SET path = ?, parent_path = ? WHERE id = ?").run(updatedChildPath, updatedChildParent, cf.id);
    }

    // Update album photos in this folder and subfolders
    if (context === 'album') {
      db.prepare("UPDATE album_photos SET folder_path = ? WHERE folder_path = ?").run(newPath, oldPath);
      const childPhotos = db.prepare("SELECT id, folder_path FROM album_photos WHERE folder_path LIKE ?").all(`${oldPath}/%`);
      for (const cp of childPhotos) {
        const ucp = newPath + cp.folder_path.substring(oldPath.length);
        db.prepare("UPDATE album_photos SET folder_path = ? WHERE id = ?").run(ucp, cp.id);
      }
    }

    return { success: true, message: '重命名成功', new_path: newPath };
  })();
}

export function deleteFolder(db, context, userId, targetPath) {
  return db.transaction(() => {
    if (context === 'private') {
      db.prepare("DELETE FROM album_folders WHERE context = 'private' AND user_id = ? AND (path = ? OR path LIKE ?)").run(userId, targetPath, `${targetPath}/%`);
    } else {
      db.prepare("DELETE FROM album_folders WHERE context = 'album' AND (path = ? OR path LIKE ?)").run(targetPath, `${targetPath}/%`);
      // Move photos in deleted folder to root
      db.prepare("UPDATE album_photos SET folder_path = '/' WHERE folder_path = ? OR folder_path LIKE ?").run(targetPath, `${targetPath}/%`);
    }
    return { success: true, message: '删除成功' };
  })();
}

export function getAlbumPhotos(db, folderPath = null, tag = null) {
  let query = 'SELECT * FROM album_photos WHERE 1=1';
  const params = [];

  if (folderPath !== null && folderPath !== undefined) {
    query += ' AND folder_path = ?';
    params.push(folderPath);
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

  const photoId = `photo_${fileId}`;
  db.prepare(`
    INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, tags, uploaded_by, size, width, height, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    photoId,
    folderPath || '/',
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
    width,
    height
  };
}
