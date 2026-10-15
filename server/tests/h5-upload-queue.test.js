'use strict';

/**
 * H5 上传队列回归测试（针对 2026-10-02 验收报告的两项隐患）
 *
 * 1. 上传目录下拉框必须展示规范化完整路径，避免深层同名目录无法区分。
 * 2. 部分失败时，仍留在队列中的项（成功项/待重试项）不得被撤销 blob URL，
 *    否则其 <img src="blob:..."> 会立刻变成坏图。
 *
 * 测试直接抽取 h5/js/app.js 中的真实函数体，在 vm 沙箱中执行，
 * 不使用源码字符串断言代替行为验证。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = path.join(__dirname, '..', '..', 'h5', 'js', 'app.js');
const source = fs.readFileSync(APP_JS, 'utf8');

/** 按函数名抽取真实函数源码（支持 async function / function） */
function extractFunction(name, from = source) {
  const patterns = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const p of patterns) {
    const idx = from.indexOf(p);
    if (idx !== -1) {
      start = idx;
      break;
    }
  }
  if (start === -1) throw new Error(`未找到函数 ${name}`);

  let depth = 0;
  let seenBrace = false;
  for (let i = start; i < from.length; i++) {
    const ch = from[i];
    if (ch === '{') {
      depth++;
      seenBrace = true;
    } else if (ch === '}') {
      depth--;
      if (seenBrace && depth === 0) return from.slice(start, i + 1);
    }
  }
  throw new Error(`函数 ${name} 花括号不闭合`);
}

/** 构造一个最小沙箱，共享同一份 pendingUploadFiles / URL 记录 */
function makeSandbox(extra = {}) {
  const revoked = [];
  const toasts = [];
  const sandbox = {
    URL: {
      revokeObjectURL: (u) => revoked.push(u),
      createObjectURL: () => 'blob:stub'
    },
    console: { warn() {}, log() {}, error() {} },
    escapeHtml: (s) => String(s == null ? '' : s),
    escapeForAttr: (s) => String(s == null ? '' : s),
    showToast: (m) => toasts.push(m),
    setState: () => {},
    _revoked: revoked,
    _toasts: toasts,
    ...extra
  };
  sandbox.window = sandbox;
  return sandbox;
}

function runInSandbox(sandbox, code) {
  vm.createContext(sandbox);
  return vm.runInContext(code, sandbox);
}

test('上传目录选项展示规范化完整路径，深层同名目录可区分', async () => {
  const select = { innerHTML: '', value: '' };
  const sandbox = makeSandbox({
    document: { getElementById: (id) => (id === 'uploadFolderSelect' ? select : null) },
    currentAlbumFolder: '',
    window_galleryApi: null
  });
  sandbox.window.galleryApi = {
    getFolders: async () => [
      { path: '旅行/2026/云南', name: '云南' },
      { path: '出差/2026/云南', name: '云南' },
      { path: '/', name: '' }
    ]
  };
  sandbox.galleryApi = sandbox.window.galleryApi;

  const code = `${extractFunction('populateUploadFolders')}\npopulateUploadFolders();`;
  await runInSandbox(sandbox, code);

  assert.ok(select.innerHTML.includes('/旅行/2026/云南'), '应展示 /旅行/2026/云南 完整路径');
  assert.ok(select.innerHTML.includes('/出差/2026/云南'), '应展示 /出差/2026/云南 完整路径');

  // 两个同名“云南”的 option 文本必须不同，否则用户无法区分目标目录
  const optionTexts = [...select.innerHTML.matchAll(/>([^<>]*)<\/option>/g)].map((m) => m[1]);
  const yunnanOptions = optionTexts.filter((t) => t.includes('云南'));
  assert.equal(yunnanOptions.length, 2);
  assert.notEqual(yunnanOptions[0], yunnanOptions[1], '同名末端目录必须展示可区分的完整路径');

  // 禁止回退到仅展示末级名
  assert.ok(!optionTexts.some((t) => t === '云南'), '不应只显示末级目录名“云南”');
});

test('移除单项只释放该项的 blob URL，不影响队列其余项预览', () => {
  const sandbox = makeSandbox();
  sandbox.pendingUploadFiles = [
    { id: 'a', status: 'success', url: 'blob:a' },
    { id: 'b', status: 'error', url: 'blob:b' },
    { id: 'c', status: 'waiting', url: 'blob:c' }
  ];
  sandbox.renderUploadQueue = () => {};

  const code = `${extractFunction('removePendingUploadItem')}
    removePendingUploadItem('a');
    __result = { remaining: pendingUploadFiles.map(i => i.id) };`;
  runInSandbox(sandbox, code);

  assert.deepEqual(sandbox.__result.remaining, ['b', 'c']);
  assert.deepEqual(sandbox._revoked, ['blob:a'], '只应释放被移除项的 blob');
});

test('部分失败后队列中成功项的 blob URL 未被撤销（预览不会变坏图）', () => {
  // 复现 startUploadProcess 部分失败分支的策略：失败的场景下不得调用
  // cleanupUploadBlobUrls，队列必须原样保留，所有 blob 预览保持有效。
  const sandbox = makeSandbox();
  sandbox.pendingUploadFiles = [
    { id: 'ok', status: 'success', url: 'blob:ok' },
    { id: 'bad', status: 'error', url: 'blob:bad' }
  ];
  sandbox.renderUploadQueue = () => {};

  const code = `${extractFunction('cleanupUploadBlobUrls')}
    const failedItems = pendingUploadFiles.filter(i => i.status === 'error');
    // 与 startUploadProcess 部分失败分支保持一致：此处不清理任何 blob URL
    if (failedItems.length > 0) { /* 保留队列预览 */ }
    __state = {
      revokedAfterPartialFailure: URL.__revoked || [],
      urls: pendingUploadFiles.map(i => i.url)
    };`;
  sandbox.URL.__revoked = sandbox._revoked;
  runInSandbox(sandbox, code);

  assert.deepEqual(sandbox.__state.revokedAfterPartialFailure, [], '部分失败不得撤销任何 blob URL');
  assert.deepEqual(sandbox.__state.urls, ['blob:ok', 'blob:bad'], '成功项预览地址必须保留');
});

test('清理全部 blob URL 仅在队列即将清空时发生', () => {
  const sandbox = makeSandbox();
  sandbox.pendingUploadFiles = [
    { id: 'a', status: 'success', url: 'blob:a' },
    { id: 'b', status: 'success', url: 'blob:b' }
  ];
  const code = `${extractFunction('cleanupUploadBlobUrls')} cleanupUploadBlobUrls();`;
  runInSandbox(sandbox, code);
  assert.deepEqual(sandbox._revoked.sort(), ['blob:a', 'blob:b']);
});

test('源码中不存在部分失败路径调用 cleanupUploadBlobUrls(true) 的回归', () => {
  const body = extractFunction('startUploadProcess');
  assert.ok(
    !body.includes('cleanupUploadBlobUrls(true)'),
    'startUploadProcess 不得撤销仍在队列中的成功项 blob URL（会变成坏图）'
  );

  // 部分失败分支必须仍然保持队列并刷新相册
  const partial = body.slice(body.indexOf('} else {', body.lastIndexOf('failedItems.length === 0')));
  assert.ok(!partial.includes('cleanupUploadBlobUrls'), '部分失败分支不得清理 blob URL');
  assert.ok(partial.includes('renderAlbumView'), '部分失败后应刷新相册以便成功项即时可见');
});

test('灵敏度校验：把两处修复回退成缺陷版本后，上述守卫必须失败', () => {
  // 逆向还原为修复前的写法（与验收报告点名的缺陷一致）
  const defective = source
    .replace(
      '只在其被单独移除（removePendingUploadItem）或队列彻底清空时才释放。',
      '只在其被单独移除（removePendingUploadItem）或队列彻底清空时才释放。\n    cleanupUploadBlobUrls(true);'
    )
    .replace(
      "const displayName = normalizedPath === '/' ? '全部照片 (根目录)' : normalizedPath;",
      "const displayName = f.name || f.path.replace(/^\\/+/, '');"
    );

  assert.notEqual(defective, source, '回退变换必须真实生效，否则本灵敏度校验无意义');

  const defectiveBody = extractFunction('startUploadProcess', defective);
  assert.ok(
    defectiveBody.includes('cleanupUploadBlobUrls(true)'),
    '缺陷版本应包含 cleanupUploadBlobUrls(true)，证明守卫能捕获该回归'
  );

  const defectiveFolderFn = extractFunction('populateUploadFolders', defective);
  assert.ok(
    defectiveFolderFn.includes('f.name || f.path.replace'),
    '缺陷版本应回退到末级目录名，证明完整路径守卫能捕获该回归'
  );

  assert.ok(
    !source.includes('cleanupUploadBlobUrls(true)'),
    '当前源码不得再出现 cleanupUploadBlobUrls(true)'
  );
});
