/**
 * 我们之间 · 生活画廊 (H5 核心交互与界面控制器)
 * 全面接入后端真实 API：
 *   - 基础会话与情侣相伴天数、纪念日、今日一句
 *   - 任务列表动态加载、完成提交与对方确认
 *   - 每日打卡状态机与积分钱包更新
 *   - 相册真实目录切换、标签筛选与手机照片上传
 *   - 心愿小铺真实商品加载与兑换
 *   - 故事时间线编年节点动态加载与保存
 *   - 悄悄话私密信箱阅读、标记已读与发送
 *   - 私密空间独立 PIN 码软键盘核验与加密随笔
 *   - 授权设备安全状态核验
 *   - 拾光 · 画廊生活助手
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

let currentActiveTab = 'daily';
let viewerPhotoList = [];
let currentViewerIndex = 0;
let currentViewerSource = 'album';
let dailyPhotosList = [];
let albumPhotosList = [];
let secretPin = '';
let secretRequestVersion = 0;
let secretUnlocked = false;
let currentAlbumFolder = null;
let currentAlbumTag = '全部';
let currentLoadedPhotos = [];
let currentDraftText = '';
let currentActionMenuText = '';
let currentActionMenuDraft = null;
let currentOpenWhisperId = null;
let allWhispersList = [];
let currentWhisperIndex = 0;
let sessionNoticeShown = false;
let deviceListCache = [];
let agentChatHistory = [];

async function initApp() {
  initTabs();
  initUploadHandler();
  initSecretPad();
  initTasksView();
  
  // 初始化真实后端数据流
  await initSessionData();
  await initCheckin();
  await renderDailyPhotos();
  await renderAlbumView();
  await renderTasksList();
  await renderShopItems();
}

/* ==========================================================================
   1. 基础会话与情侣元数据初始化 (相伴天数、昵称、今日一句、纪念日)
   ========================================================================== */
async function initSessionData() {
  const session = await window.galleryApi.initSession();
  const cfg = session.config || {};

  // 1. 更新相伴天数与称谓
  const days = cfg.love_days || 520;
  const startDate = (cfg.startDate || '2025-04-30').replace(/-/g, '.');
  
  const heroDaysEl = document.getElementById('homeHeroDays');
  if (heroDaysEl) heroDaysEl.innerText = `在一起第 ${days} 天`;

  const usDaysEl = document.getElementById('usCoupleDays');
  if (usDaysEl) usDaysEl.innerText = `相伴第 ${days} 天 · 始于 ${startDate}`;

  let name1 = '小林';
  let name2 = '小鹿';
  if (Array.isArray(cfg.avatars) && cfg.avatars.length >= 2) {
    name1 = cfg.avatars[0].username || '小林';
    name2 = cfg.avatars[1].username || '小鹿';
  } else if (cfg.current_user) {
    name1 = cfg.current_user;
  }
  const namesEl = document.getElementById('usCoupleNames');
  if (namesEl) namesEl.innerText = `${name1} 与 ${name2}`;

  const boyAv = document.getElementById('usBoyAvatar');
  if (boyAv) boyAv.innerText = name1;
  const girlAv = document.getElementById('usGirlAvatar');
  if (girlAv) girlAv.innerText = name2;

  // 真实头像（来自 /api/app-config.php 的 avatars 字段）
  renderCoupleAvatars(cfg.avatars);

  // 会话失效时明确提示并给出登录入口，不把本地示例当成真实身份静默继续
  applySessionState(session.isLoggedIn);

  // 2. 今日一句 (优先调用后端 AI 或诗意词库)
  const quote = await window.galleryApi.getDailyQuote();
  const quoteEl = document.getElementById('dailyQuoteText');
  if (quoteEl && quote) quoteEl.innerText = `“${quote}”`;

  // 3. 纪念日提醒
  const reminders = await window.galleryApi.getAnniversaryReminders();
  renderReminders(reminders);

  // 4. 来信状态条
  await refreshLetterBanner();

  // 5. 积分余额
  await refreshBadges();
}

function renderReminders(reminders) {
  const container = document.getElementById('usRemindersList');
  if (!container || !reminders || reminders.length === 0) return;

  container.innerHTML = reminders.map((r, idx) => `
    <div style="padding:15px 16px; display:flex; justify-content:space-between; align-items:center; ${idx < reminders.length - 1 ? 'border-bottom:1px solid var(--color-divider);' : ''} font-size:14px;">
      <span style="font-weight:500;">${escapeHtml(r.name || '纪念日')}</span>
      <span style="color:var(--color-muted);">${escapeHtml(r.date || '')} (${r.days_until === 0 ? '就是今天！🎉' : `还有 ${r.days_until} 天`})</span>
    </div>
  `).join('');
}

async function refreshLetterBanner() {
  const bannerText = document.getElementById('homeLetterBannerText');
  if (!bannerText) return;

  const unreadRes = await window.galleryApi.checkUnreadWhispers();
  if (unreadRes && unreadRes.has_unread) {
    bannerText.innerText = `有一封给你的信 · ${unreadRes.count || 1} 封新来信`;
  } else {
    bannerText.innerText = '给对方写封信 · 随时倾诉心意';
  }
}

/* ==========================================================================
   2. 底部四栏标签页切换与导航
   ========================================================================== */
function initTabs() {
  const tabs = document.querySelectorAll('.bottom-tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName && tabName !== currentActiveTab) {
        switchTab(tabName);
      }
    });
  });
}

function switchTab(tabName) {
  currentActiveTab = tabName;
  document.querySelectorAll('.bottom-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.toggle('active', view.id === `tab-${tabName}`);
  });

  const scrollContainer = document.getElementById('mainScrollContainer');
  if (scrollContainer) {
    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (tabName === 'daily') {
    refreshLetterBanner();
  } else if (tabName === 'album') {
    renderAlbumView();
  } else if (tabName === 'wishes') {
    renderTasksList();
    renderShopItems();
    refreshBadges();
    if (typeof updateBackpackBadge === 'function') updateBackpackBadge();
    if (typeof startWishesPolling === 'function') startWishesPolling();
  } else {
    if (typeof stopWishesPolling === 'function') stopWishesPolling();
  }
}

function resetAppRootScroll() {
  const root = document.querySelector('.h5-app-root');
  if (root) {
    if (root.scrollTop !== 0) root.scrollTop = 0;
    if (root.scrollLeft !== 0) root.scrollLeft = 0;
  }
}

/* ==========================================================================
   3. 轻量 Toast 提示组件与应用内确认弹窗 (适配温润 UI 风格)
   ========================================================================== */
function showToast(message) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'h5-toast';
    document.querySelector('.h5-app-root').appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

let appConfirmResolve = null;

function showAppConfirm({
  title = '提示',
  message = '',
  confirmText = '确定',
  cancelText = '取消',
  isDanger = false,
  icon = ''
} = {}) {
  return new Promise((resolve) => {
    appConfirmResolve = resolve;
    const overlay = document.getElementById('appConfirmDialogOverlay');
    const titleEl = document.getElementById('appDialogTitle');
    const msgEl = document.getElementById('appDialogMessage');
    const iconEl = document.getElementById('appDialogIcon');
    const confirmBtn = document.getElementById('appDialogConfirmBtn');
    const cancelBtn = document.getElementById('appDialogCancelBtn');

    if (!overlay) {
      resolve(window.confirm(message ? `${title}\n${message}` : title));
      return;
    }

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (iconEl) iconEl.innerText = icon || (isDanger ? '⚠️' : '💌');

    if (confirmBtn) {
      confirmBtn.innerText = confirmText;
      if (isDanger) {
        confirmBtn.style.background = '#883e4a';
        confirmBtn.style.borderColor = '#883e4a';
        confirmBtn.style.color = '#fff';
      } else {
        confirmBtn.style.background = 'var(--color-primary)';
        confirmBtn.style.borderColor = 'var(--color-primary)';
        confirmBtn.style.color = '#fff';
      }
      confirmBtn.onclick = () => {
        closeAppConfirmDialog();
        resolve(true);
      };
    }

    if (cancelBtn) {
      cancelBtn.innerText = cancelText;
      cancelBtn.onclick = () => {
        closeAppConfirmDialog();
        resolve(false);
      };
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeAppConfirmDialog();
        resolve(false);
      }
    };

    overlay.classList.add('active');
    resetAppRootScroll();
  });
}

function closeAppConfirmDialog() {
  const overlay = document.getElementById('appConfirmDialogOverlay');
  if (overlay) overlay.classList.remove('active');
  resetAppRootScroll();
}

window.showAppConfirm = showAppConfirm;
window.closeAppConfirmDialog = closeAppConfirmDialog;

/* ==========================================================================
   4. 主页焦点卡片 (Hero Plaque) 逻辑与多图轮播管理
   ========================================================================== */
let heroPhotosList = [];
let currentHeroIndex = 0;
let heroCarouselTimer = null;
let heroTouchStartX = 0;
let pickerAvailablePhotos = [];
let pickerSelectedIds = new Set();

function updateHeroTitleAndDate(photo) {
  const titleEl = document.getElementById('homeHeroTitle');
  const dateEl = document.getElementById('homeHeroDate');
  if (!photo) return;
  if (titleEl) {
    titleEl.innerText = photo.title || photo.caption || '生活画廊精选瞬间';
  }
  if (dateEl) {
    const rawDate = photo.date || photo.created_at || '';
    if (rawDate) {
      const parts = rawDate.split(/[- :]/);
      if (parts.length >= 3) {
        dateEl.innerText = `${parts[1]}.${parts[2]}`;
      } else {
        dateEl.innerText = rawDate.slice(5, 10).replace('-', '.');
      }
    } else {
      dateEl.innerText = '画廊精选';
    }
  }
}

function gotoHeroSlide(idx) {
  if (!heroPhotosList || heroPhotosList.length <= 1) return;
  currentHeroIndex = (idx + heroPhotosList.length) % heroPhotosList.length;
  const slides = document.querySelectorAll('.hero-carousel-slide');
  const dots = document.querySelectorAll('.hero-dot');
  slides.forEach((s, i) => s.classList.toggle('active', i === currentHeroIndex));
  dots.forEach((d, i) => d.classList.toggle('active', i === currentHeroIndex));
  updateHeroTitleAndDate(heroPhotosList[currentHeroIndex]);
  startHeroCarouselTimer();
}

function nextHeroSlide() {
  if (!heroPhotosList || heroPhotosList.length <= 1) return;
  gotoHeroSlide(currentHeroIndex + 1);
}

function prevHeroSlide() {
  if (!heroPhotosList || heroPhotosList.length <= 1) return;
  gotoHeroSlide(currentHeroIndex - 1);
}

function startHeroCarouselTimer() {
  if (heroCarouselTimer) {
    clearInterval(heroCarouselTimer);
    heroCarouselTimer = null;
  }
  if (heroPhotosList && heroPhotosList.length > 1) {
    heroCarouselTimer = setInterval(() => {
      nextHeroSlide();
    }, 4500);
  }
}

function bindHeroSwipeListeners() {
  const frame = document.getElementById('homeHeroMediaFrame');
  if (!frame || frame._hasSwipeBound) return;
  frame._hasSwipeBound = true;
  frame.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
      heroTouchStartX = e.touches[0].clientX;
    }
  }, { passive: true });
  frame.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
      const diff = e.changedTouches[0].clientX - heroTouchStartX;
      if (Math.abs(diff) > 40) {
        if (diff < 0) nextHeroSlide();
        else prevHeroSlide();
      }
    }
  }, { passive: true });
}

function renderDailyHero(photos) {
  const mediaFrame = document.getElementById('homeHeroMediaFrame');
  const titleEl = document.getElementById('homeHeroTitle');
  const dateEl = document.getElementById('homeHeroDate');
  if (!mediaFrame) return;

  if (heroCarouselTimer) {
    clearInterval(heroCarouselTimer);
    heroCarouselTimer = null;
  }

  // 1. 优先读取多图轮播配置
  let carouselIds = [];
  try {
    const savedCarousel = localStorage.getItem('couple_h5_hero_carousel_ids');
    if (savedCarousel) {
      const parsed = JSON.parse(savedCarousel);
      if (Array.isArray(parsed)) carouselIds = parsed;
    }
  } catch (_) {}

  let matchedCarousel = [];
  if (carouselIds.length > 0 && Array.isArray(photos)) {
    matchedCarousel = carouselIds.map(id => photos.find(p => p.id === id)).filter(Boolean);
  }

  if (matchedCarousel.length > 1) {
    heroPhotosList = matchedCarousel;
  } else {
    // 2. 检查单张自定义封面
    const customHeroId = localStorage.getItem('couple_h5_hero_photo_id');
    let single = null;
    if (customHeroId && Array.isArray(photos)) {
      single = photos.find(p => p.id === customHeroId);
    }
    if (!single && matchedCarousel.length === 1) {
      single = matchedCarousel[0];
    }
    if (!single && Array.isArray(photos) && photos.length > 0) {
      // 3. 自动模式：优先取相册中真实上传的照片；若全为演示预设，再取第一张
      single = photos.find(p => p.url && !p.type) || photos[0];
    }
    heroPhotosList = single ? [single] : [];
  }

  if (currentHeroIndex >= heroPhotosList.length) {
    currentHeroIndex = 0;
  }

  if (heroPhotosList.length === 0) {
    // 相册空空，展示手绘默认插画
    mediaFrame.innerHTML = `
      <svg id="homeHeroDefaultSvg" viewBox="0 0 350 218" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="h5Sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3d405b"/>
            <stop offset="40%" stop-color="#883E4A"/>
            <stop offset="70%" stop-color="#e07a5f"/>
            <stop offset="100%" stop-color="#f4f1de"/>
          </linearGradient>
          <linearGradient id="h5Sea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#2a3d45"/>
            <stop offset="100%" stop-color="#19252b"/>
          </linearGradient>
        </defs>
        <rect width="350" height="150" fill="url(#h5Sky)"/>
        <circle cx="250" cy="110" r="28" fill="#ffd166" opacity="0.85"/>
        <rect y="150" width="350" height="68" fill="url(#h5Sea)"/>
        <path d="M0 152 Q90 148 180 153 T350 151" stroke="#e07a5f" stroke-width="2" opacity="0.4" fill="none"/>
        <path d="M0 168 Q80 165 170 170 T350 167" stroke="#ffd166" stroke-width="1.5" opacity="0.3" fill="none"/>
        <circle cx="95" cy="144" r="3.5" fill="#19252b"/>
        <path d="M92 148 h6 v12 h-6 z" fill="#19252b"/>
        <circle cx="106" cy="146" r="3.2" fill="#19252b"/>
        <path d="M103 150 h6 v10 h-6 z" fill="#19252b"/>
      </svg>
    `;
    if (titleEl) titleEl.innerText = '那天没有计划，只是一起走了很远。';
    if (dateEl) dateEl.innerText = '画廊精选';
  } else if (heroPhotosList.length === 1) {
    // 单张照片模式：纯净沉浸，无图标遮挡
    const selected = heroPhotosList[0];
    let mediaContent = '';
    if (selected.url && !selected.type) {
      const rawUrl = selected.url || selected.thumbUrl || selected.original_path || selected.filename;
      const resolvedUrl = window.galleryApi?.resolveAssetUrl ? window.galleryApi.resolveAssetUrl(rawUrl) : rawUrl;
      mediaContent = `<img src="${escapeForAttr(resolvedUrl)}" alt="${escapeForAttr(selected.title || '主页封面')}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
    } else if (selected.type && photoSvgPresets[selected.type]) {
      mediaContent = photoSvgPresets[selected.type];
    } else {
      mediaContent = photoSvgPresets['sunset'];
    }
    mediaFrame.innerHTML = mediaContent;
    updateHeroTitleAndDate(selected);
  } else {
    // 多图轮播模式：支持自动滑动与手势触控
    mediaFrame.innerHTML = `
      <div class="hero-carousel-container" id="heroCarouselContainer">
        ${heroPhotosList.map((p, idx) => {
          let content = '';
          if (p.url && !p.type) {
            const rawUrl = p.url || p.thumbUrl || p.original_path || p.filename;
            const resolvedUrl = window.galleryApi?.resolveAssetUrl ? window.galleryApi.resolveAssetUrl(rawUrl) : rawUrl;
            content = `<img src="${escapeForAttr(resolvedUrl)}" alt="${escapeForAttr(p.title || '')}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
          } else if (p.type && photoSvgPresets[p.type]) {
            content = photoSvgPresets[p.type];
          } else {
            content = photoSvgPresets['sunset'];
          }
          return `<div class="hero-carousel-slide ${idx === currentHeroIndex ? 'active' : ''}" data-index="${idx}">${content}</div>`;
        }).join('')}
      </div>
      <div class="hero-carousel-dots">
        ${heroPhotosList.map((_, idx) => `<span class="hero-dot ${idx === currentHeroIndex ? 'active' : ''}" data-hero-slide="${idx}"></span>`).join('')}
      </div>
    `;
    container.querySelectorAll('.hero-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const slideIdx = parseInt(dot.getAttribute('data-hero-slide'), 10);
        if (!isNaN(slideIdx)) gotoHeroSlide(slideIdx);
      });
    });
    updateHeroTitleAndDate(heroPhotosList[currentHeroIndex]);
    startHeroCarouselTimer();
    bindHeroSwipeListeners();
  }
}

function openHeroViewer() {
  if (!heroPhotosList || heroPhotosList.length === 0) {
    openHeroChangeMenu();
    return;
  }
  // 核心修复：打开真实相册大图，且精准以当前主页展示的照片为起点
  openImageViewer(heroPhotosList, currentHeroIndex, 'hero');
}

function openHeroChangeMenu() {
  closeImageViewer();
  const modal = document.getElementById('heroChangeSheetModal');
  if (modal) modal.classList.add('active');
  resetAppRootScroll();
}

function closeHeroChangeMenu() {
  const modal = document.getElementById('heroChangeSheetModal');
  if (modal) modal.classList.remove('active');
  resetAppRootScroll();
}

function triggerHeroPhotoUpload() {
  closeHeroChangeMenu();
  const input = document.getElementById('heroUploadInput');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handleHeroUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  showToast('正在上传并设为封面...');
  const res = await window.galleryApi.uploadPhoto({
    file,
    folderPath: '/',
    title: file.name.replace(/\.[^/.]+$/, ''),
    tags: '封面'
  });

  if (res && res.success && res.photo && res.photo.id) {
    localStorage.setItem('couple_h5_hero_photo_id', res.photo.id);
    localStorage.removeItem('couple_h5_hero_carousel_ids');
    showToast('已成功上传并设为主页封面 ✨');
    await renderDailyPhotos();
    await renderAlbumView();
  } else {
    showToast(res?.message || '上传失败');
  }
}

async function openHeroPhotoPicker() {
  closeHeroChangeMenu();
  const modal = document.getElementById('heroPickerModal');
  const grid = document.getElementById('heroPickerGrid');
  if (!modal || !grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--color-muted);">加载相册照片中...</div>';
  modal.classList.add('active');
  resetAppRootScroll();

  const photos = await window.galleryApi.getPhotos();
  if (!photos || photos.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--color-muted);">相册暂无照片，请先上传</div>';
    return;
  }

  pickerAvailablePhotos = photos;
  pickerSelectedIds.clear();

  // 读取已保存的轮播配置或单图封面
  try {
    const savedCarousel = localStorage.getItem('couple_h5_hero_carousel_ids');
    if (savedCarousel) {
      const ids = JSON.parse(savedCarousel);
      if (Array.isArray(ids)) ids.forEach(id => pickerSelectedIds.add(id));
    }
  } catch (_) {}

  if (pickerSelectedIds.size === 0) {
    const singleId = localStorage.getItem('couple_h5_hero_photo_id') || (heroPhotosList[0]?.id);
    if (singleId) pickerSelectedIds.add(singleId);
  }

  renderHeroPickerGrid();
}

function renderHeroPickerGrid() {
  const grid = document.getElementById('heroPickerGrid');
  if (!grid) return;

  grid.innerHTML = pickerAvailablePhotos.map((p, idx) => {
    const rawUrl = p.thumbUrl || p.url || p.filename;
    const resolvedUrl = window.galleryApi?.resolveAssetUrl ? window.galleryApi.resolveAssetUrl(rawUrl) : rawUrl;
    const isSelected = pickerSelectedIds.has(p.id);
    return `
      <div class="hero-picker-item ${isSelected ? 'selected' : ''}" onclick="toggleHeroPickerItem('${safeInlineArg(p.id)}')">
        <img src="${escapeForAttr(resolvedUrl)}" alt="${escapeForAttr(p.title || '')}">
        <div class="hero-picker-check">${isSelected ? '✓' : ''}</div>
        <div class="hero-picker-badge">${idx + 1}</div>
      </div>
    `;
  }).join('');

  updateHeroPickerConfirmBtn();
}

function toggleHeroPickerItem(photoId) {
  if (pickerSelectedIds.has(photoId)) {
    pickerSelectedIds.delete(photoId);
  } else {
    pickerSelectedIds.add(photoId);
  }
  renderHeroPickerGrid();
}

function updateHeroPickerConfirmBtn() {
  const btn = document.getElementById('heroPickerConfirmBtn');
  if (!btn) return;
  const count = pickerSelectedIds.size;
  if (count === 0) {
    btn.innerText = '请选择照片';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  } else if (count === 1) {
    btn.innerText = '设为单张封面';
    btn.disabled = false;
    btn.style.opacity = '1';
  } else {
    btn.innerText = `设为多图轮播 (已选 ${count} 张)`;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

async function confirmHeroPickerSelection() {
  const count = pickerSelectedIds.size;
  if (count === 0) {
    showToast('请至少勾选一张照片');
    return;
  }

  const ids = Array.from(pickerSelectedIds);
  if (count === 1) {
    localStorage.setItem('couple_h5_hero_photo_id', ids[0]);
    localStorage.removeItem('couple_h5_hero_carousel_ids');
    showToast('已更新主页封面 ✨');
  } else {
    localStorage.setItem('couple_h5_hero_carousel_ids', JSON.stringify(ids));
    localStorage.removeItem('couple_h5_hero_photo_id');
    showToast(`已开启主页 ${count} 张照片轮播 ✨`);
  }

  closeHeroPhotoPicker();
  await renderDailyPhotos();
}

function closeHeroPhotoPicker() {
  const modal = document.getElementById('heroPickerModal');
  if (modal) modal.classList.remove('active');
  resetAppRootScroll();
}

async function resetToAutoHero() {
  localStorage.removeItem('couple_h5_hero_photo_id');
  localStorage.removeItem('couple_h5_hero_carousel_ids');
  closeHeroChangeMenu();
  showToast('已恢复自动跟随相册最新照片');
  await renderDailyPhotos();
}

function setAsHeroPhoto() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  const photo = viewerPhotoList[currentViewerIndex];
  if (!photo || !photo.id) return;
  localStorage.setItem('couple_h5_hero_photo_id', photo.id);
  localStorage.removeItem('couple_h5_hero_carousel_ids');
  showToast('已设为首页封面 ✨');
  renderDailyPhotos();
}

window.openHeroViewer = openHeroViewer;
window.openHeroChangeMenu = openHeroChangeMenu;
window.closeHeroChangeMenu = closeHeroChangeMenu;
window.triggerHeroPhotoUpload = triggerHeroPhotoUpload;
window.handleHeroUpload = handleHeroUpload;
window.openHeroPhotoPicker = openHeroPhotoPicker;
window.closeHeroPhotoPicker = closeHeroPhotoPicker;
window.toggleHeroPickerItem = toggleHeroPickerItem;
window.confirmHeroPickerSelection = confirmHeroPickerSelection;
window.resetToAutoHero = resetToAutoHero;
window.setAsHeroPhoto = setAsHeroPhoto;
window.gotoHeroSlide = gotoHeroSlide;

window.openHeroViewer = openHeroViewer;
window.openHeroChangeMenu = openHeroChangeMenu;
window.closeHeroChangeMenu = closeHeroChangeMenu;
window.triggerHeroPhotoUpload = triggerHeroPhotoUpload;
window.handleHeroUpload = handleHeroUpload;
window.openHeroPhotoPicker = openHeroPhotoPicker;
window.closeHeroPhotoPicker = closeHeroPhotoPicker;
window.resetToAutoHero = resetToAutoHero;
window.setAsHeroPhoto = setAsHeroPhoto;

async function renderDailyPhotos() {
  const container = document.getElementById('dailyGridContainer');
  if (!container) return;

  const photos = await window.galleryApi.getPhotos();
  renderDailyHero(photos);

  if (!photos || photos.length === 0) {
    dailyPhotosList = [];
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding:32px 16px; text-align:center; color:var(--color-muted); font-size:14px;">
        暂无日常照片，点击右下角“＋”记录生活
      </div>
    `;
    return;
  }

  // 严格隔离首页日常流缓存数组，前4张
  dailyPhotosList = photos.slice(0, 4);
  container.innerHTML = dailyPhotosList.map((p, idx) => {
    let frameContent = '';
    if (p.url && !p.type) {
      frameContent = `<img src="${escapeForAttr(p.thumbUrl || p.url)}" alt="${escapeForAttr(p.title)}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
    } else {
      const typeKey = p.type || (idx % 2 === 0 ? 'coffee' : 'cat');
      frameContent = photoSvgPresets[typeKey] || photoSvgPresets['coffee'];
    }

    return `
      <div class="grid-item-card daily-photo-card" data-viewer-index="${idx}">
        <div class="gallery-photo-frame">
          ${frameContent}
        </div>
        <div class="grid-item-name">${escapeHtml(p.title || '画廊瞬间')}</div>
        <div class="grid-item-sub">${escapeHtml(p.date || '今日')} · ${escapeHtml(p.folder || '日常')}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.daily-photo-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.getAttribute('data-viewer-index'), 10);
      if (!isNaN(idx)) openPhotoViewerFromList(idx, 'daily');
    });
  });
}

async function renderAlbumView() {
  // 1. 面包屑多层级路径导航
  const breadcrumbsEl = document.getElementById('albumBreadcrumbs');
  if (breadcrumbsEl) {
    breadcrumbsEl.innerHTML = '';
    if (!currentAlbumFolder || currentAlbumFolder === '/' || currentAlbumFolder === '全部') {
      const allSpan = document.createElement('span');
      allSpan.style.cssText = 'font-weight:600; color:var(--color-ink);';
      allSpan.textContent = '全部照片';
      breadcrumbsEl.appendChild(allSpan);
    } else {
      const cleanCurrent = currentAlbumFolder.replace(/^\/+|\/+$/g, '');
      const parts = cleanCurrent.split('/');
      let acc = '';

      const rootSpan = document.createElement('span');
      rootSpan.style.cssText = 'cursor:pointer; color:var(--color-accent); font-weight:500;';
      rootSpan.textContent = '全部';
      rootSpan.addEventListener('click', () => selectAlbumFolder(null));
      breadcrumbsEl.appendChild(rootSpan);

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        acc = acc ? `${acc}/${part}` : part;
        const currentAcc = acc;
        const isLast = (i === parts.length - 1);

        const sepSpan = document.createElement('span');
        sepSpan.style.cssText = 'color:var(--color-muted); margin:0 4px;';
        sepSpan.textContent = '/';
        breadcrumbsEl.appendChild(sepSpan);

        const partSpan = document.createElement('span');
        if (isLast) {
          partSpan.style.cssText = 'font-weight:600; color:var(--color-ink);';
          partSpan.textContent = part;
        } else {
          partSpan.style.cssText = 'cursor:pointer; color:var(--color-accent); font-weight:500;';
          partSpan.textContent = part;
          partSpan.addEventListener('click', () => selectAlbumFolder(currentAcc));
        }
        breadcrumbsEl.appendChild(partSpan);
      }
    }
  }

  // 2. 文件夹横滑行 (支持多级目录与当前文件夹管理，纯DOM闭包绑定杜绝XSS注入)
  const foldersRow = document.getElementById('albumFoldersRow');
  if (foldersRow) {
    foldersRow.innerHTML = '';
    const tree = await window.galleryApi.getAlbumTree(currentAlbumFolder || '');
    const childFolders = tree?.folders || [];

    if (!currentAlbumFolder || currentAlbumFolder === '/' || currentAlbumFolder === '全部') {
      const allChip = document.createElement('div');
      allChip.className = 'album-folder-chip active';
      allChip.innerHTML = '<span>全部照片</span>';
      allChip.addEventListener('click', () => selectAlbumFolder(null));
      foldersRow.appendChild(allChip);
    } else {
      const cleanCurrent = currentAlbumFolder.replace(/^\/+|\/+$/g, '');
      const parentPath = cleanCurrent.includes('/') ? cleanCurrent.split('/').slice(0, -1).join('/') : null;

      const backChip = document.createElement('div');
      backChip.className = 'album-folder-chip';
      backChip.style.fontWeight = '600';
      backChip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg><span>返回上级</span>';
      backChip.addEventListener('click', () => selectAlbumFolder(parentPath));
      foldersRow.appendChild(backChip);

      const currentChip = document.createElement('div');
      currentChip.className = 'album-folder-chip active';
      currentChip.style.gap = '6px';

      const folderBaseName = cleanCurrent.split('/').pop();
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `当前: ${folderBaseName}`;
      currentChip.appendChild(nameSpan);

      const renameBtn = document.createElement('button');
      renameBtn.title = '重命名';
      renameBtn.style.cssText = 'border:none; background:transparent; color:inherit; padding:2px; cursor:pointer; display:inline-flex; align-items:center;';
      renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRenameFolderDialog(cleanCurrent);
      });
      currentChip.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.title = '删除';
      deleteBtn.style.cssText = 'border:none; background:transparent; color:#ff6b6b; padding:2px; cursor:pointer; display:inline-flex; align-items:center;';
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteCurrentFolder(cleanCurrent);
      });
      currentChip.appendChild(deleteBtn);

      foldersRow.appendChild(currentChip);
    }

    childFolders.forEach(f => {
      const chip = document.createElement('div');
      chip.className = 'album-folder-chip';
      
      const count = f.photo_count != null ? f.photo_count : (f.file_count != null ? f.file_count : 0);
      chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      
      const textSpan = document.createElement('span');
      textSpan.textContent = ` ${f.name} (${count})`;
      chip.appendChild(textSpan);

      chip.addEventListener('click', () => {
        selectAlbumFolder(f.path);
      });
      foldersRow.appendChild(chip);
    });

    const newBtn = document.createElement('div');
    newBtn.className = 'album-folder-chip';
    newBtn.style.cssText = 'color:var(--color-accent); border:1px dashed var(--color-accent); cursor:pointer;';
    newBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>新建文件夹</span>';
    newBtn.addEventListener('click', openCreateFolderDialog);
    foldersRow.appendChild(newBtn);
  }

  // 3. 标签分类
  const tagsRow = document.getElementById('albumTagFiltersRow');
  if (tagsRow) {
    tagsRow.innerHTML = '';
    const tags = ['全部', '风景', '日常', '美食', '抓拍'];
    tags.forEach(t => {
      const chip = document.createElement('span');
      chip.className = `album-tag-chip ${currentAlbumTag === t ? 'active' : ''}`;
      chip.textContent = t;
      chip.addEventListener('click', () => selectAlbumTag(t));
      tagsRow.appendChild(chip);
    });
  }

  // 4. 照片网格
  await renderAlbumGrid();
}

async function renderAlbumGrid() {
  const gridContainer = document.getElementById('albumGridContainer');
  if (!gridContainer) return;

  const photos = await window.galleryApi.getPhotos(currentAlbumFolder, currentAlbumTag);
  albumPhotosList = photos || [];
  currentLoadedPhotos = albumPhotosList;

  if (!photos || photos.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; padding:48px 20px; text-align:center; color:var(--color-muted); font-size:14px;">
        该分类下暂无照片，点击右上方“＋”上传
      </div>
    `;
    return;
  }

  gridContainer.innerHTML = photos.map((p, idx) => {
    let frameContent = '';
    if (p.url && !p.type) {
      frameContent = `<img src="${escapeForAttr(p.thumbUrl || p.url)}" alt="${escapeForAttr(p.title)}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
    } else {
      const typeKey = p.type || ['sunset', 'coffee', 'cat', 'plant', 'tower'][idx % 5];
      frameContent = photoSvgPresets[typeKey] || photoSvgPresets['sunset'];
    }

    return `
      <div class="grid-item-card album-photo-card" data-viewer-index="${idx}">
        <div class="gallery-photo-frame">
          ${frameContent}
        </div>
        <div class="grid-item-name">${escapeHtml(p.title || '画廊记录')}</div>
        <div class="grid-item-sub">${escapeHtml(p.date || '今日')}</div>
      </div>
    `;
  }).join('');

  gridContainer.querySelectorAll('.album-photo-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.getAttribute('data-viewer-index'), 10);
      if (!isNaN(idx)) openPhotoViewerFromList(idx, 'album');
    });
  });
}

function selectAlbumFolder(path) {
  currentAlbumFolder = path ? path.replace(/^\/+|\/+$/g, '') : null;
  const label = document.getElementById('albumCurrentFolderLabel');
  if (label) label.innerText = currentAlbumFolder || '全部照片';
  renderAlbumView();
}

function selectAlbumTag(tag) {
  currentAlbumTag = tag;
  renderAlbumView();
}

// 关键修复 B1: 根据传入 source 精确隔离数据源，防止相册筛选影响首页看图
function openPhotoViewerFromList(index, source) {
  const list = (source === 'daily') ? dailyPhotosList : albumPhotosList;
  if (list && list.length > 0 && index >= 0 && index < list.length) {
    openImageViewer(list, index, source);
  } else {
    console.warn(`openPhotoViewerFromList: 无法从数据源 [${source}] 获取索引 [${index}] 的照片`);
  }
}

/* ==========================================================================
   5. 全屏大图查看器 (支持左右切换、展签详情、照片移动与安全删除)
   ========================================================================== */
function openImageViewer(photos, startIndex = 0, source = 'album') {
  if (!photos || photos.length === 0) return;
  viewerPhotoList = photos.slice();
  currentViewerIndex = Math.max(0, Math.min(startIndex, viewerPhotoList.length - 1));
  currentViewerSource = source;
  const viewer = document.getElementById('fullscreenViewer');
  if (!viewer) return;

  renderViewerCurrent();
  viewer.classList.add('active');
}

function closeImageViewer() {
  const viewer = document.getElementById('fullscreenViewer');
  if (viewer) viewer.classList.remove('active');
}

function renderViewerCurrent() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  const item = viewerPhotoList[currentViewerIndex];
  const container = document.getElementById('viewerImgContainer');
  const captionEl = document.getElementById('viewerCaption');
  const metaEl = document.getElementById('viewerMeta');
  const countEl = document.getElementById('viewerCounter');

  if (countEl) countEl.innerText = `${currentViewerIndex + 1} / ${viewerPhotoList.length}`;
  if (captionEl) captionEl.innerText = item.title || item.caption || '画廊记录';
  const folderText = (item.folder && item.folder !== '全部') ? item.folder : '日常记录';
  const tagText = item.tag || (Array.isArray(item.tags) && item.tags[0]) || '';
  if (metaEl) metaEl.innerText = `${item.date || '今日'} · ${folderText}${tagText ? ' · ' + tagText : ''}`;

  // 根据来源区分封面按钮行为
  const coverBtn = document.getElementById('viewerSetCoverBtn');
  if (coverBtn) {
    if (currentViewerSource === 'hero') {
      coverBtn.textContent = '设置封面';
      coverBtn.onclick = openHeroChangeMenu;
    } else {
      coverBtn.textContent = '设为封面';
      coverBtn.onclick = setAsHeroPhoto;
    }
  }

  if (item.url && !item.type) {
    container.innerHTML = `<img src="${escapeForAttr(item.url)}" alt="${escapeForAttr(item.title)}" style="max-width:100%; max-height:100%; object-fit:contain; display:block;">`;
  } else if (item.type && photoSvgPresets[item.type]) {
    container.innerHTML = photoSvgPresets[item.type];
  } else {
    container.innerHTML = photoSvgPresets['sunset'];
  }
}

function nextViewerPhoto() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  if (currentViewerIndex < viewerPhotoList.length - 1) {
    currentViewerIndex++;
    renderViewerCurrent();
  } else {
    showToast('已经是最后一张照片了');
  }
}

function prevViewerPhoto() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  if (currentViewerIndex > 0) {
    currentViewerIndex--;
    renderViewerCurrent();
  } else {
    showToast('已经是第一张照片了');
  }
}

function handleViewerZoneClick(event) {
  // 点击左侧1/3返回上一张，点击右侧2/3查看下一张
  const rect = event.currentTarget.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  if (clickX < rect.width * 0.35) {
    prevViewerPhoto();
  } else {
    nextViewerPhoto();
  }
}

async function deleteCurrentViewerPhoto() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  const item = viewerPhotoList[currentViewerIndex];
  if (!item || !item.id) {
    showToast('当前照片无法删除');
    return;
  }
  const photoName = item.title || item.caption || '这张照片';
  const ok = await showAppConfirm({
    title: '删除照片',
    message: `确定要从相册中删除「${photoName}」吗？\n删除后不可恢复。`,
    confirmText: '确认删除',
    isDanger: true,
    icon: '🗑️'
  });
  if (!ok) return;

  showToast('正在删除照片...');
  const res = await window.galleryApi.deletePhoto(item.id);
  showToast(res && res.message ? res.message : '照片已删除');

  if (localStorage.getItem('couple_h5_hero_photo_id') === item.id) {
    localStorage.removeItem('couple_h5_hero_photo_id');
  }
  try {
    const savedCarousel = localStorage.getItem('couple_h5_hero_carousel_ids');
    if (savedCarousel) {
      let ids = JSON.parse(savedCarousel);
      if (Array.isArray(ids)) {
        ids = ids.filter(id => id !== item.id);
        if (ids.length > 0) {
          localStorage.setItem('couple_h5_hero_carousel_ids', JSON.stringify(ids));
        } else {
          localStorage.removeItem('couple_h5_hero_carousel_ids');
        }
      }
    }
  } catch (_) {}

  // 从当前查看器列表中移除
  viewerPhotoList.splice(currentViewerIndex, 1);

  // 同步更新独立的数据源缓存
  dailyPhotosList = dailyPhotosList.filter(p => p.id !== item.id);
  albumPhotosList = albumPhotosList.filter(p => p.id !== item.id);
  currentLoadedPhotos = albumPhotosList;

  // 刷新背景视图
  await renderAlbumView();
  await renderDailyPhotos();

  if (viewerPhotoList.length === 0) {
    closeImageViewer();
    showToast('相册中已无更多照片');
  } else {
    if (currentViewerIndex >= viewerPhotoList.length) {
      currentViewerIndex = viewerPhotoList.length - 1;
    }
    renderViewerCurrent();
  }
}

/* --- 照片移动到指定目录 (补齐 10.2) --- */
let pendingMovingPhoto = null;

async function openMovePhotoDialog() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  const item = viewerPhotoList[currentViewerIndex];
  if (!item) return;

  pendingMovingPhoto = item;

  // 依用户需求：点击移动照片后，立即关闭当前全屏大图查看器
  closeImageViewer();

  const select = document.getElementById('movePhotoTargetSelect');
  if (select) {
    try {
      const folders = await window.galleryApi.getFolders();
      let optionsHtml = '<option value="/">全部照片 (根目录)</option>';
      if (Array.isArray(folders)) {
        optionsHtml += folders.map(f => {
          const rawPath = f.path.startsWith('/') ? f.path : ('/' + f.path);
          const displayName = f.name || f.path.replace(/^\/+/, '');
          return `<option value="${escapeForAttr(rawPath)}">${escapeHtml(displayName)}</option>`;
        }).join('');
      }
      select.innerHTML = optionsHtml;
      const currentFolderNorm = (item.folder && item.folder !== '全部') ? ('/' + item.folder.replace(/^\/+/, '')) : '/';
      select.value = currentFolderNorm;
    } catch (err) {
      console.warn('拉取移动目标目录失败:', err);
    }
  }

  const overlay = document.getElementById('movePhotoModalOverlay');
  if (overlay) overlay.classList.add('active');
  resetAppRootScroll();
}

function closeMovePhotoDialog() {
  const overlay = document.getElementById('movePhotoModalOverlay');
  if (overlay) overlay.classList.remove('active');
  pendingMovingPhoto = null;
  resetAppRootScroll();
}

async function confirmMovePhoto() {
  const item = pendingMovingPhoto || (viewerPhotoList && viewerPhotoList[currentViewerIndex]);
  if (!item || !item.id) {
    showToast('无法移动该照片');
    return;
  }

  const select = document.getElementById('movePhotoTargetSelect');
  const targetPath = select ? select.value : '/';

  showToast('正在移动照片...');
  const res = await window.galleryApi.movePhoto(item.id, targetPath);
  if (res && res.success) {
    showToast(res.message || '照片移动成功');
    const newFolderStr = targetPath === '/' ? '全部' : targetPath.replace(/^\/+|\/+$/g, '');
    item.folder = newFolderStr;
    closeMovePhotoDialog();
    pendingMovingPhoto = null;

    await renderAlbumView();
    await renderDailyPhotos();
  } else {
    showToast(res?.message || '移动照片失败');
  }
}

/* --- 文件夹新建、重命名与删除管理 (补齐 10.2) --- */
function openCreateFolderDialog() {
  closeRecordSheet();
  const overlay = document.getElementById('createFolderModalOverlay');
  const input = document.getElementById('newFolderNameInput');
  if (input) {
    input.value = '';
    const parentHint = currentAlbumFolder ? `新建在「${currentAlbumFolder}」下` : '例如：周末露营、美食打卡...';
    input.placeholder = parentHint;
  }
  if (overlay) overlay.classList.add('active');
  resetAppRootScroll();
  setTimeout(() => {
    input?.focus({ preventScroll: true });
    resetAppRootScroll();
  }, 150);
}

function closeCreateFolderDialog() {
  const overlay = document.getElementById('createFolderModalOverlay');
  if (overlay) overlay.classList.remove('active');
  resetAppRootScroll();
}

async function confirmCreateFolder() {
  const input = document.getElementById('newFolderNameInput');
  const name = (input?.value || '').trim();
  if (!name) {
    showToast('请输入文件夹名称');
    input?.focus({ preventScroll: true });
    return;
  }

  showToast('正在创建相册文件夹...');
  const parentPath = currentAlbumFolder ? ('/' + currentAlbumFolder) : '/';
  const res = await window.galleryApi.createFolder(name, parentPath);
  if (res && res.success) {
    showToast(`文件夹「${name}」创建成功！`);
    closeCreateFolderDialog();
    const newPath = currentAlbumFolder ? `${currentAlbumFolder}/${name}` : name;
    currentAlbumFolder = newPath;
    await renderAlbumView();
  } else {
    showToast(res?.message || '创建文件夹失败');
  }
}

let renamingFolderPath = '';
function openRenameFolderDialog(folderPath) {
  renamingFolderPath = folderPath || currentAlbumFolder || '';
  if (!renamingFolderPath) {
    showToast('未选择文件夹');
    return;
  }
  const overlay = document.getElementById('renameFolderModalOverlay');
  const input = document.getElementById('renameFolderNameInput');
  const baseName = renamingFolderPath.split('/').pop();
  if (input) input.value = baseName;
  if (overlay) overlay.classList.add('active');
  resetAppRootScroll();
  setTimeout(() => {
    input?.focus({ preventScroll: true });
    resetAppRootScroll();
  }, 150);
}

function closeRenameFolderDialog() {
  const overlay = document.getElementById('renameFolderModalOverlay');
  if (overlay) overlay.classList.remove('active');
  resetAppRootScroll();
}

async function confirmRenameFolder() {
  const input = document.getElementById('renameFolderNameInput');
  const newName = (input?.value || '').trim();
  if (!newName) {
    showToast('请输入新名称');
    input?.focus({ preventScroll: true });
    return;
  }

  showToast('正在重命名文件夹...');
  const res = await window.galleryApi.renameFolder(renamingFolderPath, newName);
  if (res && res.success) {
    showToast('文件夹重命名成功');
    closeRenameFolderDialog();
    if (res.newPath) {
      currentAlbumFolder = res.newPath.replace(/^\/+/, '');
    } else {
      const parts = renamingFolderPath.split('/');
      parts[parts.length - 1] = newName;
      currentAlbumFolder = parts.join('/');
    }
    await renderAlbumView();
  } else {
    showToast(res?.message || '重命名失败');
  }
}

async function confirmDeleteCurrentFolder(folderPath) {
  const target = folderPath || currentAlbumFolder;
  if (!target) return;
  const baseName = target.split('/').pop();
  const ok = await showAppConfirm({
    title: '删除文件夹',
    message: `确定要删除文件夹「${baseName}」吗？\n文件夹内的照片将保留并移至全部照片。`,
    confirmText: '确认删除',
    isDanger: true,
    icon: '📁'
  });
  if (!ok) return;

  showToast('正在删除文件夹...');
  const res = await window.galleryApi.deleteFolder(target);
  if (res && res.success) {
    showToast('文件夹已成功删除');
    const parentPath = target.includes('/') ? target.split('/').slice(0, -1).join('/') : null;
    currentAlbumFolder = parentPath;
    await renderAlbumView();
  } else {
    showToast(res?.message || '删除文件夹失败');
  }
}

function openSinglePhotoViewer(title, dateMeta, typeOrUrl) {
  const isUrl = typeof typeOrUrl === 'string' && (typeOrUrl.includes('/') || /\.(jpg|jpeg|png|webp|gif)/i.test(typeOrUrl));
  openImageViewer([{
    title: title || '画廊瞬间',
    date: dateMeta || '',
    url: isUrl ? (window.galleryApi?.resolveAssetUrl?.(typeOrUrl) || typeOrUrl) : '',
    type: isUrl ? null : typeOrUrl,
    folder: '我们之间 · 生活画廊'
  }], 0);
}

// 矢量照片预设库（确保完全离线可用）
const photoSvgPresets = {
  sunset: `<svg viewBox="0 0 350 220" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skyL" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#3d405b"/><stop offset="50%" stop-color="#883E4A"/><stop offset="100%" stop-color="#f4f1de"/>
      </linearGradient>
    </defs>
    <rect width="350" height="220" fill="url(#skyL)"/>
    <circle cx="230" cy="110" r="30" fill="#ffd166" opacity="0.9"/>
    <rect y="160" width="350" height="60" fill="#19252b"/>
  </svg>`,
  coffee: `<svg viewBox="0 0 300 300" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect width="300" height="300" fill="#e7dfd5"/>
    <circle cx="150" cy="140" r="60" fill="#6f4e37"/>
    <rect x="60" y="230" width="180" height="30" rx="4" fill="#d8cbba"/>
  </svg>`,
  cat: `<svg viewBox="0 0 300 300" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect width="300" height="300" fill="#e2dbcf"/>
    <circle cx="150" cy="160" r="50" fill="#c49a6c"/>
  </svg>`,
  plant: `<svg viewBox="0 0 300 300" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect width="300" height="300" fill="#a3b18a"/>
    <path d="M150 280 Q100 150 40 120 Q120 180 150 280" fill="#344e41"/>
  </svg>`,
  tower: `<svg viewBox="0 0 300 300" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect width="300" height="300" fill="#8da9c4"/>
    <polygon points="130,280 170,280 160,100 140,100" fill="#eef4f8"/>
  </svg>`
};

/* ==========================================================================
   6. 真实照片上传流程 (后端 Multipart 与相册同步，支持追加、逐项状态、部分重试与标签)
   ========================================================================== */
let pendingUploadFiles = [];
let isUploading = false;

function initUploadHandler() {
  const fileInput = document.getElementById('h5RealFileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    // 关键需求 B2: 支持多选追加文件，而不是清空覆盖原有队列
    const newItems = files.map((file, idx) => ({
      id: `f_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      url: URL.createObjectURL(file),
      status: 'waiting', // 'waiting' | 'uploading' | 'success' | 'error'
      errorMsg: ''
    }));

    pendingUploadFiles = pendingUploadFiles.concat(newItems);

    // 重置 input.value，确保再次选择同一批文件时仍可触发 change 事件
    fileInput.value = '';

    renderUploadQueue();
    openUploadPage();
  });
}

function removePendingUploadItem(id) {
  const idx = pendingUploadFiles.findIndex(item => item.id === id);
  if (idx !== -1) {
    const [removed] = pendingUploadFiles.splice(idx, 1);
    if (removed && removed.url && removed.url.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
    }
    renderUploadQueue();
  }
}

function cleanupUploadBlobUrls(onlySuccess = false) {
  for (const item of pendingUploadFiles) {
    if ((!onlySuccess || item.status === 'success') && item.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  }
}

async function populateUploadFolders() {
  const select = document.getElementById('uploadFolderSelect');
  if (!select) return;

  try {
    const folders = await window.galleryApi.getFolders();
    let optionsHtml = '<option value="/">全部照片 (根目录)</option>';
    if (Array.isArray(folders)) {
      optionsHtml += folders.map(f => {
        const rawPath = f.path.startsWith('/') ? f.path : ('/' + f.path);
        // 展示规范化完整路径（如 /旅行/2026/云南），避免深层同名目录只显示末级名而无法区分
        const normalizedPath = rawPath.replace(/\/+$/, '') || '/';
        const displayName = normalizedPath === '/' ? '全部照片 (根目录)' : normalizedPath;
        return `<option value="${escapeForAttr(normalizedPath)}">${escapeHtml(displayName)}</option>`;
      }).join('');
    }
    select.innerHTML = optionsHtml;
    if (currentAlbumFolder) {
      const currentNorm = currentAlbumFolder.startsWith('/') ? currentAlbumFolder : ('/' + currentAlbumFolder);
      select.value = currentNorm;
    } else {
      select.value = '/';
    }
  } catch (err) {
    console.warn('拉取上传目录失败:', err);
  }
}

function openUploadPage() {
  closeRecordSheet();
  populateUploadFolders();
  document.getElementById('uploadFullscreenPage').classList.add('active');
  renderUploadQueue();
}

function closeUploadPage() {
  document.getElementById('uploadFullscreenPage').classList.remove('active');
}

function renderUploadQueue() {
  const container = document.getElementById('uploadQueueList');
  if (!container) return;

  if (pendingUploadFiles.length === 0) {
    container.innerHTML = `
      <div style="padding:24px; text-align:center; color:var(--color-muted); font-size:14px;">
        点击上方“＋继续添加”选择照片
      </div>
    `;
    const retryBtn = document.getElementById('retryFailedUploadBtn');
    if (retryBtn) retryBtn.style.display = 'none';
    return;
  }

  container.innerHTML = pendingUploadFiles.map(item => {
    let statusBadge = '';
    let removeBtnHtml = '';

    if (item.status === 'waiting') {
      statusBadge = `<span style="color:var(--color-muted);">⏳ 等待上传 (${item.size})</span>`;
      removeBtnHtml = `<button onclick="removePendingUploadItem('${safeInlineArg(item.id)}')" title="移除" style="border:none; background:transparent; color:var(--color-muted); padding:4px 8px; font-size:16px; cursor:pointer;">✕</button>`;
    } else if (item.status === 'uploading') {
      statusBadge = `<span style="color:var(--color-accent); font-weight:500;">🔄 传输中... (${item.size})</span>`;
    } else if (item.status === 'success') {
      statusBadge = `<span style="color:var(--color-success, #2a9d8f); font-weight:500;">✓ 上传完成 (${item.size})</span>`;
    } else if (item.status === 'error') {
      statusBadge = `<span style="color:var(--color-danger, #e76f51); font-weight:500;">✕ 上传失败${item.errorMsg ? ': ' + escapeHtml(item.errorMsg) : ''} (${item.size})</span>`;
      removeBtnHtml = `<button onclick="removePendingUploadItem('${safeInlineArg(item.id)}')" title="移除" style="border:none; background:transparent; color:#ff6b6b; padding:4px 8px; font-size:16px; cursor:pointer;">✕</button>`;
    }

    return `
      <div style="background:var(--color-surface); border:1px solid var(--color-divider); border-radius:8px; padding:10px 12px; margin-bottom:8px; display:flex; align-items:center; gap:12px;">
        <img src="${item.url}" style="width:48px; height:48px; border-radius:6px; object-fit:cover; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.name)}</div>
          <div style="font-size:12px; margin-top:3px;">
            ${statusBadge}
          </div>
        </div>
        ${removeBtnHtml}
      </div>
    `;
  }).join('');

  // 检查是否有失败项，决定是否显示重试按钮
  const hasError = pendingUploadFiles.some(item => item.status === 'error');
  const retryBtn = document.getElementById('retryFailedUploadBtn');
  if (retryBtn) {
    retryBtn.style.display = hasError ? 'block' : 'none';
  }
}

async function startUploadProcess(onlyFailed = false) {
  if (isUploading) return;

  if (pendingUploadFiles.length === 0) {
    showToast('请先选择需要上传的照片');
    return;
  }

  const toUpload = pendingUploadFiles.filter(item => onlyFailed ? item.status === 'error' : item.status !== 'success');
  if (toUpload.length === 0) {
    showToast('所有照片均已上传完成');
    return;
  }

  isUploading = true;
  const startBtn = document.getElementById('startUploadBtn');
  const navSubmitBtn = document.getElementById('uploadSubmitNavBtn');
  const retryBtn = document.getElementById('retryFailedUploadBtn');

  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = '正在上传中...';
  }
  if (navSubmitBtn) navSubmitBtn.disabled = true;
  if (retryBtn) retryBtn.disabled = true;

  showToast('正在传输照片队列...');
  const title = (document.getElementById('uploadPhotoTitle')?.value || '').trim();
  const tagsInput = (document.getElementById('uploadPhotoTags')?.value || '日常').trim();
  const folderSelect = document.getElementById('uploadFolderSelect');
  const targetFolder = folderSelect ? folderSelect.value : (currentAlbumFolder ? ('/' + currentAlbumFolder) : '/');

  for (let item of toUpload) {
    item.status = 'uploading';
    renderUploadQueue();

    try {
      const res = await window.galleryApi.uploadPhoto({
        file: item.file,
        folderPath: targetFolder,
        title: title || item.name,
        tags: tagsInput || '日常'
      });
      if (res && res.success) {
        item.status = 'success';
        item.errorMsg = '';
      } else {
        item.status = 'error';
        item.errorMsg = res?.message || '服务器返回异常';
      }
    } catch (err) {
      item.status = 'error';
      item.errorMsg = err?.message || '网络连接异常';
    }
    renderUploadQueue();
  }

  const failedItems = pendingUploadFiles.filter(item => item.status === 'error');
  const successItems = pendingUploadFiles.filter(item => item.status === 'success');

  isUploading = false;
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.innerText = '确认并开始上传';
  }
  if (navSubmitBtn) navSubmitBtn.disabled = false;
  if (retryBtn) retryBtn.disabled = false;

  if (failedItems.length === 0) {
    showToast(`全部 ${successItems.length} 张照片上传成功！`);
    // 全部成功、队列即将清空关闭，此时统一释放全部 blob URL
    cleanupUploadBlobUrls();
    setTimeout(() => {
      pendingUploadFiles = [];
      closeUploadPage();
      renderAlbumView();
      renderDailyPhotos();
    }, 1200);
  } else {
    showToast(`成功 ${successItems.length} 张，失败 ${failedItems.length} 张，请检查后重试失败项`);
    // 部分失败时队列保持不变：成功项与待重试项都还需要显示合法预览，
    // 因此这里绝不撤销 blob URL（撤销会让仍在队列中的成功项立刻变成坏图）。
    // 每一项的 blob URL 只在其被单独移除（removePendingUploadItem）或队列彻底清空时才释放。
    // 刷新背景相册，让已成功的图片即刻呈现
    await renderAlbumView();
    await renderDailyPhotos();
  }
}

function retryFailedUploads() {
  startUploadProcess(true);
}

/* ==========================================================================
   7. 每日打卡与任务系统 (拉取、标记完成、对方确认)
   ========================================================================== */
async function initCheckin() {
  const btn = document.getElementById('h5CheckinBtn');
  const streakTitle = document.getElementById('checkinStreakTitle');
  const streakSub = document.getElementById('checkinStreakSub');
  if (!btn) return;

  const status = await window.galleryApi.getCheckinStatus();
  if (status.checked_in) {
    btn.innerText = '今日已打卡';
    btn.disabled = true;
    btn.style.background = 'var(--color-surface-subtle)';
    btn.style.color = 'var(--color-muted)';
    if (streakTitle) streakTitle.innerText = `连续打卡第 ${status.streak} 天 · 今日已完成`;
    if (streakSub) streakSub.innerText = '保持生活默契，明日继续';
  } else {
    btn.innerText = '打卡签到';
    btn.disabled = false;
    btn.style.background = 'var(--color-accent)';
    btn.style.color = 'var(--color-on-accent)';
    if (streakTitle) streakTitle.innerText = `连续打卡第 ${status.streak} 天 · 奖励 +10 积分`;
    if (streakSub) streakSub.innerText = '今日尚未打卡，完成后将计入心愿小铺';
  }

  btn.onclick = async () => {
    btn.disabled = true;
    const res = await window.galleryApi.doCheckin();
    if (res.success) {
      btn.innerText = '今日已打卡';
      btn.style.background = 'var(--color-surface-subtle)';
      btn.style.color = 'var(--color-muted)';
      if (streakTitle) streakTitle.innerText = `连续打卡第 ${res.streak} 天 · 今日已完成`;
      if (streakSub) streakSub.innerText = '保持生活默契，明日继续';
      showToast(res.message || '打卡成功！+10 积分');
      await refreshBadges();
    } else {
      btn.disabled = false;
      showToast(res.message || '打卡失败');
    }
  };
}

/* ==========================================================================
   7. 每日任务清单与双人确认流转 (规范 10.3 彻底杜绝退化)
   ========================================================================== */
let taskFilter = 'pending';
let wishesPollTimer = null;
let wishesPollCount = 0;
const MAX_WISHES_POLL = 40; // 40 * 15s = 10分钟有界定时同步

function initTasksView() {
  document.querySelectorAll('.task-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      taskFilter = btn.dataset.status || 'pending';
      renderTasksList();
    });
  });

  // 绑定页面可见性变化刷新
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentActiveTab === 'wishes') {
      renderTasksList(true);
      updateBackpackBadge();
      startWishesPolling();
    } else {
      stopWishesPolling();
    }
  });
}

function startWishesPolling() {
  stopWishesPolling();
  wishesPollCount = 0;
  wishesPollTimer = setInterval(async () => {
    if (currentActiveTab !== 'wishes' || document.hidden) return;
    wishesPollCount++;
    if (wishesPollCount > MAX_WISHES_POLL) {
      stopWishesPolling();
      return;
    }
    await renderTasksList(true);
    await updateBackpackBadge();
  }, 15000);
}

function stopWishesPolling() {
  if (wishesPollTimer) {
    clearInterval(wishesPollTimer);
    wishesPollTimer = null;
  }
}

async function renderTasksList(silent = false) {
  const container = document.getElementById('h5TasksList');
  if (!container) return;

  const tasks = await window.galleryApi.getTasks();
  const filtered = tasks.filter(t => {
    if (taskFilter === 'pending') {
      return t.status === 'pending';
    }
    if (taskFilter === 'confirming') {
      return t.status === 'my_completed' || t.status === 'pending_partner' || t.status === 'confirming';
    }
    if (taskFilter === 'done') {
      return t.status === 'done';
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding:48px 24px; text-align:center; color:var(--color-muted);">
        <p style="font-size:15px; font-weight:500;">暂无相关任务</p>
        <p style="font-size:13px; margin-top:4px;">生活分工清晰，彼此安心</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(t => {
    let actionBtnHtml = '';
    let statusBadgeHtml = '';

    if (t.status === 'pending') {
      statusBadgeHtml = `<span style="font-size:12px; padding:2px 8px; border-radius:4px; background:var(--color-bg-subtle, #f5f3ef); color:var(--color-muted); font-weight:500;">待完成</span>`;
      actionBtnHtml = `<button class="h5-btn-primary" style="height:34px; padding:0 14px; font-size:13px; width:auto;" onclick="handleTaskAction('${safeInlineArg(t.id)}', 'complete')">标记我已完成</button>`;
    } else if (t.status === 'my_completed') {
      // 这是我提交的任务，当前正在等待对方确认，界面显示“等待对方确认”，坚决禁止显示“确认完成”按钮！
      statusBadgeHtml = `<span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#fff7ed; color:#c2410c; font-weight:500;">等待对方确认</span>`;
      actionBtnHtml = `
        <span style="font-size:13px; color:#ea580c; font-weight:500; display:inline-flex; align-items:center; gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          等待对方确认
        </span>
      `;
    } else if (t.status === 'pending_partner') {
      // 这是对方提交的任务，需要由我确认，界面显示“确认完成 (+奖励)”按钮，点击调用 confirmTask
      statusBadgeHtml = `<span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#fef3c7; color:#b45309; font-weight:500;">对方已完成</span>`;
      actionBtnHtml = `<button class="h5-btn-primary" style="height:34px; padding:0 14px; font-size:13px; width:auto; background:#d97706; border-color:#d97706;" onclick="handleTaskAction('${safeInlineArg(t.id)}', 'confirm')">确认完成 (+${t.reward})</button>`;
    } else if (t.status === 'done') {
      statusBadgeHtml = `<span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#ecfdf5; color:#047857; font-weight:500;">已完成</span>`;
      actionBtnHtml = `<span style="color:var(--color-success); font-weight:600; font-size:13px;">✓ 已发放约定奖励</span>`;
    } else {
      statusBadgeHtml = `<span style="font-size:12px; padding:2px 8px; border-radius:4px; background:var(--color-bg-subtle, #f5f3ef); color:var(--color-muted);">${escapeHtml(t.status)}</span>`;
    }

    return `
      <div class="h5-task-item">
        <div class="task-header-row" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="task-heading" style="font-weight:600; font-size:15px; color:var(--color-ink);">${escapeHtml(t.title)}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${statusBadgeHtml}
            <div class="task-badge-reward">+${t.reward} 积分</div>
          </div>
        </div>
        <div class="task-detail" style="margin-top:6px; font-size:13px; color:var(--color-muted); line-height:1.5;">${escapeHtml(t.desc)}</div>
        <div class="task-action-row" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:var(--color-muted);">负责：${escapeHtml(t.executor || '我')} → 确认：${escapeHtml(t.verifier || '对方')}</span>
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

async function handleTaskAction(taskId, action) {
  let res;
  if (action === 'complete') {
    res = await window.galleryApi.completeTask(taskId);
    if (res.success) {
      showToast('已提交完成，等待对方确认');
    }
  } else if (action === 'confirm') {
    res = await window.galleryApi.confirmTask(taskId);
    if (res.success) {
      const reward = res.reward || res.pointsAdded || 15;
      showToast(`已确认完成！+${reward} 积分已发放`);
    }
  }

  if (res && res.success) {
    await renderTasksList();
    await refreshBadges();
  } else {
    showToast(res?.message || '操作失败');
  }
}

/* ==========================================================================
   8. 心愿小铺、分类过滤、兑换二次确认与我的背包闭环 (规范 10.4)
   ========================================================================== */
let currentShopCategory = 'all';

function filterShopCategory(category) {
  currentShopCategory = category || 'all';
  document.querySelectorAll('.shop-cat-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.category || 'all') === currentShopCategory);
  });
  renderShopItems();
}
window.filterShopCategory = filterShopCategory;

function initShopView() {
  document.querySelectorAll('.shop-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterShopCategory(btn.dataset.category || 'all');
    });
  });

  renderShopItems();
  updateBackpackBadge();
}

// 页内心愿分段切换 (任务清单 vs 积分小铺)
function switchWishSegment(targetId) {
  document.querySelectorAll('.wish-seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.target === targetId);
  });
  const tasksSec = document.getElementById('wishTasksSection');
  const shopSec = document.getElementById('wishShopSection');
  if (tasksSec && shopSec) {
    tasksSec.style.display = targetId === 'wishTasksSection' ? 'block' : 'none';
    shopSec.style.display = targetId === 'wishShopSection' ? 'block' : 'none';
  }
  if (targetId === 'wishShopSection') {
    renderShopItems();
    updateBackpackBadge();
  } else if (targetId === 'wishTasksSection') {
    renderTasksList();
  }
}

let currentShopItemsList = [];

function openExchangeConfirmModalById(itemId) {
  const item = (currentShopItemsList || []).find(p => String(p.id) === String(itemId));
  if (!item) return;
  openExchangeConfirmModal(item.id, item.name, item.cost, item.desc || '', item.category);
}

async function renderShopItems() {
  const container = document.getElementById('h5ShopGrid');
  if (!container) return;

  const items = await window.galleryApi.getShopProducts(currentShopCategory);
  currentShopItemsList = items || [];
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding:48px 24px; text-align:center; color:var(--color-muted);">
        <p style="font-size:15px; font-weight:500;">暂无该分类商品</p>
        <p style="font-size:13px; margin-top:4px;">换个分类看看吧～</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const isCoupon = item.category === 'virtual' || (item.name && item.name.includes('券'));
    const tagText = isCoupon ? '特权券' : '实体礼物';
    const tagBg = isCoupon ? '#fff1f2' : '#f0fdf4';
    const tagColor = isCoupon ? 'var(--color-accent)' : '#166534';
    const resolvedImg = item.image && window.galleryApi?.resolveAssetUrl
      ? window.galleryApi.resolveAssetUrl(item.image)
      : (item.image || '');
    const imgHtml = resolvedImg 
      ? `<img src="${resolvedImg}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" loading="lazy" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';">
         <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; font-size:32px;">${isCoupon ? '🎟️' : '🎁'}</div>`
      : `<div style="display:flex; width:100%; height:100%; align-items:center; justify-content:center; font-size:32px;">${isCoupon ? '🎟️' : '🎁'}</div>`;

    return `
      <div class="grid-item-card" onclick="openExchangeConfirmModalById('${safeInlineArg(item.id)}')" style="cursor:pointer;">
        <div class="gallery-photo-frame" style="aspect-ratio:1; display:flex; align-items:center; justify-content:center; background:#f4ece1; border-radius:6px; overflow:hidden; position:relative;">
          ${imgHtml}
          <span style="position:absolute; top:6px; right:6px; font-size:11px; padding:2px 6px; border-radius:4px; background:${tagBg}; color:${tagColor}; font-weight:600;">${tagText}</span>
        </div>
        <div class="grid-item-name" style="margin-top:8px; font-size:14px; font-weight:600; color:var(--color-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.name)}</div>
        <div style="font-size:12px; color:var(--color-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${escapeHtml(item.desc || '')}</div>
        <div class="grid-item-sub" style="margin-top:6px; color:var(--color-accent); font-weight:700; font-size:15px; font-family:var(--font-serif);">${item.cost} <span style="font-size:12px; font-weight:normal;">积分</span></div>
      </div>
    `;
  }).join('');
}

// 兑换二次确认弹层 (规范 10.4: 显示兑换商品名、所需积分、当前余额、扣减计算)
let pendingExchangeItem = null;

async function openExchangeConfirmModal(itemId, itemName, itemCost, itemDesc, itemCategory) {
  pendingExchangeItem = { id: itemId, name: itemName, cost: itemCost, desc: itemDesc, category: itemCategory };
  const currentPoints = await window.galleryApi.getPoints();
  const remaining = currentPoints - itemCost;
  const isAffordable = remaining >= 0;

  let modal = document.getElementById('exchangeConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exchangeConfirmModal';
    modal.className = 'h5-overlay';
    modal.setAttribute('onclick', "closeSheetOnBg(event, 'exchangeConfirmModal')");
    document.querySelector('.h5-app-root').appendChild(modal);
  }

  modal.innerHTML = `
    <div class="h5-bottom-sheet">
      <div class="sheet-pill-bar"></div>
      <div class="sheet-title-row">
        <span class="sheet-title">确认兑换心愿</span>
        <button class="sheet-close-btn" onclick="closeExchangeConfirmModal()">✕</button>
      </div>
      <div style="padding:10px 0 24px;">
        <div style="padding:16px; background:var(--color-bg-subtle, #fdfbf7); border:1px solid var(--color-divider); border-radius:12px; margin-bottom:16px;">
          <div style="font-size:17px; font-weight:600; color:var(--color-ink);">${escapeHtml(itemName)}</div>
          ${itemDesc ? `<div style="font-size:13px; color:var(--color-muted); margin-top:4px;">${escapeHtml(itemDesc)}</div>` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; gap:10px; font-size:14px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--color-muted);">所需积分</span>
            <strong style="color:var(--color-accent); font-size:16px; font-family:var(--font-serif);">${itemCost} 积分</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--color-muted);">当前可用余额</span>
            <span style="color:var(--color-ink); font-weight:500;">${currentPoints} 积分</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--color-divider); padding-top:10px;">
            <span style="color:var(--color-muted);">兑换后预计剩余</span>
            <span style="font-weight:600; color:${isAffordable ? 'var(--color-success)' : 'var(--color-accent)'};">${isAffordable ? `${remaining} 积分` : '积分不足'}</span>
          </div>
        </div>

        ${!isAffordable ? `<div style="font-size:13px; color:var(--color-accent); margin-bottom:14px; text-align:center;">还差 ${itemCost - currentPoints} 积分，快去完成今日任务获取奖励吧！</div>` : ''}

        <div style="display:flex; gap:12px;">
          <button class="h5-btn-secondary" style="flex:1;" onclick="closeExchangeConfirmModal()">取消</button>
          <button class="h5-btn-primary" style="flex:2; ${!isAffordable ? 'opacity:0.4; cursor:not-allowed;' : ''}" id="confirmExchangeActionBtn" ${!isAffordable ? 'disabled' : ''} onclick="executeExchange()">确认兑换并放入背包</button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeExchangeConfirmModal() {
  const modal = document.getElementById('exchangeConfirmModal');
  if (modal) modal.classList.remove('active');
  pendingExchangeItem = null;
}

async function executeExchange() {
  if (!pendingExchangeItem) return;
  const btn = document.getElementById('confirmExchangeActionBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '兑换中...';
  }

  const res = await window.galleryApi.buyProduct(pendingExchangeItem.id);
  closeExchangeConfirmModal();

  if (res.success) {
    showToast(res.message || '兑换成功！已放入我的背包');
    await refreshBadges();
    await updateBackpackBadge();
    const backpackModal = document.getElementById('backpackModal');
    if (backpackModal && backpackModal.classList.contains('active')) {
      await loadBackpackItems();
    }
  } else {
    showToast(res.message || '兑换失败');
  }
}

// 兼容旧调用入口
async function handleExchangeClick(itemId, itemName, itemCost) {
  await openExchangeConfirmModal(itemId, itemName, itemCost, '', '');
}

// 我的背包全流程闭环 (规范 10.4)
async function openBackpackModal() {
  const modal = document.getElementById('backpackModal');
  if (modal) {
    modal.classList.add('active');
    await loadBackpackItems();
  }
}

function closeBackpackModal() {
  const modal = document.getElementById('backpackModal');
  if (modal) modal.classList.remove('active');
}

function formatItemDate(dateStr) {
  if (!dateStr) return '刚刚';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (_) {
    return dateStr;
  }
}

async function loadBackpackItems() {
  const pendingList = document.getElementById('backpackPendingList');
  const itemsList = document.getElementById('backpackItemsList');
  const countBadge = document.getElementById('backpackCountBadge');

  if (pendingList) {
    pendingList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--color-muted); font-size:13px;">加载待确认申请中...</div>`;
  }
  if (itemsList) {
    itemsList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--color-muted); font-size:13px;">加载我的背包中...</div>`;
  }

  let pendingItems = [];
  let userItems = [];

  try {
    const [pendingRes, itemsRes] = await Promise.all([
      window.galleryApi.getPendingConfirmations(),
      window.galleryApi.getVirtualItems()
    ]);
    pendingItems = Array.isArray(pendingRes) ? pendingRes : [];
    userItems = Array.isArray(itemsRes) ? itemsRes : [];
  } catch (_) {}

  // 更新待我确认徽标与角标
  if (countBadge) {
    const availableCount = userItems.filter(it => it.status === 'unused').length;
    countBadge.innerText = `${availableCount} 件可用`;
  }
  updateBackpackBadgeWithCount(pendingItems.length);

  let currentBackpackItemsList = [];
  currentBackpackItemsList = [...(pendingItems || []), ...(userItems || [])];

  // 1. 渲染待我确认区域
  if (pendingList) {
    if (pendingItems.length === 0) {
      pendingList.innerHTML = `
        <div class="backpack-empty-hint" id="backpackPendingEmpty" style="padding:20px; text-align:center; color:var(--color-muted); font-size:13px;">
          暂无待确认的使用记录
        </div>
      `;
    } else {
      pendingList.innerHTML = pendingItems.map(item => `
        <div class="backpack-item-card" style="padding:14px; background:var(--color-surface, #fff); border:1px solid #fde68a; border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div class="backpack-item-info" style="flex:1; min-width:0; padding-right:12px;">
            <div class="backpack-item-name" style="font-weight:600; font-size:15px; color:var(--color-ink);">${escapeHtml(item.product_name || item.name || '心愿特权')}</div>
            <div class="backpack-item-desc" style="font-size:12px; color:var(--color-muted); margin-top:2px;">对方于 ${escapeHtml(formatItemDate(item.used_at || item.purchased_at))} 申请使用</div>
            <span class="backpack-item-tag" style="display:inline-block; font-size:11px; padding:1px 6px; border-radius:4px; background:#fef3c7; color:#b45309; margin-top:4px;">待我确认履行</span>
          </div>
          <button class="h5-btn-primary backpack-action-btn" style="height:36px; padding:0 14px; font-size:13px; width:auto; flex-shrink:0; background:#d97706; border-color:#d97706;" onclick="confirmUseItem('${safeInlineArg(item.id)}')">确认履行</button>
        </div>
      `).join('');
    }
  }

  // 2. 渲染我的可用道具区域
  if (itemsList) {
    if (userItems.length === 0) {
      itemsList.innerHTML = `
        <div class="backpack-empty-hint" id="backpackItemsEmpty" style="padding:40px 20px; text-align:center; color:var(--color-muted); font-size:14px;">
          <div style="font-size:28px; margin-bottom:8px;">🎒</div>
          背包空空如也，快去积分小铺兑换心愿吧～
        </div>
      `;
    } else {
      itemsList.innerHTML = userItems.map(item => {
        const isCoupon = item.category === 'coupon' || item.category === 'virtual' || (item.product_name && item.product_name.includes('券'));
        const tagText = isCoupon ? '特权券' : '实体礼物';
        let actionBtn = '';

        if (item.status === 'unused' || !item.status) {
          actionBtn = `<button class="h5-btn-secondary backpack-action-btn" style="height:34px; padding:0 14px; font-size:13px; width:auto; border-color:var(--color-accent); color:var(--color-accent);" onclick="triggerUseItem('${safeInlineArg(item.id)}')">使用</button>`;
        } else if (item.status === 'pending') {
          actionBtn = `<span style="font-size:13px; color:#ea580c; font-weight:500;">等待对方确认</span>`;
        } else {
          actionBtn = `<span style="font-size:13px; color:var(--color-muted);">已使用</span>`;
        }

        return `
          <div class="backpack-item-card" style="padding:14px; background:var(--color-surface, #fff); border:1px solid var(--color-divider); border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div class="backpack-item-info" style="flex:1; min-width:0; padding-right:12px;">
              <div class="backpack-item-name" style="font-weight:600; font-size:15px; color:var(--color-ink);">${escapeHtml(item.product_name || item.name || '心愿特权')}</div>
              <div class="backpack-item-desc" style="font-size:12px; color:var(--color-muted); margin-top:2px;">兑换于 ${escapeHtml(formatItemDate(item.purchased_at))}</div>
              <div style="margin-top:4px;">
                <span class="backpack-item-tag" style="display:inline-block; font-size:11px; padding:1px 6px; border-radius:4px; background:#f5f3ef; color:var(--color-muted);">${tagText}</span>
                ${item.status === 'pending' ? '<span style="display:inline-block; font-size:11px; padding:1px 6px; border-radius:4px; background:#fff7ed; color:#c2410c; margin-left:4px;">申请中</span>' : ''}
              </div>
            </div>
            ${actionBtn}
          </div>
        `;
      }).join('');
    }
  }
}

async function triggerUseItem(itemId, fallbackName = '心愿特权') {
  const item = (window.__backpackItemsCache || []).find(x => String(x.id) === String(itemId));
  const itemName = item ? (item.product_name || item.name || fallbackName) : fallbackName;
  const ok = await showAppConfirm({
    title: '使用特权道具',
    message: `确认使用「${itemName}」？\n使用后将通知对方确认履行。`,
    confirmText: '确认使用',
    icon: '🎟️'
  });
  if (!ok) return;

  const res = await window.galleryApi.useVirtualItem(itemId);
  if (res && res.success) {
    showToast(res.message || '已申请使用，等待对方确认');
    await loadBackpackItems();
  } else {
    showToast(res?.message || '使用失败');
  }
}

async function confirmUseItem(itemId, fallbackName = '心愿特权') {
  const item = (window.__backpackItemsCache || []).find(x => String(x.id) === String(itemId));
  const itemName = item ? (item.product_name || item.name || fallbackName) : fallbackName;
  const ok = await showAppConfirm({
    title: '确认履行心愿',
    message: `确认履行对方申请的「${itemName}」？`,
    confirmText: '确认履行',
    icon: '💖'
  });
  if (!ok) return;

  const res = await window.galleryApi.confirmVirtualItem(itemId);
  if (res && res.success) {
    showToast(res.message || '确认成功！已履行该心愿');
    await loadBackpackItems();
    await updateBackpackBadge();
  } else {
    showToast(res?.message || '确认失败');
  }
}

function updateBackpackBadgeWithCount(count) {
  const badge = document.getElementById('backpackBadge');
  if (!badge) return;
  if (count > 0) {
    badge.innerText = String(count);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

async function updateBackpackBadge() {
  try {
    const pendingItems = await window.galleryApi.getPendingConfirmations();
    updateBackpackBadgeWithCount(Array.isArray(pendingItems) ? pendingItems.length : 0);
  } catch (_) {}
}

async function refreshBadges() {
  const points = await window.galleryApi.getPoints();
  const pointsEl = document.getElementById('h5UserPointsDisplay');
  if (pointsEl) pointsEl.innerText = String(points);
}

// 暴露全局以确保 HTML 中的内联 onclick 正常响应
window.switchWishSegment = switchWishSegment;
window.openBackpackModal = openBackpackModal;
window.closeBackpackModal = closeBackpackModal;
window.loadBackpackItems = loadBackpackItems;
window.triggerUseItem = triggerUseItem;
window.confirmUseItem = confirmUseItem;
window.updateBackpackBadge = updateBackpackBadge;
window.openExchangeConfirmModal = openExchangeConfirmModal;
window.closeExchangeConfirmModal = closeExchangeConfirmModal;
window.executeExchange = executeExchange;
window.handleExchangeClick = handleExchangeClick;
window.handleTaskAction = handleTaskAction;

/* ==========================================================================
   9. 悄悄话与私密来信 (信件阅读、标记已读、发送、归档)
   ========================================================================== */
async function refreshLetterBanner() {
  const banner = document.getElementById('homeLetterBanner');
  const plaqueText = document.getElementById('homeLetterBannerText');
  const countBadge = document.getElementById('homeLetterCountBadge');
  if (!banner) return;

  const whispers = await window.galleryApi.getWhispersHistory();
  allWhispersList = Array.isArray(whispers) ? whispers : [];

  const unreadItems = allWhispersList.filter(w => !w.is_from_me && (w.unread || w.unread_for_me));
  if (unreadItems.length > 0) {
    banner.style.display = 'flex';
    if (plaqueText) plaqueText.innerText = `有一封未读信件：“${(unreadItems[0].title || unreadItems[0].content || '给你留了悄悄话').slice(0, 16)}...”`;
    if (countBadge) {
      countBadge.innerText = `${unreadItems.length} 封新信`;
      countBadge.style.display = 'inline-block';
    }
  } else {
    // 无对方寄来的未读信件时，直接隐藏新来信提示条，绝不把已读信件挂在主页
    banner.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
  }
}

async function openLetterModal() {
  const whispers = await window.galleryApi.getWhispersHistory();
  allWhispersList = Array.isArray(whispers) ? whispers : [];
  const modal = document.getElementById('letterModalPage');
  if (!modal) return;

  if (allWhispersList.length === 0) {
    currentOpenWhisperId = null;
    const metaEl = document.getElementById('letterModalMeta');
    const contentEl = document.getElementById('letterModalContent');
    if (metaEl) metaEl.innerText = '暂无来信';
    if (contentEl) contentEl.innerText = '信箱空空的，点击首页“＋”写下你想对TA说的第一封信吧。';
    modal.classList.add('active');
    return;
  }

  // 优先排序：未读来信优先展示在最前面
  allWhispersList.sort((a, b) => {
    const aUnread = (!a.is_from_me && (a.unread || a.unread_for_me)) ? 1 : 0;
    const bUnread = (!b.is_from_me && (b.unread || b.unread_for_me)) ? 1 : 0;
    return bUnread - aUnread;
  });

  currentWhisperIndex = 0;
  displayCurrentWhisper();
  modal.classList.add('active');
}

function displayCurrentWhisper() {
  if (!allWhispersList || allWhispersList.length === 0) return;
  const item = allWhispersList[currentWhisperIndex] || allWhispersList[0];
  currentOpenWhisperId = item.id;

  const metaEl = document.getElementById('letterModalMeta');
  const contentEl = document.getElementById('letterModalContent');
  const isFromMe = Boolean(item.is_from_me);
  const isUnread = !isFromMe && (item.unread || item.unread_for_me);
  const unreadTag = isFromMe ? ' <span style="display:inline-block; font-size:11px; padding:2px 6px; background:var(--color-divider); color:var(--color-muted); border-radius:4px; margin-left:6px;">我寄出的信</span>' : (isUnread ? ' <span style="display:inline-block; font-size:11px; padding:2px 6px; background:var(--color-accent-soft); color:var(--color-accent); border-radius:4px; margin-left:6px;">未读来信</span>' : ' <span style="display:inline-block; font-size:11px; padding:2px 6px; background:var(--color-divider); color:var(--color-muted); border-radius:4px; margin-left:6px;">已读归档</span>');

  if (metaEl) {
    const pageNavText = allWhispersList.length > 1 ? ` · 第 ${currentWhisperIndex + 1}/${allWhispersList.length} 封` : '';
    metaEl.innerHTML = `${escapeHtml(item.from || '对方')} 写于 ${escapeHtml(item.date || '今日')}${unreadTag}${pageNavText}`;
  }
  if (contentEl) {
    contentEl.innerText = item.content || '';
  }
}

function showNextWhisper() {
  if (!allWhispersList || allWhispersList.length <= 1) return;
  currentWhisperIndex = (currentWhisperIndex + 1) % allWhispersList.length;
  displayCurrentWhisper();
}

function closeLetterModal() {
  const modal = document.getElementById('letterModalPage');
  if (modal) modal.classList.remove('active');
}

async function handleLetterReadDone() {
  if (currentOpenWhisperId) {
    await window.galleryApi.markWhisperRead(currentOpenWhisperId);
    // 更新本地项为已读
    const curr = allWhispersList.find(w => w.id === currentOpenWhisperId);
    if (curr) {
      curr.unread = false;
      curr.is_read = true;
    }
  }
  await refreshLetterBanner();
  showToast('已完成阅读并留存在私密信箱');
  closeLetterModal();
}

async function archiveLetterAction() {
  if (currentOpenWhisperId) {
    await window.galleryApi.markWhisperRead(currentOpenWhisperId);
    const curr = allWhispersList.find(w => w.id === currentOpenWhisperId);
    if (curr) {
      curr.unread = false;
      curr.is_read = true;
    }
  }
  await refreshLetterBanner();
  showToast('信件已归档至私密空间');
  closeLetterModal();
}

// 独立写悄悄话/写信弹层 (规范 10.6)
function openWriteLetterModal() {
  const modal = document.getElementById('writeLetterModal');
  if (modal) {
    modal.classList.add('active');
    const titleInput = document.getElementById('writeLetterTitle');
    const contentInput = document.getElementById('writeLetterContent');
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    resetAppRootScroll();
    setTimeout(() => {
      if (titleInput) titleInput.focus({ preventScroll: true });
      resetAppRootScroll();
    }, 120);
  }
}

function closeWriteLetterModal() {
  const modal = document.getElementById('writeLetterModal');
  if (modal) modal.classList.remove('active');
  const title = document.getElementById('writeLetterTitle');
  const content = document.getElementById('writeLetterContent');
  if (title) {
    title.value = '';
    title.blur();
  }
  if (content) {
    content.value = '';
    content.blur();
  }
  resetAppRootScroll();
}

async function submitDirectLetter() {
  const titleInput = document.getElementById('writeLetterTitle');
  const contentInput = document.getElementById('writeLetterContent');
  const title = titleInput ? titleInput.value.trim() : '';
  const content = contentInput ? contentInput.value.trim() : '';
  if (!content) {
    showToast('请输入悄悄话内容');
    return;
  }
  const fullContent = title ? `【${title}】\n${content}` : content;
  const res = await window.galleryApi.sendWhisper(fullContent);
  if (res && res.success) {
    showToast(res.message || '悄悄话已成功发送给对方');
    closeWriteLetterModal();
    await refreshLetterBanner();
  } else {
    showToast(res?.message || '发送失败，请重试');
  }
}

/* ==========================================================================
   10. 故事时间线 (编年节点、自选历史日期与图片展示)
   ========================================================================== */
function openStoryPage() {
  const page = document.getElementById('storyTimelinePage');
  if (page) {
    page.classList.add('active');
    renderStoryTimeline();
  }
}

function closeStoryPage() {
  const page = document.getElementById('storyTimelinePage');
  if (page) page.classList.remove('active');
}

async function renderStoryTimeline() {
  const container = document.getElementById('storyTimelineList');
  if (!container) return;

  const events = await window.galleryApi.getStoryTimeline();
  window.__currentTimelineEvents = events || [];
  if (!events || events.length === 0) {
    container.innerHTML = `
      <div style="padding:48px 20px; text-align:center; color:var(--color-muted);">
        暂无故事节点，点击右上角“＋记故事”添加
      </div>
    `;
    return;
  }

  // 按年份分组
  const groups = {};
  for (const ev of events) {
    const year = (ev.date || '2026').slice(0, 4);
    if (!groups[year]) groups[year] = [];
    groups[year].push(ev);
  }

  const years = Object.keys(groups).sort().reverse();
  container.innerHTML = years.map(yr => `
    <div style="font-family:var(--font-serif); font-size:24px; font-weight:600; color:var(--color-ink); margin-bottom:16px;">${yr}</div>
    ${groups[yr].map((item, idx) => {
      const evGlobalIdx = events.indexOf(item);
      // 事件类型标识 (规范 10.5)
      let typeBadge = '';
      if (item.type === 'start') {
        typeBadge = '<span style="font-size:11px; padding:2px 8px; border-radius:10px; background:#fef2f2; color:#ef4444; font-weight:600; margin-left:6px;">恋爱起点</span>';
      } else if (item.type === 'anniversary') {
        typeBadge = '<span style="font-size:11px; padding:2px 8px; border-radius:10px; background:#fff7ed; color:#f97316; font-weight:600; margin-left:6px;">纪念日</span>';
      } else if (item.type === 'birthday') {
        typeBadge = '<span style="font-size:11px; padding:2px 8px; border-radius:10px; background:#fdf2f8; color:#ec4899; font-weight:600; margin-left:6px;">生日祝福</span>';
      } else if (item.type === 'upload') {
        typeBadge = '<span style="font-size:11px; padding:2px 8px; border-radius:10px; background:#eff6ff; color:#3b82f6; font-weight:600; margin-left:6px;">相册足迹</span>';
      } else {
        typeBadge = '<span style="font-size:11px; padding:2px 8px; border-radius:10px; background:var(--color-accent-soft); color:var(--color-accent); font-weight:600; margin-left:6px;">生活故事</span>';
      }

      // 照片网格展示 (规范 10.5)
      let photosHtml = '';
      if (Array.isArray(item.photos) && item.photos.length > 0) {
        photosHtml = `
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
            ${item.photos.map((p, pIdx) => {
              const pUrl = typeof p === 'string' ? p : (p.url || p.path || p.thumbnail_path || '');
              const cleanUrl = '/' + pUrl.replace(/^\/+/, '');
              return `
                <div class="story-photo-thumb" data-event-idx="${evGlobalIdx}" data-photo-idx="${pIdx}" style="width:72px; height:72px; border-radius:var(--radius-sm); overflow:hidden; background:var(--color-surface); cursor:pointer; border:1px solid var(--color-divider);">
                  <img src="${cleanUrl}" alt="故事照片" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none';">
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      return `
        <div style="position:relative; padding-left:24px; margin-bottom:24px; border-left:2px solid var(--color-divider);">
          <div style="position:absolute; left:-6px; top:4px; width:10px; height:10px; border-radius:50%; background:${idx === 0 ? 'var(--color-accent)' : 'var(--color-muted)'};"></div>
          <div style="font-size:13px; color:var(--color-muted); display:flex; align-items:center;">
            <span>${escapeHtml(item.date || '')} ${item.location ? `· ${escapeHtml(item.location)}` : ''}</span>
            ${typeBadge}
          </div>
          <div style="font-size:16px; font-weight:600; margin:4px 0 6px;">${escapeHtml(item.title || '故事节点')}</div>
          <p style="font-size:14px; color:var(--color-ink); line-height:1.6; margin:0;">${escapeHtml(item.content || '')}</p>
          ${photosHtml}
        </div>
      `;
    }).join('')}
  `).join('');

  container.querySelectorAll('.story-photo-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const eIdx = parseInt(thumb.getAttribute('data-event-idx'), 10);
      const pIdx = parseInt(thumb.getAttribute('data-photo-idx'), 10);
      if (!isNaN(eIdx) && !isNaN(pIdx)) openStoryPhotoByEventIndex(eIdx, pIdx);
    });
  });
}

/* ==========================================================================
   11. 私密空间独立 PIN 码核验与随笔
   ========================================================================== */
function initSecretPad() {
  secretPin = '';
}

async function openSecretSpace() {
  const requestVersion = ++secretRequestVersion;
  secretPin = '';
  updatePinDisplay();

  // 预检私密空间登录态：若已在会话中认证，直接展示内容
  const authStatus = await window.galleryApi.checkPrivateAuth();
  if (requestVersion !== secretRequestVersion) return;
  secretUnlocked = Boolean(authStatus && authStatus.authenticated);
  if (authStatus && authStatus.authenticated) {
    document.getElementById('secretAuthView').style.display = 'none';
    document.getElementById('secretContentView').style.display = 'block';
    document.getElementById('secretLockBtn').style.display = 'block';
    await loadSecretSpaceData();
  } else {
    document.getElementById('secretAuthView').style.display = 'block';
    document.getElementById('secretContentView').style.display = 'none';
    document.getElementById('secretLockBtn').style.display = 'none';
  }
  document.getElementById('secretSpacePage').classList.add('active');
  resetAppRootScroll();
}

function closeSecretSpace() {
  void lockSecretSpace();
  document.getElementById('secretSpacePage').classList.remove('active');
  resetAppRootScroll();
}

async function lockSecretSpace() {
  ++secretRequestVersion;
  secretUnlocked = false;
  currentPrivateNotesList = [];
  for (const id of ['secretNotesList', 'secretFilesList', 'noteDetailTitle', 'noteDetailDate', 'noteDetailContent']) {
    const element = document.getElementById(id);
    if (element) element.textContent = '';
  }
  closeNoteDetailModal();
  closeCreateNoteModal();
  secretPin = '';
  updatePinDisplay();
  const pwdInput = document.getElementById('secretPasswordInput');
  if (pwdInput) pwdInput.value = '';

  document.getElementById('secretAuthView').style.display = 'block';
  document.getElementById('secretContentView').style.display = 'none';
  document.getElementById('secretLockBtn').style.display = 'none';
  resetAppRootScroll();
  showToast('私密空间已锁定');
  await window.galleryApi.logoutPrivate();
}

// 认证双模式切换 (数字键盘 vs 常规文本密码) (规范 10.6)
function toggleSecretAuthMode() {
  const pinMode = document.getElementById('secretPinMode');
  const textMode = document.getElementById('secretTextMode');
  const toggleBtn = document.getElementById('secretModeSwitchBtn');
  const isPin = pinMode && pinMode.style.display !== 'none';
  if (isPin) {
    if (pinMode) pinMode.style.display = 'none';
    if (textMode) textMode.style.display = 'block';
    if (toggleBtn) toggleBtn.textContent = '切换为数字键盘输入';
    const pwdInput = document.getElementById('secretPasswordInput');
    if (pwdInput) pwdInput.focus({ preventScroll: true });
  } else {
    if (pinMode) pinMode.style.display = 'block';
    if (textMode) textMode.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '切换为常规文本密码输入';
  }
}

function pressSecretKey(key) {
  if (secretPin.length < 4) {
    secretPin += key;
    updatePinDisplay();
    if (secretPin.length === 4) {
      setTimeout(verifyPin, 180);
    }
  }
}

function deleteSecretKey() {
  if (secretPin.length > 0) {
    secretPin = secretPin.slice(0, -1);
    updatePinDisplay();
  }
}

function updatePinDisplay() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`sec-dot-${i}`);
    if (dot) {
      dot.classList.toggle('filled', i < secretPin.length);
    }
  }
}

async function verifyPin() {
  const requestVersion = ++secretRequestVersion;
  const res = await window.galleryApi.verifyPrivatePassword(secretPin);
  if (requestVersion !== secretRequestVersion) return;
  if (res && res.authenticated) {
    secretUnlocked = true;
    document.getElementById('secretAuthView').style.display = 'none';
    document.getElementById('secretContentView').style.display = 'block';
    document.getElementById('secretLockBtn').style.display = 'block';
    showToast('私密空间已解锁');
    await loadSecretSpaceData();
  } else {
    showToast(res?.message || '密码错误，请重试');
    secretPin = '';
    updatePinDisplay();
  }
}

async function submitSecretTextPassword() {
  const pwdInput = document.getElementById('secretPasswordInput');
  const pwd = pwdInput ? pwdInput.value.trim() : '';
  if (!pwd) {
    showToast('请输入私密空间密码');
    return;
  }
  const requestVersion = ++secretRequestVersion;
  const res = await window.galleryApi.verifyPrivatePassword(pwd);
  if (requestVersion !== secretRequestVersion) return;
  if (res && res.authenticated) {
    secretUnlocked = true;
    document.getElementById('secretAuthView').style.display = 'none';
    document.getElementById('secretContentView').style.display = 'block';
    document.getElementById('secretLockBtn').style.display = 'block';
    showToast('私密空间已解锁');
    if (pwdInput) pwdInput.value = '';
    await loadSecretSpaceData();
  } else {
    showToast(res?.message || '密码错误，请重试');
  }
}

// 私密空间内容分区切换 (笔记 vs 文件) (规范 10.6)
function switchSecretContentTab(tab) {
  document.querySelectorAll('.secret-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const notesSec = document.getElementById('secretNotesSection');
  const filesSec = document.getElementById('secretFilesSection');
  if (notesSec && filesSec) {
    notesSec.style.display = tab === 'notes' ? 'block' : 'none';
    filesSec.style.display = tab === 'files' ? 'block' : 'none';
  }
}

async function loadSecretSpaceData() {
  await Promise.all([
    renderPrivateNotes(),
    renderPrivateFiles()
  ]);
}

async function renderPrivateNotes() {
  const requestVersion = secretRequestVersion;
  const container = document.getElementById('secretNotesList');
  const countEl = document.getElementById('secretNotesCount');
  if (!container) return;

  const notes = await window.galleryApi.getPrivateNotes();
  if (requestVersion !== secretRequestVersion || !secretUnlocked) return;
  currentPrivateNotesList = notes || [];
  if (countEl) countEl.innerText = `已归档私密信件与备忘 (${notes.length} 条)`;

  if (!notes || notes.length === 0) {
    container.innerHTML = `
      <div style="padding:28px 16px; text-align:center; font-size:14px; color:var(--color-muted);">
        <div style="font-size:24px; margin-bottom:6px;">📝</div>
        暂无私密随笔，点击上方“＋新建笔记”添加
      </div>
    `;
    return;
  }

  container.innerHTML = notes.map((n, idx) => `
    <div style="padding:14px 16px; display:flex; justify-content:space-between; align-items:flex-start; ${idx < notes.length - 1 ? 'border-bottom:1px solid var(--color-divider);' : ''} background:var(--color-surface); border-radius:var(--radius-sm); margin-bottom:8px; border:1px solid var(--color-divider);">
      <div style="flex:1; cursor:pointer; margin-right:12px;" onclick="showPrivateNoteDetailById('${safeInlineArg(n.id)}')">
        <div style="font-size:15px; font-weight:600; color:var(--color-ink); margin-bottom:4px;">${escapeHtml(n.title || '私密随笔')}</div>
        <div style="font-size:13px; color:var(--color-muted); line-height:1.5; max-height:40px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(n.content || '')}</div>
        <div style="font-size:12px; color:var(--color-muted); margin-top:6px;">${escapeHtml((n.created_at || n.date || '').slice(0, 16))}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="h5-btn-secondary" style="height:32px; padding:0 10px; font-size:12px;" onclick="showPrivateNoteDetailById('${safeInlineArg(n.id)}')">查看</button>
        <button class="h5-btn-secondary" style="height:32px; padding:0 10px; font-size:12px; color:var(--color-danger, #e53e3e);" onclick="deletePrivateNoteAction('${safeInlineArg(n.id)}')">删除</button>
      </div>
    </div>
  `).join('');
}

let currentPrivateNotesList = [];

function showPrivateNoteDetailById(noteId) {
  const n = (currentPrivateNotesList || []).find(item => String(item.id) === String(noteId));
  if (!n) return;
  showPrivateNoteDetail(n.title || '私密随笔', n.content || '', n.created_at || n.date || '', n.id);
}

function showPrivateNoteDetail(title, content, date, noteId) {
  const modal = document.getElementById('noteDetailModalOverlay');
  const titleEl = document.getElementById('noteDetailTitle');
  const dateEl = document.getElementById('noteDetailDate');
  const contentEl = document.getElementById('noteDetailContent');
  const deleteBtn = document.getElementById('noteDetailDeleteBtn');

  if (titleEl) titleEl.innerText = title || '私密笔记';
  if (dateEl) dateEl.innerText = date ? `记录时间：${date}` : '';
  if (contentEl) contentEl.innerText = content || '';
  if (deleteBtn && noteId) {
    deleteBtn.onclick = async () => {
      closeNoteDetailModal();
      await deletePrivateNoteAction(noteId);
    };
  }

  if (modal) {
    modal.classList.add('active');
  } else {
    alert(`【${title}】\n${date ? date + '\n\n' : '\n'}${content}`);
  }
}

function closeNoteDetailModal() {
  const modal = document.getElementById('noteDetailModalOverlay');
  if (modal) modal.classList.remove('active');
  resetAppRootScroll();
}

function openCreateNoteModal() {
  const modal = document.getElementById('createNoteModalOverlay');
  if (modal) {
    modal.classList.add('active');
    const titleInput = document.getElementById('newNoteTitleInput');
    const contentInput = document.getElementById('newNoteContentInput');
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    resetAppRootScroll();
    setTimeout(() => {
      if (titleInput) titleInput.focus({ preventScroll: true });
      resetAppRootScroll();
    }, 120);
  }
}

function closeCreateNoteModal() {
  const modal = document.getElementById('createNoteModalOverlay');
  if (modal) modal.classList.remove('active');
  const titleInput = document.getElementById('newNoteTitleInput');
  const contentInput = document.getElementById('newNoteContentInput');
  if (titleInput) {
    titleInput.value = '';
    titleInput.blur();
  }
  if (contentInput) {
    contentInput.value = '';
    contentInput.blur();
  }
  resetAppRootScroll();
}

async function confirmSaveNote() {
  const titleInput = document.getElementById('newNoteTitleInput');
  const contentInput = document.getElementById('newNoteContentInput');
  const title = titleInput ? titleInput.value.trim() : '';
  const content = contentInput ? contentInput.value.trim() : '';
  if (!content) {
    showToast('请写下笔记内容');
    return;
  }
  const res = await window.galleryApi.addPrivateNote(title || '私密随笔', content);
  if (res && res.success) {
    showToast('私密笔记已保存');
    closeCreateNoteModal();
    resetAppRootScroll();
    await renderPrivateNotes();
  } else {
    showToast(res?.message || '保存失败');
  }
}

async function deletePrivateNoteAction(noteId) {
  const ok = await showAppConfirm({
    title: '删除私密笔记',
    message: '确定要删除这条私密笔记吗？删除后不可恢复。',
    confirmText: '确认删除',
    isDanger: true,
    icon: '🔒'
  });
  if (!ok) return;

  const res = await window.galleryApi.deletePrivateNote(noteId);
  if (res && res.success) {
    showToast('笔记已安全删除');
    await renderPrivateNotes();
  } else {
    showToast(res?.message || '删除失败');
  }
}

// --------------------------------------------------------------------------
// 私密文件管理闭环 (列表、上传、删除、下载)
// --------------------------------------------------------------------------
async function renderPrivateFiles() {
  const requestVersion = secretRequestVersion;
  const container = document.getElementById('secretFilesList');
  const countEl = document.getElementById('secretFilesCount');
  const emptyEl = document.getElementById('secretFilesEmpty');
  if (!container) return;

  const files = await window.galleryApi.getPrivateFiles();
  if (requestVersion !== secretRequestVersion || !secretUnlocked) return;
  if (countEl) countEl.innerText = `私密受控文件 (${files.length} 个)`;

  if (!files || files.length === 0) {
    container.innerHTML = `
      <div class="backpack-empty-hint" id="secretFilesEmpty" style="padding:28px 16px; text-align:center; font-size:14px; color:var(--color-muted);">
        <div style="font-size:24px; margin-bottom:6px;">🔒</div>
        暂无私密文件，点击上方“＋上传文件”安全存储
      </div>
    `;
    return;
  }

  container.innerHTML = files.map((file, idx) => {
    const sizeKb = (file.size / 1024).toFixed(1);
    const dateStr = (file.uploaded_at || file.created_at || '').slice(0, 16);
    const downloadUrl = window.galleryApi.resolveApiUrl(`/api/private-files.php?action=download&file_id=${encodeURIComponent(file.id)}`);

    return `
      <div class="secret-file-item" style="padding:14px 16px; display:flex; justify-content:space-between; align-items:center; ${idx < files.length - 1 ? 'border-bottom:1px solid var(--color-divider);' : ''} background:var(--color-surface); border-radius:var(--radius-sm); margin-bottom:8px; border:1px solid var(--color-divider);">
        <div class="secret-file-info" style="flex:1; margin-right:12px; overflow:hidden;">
          <div class="secret-file-name" style="font-size:15px; font-weight:600; color:var(--color-ink); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">📄 ${escapeHtml(file.original_name || file.name || '受控文件')}</div>
          <div class="secret-file-meta" style="font-size:12px; color:var(--color-muted); margin-top:4px;">${sizeKb} KB · ${escapeHtml(dateStr)} 上传</div>
        </div>
        <div class="secret-file-actions" style="display:flex; align-items:center; gap:8px;">
          <a href="${escapeForAttr(downloadUrl)}" download="${escapeForAttr(file.original_name || file.name || 'file')}" target="_blank" rel="noopener" class="h5-btn-secondary" style="height:32px; padding:0 12px; font-size:12px; display:inline-flex; align-items:center; text-decoration:none;">下载</a>
          <button class="h5-btn-secondary" style="height:32px; padding:0 12px; font-size:12px; color:var(--color-danger, #e53e3e);" onclick="deletePrivateFileAction('${safeInlineArg(file.id)}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleSecretFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  showToast(`正在加密上传：${file.name}...`);
  const res = await window.galleryApi.uploadPrivateFile(file);
  if (res && res.success) {
    showToast(res.message || '文件已加密安全存储');
    e.target.value = '';
    await renderPrivateFiles();
  } else {
    showToast(res?.message || '文件上传失败，请重试');
  }
}

async function deletePrivateFileAction(fileId) {
  const ok = await showAppConfirm({
    title: '删除私密文件',
    message: '确定要删除这个私密文件吗？删除后不可恢复。',
    confirmText: '确认删除',
    isDanger: true,
    icon: '🗂️'
  });
  if (!ok) return;

  const res = await window.galleryApi.deletePrivateFile(fileId);
  if (res && res.success) {
    showToast('文件已删除');
    await renderPrivateFiles();
  } else {
    showToast(res?.message || '删除失败');
  }
}

/* ==========================================================================
   12. 授权设备状态
   ========================================================================== */
function openDevicePage() {
  const page = document.getElementById('deviceAuthPage');
  if (page) {
    page.classList.add('active');
    renderDeviceStatus();
  }
}

function closeDevicePage() {
  const page = document.getElementById('deviceAuthPage');
  if (page) page.classList.remove('active');
}

async function renderDeviceStatus() {
  const container = document.getElementById('deviceAuthInfoContainer');
  if (!container) return;

  const dev = await window.galleryApi.getDeviceStatus();
  const statusText = {
    active: '信任会话持续有效（已绑定）',
    pending: '等待管理员审批',
    expired: '授权已过期，请重新验证',
    denied: '申请已被拒绝',
    revoked: '授权已被撤销',
    missing: '未检测到本机授权记录'
  }[dev.status] || '状态未知';

  const statusColor = dev.status === 'active' ? 'var(--color-success)' : 'var(--color-danger)';

  container.innerHTML = `
    <div style="background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); padding:16px; margin-bottom:16px;">
      <div style="font-size:14px; font-weight:600; color:var(--color-ink); margin-bottom:4px;">当前设备授权状态</div>
      <div style="font-size:13px; color:var(--color-muted);">移动端网页 · ${dev.admin ? '管理员账号' : '成员账号'}</div>
      <div style="margin-top:10px; font-size:12px; color:${statusColor}; font-weight:500;">● ${escapeHtml(statusText)}</div>
    </div>
    <div style="background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); padding:16px;">
      <div style="font-size:14px; font-weight:600; color:var(--color-ink); margin-bottom:6px;">安全机制说明</div>
      <p style="font-size:13px; color:var(--color-muted); line-height:1.6;">
        双设备专属绑定架构，每次登录通过设备签名与安全会话双重核验，未经授权设备无法读取任何私密记录。
      </p>
    </div>
  `;
}

/* ==========================================================================
   12.1 账号会话、登录回跳与退出（规范 10.1 / 10.7）
   ========================================================================== */
function applySessionState(isLoggedIn) {
  const banner = document.getElementById('sessionExpiredBanner');
  if (isLoggedIn !== false) {
    if (banner) banner.style.display = 'none';
    sessionNoticeShown = false;
    return;
  }

  if (banner) {
    banner.style.display = 'block';
  } else if (!sessionNoticeShown) {
    sessionNoticeShown = true;
    showToast('当前未登录，正在使用演示内容；点击“我们 → 去登录”可进入真实账号');
  }
}

function gotoLogin() {
  window.location.href = window.galleryApi.getLoginUrl();
}

async function handleH5Logout() {
  const ok = await showAppConfirm({
    title: '退出登录',
    message: '确定要退出当前账号吗？退出后需重新验证身份。',
    confirmText: '退出登录',
    isDanger: true,
    icon: '👋'
  });
  if (!ok) return;

  const res = await window.galleryApi.logout();
  try {
    localStorage.removeItem('couple_auth_token');
    localStorage.removeItem('couple_session_user');
  } catch (_) {}

  if (res && res.success) {
    showToast('已安全退出账号');
  } else {
    showToast('退出请求未成功，已清除本地登录状态');
  }
  setTimeout(() => {
    window.location.href = window.galleryApi.getLoginUrl();
  }, 600);
}

/* ==========================================================================
   12.2 双方头像展示与更换（规范 10.1）
   ========================================================================== */
function resolveAvatarUrl(path) {
  if (!path) return '';
  if (typeof window.galleryApi.resolveAssetUrl === 'function') {
    return window.galleryApi.resolveAssetUrl(path);
  }
  return path;
}

function renderCoupleAvatars(avatars) {
  const list = Array.isArray(avatars) ? avatars.filter(a => a && a.avatar) : [];
  if (list.length === 0) return;

  const boy = list[0];
  const girl = list[1] || list[0];

  const boyImg = document.getElementById('usBoyAvatarImg');
  const girlImg = document.getElementById('usGirlAvatarImg');
  if (boyImg && boy) boyImg.src = resolveAvatarUrl(boy.avatar);
  if (girlImg && girl) girlImg.src = resolveAvatarUrl(girl.avatar);
}

function triggerAvatarUpload(side) {
  const input = document.getElementById(side === 'right' ? 'avatarUploadInputRight' : 'avatarUploadInputLeft');
  if (input) input.click();
}

async function handleAvatarFileChange(event, side) {
  const input = event && event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;

  const img = document.getElementById(side === 'right' ? 'usGirlAvatarImg' : 'usBoyAvatarImg');
  const originalSrc = img ? img.src : '';
  const sideName = side === 'right' ? '小鹿' : '小林';

  // 本地即时预览
  let previewUrl = '';
  try {
    previewUrl = URL.createObjectURL(file);
    if (img) img.src = previewUrl;
  } catch (_) {}

  const res = await window.galleryApi.uploadAvatar(side, file);

  if (previewUrl) URL.revokeObjectURL(previewUrl);

  if (res && res.success) {
    if (img && res.avatar_url) img.src = resolveAvatarUrl(res.avatar_url);
    showToast(`${sideName}的头像已更新`);
  } else {
    // 失败必须回退到原头像并如实提示，绝不假装成功
    if (img && originalSrc) img.src = originalSrc;
    showToast(res && res.message ? `头像更新失败：${res.message}` : '头像更新失败');
  }

  if (input) input.value = '';
}

/* ==========================================================================
   12.3 每日文案换一句（规范 10.1）
   ========================================================================== */
const presetQuotes = [
  '在平常的日子里，慢慢收集我们之间闪闪发光的瞬间。',
  '世界很大，风景很美，最幸运的是有你一直同行。',
  '晨起有朝阳，日落有微风，夜晚有你的晚安。',
  '所有温柔与心动，都在与你相关的每个细节里。',
  '想和你去很多很多地方，走很长很长的路。',
  '每一次相视一笑，都是生活赠予我们最好的浪漫。'
];
let currentQuoteIdx = 0;
let quoteSwitching = false;

async function handleChangeDailyQuote() {
  if (quoteSwitching) return;
  quoteSwitching = true;

  const quoteEl = document.getElementById('dailyQuoteText');
  const btn = document.getElementById('changeDailyQuoteBtn');
  if (btn) btn.classList.add('rotating');

  const currentClean = (quoteEl ? quoteEl.innerText : '').replace(/^[“"「]\s*|\s*[”"」]$/g, '').trim();

  let nextQuote = null;
  let fromServer = false;
  try {
    const q = await window.galleryApi.getDailyQuote();
    if (q && typeof q === 'string' && q.trim()) {
      nextQuote = q.trim();
      fromServer = true;
    }
  } catch (_) {}

  if (fromServer && nextQuote) {
    if (nextQuote === currentClean) {
      showToast('今日文案已是最新内容');
      if (btn) setTimeout(() => btn.classList.remove('rotating'), 500);
      quoteSwitching = false;
      return;
    }
    if (quoteEl) quoteEl.innerText = `“${nextQuote}”`;
    showToast('已更新今日文案');
  } else {
    let attempts = 0;
    do {
      currentQuoteIdx = (currentQuoteIdx + 1) % presetQuotes.length;
      nextQuote = presetQuotes[currentQuoteIdx];
      attempts++;
    } while (nextQuote === currentClean && attempts < presetQuotes.length);

    if (quoteEl) quoteEl.innerText = `“${nextQuote}”`;
    showToast('已切换到本地备用文案');
  }

  if (btn) setTimeout(() => btn.classList.remove('rotating'), 500);
  quoteSwitching = false;
}

/* ==========================================================================
   12.4 设备管理（管理员 list / approve / deny / revoke，规范 10.7）
   ========================================================================== */
function openDeviceManagementModal() {
  const modal = document.getElementById('deviceManagementModal');
  if (modal) modal.classList.add('active');
  refreshPendingDevices();
}

function closeDeviceManagementModal() {
  const modal = document.getElementById('deviceManagementModal');
  if (modal) modal.classList.remove('active');
}

function deviceStatusLabel(status) {
  return {
    pending: '待审批',
    active: '已授权',
    denied: '已拒绝',
    revoked: '已撤销',
    expired: '已过期'
  }[status] || status || '未知';
}

async function refreshPendingDevices() {
  const listEl = document.getElementById('pendingDevicesList');
  const activeEl = document.getElementById('activeDevicesList');
  if (!listEl) return;

  listEl.innerHTML = '<div style="padding:20px 16px; text-align:center; font-size:14px; color:var(--color-muted);">正在加载设备列表…</div>';
  if (activeEl) {
    activeEl.innerHTML = '<div style="padding:20px 16px; text-align:center; font-size:14px; color:var(--color-muted);">正在加载设备列表…</div>';
  }

  const res = await window.galleryApi.getPendingDevices();

  if (!res || !res.success) {
    deviceListCache = [];
    const msg = res && res.forbidden
      ? '仅管理员可以管理设备，当前账号无权限'
      : (res && res.message) || '设备列表加载失败';
    const errHtml = `<div class="device-empty-hint" style="padding:20px 16px; text-align:center; font-size:14px; color:var(--color-danger); background:var(--color-surface-subtle); border-radius:var(--radius-sm);">${escapeHtml(msg)}</div>`;
    listEl.innerHTML = errHtml;
    if (activeEl) activeEl.innerHTML = errHtml;
    return;
  }

  deviceListCache = res.all || res.devices || [];
  const pending = res.devices || [];

  if (pending.length === 0) {
    listEl.innerHTML = `
      <div class="device-empty-hint" id="pendingDevicesEmpty" style="padding:20px 16px; text-align:center; font-size:14px; color:var(--color-muted); background:var(--color-surface-subtle); border-radius:var(--radius-sm);">
        暂无待审批的设备申请
      </div>
    `;
  } else {
    listEl.innerHTML = pending.map(d => `
      <div class="device-item-card" data-device-id="${escapeForAttr(d.id)}" style="padding:12px 14px; background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="min-width:0;">
            <div style="font-weight:600; font-size:14px; color:var(--color-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(d.name || '待授权新设备')}</div>
            <div style="font-size:12px; color:var(--color-muted); margin-top:2px;">状态：${escapeHtml(deviceStatusLabel(d.status))} · 申请于 ${escapeHtml(String(d.created_at || '刚刚'))}</div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="h5-btn-primary" style="height:32px; padding:0 12px; font-size:12px; width:auto;" onclick="approvePendingDevice('${safeInlineArg(d.id)}')">批准</button>
            <button class="h5-btn-secondary" style="height:32px; padding:0 12px; font-size:12px; width:auto; color:var(--color-danger);" onclick="denyPendingDevice('${safeInlineArg(d.id)}')">拒绝</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  if (!activeEl) return;

  const others = deviceListCache.filter(d => d.status !== 'pending');
  if (others.length === 0) {
    activeEl.innerHTML = `
      <div class="device-empty-hint" id="activeDevicesEmpty" style="padding:20px 16px; text-align:center; font-size:14px; color:var(--color-muted); background:var(--color-surface-subtle); border-radius:var(--radius-sm);">
        暂无已授权设备记录
      </div>
    `;
    return;
  }

  activeEl.innerHTML = others.map(d => `
    <div class="device-item-card" data-device-id="${escapeForAttr(d.id)}" style="padding:12px 14px; background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="min-width:0;">
          <div style="font-weight:600; font-size:14px; color:var(--color-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(d.name || '未命名设备')}${d.current ? ' · 当前设备' : ''}
          </div>
          <div style="font-size:12px; color:var(--color-muted); margin-top:2px;">状态：${escapeHtml(deviceStatusLabel(d.status))}</div>
        </div>
        ${(d.status === 'active' || d.status === 'denied') && !d.current ? `
          <button class="h5-btn-secondary" style="height:32px; padding:0 12px; font-size:12px; width:auto; color:var(--color-danger); flex-shrink:0;" onclick="revokePendingDevice('${safeInlineArg(d.id)}')">撤销授权</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function getActiveDeviceId(preferStatus) {
  const focused = document.activeElement && document.activeElement.closest
    ? document.activeElement.closest('[data-device-id]')
    : null;
  if (focused && focused.dataset.deviceId) return focused.dataset.deviceId;

  if (preferStatus) {
    const match = deviceListCache.find(d => d.status === preferStatus);
    if (match) return match.id;
  }

  const first = document.querySelector('#pendingDevicesList [data-device-id]')
    || document.querySelector('#activeDevicesList [data-device-id]');
  if (first && first.dataset.deviceId) return first.dataset.deviceId;

  const pending = deviceListCache.find(d => d.status === 'pending');
  return pending ? pending.id : '';
}

async function approvePendingDevice(deviceId) {
  const id = deviceId || getActiveDeviceId('pending');
  if (!id) {
    showToast('没有可批准的设备，请先刷新列表');
    return;
  }

  const input = document.getElementById('pairingCodeInput');
  const code = input ? input.value.trim() : '';
  if (!code) {
    showToast('请输入该设备的配对核对码');
    if (input) input.focus({ preventScroll: true });
    return;
  }

  const res = await window.galleryApi.approveDevice(id, code);
  if (res && res.success) {
    showToast('设备授权已批准');
    if (input) input.value = '';
    await refreshPendingDevices();
    await renderDeviceStatus();
  } else {
    showToast(res && res.message ? `批准失败：${res.message}` : '批准失败');
  }
}

async function denyPendingDevice(deviceId) {
  const id = deviceId || getActiveDeviceId('pending');
  if (!id) {
    showToast('没有可拒绝的设备，请先刷新列表');
    return;
  }
  const ok = await showAppConfirm({
    title: '拒绝设备授权',
    message: '确定要拒绝该设备的授权申请吗？',
    confirmText: '确认拒绝',
    isDanger: true,
    icon: '🛡️'
  });
  if (!ok) return;

  const res = await window.galleryApi.denyDevice(id);
  if (res && res.success) {
    showToast('已拒绝该设备授权申请');
    await refreshPendingDevices();
  } else {
    showToast(res && res.message ? `拒绝失败：${res.message}` : '拒绝失败');
  }
}

async function revokePendingDevice(deviceId) {
  const id = deviceId || getActiveDeviceId('active');
  if (!id) {
    showToast('没有可撤销的设备，请先刷新列表');
    return;
  }
  const ok = await showAppConfirm({
    title: '撤销设备授权',
    message: '确定要撤销该设备的授权吗？撤销后该设备将立即失去访问权限。',
    confirmText: '确认撤销',
    isDanger: true,
    icon: '⚠️'
  });
  if (!ok) return;

  const res = await window.galleryApi.revokeDevice(id);
  if (res && res.success) {
    showToast('已撤销该设备授权');
    await refreshPendingDevices();
    await renderDeviceStatus();
  } else {
    showToast(res && res.message ? `撤销失败：${res.message}` : '撤销失败');
  }
}

// 兼容 index.html 中已有的按钮绑定名称
async function handleApproveDeviceByCode() {
  return approvePendingDevice('');
}

async function handleRejectDeviceAction() {
  return denyPendingDevice('');
}

async function handleRevokeDeviceAction() {
  return revokePendingDevice('');
}

/* ==========================================================================
   13. 拾光 · 生活助手 (画廊里的生活助手规范)
   ========================================================================== */
function openAgentDialog() {
  const page = document.getElementById('agentFullscreenPage');
  if (page) {
    page.classList.add('active');
    setTimeout(() => {
      const scroll = document.getElementById('agentChatScroll');
      if (scroll && agentChatHistory.length > 0) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    }, 100);
  }
}

function closeAgentDialog() {
  const page = document.getElementById('agentFullscreenPage');
  if (page) page.classList.remove('active');
}

function openAgentMemorySheet() {
  const sheet = document.getElementById('agentMemorySheetOverlay');
  if (sheet) sheet.classList.add('active');
}

function closeAgentMemorySheet() {
  const sheet = document.getElementById('agentMemorySheetOverlay');
  if (sheet) sheet.classList.remove('active');
}

function handleTextareaInput(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  const sendBtn = document.getElementById('agentSendBtn');
  if (sendBtn) {
    sendBtn.disabled = !textarea.value.trim();
  }
}

function handleSuggestChoice(topic) {
  executeAgentChat(topic);
}

async function handleAgentSend() {
  const textarea = document.getElementById('agentInputText');
  if (!textarea) return;
  const message = textarea.value.trim();
  if (!message) return;

  textarea.value = '';
  textarea.style.height = '44px';
  const sendBtn = document.getElementById('agentSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  await executeAgentChat(message);
}

function scrollToBottomChat() {
  const scroll = document.getElementById('agentChatScroll');
  if (scroll) {
    scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
  }
  const pill = document.getElementById('shiguangNewMsgPill');
  if (pill) pill.classList.remove('show');
}

async function executeAgentChat(userText) {
  const scroll = document.getElementById('agentChatScroll');
  const turnsContainer = document.getElementById('shiguangTurnsContainer');
  if (!scroll || !turnsContainer) return;

  // 开始对话后，仅推荐入口与说明标签退出正文，保留开场宋体短标题作为展厅序言
  const recommends = document.getElementById('shiguangRecommendsList');
  if (recommends) recommends.style.display = 'none';
  const introTag = document.getElementById('shiguangIntroTag');
  if (introTag) introTag.style.display = 'none';
  const welcomeSub = document.querySelector('.shiguang-welcome-sub');
  if (welcomeSub) welcomeSub.style.marginBottom = '16px';

  // 1. 追加用户消息 (右对齐，中性浅底，圆角 8px，最大宽度约 85%)
  const userTurn = document.createElement('div');
  userTurn.className = 'shiguang-turn user-turn';
  userTurn.innerHTML = `
    <div class="shiguang-user-bubble">${escapeHtml(userText)}</div>
  `;
  turnsContainer.appendChild(userTurn);

  const wasNearBottom = (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight) < 140;
  scroll.scrollTop = scroll.scrollHeight;

  // 2. 追加加载中占位行 (正在整理……)
  const loadingTurn = document.createElement('div');
  loadingTurn.className = 'shiguang-turn assistant-turn';
  loadingTurn.id = 'shiguangLoadingTurn';
  loadingTurn.innerHTML = `
    <div class="shiguang-role-label">拾光</div>
    <div class="shiguang-assistant-body" style="color:var(--color-muted);">正在整理……</div>
  `;
  turnsContainer.appendChild(loadingTurn);
  scroll.scrollTop = scroll.scrollHeight;

  agentChatHistory.push({ role: 'user', content: userText });

  // 3. 请求 API 或本地引擎
  let res = null;
  try {
    res = await window.galleryApi.sendAgentChat(userText, agentChatHistory);
  } catch (err) {
    res = { success: false };
  }

  // 4. 移除加载占位
  const placeholder = document.getElementById('shiguangLoadingTurn');
  if (placeholder) placeholder.remove();

  // 5. 错误处理 (请求失败保留输入或提供重试)
  if (!res || !res.success || !res.reply) {
    const errorTurn = document.createElement('div');
    errorTurn.className = 'shiguang-turn assistant-turn';

    const roleLabel = document.createElement('div');
    roleLabel.className = 'shiguang-role-label';
    roleLabel.textContent = '拾光';
    errorTurn.appendChild(roleLabel);

    const errorBody = document.createElement('div');
    errorBody.className = 'shiguang-assistant-body';
    errorBody.style.color = 'var(--color-muted)';
    errorBody.textContent = '暂时没能回复，请重试。';
    errorTurn.appendChild(errorBody);

    const actionBar = document.createElement('div');
    actionBar.className = 'shiguang-action-bar';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'shiguang-action-btn';
    retryBtn.textContent = '重新发送';
    retryBtn.addEventListener('click', () => retryAgentChat(userText));
    actionBar.appendChild(retryBtn);
    errorTurn.appendChild(actionBar);

    turnsContainer.appendChild(errorTurn);
    scroll.scrollTop = scroll.scrollHeight;
    return;
  }

  const replyText = res.reply;
  agentChatHistory.push({ role: 'assistant', content: replyText });

  // 6. 拾光回复呈现 (左对齐开放正文，上方小字「拾光」，无头像、无边框、无背景卡片)
  const assistantTurn = document.createElement('div');
  assistantTurn.className = 'shiguang-turn assistant-turn';

  const roleLabel = document.createElement('div');
  roleLabel.className = 'shiguang-role-label';
  roleLabel.textContent = '拾光';
  assistantTurn.appendChild(roleLabel);

  const assistantBody = document.createElement('div');
  assistantBody.className = 'shiguang-assistant-body';
  const textBody = document.createElement('div');
  if (window.ShiguangMarkdown) {
    window.ShiguangMarkdown.render(textBody, replyText);
  } else {
    textBody.textContent = replyText;
    textBody.style.whiteSpace = 'pre-wrap';
  }
  assistantBody.appendChild(textBody);
  if (res.isExample) {
    const exampleLabel = document.createElement('div');
    exampleLabel.style.cssText = 'font-size:12px; color:var(--color-muted); margin-top:8px;';
    exampleLabel.textContent = '[示例回复]';
    assistantBody.appendChild(exampleLabel);
  }

  // 照片或回忆展签结果 (突出照片与日期，闭包绑定事件杜绝 XSS 注入)
  if (res.memoryRef) {
    const mem = res.memoryRef;
    const thumbUrl = mem.thumb || mem.url || '';
    const isRealImg = typeof thumbUrl === 'string' && (thumbUrl.includes('/') || /\.(jpg|jpeg|png|webp|gif)/i.test(thumbUrl));
    const resolvedThumb = isRealImg ? (window.galleryApi?.resolveAssetUrl?.(thumbUrl) || thumbUrl) : '';

    const plaque = document.createElement('div');
    plaque.className = 'shiguang-plaque-ref';
    plaque.addEventListener('click', () => {
      openSinglePhotoViewer(mem.title || '画廊瞬间', mem.date || '', mem.url || mem.thumb || 'sunset');
    });

    const thumbFrame = document.createElement('div');
    thumbFrame.className = 'shiguang-plaque-thumb-frame';
    if (resolvedThumb) {
      const img = document.createElement('img');
      img.src = resolvedThumb;
      img.alt = mem.title || '缩略图';
      img.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:2px;';
      thumbFrame.appendChild(img);
    } else {
      thumbFrame.innerHTML = '<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="200" fill="#d9745b"/><circle cx="80" cy="130" r="35" fill="#f8d07e"/><rect y="150" width="160" height="50" fill="#2d3748"/></svg>';
    }
    plaque.appendChild(thumbFrame);

    const plaqueInfo = document.createElement('div');
    plaqueInfo.className = 'shiguang-plaque-info';

    const plaqueBadge = document.createElement('div');
    plaqueBadge.className = 'shiguang-plaque-badge';
    const dateSpan = document.createElement('span');
    dateSpan.className = 'shiguang-plaque-date-highlight';
    dateSpan.textContent = mem.date || '回忆时光';
    const locSpan = document.createElement('span');
    locSpan.className = 'shiguang-plaque-loc';
    locSpan.textContent = ' · ' + (mem.location || '生活画廊');
    plaqueBadge.appendChild(dateSpan);
    plaqueBadge.appendChild(locSpan);
    plaqueInfo.appendChild(plaqueBadge);

    const titleEl = document.createElement('div');
    titleEl.className = 'shiguang-plaque-title';
    titleEl.textContent = mem.title || '画廊瞬间';
    plaqueInfo.appendChild(titleEl);

    plaque.appendChild(plaqueInfo);

    const actionBox = document.createElement('div');
    actionBox.className = 'shiguang-plaque-action';
    actionBox.innerHTML = '<span>查看</span><span style="font-size:13px;">↗</span>';
    plaque.appendChild(actionBox);

    assistantBody.appendChild(plaque);
  }
  assistantTurn.appendChild(assistantBody);

  // 动作栏：通过闭包绑定，传递完整原始多行文本与结构化草稿
  const actionBar = document.createElement('div');
  actionBar.className = 'shiguang-action-bar';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'shiguang-action-btn';
  copyBtn.textContent = '复制';
  copyBtn.addEventListener('click', () => copyAgentText(replyText));
  actionBar.appendChild(copyBtn);

  const moreBtn = document.createElement('button');
  moreBtn.className = 'shiguang-action-btn';
  moreBtn.textContent = '更多 ···';
  moreBtn.addEventListener('click', () => openAgentActionMenu(replyText, res.draft));
  actionBar.appendChild(moreBtn);

  assistantTurn.appendChild(actionBar);
  turnsContainer.appendChild(assistantTurn);

  // 7. 视口滚动处理 (若用户正在阅读较早内容，不强行拉到底部，展示“查看新回复”)
  if (wasNearBottom) {
    scroll.scrollTop = scroll.scrollHeight;
  } else {
    const pill = document.getElementById('shiguangNewMsgPill');
    if (pill) pill.classList.add('show');
  }
}

function retryAgentChat(text) {
  executeAgentChat(text);
}

function formatParagraphs(text) {
  const parts = text.split('\n');
  let html = '';
  let inList = false;

  for (let line of parts) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += '</ol>';
        inList = false;
      }
      continue;
    }

    const listMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);
    if (listMatch) {
      if (!inList) {
        html += '<ol>';
        inList = true;
      }
      html += `<li>${escapeHtml(listMatch[2])}</li>`;
    } else {
      if (inList) {
        html += '</ol>';
        inList = false;
      }
      html += `<p>${escapeHtml(trimmed)}</p>`;
    }
  }

  if (inList) {
    html += '</ol>';
  }
  return html;
}

// 轻工具操作逻辑
function copyAgentText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      showToast('复制完成');
    });
  } else {
    showToast('已复制到剪贴板');
  }
}

function openAgentActionMenu(text, draft = null) {
  currentActionMenuText = text;
  currentActionMenuDraft = draft;
  const overlay = document.getElementById('agentActionMenuOverlay');
  if (overlay) overlay.classList.add('active');
}

function closeAgentActionMenu() {
  const overlay = document.getElementById('agentActionMenuOverlay');
  if (overlay) overlay.classList.remove('active');
}

function triggerActionMenuWhisper() {
  closeAgentActionMenu();
  let textToUse = currentActionMenuText;
  const draft = currentActionMenuDraft;
  const draftOptions = (draft && draft.type === 'whisper' && Array.isArray(draft.options)) ? draft.options : null;
  if (draftOptions && draftOptions.length > 0) {
    textToUse = draftOptions[0];
  } else if (draft && draft.content) {
    textToUse = draft.content;
  }
  openWhisperDraftModal(textToUse, draftOptions);
}

function triggerActionMenuStory() {
  closeAgentActionMenu();
  let textToUse = currentActionMenuText;
  let titleToUse = '生活点滴记录';
  const draft = currentActionMenuDraft;
  if (draft && draft.type === 'date_plan') {
    titleToUse = draft.title || '周末漫步与寻味提案';
    textToUse = draft.content || textToUse;
  } else if (draft && draft.type === 'whisper' && Array.isArray(draft.options) && draft.options.length > 0) {
    titleToUse = '美好留言摘录';
    textToUse = draft.options[0];
  }
  openStoryDraftModal(textToUse, null, titleToUse);
}

function openWhisperDraftModal(text, options = null) {
  currentDraftText = text;
  const textarea = document.getElementById('whisperDraftText');
  if (textarea) textarea.value = text;

  const optionsContainer = document.getElementById('h5WhisperDraftOptions');
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    if (Array.isArray(options) && options.length > 0) {
      optionsContainer.style.display = 'flex';
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `h5-btn-secondary h5-draft-option-btn ${idx === 0 ? 'active' : ''}`;
        btn.style.cssText = 'text-align:left; padding:8px 12px; font-size:13px; line-height:1.4; border-radius:6px; cursor:pointer; margin-bottom:4px;';
        btn.textContent = `候选 ${idx + 1}：“${opt}”`;
        btn.addEventListener('click', () => {
          optionsContainer.querySelectorAll('.h5-draft-option-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (textarea) textarea.value = opt;
          currentDraftText = opt;
        });
        optionsContainer.appendChild(btn);
      });
    } else {
      optionsContainer.style.display = 'none';
    }
  }

  const overlay = document.getElementById('whisperDraftModalOverlay');
  if (overlay) overlay.classList.add('active');
}

function closeWhisperDraftModal() {
  const optionsContainer = document.getElementById('h5WhisperDraftOptions');
  if (optionsContainer) optionsContainer.style.display = 'none';
  const overlay = document.getElementById('whisperDraftModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

async function confirmSendWhisper() {
  const textarea = document.getElementById('whisperDraftText');
  const content = textarea ? textarea.value.trim() : currentDraftText;
  if (!content) {
    showToast('内容不能为空');
    return;
  }
  closeWhisperDraftModal();
  const res = await window.galleryApi.sendWhisper(content);
  showToast(res.message || '悄悄话已成功发送给对方');
  await refreshLetterBanner();
}

function openStoryDraftModal(text, defaultDate, defaultTitle = '生活点滴记录') {
  currentDraftText = text || '';
  const textarea = document.getElementById('storyDraftContent');
  if (textarea) textarea.value = currentDraftText;
  const titleInput = document.getElementById('storyDraftTitle');
  if (titleInput) titleInput.value = defaultTitle || '生活点滴记录';
  const dateInput = document.getElementById('storyDraftDate');
  if (dateInput) {
    dateInput.value = defaultDate || new Date().toISOString().slice(0, 10);
  }
  const photoInput = document.getElementById('storyDraftPhoto');
  if (photoInput) photoInput.value = '';

  const overlay = document.getElementById('storyDraftModalOverlay');
  if (overlay) overlay.classList.add('active');
}

function closeStoryDraftModal() {
  const overlay = document.getElementById('storyDraftModalOverlay');
  if (overlay) overlay.classList.remove('active');
  const photoInput = document.getElementById('storyDraftPhoto');
  if (photoInput) photoInput.value = '';
}

async function confirmSaveStory() {
  const titleInput = document.getElementById('storyDraftTitle');
  const contentInput = document.getElementById('storyDraftContent');
  const dateInput = document.getElementById('storyDraftDate');
  const photoInput = document.getElementById('storyDraftPhoto');

  const title = titleInput ? titleInput.value.trim() : '生活点滴记录';
  const content = contentInput ? contentInput.value.trim() : currentDraftText;
  const date = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().slice(0, 10);
  const photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

  if (!content && !photoFile) {
    showToast('请写点内容或选择一张照片');
    return;
  }

  closeStoryDraftModal();
  showToast('正在保存故事节点...');
  const res = await window.galleryApi.createStoryEvent({
    title: title || '生活故事',
    content,
    date,
    photoFile
  });

  if (res && res.success) {
    showToast(res.message || `已成功记入故事时间线「${title || '生活故事'}」`);
    await renderStoryTimeline();
  } else {
    showToast(res?.message || '保存故事失败');
  }
}

/* ==========================================================================
   14. 页面底部面板与操作抽屉
   ========================================================================== */
function openRecordSheet() {
  const overlay = document.getElementById('recordSheetOverlay');
  if (overlay) overlay.classList.add('active');
}

function closeRecordSheet() {
  const overlay = document.getElementById('recordSheetOverlay');
  if (overlay) overlay.classList.remove('active');
}

function closeSheetOnBg(e, overlayId) {
  if (e.target && e.target.id === overlayId) {
    document.getElementById(overlayId).classList.remove('active');
  }
}

function triggerNativeUpload() {
  closeRecordSheet();
  const input = document.getElementById('h5RealFileInput');
  if (input) input.click();
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// 严格区分 HTML 属性值转义与 JavaScript 字符串转义
function escapeForAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsString(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

// 内联事件处理器中写入数据的唯一允许写法（模板里形如 onclick 属性内拼字符串）。
// 同时做 JS 字符串转义（防止提前闭合单引号）与 HTML 属性转义（防止提前闭合双引号），
// 且转义后的值在运行时仍还原为原始字符串。
function safeInlineArg(value) {
  return escapeForAttr(escapeJsString(value));
}

/* ==========================================================================
   15. 全局挂载以便 HTML 内联事件调用
   ========================================================================== */
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
window.nextViewerPhoto = nextViewerPhoto;
window.prevViewerPhoto = prevViewerPhoto;
window.openSinglePhotoViewer = openSinglePhotoViewer;
window.openStoryPhotoByEventIndex = function(eventIdx, photoIdx) {
  const item = (window.__currentTimelineEvents || [])[eventIdx];
  if (!item || !item.photos) return;
  const p = item.photos[photoIdx];
  const pUrl = typeof p === 'string' ? p : (p.url || p.path || p.thumbnail_path || '');
  openSinglePhotoViewer(item.title || '故事配图', item.date || '', pUrl || 'sunset');
};
window.openPhotoViewerFromList = openPhotoViewerFromList;

window.openUploadPage = openUploadPage;
window.closeUploadPage = closeUploadPage;
window.startUploadProcess = startUploadProcess;
window.triggerNativeUpload = triggerNativeUpload;

window.handleTaskAction = handleTaskAction;
window.handleExchangeClick = handleExchangeClick;

window.openSecretSpace = openSecretSpace;
window.closeSecretSpace = closeSecretSpace;
window.lockSecretSpace = lockSecretSpace;
window.pressSecretKey = pressSecretKey;
window.deleteSecretKey = deleteSecretKey;
window.showPrivateNoteDetail = showPrivateNoteDetail;
window.showPrivateNoteDetailById = showPrivateNoteDetailById;
window.openExchangeConfirmModalById = openExchangeConfirmModalById;

window.openStoryPage = openStoryPage;
window.closeStoryPage = closeStoryPage;
window.openDevicePage = openDevicePage;
window.closeDevicePage = closeDevicePage;

window.openLetterModal = openLetterModal;
window.closeLetterModal = closeLetterModal;
window.handleLetterReadDone = handleLetterReadDone;
window.archiveLetterAction = archiveLetterAction;

window.openRecordSheet = openRecordSheet;
window.closeRecordSheet = closeRecordSheet;
window.closeSheetOnBg = closeSheetOnBg;

window.openAgentDialog = openAgentDialog;
window.closeAgentDialog = closeAgentDialog;
window.openAgentMemorySheet = openAgentMemorySheet;
window.closeAgentMemorySheet = closeAgentMemorySheet;
window.handleAgentSend = handleAgentSend;
window.handleSuggestChoice = handleSuggestChoice;
window.handleTextareaInput = handleTextareaInput;
window.scrollToBottomChat = scrollToBottomChat;
window.retryAgentChat = retryAgentChat;
window.copyAgentText = copyAgentText;
window.openAgentActionMenu = openAgentActionMenu;
window.closeAgentActionMenu = closeAgentActionMenu;
window.triggerActionMenuWhisper = triggerActionMenuWhisper;
window.triggerActionMenuStory = triggerActionMenuStory;
window.openWhisperDraftModal = openWhisperDraftModal;
window.closeWhisperDraftModal = closeWhisperDraftModal;
window.confirmSendWhisper = confirmSendWhisper;
window.openStoryDraftModal = openStoryDraftModal;
window.closeStoryDraftModal = closeStoryDraftModal;
window.confirmSaveStory = confirmSaveStory;

window.selectAlbumFolder = selectAlbumFolder;
window.selectAlbumTag = selectAlbumTag;

window.openCreateFolderDialog = openCreateFolderDialog;
window.closeCreateFolderDialog = closeCreateFolderDialog;
window.confirmCreateFolder = confirmCreateFolder;
window.openRenameFolderDialog = openRenameFolderDialog;
window.closeRenameFolderDialog = closeRenameFolderDialog;
window.confirmRenameFolder = confirmRenameFolder;
window.confirmDeleteCurrentFolder = confirmDeleteCurrentFolder;

window.deleteCurrentViewerPhoto = deleteCurrentViewerPhoto;
window.openMovePhotoDialog = openMovePhotoDialog;
window.closeMovePhotoDialog = closeMovePhotoDialog;
window.confirmMovePhoto = confirmMovePhoto;
window.handleViewerZoneClick = handleViewerZoneClick;

window.removePendingUploadItem = removePendingUploadItem;
window.retryFailedUploads = retryFailedUploads;

// 私密空间与信件扩展 (规范 10.6)
window.openWriteLetterModal = openWriteLetterModal;
window.closeWriteLetterModal = closeWriteLetterModal;
window.submitDirectLetter = submitDirectLetter;
window.showNextWhisper = showNextWhisper;
window.toggleSecretAuthMode = toggleSecretAuthMode;
window.submitSecretTextPassword = submitSecretTextPassword;
window.switchSecretContentTab = switchSecretContentTab;
window.openCreateNoteModal = openCreateNoteModal;
window.closeCreateNoteModal = closeCreateNoteModal;
window.confirmSaveNote = confirmSaveNote;
window.deletePrivateNoteAction = deletePrivateNoteAction;
window.closeNoteDetailModal = closeNoteDetailModal;
window.handleSecretFileUpload = handleSecretFileUpload;
window.deletePrivateFileAction = deletePrivateFileAction;

// 账号会话、头像、文案与设备管理（task-8）
window.renderCoupleAvatars = renderCoupleAvatars;
window.triggerAvatarUpload = triggerAvatarUpload;
window.handleAvatarFileChange = handleAvatarFileChange;
window.handleChangeDailyQuote = handleChangeDailyQuote;
window.gotoLogin = gotoLogin;
window.handleH5Logout = handleH5Logout;
window.openDeviceManagementModal = openDeviceManagementModal;
window.closeDeviceManagementModal = closeDeviceManagementModal;
window.refreshPendingDevices = refreshPendingDevices;
window.approvePendingDevice = approvePendingDevice;
window.denyPendingDevice = denyPendingDevice;
window.revokePendingDevice = revokePendingDevice;
window.handleApproveDeviceByCode = handleApproveDeviceByCode;
window.handleRejectDeviceAction = handleRejectDeviceAction;
window.handleRevokeDeviceAction = handleRevokeDeviceAction;
