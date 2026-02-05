<?php
/**
 * 隐私空间记事本API
 * 处理私人笔记的增删改查
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

// 要求隐私空间认证
if (!isPrivateAuthenticated()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '请先验证隐私空间密码']);
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

$currentUserId = getCurrentUserId();
$privateFile = __DIR__ . "/../data/private_{$currentUserId}.json";

/**
 * 获取用户笔记
 * @return array 笔记列表
 */
function getPrivateNotes() {
    global $privateFile;
    
    if (file_exists($privateFile)) {
        $data = json_decode(file_get_contents($privateFile), true) ?: [];
        return $data['notes'] ?? [];
    }
    
    return [];
}

/**
 * 添加笔记
 * @param array $noteData 笔记数据
 * @return array 结果
 */
function addPrivateNote($noteData) {
    global $privateFile, $currentUserId;
    
    $title = sanitizeInput($noteData['title'] ?? '');
    $content = sanitizeInput($noteData['content'] ?? '');
    
    if (empty($content)) {
        return ['success' => false, 'message' => '笔记内容不能为空'];
    }
    
    // 读取现有数据
    $privateData = [];
    if (file_exists($privateFile)) {
        $privateData = json_decode(file_get_contents($privateFile), true) ?: [];
    }
    
    if (!isset($privateData['notes'])) {
        $privateData['notes'] = [];
    }
    
    // 创建新笔记
    $newNote = [
        'id' => uniqid(),
        'title' => $title,
        'content' => $content,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    $privateData['notes'][] = $newNote;
    
    // 保存
    if (file_put_contents($privateFile, json_encode($privateData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        return [
            'success' => true,
            'message' => '笔记添加成功',
            'note' => $newNote
        ];
    }
    
    return ['success' => false, 'message' => '保存失败'];
}

/**
 * 删除笔记
 * @param string $noteId 笔记ID
 * @return array 结果
 */
function deletePrivateNote($noteId) {
    global $privateFile;
    
    if (!file_exists($privateFile)) {
        return ['success' => false, 'message' => '笔记不存在'];
    }
    
    $privateData = json_decode(file_get_contents($privateFile), true) ?: [];
    
    if (!isset($privateData['notes'])) {
        return ['success' => false, 'message' => '笔记不存在'];
    }
    
    $originalCount = count($privateData['notes']);
    
    $privateData['notes'] = array_values(array_filter(
        $privateData['notes'],
        function($note) use ($noteId) { return $note['id'] !== $noteId; }
    ));
    
    if (count($privateData['notes']) === $originalCount) {
        return ['success' => false, 'message' => '笔记不存在'];
    }
    
    if (file_put_contents($privateFile, json_encode($privateData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        return ['success' => true, 'message' => '笔记删除成功'];
    }
    
    return ['success' => false, 'message' => '删除失败'];
}

// 处理请求
switch ($action) {
    case 'get':
        // 获取笔记列表
        $notes = getPrivateNotes();
        echo json_encode([
            'success' => true,
            'notes' => array_reverse($notes), // 最新的在前面
            'total' => count($notes)
        ]);
        break;
        
    case 'add':
        // 添加笔记
        $result = addPrivateNote($input);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(400);
            echo json_encode($result);
        }
        break;
        
    case 'delete':
        // 删除笔记
        $noteId = $input['note_id'] ?? '';
        
        if (empty($noteId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '笔记ID不能为空']);
            exit();
        }
        
        $result = deletePrivateNote($noteId);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(404);
            echo json_encode($result);
        }
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '未知的操作']);
        break;
}
