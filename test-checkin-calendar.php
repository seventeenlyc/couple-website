<?php
/**
 * 测试签到日历功能
 */

require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/checkin-helper.php';

// 检查用户是否登录
if (!isset($_SESSION['user_id'])) {
    die('请先登录');
}

$userId = $_SESSION['user_id'];

echo "<h1>测试签到日历功能</h1>";

// 测试 getCheckinHistory 函数
echo "<h2>1. 测试 getCheckinHistory 函数</h2>";
if (function_exists('getCheckinHistory')) {
    echo "✅ getCheckinHistory 函数存在<br>";
    $history = getCheckinHistory($userId);
    echo "签到历史记录：<pre>" . print_r($history, true) . "</pre>";
} else {
    echo "❌ getCheckinHistory 函数不存在<br>";
}

// 测试 getCheckinCalendar 函数
echo "<h2>2. 测试 getCheckinCalendar 函数</h2>";
if (function_exists('getCheckinCalendar')) {
    echo "✅ getCheckinCalendar 函数存在<br>";
    try {
        $calendar = getCheckinCalendar($userId);
        echo "日历数据：<pre>" . print_r($calendar, true) . "</pre>";
    } catch (Exception $e) {
        echo "❌ 调用出错：" . $e->getMessage() . "<br>";
    }
} else {
    echo "❌ getCheckinCalendar 函数不存在<br>";
}

// 显示所有已定义的函数
echo "<h2>3. checkin-helper.php 中定义的所有函数</h2>";
$allFunctions = get_defined_functions()['user'];
$checkinFunctions = array_filter($allFunctions, function($func) {
    return strpos($func, 'checkin') !== false || strpos($func, 'streak') !== false;
});
echo "<pre>" . print_r($checkinFunctions, true) . "</pre>";
?>
