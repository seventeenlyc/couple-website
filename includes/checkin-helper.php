<?php
/**
 * 签到系统辅助函数
 * 处理每日签到和连续签到奖励
 */

require_once __DIR__ . '/json-helper.php';
require_once __DIR__ . '/currency-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 货币数据文件路径
if (!defined('CURRENCY_FILE')) {
    define('CURRENCY_FILE', __DIR__ . '/../data/user_currency.json');
}

// 基础签到奖励
define('BASE_CHECKIN_REWARD', 10);

// 连续签到额外奖励（每天递增）
define('STREAK_BONUS_PER_DAY', 2);

// 最大连续签到奖励
define('MAX_STREAK_BONUS', 20);

/**
 * 执行签到
 * @param string $userId 用户ID
 * @return array 签到结果，包含success, message, reward, streak_days
 */
function checkIn($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    // 检查用户是否存在
    if (!isset($data[$userId])) {
        return [
            'success' => false,
            'message' => '用户不存在',
            'reward' => 0,
            'streak_days' => 0
        ];
    }
    
    // 检查今日是否已签到
    if (hasCheckedInToday($userId)) {
        return [
            'success' => false,
            'message' => '今日已签到，明天再来吧',
            'reward' => 0,
            'streak_days' => $data[$userId]['streak_days']
        ];
    }
    
    $today = date('Y-m-d');
    $lastCheckin = $data[$userId]['last_checkin'];
    
    // 计算连续签到天数
    if ($lastCheckin === null) {
        // 首次签到
        $data[$userId]['streak_days'] = 1;
    } else {
        $lastDate = new DateTime($lastCheckin);
        $todayDate = new DateTime($today);
        $diff = $lastDate->diff($todayDate)->days;
        
        if ($diff === 1) {
            // 连续签到
            $data[$userId]['streak_days']++;
        } else {
            // 中断，重置为1
            $data[$userId]['streak_days'] = 1;
        }
    }
    
    // 更新最后签到日期
    $data[$userId]['last_checkin'] = $today;
    
    // 计算奖励
    $streakDays = $data[$userId]['streak_days'];
    $streakBonus = min(($streakDays - 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
    $totalReward = BASE_CHECKIN_REWARD + $streakBonus;
    
    // 保存数据
    if (!safeWriteJSON(CURRENCY_FILE, $data)) {
        return [
            'success' => false,
            'message' => '签到失败，请稍后重试',
            'reward' => 0,
            'streak_days' => $streakDays
        ];
    }
    
    // 发放奖励
    $description = "每日签到";
    if ($streakBonus > 0) {
        $description .= "（连续{$streakDays}天，额外+{$streakBonus}💕）";
    }
    
    if (!addBalance($userId, $totalReward, 'checkin', $description)) {
        return [
            'success' => false,
            'message' => '签到成功但奖励发放失败',
            'reward' => 0,
            'streak_days' => $streakDays
        ];
    }
    
    // 获取更新后的余额
    $newBalance = getUserBalance($userId);
    
    return [
        'success' => true,
        'message' => '签到成功！',
        'reward' => $totalReward,
        'streak_days' => $streakDays,
        'new_balance' => $newBalance,
        'base_reward' => BASE_CHECKIN_REWARD,
        'streak_bonus' => $streakBonus
    ];
}

/**
 * 检查今日是否已签到
 * @param string $userId 用户ID
 * @return bool 是否已签到
 */
function hasCheckedInToday($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return false;
    }
    
    $lastCheckin = $data[$userId]['last_checkin'];
    
    if ($lastCheckin === null) {
        return false;
    }
    
    $today = date('Y-m-d');
    return $lastCheckin === $today;
}

/**
 * 获取连续签到天数
 * @param string $userId 用户ID
 * @return int 连续签到天数
 */
function getStreakDays($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return 0;
    }
    
    return (int)$data[$userId]['streak_days'];
}

/**
 * 重置连续签到
 * @param string $userId 用户ID
 * @return void
 */
function resetStreak($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return;
    }
    
    $data[$userId]['streak_days'] = 0;
    safeWriteJSON(CURRENCY_FILE, $data);
}

/**
 * 获取签到信息
 * @param string $userId 用户ID
 * @return array 签到信息
 */
function getCheckinInfo($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return [
            'has_checked_in_today' => false,
            'streak_days' => 0,
            'last_checkin' => null,
            'next_reward' => BASE_CHECKIN_REWARD
        ];
    }
    
    $hasCheckedIn = hasCheckedInToday($userId);
    $streakDays = $data[$userId]['streak_days'];
    $lastCheckin = $data[$userId]['last_checkin'];
    
    // 计算下次签到奖励
    $nextStreakDays = $hasCheckedIn ? $streakDays + 1 : $streakDays;
    $nextStreakBonus = min(($nextStreakDays - 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
    $nextReward = BASE_CHECKIN_REWARD + $nextStreakBonus;
    
    return [
        'has_checked_in_today' => $hasCheckedIn,
        'streak_days' => $streakDays,
        'last_checkin' => $lastCheckin,
        'next_reward' => $nextReward,
        'base_reward' => BASE_CHECKIN_REWARD,
        'next_streak_bonus' => $nextStreakBonus
    ];
}

/**
 * 计算签到奖励
 * @param int $streakDays 连续签到天数
 * @return int 奖励金额
 */
function calculateCheckinReward($streakDays) {
    $streakBonus = min(($streakDays - 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
    return BASE_CHECKIN_REWARD + $streakBonus;
}

/**
 * 获取用户的签到历史记录
 * @param string $userId 用户ID
 * @param int $year 年份（可选，默认当前年）
 * @param int $month 月份（可选，默认当前月）
 * @return array 签到日期数组
 */
function getCheckinHistory($userId, $year = null, $month = null) {
    // 从交易历史中获取签到记录
    $transactionFile = __DIR__ . '/../data/user_currency.json';
    $data = safeReadJSON($transactionFile, []);
    
    if (!isset($data[$userId]) || !isset($data[$userId]['transactions'])) {
        return [];
    }
    
    $checkinDates = [];
    $transactions = $data[$userId]['transactions'];
    
    // 如果没有指定年月，使用当前年月
    if ($year === null) {
        $year = (int)date('Y');
    }
    if ($month === null) {
        $month = (int)date('m');
    }
    
    // 筛选签到记录
    foreach ($transactions as $transaction) {
        if ($transaction['source'] === 'checkin' && $transaction['type'] === 'income') {
            // 交易记录中的日期字段是 timestamp
            if (!isset($transaction['timestamp'])) {
                continue;
            }
            
            $date = new DateTime($transaction['timestamp']);
            $transYear = (int)$date->format('Y');
            $transMonth = (int)$date->format('m');
            
            // 如果指定了年月，只返回该月的记录
            if ($transYear === $year && $transMonth === $month) {
                $checkinDates[] = $date->format('Y-m-d');
            }
        }
    }
    
    return array_unique($checkinDates);
}

/**
 * 获取签到日历数据
 * @param string $userId 用户ID
 * @param int $year 年份
 * @param int $month 月份
 * @return array 日历数据
 */
function getCheckinCalendar($userId, $year = null, $month = null) {
    if ($year === null) {
        $year = (int)date('Y');
    }
    if ($month === null) {
        $month = (int)date('m');
    }
    
    // 获取该月的签到记录
    $checkinDates = getCheckinHistory($userId, $year, $month);
    
    // 获取该月的第一天和最后一天
    $firstDay = new DateTime("{$year}-{$month}-01");
    $lastDay = new DateTime($firstDay->format('Y-m-t'));
    
    // 获取该月第一天是星期几（0=周日，1=周一...）
    $firstDayOfWeek = (int)$firstDay->format('w');
    
    // 获取该月有多少天
    $daysInMonth = (int)$lastDay->format('d');
    
    // 构建日历数据
    $calendar = [];
    $currentDate = clone $firstDay;
    
    for ($day = 1; $day <= $daysInMonth; $day++) {
        $dateStr = $currentDate->format('Y-m-d');
        $isCheckedIn = in_array($dateStr, $checkinDates);
        $isToday = $dateStr === date('Y-m-d');
        
        $calendar[] = [
            'day' => $day,
            'date' => $dateStr,
            'is_checked_in' => $isCheckedIn,
            'is_today' => $isToday,
            'day_of_week' => (int)$currentDate->format('w')
        ];
        
        $currentDate->modify('+1 day');
    }
    
    return [
        'year' => $year,
        'month' => $month,
        'first_day_of_week' => $firstDayOfWeek,
        'days_in_month' => $daysInMonth,
        'days' => $calendar,
        'checkin_count' => count($checkinDates)
    ];
}

/**
 * 验证连续签到逻辑
 * 检查连续签到天数的计算是否正确
 * @param string $userId 用户ID
 * @param array $checkinDates 签到日期数组（格式：Y-m-d）
 * @return array 包含valid和message的数组
 */
function validateStreakLogic($userId, $checkinDates) {
    if (empty($checkinDates)) {
        return [
            'valid' => true,
            'message' => '无签到记录'
        ];
    }
    
    // 按日期排序
    sort($checkinDates);
    
    $expectedStreak = 0;
    $lastDate = null;
    
    foreach ($checkinDates as $dateStr) {
        $currentDate = new DateTime($dateStr);
        
        if ($lastDate === null) {
            // 第一次签到
            $expectedStreak = 1;
        } else {
            $diff = $lastDate->diff($currentDate)->days;
            
            if ($diff === 1) {
                // 连续签到
                $expectedStreak++;
            } else if ($diff > 1) {
                // 中断，重置
                $expectedStreak = 1;
            } else {
                // 同一天多次签到（不应该发生）
                return [
                    'valid' => false,
                    'message' => "同一天多次签到: {$dateStr}"
                ];
            }
        }
        
        $lastDate = $currentDate;
    }
    
    // 获取实际的连续签到天数
    $actualStreak = getStreakDays($userId);
    
    if ($actualStreak !== $expectedStreak) {
        return [
            'valid' => false,
            'message' => "连续签到天数不正确: 预期{$expectedStreak}，实际{$actualStreak}"
        ];
    }
    
    return [
        'valid' => true,
        'message' => '连续签到逻辑正确'
    ];
}
