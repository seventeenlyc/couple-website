import fs from 'node:fs';
import path from 'node:path';

const publicTypes = {
  '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

function serveFrontendFile(directory, requested, reply, allowHtml = false) {
  const name = requested || 'index.html';
  const extension = path.extname(name).toLowerCase();
  const type = publicTypes[extension] || (allowHtml && extension === '.html' ? 'text/html; charset=utf-8' : null);
  if (!type || name.includes('\\') || name.includes('\0') || path.isAbsolute(name)
    || name.split('/').some(part => part.startsWith('.'))) {
    return reply.code(404).send('Not Found');
  }
  try {
    const realDirectory = fs.realpathSync(directory);
    const realFile = fs.realpathSync(path.resolve(directory, name));
    const relative = path.relative(realDirectory, realFile);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)
      || path.isAbsolute(relative) || !fs.statSync(realFile).isFile()) {
      return reply.code(404).send('Not Found');
    }
    reply.header('X-Content-Type-Options', 'nosniff');
    if (extension === '.html') reply.header('Cache-Control', 'no-store');
    return reply.type(type).send(fs.createReadStream(realFile));
  } catch {
    return reply.code(404).send('Not Found');
  }
}

export default async function gatewayRoutes(fastify, options) {
  const rootDir = options.rootDir;
  const uploadsDir = options.uploadsDir;

  // Public login entry: H5 redirects here before a session exists.
  for (const url of ['/', '/index.html']) {
    fastify.get(url, async (req, reply) => {
      const loginPath = path.join(rootDir, 'index.html');
      if (!fs.existsSync(loginPath)) return reply.code(404).send('Not Found');
      reply.header('Cache-Control', 'no-store');
      reply.type('text/html; charset=utf-8');
      return fs.createReadStream(loginPath);
    });
  }

  fastify.get('/assets/*', async (req, reply) => {
    return serveFrontendFile(path.join(rootDir, 'assets'), req.params['*'], reply);
  });

  // 1. Device pages
  fastify.get('/device-access.php', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const accessHtmlPath = path.join(rootDir, 'device-access.html');
    if (fs.existsSync(accessHtmlPath)) {
      reply.type('text/html; charset=utf-8');
      return fs.createReadStream(accessHtmlPath);
    }
    return reply.code(404).send('Not Found');
  });

  fastify.get('/device-login.php', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return reply.redirect('/index.html');
  });

  fastify.head('/maintaining.html', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.code(410);
    return '';
  });

  fastify.get('/maintaining.html', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.code(410);
    return '';
  });

  // 2. Protected HTML pages hook or route
  const protectedPages = ['home.html', 'album.html', 'shop.html', 'task.html', 'private.html', 'story.html'];
  for (const page of protectedPages) {
    fastify.get(`/${page}`, async (req, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      if (!req.isLoggedIn()) {
        return reply.redirect('/device-login.php');
      }
      const filePath = path.join(rootDir, page);
      if (fs.existsSync(filePath)) {
        reply.type('text/html; charset=utf-8');
        return fs.createReadStream(filePath);
      }
      return reply.code(404).send('Not Found');
    });
  }

  // 3. Protected uploads hook or route
  fastify.get('/uploads/*', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    reply.header('X-Content-Type-Options', 'nosniff');

    if (!req.isLoggedIn()) {
      reply.code(401).type('application/json');
      return { success: false, message: 'Login and device authorization required' };
    }

    const rawPath = req.url.split('?')[0];
    const subPath = rawPath.replace(/^\/uploads\//, '');
    const cleanSubPath = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(uploadsDir, cleanSubPath);

    // Path traversal check
    if (!fullPath.startsWith(uploadsDir)) {
      reply.code(404);
      return 'Not Found';
    }

    // Check private uploads: /uploads/private/:userId/... or /uploads/:userId/...
    const parts = cleanSubPath.split(/[\/\\]/);
    let targetUid = null;
    let isPrivate = false;

    if (parts[0] === 'private' && parts[1]) {
      targetUid = parts[1];
      isPrivate = true;
    } else if (parts[0] && !['photos', 'avatars', 'thumbnails', 'story'].includes(parts[0])) {
      targetUid = parts[0];
      isPrivate = true;
    }

    if (isPrivate) {
      const currentUid = req.getCurrentUserId();
      if (targetUid !== currentUid || !req.isPrivateAuthenticated()) {
        reply.code(404);
        return 'Not Found';
      }
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      reply.code(404);
      return 'Not Found';
    }

    // If nginx X-Accel-Redirect is desired and active
    if (process.env.USE_X_ACCEL_REDIRECT === 'true') {
      reply.header('X-Accel-Redirect', `/_device_files${rawPath}`);
      return '';
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf'
    };

    if (isPrivate) {
      reply.type('application/octet-stream');
      const filename = path.basename(fullPath);
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    } else {
      reply.type(mimeTypes[ext] || 'application/octet-stream');
    }

    return fs.createReadStream(fullPath);
  });

  // Only the two public frontend directories are served; backend and test files stay private.
  for (const frontend of ['h5', 'desktop']) {
    fastify.get(`/${frontend}`, async (req, reply) => reply.redirect(`/${frontend}/index.html`));
    fastify.get(`/${frontend}/*`, async (req, reply) => {
      return serveFrontendFile(path.join(rootDir, frontend), req.params['*'], reply, true);
    });
  }
}
