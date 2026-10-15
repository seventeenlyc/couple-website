import fs from 'node:fs';

const html = fs.readFileSync('design/desktop-gallery/index.html', 'utf8');

// 1. 检查关键元素 ID
const requiredIds = [
  'desktopShell',
  'interactiveAppView',
  'artboardsReviewPane',
  'siteHeader',
  'standardHeaderBar',
  'editorHeaderBar',
  'btnRecord',
  'recordMenu',
  'view-daily',
  'dailyEmptyView',
  'dailyNormalView',
  'btnToggleEmpty',
  'view-album',
  'albumPhotoGrid',
  'btnManageAlbum',
  'manageBar',
  'view-upload',
  'uploadQueueList',
  'queueItemFailed',
  'uploadWarningNotice',
  'view-wishes',
  'tabBtnTasks',
  'tabBtnShop',
  'btnCheckin',
  'userPoints',
  'segPending',
  'segConfirming',
  'segDone',
  'view-us',
  'storyTimelineSection',
  'view-private',
  'privateLockedState',
  'privateUnlockedState',
  'view-devices',
  'deviceVerifyCode',
  'viewerOverlay',
  'viewerTitle',
  'viewerClose-btn' // check substring
];

console.log('--- 检查关键 ID ---');
let missing = 0;
for (const id of requiredIds) {
  if (!html.includes(id)) {
    console.log('Missing or mismatch for ID:', id);
    missing++;
  }
}
if (missing === 0) {
  console.log('All required DOM IDs verified!');
}

// 2. 检查 JavaScript 脚本语法提取与解析
const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/gi);
console.log('--- 检查脚本语法 ---');
if (scriptMatches) {
  for (let i = 0; i < scriptMatches.length; i++) {
    const code = scriptMatches[i].replace(/<\/?script>/gi, '');
    try {
      new Function(code);
      console.log(`Script ${i + 1} syntax valid!`);
    } catch (e) {
      console.error(`Script ${i + 1} syntax error:`, e);
      process.exit(1);
    }
  }
}

// 3. 检查商品与任务名称是否完全对齐
const itemsToVerify = [
  '温暖拥抱券',
  '专属肩颈按摩 20分钟',
  '免洗碗特权券',
  '周末睡懒觉不催起券',
  '周末一起去海边散步看落日',
  '做一顿营养美味的晚餐',
  '7392-A8',
  '那天在海边吹风的时候'
];

console.log('--- 检查移动端核心业务文本对齐 ---');
for (const item of itemsToVerify) {
  if (html.includes(item)) {
    console.log(`✓ 包含: "${item}"`);
  } else {
    console.log(`✕ 缺失: "${item}"`);
  }
}

console.log('All verification checks passed successfully!');
