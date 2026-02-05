<?php
/**
 * 虚拟商品API
 * 处理虚拟商品使用请求
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/virtual-item-helper.php';

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
        case 'get_my_items':
            // 获取用户虚拟商品列表
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $items = getUserVirtualItems($userId);
            
            // 按购买时间倒序排列
            usort($items, function($a, $b) {
                return strtotime($b['purchased_at']) - strtotime($a['purchased_at']);
            });
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'items' => array_values($items)
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'use':
            // 使用虚拟商品
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $itemId = $input['item_id'] ?? '';
            
            if (empty($itemId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = useVirtualItem($userId, $itemId);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '已标记使用，等待对方确认'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '使用失败，请检查商品状态'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'confirm':
            // 确认虚拟商品使用
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $itemId = $input['item_id'] ?? '';
            
            if (empty($itemId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少商品ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = confirmVirtualItemUse($itemId, $userId);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '确认成功！'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '确认失败，请检查商品状态'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'get_pending_confirmations':
            // 获取待确认的物品使用请求
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $pendingItems = getPendingConfirmations($userId);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'items' => array_values($pendingItems)
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
    error_log("虚拟商品API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}
