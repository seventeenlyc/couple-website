/**
 * 复审回归：Defect 3（脚本注入）与 Defect 6（草稿三选一）必须执行真实前端组件。
 *
 * 复审缺陷（P2）：原测试在 JSDOM 里自行创建卡片、闭包回调与候选按钮，从未运行产品的
 * renderFoldersRow / renderAlbumView / triggerActionMenuWhisper。破坏产品里的事件绑定后，
 * 那些模拟点击断言依然可以通过。
 *
 * 本文件改为：按 desktop/index.html、h5/index.html 的真实脚本顺序求值真实脚本（仅把网络层
 * window.galleryApi 换成记录型桩），让真实渲染函数产出 DOM，再点击真实节点，以产品真实调用
 * 记录断言行为。若产品渲染或事件绑定被破坏，本测试会失败。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

// 无害的注入探针：命中即把全局变量置 1，用于判定代码是否被执行
const JS_BREAKOUT_NAME = "复审目录'+(window.__folderXss=1)+'";
const HTML_BREAKOUT_NAME = '<img src=x onerror="window.__folderHtmlXss=1">';

const PAGES = [
  {
    name: 'desktop',
    dir: 'desktop',
    html: 'index.html',
    url: 'http://127.0.0.1:19085/desktop/index.html',
    folderRowId: 'foldersRow',
    folderCardSelector: '.folder-card',
    renameBtnSelector: 'button[title="重命名"]',
    deleteBtnSelector: 'button[title="删除"]',
    confirmOverlayId: 'appDialogOverlay',
    confirmBtnId: 'appDialogConfirmBtn',
    dialogMessageId: 'appDialogMessage',
    draftContainerId: 'writeLetterDraftOptions',
    draftButtonSelector: '.draft-option-btn',
    draftTextareaId: 'writeLetterContent',
    draftModalId: 'writeLetterModal'
  },
  {
    name: 'h5',
    dir: 'h5',
    html: 'index.html',
    url: 'http://127.0.0.1:19085/h5/index.html',
    folderRowId: 'albumFoldersRow',
    folderCardSelector: '.album-folder-chip',
    renameBtnSelector: 'button[title="重命名"]',
    deleteBtnSelector: 'button[title="删除"]',
    confirmOverlayId: 'appConfirmDialogOverlay',
    confirmBtnId: 'appDialogConfirmBtn',
    dialogMessageId: 'appDialogMessage',
    draftContainerId: 'h5WhisperDraftOptions',
    draftButtonSelector: '.h5-draft-option-btn',
    draftTextareaId: 'whisperDraftText',
    draftModalId: 'whisperDraftModal'
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 收集 HTML 中按文档顺序出现的脚本（外链与内联） */
function collectScripts(html, pageDir) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] || '';
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (src) {
      scripts.push({ src: src[1], abs: path.resolve(pageDir, src[1].split('?')[0]) });
    } else if (!/\btype\s*=\s*["']module["']/i.test(attrs) && match[2].trim()) {
      scripts.push({ inline: match[2] });
    }
  }
  return scripts;
}

/** JSDOM 29 未实现 innerText：h5 的弹窗文案依赖它，必须补上，否则断言会看到过期文本 */
function polyfillInnerText(window) {
  const probe = window.document.createElement('div');
  probe.innerText = 'x';
  if (probe.textContent === 'x') return;
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() { return this.textContent; },
    set(value) { this.textContent = value == null ? '' : String(value); }
  });
}

/**
 * 记录型网络层桩：boot 只会用到这些方法，其余一律返回 { success: true }。
 * 关键点：api-client.js 结尾会执行 window.galleryApi = new GalleryApiClient() 覆盖桩，
 * 因此必须在每个脚本求值前重新装回，并在求值后再次确认。
 */
function createApiStub() {
  const calls = [];
  const folders = [
    { name: JS_BREAKOUT_NAME, path: '/' + JS_BREAKOUT_NAME, count: 1 },
    { name: HTML_BREAKOUT_NAME, path: '/' + HTML_BREAKOUT_NAME, count: 2 }
  ];
  const record = (method, args) => calls.push({ method, args: args.map((a) => String(a)) });

  const explicit = {
    checkSession: () => ({ loggedIn: true, user: 'name1' }),
    initSession: () => ({ isLoggedIn: true, config: { love_days: 605, startDate: '2025-02-05', avatars: [], current_user: 'name1' } }),
    getAppConfig: () => ({ love_days: 605, start_date: '2025-02-05', avatars: [] }),
    getDailyQuote: () => '今天也想和你一起看日落。',
    getAnniversaryReminders: () => [],
    getPoints: () => ({ success: true, points: 520 }),
    getCheckinStatus: () => ({ success: true, checked_in: false, streak: 7 }),
    getTasks: () => [],
    getShopProducts: () => [],
    getVirtualItems: () => [],
    getPendingConfirmations: () => [],
    getStoryTimeline: () => [],
    getWhispersHistory: () => [],
    getFolders: () => folders,
    getAlbumTree: () => ({ folders: folders.map((f, i) => ({ name: f.name, path: f.path, photo_count: i + 1 })) }),
    getPhotos: () => [],
    renameFolder: () => ({ success: true, message: 'ok' }),
    deleteFolder: () => ({ success: true, message: 'ok' }),
    sendAgentChat: () => ({ success: true, reply: 'ok' }),
    resolveAssetUrl: (p) => (p == null ? '' : String(p)),
    getLoginUrl: () => '/device-login.php'
  };

  const target = {};
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'symbol') return t[prop];
      if (prop === 'then' || prop === 'toJSON' || prop === 'constructor') return undefined;
      const handler = Object.prototype.hasOwnProperty.call(explicit, prop)
        ? explicit[prop]
        : () => ({ success: true });
      return (...args) => {
        record(prop, args);
        return Promise.resolve(handler(...args));
      };
    },
    set(t, prop, value) { t[prop] = value; return true; }
  });

  return { proxy, calls, folders };
}

/** 按真实页面脚本顺序启动页面；网络层唯一被替换 */
async function bootPage(page) {
  const htmlPath = path.join(rootDir, page.dir, page.html);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = collectScripts(html, path.dirname(htmlPath));

  const scriptErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => {
    const message = String((err && err.message) || err);
    if (/Could not parse CSS stylesheet/i.test(message)) return; // 内联 CSS 的解析噪音与本测试无关
    scriptErrors.push(message);
  });

  const dom = new JSDOM(html, {
    url: page.url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  polyfillInnerText(window);

  const api = createApiStub();
  for (const script of scripts) {
    const source = script.inline != null ? script.inline : fs.readFileSync(script.abs, 'utf8');
    // 必须在 api-client.js 之后、app.js 之前装回桩
    window.galleryApi = api.proxy;
    window.eval(source);
    if (window.galleryApi !== api.proxy) window.galleryApi = api.proxy;
  }

  // 让 jsdom 自然触发 DOMContentLoaded（手动派发会导致 initApp 二次执行）
  const deadline = Date.now() + 4000;
  const rowHasChildren = () => {
    const row = window.document.getElementById(page.folderRowId);
    return !!row && row.children.length > 0;
  };
  while (Date.now() < deadline && !(api.calls.length > 0 && rowHasChildren())) {
    await sleep(25);
  }
  await sleep(80);

  return { dom, window, document: window.document, api, scriptErrors, scripts };
}

function findCardWithText(page, document, needle) {
  const row = document.getElementById(page.folderRowId);
  if (!row) return null;
  return Array.from(row.querySelectorAll(page.folderCardSelector))
    .find((card) => (card.textContent || '').includes(needle)) || null;
}

function callsFor(api, method) {
  return api.calls.filter((c) => c.method === method);
}

/** 收集节点及其所有属性值，用于证明载荷没有进入任何属性上下文 */
function attributeValuesIn(root) {
  const values = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of Array.from(el.attributes || [])) values.push(attr.value);
  }
  return values;
}

test('Defect 3: real folder renderers execute the malicious names and real clicks stay inert', async (t) => {
  // 一次启动只验证一条交互链，避免前一步的重新渲染改变后续按钮的归属
  async function withBoot(page, fn) {
    const boot = await bootPage(page);
    try {
      assert.deepEqual(boot.scriptErrors, [], `${page.name} page scripts must evaluate without runtime errors`);
      return await fn(boot);
    } finally {
      boot.window.close();
    }
  }

  function assertRenderedMaliciousCard(page, document) {
    const row = document.getElementById(page.folderRowId);
    assert.ok(row, `${page.name}: #${page.folderRowId} must exist`);
    assert.ok(row.children.length >= 2, `${page.name}: real renderer must produce folder cards`);

    const jsCard = findCardWithText(page, document, '复审目录');
    assert.ok(jsCard, `${page.name}: real card for the malicious folder name must be rendered`);
    assert.ok((jsCard.textContent || '').includes(JS_BREAKOUT_NAME), `${page.name}: folder name must be rendered as text`);
    assert.ok(!jsCard.querySelector('script'), `${page.name}: no script node may be injected`);
    assert.ok(
      !attributeValuesIn(row).some((v) => v.includes('__folderXss') || v.includes('onerror')),
      `${page.name}: the payload must not reach any attribute context (text is inert)`
    );
    return { row, jsCard };
  }

  for (const page of PAGES) {
    await t.test(`${page.name}: real card/rename click path`, async () => {
      await withBoot(page, async ({ window, document, api }) => {
        const { row, jsCard } = assertRenderedMaliciousCard(page, document);

        // 1. 点击真实卡片 → 真实导航/加载路径，参数为原始路径
        jsCard.click();
        await sleep(120);
        const navigationCalls = [...callsFor(api, 'getPhotos'), ...callsFor(api, 'getAlbumTree')];
        assert.ok(
          navigationCalls.some((c) => c.args.some((a) => a.includes(JS_BREAKOUT_NAME))),
          `${page.name}: real navigation must receive the raw folder path, got ${JSON.stringify(navigationCalls)}`
        );

        // 2. 点击真实重命名按钮 → 真实弹窗拿到原始名称 → 真实 renameFolder
        const renameBtn = row.querySelector(page.renameBtnSelector);
        assert.ok(renameBtn, `${page.name}: real rename button must exist after render`);
        renameBtn.click();
        await sleep(80);
        const renameOverlay = document.getElementById('renameFolderModalOverlay');
        const renameInput = document.getElementById('renameFolderNameInput');
        assert.ok(renameOverlay && renameOverlay.classList.contains('active'), `${page.name}: real rename dialog must open`);
        assert.ok(renameInput && renameInput.value.includes(JS_BREAKOUT_NAME), `${page.name}: rename input must carry the raw name`);
        assert.equal(typeof window.confirmRenameFolder, 'function', `${page.name}: confirmRenameFolder must be exported`);
        renameInput.value = 'renamed-folder';
        window.confirmRenameFolder();
        await sleep(120);
        assert.ok(
          callsFor(api, 'renameFolder').some((c) => c.args.some((a) => a.includes(JS_BREAKOUT_NAME))),
          `${page.name}: real renameFolder must be called with the raw folder path`
        );
        assert.equal(window.__folderXss, undefined, `${page.name}: JS breakout payload must never execute`);
      });
    });

    await t.test(`${page.name}: real delete click path and HTML payload stays inert`, async () => {
      await withBoot(page, async ({ window, document, api }) => {
        const { row, jsCard } = assertRenderedMaliciousCard(page, document);

        jsCard.click();
        await sleep(120);

        // 删除按钮从仍带有原始名称的真实卡片内取，避免误点到别的小卡
        const deleteCard = findCardWithText(page, document, '复审目录') || row;
        const deleteBtn = deleteCard.querySelector(page.deleteBtnSelector);
        assert.ok(deleteBtn, `${page.name}: real delete button must exist after render`);
        deleteBtn.click();
        await sleep(80);

        const confirmOverlay = document.getElementById(page.confirmOverlayId);
        const confirmBtn = document.getElementById(page.confirmBtnId);
        const messageEl = document.getElementById(page.dialogMessageId);
        assert.ok(confirmOverlay && confirmOverlay.classList.contains('active'), `${page.name}: real confirm dialog must open`);
        assert.ok(messageEl && (messageEl.textContent || '').includes(JS_BREAKOUT_NAME), `${page.name}: dialog must show the raw folder name`);
        assert.ok(confirmBtn, `${page.name}: real confirm button must exist`);
        confirmBtn.click();
        await sleep(150);
        assert.ok(
          callsFor(api, 'deleteFolder').some((c) => c.args.some((a) => a.includes(JS_BREAKOUT_NAME))),
          `${page.name}: real deleteFolder must be called with the raw folder path`
        );

        // HTML 注入载荷只能作为文本出现，不能生成节点或属性
        const htmlCard = findCardWithText(page, document, 'onerror');
        assert.ok(htmlCard, `${page.name}: real card for the HTML payload must be rendered`);
        assert.equal(htmlCard.querySelectorAll('img').length, 0, `${page.name}: payload must not create elements`);
        assert.equal(row.querySelector('[onerror]'), null, `${page.name}: payload must not create attributes`);
        assert.ok(
          !attributeValuesIn(row).some((v) => v.includes('__folderHtmlXss')),
          `${page.name}: HTML payload must not reach any attribute context`
        );
        assert.equal(window.__folderXss, undefined, `${page.name}: JS breakout payload must never execute`);
        assert.equal(window.__folderHtmlXss, undefined, `${page.name}: HTML breakout payload must never execute`);
      });
    });
  }
});

test('Defect 6: real whisper draft control renders three candidates and keeps multiline text', async (t) => {
  const multilineContent = '亲爱的：\n\n今天也是超级想你的一天！\n记得按时吃饭喝水哦～';
  const draft = {
    type: 'whisper',
    action_label: '写成悄悄话',
    options: [
      multilineContent,
      '今天相伴走过605天，每一天都因为有你而格外美好。',
      '小提示：今晚有为你准备的特别小心愿，敬请期待！'
    ]
  };

  for (const page of PAGES) {
    await t.test(`${page.name}: real triggerActionMenuWhisper renders the selector and preserves newlines`, async () => {
      const boot = await bootPage(page);
      const { window, document } = boot;
      try {
        assert.deepEqual(boot.scriptErrors, [], `${page.name} page scripts must evaluate without runtime errors`);
        assert.equal(typeof window.openAgentActionMenu, 'function', `${page.name}: openAgentActionMenu must be exported`);
        assert.equal(typeof window.triggerActionMenuWhisper, 'function', `${page.name}: triggerActionMenuWhisper must be exported`);

        // 走产品的真实入口：打开操作菜单 → 选择“写成悄悄话”
        window.openAgentActionMenu('拾光回复：这是三条候选', draft);
        window.triggerActionMenuWhisper();
        await sleep(30);

        const container = document.getElementById(page.draftContainerId);
        const textarea = document.getElementById(page.draftTextareaId);
        const modal = document.getElementById(page.draftModalId);
        assert.ok(container, `${page.name}: #${page.draftContainerId} must exist in the real page`);
        assert.ok(textarea, `${page.name}: #${page.draftTextareaId} must exist in the real page`);

        const buttons = container.querySelectorAll(page.draftButtonSelector);
        assert.equal(buttons.length, 3, `${page.name}: real component must render exactly three candidates`);
        assert.equal(textarea.value, multilineContent, `${page.name}: first candidate must be filled with newlines intact`);
        assert.ok(textarea.value.includes('\n\n'), `${page.name}: double newline must survive the real draft path`);
        assert.ok(buttons[0].classList.contains('active'), `${page.name}: first candidate must start active`);
        if (modal) assert.ok(modal.classList.contains('active'), `${page.name}: real draft modal must open`);

        // 点击真实候选按钮
        buttons[1].click();
        await sleep(20);
        assert.equal(textarea.value, draft.options[1], `${page.name}: clicking candidate 2 must fill the textarea`);
        assert.ok(buttons[1].classList.contains('active'), `${page.name}: candidate 2 must become active`);
        assert.ok(!buttons[0].classList.contains('active'), `${page.name}: candidate 1 must lose active`);
      } finally {
        window.close();
      }
    });
  }
});
