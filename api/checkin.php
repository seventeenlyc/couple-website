<?php
/**
 * 签到API
 * 处理每日签到请求
 */

// 清理输出缓冲
ob_start();

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/checkin-helper.php';

// 清理任何意外输出
ob_clean();

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

// 只接受POST请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => '只支持POST请求'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $userId = getCurrentUserId();
    
    // 检查今日是否已签到
    if (hasCheckedInToday($userId)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => '今日已签到，明天再来吧 💕',
            'already_checked_in' => true
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // 执行签到
    $result = checkIn($userId);
    
    if ($result['success']) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => '签到成功！',
            'reward' => $result['reward'],
            'streak_days' => $result['streak_days'],
            'new_balance' => $result['new_balance']
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => $result['message'] ?? '签到失败，请稍后重试'
        ], JSON_UNESCAPED_UNICODE);
    }
    
} catch (Exception $e) {
    error_log("签到API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}

// 结束输出缓冲并发送
ob_end_flush();
