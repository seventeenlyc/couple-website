<?php
/**
 * 评价管理辅助函数
 * 管理商品评价
 */

require_once __DIR__ . '/json-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 评价数据文件路径
define('REVIEWS_FILE', __DIR__ . '/../data/reviews.json');

if (!defined('ORDERS_FILE')) {
    define('ORDERS_FILE', __DIR__ . '/../data/orders.json');
}

if (!defined('PRODUCTS_FILE')) {
    define('PRODUCTS_FILE', __DIR__ . '/../data/products.json');
}

/**
 * 添加评价
 * @param string $userId 用户ID
 * @param string $productId 商品ID
 * @param int $rating 评分（1-5）
 * @param string $content 评价内容
 * @return bool 是否成功
 */
function addReview($userId, $productId, $rating, $content) {
    // 验证评分
    if ($rating < 1 || $rating > 5) {
        error_log("评分无效: {$rating}");
        return false;
    }
    
    // 检查是否购买过
    if (!hasPurchased($userId, $productId)) {
        error_log("用户未购买过该商品: {$userId}, {$productId}");
        return false;
    }
    
    // 检查是否已评价
    if (hasReviewed($userId, $productId)) {
        error_log("用户已评价过该商品: {$userId}, {$productId}");
        return false;
    }
    
    $data = safeReadJSON(REVIEWS_FILE, ['reviews' => []]);
    
    // 获取用户名
    $userName = $userId === 'id1' ? 'name1' : 'name2';
    
    $review = [
        'id' => 'review_' . uniqid(),
        'product_id' => $productId,
        'user_id' => $userId,
        'user_name' => $userName,
        'rating' => $rating,
        'content' => $content,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    $data['reviews'][] = $review;
    
    if (!safeWriteJSON(REVIEWS_FILE, $data)) {
        return false;
    }
    
    // 更新商品评分
    updateProductRatingFromReviews($productId);
    
    return true;
}

/**
 * 获取商品评价
 * @param string $productId 商品ID
 * @return array 评价列表
 */
function getProductReviews($productId) {
    $data = safeReadJSON(REVIEWS_FILE, ['reviews' => []]);
    
    return array_filter($data['reviews'], function($review) use ($productId) {
        return $review['product_id'] === $productId;
    });
}

/**
 * 检查用户是否购买过商品
 * @param string $userId 用户ID
 * @param string $productId 商品ID
 * @return bool 是否购买过
 */
function hasPurchased($userId, $productId) {
    $data = safeReadJSON(ORDERS_FILE, ['orders' => []]);
    
    foreach ($data['orders'] as $order) {
        if ($order['user_id'] === $userId && $order['product_id'] === $productId) {
            return true;
        }
    }
    
    return false;
}

/**
 * 检查用户是否已评价
 * @param string $userId 用户ID
 * @param string $productId 商品ID
 * @return bool 是否已评价
 */
function hasReviewed($userId, $productId) {
    $data = safeReadJSON(REVIEWS_FILE, ['reviews' => []]);
    
    foreach ($data['reviews'] as $review) {
        if ($review['user_id'] === $userId && $review['product_id'] === $productId) {
            return true;
        }
    }
    
    return false;
}

/**
 * 从评价更新商品评分
 * @param string $productId 商品ID
 * @return bool 是否成功
 */
function updateProductRatingFromReviews($productId) {
    $reviews = getProductReviews($productId);
    
    if (empty($reviews)) {
        return true;
    }
    
    // 计算平均评分
    $totalRating = 0;
    $count = count($reviews);
    
    foreach ($reviews as $review) {
        $totalRating += $review['rating'];
    }
    
    $averageRating = round($totalRating / $count, 1);
    
    // 更新商品评分
    require_once __DIR__ . '/shop-helper.php';
    return updateProductRating($productId, $averageRating, $count);
}

/**
 * 获取用户的评价
 * @param string $userId 用户ID
 * @return array 评价列表
 */
function getUserReviews($userId) {
    $data = safeReadJSON(REVIEWS_FILE, ['reviews' => []]);
    
    return array_filter($data['reviews'], function($review) use ($userId) {
        return $review['user_id'] === $userId;
    });
}
