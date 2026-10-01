import { getTodayDateString, getNowDateTimeString } from '../../utils/date.js';

export function getTodayTasks(db, userId) {
  const today = getTodayDateString();

  return db.transaction(() => {
    let instances = db.prepare('SELECT * FROM task_daily_instances WHERE business_date = ?').all(today);

    // If none exist for today, pick 3 random tasks from pool
    if (instances.length === 0) {
      const allTasks = db.prepare('SELECT * FROM tasks WHERE is_active = 1').all();
      if (allTasks.length > 0) {
        // Shuffle and pick up to 3
        const shuffled = [...allTasks].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        const insertDaily = db.prepare(`
          INSERT INTO task_daily_instances (id, business_date, task_id, title, description, reward, completed_by, confirmed_by, reward_given)
          VALUES (?, ?, ?, ?, ?, ?, '[]', '[]', 0)
        `);
        for (const t of selected) {
          const instId = `dt_${t.id}_${today}`;
          insertDaily.run(instId, today, t.id, t.title, t.description || '', t.reward);
        }
        instances = db.prepare('SELECT * FROM task_daily_instances WHERE business_date = ?').all(today);
      }
    }

    // Determine partner
    const currentUser = db.prepare('SELECT partner_id FROM users WHERE id = ?').get(userId);
    const partnerId = currentUser?.partner_id;

    // Compute task state per user
    return instances.map(inst => {
      let completedBy = [];
      let confirmedBy = [];
      try { completedBy = JSON.parse(inst.completed_by || '[]'); } catch (e) {}
      try { confirmedBy = JSON.parse(inst.confirmed_by || '[]'); } catch (e) {}

      const iCompleted = completedBy.includes(userId);
      const partnerCompleted = partnerId ? completedBy.includes(partnerId) : completedBy.some(id => id !== userId);
      const isRewarded = inst.reward_given === 1 || confirmedBy.length > 0;

      let state = 'pending';
      if (isRewarded) {
        state = 'done';
      } else if (iCompleted) {
        state = 'my_completed';
      } else if (partnerCompleted) {
        state = 'pending_partner';
      }

      return {
        id: inst.id,
        task_id: inst.task_id,
        title: inst.title,
        description: inst.description,
        reward: inst.reward,
        date: inst.business_date,
        completed_by: completedBy,
        confirmed_by: confirmedBy,
        reward_given: inst.reward_given === 1,
        state
      };
    });
  })();
}

export function markTaskComplete(db, userId, instanceId) {
  return db.transaction(() => {
    const inst = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get(instanceId);
    if (!inst) {
      return { success: false, message: '任务不存在' };
    }
    if (inst.reward_given === 1) {
      return { success: false, message: '任务已完成并已结算' };
    }

    let completedBy = [];
    try { completedBy = JSON.parse(inst.completed_by || '[]'); } catch (e) {}

    if (!completedBy.includes(userId)) {
      completedBy.push(userId);
      db.prepare('UPDATE task_daily_instances SET completed_by = ? WHERE id = ?').run(
        JSON.stringify(completedBy),
        instanceId
      );
    }

    return { success: true, message: '已标记完成，等待对方确认 💕' };
  })();
}

export function uncompleteTask(db, userId, instanceId) {
  return db.transaction(() => {
    const inst = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get(instanceId);
    if (!inst) {
      return { success: false, message: '任务不存在' };
    }
    if (inst.reward_given === 1) {
      return { success: false, message: '任务已完成并发放奖励，无法取消' };
    }

    let completedBy = [];
    try { completedBy = JSON.parse(inst.completed_by || '[]'); } catch (e) {}

    const index = completedBy.indexOf(userId);
    if (index !== -1) {
      completedBy.splice(index, 1);
      db.prepare('UPDATE task_daily_instances SET completed_by = ? WHERE id = ?').run(
        JSON.stringify(completedBy),
        instanceId
      );
    }

    return { success: true, message: '已取消完成状态' };
  })();
}

export function confirmPartnerTask(db, userId, instanceId) {
  return db.transaction(() => {
    const inst = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get(instanceId);
    if (!inst) {
      return { success: false, message: '任务不存在' };
    }
    if (inst.reward_given === 1) {
      return { success: false, message: '任务已发放过奖励，不可重复发放' };
    }

    // Determine partner
    const currentUser = db.prepare('SELECT id, partner_id FROM users WHERE id = ?').get(userId);
    let partnerId = currentUser?.partner_id;
    if (!partnerId) {
      // Find user whose partner_id is userId
      const other = db.prepare('SELECT id FROM users WHERE partner_id = ?').get(userId);
      partnerId = other?.id;
    }

    let completedBy = [];
    try { completedBy = JSON.parse(inst.completed_by || '[]'); } catch (e) {}

    const partnerCompleted = partnerId ? completedBy.includes(partnerId) : completedBy.some(id => id !== userId);
    if (!partnerCompleted) {
      return { success: false, message: '对方尚未标记完成该任务' };
    }

    const reward = Number(inst.reward || 10);
    const nowTime = getNowDateTimeString();

    // Reward both users
    const usersToReward = partnerId ? [userId, partnerId] : [userId];
    for (const uid of usersToReward) {
      const u = db.prepare('SELECT balance FROM users WHERE id = ?').get(uid);
      if (u) {
        const newBalance = Number(u.balance) + reward;
        db.prepare('UPDATE users SET balance = ?, total_earned = total_earned + ? WHERE id = ?').run(newBalance, reward, uid);
        db.prepare(`
          INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, description, reference_id, idempotency_key, created_at)
          VALUES (?, ?, 'task_reward', ?, ?, ?, ?, ?, ?)
        `).run(
          `tx_task_${inst.id}_${uid}`,
          uid,
          reward,
          newBalance,
          `完成任务奖励: ${inst.title}`,
          inst.id,
          `task_${inst.id}_${uid}`,
          nowTime
        );
      }
    }

    const confirmedBy = [userId];
    db.prepare('UPDATE task_daily_instances SET confirmed_by = ?, reward_given = 1 WHERE id = ?').run(
      JSON.stringify(confirmedBy),
      instanceId
    );

    return {
      success: true,
      message: `已确认对方完成，双方各获得 ${reward} 爱心币！🎉`,
      reward
    };
  })();
}
