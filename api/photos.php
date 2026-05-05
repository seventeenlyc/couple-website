<?php
/**
 * 照片管理 API
 * 处理照片的删除、移动等操作
 */
session_start();

// 设置JSON响应头
header('Content-Type: application/json; charset=utf-8');

try {
    // 基本检查
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'message' => '只允许POST请求'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // Support JSON input
    $input = $_POST;
    if (empty($input)) {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
    }

    // 获取操作类型
    $action = $input['action'] ?? '';

    if ($action !== 'delete') {
        echo json_encode(['success' => false, 'message' => '无效的操作: ' . $action], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 验证CSRF令牌
    $csrfToken = $input['csrf_token'] ?? '';
    $expectedToken = $_SESSION['csrf_token'] ?? '';

    if (empty($expectedToken) || $csrfToken !== $expectedToken) {
        echo json_encode([
            'success' => false,
            'message' => 'CSRF验证失败'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

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
    $data = [];
    
    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        if ($content) {
            $data = json_decode($content, true) ?: [];
        }
    }
    
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
    $filePath = __DIR__ . '/../' . $photoToDelete['path'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }

    // 从数据中移除照片记录
    array_splice($data['photos'], $photoIndex, 1);

    // 保存数据
    $jsonContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents($dataFile, $jsonContent);

    echo json_encode([
        'success' => true,
        'message' => '照片删除成功'
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>