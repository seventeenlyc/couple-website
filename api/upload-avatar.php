<?php
/**
 * 头像上传API
 * 处理用户头像上传请求
 */

// 确保输出缓冲开启，防止任何意外输出污染JSON
if (ob_get_level()) {
    ob_clean();
} else {
    ob_start();
}

// 禁止显示错误（只记录到日志）
ini_set('display_errors', 0);
error_reporting(E_ALL);

define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/avatar-helper.php';

// 设置JSON响应头
header('Content-Type: application/json; charset=utf-8');

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

// 验证CSRF令牌
$csrf_token = $_POST['csrf_token'] ?? '';
if (!validateCSRFToken($csrf_token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试']);
    exit();
}

// 确定目标用户：side 参数（left=name1, right=name2）优先
$side = $_POST['side'] ?? '';
$sideUserMap = ['left' => 'name1', 'right' => 'name2'];
$targetUserName = $sideUserMap[$side] ?? getCurrentUser();

// 处理上传请求
if (isset($_FILES['avatar'])) {
    try {
        // 记录调试信息
        error_log('头像上传开始 - 用户: ' . $targetUserName);
        error_log('文件信息: ' . print_r($_FILES['avatar'], true));

        $result = saveUserAvatar($targetUserName, $_FILES['avatar']);
        
        // 记录结果
        error_log('头像上传结果: ' . print_r($result, true));
        
        if ($result['success']) {
            http_response_code(200);
            echo json_encode($result);
        } else {
            http_response_code(400);
            echo json_encode($result);
        }
    } catch (Exception $e) {
        error_log('头像上传异常: ' . $e->getMessage());
        error_log('异常堆栈: ' . $e->getTraceAsString());
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => '服务器错误: ' . $e->getMessage()
        ]);
    }
} else {
    error_log('头像上传失败: 没有收到文件');
    error_log('POST数据: ' . print_r($_POST, true));
    error_log('FILES数据: ' . print_r($_FILES, true));
    
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '请选择要上传的头像']);
}
