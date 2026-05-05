<?php
/**
 * 会话管理模块
 * 处理用户会话的创建、验证和销毁
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

/**
 * 初始化会话
 * 配置安全的会话参数
 */
function initSession() {
    // 如果会话已经启动，直接返回
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    
    // 配置会话安全参数
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    ini_set('session.cookie_secure', 0); // 开发环境设为0，生产环境应设为1
    
    // 设置会话超时时间（24小时）
    ini_set('session.gc_maxlifetime', 86400);
    
    // 启动会话
    session_start();
    
    // 会话固定攻击防护：定期重新生成会话ID
    if (!isset($_SESSION['created'])) {
        $_SESSION['created'] = time();
    } else if (time() - $_SESSION['created'] > 1800) {
        // 每30分钟重新生成一次会话ID
        session_regenerate_id(true);
        $_SESSION['created'] = time();
    }
}

/**
 * 创建用户会话
 * @param string $userName 用户名（name1或name2）
 * @param string $userId 用户ID（id1或id2）
 */
function createSession($userName, $userId) {
    initSession();
    
    // 登录时重新生成会话ID，防止会话固定攻击
    session_regenerate_id(true);
    
    // 设置会话数据
    $_SESSION['logged_in'] = true;
    $_SESSION['user_name'] = $userName;
    $_SESSION['user_id'] = $userId;
    $_SESSION['login_time'] = time();
    $_SESSION['created'] = time();
    
    // 初始化隐私空间认证状态
    $_SESSION['private_authenticated'] = false;
    $_SESSION['private_user'] = null;
}

/**
 * 检查用户是否已登录
 * @return bool 是否已登录
 */
function isLoggedIn() {
    return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
}

/**
 * 获取当前登录用户名
 * @return string|null 用户名或null
 */
function getCurrentUser() {
    return isset($_SESSION['user_name']) ? $_SESSION['user_name'] : null;
}

/**
 * 获取当前登录用户ID
 * @return string|null 用户ID或null
 */
function getCurrentUserId() {
    return isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
}

/**
 * 销毁会话（登出）
 */
function destroySession() {
    initSession();
    
    // 清空会话数据
    $_SESSION = array();
    
    // 删除会话cookie
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', time() - 3600, '/');
    }
    
    // 销毁会话
    session_destroy();
}

/**
 * 设置隐私空间认证状态
 * @param string $userId 用户ID
 */
function setPrivateAuthenticated($userId) {
    initSession();
    $_SESSION['private_authenticated'] = true;
    $_SESSION['private_user'] = $userId;
}

/**
 * 检查隐私空间是否已认证
 * @return bool 是否已认证
 */
function isPrivateAuthenticated() {
    return isset($_SESSION['private_authenticated']) && $_SESSION['private_authenticated'] === true;
}

/**
 * 获取隐私空间认证的用户ID
 * @return string|null 用户ID或null
 */
function getPrivateUser() {
    return isset($_SESSION['private_user']) ? $_SESSION['private_user'] : null;
}

/**
 * 清除隐私空间认证状态
 */
function clearPrivateAuthentication() {
    initSession();
    $_SESSION['private_authenticated'] = false;
    $_SESSION['private_user'] = null;
}

// 自动初始化会话，然后立即释放锁（$_SESSION 仍可读）
// 需要写入会话的函数会通过 initSession() 自动重新打开
initSession();
session_write_close();

/**
 * 设置一次性消息（Flash Message）
 * @param string $message 消息内容
 * @param string $type 消息类型 (success, error, info, warning)
 */
function setFlashMessage($message, $type = 'info') {
    initSession();
    $_SESSION['flash_message'] = [
        'message' => $message,
        'type' => $type
    ];
}

/**
 * 获取并清除一次性消息
 * @return array|null 消息数组或null ['message' => string, 'type' => string]
 */
function getFlashMessage() {
    initSession();
    if (isset($_SESSION['flash_message'])) {
        $message = $_SESSION['flash_message'];
        unset($_SESSION['flash_message']);
        return $message;
    }
    return null;
}

/**
 * 检查是否有一次性消息
 * @return bool 是否有消息
 */
function hasFlashMessage() {
    return isset($_SESSION['flash_message']);
}
