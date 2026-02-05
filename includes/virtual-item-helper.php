<?php
/**
 * 虚拟商品管理辅助函数
 * 管理虚拟商品的使用和确认
 */

require_once __DIR__ . '/json-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 虚拟商品数据文件路径
define('VIRTUAL_ITEMS_FILE', __DIR__ . '/../data/virtual_items.json');

/**
 * 创建虚拟商品
 * @param string $userId 用户ID
 * @param string $productId 商品ID
 * @param string $productName 商品名称
 * @param string $orderId 订单ID
 * @return array|null 虚拟商品信息
 */
function createVirtualItem($userId, $productId, $productName, $orderId) {
    $data = safeReadJSON(VIRTUAL_ITEMS_FILE, ['items' => []]);
    
    $item = [
        'id' => 'vitem_' . uniqid(),
        'user_id' => $userId,
        'product_id' => $productId,
        'product_name' => $productName,
        'order_id' => $orderId,
        'status' => 'unused',
        'purchased_at' => date('Y-m-d H:i:s'),
        'used_at' => null,
        'confirmed_at' => null,
        'confirmed_by' => null
    ];
    
    $data['items'][] = $item;
    
    if (!safeWriteJSON(VIRTUAL_ITEMS_FILE, $data)) {
        return null;
    }
    
    return $item;
}

/**
 * 获取用户的虚拟商品
 * @param string $userId 用户ID
 * @return array 虚拟商品列表
 */
function getUserVirtualItems($userId) {
    $data = safeReadJSON(VIRTUAL_ITEMS_FILE, ['items' => []]);
    
    return array_filter($data['items'], function($item) use ($userId) {
        return $item['user_id'] === $userId;
    });
}

/**
 * 使用虚拟商品
 * @param string $userId 用户ID
 * @param string $itemId 商品ID
 * @return bool 是否成功
 */
function useVirtualItem($userId, $itemId) {
    $data = safeReadJSON(VIRTUAL_ITEMS_FILE, ['items' => []]);
    
    $itemIndex = -1;
    foreach ($data['items'] as $index => $item) {
        if ($item['id'] === $itemId && $item['user_id'] === $userId) {
            $itemIndex = $index;
            break;
        }
    }
    
    if ($itemIndex === -1) {
        return false;
    }
    
    // 检查状态
    if ($data['items'][$itemIndex]['status'] !== 'unused') {
        return false;
    }
    
    // 更新状态
    $data['items'][$itemIndex]['status'] = 'pending';
    $data['items'][$itemIndex]['used_by'] = $userId;
    $data['items'][$itemIndex]['used_at'] = date('Y-m-d H:i:s');
    
    return safeWriteJSON(VIRTUAL_ITEMS_FILE, $data);
}

/**
 * 确认虚拟商品使用
 * @param string $itemId 商品ID
 * @param string $confirmerId 确认者ID
 * @return bool 是否成功
 */
function confirmVirtualItemUse($itemId, $confirmerId) {
    $data = safeReadJSON(VIRTUAL_ITEMS_FILE, ['items' => []]);
    
    $itemIndex = -1;
    foreach ($data['items'] as $index => $item) {
        if ($item['id'] === $itemId) {
            $itemIndex = $index;
            break;
        }
    }
    
    if ($itemIndex === -1) {
        return false;
    }
    
    // 检查状态
    if ($data['items'][$itemIndex]['status'] !== 'pending') {
        return false;
    }
    
    // 不能自己确认自己的商品
    if ($data['items'][$itemIndex]['user_id'] === $confirmerId) {
        return false;
    }
    
    // 更新状态
    $data['items'][$itemIndex]['status'] = 'used';
    $data['items'][$itemIndex]['confirmed_at'] = date('Y-m-d H:i:s');
    $data['items'][$itemIndex]['confirmed_by'] = $confirmerId;
    
    return safeWriteJSON(VIRTUAL_ITEMS_FILE, $data);
}

/**
 * 应用虚拟商品效果
 * @param string $itemId 商品ID
 * @return bool 是否成功
 */
function applyItemEffect($itemId) {
    // 这个函数可以根据不同的虚拟商品类型执行不同的效果
    // 目前只是一个占位符
    return true;
}

/**
 * 获取待确认的物品使用请求
 * @param string $userId 当前用户ID
 * @return array 待确认的物品列表
 */
function getPendingConfirmations($userId) {
    $data = safeReadJSON(VIRTUAL_ITEMS_FILE, ['items' => []]);
    $pendingItems = [];
    
    foreach ($data['items'] as $item) {
        // 查找状态为pending、且使用者不是当前用户的物品
        // 即：对方使用了物品，需要当前用户确认
        if (isset($item['status']) && $item['status'] === 'pending' && 
            isset($item['used_by']) && $item['used_by'] !== $userId) {
            $pendingItems[] = $item;
        }
    }
    
    return $pendingItems;
}
