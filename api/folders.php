<?php
/**
 * 文件夹管理 API
 * 处理文件夹的创建、列表、重命名、删除和文件移动操作
 */
define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/folder-helper.php';

// 设置JSON响应头
header('Content-Type: application/json');

// 要求用户登录
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '请先登录']);
    exit();
}

// 获取操作类型
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// 获取上下文（private 或 album）
$context = $_GET['context'] ?? $_POST['context'] ?? 'private';

// 验证上下文
if (!in_array($context, ['private', 'album'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '无效的上下文']);
    exit();
}

// 如果是私密空间，需要额外的认证
if ($context === 'private' && !isPrivateAuthenticated()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '请先验证隐私空间密码']);
    exit();
}

// 获取数据文件路径
$currentUserId = getCurrentUserId();
if ($context === 'private') {
    $dataFile = __DIR__ . "/../data/private_{$currentUserId}.json";
} else {
    $dataFile = __DIR__ . "/../data/album.json";
}

// 处理不同的操作
switch ($action) {
    case 'create':
        handleCreate($dataFile);
        break;
    
    case 'list':
        handleList($dataFile);
        break;
    
    case 'rename':
        handleRename($dataFile);
        break;
    
    case 'delete':
        handleDelete($dataFile);
        break;
    
    case 'move':
        handleMove($dataFile);
        break;
    
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的操作']);
        exit();
}

/**
 * 处理创建文件夹请求
 */
function handleCreate($dataFile) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $folderName = $_POST['folder_name'] ?? '';
    $parentPath = $_POST['parent_path'] ?? '';
    $createdBy = getCurrentUser();
    
    // 创建文件夹
    $result = createFolder($dataFile, $folderName, $parentPath, $createdBy);
    
    if ($result['success']) {
        http_response_code(201);
    } else {
        http_response_code(400);
    }
    
    echo json_encode($result);
}

/**
 * 处理获取文件夹列表请求
 */
function handleList($dataFile) {
    // 获取路径参数
    $path = $_GET['path'] ?? '';
    
    // 获取文件夹内容
    $contents = getFolderContents($dataFile, $path);
    
    // 生成面包屑
    $breadcrumbs = generateBreadcrumbs($path);
    
    echo json_encode([
        'success' => true,
        'folders' => $contents['folders'],
        'files' => $contents['files'],
        'breadcrumbs' => $breadcrumbs
    ]);
}

/**
 * 处理重命名文件夹请求
 */
function handleRename($dataFile) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $folderPath = $_POST['folder_path'] ?? '';
    $newName = $_POST['new_name'] ?? '';
    
    // 重命名文件夹
    $result = renameFolder($dataFile, $folderPath, $newName);
    
    if (!$result['success']) {
        http_response_code(400);
    }
    
    echo json_encode($result);
}

/**
 * 处理删除文件夹请求
 */
function handleDelete($dataFile) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $folderPath = $_POST['folder_path'] ?? '';
    
    // 删除文件夹
    $result = deleteFolder($dataFile, $folderPath);
    
    if (!$result['success']) {
        http_response_code(400);
    }
    
    echo json_encode($result);
}

/**
 * 处理移动文件请求
 */
function handleMove($dataFile) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $fileId = $_POST['file_id'] ?? '';
    $targetPath = $_POST['target_path'] ?? '';
    
    // 移动文件
    $result = moveFileToFolder($dataFile, $fileId, $targetPath);
    
    if (!$result['success']) {
        http_response_code(400);
    }
    
    echo json_encode($result);
}
