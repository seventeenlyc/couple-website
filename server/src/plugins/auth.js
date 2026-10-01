import fp from 'fastify-plugin';
import { deviceSessionValid } from '../modules/devices/device.service.js';

async function authPlugin(fastify) {
  fastify.decorateRequest('isLoggedIn', function () {
    const db = fastify.db;
    return deviceSessionValid(db, this.session, this.cookies);
  });

  fastify.decorateRequest('getCurrentUser', function () {
    return this.session?.username || null;
  });

  fastify.decorateRequest('getCurrentUserId', function () {
    return this.session?.user_id || null;
  });

  fastify.decorateRequest('isPrivateAuthenticated', function () {
    const session = this.session;
    return (
      this.isLoggedIn() &&
      session?.private_authenticated === true &&
      session?.private_authenticated_user === session?.user_id
    );
  });

  fastify.decorate('requireLogin', async function (req, reply) {
    if (!req.isLoggedIn()) {
      reply.code(401).send({
        success: false,
        message: '请先登录'
      });
      return false;
    }
    return true;
  });

  fastify.decorate('requirePrivateAuth', async function (req, reply) {
    if (!req.isLoggedIn()) {
      reply.code(401).send({
        success: false,
        message: '请先登录'
      });
      return false;
    }
    if (!req.isPrivateAuthenticated()) {
      reply.code(403).send({
        success: false,
        message: '请先验证隐私空间密码'
      });
      return false;
    }
    return true;
  });
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['session-plugin', 'db-plugin']
});
