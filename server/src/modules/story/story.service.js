import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getTodayDateString, getNowDateTimeString, calculateLoveDuration } from '../../utils/date.js';

const STORY_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
const STORY_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const STORY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;
}

/**
 * story.html renders `photo.thumb_path || photo.path` and `photo.title`, so every
 * photo must be an object. Legacy data may hold bare path strings.
 */
export function normalizePhotoEntry(photo) {
  if (!photo) return null;

  if (typeof photo === 'string') {
    const value = photo.trim();
    return value ? { id: '', path: value, thumb_path: value, title: '' } : null;
  }

  if (typeof photo !== 'object') return null;

  const photoPath = String(photo.path || photo.original_path || '').trim();
  if (!photoPath) return null;

  return {
    id: String(photo.id || ''),
    path: photoPath,
    thumb_path: String(photo.thumb_path || photo.thumbnail_path || photoPath),
    title: String(photo.title || photo.filename || '')
  };
}

export function getStoryTimeline(db) {
  const startRow = db.prepare("SELECT value FROM site_config WHERE key = 'startDate'").get();
  const startDate = startRow ? startRow.value : '2025-02-05';
  const today = getTodayDateString();
  const duration = calculateLoveDuration(startDate);

  const events = [];

  // 1. System start day
  events.push({
    id: `system_start_${startDate}`,
    source: 'system',
    type: 'start',
    date: startDate,
    title: '恋爱第一天',
    content: '从这一天开始，时间有了新的刻度。',
    photos: [],
    created_by: '',
    created_at: `${startDate} 00:00:00`,
    count: 1
  });

  // 2. Anniversaries (1 year, 2 years...)
  const startYear = parseInt(startDate.slice(0, 4), 10);
  const startMMDD = startDate.slice(5);
  const currentYear = parseInt(today.slice(0, 4), 10);

  for (let yr = startYear + 1; yr <= currentYear; yr++) {
    const annivDate = `${yr}-${startMMDD}`;
    if (annivDate <= today) {
      const nth = yr - startYear;
      events.push({
        id: `system_anniv_${annivDate}`,
        source: 'anniversary',
        type: 'anniversary',
        date: annivDate,
        title: `恋爱 ${nth} 周年纪念日`,
        content: `风雨同舟又一年，今天是我们在一起的第 ${nth} 个年头。`,
        photos: [],
        created_by: '',
        created_at: `${annivDate} 00:00:00`,
        count: 1
      });
    }
  }

  // 3. Photo upload daily milestones
  const photoDays = db.prepare(`
    SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as cnt
    FROM album_photos
    GROUP BY day
    ORDER BY day DESC
  `).all();

  for (const pd of photoDays) {
    if (!pd.day) continue;
    const samplePhotos = db.prepare(`
      SELECT id, original_path, thumbnail_path, title, filename, uploaded_by
      FROM album_photos
      WHERE SUBSTR(created_at, 1, 10) = ?
      ORDER BY created_at DESC
      LIMIT 6
    `).all(pd.day);
    const uploader = samplePhotos.find(p => p.uploaded_by);
    events.push({
      id: `system_upload_${pd.day}`,
      source: 'album',
      type: 'upload',
      date: pd.day,
      title: `上传了 ${pd.cnt} 张照片`,
      content: '这一天被放进了相册，也贴到了时间轴上。',
      photos: samplePhotos.map(p => normalizePhotoEntry({
        id: p.id,
        path: p.original_path,
        thumb_path: p.thumbnail_path || p.original_path,
        title: p.title || p.filename
      })).filter(Boolean),
      created_by: uploader ? uploader.uploaded_by : '',
      created_at: `${pd.day} 12:00:00`,
      count: pd.cnt
    });
  }

  // 4. Custom manual events
  const customEvents = db.prepare('SELECT * FROM story_events ORDER BY event_date DESC').all();
  for (const ce of customEvents) {
    let photos = [];
    try { photos = JSON.parse(ce.photos || '[]'); } catch (e) {}
    if (!Array.isArray(photos)) photos = [];
    const normalizedPhotos = photos.map(normalizePhotoEntry).filter(Boolean);
    events.push({
      id: ce.id,
      source: ce.source || 'manual',
      type: ce.type && ce.type !== 'custom' ? ce.type : 'manual',
      date: ce.event_date,
      title: ce.title,
      content: ce.content,
      photos: normalizedPhotos,
      created_by: ce.created_by,
      created_at: ce.created_at,
      count: Math.max(1, normalizedPhotos.length)
    });
  }

  // Sort newest first
  events.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  return {
    success: true,
    // Kept for existing API callers.
    startDate,
    love_days: duration.days,
    // Fields story.html reads from story.summary.
    summary: {
      start_date: startDate,
      today,
      total_days: duration.days,
      years: duration.years,
      months: duration.months,
      days: duration.remainingDays,
      event_count: events.length
    },
    events
  };
}

export function saveStoryPhoto(uploadsDir, file) {
  const originalName = file?.filename || '';
  const extension = path.extname(originalName).toLowerCase().replace('.', '');

  if (!STORY_IMAGE_EXTENSIONS.includes(extension)) {
    return { success: false, message: '只支持 JPG、PNG、GIF 格式的图片' };
  }
  if (file.mimetype && !STORY_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return { success: false, message: '文件不是有效图片' };
  }
  if (!file.buffer || file.buffer.length === 0) {
    return { success: false, message: '照片上传失败' };
  }
  if (file.buffer.length > STORY_IMAGE_MAX_BYTES) {
    return { success: false, message: '图片大小不能超过 10MB' };
  }

  const storyDir = path.join(uploadsDir, 'story');
  fs.mkdirSync(storyDir, { recursive: true });

  const fileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(storyDir, fileName), file.buffer);
  const relativePath = `uploads/story/${fileName}`;

  return {
    success: true,
    photo: {
      id: `story_photo_${crypto.randomBytes(6).toString('hex')}`,
      path: relativePath,
      thumb_path: relativePath,
      title: path.parse(originalName).name,
      mime_type: file.mimetype || '',
      file_size: file.buffer.length
    }
  };
}

export function createStoryEvent(db, userId, data) {
  const title = String(data.title || '').trim();
  const content = String(data.content || '').trim();
  const rawDate = String(data.date || '').trim();

  const photos = (Array.isArray(data.photos) ? data.photos : [])
    .map(normalizePhotoEntry)
    .filter(Boolean);

  const date = rawDate || getTodayDateString();
  if (!isValidDateString(date)) {
    return { success: false, message: '请选择有效日期' };
  }
  if (!title && !content && photos.length === 0) {
    return { success: false, message: '请写一点内容，或选择一张照片' };
  }

  const id = `story_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = getNowDateTimeString();

  // story.html prints created_by directly ("由 X 贴上"), and the legacy API
  // stored the display name rather than the internal user id.
  const author = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
  const createdBy = author?.username || userId;

  db.prepare(`
    INSERT INTO story_events (id, source, type, event_date, title, content, photos, created_by, created_at)
    VALUES (?, 'manual', 'manual', ?, ?, ?, ?, ?, ?)
  `).run(id, date, title, content, JSON.stringify(photos), createdBy, now);

  const event = {
    id,
    source: 'manual',
    type: 'manual',
    date,
    title,
    content,
    photos,
    created_by: createdBy,
    created_at: now,
    count: Math.max(1, photos.length)
  };

  return {
    success: true,
    message: '已经贴到时光轴上',
    event
  };
}
