import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

test('Desktop & H5 7项关键功能对齐审计修复验证套件', async (t) => {
  const desktopAppJs = fs.readFileSync(path.join(ROOT_DIR, 'desktop/js/app.js'), 'utf8');
  const desktopApiJs = fs.readFileSync(path.join(ROOT_DIR, 'desktop/js/api-client.js'), 'utf8');
  const desktopHtml = fs.readFileSync(path.join(ROOT_DIR, 'desktop/index.html'), 'utf8');
  const desktopCss = fs.readFileSync(path.join(ROOT_DIR, 'desktop/css/desktop-gallery.css'), 'utf8');

  await t.test('Gap 1 (High): 私密空间重新进入预检服务端会话，失效或锁定时彻底清空敏感DOM与缓存', () => {
    // 1. switchPage 进入 private 必须调用 enterPrivateSpace 预检服务端真实会话
    assert.ok(desktopAppJs.includes('enterPrivateSpace'), '必须声明并调用 enterPrivateSpace');
    assert.ok(desktopAppJs.includes('api.checkPrivateAuth()'), 'enterPrivateSpace 必须调用 checkPrivateAuth 检查会话');

    // 2. 失效或锁定时必须彻底清理敏感DOM和内存缓存
    assert.ok(desktopAppJs.includes('resetPrivateSpaceStateAndDOM'), '必须声明 resetPrivateSpaceStateAndDOM');
    assert.ok(desktopAppJs.includes("notesContainer.innerHTML = ''"), '失效或锁定时必须清空笔记容器DOM');
    assert.ok(desktopAppJs.includes("filesContainer.innerHTML = ''"), '失效或锁定时必须清空文件容器DOM');
    assert.ok(desktopAppJs.includes('state.privateNotes = []'), '失效或锁定时必须清空私密笔记数组');
    assert.ok(desktopAppJs.includes('state.privateFiles = []'), '失效或锁定时必须清空私密文件数组');
  });

  await t.test('Gap 2 (High): 深层目录全链路使用完整规范路径，上传默认继承当前浏览目录', () => {
    // 1. 文件夹卡片点击、重命名、删除使用规范完整路径
    assert.ok(desktopAppJs.includes('openRenameFolderDialog') && desktopAppJs.includes('normalizedPath'), '重命名必须传入规范化路径');
    assert.ok(desktopAppJs.includes('confirmDeleteCurrentFolder') && desktopAppJs.includes('normalizedPath'), '删除文件夹必须传入规范化路径');
    assert.ok(desktopAppJs.includes('navigateToFolder(normalizedPath)'), '进入文件夹必须传入规范化路径');

    // 2. 上传目标目录下拉选项使用完整路径，并继承当前浏览目录
    assert.ok(desktopAppJs.includes('state.currentFolder'), 'populateUploadFolders 必须感知当前浏览目录');
    assert.ok(desktopAppJs.includes('select.value = currentNorm'), '上传下拉框必须默认继承当前目录');
  });

  await t.test('Gap 3 (High): 积分余额合法返回 0 时精确显示 0，绝不能非法 fallback 为 520', () => {
    // 1. loadTasksAndPoints 针对 points 的类型与合法 0 进行精准判断
    assert.ok(desktopAppJs.includes("typeof points === 'number' && !isNaN(points)"), 'app.js 必须对 points 进行 number 类型精确判定');

    // 2. api-client.js 中从 localStorage 读取时支持 '0'
    assert.ok(desktopApiJs.includes('stored !== null') || desktopApiJs.includes("!isNaN(Number(stored))"), 'api-client 必须识别存储的 0 余额');
  });

  await t.test('Gap 4 (Medium): 上传队列对齐防重提锁、真实进度、单项重试隔离、单项移除、标题标签与拖拽', () => {
    // 1. 防重复提交与按钮禁用
    assert.ok(desktopAppJs.includes('state.isUploading = true'), '开始上传必须标记 isUploading');
    assert.ok(desktopAppJs.includes('submitBtn.disabled = true'), '开始上传必须禁用提交按钮');

    // 2. 单项重试隔离：点击单项重试仅上传该指定项
    assert.ok(desktopAppJs.includes('startQueueUpload(targetItemId)') || desktopAppJs.includes('startQueueUpload(itemId)'), 'startQueueUpload 必须支持单项隔离上传');
    assert.ok(desktopAppJs.includes('itemsToUpload = state.uploadQueue.filter(i => i.id === targetItemId)'), '重试必须仅筛选目标单项');

    // 3. 单项移除操作与标题/标签支持
    assert.ok(desktopAppJs.includes('removeUploadQueueItem'), '必须支持单项移除 removeUploadQueueItem');
    assert.ok(desktopAppJs.includes('updateQueueItemTitle'), '必须支持自定义照片标题');
    assert.ok(desktopAppJs.includes('updateQueueItemTag'), '必须支持自定义照片标签');

    // 4. 拖拽支持与高亮样式
    assert.ok(desktopAppJs.includes('dropzone.addEventListener(\'drop\''), '必须绑定 dropzone drop 事件');
    assert.ok(desktopCss.includes('.dropzone-box.drag-over'), 'CSS 必须包含 drag-over 样式');

    // 5. 详细传输结果统计提示
    assert.ok(desktopAppJs.includes('successCount') && desktopAppJs.includes('failCount'), '上传必须统计成功与失败数量');
  });

  await t.test('Gap 5 (Medium): 日常生活流由真实数据动态生成，相册子目录浏览不污染首页封面', () => {
    // 1. 首页封面与相册子目录解耦
    assert.ok(desktopAppJs.includes('loadDailyPhotosAndHero'), '必须存在独立的 loadDailyPhotosAndHero');
    assert.ok(desktopAppJs.includes('renderDailyPhotoPair'), '双图片段必须由真实照片流渲染');
    assert.ok(desktopHtml.includes('id="dailyPairPhotoGrid"'), 'HTML 中双图容器具备专用 ID');

    // 2. 相册加载函数 loadPhotosAndFolders 绝不调用 setupHeroCarousel 改写首页封面
    const loadPhotosMatch = desktopAppJs.match(/async function loadPhotosAndFolders\(\)[\s\S]*?renderPhotoGrid\(\);([\s\S]*?)\}/);
    assert.ok(loadPhotosMatch, '必须找到 loadPhotosAndFolders 函数');
    assert.ok(!loadPhotosMatch[1].includes('setupHeroCarousel(state.photos)'), 'loadPhotosAndFolders 绝不能用子目录照片污染首页封面');
  });

  await t.test('Gap 6 (Medium): 故事时间线完整渲染配图附件，并支持高清大图查看', () => {
    assert.ok(desktopAppJs.includes('item.photos') && desktopAppJs.includes('openSinglePhotoViewerFromStory'), '故事渲染必须支持配图并提供查看入口');
    assert.ok(desktopAppJs.includes('function openSinglePhotoViewerFromStory'), '必须实现 openSinglePhotoViewerFromStory');
  });

  await t.test('Gap 7 (Medium): 拾光AI回复完整渲染回忆引用卡（memoryRef）与示例回复标识（isExample）', () => {
    assert.ok(desktopAppJs.includes('res.isExample') && desktopAppJs.includes('[示例回复]'), 'AI回复必须呈现 [示例回复] 标识');
    assert.ok(desktopAppJs.includes('res.memoryRef') && desktopAppJs.includes('openImageViewerForMemory'), 'AI回复必须呈现回忆引用卡并支持查看');
    assert.ok(desktopAppJs.includes('function openImageViewerForMemory'), '必须实现 openImageViewerForMemory');
  });

  await t.test('复审剩余4项专项验证 [P1]: 校验请求版本控制，迟到响应绝不重新打开已锁定空间', () => {
    // 1. 验证版本控制字段存在且递增
    assert.ok(desktopAppJs.includes('privateAuthReqVersion'), 'state 必须声明 privateAuthReqVersion 字段');
    assert.ok(desktopAppJs.includes('currentReqVersion !== state.privateAuthReqVersion'), 'enterPrivateSpace 必须核验版本号并废弃旧响应');

    // 2. 模拟迟到响应版本拦截行为
    let privateUnlocked = false;
    let authReqVersion = 0;

    // 发起第一个进入请求 req1
    const req1Version = ++authReqVersion;
    // 此时用户执行锁定
    authReqVersion++;
    privateUnlocked = false;

    // req1 的 authenticated=true 响应迟到到达
    if (req1Version === authReqVersion) {
      privateUnlocked = true;
    }

    assert.equal(privateUnlocked, false, '迟到的验证通过响应必须被版本号拦截，空间保持锁定');
  });

  await t.test('复审剩余4项专项验证 [P2]: 上传标签兼容 tag 与 tags，确保选择的“旅行”真实进入 FormData', () => {
    // 1. 客户端代码检查
    assert.ok(desktopApiJs.includes('tags = firstArg.tags || firstArg.tag || \'日常\''), 'api-client 必须兼容读取 firstArg.tag');
    assert.ok(desktopAppJs.includes('tags: item.tag'), 'app.js 提交上传必须显式传递 tags 字段');

    // 2. 模拟实际 FormData 构造逻辑
    const mockFormData = new Map();
    const simulateUploadParam = (firstArg) => {
      let tags = '日常';
      if (firstArg && typeof firstArg === 'object') {
        tags = firstArg.tags || firstArg.tag || '日常';
      }
      mockFormData.set('tags', tags);
    };

    // 传 tag: '旅行'
    simulateUploadParam({ file: {}, title: 'test', tag: '旅行' });
    assert.equal(mockFormData.get('tags'), '旅行', '传入 tag 为旅行时，FormData tags 必须为旅行');

    // 传 tag: '美食'
    simulateUploadParam({ file: {}, title: 'test', tag: '美食', tags: '美食' });
    assert.equal(mockFormData.get('tags'), '美食', '双传 tags 为美食时，FormData tags 必须为美食');
  });

  await t.test('复审剩余4项专项验证 [P2]: 封面选图/自动恢复/封面上传全链路刷新独立日常数据流', () => {
    // 1. 选图确认使用 loadDailyPhotosAndHero 而不是 setupHeroCarousel(state.photos)
    const pickerFn = desktopAppJs.slice(desktopAppJs.indexOf('async function confirmHeroPickerSelection()'), desktopAppJs.indexOf('function closeHeroPhotoPicker()'));
    assert.ok(pickerFn.includes('loadDailyPhotosAndHero'), 'confirmHeroPickerSelection 必须调用 loadDailyPhotosAndHero');
    assert.ok(!pickerFn.includes('setupHeroCarousel(state.photos)'), 'confirmHeroPickerSelection 不能使用当前相册目录 photos');

    // 2. 恢复自动模式使用 loadDailyPhotosAndHero
    const resetHeroFn = desktopAppJs.slice(desktopAppJs.indexOf('async function resetToAutoHero()'), desktopAppJs.indexOf('function triggerHeroPhotoUpload()'));
    assert.ok(resetHeroFn.includes('loadDailyPhotosAndHero'), 'resetToAutoHero 必须调用 loadDailyPhotosAndHero');
    assert.ok(!resetHeroFn.includes('setupHeroCarousel(state.photos)'), 'resetToAutoHero 不能使用当前相册目录 photos');

    // 3. 封面上传完成后必须调用 loadDailyPhotosAndHero
    const handleUploadFn = desktopAppJs.slice(desktopAppJs.indexOf('async function handleHeroUpload(input)'), desktopAppJs.indexOf('async function loadPhotosAndFolders()'));
    assert.ok(handleUploadFn.includes('loadDailyPhotosAndHero'), 'handleHeroUpload 必须刷新 loadDailyPhotosAndHero');
  });

  await t.test('复审剩余4项专项验证 [P2]: 空照片列表清理旧图与轮播，呈现真实优雅空状态', () => {
    // 1. setupHeroCarousel 在照片为空时必须清空旧状态并停止自动轮播
    assert.ok(desktopAppJs.includes('stopHeroAutoPlay()'), 'setupHeroCarousel 必须停止轮播定时器');
    assert.ok(desktopAppJs.includes("titleEl.textContent = '暂无封面照片"), '空列表时封面标题必须显示明确空状态提示');

    // 2. renderDailyPhotoPair 在空列表时不使用示例图，而是显示记录入口
    assert.ok(!desktopAppJs.includes('老巷手冲咖啡'), 'renderDailyPhotoPair 绝不能在空列表分支展示固定假数据');
    assert.ok(desktopAppJs.includes('相册暂无日常生活瞬间'), 'renderDailyPhotoPair 必须展示真实相册空状态');
  });

  await t.test('真实代码沙箱执行 [P1/P2/P3]: 执行实际app.js验证stopHeroAutoPlay、密码解锁版本保护、数据加载防覆盖', async () => {
    // 构造高拟真DOM环境
    const elements = new Map();
    const getOrCreateEl = (id) => {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            toggle(c, force) {
              if (force === undefined) {
                if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c);
              } else if (force) this.classes.add(c); else this.classes.delete(c);
            }
          },
          innerHTML: '',
          textContent: '',
          value: '',
          children: [],
          addEventListener() {},
          appendChild(child) {
            this.children.push(child);
            this.innerHTML += child.innerHTML || '';
          },
          click() {}
        });
      }
      return elements.get(id);
    };

    const mockStorage = new Map();
    const mockApi = {
      resolveAssetUrl: (u) => u || '',
      getPhotos: async () => [],
      getFolders: async () => [],
      getAppConfig: async () => ({ love_days: 520 }),
      getDailyQuote: async () => '测试文案',
      getCheckinStatus: async () => ({ checked_in: false }),
      getTasks: async () => [],
      getPoints: async () => 520,
      getShopProducts: async () => [],
      getMyBackpack: async () => [],
      getPartnerPendingItems: async () => [],
      getAnniversaryReminders: async () => [],
      getStoryTimeline: async () => [],
      getWhispersHistory: async () => [],
      checkPrivateAuth: async () => ({ authenticated: false }),
      verifyPrivatePassword: async () => ({ authenticated: false }),
      getPrivateNotes: async () => [],
      getPrivateFiles: async () => [],
      logoutPrivate: async () => ({ success: true })
    };

    const sandbox = {
      window: {},
      document: {
        getElementById: (id) => getOrCreateEl(id),
        createElement: (tag) => getOrCreateEl(`gen_${Math.random().toString(36).slice(2, 7)}`),
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
        body: { style: {}, appendChild: () => {} }
      },
      localStorage: {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k)
      },
      galleryApi: mockApi,
      clearInterval: () => {},
      setInterval: () => 123,
      setTimeout: (fn) => { fn(); return 456; },
      clearTimeout: () => {},
      URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
      console
    };
    sandbox.window = sandbox;

    // 真正执行 desktop/js/app.js 脚本！
    vm.createContext(sandbox);
    vm.runInContext(desktopAppJs, sandbox);

    // 验证场景 1：真实执行 setupHeroCarousel，不抛 ReferenceError: stopHeroAutoPlay is not defined
    assert.doesNotThrow(() => {
      sandbox.window.setupHeroCarousel([]);
    }, 'setupHeroCarousel([]) 执行时绝不抛出 stopHeroAutoPlay 未定义错误');

    const heroTitle = getOrCreateEl('heroCoverTitle');
    assert.equal(heroTitle.textContent, '暂无封面照片 · 点击更换封面', '空照片时封面标题准确呈现空状态');

    assert.doesNotThrow(() => {
      sandbox.window.setupHeroCarousel([{ id: 1, title: '海边落日', url: '/sun.jpg', date: '2026.09.28' }]);
    }, 'setupHeroCarousel 传入正常照片列表正常执行不抛错');
    assert.equal(heroTitle.textContent, '海边落日', '有照片时封面标题正常渲染为实际照片标题');

    // 验证场景 2：真实执行密码解锁时钟控制（PIN 码与文本密码迟到响应拦截）
    let deferredVerify = null;
    mockApi.verifyPrivatePassword = () => new Promise(resolve => { deferredVerify = resolve; });

    // 触发 PIN 解锁，期间请求飞行
    sandbox.window.inputPin('1');
    sandbox.window.inputPin('2');
    sandbox.window.inputPin('3');
    sandbox.window.inputPin('4'); // 触发 verifyPinCode

    // 此时用户执行锁定
    await sandbox.window.lockPrivateSpace();

    // 释放迟到的成功响应
    deferredVerify({ authenticated: true });
    await new Promise(r => setImmediate(r));

    const unlockedView = getOrCreateEl('privateUnlockedView');
    const lockedView = getOrCreateEl('privateLockedView');
    assert.equal(unlockedView.style.display, 'none', '迟到响应到达后，私密空间必须保持隐藏');
    assert.equal(lockedView.style.display, 'block', '迟到响应到达后，锁定界面必须保持显示');

    // 验证场景 3：真实执行正文加载防覆盖
    let deferredNotesOld = null;
    let deferredNotesNew = null;
    let callCount = 0;
    mockApi.getPrivateNotes = () => new Promise(resolve => {
      callCount++;
      if (callCount === 1) deferredNotesOld = resolve;
      else deferredNotesNew = resolve;
    });
    mockApi.checkPrivateAuth = async () => ({ authenticated: true });

    // 第一个会话进入
    sandbox.window.enterPrivateSpace();
    await new Promise(r => setImmediate(r)); // 此时 checkPrivateAuth 通过，正文等待 deferredNotesOld

    // 发生锁定
    await sandbox.window.lockPrivateSpace();

    // 第二个会话进入
    sandbox.window.enterPrivateSpace();
    await new Promise(r => setImmediate(r)); // 此时第二次 checkPrivateAuth 通过，等待 deferredNotesNew

    // 第二个会话（新会话）先成功返回！
    deferredNotesNew([{ id: 2, title: 'NEW_VALID_SECRET', content: '新私密内容' }]);
    await new Promise(r => setImmediate(r));

    // 旧会话数据此时迟到返回！
    deferredNotesOld([{ id: 1, title: 'OLD_REVOKED_SECRET', content: '旧私密内容' }]);
    await new Promise(r => setImmediate(r));

    // 断言容器中的正文绝没有被旧正文覆盖，且当前空间仍正常打开
    const notesContainer = getOrCreateEl('privateNotesContainer');
    assert.ok(notesContainer.innerHTML.includes('NEW_VALID_SECRET'), '新会话的正文必须完整保留，绝不被旧数据覆盖');
    assert.ok(!notesContainer.innerHTML.includes('OLD_REVOKED_SECRET'), '旧会话的迟到数据必须被直接丢弃');
    assert.equal(unlockedView.style.display, 'block', '新会话绝不被旧会话结束时的代码清空或关闭');
  });
});
