import {
  deviceCookieName,
  parseDeviceToken,
  deviceMatches,
  checkDeviceRateLimit,
  isUserAdmin,
  authorizeDeviceLogin,
  handleDeviceAdminAction
} from '../modules/devices/device.service.js';
import {
  authenticateUser,
  verifyPrivatePassword
} from '../modules/auth/auth.service.js';
import {
  getTodayDateString,
  getNowDateTimeString,
  calculateLoveDuration
} from '../utils/date.js';

export default async function authRoutes(fastify) {
  const db = fastify.db;

  // 1. CSRF Token API
  fastify.get('/api/csrf-token.php', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const loggedIn = req.isLoggedIn();
    return {
      success: true,
      csrf_token: req.getCSRFToken(),
      user: loggedIn ? req.getCurrentUser() : null,
      user_id: loggedIn ? req.getCurrentUserId() : null,
      logged_in: loggedIn
    };
  });

  // 2. Login API
  fastify.post('/api/login.php', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');

    const body = req.body || {};
    const csrfToken = body.csrf_token;

    if (!req.validateCSRFToken(csrfToken)) {
      reply.code(403);
      return {
        success: false,
        message: '无效的请求',
        code: 'csrf_invalid'
      };
    }

    const { you, baby, password } = body;
    if (!you || !baby || password === undefined || password === '') {
      return {
        success: false,
        message: '请输入你和对方的称呼'
      };
    }

    const ip = req.ip || 'unknown';
    try {
      if (!checkDeviceRateLimit(db, `login:${ip}`, 30)) {
        reply.code(429);
        return {
          success: false,
          message: '请求过于频繁，请15分钟后重试'
        };
      }
    } catch (e) {
      reply.code(503);
      return { success: false, message: '设备验证暂不可用' };
    }

    const authRes = authenticateUser(db, you.trim(), baby.trim(), String(password));
    if (!authRes.success) {
      return { success: false, message: authRes.message };
    }

    const user = authRes.user;
    const devRes = authorizeDeviceLogin(db, user, req.cookies, {
      userAgent: req.headers['user-agent'],
      ip
    });

    if (devRes.token) {
      const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
      reply.setCookie(devRes.cookieName, devRes.token, {
        path: '/',
        secure: isHttps,
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: 15552000
      });
      // Fallback for non-https loopback environments
      if (!isHttps) {
        reply.setCookie(devRes.cookieName.replace('__Host-', ''), devRes.token, {
          path: '/',
          httpOnly: true,
          sameSite: 'Strict',
          maxAge: 15552000
        });
      }
    }

    if (devRes.status === 'active') {
      req.session.device_id = devRes.id;
      delete req.session.device_pending_user;
      req.session.logged_in = true;
      req.session.user_id = user.id;
      req.session.username = user.username;

      return {
        success: true,
        user: user.username,
        redirect: 'home.html'
      };
    }

    if (devRes.status === 'pending') {
      delete req.session.logged_in;
      delete req.session.device_id;
      delete req.session.private_authenticated;
      req.session.device_pending_user = user.id;

      reply.header('Content-Type', 'application/json; charset=utf-8');
      return {
        success: false,
        device_pending: true,
        message: '当前浏览器未获授权，请前往设备验证页。'
      };
    }

    if (devRes.status === 'limited') {
      reply.code(429);
      return {
        success: false,
        message: '待授权设备过多，请联系管理员处理或稍后重试'
      };
    }

    return { success: false, message: '登录验证失败' };
  });

  // 3. Logout API
  const handleLogout = async (req, reply) => {
    if (req.session) {
      try {
        await req.session.destroy();
      } catch (e) {}
    }
    return reply.redirect('/index.html');
  };
  fastify.get('/api/logout.php', handleLogout);
  fastify.post('/api/logout.php', handleLogout);

  // 4. Devices API
  fastify.post('/api/devices.php', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const body = req.body || {};

    if (!req.validateCSRFToken(body.csrf_token)) {
      reply.code(403);
      return { success: false, message: 'CSRF token invalid' };
    }

    const action = body.action || '';

    if (action === 'status') {
      if (req.isLoggedIn()) {
        const uid = req.getCurrentUserId();
        return {
          success: true,
          status: 'active',
          admin: isUserAdmin(db, uid)
        };
      }

      const pendingUid = req.session?.device_pending_user;
      if (!pendingUid) {
        return { success: true, status: 'missing' };
      }

      const cookieName = deviceCookieName(pendingUid);
      const rawCookie = req.cookies[cookieName] || req.cookies[cookieName.replace('__Host-', '')];
      const token = parseDeviceToken(rawCookie);
      if (!token) {
        return { success: true, status: 'missing' };
      }

      const record = db.prepare('SELECT * FROM device_records WHERE id = ?').get(token[0]);
      if (!record || !deviceMatches(record, pendingUid, token)) {
        return { success: true, status: 'missing' };
      }

      const now = Math.floor(Date.now() / 1000);
      if (record.expires_at <= now) {
        return { success: true, status: 'expired' };
      }

      if (record.status === 'active') {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pendingUid);
        if (user) {
          req.session.device_id = token[0];
          req.session.logged_in = true;
          req.session.user_id = user.id;
          req.session.username = user.username;
          delete req.session.device_pending_user;

          return {
            success: true,
            status: 'active',
            admin: isUserAdmin(db, user.id)
          };
        }
        return { success: true, status: 'missing' };
      }

      return {
        success: true,
        status: record.status,
        code: record.pair_code
      };
    }

    // Admin-only actions
    const currentUserId = req.getCurrentUserId();
    if (!req.isLoggedIn() || !isUserAdmin(db, currentUserId)) {
      reply.code(403);
      return { success: false, message: '仅拾柒管理员可以管理设备' };
    }

    if (action === 'list') {
      const now = Math.floor(Date.now() / 1000);
      const currentDevId = req.session?.device_id || '';
      const rows = db.prepare('SELECT * FROM device_records ORDER BY created_at DESC').all();

      const sanitized = rows.map(r => {
        let status = r.status;
        if (r.expires_at <= now && (status === 'pending' || status === 'active')) {
          status = 'expired';
        }
        return {
          id: r.id,
          current: r.id === currentDevId,
          user_id: r.user_id,
          name: r.name,
          status,
          pair_failures: r.pair_failures,
          created_at: r.created_at,
          expires_at: r.expires_at,
          last_seen: r.last_seen,
          agent: r.agent,
          ip: r.ip,
          approved_by: r.approved_by
        };
      });

      return { success: true, devices: sanitized };
    }

    const targetId = String(body.id || '');
    const code = String(body.code || '');
    return handleDeviceAdminAction(db, currentUserId, action, targetId, code);
  });

  // 5. Private Space Auth API
  fastify.post('/api/private-auth.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const body = req.body || {};
    if (!req.validateCSRFToken(body.csrf_token)) {
      reply.code(403);
      return { success: false, message: '请求无效，请重新尝试' };
    }

    const action = body.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'verify') {
      const password = body.password || '';
      if (!password) {
        reply.code(400);
        return { success: false, message: '请输入密码' };
      }

      const ok = verifyPrivatePassword(db, userId, password);
      if (ok) {
        req.session.private_authenticated = true;
        req.session.private_authenticated_user = userId;
        return { success: true, message: '验证成功' };
      }
      reply.code(401);
      return { success: false, message: '密码错误' };
    }

    if (action === 'status') {
      return {
        success: true,
        is_authenticated: req.isPrivateAuthenticated()
      };
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  });

  // 6. Ping API
  fastify.get('/api/ping.php', async () => {
    return {
      success: true,
      message: 'API工作正常',
      time: getNowDateTimeString()
    };
  });

  // 7. App Config API
  fastify.get('/api/app-config.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const startRow = db.prepare("SELECT value FROM site_config WHERE key = 'startDate'").get();
    const startDate = startRow ? startRow.value : '2025-02-05';
    const duration = calculateLoveDuration(startDate);
    const currentUser = req.getCurrentUser();
    const currentUserId = req.getCurrentUserId();

    const users = db.prepare('SELECT id, username, avatar FROM users').all();
    const avatars = users.map(u => ({
      user_id: u.id,
      username: u.username,
      avatar: u.avatar || (u.username === '拾柒' ? 'assets/images/avatar/boy.png' : 'assets/images/avatar/girl.png')
    }));

    return {
      success: true,
      startDate,
      love_days: duration.days,
      love_duration: {
        years: duration.years,
        months: duration.months,
        days: duration.remainingDays,
        total_days: duration.days
      },
      logged_in: true,
      current_user: currentUser,
      current_user_id: currentUserId,
      avatars
    };
  });
}
