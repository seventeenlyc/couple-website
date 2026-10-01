import Fastify from 'fastify';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import { loadConfig } from './config.js';
import dbPlugin from './plugins/db.js';
import sessionPlugin from './plugins/session.js';
import csrfPlugin from './plugins/csrf.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './compat/auth-routes.js';
import economyRoutes from './compat/economy-routes.js';
import contentRoutes from './compat/content-routes.js';
import gatewayRoutes from './compat/gateway-routes.js';

export async function buildApp(configOverrides = {}) {
  const config = loadConfig(configOverrides);

  const fastify = Fastify({
    logger: false,
    trustProxy: config.trustProxy
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
