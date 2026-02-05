<?php
/**
 * 配置文件加载器
 * 读取并解析 data/config.json 配置文件
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 配置文件路径
define('CONFIG_FILE', __DIR__ . '/../data/config.json');

/**
 * 加载配置文件
 * @return array 配置数组
 * @throws Exception 如果配置文件不存在或无法解析
 */
function loadConfig() {
    if (!file_exists(CONFIG_FILE)) {
        throw new Exception('配置文件不存在: ' . CONFIG_FILE);
    }
    
    $configContent = file_get_contents(CONFIG_FILE);
    if ($configContent === false) {
        throw new Exception('无法读取配置文件');
    }
    
    $config = json_decode($configContent, true);
    if ($config === null && json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('配置文件JSON解析错误: ' . json_last_error_msg());
    }
    
    return $config;
}

/**
 * 获取配置项
 * @param string $key 配置键名（支持点号分隔的嵌套键，如 'theme.primaryColor'）
 * @param mixed $default 默认值
 * @return mixed 配置值
 */
function getConfig($key = null, $default = null) {
    static $config = null;
    
    // 首次调用时加载配置
    if ($config === null) {
        try {
            $config = loadConfig();
        } catch (Exception $e) {
            error_log('配置加载失败: ' . $e->getMessage());
            return $default;
        }
    }
    
    // 如果没有指定键，返回整个配置
    if ($key === null) {
        return $config;
    }
    
    // 支持点号分隔的嵌套键
    $keys = explode('.', $key);
    $value = $config;
    
    foreach ($keys as $k) {
        if (!is_array($value) || !isset($value[$k])) {
            return $default;
        }
        $value = $value[$k];
    }
    
    return $value;
}

/**
 * 获取用户配置
 * @param string $userName 用户名（name1或name2）
 * @return array|null 用户配置数组
 */
function getUserConfig($userName) {
    $users = getConfig('users', []);
    return isset($users[$userName]) ? $users[$userName] : null;
}

/**
 * 获取恋爱开始日期
 * @return string 日期字符串 (YYYY-MM-DD)
 */
function getStartDate() {
    return getConfig('startDate', '2025-02-05');
}

/**
 * 获取主题配置
 * @return array 主题配置数组
 */
function getThemeConfig() {
    return getConfig('theme', [
        'primaryColor' => '#0e90d2',
        'secondaryColor' => '#f56c6c',
        'successColor' => '#52c41a',
        'backgroundColor' => '#ffc0cb'
    ]);
}

/**
 * 计算恋爱时长
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @param string|null $endDate 结束日期 (YYYY-MM-DD)，默认为当前日期
 * @return array 包含天数、小时数、分钟数等的数组
 */
function calculateLoveDuration($startDate, $endDate = null) {
    $start = new DateTime($startDate);
    $end = $endDate ? new DateTime($endDate) : new DateTime();
    
    $interval = $start->diff($end);
    
    // 计算总天数
    $days = $interval->days;
    
    // 计算总小时数、分钟数、秒数（基于总天数）
    $hours = $days * 24;
    $minutes = $days * 24 * 60;
    $seconds = $days * 24 * 60 * 60;
    
    // 计算年月日
    $years = $interval->y;
    $months = $interval->m;
    $remainingDays = $interval->d;
    
    return [
        'days' => $days,
        'hours' => $hours,
        'minutes' => $minutes,
        'seconds' => $seconds,
        'years' => $years,
        'months' => $months,
        'remainingDays' => $remainingDays
    ];
}

/**
 * 格式化时长显示
 * @param array $duration calculateLoveDuration 返回的数组
 * @return string 格式化的时长字符串
 */
function formatLoveDuration($duration) {
    $parts = [];
    
    if ($duration['years'] > 0) {
        $parts[] = $duration['years'] . ' 年';
    }
    if ($duration['months'] > 0) {
        $parts[] = $duration['months'] . ' 个月';
    }
    // 如果有年份或月份，或者天数大于0，或者什么都没有，都显示天数
    if ($duration['years'] > 0 || $duration['months'] > 0 || $duration['remainingDays'] > 0 || empty($parts)) {
        $parts[] = $duration['remainingDays'] . ' 天';
    }
    
    return implode(' ', $parts);
}
