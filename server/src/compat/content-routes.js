import path from 'node:path';
import fs from 'node:fs';
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  getAlbumPhotos,
  deleteAlbumPhoto,
  processAndSavePhoto
} from '../modules/album/album.service.js';
import {
  getPrivateNotes,
  addPrivateNote,
  updatePrivateNote,
  deletePrivateNote,
  getPrivateFiles,
  savePrivateFile,
  deletePrivateFile
} from '../modules/private/private.service.js';
import {
  sendWhisper,
  checkUnreadWhispers,
  markWhispersRead,
  getWhisperHistory
} from '../modules/whispers/whisper.service.js';
import {
  getStoryTimeline,
  createStoryEvent
} from '../modules/story/story.service.js';
import {
  getDailyQuote,
  getAnniversaryReminders
} from '../modules/ai/ai.service.js';

export default async function contentRoutes(fastify, options) {
  const db = fastify.db;
  const rootDir = options.rootDir;
  const uploadsDir = options.uploadsDir;

  function normalizePath(p) {
    if (!p || p === '/' || p === '.') return '';
    return p.replace(/^\/+|\/+$/g, '');
  }

  function generateBreadcrumbs(rawPath) {
    const clean = normalizePath(rawPath);
    if (!clean) return [];
    const parts = clean.split('/');
    const crumbs = [];
    let cur = '';
    for (const part of parts) {
      if (!part) continue;
      cur = cur ? `${cur}/${part}` : part;
      crumbs.push({ name: part, path: cur });
    }
    return crumbs;
  }

  function formatTags(rawTags) {
    if (!rawTags) return [];
    if (Array.isArray(rawTags)) return rawTags;
    return String(rawTags)
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }

  function escapeLike(str) {
    return (str || '').replace(/([%_\\])/g, '\\$1');
  }

  // 1. Folders API
  const handleFolders = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || 'list';
    const context = req.query.context || req.body?.context || 'private';
    const userId = req.getCurrentUserId();

    if (context === 'private' && !req.isPrivateAuthenticated()) {
      reply.code(403);
      return { success: false, message: '请先验证隐私空间密码' };
    }

    if (action === 'list') {
      const cleanPath = normalizePath(req.query.path || req.body?.path || '');
      const isAll = (req.query.all || req.body?.all) === '1';
      const includeAllFolders = (req.query.include_all_folders || req.body?.include_all_folders) === '1';

      if (context === 'album') {
        let rawPhotos;
        if (isAll) {
          rawPhotos = db.prepare('SELECT * FROM album_photos ORDER BY created_at DESC').all();
        } else if (cleanPath === '') {
          rawPhotos = db.prepare("SELECT * FROM album_photos WHERE folder_path = '' OR folder_path = '/' OR folder_path IS NULL ORDER BY created_at DESC").all();
        } else {
          rawPhotos = db.prepare("SELECT * FROM album_photos WHERE folder_path = ? OR folder_path = ? OR folder_path = ? ORDER BY created_at DESC").all(cleanPath, `/${cleanPath}`, `/${cleanPath}/`);
        }

        const files = rawPhotos.map(p => ({
          id: p.id,
          filename: p.filename,
          path: p.original_path,
          thumb_path: p.thumbnail_path || p.original_path,
          folder_path: p.folder_path,
          title: p.title,
          tags: formatTags(p.tags),
          uploaded_by: p.uploaded_by,
          created_at: p.created_at
        }));

        let rawChildFolders;
        if (cleanPath === '') {
          rawChildFolders = db.prepare("SELECT * FROM album_folders WHERE context = 'album' AND (parent_path = '' OR parent_path = '/' OR parent_path IS NULL) ORDER BY name ASC").all();
        } else {
          rawChildFolders = db.prepare("SELECT * FROM album_folders WHERE context = 'album' AND (parent_path = ? OR parent_path = ? OR parent_path = ?) ORDER BY name ASC").all(cleanPath, `/${cleanPath}`, `/${cleanPath}/`);
        }

        const foldersWithCount = rawChildFolders.map(fld => {
          const fldNorm = normalizePath(fld.path);
          const escapedPattern = `/${escapeLike(fldNorm)}/%`;
          const countRow = db.prepare(`
            SELECT COUNT(*) as cnt FROM album_photos 
            WHERE folder_path = ? OR folder_path = ? OR folder_path LIKE ? ESCAPE '\\'
          `).get(`/${fldNorm}`, fldNorm, escapedPattern);
          return {
            id: fld.id,
            name: fld.name,
            path: fldNorm,
            parent_path: normalizePath(fld.parent_path),
            file_count: countRow ? countRow.cnt : 0
          };
        });

        const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM album_photos').get().cnt;
        const breadcrumbs = generateBreadcrumbs(cleanPath);

        const response = {
          success: true,
          folders: foldersWithCount,
          files: files,
          breadcrumbs: breadcrumbs,
          total_count: totalCount
        };

        if (includeAllFolders) {
          const allF = listFolders(db, 'album');
          response.all_folders = allF.map(f => ({
            ...f,
            path: normalizePath(f.path)
          }));
        }

        return response;
      } else {
        // private context
        let rawFiles;
        if (isAll) {
          rawFiles = db.prepare('SELECT * FROM private_files WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        } else if (cleanPath === '') {
          rawFiles = db.prepare("SELECT * FROM private_files WHERE user_id = ? AND (folder_path = '' OR folder_path = '/' OR folder_path IS NULL) ORDER BY created_at DESC").all(userId);
        } else {
          rawFiles = db.prepare("SELECT * FROM private_files WHERE user_id = ? AND (folder_path = ? OR folder_path = ? OR folder_path = ?) ORDER BY created_at DESC").all(userId, cleanPath, `/${cleanPath}`, `/${cleanPath}/`);
        }

        const files = rawFiles.map(f => ({
          id: f.id,
          name: f.original_name,
          original_name: f.original_name,
          filename: f.original_name,
          path: `api/private-files.php?action=download&file_id=${encodeURIComponent(f.id)}`,
          download_url: `api/private-files.php?action=download&file_id=${encodeURIComponent(f.id)}`,
          folder_path: f.folder_path,
          size: f.size,
          created_at: f.created_at
        }));

        let rawChildFolders;
        if (cleanPath === '') {
          rawChildFolders = db.prepare("SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? AND (parent_path = '' OR parent_path = '/' OR parent_path IS NULL) ORDER BY name ASC").all(userId);
        } else {
          rawChildFolders = db.prepare("SELECT * FROM album_folders WHERE context = 'private' AND user_id = ? AND (parent_path = ? OR parent_path = ? OR parent_path = ?) ORDER BY name ASC").all(userId, cleanPath, `/${cleanPath}`, `/${cleanPath}/`);
        }

        const foldersWithCount = rawChildFolders.map(fld => {
          const fldNorm = normalizePath(fld.path);
          const escapedPattern = `/${escapeLike(fldNorm)}/%`;
          const countRow = db.prepare(`
            SELECT COUNT(*) as cnt FROM private_files 
            WHERE user_id = ? AND (folder_path = ? OR folder_path = ? OR folder_path LIKE ? ESCAPE '\\')
          `).get(userId, `/${fldNorm}`, fldNorm, escapedPattern);
          return {
            id: fld.id,
            name: fld.name,
            path: fldNorm,
            parent_path: normalizePath(fld.parent_path),
            file_count: countRow ? countRow.cnt : 0
          };
        });

        const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM private_files WHERE user_id = ?').get(userId).cnt;
        const breadcrumbs = generateBreadcrumbs(cleanPath);

        const response = {
          success: true,
          folders: foldersWithCount,
          files: files,
          breadcrumbs: breadcrumbs,
          total_count: totalCount
        };

        if (includeAllFolders) {
          const allF = listFolders(db, 'private', userId);
          response.all_folders = allF.map(f => ({
            ...f,
            path: normalizePath(f.path)
          }));
        }

        return response;
      }
    }

    // Mutating actions require CSRF
    if (['create', 'rename', 'delete', 'move'].includes(action)) {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只允许POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }

      if (action === 'create') {
        const name = req.body?.name || req.body?.folder_name;
        const parent = req.body?.parent_path !== undefined ? req.body.parent_path : '/';
        const res = createFolder(db, context, userId, name, parent);
        if (!res.success) reply.code(400);
        return res;
      }

      if (action === 'rename') {
        const oldPath = req.body?.folder_path || req.body?.path || req.body?.old_path;
        const newName = req.body?.new_name || req.body?.name;
        const res = renameFolder(db, context, userId, oldPath, newName);
        if (!res.success) reply.code(400);
        return res;
      }

      if (action === 'delete') {
        const targetPath = req.body?.folder_path || req.body?.path;
        const res = deleteFolder(db, context, userId, targetPath);
        if (!res.success) reply.code(400);
        return res;
      }

      if (action === 'move') {
        const fileId = req.body?.file_id;
        const targetPath = req.body?.target_path || '';
        if (!fileId) {
          reply.code(400);
          return { success: false, message: '缺少文件ID' };
        }
        if (context === 'private') {
          db.prepare("UPDATE private_files SET folder_path = ? WHERE id = ? AND user_id = ?").run(targetPath, fileId, userId);
        } else {
          db.prepare("UPDATE album_photos SET folder_path = ? WHERE id = ?").run(targetPath, fileId);
        }
        return { success: true, message: '移动成功' };
      }
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/folders.php', handleFolders);
  fastify.post('/api/folders.php', handleFolders);

  // 2. Photos API
  const handlePhotos = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || 'list';

    if (action === 'list') {
      const folderPath = req.query.folder_path || null;
      const tag = req.query.tag || null;
      const photos = getAlbumPhotos(db, folderPath, tag);
      return {
        success: true,
        photos: photos.map(p => ({
          ...p,
          tags: formatTags(p.tags)
        }))
      };
    }

    if (action === 'delete') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只允许POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }

      const photoId = req.body?.photo_id || req.body?.id;
      if (!photoId) {
        reply.code(400);
        return { success: false, message: '缺少照片ID' };
      }
      return deleteAlbumPhoto(db, rootDir, photoId);
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/photos.php', handlePhotos);
  fastify.post('/api/photos.php', handlePhotos);

  // 3. Upload Photo API
  fastify.post('/api/upload-photo.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    if (!req.isMultipart()) {
      reply.code(400);
      return { success: false, message: '无效的上传请求' };
    }

    const parts = req.parts();
    const fields = {};
    const uploadedFiles = [];
    const filesToProcess = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        filesToProcess.push({
          buffer,
          filename: part.filename,
          mimetype: part.mimetype
        });
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    // CSRF check
    const token = fields.csrf_token || req.headers['x-csrf-token'];
    if (!req.validateCSRFToken(token)) {
      reply.code(403);
      return { success: false, message: '请求无效，请重新尝试' };
    }

    const folderPath = fields.folder_path || fields.folder_id || '/';
    const tags = fields.tags || '';
    const uploadedBy = req.getCurrentUser() || 'user';

    for (const fileItem of filesToProcess) {
      if (!fileItem.buffer || fileItem.buffer.length === 0) continue;
      const res = await processAndSavePhoto(
        db,
        rootDir,
        uploadsDir,
        fileItem.buffer,
        fileItem.filename,
        folderPath,
        tags,
        uploadedBy
      );
      uploadedFiles.push(res);
    }

    return {
      success: true,
      message: '上传成功',
      uploaded: uploadedFiles
    };
  });

  // 4. Upload Avatar API
  fastify.post('/api/upload-avatar.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    if (!req.isMultipart()) {
      reply.code(400);
      return { success: false, message: '无效的上传请求' };
    }

    const parts = req.parts();
    const fields = {};
    let fileBuffer = null;
    let originalFilename = '';

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'avatar') {
        fileBuffer = await part.toBuffer();
        originalFilename = part.filename;
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    const token = fields.csrf_token || req.headers['x-csrf-token'];
    if (!req.validateCSRFToken(token)) {
      reply.code(403);
      return { success: false, message: '请求无效，请重新尝试' };
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      reply.code(400);
      return { success: false, message: '没有上传文件' };
    }

    // Determine target user
    const side = fields.side || '';
    const allUsers = db.prepare('SELECT id, username FROM users').all();
    let targetUser = null;

    if (side === 'left') {
      targetUser = allUsers[0];
    } else if (side === 'right') {
      targetUser = allUsers[1] || allUsers[0];
    } else {
      targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.getCurrentUserId());
    }

    if (!targetUser) {
      targetUser = allUsers[0];
    }

    const avatarsDir = path.join(uploadsDir, 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const ext = path.extname(originalFilename).toLowerCase() || '.png';
    const avatarFilename = `avatar_${targetUser.id}_${Date.now()}${ext}`;
    const avatarFullPath = path.join(avatarsDir, avatarFilename);
    const relativeAvatarUrl = `uploads/avatars/${avatarFilename}`;

    fs.writeFileSync(avatarFullPath, fileBuffer);

    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(relativeAvatarUrl, targetUser.id);

    return {
      success: true,
      avatar_url: relativeAvatarUrl,
      message: '头像上传成功'
    };
  });

  // 5. Private Notes API
  fastify.post('/api/private-notes.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    if (!req.isPrivateAuthenticated()) {
      reply.code(403);
      return { success: false, message: '请先验证隐私空间密码' };
    }

    const body = req.body || {};
    const token = body.csrf_token || req.headers['x-csrf-token'];
    if (!req.validateCSRFToken(token)) {
      reply.code(403);
      return { success: false, message: '请求无效，请重新尝试' };
    }

    const action = body.action || req.query.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'list' || action === 'get') {
      const notes = getPrivateNotes(db, userId);
      return { success: true, notes };
    }

    if (action === 'add') {
      const { title, content } = body;
      return addPrivateNote(db, userId, title, content);
    }

    if (action === 'update') {
      const noteId = body.id || body.note_id || req.query?.id || req.query?.note_id;
      const { title, content } = body;
      if (!noteId) {
        reply.code(400);
        return { success: false, message: '缺少笔记ID' };
      }
      return updatePrivateNote(db, userId, noteId, title, content);
    }

    if (action === 'delete') {
      const noteId = body.id || body.note_id || req.query?.id || req.query?.note_id;
      if (!noteId) {
        reply.code(400);
        return { success: false, message: '缺少笔记ID' };
      }
      return deletePrivateNote(db, userId, noteId);
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  });

  // 6. Private Files API
  const handlePrivateFiles = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    if (!req.isPrivateAuthenticated()) {
      reply.code(403);
      return { success: false, message: '请先验证隐私空间密码' };
    }

    const action = req.query.action || req.body?.action || 'list';
    const userId = req.getCurrentUserId();

    if (action === 'list' || action === 'get') {
      const folderPath = req.query.folder_path || req.body?.folder_path || null;
      const files = getPrivateFiles(db, userId, folderPath);
      return { success: true, files };
    }

    if (action === 'download') {
      const fileId = req.query.file_id;
      if (!fileId) {
        reply.code(400);
        return { success: false, message: '缺少文件ID' };
      }

      const file = db.prepare('SELECT * FROM private_files WHERE id = ? AND user_id = ?').get(fileId, userId);
      if (!file) {
        reply.code(404);
        return { success: false, message: '文件不存在' };
      }

      const fullFilePath = path.join(rootDir, file.stored_path);
      if (!fs.existsSync(fullFilePath)) {
        reply.code(404);
        return { success: false, message: '物理文件不存在' };
      }

      reply.type('application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
      return fs.createReadStream(fullFilePath);
    }

    if (action === 'delete') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只允许POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const fileId = req.body?.file_id;
      return deletePrivateFile(db, rootDir, userId, fileId);
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/private-files.php', handlePrivateFiles);
  fastify.post('/api/private-files.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    if (!req.isPrivateAuthenticated()) {
      reply.code(403);
      return { success: false, message: '请先验证隐私空间密码' };
    }

    if (req.isMultipart()) {
      const parts = req.parts();
      const fields = {};
      let fileBuffer = null;
      let filename = '';

      for await (const part of parts) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          filename = part.filename;
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const token = fields.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        reply.code(400);
        return { success: false, message: '没有上传文件' };
      }

      const folderPath = fields.folder_path || '/';
      return savePrivateFile(db, uploadsDir, req.getCurrentUserId(), fileBuffer, filename, folderPath);
    }

    return handlePrivateFiles(req, reply);
  });

  // 7. Whispers API
  const handleWhispers = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'check_unread' || action === 'check') {
      return checkUnreadWhispers(db, userId);
    }

    if (action === 'get_history') {
      return getWhisperHistory(db, userId);
    }

    if (action === 'send') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const content = req.body?.content;
      return sendWhisper(db, userId, content);
    }

    if (action === 'mark_read') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const whisperId = req.body?.whisper_id || req.body?.id;
      return markWhispersRead(db, userId, whisperId);
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/whispers.php', handleWhispers);
  fastify.post('/api/whispers.php', handleWhispers);

  // 8. Story Timeline API
  fastify.get('/api/story.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    return getStoryTimeline(db);
  });

  fastify.post('/api/story.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    const token = req.body?.csrf_token || req.headers['x-csrf-token'];
    if (!req.validateCSRFToken(token)) {
      reply.code(403);
      return { success: false, message: '请求无效，请重新尝试' };
    }
    const userId = req.getCurrentUserId();
    return createStoryEvent(db, userId, req.body || {});
  });

  // 9. Daily Quote API
  fastify.get('/api/daily-quote.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    return getDailyQuote(db);
  });

  // 10. Anniversary Reminders API
  fastify.get('/api/anniversary-reminders.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    return getAnniversaryReminders(db);
  });
}
