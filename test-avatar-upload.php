<?php
/**
 * 头像上传测试和诊断
 */

require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/avatar-helper.php';

// 检查用户是否登录
if (!isset($_SESSION['user_id'])) {
    die('请先登录');
}

$userId = $_SESSION['user_id'];
$username = $_SESSION['username'];

echo "<h1>头像上传诊断</h1>";

// 1. 检查目录权限
echo "<h2>1. 目录检查</h2>";
$uploadDir = __DIR__ . '/uploads/avatars/';
echo "上传目录: {$uploadDir}<br>";
echo "目录存在: " . (is_dir($uploadDir) ? '✅ 是' : '❌ 否') . "<br>";
echo "目录可写: " . (is_writable($uploadDir) ? '✅ 是' : '❌ 否') . "<br>";

// 2. 检查 PHP 配置
echo "<h2>2. PHP 配置</h2>";
echo "file_uploads: " . (ini_get('file_uploads') ? '✅ 开启' : '❌ 关闭') . "<br>";
echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "<br>";
echo "post_max_size: " . ini_get('post_max_size') . "<br>";
echo "max_file_uploads: " . ini_get('max_file_uploads') . "<br>";

// 3. 检查用户配置
echo "<h2>3. 用户配置</h2>";
echo "用户ID: {$userId}<br>";
echo "用户名: {$username}<br>";

$config = loadConfig();
if (isset($config['users'][$username])) {
    echo "用户配置存在: ✅ 是<br>";
    $currentAvatar = $config['users'][$username]['avatar'] ?? '无';
    echo "当前头像: {$currentAvatar}<br>";
} else {
    echo "用户配置存在: ❌ 否<br>";
}

// 4. 测试文件写入权限
echo "<h2>4. 写入权限测试</h2>";
$testFile = $uploadDir . 'test_' . time() . '.txt';
$writeTest = file_put_contents($testFile, 'test');
if ($writeTest !== false) {
    echo "写入测试: ✅ 成功<br>";
    unlink($testFile);
} else {
    echo "写入测试: ❌ 失败<br>";
}

// 5. 检查 CSRF 令牌函数
echo "<h2>5. CSRF 令牌检查</h2>";
if (function_exists('validateCSRFToken')) {
    echo "validateCSRFToken 函数: ✅ 存在<br>";
} else {
    echo "validateCSRFToken 函数: ❌ 不存在<br>";
}

if (function_exists('generateCSRFToken')) {
    echo "generateCSRFToken 函数: ✅ 存在<br>";
    $token = generateCSRFToken();
    echo "生成的令牌: {$token}<br>";
} else {
    echo "generateCSRFToken 函数: ❌ 不存在<br>";
}

// 6. 检查最近的错误日志
echo "<h2>6. 错误日志</h2>";
$errorLog = error_get_last();
if ($errorLog) {
    echo "最近错误: " . $errorLog['message'] . "<br>";
    echo "文件: " . $errorLog['file'] . "<br>";
    echo "行号: " . $errorLog['line'] . "<br>";
} else {
    echo "无最近错误<br>";
}

?>