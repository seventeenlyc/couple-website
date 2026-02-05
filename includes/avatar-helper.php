<?php
/**
 * 头像管理辅助函数
 * 提供用户头像上传、验证和显示功能
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/json-helper.php';

// 头像配置常量
define('AVATAR_UPLOAD_DIR', __DIR__ . '/../uploads/avatars/');
define('AVATAR_MAX_SIZE', 2 * 1024 * 1024); // 2MB
define('AVATAR_ALLOWED_TYPES', ['image/jpeg', 'image/png', 'image/gif']);
define('AVATAR_ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif']);
define('DEFAULT_AVATAR_PATH', 'assets/images/default-avatar.svg');

/**
 * 获取用户头像URL
 * @param string $username 用户名
 * @return string 头像URL或默认头像
 */
function getUserAvatarUrl($username) {
    $config = loadConfig();
    
    if (!isset($config['users'][$username])) {
        return getDefaultAvatarUrl();
    }
    
    $avatarFile = $config['users'][$username]['avatar'] ?? null;
    
    if ($avatarFile && file_exists($avatarFile)) {
        return $avatarFile;
    }
    
    return getDefaultAvatarUrl();
}

/**
 * 获取默认头像URL
 * @return string 默认头像URL
 */
function getDefaultAvatarUrl() {
    return DEFAULT_AVATAR_PATH;
}

/**
 * 检查用户是否有头像
 * @param string $username 用户名
 * @return bool 是否有头像
 */
function hasUserAvatar($username) {
    $config = loadConfig();
    
    if (!isset($config['users'][$username])) {
        return false;
    }
    
    $avatarFile = $config['users'][$username]['avatar'] ?? null;
    
    return $avatarFile && file_exists($avatarFile);
}

/**
 * 验证头像文件
 * @param array $file 上传的文件信息
 * @return array 包含valid和error的数组
 */
function validateAvatarFile($file) {
    // 检查文件是否上传成功
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => '文件大小超过服务器限制',
            UPLOAD_ERR_FORM_SIZE => '文件大小超过表单限制',
            UPLOAD_ERR_PARTIAL => '文件只上传了一部分',
            UPLOAD_ERR_NO_FILE => '没有文件被上传',
            UPLOAD_ERR_NO_TMP_DIR => '找不到临时文件夹',
            UPLOAD_ERR_CANT_WRITE => '文件写入失败',
            UPLOAD_ERR_EXTENSION => '文件上传被扩展程序阻止'
        ];
        $error = $errorMessages[$file['error']] ?? '文件上传失败';
        return ['valid' => false, 'error' => $error];
    }
    
    // 检查文件大小 (2MB)
    if ($file['size'] > AVATAR_MAX_SIZE) {
        return ['valid' => false, 'error' => '文件大小不能超过2MB'];
    }
    
    // 检查文件扩展名
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    if (!in_array($extension, AVATAR_ALLOWED_EXTENSIONS)) {
        return ['valid' => false, 'error' => '只支持JPG、PNG、GIF格式'];
    }
    
    // 使用getimagesize验证是否为真实图片
    $imageInfo = @getimagesize($file['tmp_name']);
    if ($imageInfo === false) {
        return ['valid' => false, 'error' => '文件不是有效的图片'];
    }
    
    // 验证图片类型
    $allowedImageTypes = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF];
    if (!in_array($imageInfo[2], $allowedImageTypes)) {
        return ['valid' => false, 'error' => '只支持JPG、PNG、GIF格式'];
    }
    
    return ['valid' => true];
}

/**
 * 保存用户头像
 * @param string $username 用户名
 * @param array $file 上传的文件信息
 * @return array 包含success和message的数组
 */
function saveUserAvatar($username, $file) {
    // 验证文件
    $validation = validateAvatarFile($file);
    if (!$validation['valid']) {
        return ['success' => false, 'message' => $validation['error']];
    }
    
    // 获取用户配置
    $config = loadConfig();
    if (!isset($config['users'][$username])) {
        return ['success' => false, 'message' => '用户不存在'];
    }
    
    $userConfig = $config['users'][$username];
    $userId = $userConfig['id'];
    
    // 生成唯一文件名（清理文件名以防止目录遍历）
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $sanitizedExtension = preg_replace('/[^a-z0-9]/', '', $extension);
    // 使用微秒时间戳确保唯一性
    $timestamp = round(microtime(true) * 1000); // 毫秒级时间戳
    $filename = $userId . '_' . $timestamp . '.' . $sanitizedExtension;
    $uploadPath = 'uploads/avatars/' . $filename;
    $fullPath = __DIR__ . '/../' . $uploadPath;
    
    // 创建目录
    $uploadDir = dirname($fullPath);
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            return ['success' => false, 'message' => '无法创建上传目录'];
        }
    }
    
    // 删除旧头像
    $oldAvatar = $userConfig['avatar'] ?? null;
    if ($oldAvatar && file_exists(__DIR__ . '/../' . $oldAvatar)) {
        @unlink(__DIR__ . '/../' . $oldAvatar);
    }
    
    // 移动文件
    // 在测试环境中，使用copy代替move_uploaded_file
    $moved = false;
    if (defined('AVATAR_TEST_MODE') && AVATAR_TEST_MODE === true) {
        $moved = copy($file['tmp_name'], $fullPath);
    } else {
        $moved = move_uploaded_file($file['tmp_name'], $fullPath);
    }
    
    if (!$moved) {
        return ['success' => false, 'message' => '文件上传失败'];
    }
    
    // 更新配置
    $updateResult = updateUserAvatar($username, $uploadPath);
    if (!$updateResult) {
        // 如果配置更新失败，删除已上传的文件
        @unlink($fullPath);
        return ['success' => false, 'message' => '配置文件更新失败'];
    }
    
    return ['success' => true, 'message' => '头像上传成功', 'avatarUrl' => $uploadPath];
}

/**
 * 更新用户头像配置
 * @param string $username 用户名
 * @param string $avatarPath 头像文件路径
 * @return bool 是否成功
 */
function updateUserAvatar($username, $avatarPath) {
    try {
        $config = loadConfig();
        
        if (!isset($config['users'][$username])) {
            return false;
        }
        
        $config['users'][$username]['avatar'] = $avatarPath;
        
        // 使用安全写入函数
        return safeWriteJSON(CONFIG_FILE, $config, true);
    } catch (Exception $e) {
        error_log('更新用户头像配置失败: ' . $e->getMessage());
        return false;
    }
}
