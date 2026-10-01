import { getUserBalance, getUserCurrencyInfo, performCheckin } from '../modules/wallet/wallet.service.js';
import { getTodayTasks, markTaskComplete, uncompleteTask, confirmPartnerTask } from '../modules/tasks/task.service.js';
import {
  checkSpecialDate,
  getAllProductsWithDiscount,
  searchProducts,
  filterByCategory,
  buyProduct,
  getMyOrders,
  getOrderDetails,
  getMyVirtualItems,
  getPendingConfirmations,
  useVirtualItem,
  confirmVirtualItemUse,
  cancelVirtualItemUse,
  addReview,
  getProductReviews
} from '../modules/shop/shop.service.js';

export default async function economyRoutes(fastify) {
  const db = fastify.db;

  // Helper to ensure login
  fastify.addHook('preHandler', async (req, reply) => {
    const publicUrls = ['/api/login.php', '/api/csrf-token.php', '/api/ping.php'];
    if (publicUrls.includes(req.url.split('?')[0])) {
      return;
    }
  });

  // 1. Balance API
  fastify.get('/api/balance.php', async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    const userId = req.getCurrentUserId();
    const info = getUserCurrencyInfo(db, userId);
    return {
      success: true,
      ...info
    };
  });

  // 2. Checkin API
  const handleCheckin = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }
    if (req.method !== 'POST') {
      reply.code(405);
      return { success: false, message: '只支持POST请求' };
    }

    const csrfToken = req.body?.csrf_token || req.headers['x-csrf-token'];
    if (!req.validateCSRFToken(csrfToken)) {
      reply.code(403);
      return { success: false, message: '请求无效，请重新尝试' };
    }

    const userId = req.getCurrentUserId();
    const res = performCheckin(db, userId);
    if (!res.success && res.already_checked_in) {
      reply.code(400);
    }
    return res;
  };
  fastify.post('/api/checkin.php', handleCheckin);
  fastify.get('/api/checkin.php', async (req, reply) => {
    reply.code(405);
    return { success: false, message: '只支持POST请求' };
  });

  // 3. Tasks API
  const handleTasks = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'get_today') {
      const tasks = getTodayTasks(db, userId);
      return { success: true, tasks };
    }

    if (action === 'mark_complete') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const taskId = req.body?.task_id || req.body?.id || req.query.task_id;
      return markTaskComplete(db, userId, taskId);
    }

    if (action === 'uncomplete') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const taskId = req.body?.task_id || req.body?.id || req.query.task_id;
      return uncompleteTask(db, userId, taskId);
    }

    if (action === 'confirm_partner' || action === 'confirm') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const taskId = req.body?.task_id || req.body?.id || req.query.task_id;
      return confirmPartnerTask(db, userId, taskId);
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/tasks.php', handleTasks);
  fastify.post('/api/tasks.php', handleTasks);

  // 4. Shop API
  const handleShop = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'get_all') {
      const products = getAllProductsWithDiscount(db);
      const specialDate = checkSpecialDate(db);
      return {
        success: true,
        products,
        special_date: specialDate
      };
    }

    if (action === 'search') {
      const keyword = req.query.keyword || '';
      const products = searchProducts(db, keyword);
      return {
        success: true,
        products,
        keyword
      };
    }

    if (action === 'filter') {
      const category = req.query.category || '';
      const products = filterByCategory(db, category);
      return {
        success: true,
        products
      };
    }

    if (action === 'buy' || action === 'purchase') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }

      const productId = req.body?.product_id || req.body?.id || req.query.product_id;
      const idempotencyKey = req.body?.idempotency_key || req.headers['idempotency-key'] || null;
      if (!productId) {
        reply.code(400);
        return { success: false, message: '缺少商品ID' };
      }

      const res = buyProduct(db, userId, productId, idempotencyKey);
      if (!res.success) {
        reply.code(400);
      }
      return res;
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/shop.php', handleShop);
  fastify.post('/api/shop.php', handleShop);

  // 5. Orders API
  const handleOrders = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'get_my_orders') {
      const orders = getMyOrders(db, userId);
      return { success: true, orders };
    }

    if (action === 'get_details') {
      const orderId = req.query.order_id || req.body?.order_id;
      if (!orderId) {
        reply.code(400);
        return { success: false, message: '缺少订单ID' };
      }
      const order = getOrderDetails(db, orderId);
      if (!order || order.user_id !== userId) {
        reply.code(404);
        return { success: false, message: '订单不存在' };
      }
      return { success: true, order };
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/orders.php', handleOrders);
  fastify.post('/api/orders.php', handleOrders);

  // 6. Virtual Items API
  const handleVirtualItems = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'get_my_items') {
      const items = getMyVirtualItems(db, userId);
      return { success: true, items };
    }

    if (action === 'get_pending_confirmations') {
      const items = getPendingConfirmations(db, userId);
      return { success: true, items };
    }

    if (action === 'use') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const itemId = req.body?.item_id;
      return useVirtualItem(db, userId, itemId);
    }

    if (action === 'confirm_use' || action === 'confirm') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const itemId = req.body?.item_id;
      return confirmVirtualItemUse(db, userId, itemId);
    }

    if (action === 'cancel_use' || action === 'cancel') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const itemId = req.body?.item_id;
      return cancelVirtualItemUse(db, userId, itemId);
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/virtual-items.php', handleVirtualItems);
  fastify.post('/api/virtual-items.php', handleVirtualItems);

  // 7. Reviews API
  const handleReviews = async (req, reply) => {
    if (!req.isLoggedIn()) {
      reply.code(401);
      return { success: false, message: '请先登录' };
    }

    const action = req.query.action || req.body?.action || '';
    const userId = req.getCurrentUserId();

    if (action === 'get_by_product') {
      const productId = req.query.product_id;
      if (!productId) {
        reply.code(400);
        return { success: false, message: '缺少商品ID' };
      }
      const reviews = getProductReviews(db, productId);
      return { success: true, reviews };
    }

    if (action === 'add') {
      if (req.method !== 'POST') {
        reply.code(405);
        return { success: false, message: '只支持POST请求' };
      }
      const token = req.body?.csrf_token || req.headers['x-csrf-token'];
      if (!req.validateCSRFToken(token)) {
        reply.code(403);
        return { success: false, message: '请求无效，请重新尝试' };
      }
      const { product_id, rating, content } = req.body || {};
      if (!product_id || !content) {
        reply.code(400);
        return { success: false, message: '参数不完整' };
      }
      const res = addReview(db, userId, product_id, rating, content);
      if (!res.success) {
        reply.code(400);
      }
      return res;
    }

    reply.code(400);
    return { success: false, message: '无效的操作' };
  };
  fastify.get('/api/reviews.php', handleReviews);
  fastify.post('/api/reviews.php', handleReviews);
}
