<?php
/**
 * 最终版本的照片上传API - 不依赖fileinfo扩展
 */

// 清理输出缓冲区
if (ob_get_level()) {
    ob_end_clean();
}

// 设置JSON响应头
header('Content-Type: application/json; charset=utf-8');

// 引入缩略图助手
require_once __DIR__ . '/../includes/thumbnail-helper.php';

// 记录请求
error_log('最终上传API被调用 - ' . date('Y-m-d H:i:s'));

try {
    // 基本检查
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'message' => '只允许POST请求'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if (!isset($_FILES['photo'])) {
        echo json_encode(['success' => false, 'message' => '没有接收到文件'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $file = $_FILES['photo'];
    
    // 检查上传错误
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
        
        $message = $errorMessages[$file['error']] ?? '文件上传失败，错误代码: ' . $file['error'];
        echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 简化的文件类型验证 - 只检查扩展名
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    if (!in_array($extension, $allowedExtensions)) {
        echo json_encode(['success' => false, 'message' => '只支持 JPG、PNG、GIF 格式的图片'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 验证文件大小 (10MB)
    if ($file['size'] > 10 * 1024 * 1024) {
        echo json_encode(['success' => false, 'message' => '文件大小不能超过 10MB'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 简单的图片验证 - 使用getimagesize
    $imageInfo = @getimagesize($file['tmp_name']);
    if ($imageInfo === false) {
        echo json_encode(['success' => false, 'message' => '文件不是有效的图片'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 创建上传目录
    $uploadDir = __DIR__ . '/../uploads/photos/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            echo json_encode(['success' => false, 'message' => '无法创建上传目录'], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }

    // 生成文件名
    $fileName = uniqid() . '_' . time() . '.' . $extension;
    $filePath = $uploadDir . $fileName;
    $relativePath = 'uploads/photos/' . $fileName;

    // 移动文件
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        echo json_encode(['success' => false, 'message' => '文件保存失败'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 生成缩略图
    $thumbPath = getThumbnailPath($filePath);
    $thumbGenerated = generateThumbnail($filePath, $thumbPath, 400, 400, 80);
    error_log('缩略图生成: ' . ($thumbGenerated ? '成功' : '失败') . ' - ' . $thumbPath);

    // 读取相册数据
    $albumFile = __DIR__ . '/../data/album.json';
    $albumData = ['folders' => [], 'photos' => []];
    
    if (file_exists($albumFile)) {
        $content = file_get_contents($albumFile);
        if ($content) {
            $decoded = json_decode($content, true);
            if ($decoded) {
                $albumData = $decoded;
            }
        }
    }

    // 确保数据结构
    if (!isset($albumData['photos'])) {
        $albumData['photos'] = [];
    }

    // 创建照片数据
    $thumbRelativePath = $thumbGenerated ? 'uploads/photos/thumbs/' . pathinfo($fileName, PATHINFO_FILENAME) . '_thumb.' . $extension : '';
    $photoData = [
        'id' => uniqid() . '_' . time(),
        'filename' => $fileName,
        'path' => $relativePath,
        'thumb_path' => $thumbRelativePath,
        'title' => $_POST['title'] ?? '',
        'description' => $_POST['description'] ?? '',
        'uploaded_by' => '用户',
        'uploaded_at' => date('Y-m-d H:i:s'),
        'tags' => array_filter(array_map('trim', explode(',', $_POST['tags'] ?? ''))),
        'folder_path' => $_POST['folder_path'] ?? '',
        'file_size' => $file['size'],
        'mime_type' => $imageInfo['mime'] ?? 'image/' . $extension,
        'width' => $imageInfo[0] ?? 0,
        'height' => $imageInfo[1] ?? 0
    ];

    // 添加照片
    $albumData['photos'][] = $photoData;

    // 保存数据
    $jsonData = json_encode($albumData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (!file_put_contents($albumFile, $jsonData)) {
        // 删除已上传的文件
        @unlink($filePath);
        echo json_encode(['success' => false, 'message' => '数据保存失败'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    echo json_encode([
        'success' => true,
        'message' => '照片上传成功',
        'photo' => $photoData
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log('最终上传API异常: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => '服务器内部错误: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    error_log('最终上传API错误: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>