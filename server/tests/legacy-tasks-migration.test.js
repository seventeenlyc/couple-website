import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runImport } from '../scripts/import-legacy.js';
import { buildApp } from '../src/app.js';
import { closeDb, initDb } from '../src/storage/db.js';
import { getTodayDateString } from '../src/utils/date.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FOURTH-001: the real PHP tasks.json stores daily_tasks as a
// { 'YYYY-MM-DD': [task, ...] } map (see includes/task-helper.php) and keeps
// claimed rewards in status='rewarded'. Import must preserve those instances so
// a claimed task cannot be claimed a second time after migration.
test('FOURTH-001: real PHP daily_tasks map imports with rewarded state', async (t) => {
  const workDir = path.join(__dirname, 'test-fourth-tasks');
  const dbPath = path.join(workDir, 'fixture.db');
  const today = getTodayDateString();
  const historical = '2026-01-15';

  closeDb();
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  fs.writeFileSync(path.join(workDir, 'config.json'), JSON.stringify({
    users: {
      '拾柒': { id: 'u1', password: 'pass123', partner: '伴侣' },
      '伴侣': { id: 'u2', password: 'pass123', partner: '拾柒' }
    }
  }));

  fs.writeFileSync(path.join(workDir, 'tasks.json'), JSON.stringify({
    task_pool: [
      { id: 'legacy_task', title: '一起散步', description: 'p1', reward_min: 10, reward_max: 10 },
      { id: 'legacy_task2', title: '一起做饭', description: 'p2', reward_min: 7, reward_max: 7 },
      { id: 'legacy_task3', title: '一起看电影', description: 'p3', reward_min: 5, reward_max: 5 }
    ],
    daily_tasks: {
      [today]: [
        {
          id: 'legacy_daily_rewarded', task_id: 'legacy_task', title: '一起散步', description: 'p1',
          reward: 13, status: 'rewarded', completed_by: ['u1'], confirmed_by: ['u2'],
          created_at: `${today} 08:00:00`
        },
        {
          id: 'legacy_daily_completed', task_id: 'legacy_task2', title: '一起做饭', description: 'p2',
          reward: 7, status: 'completed', completed_by: ['u1'], confirmed_by: [],
          created_at: `${today} 08:05:00`
        },
        {
          id: 'legacy_daily_pending', task_id: 'legacy_task3', title: '一起看电影', description: 'p3',
          reward: 5, status: 'pending', completed_by: [], confirmed_by: [],
          created_at: `${today} 08:10:00`
        },
        {
          id: 'legacy_daily_orphan', task_id: 'legacy_task_missing', title: '已下架的任务', description: 'orphan',
          reward: 4, status: 'pending', completed_by: [], confirmed_by: []
        }
      ],
      [historical]: [
        {
          id: 'legacy_daily_old', task_id: 'legacy_task', title: '一起散步', description: 'p1',
          reward: 9, status: 'rewarded', completed_by: ['u2'], confirmed_by: ['u1'],
          created_at: `${historical} 09:00:00`
        }
      ]
    }
  }));

  const report = runImport({ dataDir: workDir, dbPath });
  const app = await buildApp({
    dbPath,
    rootDir: workDir,
    uploadsDir: path.join(workDir, 'uploads'),
    secureCookie: false
  });
  const db = app.db;

  t.after(async () => {
    await app.close();
    closeDb();
    if (fs.existsSync(workDir)) {
      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  class Browser {
    constructor() { this.cookies = {}; this.csrf = ''; }
    async request(method, url, payload) {
      const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });
      for (const val of [].concat(res.headers['set-cookie'] || [])) {
        const m = String(val).match(/^([^=]+)=([^;]*)/);
        if (m) this.cookies[m[1]] = m[2];
      }
      return res;
    }
    async login(you, baby) {
      this.csrf = (await this.request('GET', '/api/csrf-token.php')).json().csrf_token;
      const res = await this.request('POST', '/api/login.php', {
        you, baby, password: 'pass123', csrf_token: this.csrf
      });
      assert.ok(res.json().success, `fixture login failed: ${res.body}`);
    }
    post(url, body) { return this.request('POST', url, { ...body, csrf_token: this.csrf }); }
  }

  const u1 = new Browser();
  const u2 = new Browser();
  await u1.login('拾柒', '伴侣');
  await u2.login('伴侣', '拾柒');

  await t.test('all daily instances from the date-keyed map are imported', () => {
    assert.equal(report.taskInstances, 5);

    const rewarded = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get('legacy_daily_rewarded');
    assert.ok(rewarded, 'rewarded instance must exist after import');
    assert.equal(rewarded.business_date, today);
    assert.equal(rewarded.reward, 13);
    assert.equal(rewarded.reward_given, 1);
    assert.deepEqual(JSON.parse(rewarded.completed_by), ['u1']);
    assert.deepEqual(JSON.parse(rewarded.confirmed_by), ['u2']);

    const completed = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get('legacy_daily_completed');
    assert.ok(completed);
    assert.equal(completed.reward_given, 0);
    assert.deepEqual(JSON.parse(completed.completed_by), ['u1']);
    assert.deepEqual(JSON.parse(completed.confirmed_by), []);

    const pending = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get('legacy_daily_pending');
    assert.ok(pending);
    assert.equal(pending.reward_given, 0);
    assert.deepEqual(JSON.parse(pending.completed_by), []);

    const old = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get('legacy_daily_old');
    assert.ok(old);
    assert.equal(old.business_date, historical);
    assert.equal(old.reward_given, 1);

    // Instances whose task vanished from the pool must not abort the import.
    assert.ok(db.prepare('SELECT id FROM task_daily_instances WHERE id = ?').get('legacy_daily_orphan'));
    assert.ok(report.warnings.some(w => w.includes('legacy_task_missing')));
  });

  await t.test('today endpoint returns the imported instance, not a regenerated one', async () => {
    const tasks = (await u1.request('GET', '/api/tasks.php?action=get_today')).json().tasks;
    const rewarded = tasks.find(x => x.id === 'legacy_daily_rewarded');
    assert.ok(rewarded, 'get_today must expose the imported legacy instance');
    assert.equal(rewarded.state, 'done');
    assert.equal(rewarded.reward_given, true);
    assert.equal(rewarded.reward, 13);
    // No extra instances may be generated for today.
    const count = db.prepare('SELECT COUNT(*) as cnt FROM task_daily_instances WHERE business_date = ?').get(today).cnt;
    assert.equal(count, 4);
  });

  await t.test('an already rewarded legacy task cannot be rewarded twice', async () => {
    const before = db.prepare('SELECT id, balance FROM users ORDER BY id').all();

    const mark = await u1.post('/api/tasks.php?action=mark_complete', { task_id: 'legacy_daily_rewarded' });
    assert.equal(mark.json().success, false);

    const confirm = await u2.post('/api/tasks.php?action=confirm', { task_id: 'legacy_daily_rewarded' });
    assert.equal(confirm.json().success, false);

    const after = db.prepare('SELECT id, balance FROM users ORDER BY id').all();
    assert.deepEqual(after, before, 'balances must not change for an already rewarded task');
  });

  await t.test('completed-but-unclaimed legacy task can still be confirmed exactly once', async () => {
    const confirm = await u2.post('/api/tasks.php?action=confirm', { task_id: 'legacy_daily_completed' });
    assert.equal(confirm.json().success, true);
    assert.equal(confirm.json().reward, 7);

    const balances = db.prepare('SELECT id, balance FROM users ORDER BY id').all();
    assert.deepEqual(balances, [
      { id: 'u1', balance: 1007 },
      { id: 'u2', balance: 1007 }
    ]);

    const again = await u2.post('/api/tasks.php?action=confirm', { task_id: 'legacy_daily_completed' });
    assert.equal(again.json().success, false);
  });
});

test('FOURTH-001: array-shaped daily_tasks fixtures still import their status', () => {
  const arrayDir = path.join(__dirname, 'test-fourth-tasks-array');
  closeDb();
  if (fs.existsSync(arrayDir)) fs.rmSync(arrayDir, { recursive: true, force: true });
  fs.mkdirSync(arrayDir, { recursive: true });

  fs.writeFileSync(path.join(arrayDir, 'tasks.json'), JSON.stringify({
    task_pool: [{ id: 't_array', title: '数组任务', reward: 11 }],
    daily_tasks: [
      {
        id: 'array_rewarded', task_id: 't_array', title: '数组任务', date: '2026-01-15',
        reward: 11, status: 'rewarded', completed_by: ['u1'], confirmed_by: ['u2']
      },
      {
        id: 'array_pending', task_id: 't_array', title: '数组任务', date: '2026-01-16',
        reward: 11, status: 'pending', completed_by: [], confirmed_by: []
      }
    ]
  }));

  const arrayDbPath = path.join(arrayDir, 'fixture.db');
  try {
    const arrayReport = runImport({ dataDir: arrayDir, dbPath: arrayDbPath });
    assert.equal(arrayReport.taskInstances, 2);

    const db = initDb(arrayDbPath);
    const rewarded = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get('array_rewarded');
    assert.ok(rewarded);
    assert.equal(rewarded.reward_given, 1);
    assert.equal(rewarded.business_date, '2026-01-15');

    const pending = db.prepare('SELECT * FROM task_daily_instances WHERE id = ?').get('array_pending');
    assert.ok(pending);
    assert.equal(pending.reward_given, 0);
  } finally {
    closeDb();
    if (fs.existsSync(arrayDir)) {
      try { fs.rmSync(arrayDir, { recursive: true, force: true }); } catch (e) {}
    }
  }
});
