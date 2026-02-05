<?php
/**
 * 评价API
 * 处理商品评价请求
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/review-helper.php';

// 初始化会话
initSession();

// 设置响应头
header('Content-Type: application/json; charset=utf-8');

// 检查登录状态
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => '请先登录'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$userId = getCurrentUserId();
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'add':
            // 添加评价
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $productId = $input['product_id'] ?? '';
            $rating = $input['rating'] ?? 0;
            $content = $input['content'] ?? '';
            
            // 验证输入
            if (empty($productId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            if ($rating < 1 || $rating > 5) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '评分必须在1-5之间'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            if (empty($content)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '评价内容不能为空'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            // 检查是否购买过
            if (!hasPurchased($userId, $productId)) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => '只有购买过的用户才能评价'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            // 检查是否已评价
            if (hasReviewed($userId, $productId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '已经评价过了'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = addReview($userId, $productId, $rating, $content);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '评价成功！'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => '评价失败，请稍后重试'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'get_product_reviews':
            // 获取商品评价列表
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $productId = $_GET['product_id'] ?? '';
            
            if (empty($productId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $reviews = getProductReviews($productId);
            
            // 按时间倒序排列
            usort($reviews, function($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'reviews' => array_values($reviews)
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'check_permission':
            // 检查评价权限
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $productId = $_GET['product_id'] ?? '';
            
            if (empty($productId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $hasPurchased = hasPurchased($userId, $productId);
            $hasReviewed = hasReviewed($userId, $productId);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'can_review' => $hasPurchased && !$hasReviewed,
                'has_purchased' => $hasPurchased,
                'has_reviewed' => $hasReviewed
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => '无效的操作'
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
    
} catch (Exception $e) {
    error_log("评价API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}
