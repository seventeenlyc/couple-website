/**
 * 我们之间 · 生活画廊 (H5 移动端数据与后端 API 真实通信层)
 * 深度对接 Fastify + SQLite 真实后端全套接口：
 *   - /api/csrf-token.php & /api/app-config.php (会话、CSRF 与情侣天数)
 *   - /api/daily-quote.php & /api/anniversary-reminders.php (今日一句与倒计时)
 *   - /api/balance.php, /api/checkin.php, /api/tasks.php (任务、打卡与积分经济)
 *   - /api/shop.php & /api/virtual-items.php (心愿小铺兑换与道具背包)
 *   - /api/folders.php, /api/photos.php, /api/upload-photo.php (相册与图片多媒体)
 *   - /api/whispers.php (悄悄话与私密来信)
 *   - /api/story.php (故事时间线与编年节点)
 *   - /api/private-auth.php & /api/private-notes.php (私密空间独立验证与随笔)
 *   - /api/devices.php (设备安全与受信任会话)
 *   - /api/agent/chat (拾光 · 画廊生活助手 AI 问答与回忆检索)
 * 
 * Production requests never fall back to simulated writes or private browser caches.
 */

const STORAGE_KEYS = {
  POINTS: 'couple_h5_points',
  CHECKIN_DATE: 'couple_h5_last_checkin',
  CHECKIN_STREAK: 'couple_h5_streak',
  TASKS: 'couple_h5_tasks',
  PHOTOS: 'couple_h5_photos',
  FOLDERS: 'couple_h5_folders',
  LETTERS: 'couple_h5_letters',
  BAG: 'couple_h5_bag'
};

const SEED_DATA = {
  points: 520,
  streak: 7,
  lastCheckin: '2026-09-30',
  tasks: [
    { id: 't_seed_1', title: '周末一起去海边散步看落日', desc: '一起出门走走，吹吹海风，远离屏幕与工作压力。', reward: 20, status: 'pending', executor: '双方均可', verifier: '对方' },
    { id: 't_seed_2', title: '做一顿营养美味的晚餐', desc: '对方已于 19:30 提交完成，包含番茄牛腩与西兰花，等待你确认。', reward: 15, status: 'pending_partner', executor: '对方', verifier: '我' },
    { id: 't_seed_3', title: '给阳台绿植浇水松土', desc: '我已浇水松土完毕，正在等待对方确认。', reward: 10, status: 'my_completed', executor: '我', verifier: '对方' },
    { id: 't_seed_4', title: '一起看一部经典治愈电影', desc: '已由小鹿完成并由小林确认，奖励已发放。', reward: 15, status: 'done', executor: '小鹿', verifier: '小林' }
  ],
  photos: [
    {
      id: 'p1',
      title: '那天没有计划，只是一起走了很远。',
      date: '09.28',
      days: 520,
      folder: '厦门旅行',
      tag: '风景',
      aspect: '16/10',
      type: 'sunset',
      caption: '傍晚环岛路的海风与余晖'
    },
    {
      id: 'p2',
      title: '午后咖啡与书店',
      date: '09.21',
      days: 513,
      folder: '厦门旅行',
      tag: '日常',
      aspect: '4/5',
      type: 'coffee',
      caption: '老巷子里的手冲咖啡馆'
    },
    {
      id: 'p3',
      title: '路口遇到的小花猫',
      date: '09.15',
      days: 507,
      folder: '猫咪日记',
      tag: '日常',
      aspect: '4/5',
      type: 'cat',
      caption: '路口偶遇的那只打哈欠小花猫'
    },
    {
      id: 'p4',
      title: '植物园温室奇遇',
      date: '09.18',
      days: 510,
      folder: '厦门旅行',
      tag: '风景',
      aspect: '4/5',
      type: 'plant',
      caption: '绿意盎然的植物园大温室'
    },
    {
      id: 'p5',
      title: '白色灯塔远景',
      date: '09.12',
      days: 504,
      folder: '厦门旅行',
      tag: '风景',
      aspect: '4/5',
      type: 'tower',
      caption: '海风吹拂的白色灯塔'
    }
  ],
  letters: [
    {
      id: 'l1',
      from: '小鹿',
      date: '2026.09.28 22:30',
      unread: true,
      title: '那天海边的风',
      content: '那天在海边吹风的时候，看着天色一点点暗下去，突然觉得平淡的日子只要是和你在一起，就很值得被好好记录下来。\n\n晚上散步回去买的那杯热奶茶很甜，希望我们一直像这样，慢慢走，走很久很久。'
    }
  ],
  shopItems: [
    { id: 'prod_1', name: '贴贴券', cost: 52, image: 'assets/images/products/hug.png', desc: '随时发起一个超过30秒的温暖贴贴', category: 'virtual' },
    { id: 'prod_2', name: '亲亲券', cost: 52, image: 'assets/images/products/qinqinquan.png', desc: '兑换一枚专属甜蜜轻吻', category: 'virtual' },
    { id: 'prod_3', name: '按摩券', cost: 68, image: 'assets/images/products/anmoquan.png', desc: '享用20分钟纯手工肩颈放松按摩', category: 'virtual' },
    { id: 'prod_4', name: '约会券', cost: 128, image: 'assets/images/products/yuehuiquan.png', desc: '策划一次浪漫的两人专属约会行程', category: 'virtual' },
    { id: 'prod_5', name: '免做家务券', cost: 128, image: 'assets/images/products/jiawuquan.png', desc: '晚餐后碗筷与卫生全包，悠闲躺平', category: 'virtual' },
    { id: 'prod_6', name: '零食券', cost: 128, image: 'assets/images/products/lingshiquan.png', desc: '选购想吃的小零食无条件满足', category: 'physical' },
    { id: 'prod_7', name: '和好券', cost: 288, image: 'assets/images/products/hehaoquan.jpg', desc: '闹别扭时无条件和好拥抱', category: 'virtual' },
    { id: 'prod_8', name: '电影票', cost: 328, image: 'assets/images/products/film.jpg', desc: '两张院线电影票，一起看期待已久的电影', category: 'physical' },
    { id: 'prod_9', name: '做饭券', cost: 328, image: 'assets/images/products/zuofanquan.png', desc: '为你定制做一顿丰盛的爱心大餐', category: 'virtual' },
    { id: 'prod_10', name: '玫瑰花束', cost: 520, image: 'assets/images/products/roses.png', desc: '一束新鲜手捧玫瑰，送给最特别的你', category: 'physical' },
    { id: 'prod_11', name: '无理券', cost: 648, image: 'assets/images/products/wuliquan.png', desc: '可以提出一个合理范围内的小任性要求', category: 'virtual' }
  ]
};

class GalleryApiClient {
  constructor() {
    this.csrfToken = '';
    this.currentUser = null;
    this.currentUserId = null;
    this.isLoggedIn = false;
    this.appConfig = null;
    this.apiBaseUrl = '';
    try {
      if (typeof window !== 'undefined' && window.location) {
        const port = window.location.port;
        const protocol = window.location.protocol;
        if (protocol === 'file:' || (port && port !== '19085')) {
          this.apiBaseUrl = 'http://127.0.0.1:19085';
        }
      }
    } catch (_) {}
    this.initStorage();
  }

  resolveApiUrl(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    const clean = url.startsWith('/') ? url : '/' + url;
    if (this.apiBaseUrl) {
      return this.apiBaseUrl + clean;
    }
    return clean;
  }

  initStorage() {
    // Production data is loaded from the authenticated API, never seeded in browser storage.
  }

  // --------------------------------------------------------------------------
  // 通用网络请求底层封装 (带 CSRF Token 与跨域/凭证支持)
  // --------------------------------------------------------------------------
  async request(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers ? { ...options.headers } : {};

    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      if (!this.csrfToken) {
        await this.fetchCsrfToken();
      }
      if (this.csrfToken && !headers['X-CSRF-Token']) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
    }

    const fetchOpts = {
      ...options,
      method,
      headers,
      credentials: 'include'
    };

    const finalUrl = this.resolveApiUrl(url);
    return fetch(finalUrl, fetchOpts);
  }

  // --------------------------------------------------------------------------
  // 1. 会话初始化与 CSRF Token 获取
  // --------------------------------------------------------------------------
  async fetchCsrfToken() {
    try {
      const targetUrl = this.resolveApiUrl('/api/csrf-token.php');
      const res = await fetch(targetUrl, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.csrf_token) {
          this.csrfToken = data.csrf_token;
        }
        this.isLoggedIn = !!data.logged_in;
        this.currentUser = data.user || null;
        this.currentUserId = data.user_id || null;
        return data;
      }
    } catch (e) {
      console.warn('[ApiClient] fetchCsrfToken warning:', e.message);
    }
    return null;
  }

  async initSession() {
    await this.fetchCsrfToken();
    const cfg = await this.getAppConfig();
    return {
      isLoggedIn: this.isLoggedIn,
      user: this.currentUser,
      config: cfg
    };
  }

  // --------------------------------------------------------------------------
  // 2. 站点元信息、相伴天数与今日短句
  // --------------------------------------------------------------------------
  async getAppConfig() {
    try {
      const res = await this.request('/api/app-config.php');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.appConfig = data;
          this.isLoggedIn = true;
          if (data.current_user) this.currentUser = data.current_user;
          if (data.current_user_id) this.currentUserId = data.current_user_id;
          return data;
        }
      }
    } catch (_) {}
    return { success: false, logged_in: false, users: [], message: '无法加载站点配置' };
  }

  async getDailyQuote() {
    try {
      const res = await this.request('/api/daily-quote.php');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && typeof data.quote === 'string' && data.quote.trim()) {
          return data.quote.trim();
        }
      }
    } catch (_) {}
    return null;
  }

  async getAnniversaryReminders() {
    try {
      const res = await this.request('/api/anniversary-reminders.php');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reminders)) {
          return data.reminders;
        }
      }
    } catch (_) {}
    return [];
  }

  // --------------------------------------------------------------------------
  // 3. 经济系统：积分余额、每日打卡
  // --------------------------------------------------------------------------
  async getPoints() {
    try {
      const res = await this.request('/api/balance.php');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.balance === 'number') {
          localStorage.setItem(STORAGE_KEYS.POINTS, String(data.balance));
          return data.balance;
        }
      }
    } catch (_) {}
    return null;
  }

  async getCheckinStatus() {
    try {
      const res = await this.request('/api/balance.php');
      const data = await res.json();
      if (res.ok && data.success) {
        return { ...data, checked_in: Boolean(data.checked_in_today), streak: data.streak_days, last_date: data.last_checkin };
      }
    } catch (_) {}
    return { success: false, checked_in: false, streak: 0, last_date: null };
  }

  async doCheckin() {
    try {
      const res = await this.request('/api/checkin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (typeof data.balance === 'number') {
            localStorage.setItem(STORAGE_KEYS.POINTS, String(data.balance));
          }
          return { ...data, streak: data.streak_days };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  // --------------------------------------------------------------------------
  // 4. 每日任务系统 (拉取、标记完成、对方确认) - 规范 10.3 双人状态闭环
  // --------------------------------------------------------------------------
  async getTasks() {
    try {
      const res = await this.request('/api/tasks.php?action=get_today');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tasks) && data.tasks.length > 0) {
          return data.tasks.map(t => {
            // state: 'done' | 'my_completed' | 'pending_partner' | 'pending'
            const state = t.state || 'pending';
            return {
              id: t.id,
              taskId: t.task_id || t.id,
              title: t.title,
              desc: t.description || '生活细节分工，互相体贴。',
              reward: t.reward || 15,
              status: state,
              rawState: state,
              executor: state === 'pending_partner' ? '对方' : (state === 'my_completed' ? '我' : '双方均可'),
              verifier: state === 'pending_partner' ? '我' : '对方'
            };
          });
        }
      }
    } catch (_) {}
    return [];
  }

  async completeTask(taskId) {
    try {
      const res = await this.request('/api/tasks.php?action=mark_complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) return data;
        return { success: false, message: data.message || '标记完成失败' };
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async confirmTask(taskId) {
    try {
      const res = await this.request('/api/tasks.php?action=confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await this.getPoints();
          return data;
        }
        return { success: false, message: data.message || '确认完成失败' };
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }


  // --------------------------------------------------------------------------
  // 5. 心愿小铺与虚拟道具 (兑换、背包查看、使用、确认闭环) - 规范 10.4
  // --------------------------------------------------------------------------
  async getShopProducts(category = null) {
    try {
      const res = await this.request('/api/shop.php?action=get_all');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
          let list = data.products.map(p => {
            const finalCost = p.display_price !== undefined ? p.display_price : (p.price_info ? p.price_info.final_price : p.price);
            return {
              id: p.id,
              name: p.name || p.title,
              cost: finalCost,
              originalCost: p.price,
              desc: p.description || '',
              category: p.category || (p.name && p.name.includes('券') ? 'virtual' : 'physical'),
              image: p.image || '',
              stock: p.stock !== undefined ? p.stock : 999
            };
          });

          if (category && category !== 'all') {
            if (category === 'coupon' || category === 'virtual') {
              list = list.filter(p => p.category === 'virtual' || (p.name && p.name.includes('券')));
            } else if (category === 'gift' || category === 'physical') {
              list = list.filter(p => p.category === 'physical' || (!p.name || !p.name.includes('券')));
            }
          }
          return list;
        }
      }
    } catch (_) {}
    return [];
  }

  async getShopItems(category = null) {
    return this.getShopProducts(category);
  }

  async purchaseItem(productId, price, partnerNote) {
    return this.buyProduct(productId);
  }

  async buyProduct(productId) {
    try {
      const res = await this.request('/api/shop.php?action=purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          csrf_token: this.csrfToken
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await this.getPoints();
          return {
            success: true,
            message: data.message || '购买成功！已放入背包。',
            order_id: data.order_id,
            product: data.product
          };
        }
        return { success: false, message: data.message || '兑换失败，请检查积分或库存' };
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async getVirtualItems() {
    try {
      const res = await this.request('/api/virtual-items.php?action=get_my_items');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          return data.items;
        }
      }
    } catch (_) {}
    return [];
  }

  async useVirtualItem(itemId) {
    try {
      const res = await this.request('/api/virtual-items.php?action=use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async confirmVirtualItem(itemId) {
    try {
      const res = await this.request('/api/virtual-items.php?action=confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async getPendingConfirmations() {
    try {
      const res = await this.request('/api/virtual-items.php?action=get_pending_confirmations');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          return data.items;
        }
      }
    } catch (_) {}
    return [];
  }

  async exchangeItem(item) {
    return this.buyProduct(item.id);
  }

  // --------------------------------------------------------------------------
  // 6. 相册与照片流 (树状目录、文件夹与多文件上传)
  // --------------------------------------------------------------------------
  async getAlbumTree(path = '') {
    const cleanPath = path ? path.replace(/^\/+|\/+$/g, '') : '';
    try {
      const res = await this.request(`/api/folders.php?action=list&context=album&path=${encodeURIComponent(cleanPath)}&include_all_folders=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const breadcrumbs = data.breadcrumbs || [];
          const childFolders = (data.folders || []).map(f => ({
            ...f,
            path: f.path ? f.path.replace(/^\/+/, '') : '',
            photo_count: f.photo_count != null ? f.photo_count : (f.file_count != null ? f.file_count : 0)
          }));
          const files = (data.files || []).map(p => ({
            id: p.id,
            title: p.title || p.description || p.filename,
            caption: p.description || p.title || '',
            url: '/' + (p.original_path || p.path || p.filepath || p.thumbnail_path || p.thumb_path || '').replace(/^\/+/, ''),
            thumbUrl: '/' + (p.thumbnail_path || p.thumb_path || p.original_path || p.path || p.filepath || '').replace(/^\/+/, ''),
            date: (p.created_at || '').slice(5, 10).replace('-', '.'),
            folder: p.folder_path ? p.folder_path.replace(/^\/+/, '') : '相册',
            tag: Array.isArray(p.tags) && p.tags[0] ? p.tags[0] : '日常',
            tags: Array.isArray(p.tags) ? p.tags : []
          }));
          const allFolders = (data.all_folders || []).map(f => ({
            ...f,
            path: f.path ? f.path.replace(/^\/+/, '') : '',
            photo_count: f.photo_count != null ? f.photo_count : (f.file_count != null ? f.file_count : 0)
          }));
          return {
            currentPath: cleanPath,
            breadcrumbs,
            folders: childFolders,
            files,
            allFolders,
            totalCount: data.total_count ?? files.length
          };
        }
      }
    } catch (_) {}
    return { success: false, folders: [], files: [], allFolders: [], totalCount: 0 };
  }

  async getFolders(context = 'album') {
    try {
      const res = await this.request(`/api/folders.php?action=list&context=${encodeURIComponent(context)}&include_all_folders=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.folders)) {
          const list = (data.all_folders && data.all_folders.length > 0) ? data.all_folders : data.folders;
          return list.map(f => ({
            ...f,
            photo_count: f.photo_count != null ? f.photo_count : (f.file_count != null ? f.file_count : 0)
          }));
        }
      }
    } catch (_) {}
    return [];
  }

  async createFolder(name, parentPath = '') {
    const cleanParent = parentPath ? parentPath.replace(/^\/+|\/+$/g, '') : '';
    const trimmedName = name.trim();
    try {
      const res = await this.request('/api/folders.php?action=create&context=album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_name: trimmedName,
          name: trimmedName,
          parent_path: cleanParent ? ('/' + cleanParent) : '/',
          context: 'album',
          csrf_token: this.csrfToken || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: data.message || '文件夹创建成功', folder: data.folder };
        } else {
          return { success: false, message: data.message || '创建文件夹失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async renameFolder(folderPath, newName) {
    const cleanPath = folderPath ? ('/' + folderPath.replace(/^\/+|\/+$/g, '')) : '';
    const trimmedName = newName.trim();
    try {
      const res = await this.request('/api/folders.php?action=rename&context=album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: cleanPath,
          new_name: trimmedName,
          csrf_token: this.csrfToken || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: data.message || '重命名成功', folder: data.folder };
        } else {
          return { success: false, message: data.message || '重命名失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async deleteFolder(folderPath) {
    const cleanPath = folderPath ? ('/' + folderPath.replace(/^\/+|\/+$/g, '')) : '';
    if (!cleanPath) {
      return { success: false, message: '无效的目标文件夹路径' };
    }

    const syncLocal = () => {
      const rawTarget = cleanPath.replace(/^\/+/, '');
      let localFolders = JSON.parse(localStorage.getItem(STORAGE_KEYS.FOLDERS) || 'null') || [];
      localFolders = localFolders.filter(f => {
        const fPath = (f.path || '').replace(/^\/+/, '');
        return fPath !== rawTarget && !fPath.startsWith(rawTarget + '/');
      });
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(localFolders));

      let localPhotos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PHOTOS) || '[]');
      localPhotos = localPhotos.map(p => {
        const pFolder = (p.folder || '').replace(/^\/+/, '');
        if (pFolder === rawTarget || pFolder.startsWith(rawTarget + '/')) {
          return { ...p, folder: '全部' };
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(localPhotos));
    };

    try {
      if (!this.csrfToken) await this.fetchCsrfToken();
      const res = await this.request('/api/folders.php?action=delete&context=album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: cleanPath,
          csrf_token: this.csrfToken || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          syncLocal();
          return { success: true, message: data.message || '文件夹已删除' };
        } else {
          return { success: false, message: data.message || '删除文件夹失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async movePhoto(photoId, targetPath) {
    const normTarget = targetPath ? ('/' + targetPath.replace(/^\/+|\/+$/g, '')) : '/';
    try {
      const res = await this.request('/api/folders.php?action=move&context=album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: photoId,
          target_path: normTarget,
          csrf_token: this.csrfToken || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: data.message || '照片已移动' };
        } else {
          return { success: false, message: data.message || '移动照片失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async deletePhoto(photoId) {
    try {
      const res = await this.request('/api/photos.php?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photoId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: '照片已从相册删除' };
        } else {
          return { success: false, message: data.message || '删除照片失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async getPhotos(folderPath = null, tag = null) {
    try {
      let url = '/api/photos.php?action=list';
      if (folderPath && folderPath !== '/' && folderPath !== '全部') {
        url += `&folder_path=${encodeURIComponent(folderPath)}`;
      }
      if (tag && tag !== '全部') url += `&tag=${encodeURIComponent(tag)}`;
      const res = await this.request(url);
      if (res.ok) {
        const data = await res.json();
        // 关键修复：只要后端返回成功并且 photos 是有效数组（即使是空数组 []），就使用真实数据，绝不误落入 fallback
        if (data.success && Array.isArray(data.photos)) {
          return data.photos.map(p => ({
            id: p.id,
            title: p.title || p.description || p.filename,
            caption: p.description || p.title || '',
            url: '/' + (p.original_path || p.path || p.filepath || p.thumbnail_path || p.thumb_path || '').replace(/^\/+/, ''),
            thumbUrl: '/' + (p.thumbnail_path || p.thumb_path || p.original_path || p.path || p.filepath || '').replace(/^\/+/, ''),
            date: (p.created_at || '').slice(5, 10).replace('-', '.'),
            folder: p.folder_path ? p.folder_path.replace(/^\/+/, '') : '相册',
            tag: Array.isArray(p.tags) && p.tags[0] ? p.tags[0] : '日常',
            tags: Array.isArray(p.tags) ? p.tags : []
          }));
        }
      }
    } catch (_) {}
    return [];
  }

  async uploadPhoto(firstArg, argFolderPath = '/', argTitle = '', argTags = '') {
    let file = null;
    let folderPath = '/';
    let title = '';
    let tags = '日常';

    if (firstArg && typeof firstArg === 'object' && firstArg.file) {
      file = firstArg.file;
      folderPath = firstArg.folderPath || firstArg.folder || '/';
      title = firstArg.title || firstArg.caption || '';
      tags = firstArg.tags || firstArg.tag || '日常';
    } else {
      file = firstArg;
      folderPath = argFolderPath || '/';
      title = argTitle || '';
      tags = argTags || '日常';
    }

    if (!file) {
      return { success: false, message: '请选择需要上传的照片文件' };
    }

    if (!folderPath || folderPath === '/' || folderPath === '全部') {
      folderPath = '/';
    } else {
      folderPath = '/' + String(folderPath).replace(/^\/+|\/+$/g, '');
    }

    try {
      if (!this.csrfToken) await this.fetchCsrfToken();
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('folder_path', folderPath);
      formData.append('tags', tags || '日常');
      formData.append('caption', title || file.name || '');
      formData.append('title', title || file.name || '');
      if (this.csrfToken) {
        formData.append('csrf_token', this.csrfToken);
      }

      const res = await this.request('/api/upload-photo.php', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: '照片上传成功', photo: data.photo };
        } else {
          return { success: false, message: data.message || '照片上传失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  // --------------------------------------------------------------------------
  // 7. 悄悄话与信件 (查看未读、历史记录、发送、标记已读)
  // --------------------------------------------------------------------------
  async checkUnreadWhispers() {
    try {
      const res = await this.request('/api/whispers.php?action=check_unread');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.whispers)) {
          return {
            success: true,
            has_unread: data.whispers.length > 0,
            has_new: data.whispers.length > 0,
            count: data.whispers.length,
            whispers: data.whispers.map(w => ({
              id: w.id,
              sender_id: w.sender_id || w.from_user,
              receiver_id: w.receiver_id || w.to_user,
              from: w.sender_name || '对方',
              date: w.created_at || '今日',
              unread: true,
              unread_for_me: true,
              is_from_me: false,
              is_to_me: true,
              is_read: false,
              read: false,
              title: w.title || '给你的悄悄话',
              content: w.content
            }))
          };
        }
      }
    } catch (_) {}
    return { success: false, has_unread: false, has_new: false, count: 0, whispers: [] };
  }

  async getWhispersHistory() {
    try {
      const res = await this.request('/api/whispers.php?action=get_history');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.whispers)) {
          return data.whispers.map(w => {
            const isFromMe = (w.is_from_me !== undefined)
              ? Boolean(w.is_from_me)
              : (w.from_user && this.currentUserId && String(w.from_user) === String(this.currentUserId));
            const isRead = Boolean(w.read || w.is_read);
            // 核心业务隔离：只有对方寄给我、且尚未阅读的信，才算作“我的未读信件”！
            // 我寄给对方的信，绝不能作为未读信件挂在我的主页！
            const unreadForMe = !isFromMe && !isRead;

            return {
              id: w.id,
              sender_id: w.sender_id || w.from_user,
              receiver_id: w.receiver_id || w.to_user,
              from: isFromMe ? (this.currentUser || '我') : (w.sender_name || '对方'),
              date: w.created_at || '今日',
              unread: unreadForMe,
              unread_for_me: unreadForMe,
              is_from_me: isFromMe,
              is_to_me: !isFromMe,
              is_read: isRead,
              read: isRead,
              title: w.title || (isFromMe ? '我留给TA的悄悄话' : '给你的悄悄话'),
              content: w.content
            };
          });
        }
      }
    } catch (_) {}
    return [];
  }

  async getLetters() {
    return this.getWhispersHistory();
  }

  async sendLetter(content, isPrivate = false) {
    return this.sendWhisper(content);
  }

  async sendWhisper(content) {
    try {
      if (!this.csrfToken) await this.fetchCsrfToken();
      const res = await this.request('/api/whispers.php?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return data;
        }
        return data;
      } else {
        const data = await res.json().catch(() => ({}));
        return { success: false, message: data.message || '发送失败' };
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }


  async markWhisperRead(whisperId) {
    try {
      if (!this.csrfToken) await this.fetchCsrfToken();
      const res = await this.request('/api/whispers.php?action=mark_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whisper_id: whisperId, csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }


  // --------------------------------------------------------------------------
  // 8. 故事时间线 (编年节点、自选日期与图片附件新增)
  // --------------------------------------------------------------------------
  async getStoryTimeline() {
    try {
      const res = await this.request('/api/story.php');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          return data.events;
        }
      }
    } catch (_) {}
    return [];
  }

  async getStoryEvents() {
    return this.getStoryTimeline();
  }

  async createStoryEvent({ title, content, date, location, photoFile }) {
    try {
      if (photoFile) {
        const formData = new FormData();
        formData.append('title', title || '');
        formData.append('content', content || '');
        formData.append('date', date || new Date().toISOString().slice(0, 10));
        formData.append('location', location || '');
        if (this.csrfToken) {
          formData.append('csrf_token', this.csrfToken);
        }
        formData.append('photo', photoFile);

        const res = await this.request('/api/story.php', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) return data;
          return data;
        } else {
          const data = await res.json().catch(() => ({}));
          return { success: false, message: data.message || '故事保存失败' };
        }
      } else {
        const res = await this.request('/api/story.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            date: date || new Date().toISOString().slice(0, 10),
            location: location || '',
            csrf_token: this.csrfToken
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) return data;
          return data;
        } else {
          const data = await res.json().catch(() => ({}));
          return { success: false, message: data.message || '故事保存失败' };
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  // --------------------------------------------------------------------------
  // 9. 私密空间 (常规密码认证、查看私密随笔、保存、删除、私密文件闭环与锁定)
  // --------------------------------------------------------------------------
  async verifyPrivatePassword(password) {
    if (!this.isLoggedIn) return { success: false, authenticated: false, message: '请先登录' };
    try {
      const res = await this.request('/api/private-auth.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', password, csrf_token: this.csrfToken })
      });
      const data = await res.json();
      if (res.ok && data.success && data.authenticated) return data;
      return { success: false, authenticated: false, message: data.message || '私密验证失败，请重试' };
    } catch (_) {
      return { success: false, authenticated: false, message: '无法连接服务器完成私密验证' };
    }
  }

  async checkPrivateAuth() {
    try {
      const res = await this.request('/api/private-auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', csrf_token: this.csrfToken })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return { success: false, authenticated: false };
  }

  async getPrivateNotes() {
    try {
      const res = await this.request('/api/private-notes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get',
          csrf_token: this.csrfToken
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notes)) {
          return data.notes;
        }
      }
    } catch (_) {}
    return [];
  }

  async addPrivateNote(title, content) {
    try {
      const res = await this.request('/api/private-notes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          title,
          content,
          csrf_token: this.csrfToken
        })
      });
      const data = await res.json();
      if (res.ok && data && data.success) {
        return data;
      } else {
        return { success: false, message: data?.message || '保存失败' };
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async deletePrivateNote(noteId) {
    try {
      const res = await this.request('/api/private-notes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          note_id: noteId,
          id: noteId,
          csrf_token: this.csrfToken
        })
      });
      const data = await res.json();
      if (res.ok && data && data.success) {
        return data;
      } else {
        return { success: false, message: data?.message || '删除失败' };
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async getPrivateFiles(folderPath = null) {
    try {
      let url = '/api/private-files.php?action=get';
      if (folderPath && folderPath !== '/') url += `&folder_path=${encodeURIComponent(folderPath)}`;
      const res = await this.request(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.files)) {
          return data.files;
        }
      }
    } catch (_) {}
    return [];
  }

  async uploadPrivateFile(file, folderPath = '/') {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'upload');
      formData.append('folder_path', folderPath);
      if (this.csrfToken) {
        formData.append('csrf_token', this.csrfToken);
      }

      const res = await this.request('/api/private-files.php', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      return data;
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async deletePrivateFile(fileId) {
    try {
      const res = await this.request('/api/private-files.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          file_id: fileId,
          csrf_token: this.csrfToken
        })
      });
      const data = await res.json();
      return data;
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  async logoutPrivate() {
    try {
      const res = await this.request('/api/private-auth.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', csrf_token: this.csrfToken })
      });
      const data = await res.json();
      return { ...data, success: res.ok && data.success === true };
    } catch (_) {
      return { success: false };
    }
  }

  // --------------------------------------------------------------------------
  // 10. 授权设备状态
  // --------------------------------------------------------------------------
  async getDeviceStatus() {
    try {
      const res = await this.request('/api/devices.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', csrf_token: this.csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) return data;
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }

  // --------------------------------------------------------------------------
  // 10.1 设备管理（管理员 list / approve / deny / revoke）
  // 真实端点：POST /api/devices.php，非管理员由后端返回 403。
  // --------------------------------------------------------------------------
  async getDeviceList() {
    try {
      const res = await this.request('/api/devices.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', csrf_token: this.csrfToken })
      });
      if (res.status === 403) {
        return { success: false, forbidden: true, message: '仅管理员可以管理设备' };
      }
      if (res.status === 401) {
        return { success: false, unauthorized: true, message: '请先登录' };
      }
      if (res.ok) {
        const data = await res.json();
        if (res.ok && data && data.success) {
          return { success: true, devices: Array.isArray(data.devices) ? data.devices : [] };
        }
        return { success: false, message: (data && data.message) || '设备列表获取失败' };
      }
      return { success: false, message: `设备列表请求失败 (${res.status})` };
    } catch (err) {
      return { success: false, networkError: true, message: err && err.message ? err.message : '网络连接异常' };
    }
  }

  async getPendingDevices() {
    const res = await this.getDeviceList();
    if (!res.success) return res;
    return {
      success: true,
      devices: res.devices.filter(d => d.status === 'pending'),
      all: res.devices
    };
  }

  async deviceAdminAction(action, payload = {}) {
    try {
      const res = await this.request('/api/devices.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action, csrf_token: this.csrfToken }, payload))
      });
      if (res.status === 403) {
        return { success: false, forbidden: true, message: '仅管理员可以管理设备' };
      }
      if (res.status === 401) {
        return { success: false, unauthorized: true, message: '请先登录' };
      }
      if (res.ok) {
        const data = await res.json();
        if (res.ok && data && data.success) return data;
        return { success: false, message: (data && data.message) || '操作失败' };
      }
      return { success: false, message: `操作失败 (${res.status})` };
    } catch (err) {
      return { success: false, networkError: true, message: err && err.message ? err.message : '网络连接异常' };
    }
  }

  async approveDevice(deviceId, code) {
    if (!deviceId) return { success: false, message: '缺少目标设备，无法批准' };
    return this.deviceAdminAction('approve', { id: String(deviceId), code: String(code || '') });
  }

  async denyDevice(deviceId) {
    if (!deviceId) return { success: false, message: '缺少目标设备，无法拒绝' };
    return this.deviceAdminAction('deny', { id: String(deviceId) });
  }

  async revokeDevice(deviceId) {
    if (!deviceId) return { success: false, message: '缺少目标设备，无法撤销' };
    return this.deviceAdminAction('revoke', { id: String(deviceId) });
  }

  // --------------------------------------------------------------------------
  // 10.2 双方头像上传（POST /api/upload-avatar.php，multipart 字段名 avatar）
  // --------------------------------------------------------------------------
  async uploadAvatar(side, file) {
    if (!file) return { success: false, message: '未选择图片文件' };
    try {
      if (!this.csrfToken) await this.fetchCsrfToken();
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('side', side === 'right' ? 'right' : 'left');
      if (this.csrfToken) formData.append('csrf_token', this.csrfToken);

      const res = await fetch('/api/upload-avatar.php', {
        method: 'POST',
        credentials: 'include',
        headers: this.csrfToken ? { 'X-CSRF-Token': this.csrfToken } : {},
        body: formData
      });

      if (res.status === 401) return { success: false, unauthorized: true, message: '请先登录后再更换头像' };
      if (res.status === 403) return { success: false, message: '请求校验失败，请刷新后重试' };
      if (res.ok) {
        const data = await res.json();
        if (res.ok && data && data.success) return data;
        return { success: false, message: (data && data.message) || '头像上传失败' };
      }
      return { success: false, message: `头像上传失败 (${res.status})` };
    } catch (err) {
      return { success: false, networkError: true, message: err && err.message ? err.message : '网络连接异常' };
    }
  }

  /** 把服务端返回的相对资源路径解析为 h5/ 目录下可用的 URL */
  resolveAssetUrl(relative) {
    if (!relative) return '';
    if (/^(https?:)?\/\//i.test(relative) || relative.startsWith('data:') || relative.startsWith('blob:')) {
      return relative;
    }
    const clean = String(relative).replace(/^\.?\//, '');
    return clean.startsWith('assets/') || clean.startsWith('uploads/') ? `../${clean}` : clean;
  }

  // --------------------------------------------------------------------------
  // 10.3 会话状态、登录跳转与退出
  // --------------------------------------------------------------------------
  async checkSession() {
    const csrf = await this.fetchCsrfToken();
    if (csrf && typeof csrf.logged_in === 'boolean') {
      return { loggedIn: csrf.logged_in, user: csrf.user || csrf.username || null };
    }
    return { loggedIn: !!this.isLoggedIn, user: this.currentUser };
  }

  async login(you, baby, password = '') {
    if (!you || !baby) {
      return { success: false, message: '请输入双方称呼' };
    }
    try {
      if (!this.csrfToken) {
        await this.fetchCsrfToken();
      }

      const send = async (token) => {
        const params = new URLSearchParams({
          you: String(you).trim(),
          baby: String(baby).trim(),
          password: password == null ? '' : String(password),
          csrf_token: token || ''
        });
        const targetUrl = this.resolveApiUrl('/api/login.php');
        return fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          credentials: 'include',
          body: params.toString()
        });
      };

      let res = await send(this.csrfToken);
      let data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.code === 'csrf_invalid') {
        const fresh = await this.fetchCsrfToken();
        if (fresh && fresh.csrf_token) {
          res = await send(fresh.csrf_token);
          data = await res.json().catch(() => ({}));
        }
      }

      if (data.success) {
        this.isLoggedIn = true;
        this.currentUser = data.user || you;
        await this.fetchCsrfToken();
        return { success: true, message: '登录成功', user: this.currentUser };
      } else {
        return { success: false, message: data.message || '登录失败，请检查称呼或密码', device_pending: !!data.device_pending };
      }
    } catch (e) {
      console.error('[ApiClient] Login network failure:', e);
      return { success: false, message: `无法连接服务器 (${e.message || '请确认服务已启动'})` };
    }
  }

  getLoginUrl() {
    let from = '/h5/index.html';
    try {
      if (typeof window !== 'undefined' && window.location && window.location.pathname) {
        from = window.location.pathname;
      }
    } catch (_) {}
    return `../index.html?redirect=${encodeURIComponent(from)}`;
  }

  async logout() {
    let result = { success: false };
    try {
      const res = await this.request('/api/logout.php', { method: 'POST' });
      // The legacy endpoint redirects to the login HTML after destroying the session.
      result = { success: res.ok };
    } catch (_) {}
    this.csrfToken = '';
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentUserId = null;
    this.appConfig = null;
    return result;
  }

  // --------------------------------------------------------------------------
  // 11. AI 生活助手「拾光」对话与记忆库
  // --------------------------------------------------------------------------
  getAgentMemory() {
    const config = this.appConfig || {};
    return {
      names: (config.users || []).map(user => user.username).filter(Boolean).join(' / '),
      days: config.love_days ?? null,
      startDate: config.startDate || null,
      anniversary: null, birthday: null, hobbies: [], memories: []
    };
  }

  async sendAgentChat(message, history = []) {
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.reply) {
          return data;
        }
      }
    } catch (_) {}
    return { success: false, message: '请求未成功，请重试。本次操作未确认保存。' };
  }
}

window.galleryApi = new GalleryApiClient();
