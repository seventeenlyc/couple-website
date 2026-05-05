<?php
/**
 * 用户余额API
 * Returns current user balance, streak, and check-in status.
 */
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/currency-helper.php';
require_once __DIR__ . '/../includes/checkin-helper.php';

initSession();
header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '请先登录'], JSON_UNESCAPED_UNICODE);
    exit;
}

$userId = getCurrentUserId();
$balance = getUserBalance($userId);
$info = getUserCurrencyInfo($userId);
$checkedInToday = hasCheckedInToday($userId);

echo json_encode([
    'success' => true,
    'balance' => $balance,
    'streak_days' => $info['streak_days'] ?? 0,
    'total_earned' => $info['total_earned'] ?? 0,
    'total_spent' => $info['total_spent'] ?? 0,
    'checked_in_today' => $checkedInToday,
    'last_checkin' => $info['last_checkin'] ?? null
], JSON_UNESCAPED_UNICODE);
