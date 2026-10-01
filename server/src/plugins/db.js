import fp from 'fastify-plugin';
import { initDb, getDb } from '../storage/db.js';

async function dbPlugin(fastify, options) {
  const db = options.db || initDb(options.dbPath);
  fastify.decorate('db', db);
  fastify.decorate('transaction', (fn) => db.transaction(fn));
}

export default fp(dbPlugin, {
  name: 'db-plugin'
});
