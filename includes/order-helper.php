<?php
/**
 * 订单管理辅助函数
 * 创建和管理订单记录
 */

require_once __DIR__ . '/json-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 订单数据文件路径
if (!defined('ORDERS_FILE')) {
    define('ORDERS_FILE', __DIR__ . '/../data/orders.json');
}

if (!defined('PRODUCTS_FILE')) {
    define('PRODUCTS_FILE', __DIR__ . '/../data/products.json');
}

/**
 * 创建订单
 * @param string $userId 用户ID
 * @param string $productId 商品ID
 * @param int $price 价格
 * @return array|null 订单信息
 */
function createOrder($userId, $productId, $price) {
    // 获取商品信息
    $productsData = safeReadJSON(PRODUCTS_FILE, ['products' => []]);
    $product = null;
    
    foreach ($productsData['products'] as $p) {
        if ($p['id'] === $productId) {
            $product = $p;
            break;
        }
    }
    
    if ($product === null) {
        return null;
    }
    
    $data = safeReadJSON(ORDERS_FILE, ['orders' => []]);
    
    $order = [
        'id' => 'order_' . uniqid(),
        'user_id' => $userId,
        'product_id' => $productId,
        'product_name' => $product['name'],
        'price' => $price,
        'category' => $product['category'],
        'status' => 'completed',
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    $data['orders'][] = $order;
    
    if (!safeWriteJSON(ORDERS_FILE, $data)) {
        return null;
    }
    
    return $order;
}

/**
 * 获取用户订单
 * @param string $userId 用户ID
 * @return array 订单列表
 */
function getUserOrders($userId) {
    $data = safeReadJSON(ORDERS_FILE, ['orders' => []]);
    
    return array_filter($data['orders'], function($order) use ($userId) {
        return $order['user_id'] === $userId;
    });
}

/**
 * 获取订单详情
 * @param string $orderId 订单ID
 * @return array|null 订单详情
 */
function getOrderDetails($orderId) {
    $data = safeReadJSON(ORDERS_FILE, ['orders' => []]);
    
    foreach ($data['orders'] as $order) {
        if ($order['id'] === $orderId) {
            return $order;
        }
    }
    
    return null;
}
