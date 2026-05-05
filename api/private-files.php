<?php
/**
 * 隐私空间文件上传API
 * 处理私人文件的上传、下载和删除
 */
define('INCLUDED', true);

// 确保输出缓冲开启，防止任何意外输出污染JSON
if (ob_get_level()) {
    ob_clean();
} else {
    ob_start();
}

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

$currentUserId = getCurrentUserId();
$userUploadDir = __DIR__ . "/../uploads/{$currentUserId}/";
$privateFile = __DIR__ . "/../data/private_{$currentUserId}.json";

// 确保用户上传目录存在
if (!file_exists($userUploadDir)) {
    mkdir($userUploadDir, 0755, true);
}

/**
 * 获取用户文件列表
 * @param string $folderPath 文件夹路径（可选，用于过滤）
 * @return array 文件列表
 */
function getPrivateFiles($folderPath = null) {
    global $privateFile;
    
    if (file_exists($privateFile)) {
        $data = json_decode(file_get_contents($privateFile), true) ?: [];
        $files = $data['files'] ?? [];
        
        // 如果指定了文件夹路径，进行过滤
        if ($folderPath !== null) {
            $files = array_filter($files, function($file) use ($folderPath) {
                $fileFolderPath = $file['folder_path'] ?? '';
                return $fileFolderPath === $folderPath;
            });
        }
        
        return array_values($files);
    }
    
    return [];
}

/**
 * 上传私人文件
 * @param array $file 上传的文件信息
 * @param string $folderPath 文件夹路径
 * @return array 结果
 */
function uploadPrivateFile($file, $folderPath = '') {
    global $userUploadDir, $privateFile, $currentUserId;
    
    // 验证文件
    if (!isset($file['error']) || is_array($file['error'])) {
        return ['success' => false, 'message' => '无效的文件'];
    }
    
    // 检查错误
    switch ($file['error']) {
        case UPLOAD_ERR_OK:
            break;
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return ['success' => false, 'message' => '文件太大'];
        case UPLOAD_ERR_NO_FILE:
            return ['success' => false, 'message' => '没有选择文件'];
        default:
            return ['success' => false, 'message' => '上传失败'];
    }
    
    // 检查文件大小（最大10MB）
    $maxSize = 10 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        return ['success' => false, 'message' => '文件大小不能超过10MB'];
    }
    
    // 获取文件信息
    $originalName = basename($file['name']);
    $fileSize = $file['size'];
    $tmpName = $file['tmp_name'];
    
    // 生成唯一文件名
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $uniqueName = uniqid() . '_' . time() . '.' . $extension;
    $targetPath = $userUploadDir . $uniqueName;
    
    // 移动文件
    if (!move_uploaded_file($tmpName, $targetPath)) {
        return ['success' => false, 'message' => '文件保存失败'];
    }
    
    // 读取私人数据
    $privateData = [];
    if (file_exists($privateFile)) {
        $privateData = json_decode(file_get_contents($privateFile), true) ?: [];
    }
    
    if (!isset($privateData['files'])) {
        $privateData['files'] = [];
    }
    
    // 创建文件记录
    $fileRecord = [
        'id' => uniqid(),
        'original_name' => $originalName,
        'stored_name' => $uniqueName,
        'size' => $fileSize,
        'extension' => $extension,
        'uploaded_at' => date('Y-m-d H:i:s'),
        'path' => "uploads/{$currentUserId}/{$uniqueName}",
        'folder_path' => $folderPath
    ];
    
    $privateData['files'][] = $fileRecord;
    
    // 保存记录
    if (file_put_contents($privateFile, json_encode($privateData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        return [
            'success' => true,
            'message' => '文件上传成功',
            'file' => $fileRecord
        ];
    }
    
    // 如果保存记录失败，删除已上传的文件
    unlink($targetPath);
    return ['success' => false, 'message' => '保存文件记录失败'];
}

/**
 * 删除私人文件
 * @param string $fileId 文件ID
 * @return array 结果
 */
function deletePrivateFile($fileId) {
    global $privateFile, $userUploadDir;
    
    if (!file_exists($privateFile)) {
        return ['success' => false, 'message' => '文件不存在'];
    }
    
    $privateData = json_decode(file_get_contents($privateFile), true) ?: [];
    
    if (!isset($privateData['files'])) {
        return ['success' => false, 'message' => '文件不存在'];
    }
    
    // 查找文件
    $fileToDelete = null;
    foreach ($privateData['files'] as $file) {
        if ($file['id'] === $fileId) {
            $fileToDelete = $file;
            break;
        }
    }
    
    if (!$fileToDelete) {
        return ['success' => false, 'message' => '文件不存在'];
    }
    
    // 删除物理文件
    $filePath = $userUploadDir . $fileToDelete['stored_name'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }
    
    // 从记录中删除
    $privateData['files'] = array_values(array_filter(
        $privateData['files'],
        function($file) use ($fileId) { return $file['id'] !== $fileId; }
    ));
    
    if (file_put_contents($privateFile, json_encode($privateData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        return ['success' => true, 'message' => '文件删除成功'];
    }
    
    return ['success' => false, 'message' => '删除失败'];
}

// 处理请求
$postInput = $_POST;
// Support JSON input (API.post() sends JSON, which doesn't populate $_POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($postInput)) {
    $postInput = json_decode(file_get_contents('php://input'), true) ?: [];
}
$action = $postInput['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'get':
        // 获取文件列表
        $folderPath = $_GET['folder_path'] ?? null;
        $files = getPrivateFiles($folderPath);
        echo json_encode([
            'success' => true,
            'files' => array_reverse($files), // 最新的在前面
            'total' => count($files)
        ]);
        break;
        
    case 'upload':
        // 上传文件
        if (!isset($_FILES['file'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '没有选择文件']);
            exit();
        }

        // 验证CSRF令牌
        $csrf_token = $postInput['csrf_token'] ?? '';
        if (!validateCSRFToken($csrf_token)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试']);
            exit();
        }

        // 获取文件夹路径
        $folderPath = $postInput['folder_path'] ?? '';

        $result = uploadPrivateFile($_FILES['file'], $folderPath);

        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(400);
            echo json_encode($result);
        }
        break;

    case 'delete':
        // 删除文件
        $csrf_token = $postInput['csrf_token'] ?? '';
        if (!validateCSRFToken($csrf_token)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试']);
            exit();
        }

        $fileId = $postInput['file_id'] ?? '';

        if (empty($fileId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '文件ID不能为空']);
            exit();
        }

        $result = deletePrivateFile($fileId);

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
