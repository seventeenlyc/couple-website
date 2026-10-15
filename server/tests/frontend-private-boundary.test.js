import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('H5 lock hides private content immediately and ignores late authentication and note responses', async (t) => {
  const dom = new JSDOM(fs.readFileSync(new URL('../../h5/index.html', import.meta.url), 'utf8'), {
    url: 'https://gallery.example/h5/index.html', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const originalAdd = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, ...args) => { if (type !== 'DOMContentLoaded') originalAdd(type, ...args); };
  const auth = deferred(), logout = deferred(), notes = deferred();
  window.galleryApi = { checkPrivateAuth: () => auth.promise, logoutPrivate: () => logout.promise,
    getPrivateNotes: () => notes.promise, getPrivateFiles: async () => [] };
  window.eval(fs.readFileSync(new URL('../../h5/js/app.js', import.meta.url), 'utf8'));
  window.showToast = () => {};
  window.resetAppRootScroll = () => {};
  const pendingOpen = window.openSecretSpace();
  const pendingNotes = window.renderPrivateNotes();
  window.document.getElementById('secretContentView').style.display = 'block';
  window.document.getElementById('secretNotesList').textContent = 'old private fixture';
  const pendingLock = window.lockSecretSpace();
  assert.equal(window.document.getElementById('secretContentView').style.display, 'none');
  assert.equal(window.document.getElementById('secretNotesList').textContent, '');
  auth.resolve({ success: true, authenticated: true });
  notes.resolve([{ id: 'late', title: 'late private fixture', content: 'late fixture' }]);
  await Promise.all([pendingOpen, pendingNotes]);
  assert.equal(window.document.getElementById('secretContentView').style.display, 'none');
  assert.equal(window.document.getElementById('secretNotesList').textContent, '');
  logout.resolve({ success: true });
  await pendingLock;
});

test('H5 private downloads use the root API endpoint even when file metadata contains a relative or unsafe URL', async (t) => {
  const dom = new JSDOM(fs.readFileSync(new URL('../../h5/index.html', import.meta.url), 'utf8'), {
    url: 'https://gallery.example/h5/index.html', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.document.addEventListener = () => {};
  window.galleryApi = { checkPrivateAuth: async () => ({ authenticated: true }),
    getPrivateNotes: async () => [], resolveApiUrl: url => url,
    getPrivateFiles: async () => [{ id: 'file fixture', original_name: 'fixture.txt', size: 10, download_url: 'javascript:alert(1)' }] };
  window.eval(fs.readFileSync(new URL('../../h5/js/app.js', import.meta.url), 'utf8'));
  window.resetAppRootScroll = () => {};
  await window.openSecretSpace();
  const link = window.document.querySelector('#secretFilesList a[download]');
  assert.ok(link);
  assert.equal(link.href, 'https://gallery.example/api/private-files.php?action=download&file_id=file%20fixture');
});

test('desktop login only redirects to a safe local path after authentication', async () => {
  const html = fs.readFileSync(new URL('../../desktop/login.html', import.meta.url), 'utf8');
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(text => text.includes('async function submitLogin'));
  for (const target of ['https://attacker.example', '//attacker.example', '/h5/index.html']) {
    const elements = new Map();
    const sandbox = { URL, URLSearchParams, console, clearTimeout() {},
      setTimeout(fn, delay) { if (delay === 600) fn(); },
      location: { origin: 'https://gallery.example', search: '?redirect=' + encodeURIComponent(target), href: '' },
      GalleryApiClient: class { async login() { return { success: true }; } },
      document: { getElementById(id) { if (!elements.has(id)) elements.set(id, { value: 'fixture', classList: { add() {}, remove() {} } }); return elements.get(id); } }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(new URL('../../assets/js/device-router.js', import.meta.url), 'utf8'), sandbox);
    vm.runInContext(inline, sandbox);
    await sandbox.submitLogin();
    assert.equal(sandbox.location.href, target === '/h5/index.html' ? target : '/desktop/index.html');
  }
});
