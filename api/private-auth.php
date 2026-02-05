<?php
/**
 * 隐私空间认证API
 * 处理密码验证请求
 */
define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';

// 设置JSON响应头
header('Content-Type: application/json');

// 要求用户登录
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '请先登录']);
    exit();
}

// 只允许POST请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '只允许POST请求']);
    exit();
}

// 获取请求数据
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$action = $input['action'] ?? '';
$csrf_token = $input['csrf_token'] ?? '';

// 验证CSRF令牌
if (!validateCSRFToken($csrf_token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试']);
    exit();
}

switch ($action) {
    case 'verify':
        // 验证密码
        $password = $input['password'] ?? '';
        
        if (empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '请输入密码']);
            exit();
        }
        
        $result = validatePrivatePassword($password);
        
        if ($result) {
            // 密码正确
            setPrivateAuthenticated($result);
            
            echo json_encode([
                'success' => true,
                'message' => '验证成功',
                'user_id' => $result
            ]);
        } else {
            // 密码错误
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => '密码错误，请重试'
            ]);
        }
        break;
        
    case 'check':
        // 检查是否已认证
        if (isPrivateAuthenticated()) {
            echo json_encode([
                'success' => true,
                'authenticated' => true,
                'user_id' => getPrivateUser()
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'authenticated' => false
            ]);
        }
        break;
        
    case 'logout':
        // 退出隐私空间
        clearPrivateAuthentication();
        
        echo json_encode([
            'success' => true,
            'message' => '已退出隐私空间'
        ]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '未知的操作']);
        break;
}
