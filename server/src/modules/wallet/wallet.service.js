import { getTodayDateString, getNowDateTimeString } from '../../utils/date.js';

export function getUserBalance(db, userId) {
  const row = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  return row ? Number(row.balance) : 0;
}

export function getUserCurrencyInfo(db, userId) {
  const user = db.prepare('SELECT balance, streak_days, last_checkin, total_earned, total_spent FROM users WHERE id = ?').get(userId);
  if (!user) {
    return {
      balance: 0,
      streak_days: 0,
      total_earned: 0,
      total_spent: 0,
      checked_in_today: false,
      last_checkin: null
    };
  }

  const today = getTodayDateString();
  const todayCheckin = db.prepare('SELECT id FROM checkins WHERE user_id = ? AND business_date = ?').get(userId, today)
    || (user.last_checkin === today ? { id: 'user_last_checkin' } : null);
  const lastCheckinRow = db.prepare('SELECT business_date, streak_days FROM checkins WHERE user_id = ? ORDER BY business_date DESC LIMIT 1').get(userId);

  const earnedRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE user_id = ? AND amount > 0').get(userId);
  const spentRow = db.prepare('SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM wallet_transactions WHERE user_id = ? AND amount < 0').get(userId);

  return {
    balance: Number(user.balance),
    streak_days: user.streak_days > 0 ? Number(user.streak_days) : (lastCheckinRow ? Number(lastCheckinRow.streak_days) : 0),
    total_earned: user.total_earned > 0 ? Number(user.total_earned) : Number(earnedRow.total),
    total_spent: user.total_spent > 0 ? Number(user.total_spent) : Number(spentRow.total),
    checked_in_today: !!todayCheckin,
    last_checkin: user.last_checkin || (lastCheckinRow ? lastCheckinRow.business_date : null)
  };
}

export function performCheckin(db, userId) {
  const today = getTodayDateString();

  return db.transaction(() => {
    const user = db.prepare('SELECT balance, last_checkin, streak_days FROM users WHERE id = ?').get(userId);
    if (!user) {
      return { success: false, message: '用户不存在', reward: 0, streak_days: 0 };
    }

    const existing = db.prepare('SELECT id FROM checkins WHERE user_id = ? AND business_date = ?').get(userId, today)
      || (user.last_checkin === today ? { id: 'user_last_checkin' } : null);
    if (existing) {
      return {
        success: false,
        already_checked_in: true,
        message: '今日已签到，明天再来吧 💕',
        reward: 0,
        streak_days: user.streak_days || 1,
        balance: Number(user.balance)
      };
    }

    // Determine yesterday in Asia/Shanghai
    const now = new Date();
    const yesterdayDate = new Date(now.getTime() - 86400 * 1000);
    const yStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(yesterdayDate).replace(/\//g, '-');

    const yesterdayCheckin = db.prepare('SELECT streak_days FROM checkins WHERE user_id = ? AND business_date = ?').get(userId, yStr);
    const streak = yesterdayCheckin ? Number(yesterdayCheckin.streak_days) + 1 : 1;

    const baseReward = 10;
    const bonusPerDay = 2;
    const maxBonus = 20;
    const bonus = Math.min((streak - 1) * bonusPerDay, maxBonus);
    const reward = baseReward + bonus;

    const newBalance = Number(user.balance) + reward;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);

    const checkinId = `chk_${userId}_${today}`;
    db.prepare(`
      INSERT INTO checkins (id, user_id, business_date, streak_days, reward, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(checkinId, userId, today, streak, reward, getNowDateTimeString());

    const txId = `tx_chk_${userId}_${today}`;
    db.prepare(`
      INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, description, reference_id, idempotency_key, created_at)
      VALUES (?, ?, 'checkin', ?, ?, ?, ?, ?, ?)
    `).run(
      txId,
      userId,
      reward,
      newBalance,
      `每日签到奖励 (连续 ${streak} 天)`,
      checkinId,
      checkinId,
      getNowDateTimeString()
    );

    return {
      success: true,
      message: `签到成功！获得 ${reward} 爱心币`,
      reward,
      streak_days: streak,
      balance: newBalance
    };
  })();
}
