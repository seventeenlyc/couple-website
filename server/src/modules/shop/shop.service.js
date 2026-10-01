import crypto from 'node:crypto';
import { getTodayDateString, getNowDateTimeString } from '../../utils/date.js';

export function checkSpecialDate(db) {
  const row = db.prepare("SELECT value FROM site_config WHERE key = 'specialDates'").get();
  const todayMMDD = getTodayDateString().slice(5); // 'MM-DD'

  if (row) {
    try {
      const specialDates = JSON.parse(row.value);
      if (specialDates.anniversary && specialDates.anniversary.date === todayMMDD) {
        return {
          is_special: true,
          discount: specialDates.anniversary.discount || 0.6,
          reason: specialDates.anniversary.name || '恋爱纪念日'
        };
      }
      if (Array.isArray(specialDates.birthdays)) {
        for (const b of specialDates.birthdays) {
          if (b.date === todayMMDD) {
            return {
              is_special: true,
              discount: b.discount || 0.6,
              reason: b.name || '生日快乐'
            };
          }
        }
      }
    } catch (e) {}
  }

  // Check user birthdays
  const users = db.prepare('SELECT username, birthday FROM users').all();
  for (const u of users) {
    if (u.birthday === todayMMDD) {
      return {
        is_special: true,
        discount: 0.6,
        reason: `${u.username}的生日`
      };
    }
  }

  return {
    is_special: false,
    discount: 1.0,
    reason: ''
  };
}

export function getAllProductsWithDiscount(db) {
  const products = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all();
  const specialDate = checkSpecialDate(db);

  return products.map(p => {
    let finalPrice = p.price;
    let discountPercent = 100;
    if (specialDate.is_special) {
      finalPrice = Math.round(p.price * specialDate.discount);
      discountPercent = Math.round(specialDate.discount * 100);
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: finalPrice,
      original_price: p.price,
      discount: specialDate.discount,
      discount_percent: discountPercent,
      is_discounted: specialDate.is_special,
      discount_reason: specialDate.reason,
      category: p.category,
      stock: p.stock,
      image: p.image
    };
  });
}

export function searchProducts(db, keyword) {
  const all = getAllProductsWithDiscount(db);
  if (!keyword || !keyword.trim()) return all;
  const kw = keyword.toLowerCase().trim();
  return all.filter(p => p.name.toLowerCase().includes(kw) || (p.description && p.description.toLowerCase().includes(kw)));
}

export function filterByCategory(db, category) {
  const all = getAllProductsWithDiscount(db);
  if (!category || category === 'all') return all;
  return all.filter(p => p.category === category);
}

export function buyProduct(db, userId, productId, idempotencyKey = null) {
  return db.transaction(() => {
    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const existingOrder = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
      if (existingOrder) {
        const u = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
        return {
          success: true,
          message: '购买成功 (已处理)',
          order_id: existingOrder.id,
          product: { id: existingOrder.product_id, name: existingOrder.product_name, price: existingOrder.paid_price },
          balance: Number(u?.balance || 0)
        };
      }
    }

    // 2. Lookup product
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(productId);
    if (!product) {
      return { success: false, message: '商品不存在或已下架' };
    }

    // 3. Check stock
    if (product.stock === 0) {
      return { success: false, message: '商品库存不足' };
    }

    // 4. Calculate price with discount
    const specialDate = checkSpecialDate(db);
    let finalPrice = product.price;
    if (specialDate.is_special) {
      finalPrice = Math.round(product.price * specialDate.discount);
    }

    // 5. Check user balance
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (!user || user.balance < finalPrice) {
      return { success: false, message: '爱心币不足' };
    }

    // 6. Deduct balance
    const newBalance = user.balance - finalPrice;
    db.prepare('UPDATE users SET balance = ? WHERE id = ? AND balance >= ?').run(newBalance, userId, finalPrice);

    // 7. Deduct stock if limited
    if (product.stock > 0) {
      db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0').run(productId);
    }

    const orderId = `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const orderNo = `ORD${Date.now()}${crypto.randomInt(100, 999)}`;
    const nowTime = getNowDateTimeString();

    // 8. Insert order
    db.prepare(`
      INSERT INTO orders (id, order_no, user_id, product_id, product_name, product_price, paid_price, discount_rate, discount_reason, status, idempotency_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
      orderId,
      orderNo,
      userId,
      productId,
      product.name,
      product.price,
      finalPrice,
      specialDate.discount,
      specialDate.reason,
      idempotencyKey || orderId,
      nowTime
    );

    // 9. Record wallet transaction
    db.prepare(`
      INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, description, reference_id, idempotency_key, created_at)
      VALUES (?, ?, 'shop_purchase', ?, ?, ?, ?, ?, ?)
    `).run(
      `tx_${orderId}`,
      userId,
      -finalPrice,
      newBalance,
      `购买商品: ${product.name}`,
      orderId,
      `tx_${orderId}`,
      nowTime
    );

    // 10. If virtual product, add to inventory
    if (product.category === 'virtual') {
      const vitemId = `vitem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      db.prepare(`
        INSERT INTO virtual_items (id, order_id, user_id, product_id, name, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'unused', ?)
      `).run(vitemId, orderId, userId, productId, product.name, nowTime);
    }

    return {
      success: true,
      message: '购买成功！',
      order_id: orderId,
      product: {
        id: product.id,
        name: product.name,
        price: finalPrice
      },
      balance: newBalance
    };
  })();
}

export function getMyOrders(db, userId) {
  return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

export function getOrderDetails(db, orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

export function getMyVirtualItems(db, userId) {
  return db.prepare(`
    SELECT v.*, p.image as product_image, p.description as product_description
    FROM virtual_items v
    LEFT JOIN products p ON v.product_id = p.id
    WHERE v.user_id = ?
    ORDER BY v.created_at DESC
  `).all(userId);
}

export function useVirtualItem(db, userId, itemId) {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM virtual_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    if (!item) {
      return { success: false, message: '商品不存在或不属于你' };
    }
    if (item.status === 'used') {
      return { success: false, message: '该商品已经使用过了' };
    }
    if (item.status === 'pending_confirmation') {
      return { success: false, message: '该商品正在等待对方确认' };
    }

    const nowTime = getNowDateTimeString();
    db.prepare("UPDATE virtual_items SET status = 'pending_confirmation', used_at = ? WHERE id = ?").run(nowTime, itemId);
    return { success: true, message: '已发起使用申请，等待对方确认 💕' };
  })();
}

export function confirmVirtualItemUse(db, userId, itemId) {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM virtual_items WHERE id = ?').get(itemId);
    if (!item) {
      return { success: false, message: '商品不存在' };
    }
    if (item.status !== 'pending_confirmation') {
      return { success: false, message: '该商品不是待确认状态' };
    }

    const nowTime = getNowDateTimeString();
    db.prepare("UPDATE virtual_items SET status = 'used', confirmed_by = ?, confirmed_at = ? WHERE id = ?").run(
      userId,
      nowTime,
      itemId
    );
    return { success: true, message: '已确认使用！💕' };
  })();
}

export function cancelVirtualItemUse(db, userId, itemId) {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM virtual_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    if (!item) {
      return { success: false, message: '商品不存在或不属于你' };
    }
    if (item.status !== 'pending_confirmation') {
      return { success: false, message: '只能取消待确认状态的商品' };
    }

    db.prepare("UPDATE virtual_items SET status = 'unused', used_at = NULL WHERE id = ?").run(itemId);
    return { success: true, message: '已取消使用' };
  })();
}

export function addReview(db, userId, productId, rating, content) {
  return db.transaction(() => {
    // Check if user purchased this product
    const order = db.prepare("SELECT id FROM orders WHERE user_id = ? AND product_id = ? AND status = 'completed'").get(userId, productId);
    if (!order) {
      return { success: false, message: '只有购买过该商品才能评价' };
    }

    const reviewId = `rev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const nowTime = getNowDateTimeString();

    db.prepare(`
      INSERT INTO reviews (id, user_id, product_id, order_id, rating, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reviewId, userId, productId, order.id, Number(rating), content, nowTime);

    return { success: true, message: '评价成功！' };
  })();
}

export function getProductReviews(db, productId) {
  return db.prepare(`
    SELECT r.*, u.username as user_name, u.avatar as user_avatar
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(productId);
}
