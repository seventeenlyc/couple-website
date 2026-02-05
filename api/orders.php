<?php
/**
 * 订单API
 * 处理订单查询请求
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/order-helper.php';

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
        case 'get_my_orders':
            // 获取用户订单列表
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $orders = getUserOrders($userId);
            
            // 按时间倒序排列
            usort($orders, function($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'orders' => array_values($orders)
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'get_details':
            // 获取订单详情
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $orderId = $_GET['order_id'] ?? '';
            
            if (empty($orderId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少订单ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $order = getOrderDetails($orderId);
            
            if ($order === null) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => '订单不存在'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            // 验证订单所有权
            if ($order['user_id'] !== $userId) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => '无权访问此订单'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'order' => $order
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
    error_log("订单API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}
