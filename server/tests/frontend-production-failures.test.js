import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildApp } from '../src/app.js';
import { closeDb } from '../src/storage/db.js';

function fixture(frontend, fetchImpl) {
  const storage = new Map([
    ['couple_h5_private_notes', JSON.stringify([{ id: 'old-user-note', content: 'private fixture' }])],
    ['couple_h5_private_files', JSON.stringify([{ id: 'old-user-file' }])]
  ]);
  const calls = [];
  const sandbox = {
    console, setTimeout, clearTimeout, URL, URLSearchParams, FormData, Blob,
    location: { pathname: `/${frontend}/index.html`, protocol: 'https:', port: '' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    fetch: async (url, options) => { calls.push({ url, options }); return fetchImpl(url, options); }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(new URL(`../../${frontend}/js/api-client.js`, import.meta.url), 'utf8'), sandbox);
  const api = sandbox.galleryApi;
  api.csrfToken = 'fixture-token';
  api.isLoggedIn = true;
  api.currentUserId = 'new-user';
  return { api, storage, calls };
}

for (const frontend of ['h5', 'desktop']) {
  test(`${frontend}: logout follows the real backend redirect and accepts the login HTML response`, async (t) => {
    const app = await buildApp({ dbPath: ':memory:', secureCookie: false });
    await app.listen({ host: '127.0.0.1', port: 0 });
    t.after(async () => { await app.close(); closeDb(); });
    const base = `http://127.0.0.1:${app.server.address().port}`;
    let followed = false;
    const { api } = fixture(frontend, async (url, options) => {
      const response = await fetch(base + url, options);
      followed = response.redirected && response.url.endsWith('/index.html');
      return response;
    });
    assert.equal((await api.logout()).success, true);
    assert.equal(followed, true);
    assert.equal(api.isLoggedIn, false);
  });
  for (const mode of ['403', 'network']) {
    test(`${frontend}: ${mode} cannot unlock private space, expose cached private data or fabricate writes`, async () => {
      const { api, storage } = fixture(frontend, async () => {
        if (mode === 'network') throw new Error('offline fixture');
        return { ok: false, status: 403, json: async () => ({ success: false, message: 'fixture denied' }) };
      });
      assert.equal((await api.verifyPrivatePassword('5200')).authenticated, false);
      assert.equal((await api.getPrivateNotes()).length, 0);
      assert.equal((await api.getPrivateFiles()).length, 0);
      const before = storage.get('couple_h5_private_notes');
      for (const write of [() => api.addPrivateNote('fixture', 'new private text'),
        () => api.deletePrivateNote('old-user-note'), () => api.deletePrivateFile('old-user-file'),
        () => api.doCheckin(), () => api.completeTask('fixture'), () => api.confirmTask('fixture'),
        () => api.buyProduct('prod_1'), () => api.createFolder('fixture'),
        () => api.sendWhisper('fixture'), () => api.createStoryEvent({ title: 'fixture', content: 'fixture' }),
        () => api.logoutPrivate(), () => api.logout()]) {
        assert.equal((await write()).success, false);
      }
      assert.equal(storage.get('couple_h5_private_notes'), before);
      assert.equal((await api.sendAgentChat('find a memory')).success, false);
    });
  }
  test(`${frontend}: checkin reads the server balance state and maps its response fields`, async () => {
    const { api, calls } = fixture(frontend, async (url, options) => ({
      ok: true, status: 200, json: async () => options?.method === 'POST'
        ? { success: true, streak_days: 43, balance: 123, reward: 10 }
        : { success: true, checked_in_today: true, streak_days: 42, last_checkin: '2026-10-14' }
    }));
    const status = await api.getCheckinStatus();
    assert.equal(calls[0].url, '/api/balance.php');
    assert.equal(status.checked_in, true);
    assert.equal(status.streak, 42);
    assert.equal(status.last_date, '2026-10-14');
    assert.equal((await api.doCheckin()).streak, 43);
  });
  test(`${frontend}: a zero server balance is retained and a failed request does not reuse another user's cache`, async () => {
    let online = true;
    const { api, storage } = fixture(frontend, async () => {
      if (!online) throw new Error('offline fixture');
      return { ok: true, status: 200, json: async () => ({ success: true, balance: 0 }) };
    });
    storage.set('couple_h5_points', '520');
    assert.equal(await api.getPoints(), 0);
    online = false;
    assert.equal(await api.getPoints(), null);
  });
}
