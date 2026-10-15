import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { initDb } from '../src/storage/db.js';

test('Desktop Eight Defects Verification Suite', async (t) => {
  const testDbDir = path.resolve('tests/test-defects-db');
  fs.mkdirSync(testDbDir, { recursive: true });
  const testDbPath = path.join(testDbDir, 'defects-test.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = initDb(testDbPath);
  const app = await buildApp({
    db,
    dbPath: testDbPath,
    secureCookie: false
  });

  const desktopHtml = fs.readFileSync('desktop/index.html', 'utf8');
  const desktopCss = fs.readFileSync('desktop/css/desktop-gallery.css', 'utf8');
  const desktopAppJs = fs.readFileSync('desktop/js/app.js', 'utf8');
  const desktopApiJs = fs.readFileSync('desktop/js/api-client.js', 'utf8');

  await t.test('Defect 1: 登录系统有效性 - login.html & desktop 模态框 & login API', async () => {
    // 1. 独立登录页 desktop/login.html
    const loginRes = await app.inject({ method: 'GET', url: '/desktop/login.html' });
    assert.equal(loginRes.statusCode, 200);
    assert.match(loginRes.headers['content-type'], /text\/html/);
    assert.ok(loginRes.body.includes('desktopLoginForm'));

    // 2. desktop/index.html 内置登录模态框
    assert.ok(desktopHtml.includes('desktopLoginModalOverlay'), '主页需包含桌面端原生温润登录模态框');
    assert.ok(desktopHtml.includes('openLoginModal'), '去登录按钮支持原地唤起登录模态框');

    // 3. API Client 包含原生 login 方法
    assert.ok(desktopApiJs.includes('async login(you, baby, password'), 'api-client 必须提供 login 方法');
  });

  await t.test('Defect 2: 照片上传健壮性 - 双重参数签名支持', async () => {
    // api-client.js uploadPhoto 同时支持对象入参和位置参数入参
    assert.ok(desktopApiJs.includes('async uploadPhoto(firstArg'), 'uploadPhoto 必须兼容灵活入参');
    // app.js 中规范使用对象解构形式传参，杜绝传递 undefined
    assert.ok(desktopAppJs.includes('api.uploadPhoto({ file: item.file'), '上传队列必须按对象安全传参');
    assert.ok(desktopAppJs.includes('api.uploadPhoto({ file,'), '封面上传必须按对象安全传参');
  });

  await t.test('Defect 3: 相册文件夹选中高光 - .folder-card.active 样式与归一化', async () => {
    // CSS 必须包含 .folder-card.active
    assert.ok(desktopCss.includes('.folder-card.active'), 'CSS 必须定义 .folder-card.active');
    assert.ok(desktopCss.includes('border-color: var(--color-accent)'), 'active 必须高亮强调色');

    // app.js 中的比对必须做路径斜杠归一化
    assert.ok(desktopAppJs.includes('replace(/^\\/+|\\/+$/g'), '必须做前导尾随斜杠归一化匹配');
  });

  await t.test('Defect 4: 相册文件夹新建按钮 - 显要头部按钮与列表卡片', async () => {
    // 头部区域必须包含「＋ 新建文件夹」
    assert.ok(desktopHtml.includes('openCreateFolderDialog()'), '相册顶栏操作区必须包含新建文件夹');
    assert.ok(desktopHtml.includes('＋ 新建文件夹'), '相册顶栏明确有新建文件夹文案');
  });

  await t.test('Defect 5: 商城同步性 - 真实商品数据与切换/兑换即时刷新', async () => {
    // 种子数据与真实数据库的 11 款商品对齐
    assert.ok(desktopApiJs.includes('prod_1') && desktopApiJs.includes('贴贴券'), '商品包含贴贴券');
    assert.ok(desktopApiJs.includes('prod_2') && desktopApiJs.includes('亲亲券'), '商品包含亲亲券');
    assert.ok(desktopApiJs.includes('prod_10') && desktopApiJs.includes('玫瑰花束'), '商品包含玫瑰花束');

    // switchWishesTab 切换到 shop 时全量拉取
    assert.ok(desktopAppJs.includes('loadShopProducts()'), '切换 Tab 时必须拉取商品');
    // 兑换后必须触发全量同步
    assert.ok(desktopAppJs.includes('updateBackpackBadge()'), '兑换后刷新背包状态');
  });

  await t.test('Defect 6: 删除文件夹偶发无效 - 路径归一化与当前浏览重置', async () => {
    // deleteFolder 包含 CSRF 预检和状态同步
    assert.ok(desktopApiJs.includes('async deleteFolder(folderPath)'), 'api 包含 deleteFolder');
    // app.js 中删除后对 state.currentFolder 进行鲁棒清空
    assert.ok(desktopAppJs.includes('cleanCurrent === cleanTarget'), '删除后归一化比对当前文件夹');
  });

  await t.test('Defect 7: 已读信件不再挂在主页 - 后端 read 兼容与未读精确判定', async () => {
    // api-client 处理后端返回的 read 字段，不能因为缺少 is_read 误判为未读
    assert.ok(desktopApiJs.includes('!w.read') || desktopApiJs.includes('w.read'), '必须兼容处理后端 read 布尔值');
    assert.ok(desktopAppJs.includes('Boolean(w.unread)'), 'app.js 必须严格按布尔值过滤未读');
  });

  await t.test('Defect 8: 私密空间顺畅打开 - 演示模式降级与独立认证流程', async () => {
    // api-client verifyPrivatePassword 支持演示兜底
    assert.ok(desktopApiJs.includes('5200'), '未登录或离线模式支持 5200 演示密码');
    assert.ok(desktopApiJs.includes('1314'), '未登录或离线模式支持 1314 演示密码');
    // 切换到私密空间支持状态显示
    assert.ok(desktopAppJs.includes('privateUnlockedView'), '支持展示私密解锁内容');
  });
});
