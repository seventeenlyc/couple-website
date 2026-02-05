<?php
/**
 * 纪念日计算助手
 * 负责计算和识别各种纪念日
 */

require_once __DIR__ . '/config.php';

/**
 * 获取即将到来的纪念日列表
 * 
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @param int $daysAhead 提前多少天提醒 (默认7天)
 * @return array 纪念日数组
 */
function getUpcomingAnniversaries(string $startDate, int $daysAhead = 7): array {
    $anniversaries = [];
    
    // 获取所有类型的纪念日
    $monthly = getMonthlyAnniversaries($startDate);
    $yearly = getYearlyAnniversaries($startDate);
    $special = getSpecialDayAnniversaries($startDate);
    
    // 合并所有纪念日
    $allAnniversaries = array_merge($monthly, $yearly, $special);
    
    // 筛选出在时间窗口内的纪念日
    $today = new DateTime('today'); // 使用 'today' 确保时间是 00:00:00
    $futureDate = (clone $today)->modify("+{$daysAhead} days");
    
    foreach ($allAnniversaries as $anniversary) {
        $anniversaryDate = new DateTime($anniversary['date']);
        
        // 检查是否在提醒窗口内
        if ($anniversaryDate >= $today && $anniversaryDate <= $futureDate) {
            $anniversaries[] = $anniversary;
        }
    }
    
    // 按日期排序
    usort($anniversaries, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });
    
    return $anniversaries;
}

/**
 * 计算月度纪念日
 * 
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @return array 月度纪念日数组
 */
function getMonthlyAnniversaries(string $startDate): array {
    $anniversaries = [];
    $start = new DateTime($startDate);
    $today = new DateTime('today'); // 使用 'today' 确保时间是 00:00:00
    
    // 计算已经过了多少个月
    $interval = $start->diff($today);
    $monthsPassed = ($interval->y * 12) + $interval->m;
    
    // 计算下一个月度纪念日
    $nextMonthly = clone $start;
    $nextMonthly->modify("+{$monthsPassed} months");
    
    // 如果下一个月度纪念日已经过去，计算再下一个
    if ($nextMonthly < $today) {
        $monthsPassed++;
        $nextMonthly = clone $start;
        $nextMonthly->modify("+{$monthsPassed} months");
    }
    
    // 只返回下一个月度纪念日
    if ($monthsPassed > 0) {
        $daysUntil = (int)$today->diff($nextMonthly)->format('%a');
        $anniversaries[] = [
            'type' => 'monthly',
            'name' => "恋爱{$monthsPassed}个月纪念日",
            'date' => $nextMonthly->format('Y-m-d'),
            'days_until' => $daysUntil,
            'months_count' => $monthsPassed,
            'icon' => '💑'
        ];
    }
    
    return $anniversaries;
}

/**
 * 计算年度纪念日
 * 
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @return array 年度纪念日数组
 */
function getYearlyAnniversaries(string $startDate): array {
    $anniversaries = [];
    $start = new DateTime($startDate);
    $today = new DateTime('today'); // 使用 'today' 确保时间是 00:00:00
    
    // 计算已经过了多少年
    $interval = $start->diff($today);
    $yearsPassed = $interval->y;
    
    // 计算下一个年度纪念日
    $nextYearly = clone $start;
    $nextYearly->modify("+{$yearsPassed} years");
    
    // 如果下一个年度纪念日已经过去，计算再下一个
    if ($nextYearly < $today) {
        $yearsPassed++;
        $nextYearly = clone $start;
        $nextYearly->modify("+{$yearsPassed} years");
    }
    
    // 只返回下一个年度纪念日
    if ($yearsPassed > 0) {
        $daysUntil = (int)$today->diff($nextYearly)->format('%a');
        $anniversaries[] = [
            'type' => 'yearly',
            'name' => "恋爱{$yearsPassed}周年纪念日",
            'date' => $nextYearly->format('Y-m-d'),
            'days_until' => $daysUntil,
            'years_count' => $yearsPassed,
            'icon' => '🎉'
        ];
    }
    
    return $anniversaries;
}

/**
 * 计算特殊天数纪念日
 * 
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @return array 特殊天数纪念日数组
 */
function getSpecialDayAnniversaries(string $startDate): array {
    $anniversaries = [];
    $start = new DateTime($startDate);
    $today = new DateTime('today'); // 使用 'today' 确保时间是 00:00:00
    
    // 定义特殊天数
    $specialDays = [
        100 => '百日纪念',
        200 => '200天纪念',
        365 => '365天纪念',
        500 => '500天纪念',
        1000 => '千日纪念',
        1314 => '1314天纪念',
        2000 => '2000天纪念',
        3650 => '十年纪念'
    ];
    
    // 计算已经过了多少天
    $daysPassed = (int)$start->diff($today)->format('%a');
    
    // 检查每个特殊天数
    foreach ($specialDays as $days => $name) {
        // 计算特殊日期
        $specialDate = clone $start;
        $specialDate->modify("+{$days} days");
        
        // 只返回还未到来的特殊日期
        if ($specialDate >= $today) {
            $daysUntil = (int)$today->diff($specialDate)->format('%a');
            $anniversaries[] = [
                'type' => 'special',
                'name' => $name,
                'date' => $specialDate->format('Y-m-d'),
                'days_until' => $daysUntil,
                'special_days' => $days,
                'icon' => '✨'
            ];
        }
    }
    
    return $anniversaries;
}

/**
 * 格式化纪念日信息用于显示
 * 
 * @param array $anniversary 纪念日数组
 * @return string 格式化的字符串
 */
function formatAnniversary(array $anniversary): string {
    $daysText = $anniversary['days_until'] === 0 ? '今天' : "还有{$anniversary['days_until']}天";
    return "{$anniversary['icon']} {$anniversary['name']} ({$daysText})";
}

/**
 * 检查今天是否是纪念日
 * 
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @return array|null 如果是纪念日返回纪念日信息，否则返回null
 */
function getTodayAnniversary(string $startDate): ?array {
    $allAnniversaries = array_merge(
        getMonthlyAnniversaries($startDate),
        getYearlyAnniversaries($startDate),
        getSpecialDayAnniversaries($startDate)
    );
    
    $today = (new DateTime())->format('Y-m-d');
    
    foreach ($allAnniversaries as $anniversary) {
        if ($anniversary['date'] === $today) {
            return $anniversary;
        }
    }
    
    return null;
}

/**
 * 获取生日提醒
 * @return array 生日提醒数组
 */
function getBirthdayReminders() {
    $configFile = __DIR__ . '/../data/config.json';
    $config = safeReadJSON($configFile, []);
    
    if (!isset($config['users'])) {
        return [];
    }
    
    $birthdays = [];
    $today = new DateTime('today'); // 使用 'today' 确保时间是 00:00:00
    $currentYear = (int)$today->format('Y');
    
    foreach ($config['users'] as $userName => $userInfo) {
        if (!isset($userInfo['birthday'])) {
            continue;
        }
        
        // 生日格式：MM-DD
        $birthdayStr = $userInfo['birthday'];
        $birthdayThisYear = new DateTime("{$currentYear}-{$birthdayStr}");
        
        // 如果今年的生日已经过了（不包括今天），计算明年的
        if ($birthdayThisYear < $today) {
            $birthdayThisYear = new DateTime(($currentYear + 1) . "-{$birthdayStr}");
        }
        
        $daysUntil = (int)$today->diff($birthdayThisYear)->format('%a');
        
        $birthdays[] = [
            'type' => 'birthday',
            'name' => "{$userName}的生日",
            'user_name' => $userName,
            'date' => $birthdayThisYear->format('Y-m-d'),
            'days_until' => $daysUntil,
            'is_today' => $daysUntil === 0,
            'icon' => '🎂'
        ];
    }
    
    // 按日期排序
    usort($birthdays, function($a, $b) {
        return $a['days_until'] - $b['days_until'];
    });
    
    return $birthdays;
}

/**
 * 获取所有特殊日期（包括纪念日和生日）
 * @param string $startDate 恋爱开始日期
 * @param int $daysAhead 提前多少天提醒
 * @return array 特殊日期数组
 */
function getAllSpecialDates(string $startDate, int $daysAhead = 30): array {
    $anniversaries = getUpcomingAnniversaries($startDate, $daysAhead);
    $birthdays = getBirthdayReminders();
    
    // 筛选生日，只保留在提醒窗口内的
    $birthdays = array_filter($birthdays, function($birthday) use ($daysAhead) {
        return $birthday['days_until'] <= $daysAhead;
    });
    
    // 合并并排序
    $allDates = array_merge($anniversaries, $birthdays);
    usort($allDates, function($a, $b) {
        return $a['days_until'] - $b['days_until'];
    });
    
    return $allDates;
}
