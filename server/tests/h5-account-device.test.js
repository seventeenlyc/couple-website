import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

/**
 * 账号 / 头像 / 设备管理回归测试（对应 2026-10-02 验收报告）
 *
 * 验收报告指出 H5 存在“请求失败仍按成功处理”的隐患。本测试在 vm 沙箱中
 * 加载真实的 h5/js/api-client.js，注入可控的 fetch，验证：
 *   - 403 / 401 / 网络异常都不会被当成成功
 *   - 未登录不会生成假成功
 *   - 设备审批必须携带目标设备 id 与配对码
 *   - 头像相对路径能按 h5/ 目录正确解析
 *   - h5/index.html 不再保留“接口缺失也提示成功”的内联存根
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const H5_DIR = path.join(__dirname, '..', '..', 'h5');
const API_CLIENT_SRC = fs.readFileSync(path.join(H5_DIR, 'js', 'api-client.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(H5_DIR, 'index.html'), 'utf8');

/** 在沙箱中实例化真实的 GalleryApiClient，并返回 { api, calls, setFetch } */
function createClient() {
  const calls = [];
  let fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ success: true }) });

  const storage = new Map();
  const sandbox = {
    console: { warn() {}, log() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Promise,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
    FormData: class {
      constructor() {
        this._entries = [];
      }
      append(k, v) {
        this._entries.push([k, v]);
      }
      get(k) {
        const hit = this._entries.find(([key]) => key === k);
        return hit ? hit[1] : undefined;
      }
    },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    location: { pathname: '/h5/index.html' },
    fetch: (url, opts) => {
      calls.push({ url, opts });
      return fetchImpl(url, opts);
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(API_CLIENT_SRC, sandbox);
  const api = sandbox.window.galleryApi;
  assert.ok(api, 'api-client.js 应挂载 window.galleryApi');

  return {
    api,
    calls,
    setFetch(fn) {
      fetchImpl = fn;
    }
  };
}

test('getDeviceList 在 403 时返回 forbidden，不误判为成功', async () => {
  const { api, setFetch } = createClient();
  setFetch(async () => ({ ok: false, status: 403, json: async () => ({ success: false, message: '仅拾柒管理员可以管理设备' }) }));

  const res = await api.getDeviceList();
  assert.equal(res.success, false);
  assert.equal(res.forbidden, true);
  assert.match(res.message, /管理员/);
});

test('getDeviceList 在 401 时标记 unauthorized', async () => {
  const { api, setFetch } = createClient();
  setFetch(async () => ({ ok: false, status: 401, json: async () => ({ success: false }) }));

  const res = await api.getDeviceList();
  assert.equal(res.success, false);
  assert.equal(res.unauthorized, true);
});

test('网络异常返回 networkError 而不是成功', async () => {
  const { api, setFetch } = createClient();
  setFetch(async () => {
    throw new Error('fetch failed');
  });

  const res = await api.getDeviceList();
  assert.equal(res.success, false);
  assert.equal(res.networkError, true);
});

test('getPendingDevices 只保留 pending 状态并保留全量列表', async () => {
  const { api, setFetch } = createClient();
  setFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      devices: [
        { id: 'd1', status: 'pending', name: '新手机' },
        { id: 'd2', status: 'active', name: '旧手机' },
        { id: 'd3', status: 'revoked', name: '丢失设备' }
      ]
    })
  }));

  const res = await api.getPendingDevices();
  assert.equal(res.success, true);
  assert.deepEqual(res.devices.map((d) => d.id), ['d1']);
  assert.equal(res.all.length, 3);
});

test('approveDevice 必须同时携带设备 id 与配对码', async () => {
  const { api, calls, setFetch } = createClient();
  setFetch(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));

  await api.approveDevice('dev-9', 'AB12CD');

  const req = calls.find((c) => String(c.url).includes('/api/devices.php'));
  assert.ok(req, '应请求 /api/devices.php');
  const body = JSON.parse(req.opts.body);
  assert.equal(body.action, 'approve');
  assert.equal(body.id, 'dev-9');
  assert.equal(body.code, 'AB12CD');
});

test('approveDevice 缺少设备 id 时直接失败，不发请求', async () => {
  const { api, calls } = createClient();
  const res = await api.approveDevice('', 'AB12CD');
  assert.equal(res.success, false);
  assert.equal(calls.length, 0);
});

test('revokeDevice 使用真实端点与设备 id', async () => {
  const { api, calls, setFetch } = createClient();
  setFetch(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));

  await api.revokeDevice('dev-3');
  const req = calls.find((c) => String(c.url).includes('/api/devices.php'));
  const body = JSON.parse(req.opts.body);
  assert.equal(body.action, 'revoke');
  assert.equal(body.id, 'dev-3');
});

test('uploadAvatar 在 401 时明确未授权，不返回假成功', async () => {
  const { api, setFetch } = createClient();
  setFetch(async () => ({ ok: false, status: 401, json: async () => ({ success: false, message: '请先登录' }) }));

  const res = await api.uploadAvatar('left', { name: 'a.png' });
  assert.equal(res.success, false);
  assert.equal(res.unauthorized, true);
});

test('uploadAvatar 成功时回传服务端 avatar_url', async () => {
  const { api, calls, setFetch } = createClient();
  setFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, avatar_url: 'uploads/avatars/avatar_1_1.png' })
  }));

  const res = await api.uploadAvatar('right', { name: 'b.png' });
  assert.equal(res.success, true);
  assert.equal(res.avatar_url, 'uploads/avatars/avatar_1_1.png');

  const req = calls.find((c) => String(c.url).includes('/api/upload-avatar.php'));
  assert.ok(req, '应请求 /api/upload-avatar.php');
  assert.equal(req.opts.body.get('avatar').name, 'b.png');
  assert.equal(req.opts.body.get('side'), 'right');
});

test('uploadAvatar 未选择文件时直接失败', async () => {
  const { api, calls } = createClient();
  const res = await api.uploadAvatar('left', null);
  assert.equal(res.success, false);
  assert.equal(calls.length, 0);
});

test('resolveAssetUrl 把 assets/ 与 uploads/ 解析为 h5/ 上级目录', () => {
  const { api } = createClient();
  assert.equal(api.resolveAssetUrl('uploads/avatars/a.png'), '../uploads/avatars/a.png');
  assert.equal(api.resolveAssetUrl('assets/images/avatar/boy.png'), '../assets/images/avatar/boy.png');
  assert.equal(api.resolveAssetUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  assert.equal(api.resolveAssetUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
});

test('logout 调用真实端点并清空本地会话状态', async () => {
  const { api, calls, setFetch } = createClient();
  setFetch(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));

  api.csrfToken = 'tok';
  api.isLoggedIn = true;
  api.currentUser = '小林';

  await api.logout();

  assert.ok(calls.some((c) => String(c.url).includes('/api/logout.php')));
  assert.equal(api.csrfToken, '');
  assert.equal(api.isLoggedIn, false);
  assert.equal(api.currentUser, null);
});

test('getLoginUrl 带 redirect 参数指回 H5', () => {
  const { api } = createClient();
  const url = api.getLoginUrl();
  assert.match(url, /^\.\.\/index\.html\?redirect=/);
  assert.match(url, /h5%2Findex\.html/);
});

test('index.html 不再保留“接口缺失也提示成功”的内联存根', () => {
  assert.ok(
    !INDEX_HTML.includes('已批准配对码 ['),
    'index.html 不得再出现“已批准配对码 [x]”这类假成功提示'
  );
  assert.ok(
    !INDEX_HTML.includes('function refreshPendingDevices'),
    'index.html 不得再定义 refreshPendingDevices 存根，避免覆盖 app.js 的真实实现'
  );
  assert.ok(
    !INDEX_HTML.includes('async function handleH5Logout'),
    'index.html 不得再定义 handleH5Logout 存根'
  );
});

test('app.js 暴露了账号与设备管理的真实处理函数', () => {
  const appSrc = fs.readFileSync(path.join(H5_DIR, 'js', 'app.js'), 'utf8');
  for (const name of [
    'handleAvatarFileChange',
    'handleChangeDailyQuote',
    'handleH5Logout',
    'openDeviceManagementModal',
    'refreshPendingDevices',
    'approvePendingDevice',
    'denyPendingDevice',
    'revokePendingDevice'
  ]) {
    assert.ok(
      appSrc.includes(`window.${name} = ${name}`),
      `app.js 应导出 window.${name}`
    );
  }
});

test('h5 viewport 允许缩放，未锁定 maximum-scale / user-scalable', () => {
  const metaViewport = INDEX_HTML.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
  assert.ok(metaViewport, 'index.html 应包含 viewport meta');
  const tag = metaViewport[0];
  assert.ok(!/maximum-scale/i.test(tag), 'viewport 不应锁定 maximum-scale');
  assert.ok(!/user-scalable\s*=\s*no/i.test(tag), 'viewport 不应禁用缩放');
  assert.match(tag, /width=device-width/i);
});

test('CSS 不再全站禁用文本选择，正文可复制', () => {
  const css = fs.readFileSync(path.join(H5_DIR, 'css', 'gallery-h5.css'), 'utf8');

  // 取出 `* { ... }` 规则块，确认其中没有 user-select: none
  const starBlock = css.match(/\*\s*\{([\s\S]*?)\}/);
  assert.ok(starBlock, '应存在 * 规则块');
  assert.ok(
    !/user-select\s*:\s*none/i.test(starBlock[1]),
    '* 规则块不得再全局禁用文本选择'
  );

  // 正文区域显式允许选择
  assert.match(css, /\.h5-app-root\s*\{[^}]*user-select\s*:\s*text/i, '正文区域应允许文本选择');
});

test('h5/index.html 内联脚本语法正确（移除存根后不残留语法错误）', () => {
  const scripts = [...INDEX_HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0, 'index.html 应包含内联脚本');
  for (const code of scripts) {
    assert.doesNotThrow(() => new vm.Script(code), '内联脚本应能通过语法解析');
  }
});

test('getDailyQuote 成功时返回服务端 quote 字符串', async () => {
  const { api, setFetch } = createClient();
  setFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, quote: '今天的天空很蓝，想和你吹吹晚风。' })
  }));

  const res = await api.getDailyQuote();
  assert.equal(res, '今天的天空很蓝，想和你吹吹晚风。');
});

test('getDailyQuote 在 401、500 或网络失败时返回 null，不返回假字符串', async () => {
  const { api, setFetch } = createClient();

  // 401 场景
  setFetch(async () => ({ ok: false, status: 401, json: async () => ({ success: false }) }));
  const res401 = await api.getDailyQuote();
  assert.equal(res401, null, '401 未登录时应返回 null');

  // 500 场景
  setFetch(async () => ({ ok: false, status: 500, json: async () => ({ success: false }) }));
  const res500 = await api.getDailyQuote();
  assert.equal(res500, null, '500 服务端错误时应返回 null');

  // 网络异常抛错场景
  setFetch(async () => {
    throw new Error('network down');
  });
  const resErr = await api.getDailyQuote();
  assert.equal(resErr, null, '网络抛错时应返回 null');
});

test('handleChangeDailyQuote 在服务端不可用时每次点击切换不同备用文案且提示准确', async () => {
  const appSrc = fs.readFileSync(path.join(H5_DIR, 'js', 'app.js'), 'utf8');
  const start = appSrc.indexOf('const presetQuotes = [');
  assert.notEqual(start, -1, 'app.js 应定义 presetQuotes');
  const end = appSrc.indexOf('/* ==========================================================================\n   12.4 设备管理', start);
  assert.notEqual(end, -1, '应能定位到 handleChangeDailyQuote 片段');
  const snippet = appSrc.slice(start, end);

  const toasts = [];
  const quoteEl = { innerText: '“在平常的日子里，慢慢收集我们之间闪闪发光的瞬间。”' };
  const btnEl = { classList: { add() {}, remove() {} } };

  const sandbox = {
    document: {
      getElementById(id) {
        if (id === 'dailyQuoteText') return quoteEl;
        if (id === 'changeDailyQuoteBtn') return btnEl;
        return null;
      }
    },
    window: {
      galleryApi: {
        getDailyQuote: async () => null // 模拟服务端不可用 / 未登录
      }
    },
    showToast(msg) {
      toasts.push(msg);
    },
    setTimeout(fn) {
      fn();
    },
    clearTimeout() {}
  };
  sandbox.window.galleryApi.getDailyQuote = async () => null;
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);

  // 第一次点击：从 presetQuotes[0] 切换到下一句
  await sandbox.handleChangeDailyQuote();
  const firstQuote = quoteEl.innerText;
  assert.notEqual(
    firstQuote,
    '“在平常的日子里，慢慢收集我们之间闪闪发光的瞬间。”',
    '第一次点击文案必须切换，不得停留在原句'
  );
  assert.equal(toasts.at(-1), '已切换到本地备用文案');

  // 第二次点击：切换到不同于第一句的下一句
  await sandbox.handleChangeDailyQuote();
  const secondQuote = quoteEl.innerText;
  assert.notEqual(secondQuote, firstQuote, '第二次点击必须切换到不同的备用文案');
  assert.equal(toasts.at(-1), '已切换到本地备用文案');
});

test('handleChangeDailyQuote 在服务端返回相同文案时提示已是最新，不虚报已更新', async () => {
  const appSrc = fs.readFileSync(path.join(H5_DIR, 'js', 'app.js'), 'utf8');
  const start = appSrc.indexOf('const presetQuotes = [');
  const end = appSrc.indexOf('/* ==========================================================================\n   12.4 设备管理', start);
  const snippet = appSrc.slice(start, end);

  const toasts = [];
  const quoteEl = { innerText: '“今天的天空很蓝，想和你吹吹晚风。”' };
  const btnEl = { classList: { add() {}, remove() {} } };

  const sandbox = {
    document: {
      getElementById(id) {
        if (id === 'dailyQuoteText') return quoteEl;
        if (id === 'changeDailyQuoteBtn') return btnEl;
        return null;
      }
    },
    window: {
      galleryApi: {
        // 服务端返回与当前完全相同的文案
        getDailyQuote: async () => '今天的天空很蓝，想和你吹吹晚风。'
      }
    },
    showToast(msg) {
      toasts.push(msg);
    },
    setTimeout(fn) {
      fn();
    },
    clearTimeout() {}
  };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);

  await sandbox.handleChangeDailyQuote();

  assert.equal(quoteEl.innerText, '“今天的天空很蓝，想和你吹吹晚风。”');
  assert.notEqual(toasts.at(-1), '已更新今日文案', '文案相同不得提示“已更新今日文案”');
  assert.match(toasts.at(-1), /已是最新/, '应提示文案已是最新内容');
});

test('h5/index.html 设备审批核对码说明必须为 8 位数字，不得出现 6 位', () => {
  assert.ok(
    !INDEX_HTML.includes('6 位数字或字母'),
    'index.html 不得包含“6 位数字或字母”的错误提示'
  );
  assert.match(
    INDEX_HTML,
    /8\s*位数字/,
    'index.html 应包含“8 位数字”配对核对码正确说明'
  );
});

test('旧登录页支持 redirect 回跳 H5，且拒绝开放重定向', () => {
  const loginHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

  const start = loginHtml.indexOf('const rawRedirect');
  assert.notEqual(start, -1, '登录页应读取 redirect 查询参数');
  const end = loginHtml.indexOf(': null;', start);
  assert.notEqual(end, -1, '登录页应有安全回跳判定');
  const snippet = `${loginHtml.slice(start, end + ': null;'.length)}\n__out = safeRedirect;`;

  const evaluate = (search) => {
    const sandbox = {
      window: { location: { search } },
      URLSearchParams,
      __out: undefined
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(snippet, sandbox);
    return sandbox.__out;
  };

  // 合法站内路径：回到 H5
  assert.equal(evaluate('?redirect=%2Fh5%2Findex.html'), '/h5/index.html');
  assert.equal(evaluate('?redirect=/home.html'), '/home.html');

  // 拒绝开放重定向
  assert.equal(evaluate('?redirect=https://evil.example.com/x'), null);
  assert.equal(evaluate('?redirect=//evil.example.com/x'), null);
  assert.equal(evaluate('?redirect=/a://b'), null);
  assert.equal(evaluate(''), null);
});
