<?php
/**
 * 纪念日提醒API
 * 返回即将到来的纪念日列表（包括生日）
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../includes/anniversary-helper.php';
require_once __DIR__ . '/../includes/ai-helper.php';
require_once __DIR__ . '/../includes/config.php';

try {
    // 获取开始日期
    $startDate = getStartDate();
    
    // 获取所有特殊日期（纪念日+生日）
    $allDates = getAllSpecialDates($startDate, 7);
    
    // 为纪念日生成祝福语
    $reminders = [];
    foreach ($allDates as $date) {
        $reminder = [
            'type' => $date['type'],
            'name' => $date['name'],
            'date' => $date['date'],
            'days_until' => $date['days_until'],
            'icon' => $date['icon'],
            'message' => ''
        ];
        
        // 如果是今天，添加特殊标记
        if ($date['days_until'] === 0) {
            $reminder['is_today'] = true;
        }
        
        $reminders[] = $reminder;
    }
    
    // 返回成功响应
    echo json_encode([
        'success' => true,
        'reminders' => $reminders,
        'count' => count($reminders)
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    // 返回错误响应
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => '获取纪念日提醒失败',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
