<?php
/**
 * 登录API
 * 处理用户登录请求
 */

define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';

// 设置响应头
header('Content-Type: application/json; charset=utf-8');

// 只接受POST请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => '只接受POST请求'
    ]);
    exit();
}

// 验证CSRF令牌
if (!isset($_POST['csrf_token']) || !validateCSRFToken($_POST['csrf_token'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => '无效的请求'
    ]);
    exit();
}

// 获取并清理输入
$you = isset($_POST['you']) ? sanitizeInput($_POST['you']) : '';
$baby = isset($_POST['baby']) ? sanitizeInput($_POST['baby']) : '';

// 验证输入不为空
if (empty($you) || empty($baby)) {
    echo json_encode([
        'success' => false,
        'message' => '请输入你和宝宝的名字'
    ]);
    exit();
}

// 使用IP地址作为标识符
$identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// 检查是否被锁定
if (isLockedOut($identifier)) {
    $remainingTime = getRemainingLockoutTime($identifier);
    $minutes = ceil($remainingTime / 60);
    
    http_response_code(429);
    echo json_encode([
        'success' => false,
        'message' => "登录尝试次数过多，请在 {$minutes} 分钟后再试"
    ]);
    exit();
}

// 尝试登录
if (performLogin($you, $baby)) {
    // 登录成功，重置尝试计数
    resetLoginAttempts($identifier);
    $redirect = getRedirectAfterLogin();
    
    echo json_encode([
        'success' => true,
        'message' => '登录成功',
        'user' => getCurrentUser(),
        'redirect' => $redirect ?: 'home.html'
    ]);
} else {
    // 登录失败，记录尝试
    recordLoginAttempt($identifier);
    
    // 检查剩余尝试次数
    $attempts = $_SESSION['login_attempts'][$identifier]['count'] ?? 0;
    $remainingAttempts = 5 - $attempts;
    
    $message = '登录失败，请检查输入的名字是否正确';
    if ($remainingAttempts > 0 && $remainingAttempts <= 3) {
        $message .= "（还剩 {$remainingAttempts} 次尝试机会）";
    }
    
    echo json_encode([
        'success' => false,
        'message' => $message
    ]);
}
