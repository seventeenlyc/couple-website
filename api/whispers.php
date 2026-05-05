<?php
/**
 * 悄悄话API
 * 处理悄悄话的发送、检查和已读标记
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/whisper-helper.php';

initSession();

header('Content-Type: application/json; charset=utf-8');

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
        case 'send':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $content = $input['content'] ?? '';

            if (empty(trim($content))) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '内容不能为空'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Determine partner
            $partnerId = $userId === 'id1' ? 'id2' : 'id1';

            $result = sendWhisper($userId, $partnerId, $content);

            if ($result['success']) {
                http_response_code(200);
                echo json_encode($result, JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode($result, JSON_UNESCAPED_UNICODE);
            }
            break;

        case 'check':
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持GET请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $whispers = getUnreadWhispers($userId);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'whispers' => $whispers,
                'has_new' => count($whispers) > 0
            ], JSON_UNESCAPED_UNICODE);
            break;

        case 'mark_read':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                echo json_encode([
                    'success' => false,
                    'message' => '只支持POST请求'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $whisperId = $input['whisper_id'] ?? '';

            if (empty($whisperId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少悄悄话ID'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $result = markWhisperRead($whisperId, $userId);

            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => '已读'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '标记失败'
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
    error_log("悄悄话API错误: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误，请稍后重试'
    ], JSON_UNESCAPED_UNICODE);
}
