import Fastify from 'fastify';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import dbPlugin from './plugins/db.js';
import sessionPlugin from './plugins/session.js';
import csrfPlugin from './plugins/csrf.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './compat/auth-routes.js';
import economyRoutes from './compat/economy-routes.js';
import contentRoutes from './compat/content-routes.js';
import gatewayRoutes from './compat/gateway-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(configOverrides = {}) {
  const config = loadConfig(configOverrides);

  const fastify = Fastify({
    logger: false,
    trustProxy: config.trustProxy
  });

  // 0. CORS 跨域安全控制 (仅允许白名单来源，拒绝任意 Origin 与 null)
  const isAllowedOrigin = (origin) => {
    if (!origin || origin === 'null') return false;
    const customAllowed = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [];
    if (customAllowed.includes(origin)) return true;
    const port = String(config.port || 19085);
    const localOrigins = [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
    return localOrigins.includes(origin);
  };

  fastify.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin) {
      if (isAllowedOrigin(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Cookie');
        reply.header('Vary', 'Origin');
      } else if (req.method === 'OPTIONS') {
        return reply.code(403).send({ error: 'CORS origin not allowed' });
      }
    }
    if (req.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  // 1. Formbody & Multipart parsers
  await fastify.register(fastifyFormbody);
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 20 * 1024 * 1024 // 20MB limit
    }
  });

  // 2. Plugins
  await fastify.register(dbPlugin, {
    db: configOverrides.db,
    dbPath: config.dbPath
  });

  await fastify.register(sessionPlugin, {
    sessionSecret: config.sessionSecret,
    sessionCookieMaxAge: config.sessionCookieMaxAge,
    secureCookie: configOverrides.secureCookie
  });

  await fastify.register(csrfPlugin);
  await fastify.register(authPlugin);

  // 3. Compatibility routes (exact legacy PHP endpoints & gateway)
  await fastify.register(authRoutes, config);
  await fastify.register(economyRoutes, config);
  await fastify.register(contentRoutes, config);
  await fastify.register(gatewayRoutes, config);

  // 3.5. Static file serving for frontend and test pages
  const rootDir = path.resolve(__dirname, '..', '..');
  await fastify.register(fastifyStatic, {
    root: rootDir,
    prefix: '/',
    index: ['index.html'],
    allowedPath: (pathname) => {
      const norm = pathname.replace(/\\/g, '/').toLowerCase();
      // 严禁泄露 PHP 源码、SQLite 数据库、JSON 配置、环境与工程文档
      if (
        norm.endsWith('.php') ||
        norm.endsWith('.db') ||
        norm.endsWith('.sqlite') ||
        norm.endsWith('.json') ||
        norm.endsWith('.sql') ||
        norm.endsWith('.env') ||
        norm.endsWith('.md') ||
        norm.endsWith('.bak')
      ) {
        return false;
      }
      // 严禁访问后端工程、数据存储、内部文档、版本控制与备份目录
      if (
        norm.startsWith('/data/') ||
        norm === '/data' ||
        norm.includes('/data/') ||
        norm.startsWith('/server/') ||
        norm.includes('/server/') ||
        norm.startsWith('/docs/') ||
        norm.includes('/docs/') ||
        norm.startsWith('/.git') ||
        norm.includes('/.git') ||
        norm.startsWith('/package/') ||
        norm.startsWith('/design/') ||
        norm.startsWith('/h5_multipage_backup/')
      ) {
        return false;
      }
      return true;
    }
  });

  // 4. Internal health check routes
  fastify.get('/health/live', async () => ({ status: 'ok' }));
  fastify.get('/health/ready', async (req, reply) => {
    try {
      fastify.db.prepare('SELECT 1').get();
      return { status: 'ready', db: 'connected' };
    } catch (e) {
      reply.code(503);
      return { status: 'not_ready', error: e.message };
    }
  });

  return fastify;
}
