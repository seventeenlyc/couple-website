/**
 * 我们之间 · 桌面生活画廊 核心业务驱动层 (Desktop Gallery App)
 * 深度对接 Fastify + SQLite 真实后端 API (与移动端 100% 对齐)
 * 覆盖移动端全部 10 大核心功能模块，全功能无缝迁移至桌面端
 */

(function () {
  'use strict';

  // 确保 API 客户端实例存在
  const api = window.galleryApi || new GalleryApiClient();
  window.galleryApi = api;

  // 全局响应式状态
  const state = {
    user: null,
    isLoggedIn: false,

    // 照片与相册
    photos: [],
    folders: [],
    currentFolder: '',
    selectedTag: '全部',
    selectedPhotos: new Set(),
    isManageMode: false,
    renamingFolderPath: '',

    // 主页封面与多图轮播
    heroPhotos: [],
    heroCarouselIndex: 0,
    heroTimer: null,
    pickerAvailablePhotos: [],
    pickerSelectedIds: new Set(),

    // 全屏大图查看器
    viewerPhotoList: [],
    currentViewerIndex: 0,
    viewerTriggerEl: null,
    pendingMovingPhoto: null,

    // 上传队列
    uploadQueue: [],

    // 心愿与任务
    tasks: [],
    taskFilter: 'pending', // 'pending' | 'confirming' | 'done'
    wishesPollTimer: null,
    points: 520,

    // 礼物小铺与背包
    shopItems: [],
    currentShopCategory: 'all', // 'all' | 'coupon' | 'gift'
    pendingExchangeItem: null,
    bagPendingItems: [],
    bagMyItems: [],

    // 私密空间
    pinCode: '',
    privateUnlocked: false,
    privateTab: 'notes', // 'notes' | 'files'
    privateNotes: [],
    privateFiles: [],
    privateAuthReqVersion: 0,

    // 设备安全
    pendingDevices: [],
    activeDevices: [],
    deviceListCache: [],

    // 来信与悄悄话
    allWhispersList: [],
    currentWhisperIndex: 0,
    currentOpenWhisperId: null,

    // 故事时间线
    currentDraftText: '',

    // 拾光 AI 助手
    agentChatHistory: [],
    currentActionMenuText: '',
    currentActionMenuDraft: null
  };

  /* ==========================================================================
     0. 防 XSS 工具与轻量级提示系统
     ========================================================================== */
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

  function showToast(message) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.className = 'desktop-toast';
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  /* 专属温润主题应用弹窗 (替代浏览器原生 alert / confirm) */
  function showAppConfirm(options = {}) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('appDialogOverlay');
      const titleEl = document.getElementById('appDialogTitle');
      const msgEl = document.getElementById('appDialogMessage');
      const btnConfirm = document.getElementById('appDialogConfirmBtn');
      const btnCancel = document.getElementById('appDialogCancelBtn');

      titleEl.textContent = options.title || '请确认操作';
      msgEl.innerHTML = options.message || '';
      btnConfirm.textContent = options.confirmText || '确定';
      btnCancel.textContent = options.cancelText || '取消';

      if (options.isDanger) {
        btnConfirm.style.background = 'var(--color-danger)';
      } else {
        btnConfirm.style.background = 'var(--color-accent)';
      }

      if (options.hideCancel) {
        btnCancel.style.display = 'none';
      } else {
        btnCancel.style.display = 'inline-flex';
      }

      function cleanUp() {
        overlay.classList.remove('active');
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
      }

      function onConfirm() {
        cleanUp();
        resolve(true);
      }

      function onCancel() {
        cleanUp();
        resolve(false);
      }

      function onKey(e) {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter') onConfirm();
      }

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
      overlay.classList.add('active');
    });
  }

  function showAppAlert(title, message) {
    return showAppConfirm({ title, message, confirmText: '知道了', hideCancel: true });
  }

  /* ==========================================================================
     1. 初始化与页面全局导航
     ========================================================================== */
  async function initApp() {
    setupHeaderNavigation();
    setupRecordMenu();
    await checkUserSession();
    await loadInitialData();
  }

  function setupHeaderNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.getAttribute('data-page');
        switchPage(page);
      });
    });
  }

  function switchPage(pageName) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const targetView = document.getElementById(`view-${pageName}`);
    if (targetView) targetView.classList.add('active');

    const targetNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (targetNav) targetNav.classList.add('active');

    const stdHeader = document.getElementById('standardHeaderBar');
    const editorHeader = document.getElementById('editorHeaderBar');
    if (pageName === 'upload') {
      stdHeader.style.display = 'none';
      editorHeader.style.display = 'flex';
      populateUploadFolders();
    } else {
      stdHeader.style.display = 'flex';
      editorHeader.style.display = 'none';
    }

    if (pageName === 'wishes') {
      loadShopProducts();
      loadTasksAndPoints();
      updateBackpackBadge();
      startWishesPolling();
    } else {
      stopWishesPolling();
    }

    if (pageName === 'private') {
      enterPrivateSpace();
    } else {
      // 离开私密空间页面时，废弃任何在途的校验或加载请求
      state.privateAuthReqVersion = (state.privateAuthReqVersion || 0) + 1;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupRecordMenu() {
    const btn = document.getElementById('btnRecord');
    const menu = document.getElementById('recordMenu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }

  async function checkUserSession() {
    const session = await api.checkSession();
    state.isLoggedIn = session.loggedIn;
    state.user = session.user;

    const banner = document.getElementById('sessionBanner');
    if (!state.isLoggedIn) {
      banner.style.display = 'flex';
      const link = document.getElementById('sessionLoginLink');
      if (link) {
        link.href = 'login.html';
      }
    } else {
      banner.style.display = 'none';
    }
  }

  function fillModalDefaultAccount() {
    const you = document.getElementById('modalLoginYou');
    const baby = document.getElementById('modalLoginBaby');
    const pwd = document.getElementById('modalLoginPassword');
    if (you) you.value = 'name1';
    if (baby) baby.value = 'name2';
    if (pwd) pwd.value = 'change-this-login-password';
    showToast('已填入预设账号与密码');
  }

  function openLoginModal() {
    const modal = document.getElementById('desktopLoginModalOverlay');
    if (!modal) {
      window.location.href = 'login.html';
      return;
    }
    const youInput = document.getElementById('modalLoginYou');
    const babyInput = document.getElementById('modalLoginBaby');
    const pwdInput = document.getElementById('modalLoginPassword');
    if (youInput) youInput.value = '';
    if (babyInput) babyInput.value = '';
    if (pwdInput) pwdInput.value = '';
    modal.classList.add('active');
    setTimeout(() => youInput && youInput.focus(), 150);
  }

  function closeLoginModal() {
    const modal = document.getElementById('desktopLoginModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  async function handleDesktopLogin() {
    const you = (document.getElementById('modalLoginYou')?.value || '').trim();
    const baby = (document.getElementById('modalLoginBaby')?.value || '').trim();
    const password = document.getElementById('modalLoginPassword')?.value || '';
    const btn = document.getElementById('modalLoginSubmitBtn');

    if (!you || !baby) {
      showToast('请输入你和对方的名字');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = '正在验证身份...';
    }

    const res = await api.login(you, baby, password);
    if (btn) {
      btn.disabled = false;
      btn.innerText = '立即登录';
    }

    if (res && res.success) {
      showToast('✨ 登录成功，欢迎回家！');
      closeLoginModal();
      await checkUserSession();
      await loadInitialData();
    } else {
      if (res && res.device_pending) {
        window.location.href = '/device-access.php';
      } else {
        showToast(res?.message || '登录失败，请检查名字或密码');
      }
    }
  }

  async function loadInitialData() {
    await Promise.all([
      loadAppConfig(),
      loadDailyQuote(),
      loadDailyPhotosAndHero(),
      loadPhotosAndFolders(),
      initCheckin(),
      loadTasksAndPoints(),
      loadShopProducts(),
      loadRemindersAndStory(),
      refreshLetterBanner(),
      updateBackpackBadge()
    ]);
  }

  /* ==========================================================================
     2. 资料、相伴天数与头像真实上传更换
     ========================================================================== */
  async function loadAppConfig() {
    const config = await api.getAppConfig();
    const daysEl = document.getElementById('coupleDaysText');
    const heroDaysEl = document.getElementById('heroDaysTag');
    if (daysEl && config && config.love_days) {
      daysEl.textContent = `相伴第 ${config.love_days} 天 · 始于 ${config.startDate || '2025.04.30'}`;
    }
    if (heroDaysEl && config && config.love_days) {
      heroDaysEl.textContent = `相伴第 ${config.love_days} 天`;
    }

    if (config && Array.isArray(config.avatars)) {
      renderCoupleAvatars(config.avatars);
    }
  }

  function renderCoupleAvatars(avatars) {
    const boy = avatars.find(a => a.side === 'left' || a.username === '拾柒' || a.user_id === 'u_boy');
    const girl = avatars.find(a => a.side === 'right' || a.username === '小鹿' || a.user_id === 'u_girl');
    if (boy && boy.avatar) {
      document.getElementById('usBoyAvatarImg').src = api.resolveAssetUrl(boy.avatar);
    }
    if (girl && girl.avatar) {
      document.getElementById('usGirlAvatarImg').src = api.resolveAssetUrl(girl.avatar);
    }
  }

  async function handleAvatarUpload(side, fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    showToast('正在上传并同步头像...');
    const res = await api.uploadAvatar(side, file);
    if (res && res.success) {
      const imgId = side === 'left' ? 'usBoyAvatarImg' : 'usGirlAvatarImg';
      const resolved = api.resolveAssetUrl(res.avatar_url || res.url);
      document.getElementById(imgId).src = resolved;
      showToast('头像更换成功 ✨');
    } else {
      showAppAlert('上传失败', res?.message || '头像上传出现异常，请稍后重试。');
    }
    fileInput.value = '';
  }

  /* ==========================================================================
     3. 日常文案诚实轮换
     ========================================================================== */
  const fallbackQuotes = [
    '在平常的日子里，慢慢收集我们之间闪闪发光的瞬间。',
    '晚风吹过街道，和你牵手走过的每一步都很安心。',
    '生活很匆忙，但只要看着你，时间就会慢下来。',
    '世间风景千千万，都不及你望向我时眼里的光。',
    '今日份的甜，藏在下班后见面的那一记拥抱里。'
  ];
  let quoteIndex = 0;

  async function loadDailyQuote() {
    const quote = await api.getDailyQuote();
    const textEl = document.getElementById('dailyQuoteText');
    if (quote && typeof quote === 'string') {
      textEl.textContent = `“${quote}”`;
    } else {
      textEl.textContent = `“${fallbackQuotes[0]}”`;
    }
  }

  async function handleRefreshDailyQuote() {
    const textEl = document.getElementById('dailyQuoteText');
    const currentClean = textEl.textContent.replace(/[“”]/g, '').trim();
    const serverQuote = await api.getDailyQuote();

    if (serverQuote && typeof serverQuote === 'string') {
      if (serverQuote.trim() === currentClean) {
        showToast('今日文案已是最新内容');
      } else {
        textEl.textContent = `“${serverQuote}”`;
        showToast('已更新今日灵感 ✨');
      }
      return;
    }

    // 本地轮换
    quoteIndex = (quoteIndex + 1) % fallbackQuotes.length;
    textEl.textContent = `“${fallbackQuotes[quoteIndex]}”`;
    showToast('已切换至本地精选生活随笔');
  }

  /* ==========================================================================
     4. 主页封面与多图轮播 (Carousel & Cover Selector & 日常片段动态流)
     ========================================================================== */
  async function loadDailyPhotosAndHero() {
    const photos = await api.getPhotos('');
    state.dailyPhotos = photos || [];
    setupHeroCarousel(state.dailyPhotos);
    renderDailyPhotoPair();
  }

  function renderDailyPhotoPair() {
    const grid = document.getElementById('dailyPairPhotoGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const list = (state.dailyPhotos && state.dailyPhotos.length > 0) ? state.dailyPhotos.slice(0, 2) : [];
    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 36px 20px; text-align: center; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-sm);">
          <p style="font-size: 15px; color: var(--color-muted); margin-bottom: 12px;">相册暂无日常生活瞬间</p>
          <button class="btn-record" style="height: 36px; padding: 0 16px; font-size: 13px;" onclick="switchPage('upload')">＋ 记录第一张生活照片</button>
        </div>
      `;
      return;
    }

    list.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = 'pair-photo-card';
      const imgUrl = api.resolveAssetUrl(photo.thumbUrl || photo.url || photo.thumbnail_path || photo.path || '../assets/images/products/film.jpg');
      card.innerHTML = `
        <div class="pair-photo-box">
          <img src="${escapeForAttr(imgUrl)}" alt="${escapeForAttr(photo.title || '日常照片')}" onerror="this.src='../assets/images/products/film.jpg'">
        </div>
        <div style="padding:10px 14px; font-size:14px; font-weight:500;">${escapeHtml(photo.title || '日常瞬间')} · <span style="font-size:12px; color:var(--color-muted);">${escapeHtml(photo.date || '日常')}</span></div>
      `;
      card.onclick = () => openDailyImageViewer(idx);
      grid.appendChild(card);
    });
  }

  function openDailyImageViewer(index) {
    if (!state.dailyPhotos || state.dailyPhotos.length === 0) return;
    state.viewerPhotoList = state.dailyPhotos;
    state.currentViewerIndex = index;
    state.viewerTriggerEl = document.activeElement;
    openImageViewer();
  }

  function setupHeroCarousel(photos) {
    stopHeroAutoPlay();

    if (!photos || photos.length === 0) {
      state.heroPhotos = [];
      state.heroCarouselIndex = 0;
      const imgEl = document.getElementById('heroCoverImg');
      const titleEl = document.getElementById('heroCoverTitle');
      const metaEl = document.getElementById('heroCoverMeta');
      const dotsWrap = document.getElementById('heroCarouselDots');
      if (imgEl) imgEl.src = '../assets/images/products/hug.png';
      if (titleEl) titleEl.textContent = '暂无封面照片 · 点击更换封面';
      if (metaEl) metaEl.textContent = '快去相册上传属于你们的第一张照片吧 ✨';
      if (dotsWrap) {
        dotsWrap.innerHTML = '';
        dotsWrap.style.display = 'none';
      }
      return;
    }

    let savedIds = [];
    try {
      const stored = localStorage.getItem('couple_desktop_hero_photo_ids') ||
                     localStorage.getItem('couple_h5_hero_carousel_ids') ||
                     localStorage.getItem('couple_h5_hero_photo_id');
      if (stored) {
        savedIds = stored.startsWith('[') ? JSON.parse(stored) : [stored];
      }
    } catch (_) {}

    let matched = photos.filter(p => savedIds.includes(String(p.id)));
    if (matched.length === 0) {
      matched = photos.slice(0, 3);
    }
    state.heroPhotos = matched;
    state.heroCarouselIndex = 0;

    renderHeroSlide();
    startHeroAutoPlay();
  }

  function renderHeroSlide() {
    if (state.heroPhotos.length === 0) return;
    const current = state.heroPhotos[state.heroCarouselIndex];
    if (!current) return;

    const imgEl = document.getElementById('heroCoverImg');
    const titleEl = document.getElementById('heroCoverTitle');
    const metaEl = document.getElementById('heroCoverMeta');
    const dotsWrap = document.getElementById('heroCarouselDots');

    const photoUrl = current.url || current.thumb_url || current.thumbnail || '';
    imgEl.src = api.resolveAssetUrl(photoUrl);
    titleEl.textContent = current.title || current.name || '海边落日余晖';
    metaEl.textContent = `${current.date || '2026.09.28'} · ${current.folder || '生活相册'}`;

    dotsWrap.innerHTML = '';
    if (state.heroPhotos.length > 1) {
      state.heroPhotos.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${idx === state.heroCarouselIndex ? 'active' : ''}`;
        dot.onclick = (e) => {
          e.stopPropagation();
          state.heroCarouselIndex = idx;
          renderHeroSlide();
          resetHeroAutoPlay();
        };
        dotsWrap.appendChild(dot);
      });
      dotsWrap.style.display = 'flex';
    } else {
      dotsWrap.style.display = 'none';
    }
  }

  function stopHeroAutoPlay() {
    if (state.heroTimer) {
      clearInterval(state.heroTimer);
      state.heroTimer = null;
    }
  }

  function startHeroAutoPlay() {
    stopHeroAutoPlay();
    if (state.heroPhotos.length <= 1) return;
    state.heroTimer = setInterval(() => {
      state.heroCarouselIndex = (state.heroCarouselIndex + 1) % state.heroPhotos.length;
      renderHeroSlide();
    }, 4500);
  }

  function resetHeroAutoPlay() {
    stopHeroAutoPlay();
    startHeroAutoPlay();
  }

  function openHeroChangeMenu() {
    document.getElementById('heroChangeSheetModal').classList.add('active');
  }

  function closeHeroChangeMenu() {
    document.getElementById('heroChangeSheetModal').classList.remove('active');
  }

  async function openHeroPhotoPicker() {
    closeHeroChangeMenu();
    const modal = document.getElementById('heroPickerModal');
    const grid = document.getElementById('heroPickerGrid');
    modal.classList.add('active');

    grid.innerHTML = '<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--color-muted);">加载相册照片中...</div>';
    const photos = await api.getPhotos();

    if (!photos || photos.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--color-muted);">相册暂无照片，请先上传</div>';
      return;
    }

    state.pickerAvailablePhotos = photos;
    state.pickerSelectedIds.clear();

    try {
      const stored = localStorage.getItem('couple_desktop_hero_photo_ids') || localStorage.getItem('couple_h5_hero_carousel_ids');
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) ids.forEach(id => state.pickerSelectedIds.add(String(id)));
      }
      if (state.pickerSelectedIds.size === 0) {
        const single = localStorage.getItem('couple_h5_hero_photo_id') || state.heroPhotos[0]?.id;
        if (single) state.pickerSelectedIds.add(String(single));
      }
    } catch (_) {}

    renderHeroPickerGrid();
  }

  function renderHeroPickerGrid() {
    const grid = document.getElementById('heroPickerGrid');
    if (!grid) return;
    grid.innerHTML = '';

    state.pickerAvailablePhotos.forEach(photo => {
      const item = document.createElement('div');
      const isSelected = state.pickerSelectedIds.has(String(photo.id));
      item.className = `hero-picker-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <img src="${api.resolveAssetUrl(photo.thumb_url || photo.url)}" alt="${escapeForAttr(photo.title || '照片')}">
        <div class="hero-picker-check">${isSelected ? '✓' : ''}</div>
      `;
      item.onclick = () => toggleHeroPickerItem(String(photo.id));
      grid.appendChild(item);
    });

    updateHeroPickerConfirmBtn();
  }

  function toggleHeroPickerItem(photoId) {
    if (state.pickerSelectedIds.has(photoId)) {
      state.pickerSelectedIds.delete(photoId);
    } else {
      state.pickerSelectedIds.add(photoId);
    }
    renderHeroPickerGrid();
  }

  function updateHeroPickerConfirmBtn() {
    const btn = document.getElementById('heroPickerConfirmBtn');
    if (!btn) return;
    const count = state.pickerSelectedIds.size;
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
    const count = state.pickerSelectedIds.size;
    if (count === 0) {
      showToast('请至少勾选一张照片');
      return;
    }
    const ids = Array.from(state.pickerSelectedIds);
    localStorage.setItem('couple_desktop_hero_photo_ids', JSON.stringify(ids));
    localStorage.setItem('couple_h5_hero_carousel_ids', JSON.stringify(ids));
    if (count === 1) {
      localStorage.setItem('couple_h5_hero_photo_id', ids[0]);
      showToast('已更新主页封面 ✨');
    } else {
      localStorage.removeItem('couple_h5_hero_photo_id');
      showToast(`已开启主页 ${count} 张照片轮播 ✨`);
    }

    closeHeroPhotoPicker();
    await loadDailyPhotosAndHero();
  }

  function closeHeroPhotoPicker() {
    document.getElementById('heroPickerModal').classList.remove('active');
  }

  async function resetToAutoHero() {
    localStorage.removeItem('couple_desktop_hero_photo_ids');
    localStorage.removeItem('couple_h5_hero_carousel_ids');
    localStorage.removeItem('couple_h5_hero_photo_id');
    closeHeroChangeMenu();
    showToast('已恢复自动跟随相册最新照片');
    await loadDailyPhotosAndHero();
  }

  function triggerHeroPhotoUpload() {
    closeHeroChangeMenu();
    const input = document.getElementById('heroUploadInput');
    input.value = '';
    input.click();
  }

  async function handleHeroUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    showToast('正在上传并设为封面...');
    const res = await api.uploadPhoto({ file, folderPath: '/', title: file.name.replace(/\.[^/.]+$/, '') });
    if (res && res.success && res.photo) {
      const pid = String(res.photo.id);
      localStorage.setItem('couple_desktop_hero_photo_ids', JSON.stringify([pid]));
      localStorage.setItem('couple_h5_hero_photo_id', pid);
      showToast('已成功上传并设为主页封面 ✨');
      await loadPhotosAndFolders();
      await loadDailyPhotosAndHero();
    } else {
      showToast(res?.message || '封面上传失败');
    }
  }

  /* ==========================================================================
     5. 相册、文件夹 CRUD 与照片批量管理
     ========================================================================== */
  async function loadPhotosAndFolders() {
    const [photos, folders] = await Promise.all([
      api.getPhotos(state.currentFolder),
      api.getFolders()
    ]);

    state.photos = photos || [];
    state.folders = folders || [];

    renderFoldersRow();
    renderPhotoGrid();
    // 关键对齐：相册子目录浏览严格保持相册自身上下文，绝不随意改写首页封面！
  }

  function renderFoldersRow() {
    const row = document.getElementById('foldersRow');
    if (!row) return;
    row.innerHTML = '';

    const currentClean = String(state.currentFolder || '').replace(/^\/+|\/+$/g, '');

    const allCard = document.createElement('div');
    allCard.className = `folder-card ${currentClean === '' ? 'active' : ''}`;
    allCard.innerHTML = `<span>📁 全部照片 (${state.photos.length})</span>`;
    allCard.onclick = () => {
      navigateToFolder('');
    };
    row.appendChild(allCard);

    state.folders.forEach(f => {
      const rawPath = f.path ? (f.path.startsWith('/') ? f.path : ('/' + f.path)) : ('/' + (f.name || ''));
      const normalizedPath = rawPath.replace(/\/+$/, '') || '/';
      const cleanPath = normalizedPath.replace(/^\/+|\/+$/g, '');
      const isActive = currentClean !== '' && (currentClean === cleanPath || currentClean === String(f.name || '').replace(/^\/+|\/+$/g, ''));

      const card = document.createElement('div');
      card.className = `folder-card ${isActive ? 'active' : ''}`;

      const titleSpan = document.createElement('span');
      titleSpan.textContent = `📁 ${f.name || cleanPath} (${f.count || 0})`;
      card.appendChild(titleSpan);

      const renameBtn = document.createElement('button');
      renameBtn.style.cssText = 'border:none; background:none; cursor:pointer; color:var(--color-muted); font-size:12px; margin-left:6px;';
      renameBtn.textContent = '✎';
      renameBtn.title = '重命名';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRenameFolderDialog(normalizedPath);
      });
      card.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.style.cssText = 'border:none; background:none; cursor:pointer; color:var(--color-danger); font-size:12px;';
      deleteBtn.textContent = '✕';
      deleteBtn.title = '删除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteCurrentFolder(normalizedPath);
      });
      card.appendChild(deleteBtn);

      card.addEventListener('click', () => {
        navigateToFolder(normalizedPath);
      });
      row.appendChild(card);
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'folder-card';
    newBtn.style.cssText = 'border: 1px dashed var(--color-border); background: var(--color-surface); color: var(--color-accent); font-weight: 500;';
    newBtn.textContent = '＋ 新建文件夹';
    newBtn.onclick = openCreateFolderDialog;
    row.appendChild(newBtn);
  }

  function navigateToFolder(path) {
    state.currentFolder = path || '';
    const displayPath = state.currentFolder ? (state.currentFolder.startsWith('/') ? state.currentFolder : '/' + state.currentFolder) : '全部照片';
    document.getElementById('currentFolderBreadcrumb').textContent = displayPath;
    loadPhotosAndFolders();
  }

  function renderPhotoGrid() {
    const grid = document.getElementById('photoGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = state.photos.filter(p => {
      if (state.selectedTag === '全部') return true;
      return (p.tag || '') === state.selectedTag;
    });

    document.getElementById('photoCountDisplay').textContent = `共 ${filtered.length} 张照片`;

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; padding:48px; text-align:center; color:var(--color-muted);">相册暂无照片，点击右上角上传吧～</div>';
      return;
    }

    filtered.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = `gallery-card ${state.selectedPhotos.has(String(photo.id)) ? 'selected' : ''}`;
      card.dataset.id = String(photo.id);

      const photoUrl = photo.thumb_url || photo.thumbnail || photo.url;
      const resolved = api.resolveAssetUrl(photoUrl);

      card.innerHTML = `
        <div class="gallery-thumb-box">
          <img src="${resolved}" alt="${escapeForAttr(photo.title || '照片')}" onerror="this.src='../assets/images/cat.svg'">
          <div class="select-checkbox" onclick="event.stopPropagation(); toggleSelectCard('${safeInlineArg(photo.id)}')">✓</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <h3 style="font-size:15px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(photo.title || '生活片段')}</h3>
          <p style="font-size:13px; color:var(--color-muted);">${escapeHtml(photo.date || '今日')} · ${escapeHtml(photo.tag || '日常')}</p>
        </div>
      `;

      card.onclick = () => {
        if (state.isManageMode) {
          toggleSelectCard(String(photo.id));
        } else {
          state.viewerPhotoList = filtered;
          state.currentViewerIndex = idx;
          state.viewerTriggerEl = card;
          openImageViewer();
        }
      };

      grid.appendChild(card);
    });
  }

  function filterByTag(tag, btn) {
    state.selectedTag = tag;
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderPhotoGrid();
  }

  function toggleManageMode() {
    state.isManageMode = !state.isManageMode;
    const grid = document.getElementById('photoGrid');
    const bar = document.getElementById('manageFloatingBar');
    const btn = document.getElementById('btnManageAlbum');

    if (state.isManageMode) {
      grid.classList.add('manage-mode');
      bar.classList.add('show');
      btn.classList.add('active');
      btn.textContent = '退出管理';
    } else {
      grid.classList.remove('manage-mode');
      bar.classList.remove('show');
      btn.classList.remove('active');
      btn.textContent = '批量管理';
      state.selectedPhotos.clear();
      renderPhotoGrid();
    }
  }

  function toggleSelectCard(photoId) {
    const pid = String(photoId);
    if (state.selectedPhotos.has(pid)) {
      state.selectedPhotos.delete(pid);
    } else {
      state.selectedPhotos.add(pid);
    }
    document.getElementById('selectedCountText').textContent = `已选择 ${state.selectedPhotos.size} 项`;
    const card = document.querySelector(`.gallery-card[data-id="${pid}"]`);
    if (card) {
      card.classList.toggle('selected', state.selectedPhotos.has(pid));
    }
  }

  function selectAllPhotos() {
    const filtered = state.photos.filter(p => {
      if (state.selectedTag === '全部') return true;
      return (p.tag || '') === state.selectedTag;
    });
    const allSelected = filtered.length > 0 && filtered.every(p => state.selectedPhotos.has(String(p.id)));

    if (allSelected) {
      filtered.forEach(p => state.selectedPhotos.delete(String(p.id)));
    } else {
      filtered.forEach(p => state.selectedPhotos.add(String(p.id)));
    }

    document.getElementById('selectedCountText').textContent = `已选择 ${state.selectedPhotos.size} 项`;
    document.querySelectorAll('.gallery-card').forEach(card => {
      card.classList.toggle('selected', state.selectedPhotos.has(card.dataset.id));
    });
  }

  async function batchDeletePhotos() {
    const count = state.selectedPhotos.size;
    if (count === 0) {
      showToast('请先勾选需要删除的照片');
      return;
    }

    const confirmed = await showAppConfirm({
      title: '确认批量删除照片？',
      message: `确定要彻底删除已选中的 <strong>${count}</strong> 张照片吗？此操作无法撤销。`,
      confirmText: `删除 ${count} 张照片`,
      isDanger: true
    });

    if (confirmed) {
      let successCount = 0;
      for (const photoId of state.selectedPhotos) {
        const res = await api.deletePhoto(photoId);
        if (res && res.success) successCount++;
      }
      state.selectedPhotos.clear();
      toggleManageMode();
      await loadPhotosAndFolders();
      showToast(`已成功删除 ${successCount} 张照片`);
    }
  }

  async function openBatchMoveDialog() {
    if (state.selectedPhotos.size === 0) {
      showToast('请先勾选需要移动的照片');
      return;
    }
    const folders = await api.getFolders();
    const select = document.getElementById('moveTargetFolderSelect');
    select.innerHTML = '<option value="/">全部照片 (相册根目录)</option>';
    if (Array.isArray(folders)) {
      folders.forEach(f => {
        const raw = f.path ? (f.path.startsWith('/') ? f.path : ('/' + f.path)) : ('/' + f.name);
        const norm = raw.replace(/\/+$/, '') || '/';
        select.innerHTML += `<option value="${escapeForAttr(norm)}">${escapeHtml(norm)}</option>`;
      });
    }
    document.getElementById('movePhotoModal').classList.add('active');
  }

  /* 文件夹弹窗相关函数 */
  function openCreateFolderDialog() {
    const modal = document.getElementById('createFolderModalOverlay');
    const input = document.getElementById('newFolderNameInput');
    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 150);
  }

  function closeCreateFolderDialog() {
    document.getElementById('createFolderModalOverlay').classList.remove('active');
  }

  async function confirmCreateFolder() {
    const input = document.getElementById('newFolderNameInput');
    const name = input.value.trim();
    if (!name) {
      showToast('请输入文件夹名称');
      input.focus();
      return;
    }
    const res = await api.createFolder(name, state.currentFolder ? `/${state.currentFolder}` : '/');
    if (res && res.success) {
      showToast(`文件夹「${name}」创建成功！`);
      closeCreateFolderDialog();
      await loadPhotosAndFolders();
    } else {
      showToast(res?.message || '创建文件夹失败');
    }
  }

  function openRenameFolderDialog(folderPath) {
    state.renamingFolderPath = folderPath || state.currentFolder || '';
    if (!state.renamingFolderPath) {
      showToast('未选择文件夹');
      return;
    }
    const input = document.getElementById('renameFolderNameInput');
    input.value = state.renamingFolderPath.split('/').pop();
    document.getElementById('renameFolderModalOverlay').classList.add('active');
    setTimeout(() => input.focus(), 150);
  }

  function closeRenameFolderDialog() {
    document.getElementById('renameFolderModalOverlay').classList.remove('active');
  }

  async function confirmRenameFolder() {
    const input = document.getElementById('renameFolderNameInput');
    const newName = input.value.trim();
    if (!newName) {
      showToast('请输入新名称');
      input.focus();
      return;
    }
    const res = await api.renameFolder(state.renamingFolderPath, newName);
    if (res && res.success) {
      showToast('文件夹重命名成功');
      closeRenameFolderDialog();
      await loadPhotosAndFolders();
    } else {
      showToast(res?.message || '重命名失败');
    }
  }

  async function confirmDeleteCurrentFolder(folderPath) {
    const target = folderPath || state.currentFolder;
    if (!target) return;

    const baseName = target.split('/').pop();
    const confirmed = await showAppConfirm({
      title: '删除文件夹',
      message: `确定要删除文件夹「${escapeHtml(baseName)}」吗？<br>文件夹内的照片将保留并移至根目录。`,
      confirmText: '确认删除',
      isDanger: true
    });

    if (confirmed) {
      const res = await api.deleteFolder(target);
      if (res && res.success) {
        showToast('文件夹已成功删除');
        const cleanTarget = (target || '').replace(/^\/+|\/+$/g, '');
        const cleanCurrent = (state.currentFolder || '').replace(/^\/+|\/+$/g, '');
        if (cleanCurrent === cleanTarget || cleanCurrent.startsWith(cleanTarget + '/')) {
          state.currentFolder = '';
          const breadcrumb = document.getElementById('currentFolderBreadcrumb');
          if (breadcrumb) breadcrumb.textContent = '全部照片';
        }
        await loadPhotosAndFolders();
      } else {
        showToast(res?.message || '删除文件夹失败');
      }
    }
  }

  /* ==========================================================================
     6. 全屏大图查看器 (320px 暖白信息栏 & 即刻关图交互)
     ========================================================================== */
  function openImageViewer() {
    const overlay = document.getElementById('viewerOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderViewerDetail();
  }

  function openSinglePhotoViewerFromStory(title, date, url) {
    state.viewerPhotoList = [{
      id: `story_photo_${Date.now()}`,
      title: title || '故事回忆配图',
      date: date || '故事时间线',
      url: url,
      folder: '故事回忆',
      story: '属于我们之间的故事印记。'
    }];
    state.currentViewerIndex = 0;
    state.viewerTriggerEl = document.activeElement;
    openImageViewer();
  }

  function openImageViewerForMemory(title, date, url) {
    state.viewerPhotoList = [{
      id: `memory_photo_${Date.now()}`,
      title: title || '拾光回忆瞬间',
      date: date || '相伴时光',
      url: url,
      folder: '回忆展签',
      story: '拾光伴侣智能唤起的专属记忆。'
    }];
    state.currentViewerIndex = 0;
    state.viewerTriggerEl = document.activeElement;
    openImageViewer();
  }

  function renderViewerDetail() {
    const current = state.viewerPhotoList[state.currentViewerIndex];
    if (!current) return;

    const imgEl = document.getElementById('viewerLargeImg');
    const titleEl = document.getElementById('viewerTitle');
    const dateEl = document.getElementById('viewerDate');
    const storyEl = document.getElementById('viewerStory');
    const pathEl = document.getElementById('viewerPath');
    const tagEl = document.getElementById('viewerTag');
    const countEl = document.getElementById('viewerCounter');

    const fullUrl = current.url || current.thumb_url || '';
    imgEl.src = api.resolveAssetUrl(fullUrl);

    titleEl.textContent = current.title || '生活片段';
    dateEl.textContent = `${current.date || '2026.09.28'} · 相伴摄影`;
    storyEl.textContent = current.caption || current.desc || '生活很匆忙，但只要看着你，时间就会慢下来。';
    pathEl.textContent = current.folder ? `相册 / ${current.folder}` : '相册 / 根目录';
    tagEl.textContent = current.tag || '日常';
    countEl.textContent = `${state.currentViewerIndex + 1} / ${state.viewerPhotoList.length}`;

    document.getElementById('btnViewerPrev').disabled = (state.currentViewerIndex === 0);
    document.getElementById('btnViewerNext').disabled = (state.currentViewerIndex === state.viewerPhotoList.length - 1);
  }

  function prevViewerImage() {
    if (state.currentViewerIndex > 0) {
      state.currentViewerIndex--;
      renderViewerDetail();
    }
  }

  function nextViewerImage() {
    if (state.currentViewerIndex < state.viewerPhotoList.length - 1) {
      state.currentViewerIndex++;
      renderViewerDetail();
    }
  }

  function closeImageViewer() {
    const overlay = document.getElementById('viewerOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (state.viewerTriggerEl && typeof state.viewerTriggerEl.focus === 'function') {
      state.viewerTriggerEl.focus();
    }
  }

  async function handleSetAsHeroFromViewer() {
    const current = state.viewerPhotoList[state.currentViewerIndex];
    if (!current) return;
    localStorage.setItem('couple_desktop_hero_photo_ids', JSON.stringify([String(current.id)]));
    await loadDailyPhotosAndHero();
    showToast(`已将「${current.title || '当前照片'}」设为封面 ✨`);
  }

  /* 移动照片：立即关闭大图，再打开移动弹窗，彻底杜绝浮层互相遮挡 */
  async function handleMovePhotoFromViewer() {
    state.pendingMovingPhoto = state.viewerPhotoList[state.currentViewerIndex];
    closeImageViewer();

    const folders = await api.getFolders();
    const select = document.getElementById('moveTargetFolderSelect');
    select.innerHTML = '<option value="/">全部照片 (相册根目录)</option>';
    if (Array.isArray(folders)) {
      folders.forEach(f => {
        const raw = f.path ? (f.path.startsWith('/') ? f.path : ('/' + f.path)) : ('/' + f.name);
        const norm = raw.replace(/\/+$/, '') || '/';
        select.innerHTML += `<option value="${escapeForAttr(norm)}">${escapeHtml(norm)}</option>`;
      });
    }

    document.getElementById('movePhotoModal').classList.add('active');
  }

  async function confirmMovePhoto() {
    const targetFolder = document.getElementById('moveTargetFolderSelect').value;
    if (state.pendingMovingPhoto) {
      const res = await api.movePhoto(state.pendingMovingPhoto.id, targetFolder);
      document.getElementById('movePhotoModal').classList.remove('active');
      if (res && res.success) {
        showToast(`已将照片移动至「${targetFolder || '根目录'}」`);
        await loadPhotosAndFolders();
      } else {
        showToast(res?.message || '移动失败');
      }
      state.pendingMovingPhoto = null;
    } else if (state.selectedPhotos.size > 0) {
      let count = 0;
      for (const id of state.selectedPhotos) {
        const res = await api.movePhoto(id, targetFolder);
        if (res && res.success) count++;
      }
      document.getElementById('movePhotoModal').classList.remove('active');
      state.selectedPhotos.clear();
      toggleManageMode();
      await loadPhotosAndFolders();
      showToast(`已将 ${count} 张照片移动至「${targetFolder || '根目录'}」`);
    }
  }

  async function handleDeletePhotoFromViewer() {
    const current = state.viewerPhotoList[state.currentViewerIndex];
    if (!current) return;

    const confirmed = await showAppConfirm({
      title: '确认删除照片？',
      message: `确定要彻底删除照片「${escapeHtml(current.title || '此照片')}」吗？此操作无法撤销。`,
      confirmText: '删除照片',
      isDanger: true
    });

    if (confirmed) {
      const res = await api.deletePhoto(current.id);
      closeImageViewer();
      if (res && res.success) {
        showToast('照片已安全删除');
        await loadPhotosAndFolders();
      } else {
        showToast(res?.message || '删除失败');
      }
    }
  }

  /* ==========================================================================
     7. 上传队列 (704px/384px 双区版式，支持单项重试)
     ========================================================================== */
  async function populateUploadFolders() {
    const folders = await api.getFolders();
    const select = document.getElementById('uploadFolderSelect');
    if (!select) return;
    let optionsHtml = '<option value="/">全部照片 (相册根目录)</option>';
    if (Array.isArray(folders)) {
      optionsHtml += folders.map(f => {
        const rawPath = f.path ? (f.path.startsWith('/') ? f.path : ('/' + f.path)) : ('/' + f.name);
        const normalizedPath = rawPath.replace(/\/+$/, '') || '/';
        const displayName = normalizedPath === '/' ? '全部照片 (相册根目录)' : normalizedPath;
        return `<option value="${escapeForAttr(normalizedPath)}">${escapeHtml(displayName)}</option>`;
      }).join('');
    }
    select.innerHTML = optionsHtml;
    // 关键对齐：继承当前相册正在浏览的目录
    if (state.currentFolder && state.currentFolder !== '/') {
      const currentNorm = state.currentFolder.startsWith('/') ? state.currentFolder : ('/' + state.currentFolder);
      select.value = currentNorm.replace(/\/+$/, '') || '/';
    } else {
      select.value = '/';
    }
  }

  function handleFileSelection(files) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const id = `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const blobUrl = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      state.uploadQueue.push({
        id,
        file,
        name: file.name,
        title: cleanTitle,
        tag: '日常',
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        blobUrl,
        status: 'pending',
        progress: 0,
        error: ''
      });
    });
    renderUploadQueue();
  }

  function updateQueueItemTitle(itemId, newTitle) {
    const item = state.uploadQueue.find(i => i.id === itemId);
    if (item) item.title = newTitle.trim() || item.name;
  }

  function updateQueueItemTag(itemId, newTag) {
    const item = state.uploadQueue.find(i => i.id === itemId);
    if (item) item.tag = newTag;
  }

  function removeUploadQueueItem(itemId) {
    if (state.isUploading) {
      showToast('正在上传中，请稍候再操作');
      return;
    }
    const idx = state.uploadQueue.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      const item = state.uploadQueue[idx];
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
      state.uploadQueue.splice(idx, 1);
      renderUploadQueue();
    }
  }

  function renderUploadQueue() {
    const list = document.getElementById('uploadQueueList');
    if (!list) return;
    list.innerHTML = '';

    if (state.uploadQueue.length === 0) {
      list.innerHTML = '<p style="font-size:14px; color:var(--color-muted); text-align:center; padding:20px;">队列中暂无待上传照片</p>';
      return;
    }

    state.uploadQueue.forEach(item => {
      const div = document.createElement('div');
      div.className = 'queue-item';

      let stateBadge = '';
      if (item.status === 'success') {
        stateBadge = '<span style="color:var(--color-success); font-weight:600;">✓ 已上传</span>';
      } else if (item.status === 'uploading') {
        stateBadge = `<span style="color:var(--color-warning); font-weight:600;">上传中...</span>`;
      } else if (item.status === 'failed') {
        stateBadge = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--color-danger); font-size:13px;" title="${escapeForAttr(item.error)}">✕ ${escapeHtml(item.error || '失败')}</span>
            <button class="btn-secondary" style="height:28px; padding:0 8px; font-size:12px; color:var(--color-accent);" onclick="retryUploadItem('${safeInlineArg(item.id)}')">重试</button>
            <button class="btn-secondary" style="height:28px; padding:0 6px; font-size:12px; color:var(--color-danger);" onclick="removeUploadQueueItem('${safeInlineArg(item.id)}')" title="移除此项">✕</button>
          </div>
        `;
      } else {
        stateBadge = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--color-muted); font-size:13px;">待提交</span>
            <button class="btn-secondary" style="height:28px; padding:0 6px; font-size:12px; color:var(--color-muted);" onclick="removeUploadQueueItem('${safeInlineArg(item.id)}')" title="从队列移除">✕</button>
          </div>
        `;
      }

      div.innerHTML = `
        <div class="queue-item-thumb">
          <img src="${item.blobUrl}" alt="预览">
        </div>
        <div class="queue-item-info" style="flex:1;">
          <div style="display:flex; gap:10px; align-items:center; margin-bottom:4px;">
            <input type="text" class="form-input" style="height:30px; font-size:13px; flex:1;" value="${escapeForAttr(item.title || item.name)}" placeholder="照片标题" onchange="updateQueueItemTitle('${safeInlineArg(item.id)}', this.value)" ${item.status === 'uploading' || item.status === 'success' ? 'disabled' : ''}>
            <select class="form-input" style="height:30px; font-size:12px; width:90px;" onchange="updateQueueItemTag('${safeInlineArg(item.id)}', this.value)" ${item.status === 'uploading' || item.status === 'success' ? 'disabled' : ''}>
              <option value="日常" ${item.tag === '日常' ? 'selected' : ''}>日常</option>
              <option value="旅行" ${item.tag === '旅行' ? 'selected' : ''}>旅行</option>
              <option value="纪念日" ${item.tag === '纪念日' ? 'selected' : ''}>纪念日</option>
              <option value="美食" ${item.tag === '美食' ? 'selected' : ''}>美食</option>
            </select>
          </div>
          <p style="font-size:12px; color:var(--color-muted);">${escapeHtml(item.name)} · ${item.size}</p>
          ${item.status === 'uploading' ? `
            <div class="queue-progress-bar">
              <div class="queue-progress-fill" style="width:100%;"></div>
            </div>
          ` : ''}
        </div>
        <div>${stateBadge}</div>
      `;
      list.appendChild(div);
    });
  }

  async function startQueueUpload(targetItemId) {
    if (state.isUploading) {
      showToast('上传正在进行中，请等待完成');
      return;
    }

    const submitBtn = document.getElementById('btnSubmitUploadQueue');
    const targetFolder = document.getElementById('uploadFolderSelect').value || '/';

    // 确定本轮需要上传的队列项：若指定了 targetItemId（重试），只处理该项！绝不连带重传其他项！
    let itemsToUpload = [];
    if (targetItemId) {
      itemsToUpload = state.uploadQueue.filter(i => i.id === targetItemId);
    } else {
      itemsToUpload = state.uploadQueue.filter(i => i.status === 'pending' || i.status === 'failed');
    }

    if (itemsToUpload.length === 0) {
      showToast('当前没有待上传的照片');
      return;
    }

    state.isUploading = true;
    if (submitBtn) submitBtn.disabled = true;

    let successCount = 0;
    let failCount = 0;

    for (const item of itemsToUpload) {
      item.status = 'uploading';
      renderUploadQueue();

      const res = await api.uploadPhoto({ file: item.file, folderPath: targetFolder, title: item.title || item.name, tag: item.tag || '日常', tags: item.tag || '日常' });

      if (res && res.success) {
        item.status = 'success';
        item.progress = 100;
        successCount++;
      } else {
        item.status = 'failed';
        item.error = res?.message || '网络连接超时';
        failCount++;
      }
      renderUploadQueue();
    }

    state.isUploading = false;
    if (submitBtn) submitBtn.disabled = false;

    await loadPhotosAndFolders();
    await loadDailyPhotosAndHero();

    if (failCount === 0) {
      showToast(`成功上传 ${successCount} 张照片 ✨`);
    } else if (successCount > 0) {
      showToast(`上传完成：${successCount} 张成功，${failCount} 张失败`);
    } else {
      showToast(`上传未成功，共 ${failCount} 项失败，请点击重试`);
    }
  }

  function retryUploadItem(itemId) {
    const item = state.uploadQueue.find(i => i.id === itemId);
    if (!item) return;
    item.status = 'pending';
    item.error = '';
    renderUploadQueue();
    // 严格隔离：仅重新上传指定的单项！
    startQueueUpload(itemId);
  }

  /* ==========================================================================
     8. 心愿、任务清单、每日签到与防自我确认闭环
     ========================================================================== */
  async function initCheckin() {
    const status = await api.getCheckinStatus();
    const btn = document.getElementById('btnDailyCheckin');
    const title = document.getElementById('checkinStreakTitle');
    const sub = document.getElementById('checkinStreakSub');

    if (!btn) return;
    if (status && status.checked_in) {
      btn.innerText = '今日已打卡';
      btn.disabled = true;
      btn.style.background = 'var(--color-surface-subtle)';
      btn.style.color = 'var(--color-muted)';
      if (title) title.innerText = `连续打卡第 ${status.streak || 1} 天 · 今日已完成`;
      if (sub) sub.innerText = '保持生活默契，明日继续';
    } else {
      btn.innerText = '打卡签到';
      btn.disabled = false;
      btn.style.background = 'var(--color-accent)';
      btn.style.color = '#FFFFFF';
      if (title) title.innerText = `连续打卡第 ${(status && status.streak) || 0} 天 · 奖励 +10 积分`;
      if (sub) sub.innerText = '今日尚未打卡，打卡后奖励自动存入账户';
    }
  }

  async function handleDailyCheckin() {
    const btn = document.getElementById('btnDailyCheckin');
    btn.disabled = true;

    const res = await api.doCheckin();
    if (res && res.success) {
      showToast(res.message || '打卡成功！+10 积分已到账');
      await initCheckin();
      await loadTasksAndPoints();
    } else {
      showToast(res?.message || '今日已完成签到');
      btn.disabled = false;
    }
  }

  async function loadTasksAndPoints() {
    const [points, tasks] = await Promise.all([
      api.getPoints(),
      api.getTasks()
    ]);
    state.points = (typeof points === 'number' && !isNaN(points)) ? points : 520;
    state.tasks = tasks || [];

    document.getElementById('userPointsDisplay').textContent = state.points;
    renderTasksList();
  }

  function startWishesPolling() {
    stopWishesPolling();
    state.wishesPollTimer = setInterval(async () => {
      await loadTasksAndPoints();
      await updateBackpackBadge();
    }, 15000);
  }

  function stopWishesPolling() {
    clearInterval(state.wishesPollTimer);
    state.wishesPollTimer = null;
  }

  async function switchWishesTab(tab) {
    document.getElementById('tabBtnTasks').classList.toggle('active', tab === 'tasks');
    document.getElementById('tabBtnShop').classList.toggle('active', tab === 'shop');
    document.getElementById('subpageTasks').style.display = (tab === 'tasks' ? 'block' : 'none');
    document.getElementById('subpageShop').style.display = (tab === 'shop' ? 'block' : 'none');

    if (tab === 'shop') {
      await Promise.all([
        loadShopProducts(),
        loadTasksAndPoints(),
        updateBackpackBadge()
      ]);
    } else {
      await loadTasksAndPoints();
    }
  }

  function switchTaskTab(tab) {
    state.taskFilter = tab;
    document.getElementById('segBtnPending').classList.toggle('active', tab === 'pending');
    document.getElementById('segBtnConfirming').classList.toggle('active', tab === 'confirming');
    document.getElementById('segBtnDone').classList.toggle('active', tab === 'done');
    renderTasksList();
  }

  function renderTasksList() {
    const list = document.getElementById('tasksContainer');
    if (!list) return;
    list.innerHTML = '';

    const currentTabTasks = state.tasks.filter(t => {
      if (state.taskFilter === 'pending') return t.status === 'pending';
      if (state.taskFilter === 'confirming') {
        return t.status === 'my_completed' || t.status === 'pending_partner' || t.status === 'confirming';
      }
      if (state.taskFilter === 'done') return t.status === 'done';
      return true;
    });

    if (currentTabTasks.length === 0) {
      list.innerHTML = '<p style="text-align:center; padding:32px; color:var(--color-muted);">当前分类下暂无约定任务</p>';
      return;
    }

    currentTabTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-item-card';

      let actionArea = '';
      if (task.status === 'pending') {
        actionArea = `<button class="btn-record" style="height:36px; padding:0 14px; font-size:13px;" onclick="handleTaskAction('${safeInlineArg(task.id)}', 'complete')">标记我已完成</button>`;
      } else if (task.status === 'my_completed') {
        // 完成者视角：禁止自我确认
        actionArea = `<span style="font-size:13px; color:#ea580c; display:flex; align-items:center; gap:4px;">⏳ 等待对方确认</span>`;
      } else if (task.status === 'pending_partner') {
        // 确认者视角：点击确认发放奖励
        actionArea = `<button class="btn-secondary" style="height:36px; padding:0 14px; font-size:13px; border-color:var(--color-accent); color:var(--color-accent);" onclick="handleTaskAction('${safeInlineArg(task.id)}', 'confirm')">确认完成 (+${task.reward} 积分)</button>`;
      } else {
        actionArea = `<span style="color:var(--color-success); font-size:13px; font-weight:600;">✓ 约定奖励已发放</span>`;
      }

      card.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <h3 style="font-size:16px; font-weight:600;">${escapeHtml(task.title)}</h3>
            <span style="font-size:13px; font-weight:600; color:var(--color-accent); background:var(--color-accent-soft); padding:2px 8px; border-radius:4px;">+${task.reward} 积分</span>
          </div>
          <p style="font-size:14px; color:var(--color-muted);">${escapeHtml(task.desc || task.description || '')}</p>
        </div>
        <div>${actionArea}</div>
      `;
      list.appendChild(card);
    });
  }

  async function handleTaskAction(taskId, action) {
    if (action === 'complete') {
      const res = await api.completeTask(taskId);
      if (res && res.success) {
        showToast('已提交完成，等待对方确认 ✨');
        await loadTasksAndPoints();
      } else {
        showToast(res?.message || '操作失败');
      }
    } else if (action === 'confirm') {
      const res = await api.confirmTask(taskId);
      if (res && res.success) {
        const reward = res.reward || res.pointsAdded || 15;
        showToast(`已确认完成！+${reward} 积分已发放至共同账户 💖`);
        await loadTasksAndPoints();
      } else {
        showToast(res?.message || '确认失败');
      }
    }
  }

  /* ==========================================================================
     9. 礼物小铺、兑换二次确认与我的背包闭环
     ========================================================================== */
  async function loadShopProducts() {
    state.shopItems = await api.getShopProducts(state.currentShopCategory);
    renderShopItems();
  }

  function filterShopCategory(cat) {
    state.currentShopCategory = cat;
    document.querySelectorAll('.shop-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cat') === cat);
    });
    loadShopProducts();
  }

  function renderShopItems() {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    grid.innerHTML = '';

    (state.shopItems || []).forEach(item => {
      const card = document.createElement('div');
      card.className = 'product-card';

      const isCoupon = item.category === 'virtual' || (item.name && item.name.includes('券'));
      const imgSrc = api.resolveAssetUrl(item.image || item.icon || 'assets/images/products/hug.png');

      card.innerHTML = `
        <div class="product-cover-box">
          <img src="${imgSrc}" alt="${escapeForAttr(item.name)}" onerror="this.src='../assets/images/heart.svg'">
        </div>
        <div style="padding:16px; display:flex; flex-direction:column; gap:6px; flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size:16px; font-weight:600;">${escapeHtml(item.name)}</h3>
            <span style="font-size:11px; padding:2px 8px; border-radius:10px; background:${isCoupon ? '#fff1f2' : '#f0fdf4'}; color:${isCoupon ? 'var(--color-accent)' : '#166534'}; font-weight:600;">
              ${isCoupon ? '特权券' : '实体礼物'}
            </span>
          </div>
          <p style="font-size:13px; color:var(--color-muted); flex:1; line-height:1.5;">${escapeHtml(item.desc || item.description || '')}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:8px; border-top:1px solid var(--color-divider);">
            <strong style="color:var(--color-accent); font-size:16px;">${item.cost || item.price} 积分</strong>
            <button class="btn-secondary btn-exchange-action" style="height:32px; padding:0 12px; font-size:13px;">兑换</button>
          </div>
        </div>
      `;
      const exchangeBtn = card.querySelector('.btn-exchange-action');
      if (exchangeBtn) {
        exchangeBtn.addEventListener('click', () => {
          openExchangeConfirmModal(item.id, item.name, item.cost || item.price, item.desc || '');
        });
      }
      grid.appendChild(card);
    });
  }

  async function openExchangeConfirmModal(id, name, cost, desc) {
    state.pendingExchangeItem = { id, name, cost, desc };
    const currentPoints = await api.getPoints();
    const remaining = currentPoints - cost;
    const isAffordable = remaining >= 0;

    document.getElementById('exchangeItemTitle').textContent = name;
    document.getElementById('exchangeItemDesc').textContent = desc || '心愿特权道具，兑换后可随时在背包中出示。';
    document.getElementById('exchangeItemCost').textContent = `${cost} 积分`;
    document.getElementById('exchangeCurrentBalance').textContent = `${currentPoints} 积分`;

    const predictedEl = document.getElementById('exchangePredictedBalance');
    const warningEl = document.getElementById('exchangeShortageWarning');
    const btnExecute = document.getElementById('btnConfirmExecuteExchange');

    if (isAffordable) {
      predictedEl.textContent = `${remaining} 积分`;
      predictedEl.style.color = 'var(--color-success)';
      warningEl.style.display = 'none';
      btnExecute.disabled = false;
      btnExecute.style.opacity = '1';
    } else {
      predictedEl.textContent = '积分不足';
      predictedEl.style.color = 'var(--color-danger)';
      warningEl.style.display = 'block';
      warningEl.textContent = `还差 ${cost - currentPoints} 积分，快去完成约定任务赚取奖励吧！`;
      btnExecute.disabled = true;
      btnExecute.style.opacity = '0.4';
    }

    document.getElementById('exchangeConfirmModalOverlay').classList.add('active');
  }

  function closeExchangeConfirmModal() {
    document.getElementById('exchangeConfirmModalOverlay').classList.remove('active');
  }

  async function executeExchange() {
    if (!state.pendingExchangeItem) return;
    const btn = document.getElementById('btnConfirmExecuteExchange');
    btn.disabled = true;
    btn.innerText = '兑换中...';

    const res = await api.buyProduct(state.pendingExchangeItem.id);
    closeExchangeConfirmModal();
    btn.innerText = '确认兑换';

    if (res && res.success) {
      showToast(res.message || '兑换成功！道具已放入我的背包 🎒');
      await Promise.all([
        loadShopProducts(),
        loadTasksAndPoints(),
        updateBackpackBadge()
      ]);
    } else {
      showToast(res?.message || '兑换失败');
    }
  }

  /* 背包全流程 */
  async function openBackpackModal() {
    document.getElementById('backpackModal').classList.add('active');
    await loadBackpackItems();
  }

  function closeBackpackModal() {
    document.getElementById('backpackModal').classList.remove('active');
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
    const [pendingRes, itemsRes] = await Promise.all([
      api.getPendingConfirmations(),
      api.getVirtualItems()
    ]);
    state.bagPendingItems = pendingRes || [];
    state.bagMyItems = itemsRes || [];

    renderBackpackViews();
  }

  function renderBackpackViews() {
    const pendingWrap = document.getElementById('backpackPendingList');
    const myWrap = document.getElementById('backpackItemsList');

    if (pendingWrap) {
      pendingWrap.innerHTML = '';
      if (state.bagPendingItems.length === 0) {
        pendingWrap.innerHTML = '<p style="font-size:13px; color:var(--color-muted); padding:10px 0;">暂无待我确认履行的申请</p>';
      } else {
        state.bagPendingItems.forEach(item => {
          const div = document.createElement('div');
          div.className = 'task-item-card';
          div.style.marginBottom = '10px';
          div.innerHTML = `
            <div>
              <h4 style="font-size:15px; font-weight:600;">${escapeHtml(item.product_name || item.name || '心愿特权')}</h4>
              <p style="font-size:13px; color:var(--color-muted);">对方于 ${formatItemDate(item.used_at || item.purchased_at)} 出示申请</p>
            </div>
            <button class="btn-record btn-confirm-use" style="height:34px; padding:0 14px; font-size:13px; background:#d97706;">确认履行</button>
          `;
          const btn = div.querySelector('.btn-confirm-use');
          if (btn) {
            btn.addEventListener('click', () => {
              confirmUseItem(item.id, item.product_name || item.name || '特权');
            });
          }
          pendingWrap.appendChild(div);
        });
      }
    }

    if (myWrap) {
      myWrap.innerHTML = '';
      if (state.bagMyItems.length === 0) {
        myWrap.innerHTML = '<p style="font-size:13px; color:var(--color-muted); padding:10px 0;">背包中暂无可用心愿卡券</p>';
      } else {
        state.bagMyItems.forEach(item => {
          const div = document.createElement('div');
          div.className = 'task-item-card';
          div.style.marginBottom = '10px';

          let actionContent = '';
          if (item.status === 'pending') {
            actionContent = '<span style="font-size:13px; color:#ea580c; font-weight:500;">⏳ 等待对方确认</span>';
          } else if (item.status === 'used') {
            actionContent = '<span style="font-size:13px; color:var(--color-muted);">已履行核销</span>';
          } else {
            actionContent = `<button class="btn-secondary btn-trigger-use" style="height:34px; padding:0 14px; font-size:13px;">立即出示</button>`;
          }

          div.innerHTML = `
            <div>
              <h4 style="font-size:15px; font-weight:600;">${escapeHtml(item.name || item.title || '心愿特权')}</h4>
              <p style="font-size:13px; color:var(--color-muted);">随时可向对方出示</p>
            </div>
            <div>${actionContent}</div>
          `;
          const triggerBtn = div.querySelector('.btn-trigger-use');
          if (triggerBtn) {
            triggerBtn.addEventListener('click', () => {
              triggerUseItem(item.id, item.name || item.title || '特权');
            });
          }
          myWrap.appendChild(div);
        });
      }
    }
  }

  async function triggerUseItem(itemId, itemName) {
    const confirmed = await showAppConfirm({
      title: '使用特权道具',
      message: `确认现在出示「${escapeHtml(itemName)}」吗？<br>出示后需对方确认履行。`,
      confirmText: '确认出示'
    });

    if (confirmed) {
      const res = await api.useVirtualItem(itemId);
      if (res && res.success) {
        showToast(res.message || '已申请使用，等待对方确认 💌');
        await loadBackpackItems();
      } else {
        showToast(res?.message || '使用失败');
      }
    }
  }

  async function confirmUseItem(itemId, itemName) {
    const confirmed = await showAppConfirm({
      title: '确认履行心愿',
      message: `确认履行对方出示的「${escapeHtml(itemName)}」心愿吗？`,
      confirmText: '确认履行',
      icon: '💖'
    });

    if (confirmed) {
      const res = await api.confirmVirtualItem(itemId);
      if (res && res.success) {
        showToast(res.message || '确认成功！已履行该心愿 ✨');
        await loadBackpackItems();
        await updateBackpackBadge();
      } else {
        showToast(res?.message || '确认失败');
      }
    }
  }

  async function updateBackpackBadge() {
    const pending = await api.getPendingConfirmations();
    const badge = document.getElementById('backpackBadge');
    if (!badge) return;
    const count = (pending || []).length;
    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ==========================================================================
     10. 私密空间 (双模式认证 & 笔记/受控文件双分区)
     ========================================================================== */
  function toggleSecretAuthMode() {
    const pinMode = document.getElementById('privatePinMode');
    const textMode = document.getElementById('privateTextMode');
    const toggleBtn = document.getElementById('btnTogglePrivateAuthMode');
    const isPin = pinMode && pinMode.style.display !== 'none';

    if (isPin) {
      pinMode.style.display = 'none';
      textMode.style.display = 'block';
      toggleBtn.textContent = '切换为数字键盘输入';
      document.getElementById('privatePasswordInput').focus();
    } else {
      pinMode.style.display = 'block';
      textMode.style.display = 'none';
      toggleBtn.textContent = '切换为常规文本密码输入';
    }
  }

  function inputPin(digit) {
    if (state.pinCode.length < 4) {
      state.pinCode += digit;
      updatePinDots();
      if (state.pinCode.length === 4) {
        setTimeout(verifyPinCode, 180);
      }
    }
  }

  function deletePin() {
    if (state.pinCode.length > 0) {
      state.pinCode = state.pinCode.slice(0, -1);
      updatePinDots();
    }
  }

  function clearPin() {
    state.pinCode = '';
    updatePinDots();
  }

  function updatePinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`pinDot${i}`);
      if (dot) {
        dot.classList.toggle('filled', i < state.pinCode.length);
      }
    }
  }

  async function verifyPinCode() {
    const currentReqVersion = ++state.privateAuthReqVersion;
    const pin = state.pinCode;
    const res = await api.verifyPrivatePassword(pin);
    if (currentReqVersion !== state.privateAuthReqVersion) {
      return;
    }
    if (res && res.authenticated) {
      state.privateUnlocked = true;
      document.getElementById('privateLockedView').style.display = 'none';
      document.getElementById('privateUnlockedView').style.display = 'block';
      showToast('私密空间已解锁 🔒');
      await loadPrivateSpaceData(currentReqVersion);
    } else {
      showToast(res?.message || '密码错误，请重试');
      clearPin();
    }
  }

  async function submitSecretTextPassword() {
    const pwdInput = document.getElementById('privatePasswordInput');
    const pwd = pwdInput ? pwdInput.value.trim() : '';
    if (!pwd) {
      showToast('请输入私密空间密码');
      return;
    }
    const currentReqVersion = ++state.privateAuthReqVersion;
    const res = await api.verifyPrivatePassword(pwd);
    if (currentReqVersion !== state.privateAuthReqVersion) {
      return;
    }
    if (res && res.authenticated) {
      state.privateUnlocked = true;
      document.getElementById('privateLockedView').style.display = 'none';
      document.getElementById('privateUnlockedView').style.display = 'block';
      showToast('私密空间已解锁 🔒');
      if (pwdInput) pwdInput.value = '';
      await loadPrivateSpaceData(currentReqVersion);
    } else {
      showToast(res?.message || '密码错误，请重试');
    }
  }

  async function enterPrivateSpace() {
    const locked = document.getElementById('privateLockedView');
    const unlocked = document.getElementById('privateUnlockedView');

    // 关键防御 1：递增校验版本号，并立即隐藏旧正文，防止请求飞行期间窥见
    const currentReqVersion = ++state.privateAuthReqVersion;
    if (unlocked) unlocked.style.display = 'none';

    // 重新进入时首先预检服务端真实私密会话状态；失效时清理敏感DOM，绝不残留旧内容
    const authStatus = await api.checkPrivateAuth();

    // 关键防御 2：如果在此请求飞行期间发生了锁定或页面切换，废弃该迟到响应！
    if (currentReqVersion !== state.privateAuthReqVersion) {
      return;
    }

    if (authStatus && authStatus.authenticated) {
      state.privateUnlocked = true;
      if (locked) locked.style.display = 'none';
      if (unlocked) unlocked.style.display = 'block';
      await loadPrivateSpaceData(currentReqVersion);
    } else {
      resetPrivateSpaceStateAndDOM();
      if (locked) locked.style.display = 'block';
      if (unlocked) unlocked.style.display = 'none';
    }
  }

  function resetPrivateSpaceStateAndDOM() {
    state.privateAuthReqVersion = (state.privateAuthReqVersion || 0) + 1;
    state.privateUnlocked = false;
    state.pinCode = '';
    state.privateNotes = [];
    state.privateFiles = [];
    clearPin();
    closeNoteDetailModal();
    const notesContainer = document.getElementById('privateNotesContainer');
    if (notesContainer) notesContainer.innerHTML = '';
    const filesContainer = document.getElementById('privateFilesContainer');
    if (filesContainer) filesContainer.innerHTML = '';
    const countEl = document.getElementById('secretNotesCountText');
    if (countEl) countEl.textContent = '已归档私密信件与备忘 (0 篇)';
    const pwdInput = document.getElementById('privatePasswordInput');
    if (pwdInput) pwdInput.value = '';
  }

  async function lockPrivateSpace() {
    // 关键防御 3：锁定操作立即递增版本号废弃在途响应，先清空DOM并立即切为锁定视图
    state.privateAuthReqVersion = (state.privateAuthReqVersion || 0) + 1;
    resetPrivateSpaceStateAndDOM();
    document.getElementById('privateLockedView').style.display = 'block';
    document.getElementById('privateUnlockedView').style.display = 'none';
    await api.logoutPrivate();
    showToast('私密空间已锁定');
  }

  function switchPrivateTab(tab) {
    state.privateTab = tab;
    document.getElementById('segBtnPrivateNotes').classList.toggle('active', tab === 'notes');
    document.getElementById('segBtnPrivateFiles').classList.toggle('active', tab === 'files');
    document.getElementById('secPrivateNotesView').style.display = (tab === 'notes' ? 'block' : 'none');
    document.getElementById('secPrivateFilesView').style.display = (tab === 'files' ? 'block' : 'none');
  }

  async function loadPrivateSpaceData(reqVersion) {
    const v = reqVersion !== undefined ? reqVersion : state.privateAuthReqVersion;
    await Promise.all([
      loadPrivateNotes(v),
      loadPrivateFiles(v)
    ]);
  }

  /* 私密随笔 */
  async function loadPrivateNotes(reqVersion) {
    const v = reqVersion !== undefined ? reqVersion : state.privateAuthReqVersion;
    const notes = await api.getPrivateNotes() || [];
    // 关键提交保护：若已失效或已有更新版本，直接废弃结果，绝不覆盖新会话
    if (v !== state.privateAuthReqVersion || !state.privateUnlocked) {
      return;
    }
    state.privateNotes = notes;
    renderPrivateNotes();
  }

  function renderPrivateNotes() {
    const container = document.getElementById('privateNotesContainer');
    const countEl = document.getElementById('secretNotesCountText');
    if (!container) return;
    container.innerHTML = '';

    if (countEl) countEl.textContent = `已归档私密信件与备忘 (${state.privateNotes.length} 篇)`;

    if (state.privateNotes.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:32px; color:var(--color-muted);">暂无私密随笔，点击上方新建</p>';
      return;
    }

    state.privateNotes.forEach(note => {
      const div = document.createElement('div');
      div.style.cssText = 'background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); padding:20px; margin-bottom:16px; cursor:pointer;';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <h3 style="font-size:16px; font-weight:600;">${escapeHtml(note.title || '私密随笔')}</h3>
          <span style="font-size:13px; color:var(--color-muted);">${escapeHtml((note.created_at || note.date || '').slice(0, 16))}</span>
        </div>
        <p style="font-size:15px; color:var(--color-ink); line-height:1.8; font-family:var(--font-serif); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(note.content || '')}</p>
      `;
      div.onclick = () => showPrivateNoteDetail(note.title, note.content, (note.created_at || note.date || '').slice(0, 16), note.id);
      container.appendChild(div);
    });
  }

  function openCreateNoteModal() {
    document.getElementById('newNoteTitleInput').value = '';
    document.getElementById('newNoteContentInput').value = '';
    document.getElementById('createNoteModalOverlay').classList.add('active');
    setTimeout(() => document.getElementById('newNoteTitleInput').focus(), 120);
  }

  function closeCreateNoteModal() {
    document.getElementById('createNoteModalOverlay').classList.remove('active');
  }

  async function confirmSaveNote() {
    const title = document.getElementById('newNoteTitleInput').value.trim();
    const content = document.getElementById('newNoteContentInput').value.trim();
    if (!content) {
      showToast('请写下笔记内容');
      return;
    }
    const res = await api.addPrivateNote(title || '私密随笔', content);
    if (res && res.success) {
      showToast('私密笔记已保存 ✨');
      closeCreateNoteModal();
      await loadPrivateNotes();
    } else {
      showToast(res?.message || '保存失败');
    }
  }

  function showPrivateNoteDetail(title, content, date, noteId) {
    document.getElementById('noteDetailTitle').textContent = title || '私密随笔';
    document.getElementById('noteDetailDate').textContent = `记录时间：${date}`;
    document.getElementById('noteDetailContent').textContent = content || '';

    const delBtn = document.getElementById('noteDetailDeleteBtn');
    delBtn.onclick = async () => {
      closeNoteDetailModal();
      await deletePrivateNoteAction(noteId);
    };

    document.getElementById('noteDetailModalOverlay').classList.add('active');
  }

  function closeNoteDetailModal() {
    document.getElementById('noteDetailModalOverlay').classList.remove('active');
  }

  async function deletePrivateNoteAction(noteId) {
    const confirmed = await showAppConfirm({
      title: '删除私密笔记',
      message: '确定要彻底删除该篇私密日记吗？删除后不可恢复。',
      confirmText: '删除笔记',
      isDanger: true
    });
    if (confirmed) {
      const res = await api.deletePrivateNote(noteId);
      if (res && res.success) {
        showToast('笔记已安全删除');
        await loadPrivateNotes();
      } else {
        showToast(res?.message || '删除失败');
      }
    }
  }

  /* 私密受控文件 */
  async function loadPrivateFiles(reqVersion) {
    const v = reqVersion !== undefined ? reqVersion : state.privateAuthReqVersion;
    const files = await api.getPrivateFiles() || [];
    // 关键提交保护：若已失效或已有更新版本，直接废弃结果，绝不覆盖新会话
    if (v !== state.privateAuthReqVersion || !state.privateUnlocked) {
      return;
    }
    state.privateFiles = files;
    renderPrivateFiles();
  }

  function renderPrivateFiles() {
    const container = document.getElementById('privateFilesContainer');
    const countEl = document.getElementById('secretFilesCountText');
    if (!container) return;
    container.innerHTML = '';

    if (countEl) countEl.textContent = `私密加密存储文件 (${state.privateFiles.length} 个)`;

    if (state.privateFiles.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:32px; color:var(--color-muted);">暂无私密文件，点击上方上传安全存储</p>';
      return;
    }

    state.privateFiles.forEach(file => {
      const div = document.createElement('div');
      div.className = 'task-item-card';
      const sizeKb = (file.size / 1024).toFixed(1);
      const downloadUrl = file.download_url || file.path || `api/private-files.php?action=download&file_id=${encodeURIComponent(file.id)}`;

      div.innerHTML = `
        <div>
          <h4 style="font-size:15px; font-weight:600;">🔒 ${escapeHtml(file.original_name || file.name || '加密文件')}</h4>
          <p style="font-size:13px; color:var(--color-muted);">${sizeKb} KB · ${(file.uploaded_at || file.created_at || '').slice(0, 16)}</p>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="${downloadUrl}" download="${escapeForAttr(file.original_name || file.name || 'file')}" target="_blank" class="btn-secondary" style="height:32px; padding:0 12px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center;">下载</a>
          <button class="btn-secondary" style="height:32px; padding:0 12px; font-size:12px; color:var(--color-danger);" onclick="deletePrivateFileAction('${safeInlineArg(file.id)}')">删除</button>
        </div>
      `;
      container.appendChild(div);
    });
  }

  async function handleSecretFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    showToast(`正在加密上传：${file.name}...`);
    const res = await api.uploadPrivateFile(file);
    e.target.value = '';

    if (res && res.success) {
      showToast(res.message || '文件已加密安全存储 ✨');
      await loadPrivateFiles();
    } else {
      showToast(res?.message || '文件上传失败，请重试');
    }
  }

  async function deletePrivateFileAction(fileId) {
    const confirmed = await showAppConfirm({
      title: '删除私密文件',
      message: '确定要删除这个私密文件吗？删除后不可恢复。',
      confirmText: '确认删除',
      isDanger: true
    });
    if (confirmed) {
      const res = await api.deletePrivateFile(fileId);
      if (res && res.success) {
        showToast('文件已删除');
        await loadPrivateFiles();
      } else {
        showToast(res?.message || '删除失败');
      }
    }
  }

  /* ==========================================================================
     11. 设备管理与 8 位纯数字核对码安全审批
     ========================================================================== */
  async function refreshPendingDevices() {
    const res = await api.getPendingDevices();
    const pendingWrap = document.getElementById('pendingDevicesWrap');
    const activeWrap = document.getElementById('activeDevicesWrap');

    if (!res || !res.success) {
      state.deviceListCache = [];
      const msg = res && res.forbidden ? '仅管理员可以管理设备，当前账号无权限' : (res?.message || '设备列表加载失败');
      if (pendingWrap) pendingWrap.innerHTML = `<p style="font-size:14px; color:var(--color-muted);">${escapeHtml(msg)}</p>`;
      return;
    }

    state.deviceListCache = res.all || res.devices || [];
    state.pendingDevices = res.devices || [];
    const others = state.deviceListCache.filter(d => d.status !== 'pending');

    if (pendingWrap) {
      pendingWrap.innerHTML = '';
      if (state.pendingDevices.length === 0) {
        pendingWrap.innerHTML = '<p style="font-size:14px; color:var(--color-muted);">暂无待审批的设备申请</p>';
      } else {
        state.pendingDevices.forEach(d => {
          const card = document.createElement('div');
          card.style.cssText = 'background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); padding:20px; margin-bottom:12px;';
          card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:16px; font-weight:600;">${escapeHtml(d.device_name || d.name || '新接入设备')}</h3>
                <p style="font-size:13px; color:var(--color-muted);">${escapeHtml(String(d.created_at || '刚刚请求接入'))}</p>
              </div>
              <span style="font-family:monospace; font-size:22px; font-weight:700; color:var(--color-accent); letter-spacing:2px;">${escapeHtml(d.pairing_code || '8位核对码')}</span>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <input type="text" class="form-input" style="height:36px; max-width:200px;" id="pairCodeInput_${d.id}" placeholder="输入 8 位核对码" maxlength="8">
              <button class="btn-record" style="height:36px; padding:0 14px; font-size:13px;" onclick="approvePendingDevice('${safeInlineArg(d.id)}')">批准接入</button>
              <button class="btn-secondary" style="height:36px; padding:0 14px; font-size:13px;" onclick="denyPendingDevice('${safeInlineArg(d.id)}')">拒绝</button>
            </div>
          `;
          pendingWrap.appendChild(card);
        });
      }
    }

    if (activeWrap) {
      activeWrap.innerHTML = '';
      if (others.length === 0) {
        activeWrap.innerHTML = '<p style="font-size:14px; color:var(--color-muted);">暂无已授权设备记录</p>';
      } else {
        others.forEach(d => {
          const card = document.createElement('div');
          card.style.cssText = 'background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); padding:16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;';
          card.innerHTML = `
            <div>
              <span style="font-size:15px; font-weight:600;">${escapeHtml(d.name || d.device_name || '受信任设备')}${d.current ? ' · (当前设备)' : ''}</span>
              <p style="font-size:13px; color:var(--color-muted); margin-top:2px;">状态：${d.status === 'active' ? '正常受信任' : d.status}</p>
            </div>
            <div>
              ${!d.current ? `<button class="btn-secondary" style="height:32px; padding:0 12px; font-size:12px; color:var(--color-danger);" onclick="revokePendingDevice('${safeInlineArg(d.id)}')">撤销授权</button>` : '<span style="font-size:13px; color:var(--color-success); font-weight:600;">● 本机持续有效</span>'}
            </div>
          `;
          activeWrap.appendChild(card);
        });
      }
    }
  }

  async function approvePendingDevice(deviceId) {
    const input = document.getElementById(`pairCodeInput_${deviceId}`);
    const code = input ? input.value.trim() : '';
    if (!code || code.length !== 8) {
      showToast('请输入完整的 8 位数字配对核对码');
      if (input) input.focus();
      return;
    }
    const res = await api.approveDevice(deviceId, code);
    if (res && res.success) {
      showToast('设备授权已批准 ✨');
      await refreshPendingDevices();
    } else {
      showToast(res?.message ? `批准失败：${res.message}` : '批准失败');
    }
  }

  async function denyPendingDevice(deviceId) {
    const confirmed = await showAppConfirm({
      title: '拒绝设备接入？',
      message: '确定要拒绝该设备的授权申请吗？驳回后该申请将直接作废。',
      confirmText: '确认拒绝',
      isDanger: true
    });
    if (confirmed) {
      const res = await api.denyDevice(deviceId);
      if (res && res.success) {
        showToast('已拒绝该设备授权申请');
        await refreshPendingDevices();
      } else {
        showToast(res?.message || '操作失败');
      }
    }
  }

  async function revokePendingDevice(deviceId) {
    const confirmed = await showAppConfirm({
      title: '撤销设备授权？',
      message: '确定要撤销该设备的授权吗？撤销后该设备将立即失去访问权限。',
      confirmText: '确认撤销',
      isDanger: true
    });
    if (confirmed) {
      const res = await api.revokeDevice(deviceId);
      if (res && res.success) {
        showToast('已撤销该设备授权');
        await refreshPendingDevices();
      } else {
        showToast(res?.message || '撤销失败');
      }
    }
  }

  /* ==========================================================================
     12. 来信信笺、写悄悄话与故事时间线
     ========================================================================== */
  async function refreshLetterBanner() {
    const whispers = await api.getWhispersHistory();
    state.allWhispersList = Array.isArray(whispers) ? whispers : [];

    const banner = document.getElementById('homeLetterBanner');
    const bannerText = document.getElementById('homeLetterBannerText');
    const badge = document.getElementById('homeLetterCountBadge');
    if (!banner || !bannerText) return;

    // 核心业务隔离：只有对方寄给我的、且尚未已读的信，才算作“我的未读信件”！
    // 我自己创建寄给对方的信，绝不挂在我自己的主页，而是对方的主页！
    const unreadItems = state.allWhispersList.filter(w => !w.is_from_me && Boolean(w.unread));

    // 如果没有对方寄来的未读信件（已读归档或自己寄出的），主页新来信横幅彻底隐藏！绝不再挂在主页！
    if (unreadItems.length === 0) {
      banner.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }

    // 存在对方寄给我的未读来信时，主页展示新信提示
    banner.style.display = 'flex';
    const first = unreadItems[0];
    const preview = (first.title || first.content || '给你留了悄悄话').slice(0, 18);
    bannerText.textContent = `有一封给你的未读信件：“${preview}...”`;
    if (badge) {
      badge.textContent = `${unreadItems.length} 封新信`;
      badge.style.display = 'inline-block';
    }
  }

  async function openLetterModal() {
    const whispers = await api.getWhispersHistory();
    state.allWhispersList = Array.isArray(whispers) ? whispers : [];
    if (state.allWhispersList.length === 0) {
      showAppAlert('信箱暂空', '信箱空空的，点击右上角“＋记录”写下你想对TA说的第一封悄悄话吧。');
      return;
    }
    // 优先定位到第一封对方寄来的未读信件
    const firstUnreadIdx = state.allWhispersList.findIndex(w => !w.is_from_me && Boolean(w.unread));
    state.currentWhisperIndex = firstUnreadIdx >= 0 ? firstUnreadIdx : 0;
    displayCurrentWhisper();
    document.getElementById('letterModalPage').classList.add('active');
  }

  async function closeLetterModal() {
    document.getElementById('letterModalPage').classList.remove('active');
    // 关闭时立即刷新主页未读提示条，确保已读信件即刻从主页消除！
    await refreshLetterBanner();
  }

  function displayCurrentWhisper() {
    const item = state.allWhispersList[state.currentWhisperIndex] || state.allWhispersList[0];
    if (!item) return;
    state.currentOpenWhisperId = item.id;

    const meta = document.getElementById('letterModalMeta');
    const content = document.getElementById('letterModalContent');
    const isFromMe = Boolean(item.is_from_me);
    const isUnread = !isFromMe && Boolean(item.unread);

    // 体验关键优化：只要收件人点开阅读了该信件，立即在后台将其标记为已读，避免因未点“完成阅读”导致未读残留
    if (isUnread) {
      item.unread = false;
      item.unread_for_me = false;
      item.is_read = true;
      item.read = true;
      api.markWhisperRead(item.id).catch(() => {});
    }

    const roleTag = isFromMe ? ' · [我寄给TA的信]' : ' · [留存信笺]';
    const pageNav = state.allWhispersList.length > 1 ? ` · 第 ${state.currentWhisperIndex + 1}/${state.allWhispersList.length} 封` : '';

    meta.textContent = `${item.from || (isFromMe ? '我' : '对方')} 写于 ${item.date || '今日'}${roleTag}${pageNav}`;
    content.innerHTML = escapeHtml(item.content || '').replace(/\n/g, '<br>');
  }

  function showNextWhisper() {
    if (state.allWhispersList.length <= 1) return;
    state.currentWhisperIndex = (state.currentWhisperIndex + 1) % state.allWhispersList.length;
    displayCurrentWhisper();
  }

  async function handleLetterReadDone() {
    if (state.currentOpenWhisperId) {
      await api.markWhisperRead(state.currentOpenWhisperId);
      const curr = state.allWhispersList.find(w => String(w.id) === String(state.currentOpenWhisperId));
      if (curr) {
        curr.unread = false;
        curr.unread_for_me = false;
        curr.is_read = true;
        curr.read = true;
      }
    }
    await closeLetterModal();
    showToast('已完成阅读并留存在私密信箱');
  }

  async function archiveLetterAction() {
    if (state.currentOpenWhisperId) {
      await api.markWhisperRead(state.currentOpenWhisperId);
      const curr = state.allWhispersList.find(w => String(w.id) === String(state.currentOpenWhisperId));
      if (curr) {
        curr.unread = false;
        curr.unread_for_me = false;
        curr.is_read = true;
        curr.read = true;
      }
    }
    await closeLetterModal();
    showToast('信件已归档至私密空间');
  }

  function openWriteLetterModal() {
    document.getElementById('writeLetterTitle').value = '';
    document.getElementById('writeLetterContent').value = '';
    document.getElementById('writeLetterModal').classList.add('active');
    setTimeout(() => document.getElementById('writeLetterTitle').focus(), 120);
  }

  function closeWriteLetterModal() {
    const optionsContainer = document.getElementById('writeLetterDraftOptions');
    if (optionsContainer) optionsContainer.style.display = 'none';
    document.getElementById('writeLetterModal').classList.remove('active');
  }

  async function submitDirectLetter() {
    const title = document.getElementById('writeLetterTitle').value.trim();
    const content = document.getElementById('writeLetterContent').value.trim();
    if (!content) {
      showToast('请输入悄悄话内容');
      return;
    }
    const fullContent = title ? `【${title}】\n${content}` : content;
    const res = await api.sendWhisper(fullContent);
    if (res && res.success) {
      showToast(res.message || '悄悄话已成功发送给对方 💌');
      closeWriteLetterModal();
      await refreshLetterBanner();
    } else {
      showToast(res?.message || '发送失败');
    }
  }

  /* 故事时间线 */
  async function loadRemindersAndStory() {
    const [reminders, _] = await Promise.all([
      api.getAnniversaryReminders(),
      renderStoryTimeline()
    ]);
    renderAnniversaries(reminders);
  }

  function renderAnniversaries(reminders) {
    const list = document.getElementById('anniversaryList');
    if (!list) return;
    list.innerHTML = '';
    (reminders || []).forEach(r => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:baseline; gap:16px; padding-bottom:14px; border-bottom:1px solid var(--color-divider); margin-bottom:12px;';
      row.innerHTML = `
        <span style="font-family:var(--font-serif); font-size:22px; width:70px;">${escapeHtml(r.date)}</span>
        <div>
          <h3 style="font-size:16px; font-weight:500;">${escapeHtml(r.name)}</h3>
          <p style="font-size:13px; color:var(--color-muted);">${escapeHtml(r.message || `还有 ${r.days_until} 天`)}</p>
        </div>
      `;
      list.appendChild(row);
    });
  }

  async function renderStoryTimeline() {
    const stream = document.getElementById('storyTimelineList');
    if (!stream) return;
    stream.innerHTML = '';

    const events = await api.getStoryTimeline();
    if (!events || events.length === 0) {
      stream.innerHTML = '<p style="text-align:center; padding:32px; color:var(--color-muted);">暂无故事节点，点击上方“＋记故事”添加</p>';
      return;
    }

    const groups = {};
    for (const ev of events) {
      const year = (ev.date || '2026').slice(0, 4);
      if (!groups[year]) groups[year] = [];
      groups[year].push(ev);
    }
    const years = Object.keys(groups).sort().reverse();

    years.forEach(year => {
      const yearGroup = document.createElement('div');
      yearGroup.style.marginBottom = '32px';
      yearGroup.innerHTML = `<h3 style="font-family:var(--font-serif); font-size:22px; font-weight:600; margin-bottom:16px; color:var(--color-ink);">${year} 年</h3>`;

      groups[year].forEach(item => {
        let badgeClass = 'story-badge-default';
        let badgeText = '生活故事';
        if (item.type === 'start') { badgeClass = 'story-badge-start'; badgeText = '恋爱起点'; }
        else if (item.type === 'anniversary') { badgeClass = 'story-badge-anniversary'; badgeText = '纪念日'; }
        else if (item.type === 'birthday') { badgeClass = 'story-badge-birthday'; badgeText = '生日祝福'; }
        else if (item.type === 'upload') { badgeClass = 'story-badge-upload'; badgeText = '相册足迹'; }

        let photosHtml = '';
        if (Array.isArray(item.photos) && item.photos.length > 0) {
          photosHtml = `
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:12px;">
              ${item.photos.map(p => {
                const pUrl = typeof p === 'string' ? p : (p.url || p.path || p.thumbnail_path || '');
                const cleanUrl = api.resolveAssetUrl(pUrl);
                return `
                  <div class="story-photo-thumb" style="width:84px; height:84px; border-radius:var(--radius-sm); overflow:hidden; background:var(--color-surface); cursor:pointer; border:1px solid var(--color-divider); transition:transform 0.15s ease;"
                       title="点击查看照片">
                    <img src="${escapeForAttr(cleanUrl)}" alt="故事配图" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none';">
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        const node = document.createElement('div');
        node.style.cssText = 'position:relative; display:flex; flex-direction:column; gap:8px; margin-bottom:20px; padding-left:24px; border-left:2px solid var(--color-divider);';
        node.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13px; color:var(--color-muted); font-weight:600;">${escapeHtml(item.date || '')}${item.location ? ' · ' + escapeHtml(item.location) : ''}</span>
            <span class="story-type-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="background:var(--color-surface); border:1px solid var(--color-divider); border-radius:var(--radius-sm); padding:18px;">
            <h4 style="font-size:16px; font-weight:600; margin-bottom:6px;">${escapeHtml(item.title || '')}</h4>
            <p style="font-size:15px; color:var(--color-ink); line-height:1.7;">${escapeHtml(item.content || item.desc || '')}</p>
            ${photosHtml}
          </div>
        `;

        if (Array.isArray(item.photos) && item.photos.length > 0) {
          const thumbs = node.querySelectorAll('.story-photo-thumb');
          thumbs.forEach((thumb, pIdx) => {
            const p = item.photos[pIdx];
            const pUrl = typeof p === 'string' ? p : (p.url || p.path || p.thumbnail_path || '');
            const cleanUrl = api.resolveAssetUrl(pUrl);
            thumb.addEventListener('click', () => {
              openSinglePhotoViewerFromStory(item.title || '故事配图', item.date || '', cleanUrl);
            });
          });
        }
        yearGroup.appendChild(node);
      });
      stream.appendChild(yearGroup);
    });
  }

  function openStoryDraftModal(text, defaultDate, defaultTitle = '生活点滴记录') {
    state.currentDraftText = text || '';
    const contentEl = document.getElementById('storyDraftContent');
    if (contentEl) contentEl.value = state.currentDraftText;
    const titleEl = document.getElementById('storyDraftTitle');
    if (titleEl) titleEl.value = defaultTitle || '生活点滴记录';
    const dateEl = document.getElementById('storyDraftDate');
    if (dateEl) dateEl.value = defaultDate || new Date().toISOString().slice(0, 10);
    const photoEl = document.getElementById('storyDraftPhoto');
    if (photoEl) photoEl.value = '';
    const overlay = document.getElementById('storyDraftModalOverlay');
    if (overlay) overlay.classList.add('active');
  }

  function closeStoryDraftModal() {
    document.getElementById('storyDraftModalOverlay').classList.remove('active');
  }

  async function confirmSaveStory() {
    const title = document.getElementById('storyDraftTitle').value.trim() || '生活点滴记录';
    const content = document.getElementById('storyDraftContent').value.trim() || state.currentDraftText;
    const date = document.getElementById('storyDraftDate').value || new Date().toISOString().slice(0, 10);
    const photoFile = document.getElementById('storyDraftPhoto').files[0] || null;

    if (!content && !photoFile) {
      showToast('请写点内容或选择一张照片');
      return;
    }

    closeStoryDraftModal();
    showToast('正在保存故事节点...');
    const res = await api.createStoryEvent({ title, content, date, photoFile });
    if (res && res.success) {
      showToast(`已成功记入故事时间线「${title}」✨`);
      await renderStoryTimeline();
    } else {
      showToast(res?.message || '保存故事失败');
    }
  }

  /* ==========================================================================
     13. 拾光 AI 生活助手 (大屏优雅抽屉面板 & 记忆与转存闭环)
     ========================================================================== */
  function openAgentDialog() {
    document.getElementById('shiguangDrawerOverlay').classList.add('active');
    const scroll = document.getElementById('shiguangTurnsContainer');
    if (scroll && state.agentChatHistory.length > 0) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  }

  function closeAgentDialog() {
    document.getElementById('shiguangDrawerOverlay').classList.remove('active');
  }

  function closeAgentOnBg(e) {
    if (e.target.id === 'shiguangDrawerOverlay') {
      closeAgentDialog();
    }
  }

  function openAgentMemorySheet() {
    document.getElementById('agentMemorySheetOverlay').classList.add('active');
  }

  function closeAgentMemorySheet() {
    document.getElementById('agentMemorySheetOverlay').classList.remove('active');
  }

  function handleSuggestChoice(topic) {
    executeAgentChat(topic);
  }

  function handleTextareaInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    document.getElementById('agentSendBtn').disabled = !textarea.value.trim();
  }

  async function handleAgentSend() {
    const textarea = document.getElementById('agentInputText');
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    textarea.style.height = '40px';
    document.getElementById('agentSendBtn').disabled = true;
    await executeAgentChat(text);
  }

  async function executeAgentChat(userText) {
    const container = document.getElementById('shiguangTurnsContainer');
    const welcome = document.getElementById('shiguangWelcomeZone');
    if (welcome) welcome.style.display = 'none';

    // 用户消息气泡
    const userBubble = document.createElement('div');
    userBubble.className = 'shiguang-turn user-turn';
    userBubble.innerHTML = `<div class="shiguang-user-bubble">${escapeHtml(userText)}</div>`;
    container.appendChild(userBubble);
    container.scrollTop = container.scrollHeight;

    // 助手思考中占位气泡
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'shiguang-turn assistant-turn';
    loadingBubble.id = 'shiguangLoadingTurn';
    loadingBubble.innerHTML = `<div class="shiguang-assistant-body" style="color:var(--color-muted);">正在整理记忆……</div>`;
    container.appendChild(loadingBubble);
    container.scrollTop = container.scrollHeight;

    state.agentChatHistory.push({ role: 'user', content: userText });

    let res = null;
    try {
      res = await api.sendAgentChat(userText, state.agentChatHistory);
    } catch (_) {
      res = { success: false };
    }

    loadingBubble.remove();

    if (!res || !res.success || !res.reply) {
      const errBubble = document.createElement('div');
      errBubble.className = 'shiguang-turn assistant-turn';
      
      const errBody = document.createElement('div');
      errBody.className = 'shiguang-assistant-body';
      errBody.style.color = 'var(--color-muted)';
      errBody.textContent = '暂时没能回复，请稍后重试。';
      errBubble.appendChild(errBody);

      const actionBar = document.createElement('div');
      actionBar.className = 'shiguang-action-bar';
      const retryBtn = document.createElement('button');
      retryBtn.className = 'shiguang-action-btn';
      retryBtn.textContent = '重新发送';
      retryBtn.addEventListener('click', () => retryAgentChat(userText));
      actionBar.appendChild(retryBtn);
      errBubble.appendChild(actionBar);

      container.appendChild(errBubble);
      container.scrollTop = container.scrollHeight;
      return;
    }

    state.agentChatHistory.push({ role: 'assistant', content: res.reply });

    const aiBubble = document.createElement('div');
    aiBubble.className = 'shiguang-turn assistant-turn';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'shiguang-assistant-body';

    const textEl = document.createElement('div');
    if (window.ShiguangMarkdown) {
      window.ShiguangMarkdown.render(textEl, res.reply);
    } else {
      textEl.textContent = res.reply;
      textEl.style.whiteSpace = 'pre-wrap';
    }
    bodyEl.appendChild(textEl);

    if (res.isExample) {
      const exEl = document.createElement('div');
      exEl.style.cssText = 'font-size:12px; color:var(--color-muted); margin-top:8px;';
      exEl.textContent = '[示例回复]';
      bodyEl.appendChild(exEl);
    }

    if (res.memoryRef) {
      const mem = res.memoryRef;
      // 区分缩略图与大图地址：大图必须优先使用原图 mem.url，缺失时退到 mem.thumb；缩略图优先取 mem.thumb
      const memOriginalUrl = api.resolveAssetUrl(mem.url || mem.thumb || '');
      const memThumbUrl = api.resolveAssetUrl(mem.thumb || mem.url || '');

      const plaque = document.createElement('div');
      plaque.style.cssText = 'margin-top:12px; padding:12px 14px; border:1px solid var(--color-divider); border-radius:var(--radius-sm); background:var(--color-surface); display:flex; justify-content:space-between; align-items:center; cursor:pointer;';
      plaque.title = '点击查看此段回忆照片';

      // 使用事件监听闭包，杜绝 HTML 字符串转义漏洞与脚本注入
      plaque.addEventListener('click', () => {
        openImageViewerForMemory(mem.title || '回忆', mem.date || '', memOriginalUrl);
      });

      const leftBox = document.createElement('div');
      leftBox.style.cssText = 'display:flex; align-items:center; gap:12px;';

      const thumbBox = document.createElement('div');
      thumbBox.style.cssText = 'width:40px; height:40px; border-radius:4px; overflow:hidden; background:var(--color-surface-subtle); display:flex; align-items:center; justify-content:center;';

      if (memThumbUrl && (memThumbUrl.includes('/') || /\.(jpg|jpeg|png|webp|gif)/i.test(memThumbUrl))) {
        const img = document.createElement('img');
        img.src = memThumbUrl;
        img.alt = mem.title || '回忆缩略图';
        img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
        thumbBox.appendChild(img);
      } else {
        thumbBox.innerHTML = '<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%;"><rect width="160" height="200" fill="#d9745b"/><circle cx="80" cy="130" r="35" fill="#f8d07e"/><rect y="150" width="160" height="50" fill="#2d3748"/></svg>';
      }
      leftBox.appendChild(thumbBox);

      const infoBox = document.createElement('div');
      const dateEl = document.createElement('div');
      dateEl.style.cssText = 'font-size:12px; color:var(--color-accent); font-weight:600;';
      dateEl.textContent = (mem.date || '回忆时光') + (mem.location ? ' · ' + mem.location : '');
      infoBox.appendChild(dateEl);

      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:14px; font-weight:600; margin-top:2px; color:var(--color-ink);';
      titleEl.textContent = mem.title || '画廊瞬间';
      infoBox.appendChild(titleEl);

      leftBox.appendChild(infoBox);
      plaque.appendChild(leftBox);

      const actionBox = document.createElement('div');
      actionBox.style.cssText = 'display:flex; align-items:center; gap:4px; color:var(--color-accent); font-size:13px; font-weight:500;';
      actionBox.innerHTML = '<span>查看</span><span>↗</span>';
      plaque.appendChild(actionBox);

      bodyEl.appendChild(plaque);
    }

    aiBubble.appendChild(bodyEl);

    // 动作栏：通过闭包绑定事件，传递完整多行文本与结构化草稿
    const actionBar = document.createElement('div');
    actionBar.className = 'shiguang-action-bar';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'shiguang-action-btn';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', () => copyAgentText(res.reply));
    actionBar.appendChild(copyBtn);

    const moreBtn = document.createElement('button');
    moreBtn.className = 'shiguang-action-btn';
    moreBtn.textContent = '更多 ···';
    moreBtn.addEventListener('click', () => openAgentActionMenu(res.reply, res.draft));
    actionBar.appendChild(moreBtn);

    aiBubble.appendChild(actionBar);
    container.appendChild(aiBubble);
    container.scrollTop = container.scrollHeight;
  }

  function retryAgentChat(text) {
    executeAgentChat(text);
  }

  function copyAgentText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板');
    } else {
      showToast('复制完成');
    }
  }

  function openAgentActionMenu(text, draft = null) {
    state.currentActionMenuText = text;
    state.currentActionMenuDraft = draft;
    document.getElementById('agentActionMenuOverlay').classList.add('active');
  }

  function closeAgentActionMenu() {
    document.getElementById('agentActionMenuOverlay').classList.remove('active');
  }

  function triggerActionMenuWhisper() {
    closeAgentActionMenu();
    let textToUse = state.currentActionMenuText;
    let titleToUse = '来自拾光的悄悄话';
    const draft = state.currentActionMenuDraft;

    const optionsContainer = document.getElementById('writeLetterDraftOptions');
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      if (draft && draft.type === 'whisper' && Array.isArray(draft.options) && draft.options.length > 0) {
        optionsContainer.style.display = 'flex';
        draft.options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `btn-secondary draft-option-btn ${idx === 0 ? 'active' : ''}`;
          btn.style.cssText = 'text-align:left; padding:8px 12px; font-size:13px; line-height:1.4; border-radius:6px; cursor:pointer; margin-bottom:4px;';
          btn.textContent = `候选 ${idx + 1}：“${opt}”`;
          btn.addEventListener('click', () => {
            optionsContainer.querySelectorAll('.draft-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const contentInput = document.getElementById('writeLetterContent');
            if (contentInput) contentInput.value = opt;
          });
          optionsContainer.appendChild(btn);
        });
        textToUse = draft.options[0];
      } else {
        optionsContainer.style.display = 'none';
        if (draft && draft.content) {
          textToUse = draft.content;
        }
      }
    } else {
      if (draft && draft.type === 'whisper' && Array.isArray(draft.options) && draft.options.length > 0) {
        textToUse = draft.options[0];
      } else if (draft && draft.content) {
        textToUse = draft.content;
      }
    }

    const contentInput = document.getElementById('writeLetterContent');
    const titleInput = document.getElementById('writeLetterTitle');
    if (contentInput) contentInput.value = textToUse;
    if (titleInput) titleInput.value = titleToUse;
    const modal = document.getElementById('writeLetterModal');
    if (modal) modal.classList.add('active');
  }

  function triggerActionMenuStory() {
    closeAgentActionMenu();
    let textToUse = state.currentActionMenuText;
    let titleToUse = '生活点滴记录';
    const draft = state.currentActionMenuDraft;
    if (draft && draft.type === 'date_plan') {
      titleToUse = draft.title || '周末漫步与寻味提案';
      textToUse = draft.content || textToUse;
    } else if (draft && draft.type === 'whisper' && Array.isArray(draft.options) && draft.options.length > 0) {
      titleToUse = '美好留言摘录';
      textToUse = draft.options[0];
    }
    openStoryDraftModal(textToUse, null, titleToUse);
  }

  /* ==========================================================================
     14. 页面初始化绑定与 DOM 监听
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // 绑定基础事件
    document.getElementById('btnDailyQuoteRefresh').onclick = handleRefreshDailyQuote;
    document.getElementById('heroCoverMediaBox').onclick = () => {
      if (state.heroPhotos.length > 0) {
        state.viewerPhotoList = state.heroPhotos;
        state.currentViewerIndex = state.heroCarouselIndex;
        openImageViewer();
      }
    };
    document.getElementById('btnViewerPrev').onclick = prevViewerImage;
    document.getElementById('btnViewerNext').onclick = nextViewerImage;
    document.getElementById('btnViewerClose').onclick = closeImageViewer;
    document.getElementById('btnViewerSetHero').onclick = handleSetAsHeroFromViewer;
    document.getElementById('btnViewerMove').onclick = handleMovePhotoFromViewer;
    document.getElementById('btnViewerDelete').onclick = handleDeletePhotoFromViewer;

    document.getElementById('btnConfirmMovePhoto').onclick = confirmMovePhoto;
    document.getElementById('btnCancelMovePhoto').onclick = () => {
      document.getElementById('movePhotoModal').classList.remove('active');
    };

    document.getElementById('btnManageAlbum').onclick = toggleManageMode;
    document.getElementById('btnDailyCheckin').onclick = handleDailyCheckin;

    document.getElementById('btnSubmitUploadQueue').onclick = () => startQueueUpload();
    const dropzone = document.getElementById('uploadDropzone');
    if (dropzone) {
      dropzone.onclick = () => {
        document.getElementById('fileUploadInput').click();
      };
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files) {
          handleFileSelection(e.dataTransfer.files);
        }
      });
    }
    document.getElementById('fileUploadInput').onchange = (e) => {
      handleFileSelection(e.target.files);
    };

    // 头像上传
    document.getElementById('avatarWrapBoy').onclick = () => {
      document.getElementById('avatarFileInputBoy').click();
    };
    document.getElementById('avatarFileInputBoy').onchange = (e) => {
      handleAvatarUpload('left', e.target);
    };

    document.getElementById('avatarWrapGirl').onclick = () => {
      document.getElementById('avatarFileInputGirl').click();
    };
    document.getElementById('avatarFileInputGirl').onchange = (e) => {
      handleAvatarUpload('right', e.target);
    };

    // 键盘监听大图查看
    document.addEventListener('keydown', (e) => {
      const viewer = document.getElementById('viewerOverlay');
      if (viewer && viewer.classList.contains('active')) {
        if (e.key === 'Escape') closeImageViewer();
        if (e.key === 'ArrowLeft') prevViewerImage();
        if (e.key === 'ArrowRight') nextViewerImage();
      }
    });

    // 退出登录
    document.getElementById('btnLogout').onclick = async () => {
      const confirmed = await showAppConfirm({
        title: '退出登录',
        message: '确定要退出当前生活画廊账号吗？',
        confirmText: '退出登录',
        isDanger: true
      });
      if (confirmed) {
        await api.logout();
        window.location.href = api.getLoginUrl();
      }
    };
  });

  // 全面挂载至 window，供 HTML 内联事件 100% 顺畅调用
  window.showToast = showToast;
  window.showAppConfirm = showAppConfirm;
  window.showAppAlert = showAppAlert;
  window.switchPage = switchPage;
  window.filterByTag = filterByTag;
  window.toggleSelectCard = toggleSelectCard;
  window.openSinglePhotoViewerFromStory = openSinglePhotoViewerFromStory;
  window.openImageViewerForMemory = openImageViewerForMemory;
  window.selectAllPhotos = selectAllPhotos;
  window.batchDeletePhotos = batchDeletePhotos;
  window.openBatchMoveDialog = openBatchMoveDialog;
  window.confirmMovePhoto = confirmMovePhoto;
  window.navigateToFolder = navigateToFolder;
  window.openCreateFolderDialog = openCreateFolderDialog;
  window.closeCreateFolderDialog = closeCreateFolderDialog;
  window.confirmCreateFolder = confirmCreateFolder;
  window.openRenameFolderDialog = openRenameFolderDialog;
  window.closeRenameFolderDialog = closeRenameFolderDialog;
  window.confirmRenameFolder = confirmRenameFolder;
  window.confirmDeleteCurrentFolder = confirmDeleteCurrentFolder;
  window.openHeroChangeMenu = openHeroChangeMenu;
  window.closeHeroChangeMenu = closeHeroChangeMenu;
  window.openHeroPhotoPicker = openHeroPhotoPicker;
  window.closeHeroPhotoPicker = closeHeroPhotoPicker;
  window.toggleHeroPickerItem = toggleHeroPickerItem;
  window.confirmHeroPickerSelection = confirmHeroPickerSelection;
  window.resetToAutoHero = resetToAutoHero;
  window.setupHeroCarousel = setupHeroCarousel;
  window.stopHeroAutoPlay = stopHeroAutoPlay;
  window.triggerHeroPhotoUpload = triggerHeroPhotoUpload;
  window.handleHeroUpload = handleHeroUpload;
  window.switchWishesTab = switchWishesTab;
  window.switchTaskTab = switchTaskTab;
  window.handleTaskAction = handleTaskAction;
  window.filterShopCategory = filterShopCategory;
  window.openExchangeConfirmModal = openExchangeConfirmModal;
  window.closeExchangeConfirmModal = closeExchangeConfirmModal;
  window.executeExchange = executeExchange;
  window.openBackpackModal = openBackpackModal;
  window.closeBackpackModal = closeBackpackModal;
  window.triggerUseItem = triggerUseItem;
  window.confirmUseItem = confirmUseItem;
  window.toggleSecretAuthMode = toggleSecretAuthMode;
  window.inputPin = inputPin;
  window.deletePin = deletePin;
  window.clearPin = clearPin;
  window.verifyPinCode = verifyPinCode;
  window.submitSecretTextPassword = submitSecretTextPassword;
  window.lockPrivateSpace = lockPrivateSpace;
  window.enterPrivateSpace = enterPrivateSpace;
  window.resetPrivateSpaceStateAndDOM = resetPrivateSpaceStateAndDOM;
  window.switchPrivateTab = switchPrivateTab;
  window.openCreateNoteModal = openCreateNoteModal;
  window.closeCreateNoteModal = closeCreateNoteModal;
  window.confirmSaveNote = confirmSaveNote;
  window.showPrivateNoteDetail = showPrivateNoteDetail;
  window.closeNoteDetailModal = closeNoteDetailModal;
  window.deletePrivateNoteAction = deletePrivateNoteAction;
  window.handleSecretFileUpload = handleSecretFileUpload;
  window.deletePrivateFileAction = deletePrivateFileAction;
  window.refreshPendingDevices = refreshPendingDevices;
  window.approvePendingDevice = approvePendingDevice;
  window.denyPendingDevice = denyPendingDevice;
  window.revokePendingDevice = revokePendingDevice;
  window.openLetterModal = openLetterModal;
  window.closeLetterModal = closeLetterModal;
  window.showNextWhisper = showNextWhisper;
  window.handleLetterReadDone = handleLetterReadDone;
  window.archiveLetterAction = archiveLetterAction;
  window.openWriteLetterModal = openWriteLetterModal;
  window.closeWriteLetterModal = closeWriteLetterModal;
  window.submitDirectLetter = submitDirectLetter;
  window.openStoryDraftModal = openStoryDraftModal;
  window.closeStoryDraftModal = closeStoryDraftModal;
  window.confirmSaveStory = confirmSaveStory;
  window.openAgentDialog = openAgentDialog;
  window.closeAgentDialog = closeAgentDialog;
  window.closeAgentOnBg = closeAgentOnBg;
  window.openAgentMemorySheet = openAgentMemorySheet;
  window.closeAgentMemorySheet = closeAgentMemorySheet;
  window.handleSuggestChoice = handleSuggestChoice;
  window.handleTextareaInput = handleTextareaInput;
  window.handleAgentSend = handleAgentSend;
  window.retryAgentChat = retryAgentChat;
  window.copyAgentText = copyAgentText;
  window.openAgentActionMenu = openAgentActionMenu;
  window.closeAgentActionMenu = closeAgentActionMenu;
  window.triggerActionMenuWhisper = triggerActionMenuWhisper;
  window.triggerActionMenuStory = triggerActionMenuStory;
  window.retryUploadItem = retryUploadItem;
  window.removeUploadQueueItem = removeUploadQueueItem;
  window.updateQueueItemTitle = updateQueueItemTitle;
  window.updateQueueItemTag = updateQueueItemTag;
  window.startQueueUpload = startQueueUpload;
  window.fillModalDefaultAccount = fillModalDefaultAccount;
  window.openLoginModal = openLoginModal;
  window.closeLoginModal = closeLoginModal;
  window.handleDesktopLogin = handleDesktopLogin;
})();
