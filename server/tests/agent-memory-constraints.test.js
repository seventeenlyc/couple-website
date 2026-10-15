/**
 * 复审回归：回忆检索的片段回退必须保留地点与日期限定条件。
 *
 * 复审缺陷（P2）：数据库中只有“厦门旅行”记录时，查询“上海旅行”仍会因公共片段
 * “旅行”命中并返回厦门照片，同时回复声称“在相册「厦门旅行」中找到了这段真实回忆”。
 * 本轮修复后：
 *   - 片段回退命中必须同时满足查询中提取出的实体限定词（地点/专名）与日期限定；
 *   - 只靠片段命中的低置信度结果标记为 `related`，回复明确说明只是相近候选；
 *   - 否定用例不再依赖空数据库，而是“库中有别的城市记录、请求城市缺失”。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { chatWithCoupleAgent, searchMemories } from '../src/modules/ai/ai.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../src/storage/schema.sql');

function createDb({ photos = [], stories = [] } = {}) {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  db.prepare("INSERT INTO site_config (key, value) VALUES ('startDate', '2025-02-05')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, birthday) VALUES ('u1','name1','h','01-01'),('u2','name2','h','02-14')").run();

  const insertPhoto = db.prepare(`
    INSERT INTO album_photos (id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'name1', ?)
  `);
  for (const p of photos) {
    insertPhoto.run(
      p.id, p.folder, p.filename, p.original_path, p.thumbnail_path,
      p.title, p.description ?? '', p.tags ?? '', p.created_at
    );
  }

  const insertStory = db.prepare(`
    INSERT INTO story_events (id, source, type, event_date, title, content, photos, created_by)
    VALUES (?, 'manual', 'custom', ?, ?, ?, '[]', 'name1')
  `);
  for (const s of stories) {
    insertStory.run(s.id, s.date, s.title, s.content ?? '');
  }

  return db;
}

const XIAMEN_PHOTO = {
  id: 'photo-xiamen',
  folder: '/厦门旅行',
  filename: 'sunset.jpg',
  original_path: 'uploads/photos/sunset.jpg',
  thumbnail_path: 'uploads/thumbnails/sunset.jpg',
  title: '厦门旅行看海日落',
  description: '晚风很舒服',
  tags: '旅行,海边',
  created_at: '2026-09-28 18:00:00'
};

const SHANGHAI_PHOTO = {
  id: 'photo-shanghai',
  folder: '/上海旅行',
  filename: 'bund.jpg',
  original_path: 'uploads/photos/bund.jpg',
  thumbnail_path: 'uploads/thumbnails/bund.jpg',
  title: '外滩夜景',
  description: '灯火通明',
  tags: '旅行,夜景',
  created_at: '2026-09-30 20:00:00'
};

test('Memory retrieval keeps place/date constraints when falling back to fragments', async (t) => {
  await t.test('只有厦门记录时，查询上海旅行必须如实告知未找到，而不是返回厦门照片', async () => {
    const db = createDb({ photos: [XIAMEN_PHOTO] });
    try {
      const mem = searchMemories(db, '找上海旅行的照片');
      assert.deepEqual(mem.constraints.anchors, ['上海'], 'Shanghai must be kept as a hard constraint');
      assert.equal(mem.matchedPhotos.length, 0, 'Must not fall back to the Xiamen photo');
      assert.equal(mem.primaryMemory, null);
      assert.equal(mem.memoryRef, null);

      const res = await chatWithCoupleAgent(db, '找上海旅行的照片', [], 'name1');
      assert.equal(res.success, true);
      assert.equal(res.source, 'local_memory');
      assert.equal(res.memoryRef, null, 'Must not return the Xiamen memory for a Shanghai query');
      assert.ok(res.reply.includes('暂时还没有找到相关的记录'), 'Must honestly report not found');
      assert.ok(!res.reply.includes('厦门旅行'), 'Must not mention the mismatching folder');
    } finally {
      db.close();
    }
  });

  await t.test('库中同时存在上海与厦门记录时，返回请求城市对应的记录', async () => {
    const db = createDb({ photos: [XIAMEN_PHOTO, SHANGHAI_PHOTO] });
    try {
      const resSh = await chatWithCoupleAgent(db, '找上海旅行的照片', [], 'name1');
      assert.equal(resSh.memoryRef?.title, '外滩夜景');
      assert.equal(resSh.memoryRef?.location, '上海旅行');
      assert.equal(resSh.matchQuality, 'exact');

      const resXm = await chatWithCoupleAgent(db, '找厦门旅行的照片', [], 'name1');
      assert.equal(resXm.memoryRef?.title, '厦门旅行看海日落');
      assert.equal(resXm.memoryRef?.location, '厦门旅行');
    } finally {
      db.close();
    }
  });

  await t.test('保留片段回退能力：海边看日落仍能命中厦门旅行看海日落，但标注为相近候选', async () => {
    const db = createDb({ photos: [XIAMEN_PHOTO] });
    try {
      const res = await chatWithCoupleAgent(db, '找海边看日落的照片', [], 'name1');
      assert.equal(res.source, 'local_memory');
      assert.equal(res.matchQuality, 'related', 'Fragment fallback must be flagged as low confidence');
      assert.equal(res.memoryRef?.title, '厦门旅行看海日落');
      assert.ok(res.reply.includes('厦门旅行看海日落'), 'Must still surface the candidate record');
      assert.ok(res.reply.includes('可能相近的回忆'), 'Must describe it as a similar candidate, not an exact hit');
      assert.ok(res.reply.includes('补充地点或日期'), 'Must invite the user to confirm with more detail');
    } finally {
      db.close();
    }
  });

  await t.test('日期限定同样保留：2026年9月的请求不得命中 2025-03 的厦门记录', async () => {
    const oldPhoto = { ...XIAMEN_PHOTO, id: 'photo-old', created_at: '2025-03-02 18:00:00' };
    const dbOld = createDb({ photos: [oldPhoto] });
    try {
      const missed = await chatWithCoupleAgent(dbOld, '找2026年9月厦门旅行的照片', [], 'name1');
      assert.equal(missed.memoryRef, null, 'Date constraint must exclude out-of-range records');
      assert.ok(missed.reply.includes('暂时还没有找到相关的记录'));
    } finally {
      dbOld.close();
    }

    const dbMatch = createDb({ photos: [XIAMEN_PHOTO] });
    try {
      const hit = await chatWithCoupleAgent(dbMatch, '找2026年9月厦门旅行的照片', [], 'name1');
      assert.equal(hit.memoryRef?.title, '厦门旅行看海日落', 'In-range record must still be retrievable');
      assert.equal(hit.matchQuality, 'related');
    } finally {
      dbMatch.close();
    }
  });

  await t.test('故事时间轴的片段回退同样保留地点限定', async () => {
    const stories = [{ id: 'story-xiamen', date: '2026-09-28', title: '厦门旅行看海', content: '海边的风很舒服' }];

    const dbMiss = createDb({ stories });
    try {
      const missed = await chatWithCoupleAgent(dbMiss, '找上海旅行的故事', [], 'name1');
      assert.equal(missed.memoryRef, null, 'Shanghai story request must not return the Xiamen story');
      assert.ok(missed.reply.includes('暂时还没有找到相关的记录'));
    } finally {
      dbMiss.close();
    }

    const dbHit = createDb({ stories });
    try {
      const hit = await chatWithCoupleAgent(dbHit, '找厦门旅行的故事', [], 'name1');
      assert.equal(hit.memoryRef?.title, '厦门旅行看海', 'Matching story must still be retrievable');
      assert.equal(hit.memoryRef?.type, 'story');
    } finally {
      dbHit.close();
    }
  });

  await t.test('searchMemories 暴露限定条件与命中质量，便于观测回退行为', () => {
    const db = createDb({ photos: [XIAMEN_PHOTO] });
    try {
      const miss = searchMemories(db, '找上海旅行的照片');
      assert.deepEqual(miss.constraints.anchors, ['上海']);
      assert.equal(miss.matchQuality, null);

      const hit = searchMemories(db, '找厦门旅行的照片');
      assert.equal(hit.matchQuality, 'exact');
      assert.deepEqual(hit.constraints.anchors, ['厦门']);

      const fuzzy = searchMemories(db, '找海边看日落的照片');
      assert.equal(fuzzy.matchQuality, 'related');
    } finally {
      db.close();
    }
  });

  // ==========================================================================
  // 第四轮复审：不得在专名内部按单字删除虚词（成都、和田、太原、个旧、从化……）
  // ==========================================================================
  await t.test('专名内部的虚词不会被删除：城市名仍是硬限定（复审 成都 负例/正例）', async () => {
    // 这些城市名恰好包含会被当作虚词的字：都/和/太/个/从
    for (const city of ['成都', '和田', '太原', '个旧', '从化']) {
      const dbMiss = createDb({ photos: [XIAMEN_PHOTO] });
      try {
        const mem = searchMemories(dbMiss, `找${city}旅行的照片`);
        assert.deepEqual(mem.constraints.anchors, [city], `${city} must survive anchor extraction intact`);
        assert.equal(mem.primaryMemory, null, `Only Xiamen exists: ${city} must not return the Xiamen photo`);

        const res = await chatWithCoupleAgent(dbMiss, `找${city}旅行的照片`, [], 'name1');
        assert.equal(res.memoryRef, null, `${city} query must not return the Xiamen memory`);
        assert.ok(res.reply.includes('暂时还没有找到相关的记录'), `${city} query must answer honestly`);
        assert.ok(!res.reply.includes('厦门'), `${city} query must not mention Xiamen`);
      } finally {
        dbMiss.close();
      }

      const cityPhoto = {
        ...XIAMEN_PHOTO,
        id: `photo-${city}`,
        folder: `/${city}旅行`,
        title: `${city}街头漫步`,
        created_at: '2026-10-02 10:00:00'
      };
      const dbHit = createDb({ photos: [XIAMEN_PHOTO, cityPhoto] });
      try {
        const memHit = searchMemories(dbHit, `找${city}旅行的照片`);
        assert.deepEqual(memHit.constraints.anchors, [city]);
        assert.equal(memHit.primaryMemory?.id, `photo-${city}`, `Coexisting records: ${city} must win over Xiamen`);

        const resHit = await chatWithCoupleAgent(dbHit, `找${city}旅行的照片`, [], 'name1');
        assert.equal(resHit.memoryRef?.location, `${city}旅行`, `Coexisting records: ${city} must be returned`);
      } finally {
        dbHit.close();
      }
    }

    // 三个字且以虚词开头的专名（都江堰）：只在两端裁剪且至少保留两个字，仍然指向正确目录
    const dbThree = createDb({
      photos: [
        XIAMEN_PHOTO,
        { ...XIAMEN_PHOTO, id: 'photo-dujiangyan', folder: '/都江堰旅行', title: '都江堰的清晨', created_at: '2026-10-03 09:00:00' }
      ]
    });
    try {
      const mem = searchMemories(dbThree, '找都江堰旅行的照片');
      assert.equal(mem.primaryMemory?.id, 'photo-dujiangyan');
      const miss = searchMemories(createDb({ photos: [XIAMEN_PHOTO] }), '找都江堰旅行的照片');
      assert.equal(miss.primaryMemory, null, 'Du Jiangyan must not fall back to the Xiamen photo');
    } finally {
      dbThree.close();
    }
  });

  // ==========================================================================
  // 第四轮复审：限定条件必须在 SQL 中生效，不能先 LIMIT 5 再过滤
  // ==========================================================================
  await t.test('日期限定下推到 SQL：五张更新的同目录照片不会挤掉符合条件的老照片', async () => {
    const newerPhotos = [1, 2, 3, 4, 5].map((i) => ({
      ...XIAMEN_PHOTO,
      id: `new-${i}`,
      title: '海边看日落',
      created_at: `2026-10-0${i} 18:00:00`
    }));
    const wanted = { ...XIAMEN_PHOTO, id: 'wanted', title: '海边看日落', created_at: '2026-09-28 18:00:00' };
    const db = createDb({ photos: [wanted, ...newerPhotos] });
    try {
      const query = '找2026年9月厦门旅行的照片';
      const mem = searchMemories(db, query);
      assert.equal(mem.primaryMemory?.id, 'wanted', 'September photo must survive five newer matches');
      assert.equal(mem.primaryMemory?.date, '2026.09.28');
      assert.ok(mem.matchedPhotos.length > 0);
      assert.ok(
        mem.matchedPhotos.every((p) => String(p.created_at).includes('2026-09')),
        'Every returned candidate must satisfy the date constraint'
      );

      const res = await chatWithCoupleAgent(db, query, [], 'name1');
      assert.equal(res.memoryRef?.id, 'wanted');
      assert.equal(res.matchQuality, 'related');
    } finally {
      db.close();
    }
  });

  await t.test('限定条件之外仍保持取最新五条的原有语义', async () => {
    // 六张都符合“2026年9月厦门旅行”，应按创建时间取最新五张，最新的一张作为展签
    const photos = [1, 2, 3, 4, 5, 6].map((i) => ({
      ...XIAMEN_PHOTO,
      id: `sep-${i}`,
      title: '海边看日落',
      created_at: `2026-09-0${i} 18:00:00`
    }));
    const db = createDb({ photos });
    try {
      const mem = searchMemories(db, '找2026年9月厦门旅行的照片');
      assert.equal(mem.matchedPhotos.length, 5, 'LIMIT 5 must still apply after filtering');
      assert.equal(mem.matchedPhotos[0].id, 'sep-6');
      assert.equal(mem.primaryMemory?.id, 'sep-6');
    } finally {
      db.close();
    }
  });
});
