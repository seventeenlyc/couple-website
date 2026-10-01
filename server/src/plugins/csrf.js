import crypto from 'node:crypto';
import fp from 'fastify-plugin';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function csrfPlugin(fastify) {
  fastify.decorateRequest('getCSRFToken', function () {
    if (!this.session) {
      return '';
    }
    if (!this.session.csrf_token) {
      this.session.csrf_token = generateToken();
    }
    return this.session.csrf_token;
  });

  fastify.decorateRequest('validateCSRFToken', function (token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    const current = this.session?.csrf_token;
    if (!current || typeof current !== 'string') {
      return false;
    }
    const bufA = Buffer.from(current);
    const bufB = Buffer.from(token);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  });

  fastify.decorate('requireCSRF', function (req, reply) {
    const token = req.body?.csrf_token || req.headers['x-csrf-token'] || req.query?.csrf_token;
    if (!req.validateCSRFToken(token)) {
      reply.code(403);
      if (req.url.startsWith('/api/login.php') || req.url === '/api/login') {
        reply.send({
          success: false,
          message: '无效的请求',
          code: 'csrf_invalid'
        });
      } else {
        reply.send({
          success: false,
          message: '请求无效，请重新尝试'
        });
      }
      return false;
    }
    return true;
  });
}

export default fp(csrfPlugin, {
  name: 'csrf-plugin'
});
