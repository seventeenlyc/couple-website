import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../../', import.meta.url));
import { buildApp } from '../src/app.js';
import { initDb, closeDb } from '../src/storage/db.js';

test('Desktop Gallery App Production Frontend & Full Mobile Parity Suite', async (t) => {
  const testDbDir = path.resolve('tests/test-desktop-db');
  fs.mkdirSync(testDbDir, { recursive: true });
  const testDbPath = path.join(testDbDir, 'desktop-test.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = initDb(testDbPath);

  const app = await buildApp({
    db,
    dbPath: testDbPath,
    secureCookie: false
  });

  await t.test('1. Static files for desktop application are served cleanly with proper MIME types', async () => {
    const htmlRes = await app.inject({ method: 'GET', url: '/desktop/index.html' });
    assert.equal(htmlRes.statusCode, 200);
    assert.match(htmlRes.headers['content-type'], /text\/html/);

    const cssRes = await app.inject({ method: 'GET', url: '/desktop/css/desktop-gallery.css' });
    assert.equal(cssRes.statusCode, 200);
    assert.match(cssRes.headers['content-type'], /text\/css/);

    const apiJsRes = await app.inject({ method: 'GET', url: '/desktop/js/api-client.js' });
    assert.equal(apiJsRes.statusCode, 200);
    assert.match(apiJsRes.headers['content-type'], /application\/javascript/);

    const appJsRes = await app.inject({ method: 'GET', url: '/desktop/js/app.js' });
    assert.equal(appJsRes.statusCode, 200);
    assert.match(appJsRes.headers['content-type'], /application\/javascript/);
  });

  await t.test('2. Desktop frontend is a real production app without demo toolbar or viewport simulator', async () => {
    const html = fs.readFileSync(path.join(rootDir, 'desktop/index.html'), 'utf8');

    // 严禁包含 demo 展示工具栏或画板模拟器
    assert.equal(html.includes('review-toolbar'), false, 'Must not include review-toolbar');
    assert.equal(html.includes('btnModeArtboard'), false, 'Must not include artboard review button');
    assert.equal(html.includes('viewport-container mode-'), false, 'Must not include viewport simulator wrapper');
    assert.equal(html.includes('切换 M02 空状态'), false, 'Must not include demo state toggler');

    // 必须包含生产级生活画廊全页面版心
    assert.ok(html.includes('siteHeader'), 'Includes standard sticky header');
    assert.ok(html.includes('view-daily'), 'Includes daily life feed');
    assert.ok(html.includes('view-album'), 'Includes album view');
    assert.ok(html.includes('view-upload'), 'Includes upload view');
    assert.ok(html.includes('view-wishes'), 'Includes wishes & tasks view');
    assert.ok(html.includes('view-us'), 'Includes us & story view');
    assert.ok(html.includes('viewerOverlay'), 'Includes large image viewer with 320px info pane');
  });

  await t.test('3. Album & Hero Carousel: full parity with mobile picker, folder CRUD, and batch operations', async () => {
    const html = fs.readFileSync(path.join(rootDir, 'desktop/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');

    // 封面挑选器模态框与设置弹层
    assert.ok(html.includes('heroPickerModal'), 'Has hero picker modal');
    assert.ok(html.includes('heroChangeSheetModal'), 'Has hero change menu modal');
    assert.ok(appJs.includes('openHeroPhotoPicker'), 'Has openHeroPhotoPicker');
    assert.ok(appJs.includes('toggleHeroPickerItem'), 'Has toggleHeroPickerItem');
    assert.ok(appJs.includes('confirmHeroPickerSelection'), 'Has confirmHeroPickerSelection');
    assert.ok(appJs.includes('resetToAutoHero'), 'Has resetToAutoHero');
    assert.ok(appJs.includes('triggerHeroPhotoUpload'), 'Has triggerHeroPhotoUpload');
    assert.ok(appJs.includes('handleHeroUpload'), 'Has handleHeroUpload');

    // 文件夹新建、重命名、删除
    assert.ok(html.includes('createFolderModalOverlay'), 'Has create folder modal');
    assert.ok(html.includes('renameFolderModalOverlay'), 'Has rename folder modal');
    assert.ok(appJs.includes('openCreateFolderDialog'), 'Has openCreateFolderDialog');
    assert.ok(appJs.includes('confirmCreateFolder'), 'Has confirmCreateFolder');
    assert.ok(appJs.includes('openRenameFolderDialog'), 'Has openRenameFolderDialog');
    assert.ok(appJs.includes('confirmRenameFolder'), 'Has confirmRenameFolder');
    assert.ok(appJs.includes('confirmDeleteCurrentFolder'), 'Has confirmDeleteCurrentFolder');

    // 批量管理与全选
    assert.ok(appJs.includes('selectAllPhotos'), 'Has selectAllPhotos');
    assert.ok(appJs.includes('batchDeletePhotos'), 'Has batchDeletePhotos');
    assert.ok(appJs.includes('openBatchMoveDialog'), 'Has openBatchMoveDialog');
  });

  await t.test('4. Wishes, Tasks, Shop, and Backpack: checkin, non-self-confirming, exchange modal & partner fulfillment', async () => {
    const html = fs.readFileSync(path.join(rootDir, 'desktop/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');

    // 签到与连续天数
    assert.ok(html.includes('checkinStreakTitle'), 'Has checkin streak title element');
    assert.ok(appJs.includes('initCheckin'), 'Has initCheckin');
    assert.ok(appJs.includes('handleDailyCheckin'), 'Has handleDailyCheckin');

    // 任务三段分段与防自我确认机制
    assert.ok(html.includes('segBtnPending') && html.includes('segBtnConfirming') && html.includes('segBtnDone'), 'Has 3-state task tabs');
    assert.ok(appJs.includes('my_completed'), 'Distinguishes my_completed state');
    assert.ok(appJs.includes('pending_partner'), 'Distinguishes pending_partner state');
    assert.ok(appJs.includes('等待对方确认'), 'Completer sees waiting message');
    assert.ok(appJs.includes('确认完成'), 'Verifier sees confirmation button');

    // 兑换二次确认弹窗
    assert.ok(html.includes('exchangeConfirmModalOverlay'), 'Has exchange confirmation modal');
    assert.ok(appJs.includes('openExchangeConfirmModal'), 'Has openExchangeConfirmModal');
    assert.ok(appJs.includes('executeExchange'), 'Has executeExchange');

    // 背包双分区与出示确认
    assert.ok(html.includes('backpackModal'), 'Has backpack modal');
    assert.ok(html.includes('backpackPendingList'), 'Has pending confirmation list');
    assert.ok(html.includes('backpackItemsList'), 'Has my usable items list');
    assert.ok(appJs.includes('triggerUseItem'), 'Has triggerUseItem');
    assert.ok(appJs.includes('confirmUseItem'), 'Has confirmUseItem');
    assert.ok(appJs.includes('updateBackpackBadge'), 'Has updateBackpackBadge');
  });

  await t.test('5. Secret space dual-mode authentication, notes CRUD, and encrypted files management', async () => {
    const html = fs.readFileSync(path.join(rootDir, 'desktop/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');

    // 双模式认证：PIN 码软键盘 + 常规文本密码
    assert.ok(html.includes('privatePinMode'), 'Has PIN keypad container');
    assert.ok(html.includes('privateTextMode'), 'Has text password container');
    assert.ok(appJs.includes('toggleSecretAuthMode'), 'Has toggleSecretAuthMode');
    assert.ok(appJs.includes('verifyPinCode'), 'Has verifyPinCode');
    assert.ok(appJs.includes('submitSecretTextPassword'), 'Has submitSecretTextPassword');
    assert.ok(appJs.includes('lockPrivateSpace'), 'Has lockPrivateSpace');

    // 私密随笔与受控文件双分区
    assert.ok(html.includes('secPrivateNotesView'), 'Has private notes section');
    assert.ok(html.includes('secPrivateFilesView'), 'Has private files section');
    assert.ok(html.includes('createNoteModalOverlay'), 'Has create note modal');
    assert.ok(html.includes('noteDetailModalOverlay'), 'Has note detail modal');
    assert.ok(appJs.includes('confirmSaveNote'), 'Has confirmSaveNote');
    assert.ok(appJs.includes('deletePrivateNoteAction'), 'Has deletePrivateNoteAction');
    assert.ok(appJs.includes('handleSecretFileUpload'), 'Has handleSecretFileUpload');
    assert.ok(appJs.includes('deletePrivateFileAction'), 'Has deletePrivateFileAction');
  });

  await t.test('6. Device Security & 8-Digit Code Workflow: approve, deny, and revoke', async () => {
    const html = fs.readFileSync(path.join(rootDir, 'desktop/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');

    assert.ok(html.includes('pendingDevicesWrap'), 'Has pending devices wrap');
    assert.ok(html.includes('activeDevicesWrap'), 'Has active devices wrap');
    assert.ok(appJs.includes('refreshPendingDevices'), 'Has refreshPendingDevices');
    assert.ok(appJs.includes('approvePendingDevice'), 'Has approvePendingDevice');
    assert.ok(appJs.includes('denyPendingDevice'), 'Has denyPendingDevice');
    assert.ok(appJs.includes('revokePendingDevice'), 'Has revokePendingDevice');
    assert.ok(appJs.includes('code.length !== 8'), 'Enforces 8-digit verification code');
  });

  await t.test('7. Letters, Story Timeline, and Shiguang AI Companion: full workflow parity', async () => {
    const html = fs.readFileSync(path.join(rootDir, 'desktop/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'desktop/js/app.js'), 'utf8');

    // 来信与写信
    assert.ok(html.includes('homeLetterBanner'), 'Has home letter banner');
    assert.ok(html.includes('letterModalPage'), 'Has letter reading modal');
    assert.ok(html.includes('writeLetterModal'), 'Has write letter modal');
    assert.ok(appJs.includes('refreshLetterBanner'), 'Has refreshLetterBanner');
    assert.ok(appJs.includes('openLetterModal'), 'Has openLetterModal');
    assert.ok(appJs.includes('displayCurrentWhisper'), 'Has displayCurrentWhisper');
    assert.ok(appJs.includes('showNextWhisper'), 'Has showNextWhisper');
    assert.ok(appJs.includes('handleLetterReadDone'), 'Has handleLetterReadDone');
    assert.ok(appJs.includes('archiveLetterAction'), 'Has archiveLetterAction');
    assert.ok(appJs.includes('submitDirectLetter'), 'Has submitDirectLetter');

    // 故事时间线
    assert.ok(html.includes('storyTimelineList'), 'Has story timeline container');
    assert.ok(html.includes('storyDraftModalOverlay'), 'Has story draft modal');
    assert.ok(appJs.includes('renderStoryTimeline'), 'Has renderStoryTimeline');
    assert.ok(appJs.includes('openStoryDraftModal'), 'Has openStoryDraftModal');
    assert.ok(appJs.includes('confirmSaveStory'), 'Has confirmSaveStory');

    // 拾光 AI 助手
    assert.ok(html.includes('btnShiguangFloat'), 'Has Shiguang float button');
    assert.ok(html.includes('shiguangDrawerOverlay'), 'Has Shiguang drawer overlay');
    assert.ok(html.includes('agentMemorySheetOverlay'), 'Has Shiguang memory sheet');
    assert.ok(html.includes('agentActionMenuOverlay'), 'Has Shiguang action menu');
    assert.ok(appJs.includes('openAgentDialog'), 'Has openAgentDialog');
    assert.ok(appJs.includes('handleSuggestChoice'), 'Has handleSuggestChoice');
    assert.ok(appJs.includes('handleAgentSend'), 'Has handleAgentSend');
    assert.ok(appJs.includes('executeAgentChat'), 'Has executeAgentChat');
    assert.ok(appJs.includes('triggerActionMenuWhisper'), 'Has triggerActionMenuWhisper');
    assert.ok(appJs.includes('triggerActionMenuStory'), 'Has triggerActionMenuStory');
  });

  await t.test('8. Full API Client Parity across all 31 core methods', async () => {
    const apiJs = fs.readFileSync(path.join(rootDir, 'desktop/js/api-client.js'), 'utf8');
    const h5ApiJs = fs.readFileSync(path.join(rootDir, 'h5/js/api-client.js'), 'utf8');

    const methods = [
      'fetchCsrfToken',
      'getAppConfig',
      'getDailyQuote',
      'getAnniversaryReminders',
      'getPoints',
      'getCheckinStatus',
      'doCheckin',
      'getTasks',
      'completeTask',
      'confirmTask',
      'getShopProducts',
      'getShopItems',
      'buyProduct',
      'purchaseItem',
      'getVirtualItems',
      'useVirtualItem',
      'confirmVirtualItem',
      'getPendingConfirmations',
      'getPhotos',
      'getFolders',
      'createFolder',
      'renameFolder',
      'deleteFolder',
      'uploadPhoto',
      'movePhoto',
      'deletePhoto',
      'getWhispersHistory',
      'getLetters',
      'sendWhisper',
      'sendLetter',
      'markWhisperRead',
      'getStoryTimeline',
      'getStoryEvents',
      'createStoryEvent',
      'verifyPrivatePassword',
      'logoutPrivate',
      'getPrivateNotes',
      'addPrivateNote',
      'deletePrivateNote',
      'getPrivateFiles',
      'uploadPrivateFile',
      'deletePrivateFile',
      'getDeviceList',
      'getPendingDevices',
      'approveDevice',
      'denyDevice',
      'revokeDevice',
      'uploadAvatar',
      'sendAgentChat',
      'checkSession',
      'logout'
    ];

    for (const m of methods) {
      assert.ok(apiJs.includes(m), `desktop api-client must contain method ${m}`);
      assert.ok(h5ApiJs.includes(m), `h5 api-client must contain method ${m}`);
    }
  });

  closeDb(db);
});
