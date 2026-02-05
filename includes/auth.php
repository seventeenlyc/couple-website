<?php
/**
 * 认证辅助函数
 * 提供登录验证和访问控制功能
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/session.php';

/**
 * 验证登录凭据
 * @param string $you 你是谁
 * @param string $baby 你的宝宝是谁
 * @return array|false 成功返回用户信息数组，失败返回false
 */
function validateLogin($you, $baby) {
    // 清理输入
    $you = trim($you);
    $baby = trim($baby);
    
    // 检查空输入
    if (empty($you) || empty($baby)) {
        return false;
    }
    
    // 获取用户配置
    $userConfig = getUserConfig($you);
    
    // 检查用户是否存在
    if ($userConfig === null) {
        return false;
    }
    
    // 验证伴侣名字是否匹配
    if ($userConfig['partner'] !== $baby) {
        return false;
    }
    
    // 返回用户信息
    return [
        'name' => $you,
        'id' => $userConfig['id'],
        'partner' => $baby
    ];
}

/**
 * 执行登录操作
 * @param string $you 你是谁
 * @param string $baby 你的宝宝是谁
 * @return bool 登录是否成功
 */
function performLogin($you, $baby) {
    $userInfo = validateLogin($you, $baby);
    
    if ($userInfo === false) {
        return false;
    }
    
    // 创建会话
    createSession($userInfo['name'], $userInfo['id']);
    
    return true;
}

/**
 * 要求用户登录
 * 如果用户未登录，重定向到登录页面
 * @param string $loginPage 登录页面路径，默认为 index.php
 */
function requireLogin($loginPage = 'index.php') {
    if (!isLoggedIn()) {
        // 保存当前页面URL，登录后可以返回
        $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'];
        
        // 重定向到登录页面
        header('Location: ' . $loginPage);
        exit();
    }
}

/**
 * 验证隐私空间密码
 * @param string $password 输入的密码
 * @return string|false 成功返回用户ID，失败返回false
 */
function validatePrivatePassword($password) {
    // 必须先登录
    if (!isLoggedIn()) {
        return false;
    }
    
    $currentUser = getCurrentUser();
    $userConfig = getUserConfig($currentUser);
    
    if ($userConfig === null) {
        return false;
    }
    
    // 验证密码
    if ($userConfig['privatePassword'] === $password) {
        return $userConfig['id'];
    }
    
    return false;
}

/**
 * 检查是否有登录后重定向URL
 * @return string|null 重定向URL或null
 */
function getRedirectAfterLogin() {
    if (isset($_SESSION['redirect_after_login'])) {
        $redirect = $_SESSION['redirect_after_login'];
        unset($_SESSION['redirect_after_login']);
        return $redirect;
    }
    return null;
}

/**
 * 清理用户输入，防止XSS攻击
 * @param string $input 用户输入
 * @return string 清理后的输入
 */
function sanitizeInput($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

/**
 * 检查CSRF令牌
 * @param string $token 提交的令牌
 * @return bool 令牌是否有效
 */
function validateCSRFToken($token) {
    initSession();
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * 生成CSRF令牌
 * @return string CSRF令牌
 */
function generateCSRFToken() {
    initSession();
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * 记录登录失败尝试
 * @param string $identifier 标识符（用户名或IP）
 */
function recordLoginAttempt($identifier) {
    initSession();
    
    if (!isset($_SESSION['login_attempts'])) {
        $_SESSION['login_attempts'] = [];
    }
    
    if (!isset($_SESSION['login_attempts'][$identifier])) {
        $_SESSION['login_attempts'][$identifier] = [
            'count' => 0,
            'last_attempt' => time()
        ];
    }
    
    $_SESSION['login_attempts'][$identifier]['count']++;
    $_SESSION['login_attempts'][$identifier]['last_attempt'] = time();
}

/**
 * 检查是否被锁定（登录尝试次数过多）
 * @param string $identifier 标识符（用户名或IP）
 * @param int $maxAttempts 最大尝试次数，默认5次
 * @param int $lockoutTime 锁定时间（秒），默认15分钟
 * @return bool 是否被锁定
 */
function isLockedOut($identifier, $maxAttempts = 5, $lockoutTime = 900) {
    initSession();
    
    if (!isset($_SESSION['login_attempts'][$identifier])) {
        return false;
    }
    
    $attempts = $_SESSION['login_attempts'][$identifier];
    
    // 检查是否超过最大尝试次数
    if ($attempts['count'] >= $maxAttempts) {
        // 检查锁定时间是否已过
        if (time() - $attempts['last_attempt'] < $lockoutTime) {
            return true;
        } else {
            // 锁定时间已过，重置计数
            unset($_SESSION['login_attempts'][$identifier]);
            return false;
        }
    }
    
    return false;
}

/**
 * 重置登录尝试计数
 * @param string $identifier 标识符（用户名或IP）
 */
function resetLoginAttempts($identifier) {
    initSession();
    
    if (isset($_SESSION['login_attempts'][$identifier])) {
        unset($_SESSION['login_attempts'][$identifier]);
    }
}

/**
 * 获取剩余锁定时间
 * @param string $identifier 标识符（用户名或IP）
 * @param int $lockoutTime 锁定时间（秒），默认15分钟
 * @return int 剩余秒数
 */
function getRemainingLockoutTime($identifier, $lockoutTime = 900) {
    initSession();
    
    if (!isset($_SESSION['login_attempts'][$identifier])) {
        return 0;
    }
    
    $attempts = $_SESSION['login_attempts'][$identifier];
    $elapsed = time() - $attempts['last_attempt'];
    $remaining = $lockoutTime - $elapsed;
    
    return max(0, $remaining);
}

/**
 * 验证文件上传安全性
 * @param array $file $_FILES数组中的文件信息
 * @param array $allowedTypes 允许的MIME类型
 * @param int $maxSize 最大文件大小（字节）
 * @return array 包含success和message的数组
 */
function validateFileUpload($file, $allowedTypes, $maxSize) {
    // 检查文件是否存在
    if (!isset($file['error']) || is_array($file['error'])) {
        return ['success' => false, 'message' => '无效的文件'];
    }
    
    // 检查上传错误
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
    
    // 检查文件大小
    if ($file['size'] > $maxSize) {
        return ['success' => false, 'message' => '文件大小超过限制'];
    }
    
    // 检查MIME类型
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        return ['success' => false, 'message' => '不支持的文件类型'];
    }
    
    return ['success' => true, 'message' => '验证通过'];
}

/**
 * 生成安全的文件名
 * @param string $originalName 原始文件名
 * @return string 安全的文件名
 */
function generateSafeFileName($originalName) {
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $safeName = uniqid() . '_' . time();
    
    if (!empty($extension)) {
        $safeName .= '.' . $extension;
    }
    
    return $safeName;
}

/**
 * 验证JSON数据
 * @param string $json JSON字符串
 * @return array|false 成功返回解析后的数组，失败返回false
 */
function validateJSON($json) {
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return false;
    }
    
    return $data;
}

/**
 * 清理HTML输出，防止XSS
 * @param string $html HTML内容
 * @return string 清理后的HTML
 */
function sanitizeHTML($html) {
    // 允许的标签
    $allowedTags = '<p><br><strong><em><u><a><ul><ol><li><h1><h2><h3><h4><h5><h6>';
    
    return strip_tags($html, $allowedTags);
}
