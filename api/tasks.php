<?php
/**
 * 任务API
 * 处理任务相关请求
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/task-helper.php';

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
        case 'get_today':
            // 获取今日任务
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $tasks = getTodayTasks();
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'tasks' => array_values($tasks)
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'mark_complete':
            // 标记任务完成
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $taskId = $input['task_id'] ?? '';
            
            if (empty($taskId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少任务ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = markTaskComplete($taskId, $userId);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '已标记完成，等待对方确认'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '标记失败，请检查任务状态'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'confirm':
            // 确认任务完成
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $taskId = $input['task_id'] ?? '';
            
            if (empty($taskId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少任务ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = confirmTaskComplete($taskId, $userId);
            
            if ($result['success']) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => $result['message'],
                    'can_claim' => $result['can_claim'] ?? false
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => $result['message']
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'reject':
            // 拒绝任务完成
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $taskId = $input['task_id'] ?? '';
            
            if (empty($taskId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少任务ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = rejectTaskComplete($taskId, $userId);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '已拒绝任务完成'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '拒绝失败'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'claim_reward':
            // 发放任务奖励
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $taskId = $input['task_id'] ?? '';
            
            if (empty($taskId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少任务ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            $result = claimTaskReward($taskId);
            
            if ($result['success']) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '奖励已发放！',
                    'reward' => $result['reward']
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => $result['message']
                ], JSON_UNESCAPED_UNICODE);
            }
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
    error_log("任务API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}
