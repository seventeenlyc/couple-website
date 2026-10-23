import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {checkDeviceRateLimit} from '../modules/devices/device.service.js';
import {isFreshDatabase, validateSetup, createInitialSite} from '../modules/setup/setup.service.js';

function matchesSecret(expected, submitted) {
  if (typeof submitted !== 'string') return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(submitted).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function setupRoutes(app, options) {
  const db = app.db;
  const secret = options.setupToken;
  const enabled = typeof secret === 'string' && secret.length >= 32;
  app.get('/setup', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!enabled || !isFreshDatabase(db)) return reply.code(404).send('Not Found');
    return reply.type('text/html; charset=utf-8').send(fs.readFileSync(path.join(options.rootDir, 'setup.html'), 'utf8'));
  });

  app.post('/api/setup', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!enabled) return reply.code(404).send({success: false, message: '安装入口未启用'});
    if (!isFreshDatabase(db)) return reply.code(409).send({success: false, message: '站点已有数据，无法再次初始化'});
    if (!req.validateCSRFToken(req.body?.csrf_token)) return reply.code(403).send({success: false, message: '请求已失效，请刷新页面'});
    if (!checkDeviceRateLimit(db, `setup:${req.ip}`, 10)) return reply.code(429).send({success: false, message: '尝试过于频繁，请稍后再试'});
    if (!matchesSecret(secret, req.body?.setup_token)) return reply.code(403).send({success: false, message: '安装密钥错误'});
    let input;
    try { input = validateSetup(req.body || {}); }
    catch (e) { return reply.code(400).send({success: false, message: e.message}); }
    const created = createInitialSite(db, input);
    if (!created) return reply.code(409).send({success: false, message: '站点已有数据，无法再次初始化'});
    return reply.code(201).send({success: true, message: '初始化完成，请使用管理员账号登录', redirect: '/'});
  });
}
