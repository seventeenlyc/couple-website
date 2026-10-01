import crypto from 'node:crypto';
import { getTodayDateString, getNowDateTimeString, calculateLoveDuration } from '../../utils/date.js';

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
    const samplePhotos = db.prepare('SELECT original_path FROM album_photos WHERE SUBSTR(created_at, 1, 10) = ? LIMIT 4').all(pd.day);
    events.push({
      id: `system_upload_${pd.day}`,
      source: 'upload',
      type: 'photo_upload',
      date: pd.day,
      title: `定格美好瞬间`,
      content: `这一天记录了 ${pd.cnt} 张珍贵的照片。`,
      photos: samplePhotos.map(p => p.original_path),
      created_by: '',
      created_at: `${pd.day} 12:00:00`,
      count: pd.cnt
    });
  }

  // 4. Custom manual events
  const customEvents = db.prepare('SELECT * FROM story_events ORDER BY event_date DESC').all();
  for (const ce of customEvents) {
    let photos = [];
    try { photos = JSON.parse(ce.photos || '[]'); } catch (e) {}
    events.push({
      id: ce.id,
      source: ce.source || 'manual',
      type: ce.type || 'custom',
      date: ce.event_date,
      title: ce.title,
      content: ce.content,
      photos,
      created_by: ce.created_by,
      created_at: ce.created_at,
      count: 1
    });
  }

  // Sort newest first
  events.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  return {
    success: true,
    startDate,
    love_days: duration.days,
    events
  };
}

export function createStoryEvent(db, userId, data) {
  const title = (data.title || '').trim();
  const date = data.date || getTodayDateString();
  const content = (data.content || '').trim();
  const photos = Array.isArray(data.photos) ? data.photos : [];

  if (!title) {
    return { success: false, message: '标题不能为空' };
  }

  const id = `story_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = getNowDateTimeString();

  db.prepare(`
    INSERT INTO story_events (id, source, type, event_date, title, content, photos, created_by, created_at)
    VALUES (?, 'manual', 'custom', ?, ?, ?, ?, ?, ?)
  `).run(id, date, title, content, JSON.stringify(photos), userId, now);

  return {
    success: true,
    message: '故事已收录进时间线',
    event: {
      id,
      source: 'manual',
      type: 'custom',
      date,
      title,
      content,
      photos,
      created_by: userId,
      created_at: now
    }
  };
}
