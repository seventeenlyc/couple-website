import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reply = [
  '## 先缓一缓', '', '**温和表达**，也可以 *慢慢说*。', '',
  '> “刚才有些着急，我们平静一点再聊。”', '',
  '- 喝一点水', '- 给彼此空间', '',
  '1. 先听对方', '2. 再说感受', '', '---', '',
  '```js', 'const message = "<img src=x onerror=alert(1)>";', '```', '',
  '| 安排 | 时间 |', '| --- | --- |', '| 散步 | 傍晚 |', '',
  '[正常链接](https://example.com) [危险链接](javascript:alert(1))', '',
  '<img src=x onerror="window.__markdownXss=1"><script>window.__markdownXss=1</script>'
].join('\n');

test('missing parsing or sanitizing dependency keeps the reply as inert text', () => {
  for (const loadParser of [false, true]) {
    const dom = new JSDOM('<div id="reply"></div>', { runScripts: 'outside-only' });
    try {
      if (loadParser) dom.window.eval(fs.readFileSync(path.join(root, 'assets/vendor/marked/marked.umd.js'), 'utf8'));
      dom.window.eval(fs.readFileSync(path.join(root, 'assets/js/shiguang-markdown.js'), 'utf8'));
      const body = dom.window.document.getElementById('reply');
      dom.window.ShiguangMarkdown.render(body, reply);
      assert.equal(body.textContent, reply);
      assert.equal(body.children.length, 0);
    } finally {
      dom.window.close();
    }
  }
});

for (const [page, missingHelper] of [['desktop', false], ['desktop', true], ['h5', false], ['h5', true]]) {
  test(`${page}: ${missingHelper ? 'missing helper preserves the reply' : 'real chat renders Markdown safely'} and copies the original reply`, async () => {
    const errors = [];
    const console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error.message));
    const html = fs.readFileSync(path.join(root, page, 'index.html'), 'utf8');
    const dom = new JSDOM(html, { url: `http://127.0.0.1:19085/${page}/index.html`, runScripts: 'dangerously', virtualConsole: console, pretendToBeVisual: true });
    const { window } = dom;
    try {
      let copied;
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
      const known = {
        checkSession: () => ({ loggedIn: true, user: 'name1' }),
        initSession: () => ({ isLoggedIn: true, config: { love_days: 616, current_user: 'name1', avatars: [] } }),
        getAppConfig: () => ({ love_days: 616, avatars: [] }),
        getDailyQuote: () => '一起慢慢过日子。',
        getPoints: () => ({ points: 520 }),
        getCheckinStatus: () => ({ checked_in: true }),
        getAlbumTree: () => ({ folders: [] }),
        getAnniversaryReminders: () => [], getTasks: () => [], getShopProducts: () => [],
        getVirtualItems: () => [], getPendingConfirmations: () => [], getStoryTimeline: () => [],
        getWhispersHistory: () => [], getFolders: () => [], getPhotos: () => [],
        sendAgentChat: () => ({ success: true, source: 'ai', reply }),
        resolveAssetUrl: value => value
      };
      const api = new Proxy({}, { get: (_, key) => key === 'then' ? undefined : (...args) => Promise.resolve((known[key] || (() => ({ success: true })))(...args)) });
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const src = /\bsrc=["']([^"']+)["']/.exec(match[1]);
        if (missingHelper && src?.[1].includes('shiguang-markdown.js')) continue;
        const source = src ? fs.readFileSync(path.resolve(root, page, src[1].split('?')[0]), 'utf8') : match[2];
        window.galleryApi = api;
        window.eval(source);
        window.galleryApi = api;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      window.document.getElementById('agentInputText').value = '两个人吵架了怎么办？';
      await window.handleAgentSend();
      const turn = window.document.querySelector('.assistant-turn:not(#shiguangLoadingTurn)');
      const body = turn.querySelector('.shiguang-assistant-body');
      if (missingHelper) {
        assert.equal(body.textContent, reply);
        assert.equal(body.querySelector('strong,blockquote,pre,script,img'), null);
      } else {
      assert.equal(body.querySelector('strong')?.textContent, '温和表达');
      assert.ok(body.querySelector('h2'));
      assert.ok(body.querySelector('blockquote'));
      assert.equal(body.querySelectorAll('ul > li').length, 2);
      assert.equal(body.querySelectorAll('ol > li').length, 2);
      assert.ok(body.querySelector('hr'));
      assert.ok(body.querySelector('pre code').textContent.includes('<img'));
      assert.ok(body.querySelector('table'));
      assert.equal(body.querySelector('a')?.getAttribute('href'), 'https://example.com');
      }
      assert.equal(body.querySelector('script,img,iframe,svg'), null);
      assert.ok(![...body.querySelectorAll('a')].some(a => /^javascript:/i.test(a.getAttribute('href') || '')));
      assert.ok(![...body.querySelectorAll('*')].some(el => [...el.attributes].some(attr => /^on/i.test(attr.name))));
      assert.equal(window.__markdownXss, undefined);
      const copy = [...turn.querySelectorAll('button')].find(button => button.textContent === '复制');
      copy.click();
      await Promise.resolve();
      assert.equal(copied, reply);
      assert.deepEqual(errors, []);
    } finally {
      window.close();
    }
  });
}
