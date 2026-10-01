import { getTodayDateString } from '../../utils/date.js';

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
