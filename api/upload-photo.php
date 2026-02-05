<?php
/**
 * 照片上传API
 * 处理照片上传请求，支持多照片上传
 */
define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/json-helper.php';

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

// 验证CSRF令牌
$csrf_token = $_POST['csrf_token'] ?? '';
if (!validateCSRFToken($csrf_token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试']);
    exit();
}

$currentUser = getCurrentUser();
$albumFile = __DIR__ . '/../data/album.json';

/**
 * 验证图片文件
 * @param array $file 上传的文件信息
 * @return array 包含success和message的数组
 */
function validateImageFile($file) {
    $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    $maxSize = 10 * 1024 * 1024; // 10MB
    
    // 检查文件是否上传成功
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => '文件大小超过服务器限制',
            UPLOAD_ERR_FORM_SIZE => '文件大小超过表单限制',
            UPLOAD_ERR_PARTIAL => '文件只上传了一部分',
            UPLOAD_ERR_NO_FILE => '没有文件被上传',
            UPLOAD_ERR_NO_TMP_DIR => '找不到临时文件夹',
            UPLOAD_ERR_CANT_WRITE => '文件写入失败',
            UPLOAD_ERR_EXTENSION => '文件上传被扩展程序阻止'
        ];
        
        $message = $errorMessages[$file['error']] ?? '文件上传失败';
        return ['success' => false, 'message' => $message];
    }
    
    // 检查文件类型
    $fileInfo = pathinfo($file['name']);
    $extension = strtolower($fileInfo['extension'] ?? '');
    
    if (!in_array($extension, $allowedTypes)) {
        return ['success' => false, 'message' => '只支持 JPG、PNG、GIF 格式的图片'];
    }
    
    // 检查文件大小
    if ($file['size'] > $maxSize) {
        return ['success' => false, 'message' => '文件大小不能超过 10MB'];
    }
    
    // 验证MIME类型
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedMimeTypes)) {
        return ['success' => false, 'message' => '文件类型验证失败'];
    }
    
    // 验证是否为真实图片
    $imageInfo = getimagesize($file['tmp_name']);
    if ($imageInfo === false) {
        return ['success' => false, 'message' => '文件不是有效的图片'];
    }
    
    return ['success' => true, 'extension' => $extension, 'mime_type' => $mimeType];
}

/**
 * 上传照片
 * @param array $file 上传的文件信息
 * @param array $metadata 照片元数据
 * @param string $folderPath 文件夹路径
 * @return array 包含success、message和photo的数组
 */
function uploadPhoto($file, $metadata, $folderPath = '') {
    global $albumFile, $currentUser;
    
    // 验证文件
    $validation = validateImageFile($file);
    if (!$validation['success']) {
        return $validation;
    }
    
    // 创建上传目录
    $uploadDir = __DIR__ . '/../uploads/photos/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            return ['success' => false, 'message' => '无法创建上传目录'];
        }
    }
    
    // 生成唯一文件名
    $timestamp = round(microtime(true) * 1000); // 毫秒级时间戳
    $fileName = uniqid() . '_' . $timestamp . '.' . $validation['extension'];
    $filePath = $uploadDir . $fileName;
    $relativePath = 'uploads/photos/' . $fileName;
    
    // 移动文件
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        return ['success' => false, 'message' => '文件保存失败'];
    }
    
    // 创建照片数据
    $photoData = [
        'id' => uniqid() . '_' . $timestamp,
        'filename' => $fileName,
        'path' => $relativePath,
        'title' => sanitizeInput($metadata['title'] ?? ''),
        'description' => sanitizeInput($metadata['description'] ?? ''),
        'uploaded_by' => $currentUser,
        'uploaded_at' => date('Y-m-d H:i:s'),
        'tags' => array_filter(array_map('trim', explode(',', $metadata['tags'] ?? ''))),
        'folder_path' => $folderPath,
        'file_size' => $file['size'],
        'mime_type' => $validation['mime_type']
    ];
    
    // 读取现有相册数据
    $albumData = safeReadJSON($albumFile, ['folders' => [], 'photos' => []]);
    
    // 确保数据结构正确（支持新格式）
    if (!isset($albumData['folders'])) {
        // 如果是旧格式（数组），转换为新格式
        if (isset($albumData[0])) {
            $oldPhotos = $albumData;
            $albumData = ['folders' => [], 'photos' => []];
            foreach ($oldPhotos as $photo) {
                $photo['folder_path'] = '';
                $albumData['photos'][] = $photo;
            }
        } else {
            $albumData = ['folders' => [], 'photos' => []];
        }
    }
    if (!isset($albumData['photos'])) {
        $albumData['photos'] = [];
    }
    
    // 添加新照片
    $albumData['photos'][] = $photoData;
    
    // 保存到文件
    if (!safeWriteJSON($albumFile, $albumData)) {
        // 如果保存失败，删除已上传的文件
        @unlink($filePath);
        return ['success' => false, 'message' => '数据保存失败'];
    }
    
    return [
        'success' => true,
        'message' => '照片上传成功',
        'photo' => $photoData
    ];
}

// 处理上传请求
try {
    if (isset($_FILES['photo'])) {
        // 获取文件夹路径
        $folderPath = $_POST['folder_path'] ?? '';
        
        // 记录调试信息
        error_log('单文件上传请求: ' . $_FILES['photo']['name'] . ', 大小: ' . $_FILES['photo']['size']);
        
        // 单文件上传
        $result = uploadPhoto($_FILES['photo'], $_POST, $folderPath);
        
        if ($result['success']) {
            error_log('上传成功: ' . $result['photo']['filename']);
            echo json_encode($result);
        } else {
            error_log('上传失败: ' . $result['message']);
            http_response_code(400);
            echo json_encode($result);
        }
    } elseif (isset($_FILES['photos'])) {
        // 多文件上传
        $folderPath = $_POST['folder_path'] ?? '';
        $results = [];
        $successCount = 0;
        $failCount = 0;
        
        // 处理多个文件
        $fileCount = count($_FILES['photos']['name']);
        
        for ($i = 0; $i < $fileCount; $i++) {
            $file = [
                'name' => $_FILES['photos']['name'][$i],
                'type' => $_FILES['photos']['type'][$i],
                'tmp_name' => $_FILES['photos']['tmp_name'][$i],
                'error' => $_FILES['photos']['error'][$i],
                'size' => $_FILES['photos']['size'][$i]
            ];
            
            // 为每个文件创建单独的元数据
            $metadata = [
                'title' => $_POST['titles'][$i] ?? '',
                'description' => $_POST['descriptions'][$i] ?? '',
                'tags' => $_POST['tags'] ?? ''
            ];
            
            $result = uploadPhoto($file, $metadata, $folderPath);
            $results[] = $result;
            
            if ($result['success']) {
                $successCount++;
            } else {
                $failCount++;
            }
        }
        
        // 返回批量上传结果
        echo json_encode([
            'success' => $successCount > 0,
            'message' => "上传完成：成功 {$successCount} 张，失败 {$failCount} 张",
            'results' => $results,
            'summary' => [
                'total' => $fileCount,
                'success' => $successCount,
                'failed' => $failCount
            ]
        ]);
    } else {
        error_log('没有接收到文件数据');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '请选择要上传的照片']);
    }
} catch (Exception $e) {
    error_log('上传处理异常: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器内部错误: ' . $e->getMessage()]);
}
?>