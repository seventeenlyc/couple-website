import { getTodayDateString, calculateLoveDuration } from '../../utils/date.js';
import { getStoryTimeline } from '../story/story.service.js';

const FALLBACK_QUOTES = [
  '遇你如初春微风，拂过心头，暖了岁月。',
  '山河远阔，人间烟火，无一是你，无一不是你。',
  '想和你一起走过四季，看满庭花开，数漫天繁星。',
  '浮世三千，吾爱有三：日、月与卿。日为朝，月为暮，卿为朝朝暮暮。',
  '你是云间的月，也是心底的甜。',
  '世界上最美好的事，莫过于你在闹，我在笑。',
  '晓看天色暮看云，行也思君，坐也思君。',
  '情不知所起，一往而深；你在身旁，便是人间最好的光景。'
];

export async function getDailyQuote(db) {
  const today = getTodayDateString();

  // Check if AI is enabled in config
  let aiConfig = null;
  const cfg = db.prepare("SELECT value FROM site_config WHERE key = 'ai'").get();
  if (cfg) {
    try {
      aiConfig = JSON.parse(cfg.value);
    } catch (e) {}
  }

  if (aiConfig && aiConfig.enabled && aiConfig.api_key) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${aiConfig.base_url || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiConfig.api_key}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个浪漫温暖的情话生成助手，请为相爱的情侣生成一句简短深情、文笔优美的爱情话语（30字以内），不要包含解释或多余标点。'
            },
            {
              role: 'user',
              content: '请生成一句今天的专属情话'
            }
          ],
          max_tokens: 60,
          temperature: 0.8
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          return {
            success: true,
            quote: content,
            source: 'ai',
            date: today
          };
        }
      }
    } catch (e) {
      // Fallback on timeout or network error
    }
  }

  // Fallback quote
  const randomIndex = Math.floor(Math.random() * FALLBACK_QUOTES.length);
  return {
    success: true,
    quote: FALLBACK_QUOTES[randomIndex],
    source: 'local',
    date: today
  };
}

export function getAnniversaryReminders(db) {
  const startRow = db.prepare("SELECT value FROM site_config WHERE key = 'startDate'").get();
  const startDate = startRow ? startRow.value : '2025-02-05';
  const today = getTodayDateString();

  const currentYear = parseInt(today.slice(0, 4), 10);
  const now = new Date(`${today}T00:00:00+08:00`);

  const specialDatesRow = db.prepare("SELECT value FROM site_config WHERE key = 'specialDates'").get();
  let specialDates = {};
  if (specialDatesRow) {
    try {
      specialDates = JSON.parse(specialDatesRow.value);
    } catch (e) {}
  }

  const allItems = [];

  // 1. Anniversary
  const annivMMDD = startDate.slice(5);
  let nextAnnivDate = new Date(`${currentYear}-${annivMMDD}T00:00:00+08:00`);
  if (nextAnnivDate < now) {
    nextAnnivDate = new Date(`${currentYear + 1}-${annivMMDD}T00:00:00+08:00`);
  }
  const diffAnnivDays = Math.round((nextAnnivDate.getTime() - now.getTime()) / (1000 * 86400));
  allItems.push({
    type: 'anniversary',
    name: specialDates.anniversary?.name || '恋爱纪念日',
    date: annivMMDD,
    days_until: diffAnnivDays,
    icon: '💕',
    message: diffAnnivDays === 0 ? '今天是恋爱纪念日！💕' : `还有 ${diffAnnivDays} 天就是恋爱纪念日啦`
  });

  // 2. Birthdays from config and users
  const users = db.prepare('SELECT username, birthday FROM users').all();
  for (const u of users) {
    if (!u.birthday) continue;
    let bDate = new Date(`${currentYear}-${u.birthday}T00:00:00+08:00`);
    if (bDate < now) {
      bDate = new Date(`${currentYear + 1}-${u.birthday}T00:00:00+08:00`);
    }
    const diffDays = Math.round((bDate.getTime() - now.getTime()) / (1000 * 86400));
    allItems.push({
      type: 'birthday',
      name: `${u.username}的生日`,
      date: u.birthday,
      days_until: diffDays,
      icon: '🎂',
      message: diffDays === 0 ? `今天是${u.username}的生日！🎂` : `还有 ${diffDays} 天就是${u.username}的生日啦`
    });
  }

  // Sort by days_until
  allItems.sort((a, b) => a.days_until - b.days_until);

  const reminders = allItems.map(item => {
    if (item.days_until === 0) {
      item.is_today = true;
    }
    return item;
  });

  return {
    success: true,
    reminders
  };
}

// 日期/时间表达：片段回退时属于硬性限定条件，命中记录必须同时满足
// 支持 2026-09-28 / 2026/9/28 / 2026年9月 / 2026年 / 9月 / 9月28日
const MEMORY_DATE_TOKEN_SOURCE = '(20\\d{2})\\s*(?:[-/.年]\\s*(\\d{1,2})\\s*(?:[-/.月]\\s*(\\d{1,2})\\s*[日号]?|月)?)?|(\\d{1,2})\\s*月\\s*(?:(\\d{1,2})\\s*[日号])?';
const newMemoryDateRegex = () => new RegExp(MEMORY_DATE_TOKEN_SOURCE, 'g');

// 通用类别/描述词：只说明“属于哪一类回忆”，不能单独作为地点等限定条件。
// 片段回退匹配必须保留查询中的实体词，避免“上海旅行”被“厦门旅行”里的公共片段“旅行”命中。
const MEMORY_GENERIC_WORDS = [
  '旅行', '旅游', '出游', '出行', '游玩', '旅程', '徒步', '露营', '散步', '漫步',
  '约会', '聚餐', '下午茶', '美食', '餐厅', '咖啡', '蛋糕', '甜品',
  '生日', '纪念日', '节日', '春节', '圣诞', '元旦', '跨年',
  '照片', '相册', '图片', '图像', '影像', '回忆', '故事', '记录', '瞬间',
  '日常', '生活', '点滴', '时光', '风景', '景色', '夜景', '日落', '日出', '晚霞', '夕阳',
  '海边', '海滩', '沙滩', '海水', '公园', '书店', '宠物', '猫咪', '小狗',
  '礼物', '信件', '悄悄话', '我们', '一起', '时候', '地方', '那次', '那天',
  // 相对时间词：属于“什么时候”，不是地点/专名，不能当作实体限定
  '去年', '今年', '明年', '前年', '当年', '年初', '年底', '月初', '月底', '上月', '本月',
  '这个月', '这周', '上周', '本周', '最近', '当时', '暑假', '寒假',
  '春天', '夏天', '秋天', '冬天', '周末', '假期', '国庆', '五一', '中秋', '端午', '新年'
];

// 可在专名“内部”安全切分的动词/助词：这些字几乎不会出现在中文地名或专名里，
// 例如“厦门看海日落”“厦门拍的日落”“去滑雪”。其余虚词一律不在专名内部切分。
const MEMORY_INNER_SPLIT_CHARS = '看找想瞧拍的着了逛翻带录摄搜查询玩吃喝住睡走跑坐听读买唱跳';

// 只允许在片段“两端”去除的虚词。它们可能本身就在专名内部（成都、和田、太原、个旧、
// 从化、那曲……），因此仅在去除后仍至少保留两个字时才去除，避免“成都”被削成单字。
const MEMORY_EDGE_TRIM_CHARS = '的了着过去来和与在是到从把被就都也还又很太会能要有个张段次些点位吗呢吧啊呀哦嗯我你他她它们这那哪什么怎想找看';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 提取查询中的日期限定（年 / 年月 / 年月日 / 月 / 月日）
 */
function extractMemoryDateConstraints(rawText) {
  const text = String(rawText || '');
  const out = [];
  const push = (v) => { if (v && !out.includes(v)) out.push(v); };

  const re = newMemoryDateRegex();
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) {
      const mm = m[2] ? parseInt(m[2], 10) : null;
      if (!mm || mm < 1 || mm > 12) { push(m[1]); continue; }
      if (m[3]) push(`${m[1]}-${pad2(mm)}-${pad2(parseInt(m[3], 10))}`);
      else push(`${m[1]}-${pad2(mm)}`);
    } else if (m[4]) {
      const mm = parseInt(m[4], 10);
      if (mm >= 1 && mm <= 12) {
        push(m[5] ? `-${pad2(mm)}-${pad2(parseInt(m[5], 10))}` : `-${pad2(mm)}-`);
      }
    }
  }
  return out;
}

/**
 * 从查询中提取“实体限定词”（地点、专名等）。
 *
 * 规则（回应复审“不要在专名内部按单字删除虚词”）：
 *   1. 通用类别词、日期、标点是切分边界；
 *   2. 只有 MEMORY_INNER_SPLIT_CHARS 里几乎不会出现在专名中的动词/助词才允许在内部切分；
 *   3. 其余虚词只在片段两端去除，且去除后必须仍保留至少两个字——
 *      所以“成都/和田/太原/个旧/从化”不会被削成单字或空串；
 *   4. 纯虚词残片不作限定条件，单字残片同样不作限定条件。
 * 例：“成都旅行” → ['成都']；“上海旅行” → ['上海']；“厦门旅行看海日落” → ['厦门']；
 *     “海边看日落” → []（没有实体词，允许自由片段回退）。
 */
function extractMemoryAnchors(compact) {
  const source = String(compact || '').replace(newMemoryDateRegex(), ' ');
  if (!source) return [];
  const words = [...MEMORY_GENERIC_WORDS].sort((a, b) => b.length - a.length);

  const rawRuns = [];
  let buf = '';
  const flush = () => { if (buf) rawRuns.push(buf); buf = ''; };
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(ch)) { flush(); i += 1; continue; }
    if (MEMORY_INNER_SPLIT_CHARS.includes(ch)) { flush(); i += 1; continue; }
    const hit = words.find((w) => source.startsWith(w, i));
    if (hit) { flush(); i += hit.length; continue; }
    buf += ch;
    i += 1;
  }
  flush();

  const anchors = [];
  for (const run of rawRuns) {
    let text = run;
    while (text.length > 2 && MEMORY_EDGE_TRIM_CHARS.includes(text[0])) text = text.slice(1);
    while (text.length > 2 && MEMORY_EDGE_TRIM_CHARS.includes(text[text.length - 1])) text = text.slice(0, -1);
    if (text.length < 2) continue;
    // 整段都是虚词/动词的残片不构成地点限定（例如“想去”）
    if (![...text].some((ch) => !MEMORY_EDGE_TRIM_CHARS.includes(ch) && !MEMORY_INNER_SPLIT_CHARS.includes(ch))) continue;
    anchors.push(text);
  }
  return [...new Set(anchors)];
}

function photoHaystack(p) {
  return [p.title, p.description, p.tags, p.folder_path, p.filename]
    .map((v) => String(v || '').toLowerCase())
    .join('\u0001');
}

function storyHaystack(s) {
  return [s.title, s.content, s.date].map((v) => String(v || '').toLowerCase()).join('\u0001');
}

function satisfiesConstraints(haystack, dateText, constraints) {
  return constraints.anchors.every((a) => haystack.includes(a))
    && constraints.dates.every((d) => String(dateText || '').includes(d));
}

// 与 photoHaystack 保持一致的检索字段
const PHOTO_TEXT_FIELDS = ['title', 'description', 'tags', 'folder_path', 'filename'];

const PHOTO_SELECT = `SELECT id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, created_at
      FROM album_photos`;

/** 生成“任一字段包含 value”的 SQL 片段，并把参数按顺序压入 params */
function photoAnyFieldMatch(value, params) {
  const parts = PHOTO_TEXT_FIELDS.map((field) => `instr(lower(ifnull(${field}, '')), ?) > 0`);
  params.push(...PHOTO_TEXT_FIELDS.map(() => value));
  return `(${parts.join(' OR ')})`;
}

/**
 * 把实体限定词与日期限定下推到 SQL 的 WHERE 中。
 * 这样 LIMIT 5 作用在“已过滤”的结果上，避免“先取最新五张、再过滤”导致
 * 符合条件的老照片（例如第 6 张）永远进不了候选。
 */
function photoConstraintClause(constraints, params) {
  const clauses = [];
  for (const anchor of constraints.anchors) {
    clauses.push(photoAnyFieldMatch(anchor, params));
  }
  for (const date of constraints.dates) {
    clauses.push(`instr(lower(ifnull(created_at, '')), ?) > 0`);
    params.push(date);
  }
  return clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';
}

/**
 * 检索真实相册与故事记忆
 */
export function searchMemories(db, userMessage) {
  const clean = (userMessage || '').trim();
  const text = clean.toLowerCase();

  // 1. 获取故事轴事件
  const timelineData = getStoryTimeline(db);
  const allStories = Array.isArray(timelineData?.events) ? timelineData.events : [];

  // 2. 提取有效搜索词（过滤口语噪音与量词助词动词）
  const stopWords = [
    '找一段', '帮我找', '我想看看', '我想看', '带我看看', '带我找找', '带我找', '看看有没有', '看看', '有没有', '关于', 
    '相册里的', '照片里的', '故事里的', '相册中', '照片中', '回忆里',
    '找找', '想看', '带我', '以前的', '曾经的', '以前', '曾经', '那次', '过去', '翻翻',
    '一段', '我们', '你们', '我想', '回忆', '相册', '照片', '故事', '记录',
    '的那张', '那张', '的这张', '这张', '那段', '这段', '那些', '这些', '一张', '几张', '的', '那', '这'
  ];
  let searchWord = text;
  for (const sw of stopWords) {
    searchWord = searchWord.replaceAll(sw, '');
  }
  // 去除句首残留的动作动词（避免全局误删“海边看日落”里的“看”，同时支持“找厦门旅行”剥离句首动词）
  searchWord = searchWord.replace(/^(找找|找一下|看一下|翻一下|看看|想看|帮找|找|看|搜|查)/, '').trim();

  // 3. 提取限定条件（地点/专名等实体词与日期）。片段回退必须保留这些条件：
  //    只有“厦门旅行”记录时，查询“上海旅行”不得因公共片段“旅行”而返回厦门照片。
  const constraints = {
    anchors: extractMemoryAnchors(searchWord),
    dates: extractMemoryDateConstraints(clean)
  };

  // 4. 检索相册照片（整词双向匹配优先，片段回退需满足全部限定条件）
  let matchedPhotos = [];
  let matchQuality = null;
  if (searchWord.length >= 1) {
    const exactParams = [];
    const exactForward = photoAnyFieldMatch(searchWord, exactParams);
    exactParams.push(searchWord); // 反向子串：记录标题被查询整体包含
    const exactFilter = `(${exactForward} OR (length(ifnull(title, '')) >= 2 AND instr(?, lower(ifnull(title, ''))) > 0))`;
    const exactRows = db.prepare(`
      ${PHOTO_SELECT}
      WHERE ${exactFilter}${photoConstraintClause(constraints, exactParams)}
      ORDER BY created_at DESC
      LIMIT 5
    `).all(...exactParams);

    // 反向子串命中（记录标题被查询整体包含）同样要满足地点/日期限定
    const keptExactRows = exactRows.filter((p) => {
      const hay = photoHaystack(p);
      if (hay.includes(searchWord)) return true;
      return satisfiesConstraints(hay, p.created_at, constraints);
    });
    if (keptExactRows.length > 0) {
      matchedPhotos = keptExactRows;
      matchQuality = exactRows.some((p) => photoHaystack(p).includes(searchWord)) ? 'exact' : 'related';
    }

    // 全词未命中时尝试多字词片段匹配（支持“海边看日落”命中“厦门旅行看海日落”），
    // 实体与日期限定同样下推到 SQL，再 ORDER BY + LIMIT，避免截断丢失有效候选。
    // 两段式：先按完整实体词匹配；无结果时再退到“实体词前两字”（例如“厦门漂亮”→“厦门”），
    // 保证“成都旅行”这类城市限定在任何阶段都不会被丢掉。
    if (matchedPhotos.length === 0 && searchWord.length >= 3) {
      const subTokens = [];
      for (let len = 3; len >= 2; len--) {
        for (let i = 0; i <= searchWord.length - len; i++) {
          const tok = searchWord.slice(i, i + len);
          if (!subTokens.includes(tok)) subTokens.push(tok);
        }
      }

      const anchorTiers = [constraints.anchors];
      const prefixAnchors = constraints.anchors.map((a) => (a.length > 2 ? a.slice(0, 2) : a));
      if (prefixAnchors.some((a, i) => a !== constraints.anchors[i])) anchorTiers.push(prefixAnchors);

      for (const tierAnchors of anchorTiers) {
        const tierConstraints = { anchors: tierAnchors, dates: constraints.dates };
        let tierResult = null;
        for (const tok of subTokens) {
          const tokenParams = [];
          const tokenFilter = photoAnyFieldMatch(tok, tokenParams);
          const subMatches = db.prepare(`
            ${PHOTO_SELECT}
            WHERE ${tokenFilter}${photoConstraintClause(tierConstraints, tokenParams)}
            ORDER BY created_at DESC
            LIMIT 5
          `).all(...tokenParams);
          const constrained = subMatches.filter((p) =>
            satisfiesConstraints(photoHaystack(p), p.created_at, tierConstraints)
          );
          if (constrained.length > 0) {
            tierResult = constrained;
            break;
          }
        }
        if (tierResult) {
          matchedPhotos = tierResult;
          matchQuality = 'related';
          break;
        }
      }
    }
  }

  // 5. 检索故事（整词双向匹配优先，片段回退同样需满足全部限定条件）
  let matchedStories = [];
  if (searchWord.length >= 1) {
    const keptStoryRows = allStories.filter((s) => {
      const hay = storyHaystack(s);
      if (hay.includes(searchWord)) return true;
      const sTitle = (s.title || '').toLowerCase();
      return sTitle.length >= 2 && searchWord.includes(sTitle) && satisfiesConstraints(hay, s.date, constraints);
    });
    if (keptStoryRows.length > 0) {
      matchedStories = keptStoryRows;
      if (!matchQuality) {
        matchQuality = allStories.some((s) => storyHaystack(s).includes(searchWord)) ? 'exact' : 'related';
      }
    }

    if (matchedStories.length === 0 && searchWord.length >= 3) {
      const subTokens = [];
      for (let len = 3; len >= 2; len--) {
        for (let i = 0; i <= searchWord.length - len; i++) {
          const tok = searchWord.slice(i, i + len);
          if (!subTokens.includes(tok)) subTokens.push(tok);
        }
      }
      for (const tok of subTokens) {
        const subMatches = allStories.filter(s => {
          const sTitle = (s.title || '').toLowerCase();
          const sContent = (s.content || '').toLowerCase();
          return sTitle.includes(tok) || sContent.includes(tok);
        }).filter((s) => satisfiesConstraints(storyHaystack(s), s.date, constraints));
        if (subMatches.length > 0) {
          matchedStories = subMatches;
          if (!matchQuality) matchQuality = 'related';
          break;
        }
      }
    }
  }

  // 6. 如果没有指定特定搜索词，但在泛化提问“找一段回忆/相册/照片/故事”，回退至真实最新/精选记录
  const isGenericMemoryQuery = (!searchWord || searchWord.length === 0) && /找一段回忆|回忆|相册|照片|故事|以前|过往|翻翻/i.test(text);
  if (matchedPhotos.length === 0 && matchedStories.length === 0 && isGenericMemoryQuery) {
    matchedPhotos = db.prepare(`
      SELECT id, folder_path, filename, original_path, thumbnail_path, title, description, tags, uploaded_by, created_at
      FROM album_photos
      ORDER BY created_at DESC
      LIMIT 3
    `).all();
    matchedStories = allStories.slice(0, 3);
    if (matchedPhotos.length > 0 || matchedStories.length > 0) matchQuality = 'generic';
  }

  // 7. 构造统一的结构化记忆与前端来源引用 (memoryRef)
  let primaryMemory = null;
  let memoryRef = null;

  if (matchedPhotos.length > 0) {
    const p = matchedPhotos[0];
    primaryMemory = {
      kind: 'photo',
      id: p.id,
      title: p.title || p.filename || '相册瞬间',
      date: (p.created_at || '').slice(0, 10).replace(/-/g, '.'),
      location: p.folder_path && p.folder_path !== '/' ? p.folder_path.replace(/^\/+/, '') : '生活相册',
      thumb: p.thumbnail_path || p.original_path,
      url: p.original_path,
      description: p.description || '',
      tags: p.tags || ''
    };
    memoryRef = {
      id: primaryMemory.id,
      title: primaryMemory.title,
      date: primaryMemory.date,
      location: primaryMemory.location,
      thumb: primaryMemory.thumb,
      url: primaryMemory.url,
      type: 'photo'
    };
  } else if (matchedStories.length > 0) {
    const s = matchedStories[0];
    const sPhoto = s.photos?.[0];
    primaryMemory = {
      kind: 'story',
      id: s.id,
      title: s.title || '故事时光',
      date: (s.date || '').replace(/-/g, '.'),
      location: s.source === 'anniversary' ? '恋爱纪念' : (s.source === 'start' ? '恋爱起点' : '故事时间线'),
      thumb: sPhoto?.thumb_path || sPhoto?.path || '',
      url: sPhoto?.path || '',
      description: s.content || ''
    };
    memoryRef = {
      id: primaryMemory.id,
      title: primaryMemory.title,
      date: primaryMemory.date,
      location: primaryMemory.location,
      thumb: primaryMemory.thumb,
      url: primaryMemory.url,
      type: 'story'
    };
  }

  return {
    matchedPhotos,
    matchedStories,
    primaryMemory,
    memoryRef,
    searchWord,
    matchQuality,
    constraints
  };
}

/**
 * 留言 / 悄悄话草稿生成
 */
export function generateWhisperDrafts(coupleContext, userMessage) {
  const { diffDays, partnerName } = coupleContext;
  const toWhom = partnerName || '你';
  const text = (userMessage || '').toLowerCase();

  if (/想你|想ta|思念|见|好想/.test(text)) {
    return {
      type: 'whisper',
      action_label: '写成悄悄话',
      options: [
        `今天路上看到一片好看的晚霞，第一反应就是拍给你看。不在一起的时候，也总在想你。`,
        `相伴的第${diffDays}天，想你的心绪没有变少，反而越来越笃定。今晚下班一起吃点好吃的吧。`,
        `今日份想念已准时送达～如果打了喷嚏，那一定是我在想你呀 💕`
      ]
    };
  }

  if (/哄|道歉|对不起|吵架|生气|抱抱/.test(text)) {
    return {
      type: 'whisper',
      action_label: '写成悄悄话',
      options: [
        `刚才是我太着急了，说的话没有顾及你的感受。我很在意你，不想隔着屏幕闹别扭，等下听我好好抱抱你好吗？`,
        `对不起呀，刚才是我态度不够温和。我们在一起${diffDays}天，每一次磨合都让我更懂怎么爱你，别生我气啦。`,
        `给世界上最好的${toWhom}送上一张「无条件和好券」！刚才都是我不对，晚饭带你去吃想吃的那家店好不好？`
      ]
    };
  }

  if (/晚安|累|睡觉/.test(text)) {
    return {
      type: 'whisper',
      action_label: '写成悄悄话',
      options: [
        `今天辛苦啦。放下白天的琐碎烦恼，好好睡一觉。梦里见，晚安。`,
        `有你在身边的每一天都很踏实。盖好被子，今晚做个甜甜的梦。`,
        `相伴的第${diffDays}天，夜色很美，但还是最喜欢你的眼睛。晚安好梦～`
      ]
    };
  }

  // 默认日常温情三选
  return {
    type: 'whisper',
    action_label: '写成悄悄话',
    options: [
      `今天也想认真地告诉你：平凡的日子里，有你真好。`,
      `相伴走过${diffDays}天，谢谢你一直以来的包容与温暖，今天也要开开心心的。`,
      `提醒一下可爱的${toWhom}：今天也要记得多喝水、按时吃饭，下班我去接你！`
    ]
  };
}

/**
 * 约会 / 周末规划草稿生成
 */
export function generateDatePlanDraft(coupleContext, userMessage, primaryMemory) {
  const { diffDays } = coupleContext;
  const memoryHint = primaryMemory 
    ? `\n\n💡 唤起的回忆灵感：上次在「${primaryMemory.title}」（${primaryMemory.date}）留下的瞬间很美好，这次也可以顺便拍一张同视角的对比照。`
    : '';

  return {
    type: 'date_plan',
    action_label: '记入故事时间线',
    title: '周末漫步与寻味提案',
    content: `【慢调周末约会提案 · 相伴第 ${diffDays} 天】\n\n` +
      `☕ 15:00 - 17:00 寻味慢享\n找一家安静采光好的手冲咖啡馆或甜品小店，选个靠窗的位置，聊聊这一周生活里遇到的小趣事。\n\n` +
      `🌇 17:30 - 18:45 傍晚漫步\n去附近开阔的滨海步道、绿道或老街巷走走，迎着傍晚微风看一场日落余晖，享受只属于两个人的并肩时光。\n\n` +
      `🍲 19:00 - 20:30 温馨晚餐\n去一家一直想尝尝的日式小食堂或温暖的热汤锅店，热气腾腾地结束充实的一天。\n\n` +
      `🎒 贴心小提示：\n• 随身带一件防风薄外套，傍晚散步会有些凉意；\n• 留足手机电量，沿途抓拍几张自然不做作的生活合照。` +
      memoryHint
  };
}

/**
 * 拾光生活助手核心交互
 */
export async function chatWithCoupleAgent(db, message, history = [], currentUsername = null) {
  const perfStart = Date.now();
  const perfLog = { total: 0, setup: 0, retrieval: 0, llm: 0, local: 0 };

  // 1. 用户与伴侣基础事实提取
  const setupStart = Date.now();
  const users = db.prepare('SELECT id, username, birthday FROM users').all();
  const user1 = users[0]?.username || 'name1';
  const user2 = users[1]?.username || 'name2';
  const currentName = currentUsername || user1;
  const partnerName = (currentName === user1 ? user2 : user1) || 'TA';
  const usernames = users.map(u => u.username).join(' 和 ') || `${user1} 和 ${user2}`;

  const startRow = db.prepare("SELECT value FROM site_config WHERE key = 'startDate'").get();
  const startDate = startRow ? startRow.value : '2025-02-05';
  const today = getTodayDateString();
  const duration = calculateLoveDuration(startDate);
  const diffDays = duration.days;

  const coupleContext = {
    diffDays,
    startDate,
    userName: currentName,
    partnerName,
    usernames
  };
  perfLog.setup = Date.now() - setupStart;

  // 2. 真实记忆检索 (相册 + 故事轴)
  const retrievalStart = Date.now();
  const memoryResult = searchMemories(db, message);
  const { primaryMemory, memoryRef, matchQuality, searchWord: memoryKeyword } = memoryResult;
  perfLog.retrieval = Date.now() - retrievalStart;

  // 3. 意图分类：优先识别明确的回忆与相册查询，规划必须结合未来安排语境，杜绝将“旅行照片”误判为约会规划
  const text = (message || '').toLowerCase();
  const isWhisperIntent = /帮我写一句话|帮我写|写留言|留个言|写一句话|悄悄话|想ta|道歉|写封信|写信|草稿/i.test(text);

  // 回忆与相册检索优先识别：显式包含照片、相册、回忆、故事、过往、翻看、寻找记录，或检索到匹配记忆且处于查找语境
  const isMemoryIntent = /找.*照片|看.*照片|相册|照片|回忆|找一段回忆|故事|以前|过往|第一天|纪念日|那次|曾经|翻翻/i.test(text)
    || Boolean(primaryMemory && /找|看|搜|查|那张|那些|在哪|几张|什么时候/i.test(text));

  // 约会规划严格限定为将来计划语境，且排斥回忆查询
  const isDateIntent = !isMemoryIntent && /想想周末怎么过|周末怎么过|怎么过周末|约会.*(计划|安排|去哪|吃什么|提案)|计划去哪|周末安排|约会规划|去哪里玩|去哪玩/i.test(text);

  const isConflictIntent = /吵架|摩擦|生气|冷战|闹别扭|矛盾|不开心|委屈/i.test(text);
  const isExhaustedIntent = /累|压力|好烦|好难|疲惫|焦虑|工作累/i.test(text);

  // 4. 读取 AI 配置
  let aiConfig = null;
  const cfg = db.prepare("SELECT value FROM site_config WHERE key = 'ai'").get();
  if (cfg) {
    try {
      aiConfig = JSON.parse(cfg.value);
    } catch (e) {}
  }

  // 5. 大模型调用 (RAG 真实记忆注入)
  if (aiConfig && aiConfig.enabled && aiConfig.api_key) {
    const llmStart = Date.now();
    try {
      // 提取相册与故事的前 5 条作为真实记忆知识库
      const recentPhotos = db.prepare(`
        SELECT title, folder_path, tags, created_at 
        FROM album_photos 
        ORDER BY created_at DESC 
        LIMIT 5
      `).all();

      const timelineEvents = getStoryTimeline(db)?.events || [];
      const timelineSummaries = timelineEvents.slice(0, 5).map(s => `[${s.date}] ${s.title}: ${s.content || ''}`);

      const memoryFactContext = [
        `两人姓名：${usernames}（当前对话用户是：${currentName}，TA的伴侣是：${partnerName}）`,
        `恋爱开始日期：${startDate}，截至今日已相伴 ${diffDays} 天`,
        `真实相册记录：${recentPhotos.length > 0 ? recentPhotos.map(p => `"${p.title || '照片'}" (日期: ${p.created_at?.slice(0, 10)}, 目录: ${p.folder_path})`).join('；') : '暂无照片'}`,
        `真实故事轴大事记：${timelineSummaries.length > 0 ? timelineSummaries.join('；') : '从恋爱第一天开始'}`,
        primaryMemory ? `检索到的最匹配真实回忆：【${primaryMemory.title}】（日期：${primaryMemory.date}，类型：${primaryMemory.kind === 'photo' ? '相册照片' : '故事里程碑'}）` : ''
      ].filter(Boolean).join('\n');

      const systemPrompt = `你是生活画廊里的AI生活助手「拾光」，负责协助${usernames}聊聊生活、整理想说的话、规划约会与寻找回忆。
【真实记忆背景（务必基于真实事实，严禁虚构未发生的地点或日期）】：
${memoryFactContext}

【交互职责】：
1. 协助整理想说的话与破冰句式，温暖得体，提供清晰可选的草稿；
2. 规划温润有质感的约会/周末安排，贴合两人的相伴生活节奏；
3. 寻找真实过往回忆，若找到请自然提及细节；若画廊中暂无相关记录，诚实说明并温和鼓励他们去记录，绝不编造虚假回忆；
4. 语言风格：温和、真挚、段落短小克制，不生硬说教，不使用夸张华丽辞藻。`;

      // 本地模型网关的正常生成可能超过 6 秒，超时仍覆盖响应正文读取。
      const signal = AbortSignal.timeout(45000);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(Array.isArray(history) ? history.slice(-6) : []),
        { role: 'user', content: message }
      ];

      const res = await fetch(`${aiConfig.base_url || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiConfig.api_key}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'gpt-3.5-turbo',
          messages,
          // 网关的推理 token 也计入输出预算，避免正文被提前截断。
          max_tokens: 2048,
          temperature: 0.7
        }),
        signal
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        perfLog.llm = Date.now() - llmStart;
        if (content && data.choices?.[0]?.finish_reason !== 'length') {
          const draft = isWhisperIntent
            ? generateWhisperDrafts(coupleContext, message)
            : (isDateIntent ? generateDatePlanDraft(coupleContext, message, primaryMemory) : null);

          perfLog.total = Date.now() - perfStart;
          console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms llm=${perfLog.llm}ms`);

          return {
            success: true,
            reply: content,
            source: 'ai',
            companion: '拾光',
            memoryRef: (isMemoryIntent || primaryMemory) ? memoryRef : null,
            draft
          };
        }
      }
    } catch (_) {
      perfLog.llm = Date.now() - llmStart;
      // 接口超时或异常时自动无缝降级到本地真实记忆驱动引擎
    }
  }

  // 6. 本地真实数据驱动引擎 (Local Authentic Engine - 彻底替换死模板)
  const localStart = Date.now();

  // 6.1 留言 / 悄悄话草稿
  if (isWhisperIntent) {
    const draft = generateWhisperDrafts(coupleContext, message);
    const reply = `为你整理了三句温润而真挚的留言短句，点击下方「更多 ···」即可一键填入悄悄话发送给${partnerName}：\n\n` +
      draft.options.map((opt, i) => `${i + 1}. “${opt}”`).join('\n\n') +
      `\n\n挑选一句你最想表达的，或者直接复制微调吧 💕`;

    perfLog.local = Date.now() - localStart;
    perfLog.total = Date.now() - perfStart;
    console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:whisper)`);

    return {
      success: true,
      reply,
      companion: '拾光',
      source: 'local_agent',
      memoryRef: null,
      draft
    };
  }

  // 6.2 寻找真实回忆（优先于规划建议，保证用户查照片/回忆时准确返回真实记录与展签）
  if (isMemoryIntent) {
    if (primaryMemory) {
      // 只有整词精确命中才使用“找到了这段真实回忆”；片段回退的低置信度命中必须说明只是相近候选
      const isFuzzy = matchQuality !== 'exact' && matchQuality !== 'generic';
      let reply = '';
      if (primaryMemory.kind === 'photo') {
        reply = (isFuzzy
          ? `没有找到与「${memoryKeyword}」完全一致的记录，不过在相册「${primaryMemory.location}」里找到一条可能相近的回忆：\n\n`
          : `在相册「${primaryMemory.location}」中找到了这段真实回忆：\n\n`) +
          `📷 ${primaryMemory.title}\n` +
          `📅 记录日期：${primaryMemory.date}\n` +
          (primaryMemory.tags ? `🏷️ 标签：${primaryMemory.tags}\n` : '') +
          (primaryMemory.description ? `💭 当时记下：“${primaryMemory.description}”\n` : '') +
          `\n点击下方展签卡片，即可打开大图重温那天的定格。` +
          (isFuzzy ? `\n\n如果这不是你要找的那一次，可以再补充地点或日期，我再帮你仔细翻找。` : '');
      } else {
        reply = (isFuzzy
          ? `没有找到与「${memoryKeyword}」完全一致的里程碑，不过在故事时间轴里找到一条可能相近的记录：\n\n`
          : `在你们的故事时间轴里找到了这段里程碑：\n\n`) +
          `📖 ${primaryMemory.title}\n` +
          `📅 发生日期：${primaryMemory.date}\n` +
          (primaryMemory.description ? `💭 当时记下：”${primaryMemory.description}”\n` : '') +
          `\n点击下方展签即可重温这一段专属时光。` +
          (isFuzzy ? `\n\n如果这不是你要找的那一次，可以再补充地点或日期，我再帮你仔细翻找。` : '');
      }

      perfLog.local = Date.now() - localStart;
      perfLog.total = Date.now() - perfStart;
      console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:memory_found)`);

      return {
        success: true,
        reply,
        companion: '拾光',
        source: 'local_memory',
        memoryRef,
        matchQuality
      };
    } else {
      perfLog.local = Date.now() - localStart;
      perfLog.total = Date.now() - perfStart;
      console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:memory_not_found)`);

      return {
        success: true,
        reply: `在画廊相册与故事时间轴里，暂时还没有找到相关的记录呢。\n\n相伴的这 ${diffDays} 天里，每一天都有闪光的日常。要不要现在点击顶部的「＋记录」，记下一段新的故事或上传几张照片？`,
        companion: '拾光',
        source: 'local_memory',
        memoryRef: null,
        matchQuality: null
      };
    }
  }

  // 6.3 约会 / 周末规划草稿
  if (isDateIntent) {
    const draft = generateDatePlanDraft(coupleContext, message, primaryMemory);
    const reply = `结合你们相伴的第 ${diffDays} 天，为你整理了一份慢节奏的周末漫步提案：\n\n` +
      draft.content +
      `\n\n你可以点击下方「更多 ···」把这份规划直接记入故事时间线备忘。`;

    perfLog.local = Date.now() - localStart;
    perfLog.total = Date.now() - perfStart;
    console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:date_plan)`);

    return {
      success: true,
      reply,
      companion: '拾光',
      source: 'local_agent',
      memoryRef: memoryRef || null,
      draft
    };
  }

  // 6.4 情绪共情与分歧化解
  if (isConflictIntent) {
    perfLog.local = Date.now() - localStart;
    perfLog.total = Date.now() - perfStart;
    console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:conflict)`);

    return {
      success: true,
      reply: `相伴的这 ${diffDays} 天里，遇到分歧往往是因为彼此都在意对方。\n\n此时不妨先各自平静片刻。试着把容易激化情绪的话，换成真诚的感受表达，例如：\n“刚才我有些着急，但我很在意你的感受，等下我们一起聊聊好吗？”\n\n给对方一个温和的缓冲台阶，往往比争执更能拉近彼此。`,
      companion: '拾光',
      source: 'local_empathy',
      memoryRef: null
    };
  }

  // 6.5 疲惫安慰
  if (isExhaustedIntent) {
    perfLog.local = Date.now() - localStart;
    perfLog.total = Date.now() - perfStart;
    console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:exhausted)`);

    return {
      success: true,
      reply: `今天辛苦啦。感到疲惫的时候不用勉强安排复杂的活动，好好休息最重要。\n\n今晚可以泡个温水澡、早点休息，也可以去心愿小铺为对方兑换一张「肩颈按摩券」，卸下白天的压力。`,
      companion: '拾光',
      source: 'local_empathy',
      memoryRef: null
    };
  }

  // 6.6 默认指引与开场
  perfLog.local = Date.now() - localStart;
  perfLog.total = Date.now() - perfStart;
  console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:default_guide)`);

  return {
    success: true,
    reply: `我是画廊里的生活助手「拾光」。\n\n相伴的第 ${diffDays} 天，我可以帮你：\n1. 整理给对方的留言或悄悄话（试试发“帮我写一句话”）；\n2. 规划周末漫步与约会安排（试试发“想想周末怎么过”）；\n3. 翻找相册与故事里的真实回忆（试试发“找一段回忆”）。\n\n随时写下你想聊的，我都在。`,
    companion: '拾光',
    source: 'local_guide',
    memoryRef: null
  };
}
