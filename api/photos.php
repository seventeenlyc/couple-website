<?php
/**
 * 照片管理 API
 * 处理照片的删除、移动等操作
 */
if (!defined('INCLUDED')) define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/json-helper.php';

// 设置JSON响应头
header('Content-Type: application/json; charset=utf-8');

try {
    if (!isLoggedIn()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => '请先登录'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 基本检查
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'message' => '只允许POST请求'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // Support JSON input
    $input = getRequestInput();

    // 获取操作类型
    $action = $input['action'] ?? '';

    if ($action !== 'delete') {
        echo json_encode(['success' => false, 'message' => '无效的操作: ' . $action], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 验证CSRF令牌
    requireCSRFTokenFromInput($input);

    // 获取照片ID
    $photoId = $input['photo_id'] ?? '';
    
    if (empty($photoId)) {
        echo json_encode([
            'success' => false, 
            'message' => '缺少照片ID'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 读取数据文件
    $dataFile = __DIR__ . "/../data/album.json";
    $data = safeReadJSON($dataFile, []);
    
    if (!isset($data['photos'])) {
        $data['photos'] = [];
    }

    // 查找要删除的照片
    $photoIndex = -1;
    $photoToDelete = null;
    foreach ($data['photos'] as $index => $photo) {
        if ($photo['id'] === $photoId) {
            $photoIndex = $index;
            $photoToDelete = $photo;
            break;
        }
    }

    if ($photoIndex === -1) {
        echo json_encode(['success' => false, 'message' => '照片不存在'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 删除物理文件
    $photosDir = __DIR__ . '/../uploads/photos/';
    $filePath = __DIR__ . '/../' . ($photoToDelete['path'] ?? '');
    if (file_exists($filePath)) {
        safeUnlinkInside($photosDir, $filePath);
    }

    if (!empty($photoToDelete['thumb_path'])) {
        $thumbPath = __DIR__ . '/../' . $photoToDelete['thumb_path'];
        if (file_exists($thumbPath)) {
            safeUnlinkInside($photosDir, $thumbPath);
        }
    }

    // 从数据中移除照片记录
    array_splice($data['photos'], $photoIndex, 1);

    // 保存数据
    if (!safeWriteJSON($dataFile, $data)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => '数据保存失败'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    echo json_encode([
        'success' => true,
        'message' => '照片删除成功'
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
