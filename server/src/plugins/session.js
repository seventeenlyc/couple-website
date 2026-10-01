import EventEmitter from 'node:events';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { getDb } from '../storage/db.js';

export class SqliteSessionStore extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this.getStmt = db.prepare('SELECT data, expires_at FROM sessions WHERE session_id = ?');
    this.setStmt = db.prepare('INSERT OR REPLACE INTO sessions (session_id, data, expires_at) VALUES (?, ?, ?)');
    this.delStmt = db.prepare('DELETE FROM sessions WHERE session_id = ?');
    this.cleanStmt = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) {
        return cb(null, null);
      }
      const now = Math.floor(Date.now() / 1000);
      if (row.expires_at < now) {
        this.delStmt.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      let maxAge = 86400 * 7;
      if (sess && sess.cookie && typeof sess.cookie.maxAge === 'number') {
        maxAge = Math.floor(sess.cookie.maxAge / 1000);
      }
      const expiresAt = Math.floor(Date.now() / 1000) + maxAge;
      this.setStmt.run(sid, JSON.stringify(sess), expiresAt);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.delStmt.run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  cleanExpired() {
    try {
      const now = Math.floor(Date.now() / 1000);
      this.cleanStmt.run(now);
    } catch (e) {
      // ignore clean error
    }
  }
}

async function sessionPlugin(fastify, options) {
  const db = options.db || getDb();
  const store = new SqliteSessionStore(db);

  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, {
    secret: options.sessionSecret || 'c0uple-w3bs1te-sup3r-s3cur3-s3ss10n-k3y-2026!',
    cookieName: 'couple_session',
    cookie: {
      path: '/',
      httpOnly: true,
      secure: options.secureCookie ?? (process.env.NODE_ENV === 'production'),
      sameSite: 'lax',
      maxAge: (options.sessionCookieMaxAge || 86400 * 7) * 1000
    },
    store,
    saveUninitialized: false
  });

  fastify.decorate('sessionStore', store);
}

export default fp(sessionPlugin, {
  name: 'session-plugin'
});
