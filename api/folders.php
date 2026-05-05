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

// 条件加载缩略图助手（服务器可能未部署此文件）
$thumbnailHelperPath = __DIR__ . '/../includes/thumbnail-helper.php';
if (file_exists($thumbnailHelperPath)) {
    require_once $thumbnailHelperPath;
}

// 设置JSON响应头
header('Content-Type: application/json');

// 要求用户登录
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '请先登录']);
    exit();
}

// 获取操作类型
$postInput = $_POST;
// Support JSON input for POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($postInput)) {
    $postInput = json_decode(file_get_contents('php://input'), true) ?: [];
}
$action = $_GET['action'] ?? $postInput['action'] ?? '';

// 获取上下文（private 或 album）
$context = $_GET['context'] ?? $postInput['context'] ?? 'private';

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
        handleCreate($dataFile, $postInput);
        break;

    case 'list':
        handleList($dataFile);
        break;

    case 'rename':
        handleRename($dataFile, $postInput);
        break;

    case 'delete':
        handleDelete($dataFile, $postInput);
        break;

    case 'move':
        handleMove($dataFile, $postInput);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的操作']);
        exit();
}

/**
 * 处理创建文件夹请求
 */
function handleCreate($dataFile, $input) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $input['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $folderName = $input['folder_name'] ?? '';
    $parentPath = $input['parent_path'] ?? '';
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
    $all = ($_GET['all'] ?? '') === '1';

    if ($all) {
        // Return all files regardless of folder
        $data = safeReadJSON($dataFile, []);
        $files = [];
        $fileFields = ['files', 'photos'];
        foreach ($fileFields as $field) {
            if (isset($data[$field]) && is_array($data[$field])) {
                $files = array_merge($files, $data[$field]);
            }
        }
        // Add thumb_path to each file
        $hasThumbnailHelper = function_exists('getThumbnailPath');
        foreach ($files as &$f) {
            if ($hasThumbnailHelper) {
                $thumbRel = getThumbnailPath($f['path']);
                $f['thumb_path'] = file_exists(__DIR__ . '/../' . $thumbRel) ? $thumbRel : $f['path'];
            } else {
                $f['thumb_path'] = $f['path'];
            }
        }
        unset($f);

        echo json_encode([
            'success' => true,
            'folders' => [],
            'files' => $files,
            'breadcrumbs' => [],
            'total_count' => count($files)
        ]);
        return;
    }

    // 获取文件夹内容
    $contents = getFolderContents($dataFile, $path);

    // Add thumb_path to each file
    $hasThumbnailHelper = function_exists('getThumbnailPath');
    foreach ($contents['files'] as &$f) {
        if ($hasThumbnailHelper) {
            $thumbRel = getThumbnailPath($f['path']);
            $f['thumb_path'] = file_exists(__DIR__ . '/../' . $thumbRel) ? $thumbRel : $f['path'];
        } else {
            $f['thumb_path'] = $f['path'];
        }
    }
    unset($f);

    // 计算所有照片总数（不受当前路径影响）
    $allData = safeReadJSON($dataFile, []);
    $totalCount = 0;
    $allPhotos = [];
    $fileFields = ['files', 'photos'];
    foreach ($fileFields as $field) {
        if (isset($allData[$field]) && is_array($allData[$field])) {
            $totalCount += count($allData[$field]);
            $allPhotos = array_merge($allPhotos, $allData[$field]);
        }
    }

    // Attach file_count to each folder (recursive — includes subfolder photos)
    foreach ($contents['folders'] as &$fld) {
        $prefix = $fld['path'] . '/';
        $fld['file_count'] = count(array_filter($allPhotos, function($p) use ($fld, $prefix) {
            $fp = $p['folder_path'] ?? '';
            return $fp === $fld['path'] || strpos($fp, $prefix) === 0;
        }));
    }
    unset($fld);

    // 生成面包屑
    $breadcrumbs = generateBreadcrumbs($path);

    echo json_encode([
        'success' => true,
        'folders' => $contents['folders'],
        'files' => $contents['files'],
        'breadcrumbs' => $breadcrumbs,
        'total_count' => $totalCount
    ]);
}

/**
 * 处理重命名文件夹请求
 */
function handleRename($dataFile, $input) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $input['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $folderPath = $input['folder_path'] ?? '';
    $newName = $input['new_name'] ?? '';
    
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
function handleDelete($dataFile, $input) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $input['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $folderPath = $input['folder_path'] ?? '';
    
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
function handleMove($dataFile, $input) {
    // 验证请求方法
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '方法不允许']);
        exit();
    }
    
    // 验证 CSRF 令牌
    $csrfToken = $input['csrf_token'] ?? '';
    if (!validateCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF 验证失败']);
        exit();
    }
    
    // 获取参数
    $fileId = $input['file_id'] ?? '';
    $targetPath = $input['target_path'] ?? '';
    
    // 移动文件
    $result = moveFileToFolder($dataFile, $fileId, $targetPath);
    
    if (!$result['success']) {
        http_response_code(400);
    }
    
    echo json_encode($result);
}
