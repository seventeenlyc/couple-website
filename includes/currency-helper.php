<?php
/**
 * 货币管理辅助函数
 * 管理用户的爱心币余额和交易记录
 */

require_once __DIR__ . '/json-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 货币数据文件路径
define('CURRENCY_FILE', __DIR__ . '/../data/user_currency.json');

/**
 * 获取用户余额
 * @param string $userId 用户ID
 * @return int 用户余额，如果用户不存在返回0
 */
function getUserBalance($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        error_log("用户不存在: {$userId}");
        return 0;
    }
    
    return (int)$data[$userId]['balance'];
}

/**
 * 增加余额
 * @param string $userId 用户ID
 * @param int $amount 金额
 * @param string $source 来源（checkin, task, refund等）
 * @param string $description 描述
 * @return bool 是否成功
 */
function addBalance($userId, $amount, $source, $description) {
    // 验证金额
    if ($amount <= 0) {
        error_log("无效金额: {$amount}");
        return false;
    }
    
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    // 检查用户是否存在
    if (!isset($data[$userId])) {
        error_log("用户不存在: {$userId}");
        return false;
    }
    
    // 更新余额
    $data[$userId]['balance'] += $amount;
    $data[$userId]['total_earned'] += $amount;
    
    // 创建交易记录
    $transaction = [
        'id' => 'tx_' . uniqid(),
        'type' => 'income',
        'amount' => $amount,
        'source' => $source,
        'description' => $description,
        'timestamp' => date('Y-m-d H:i:s'),
        'balance_after' => $data[$userId]['balance']
    ];
    
    $data[$userId]['transactions'][] = $transaction;
    
    // 保存数据
    if (!safeWriteJSON(CURRENCY_FILE, $data)) {
        error_log("保存货币数据失败");
        return false;
    }
    
    return true;
}

/**
 * 减少余额
 * @param string $userId 用户ID
 * @param int $amount 金额
 * @param string $reason 原因（purchase, penalty等）
 * @param string $description 描述
 * @return bool 是否成功
 */
function deductBalance($userId, $amount, $reason, $description) {
    // 验证金额
    if ($amount <= 0) {
        error_log("无效金额: {$amount}");
        return false;
    }
    
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    // 检查用户是否存在
    if (!isset($data[$userId])) {
        error_log("用户不存在: {$userId}");
        return false;
    }
    
    // 检查余额是否足够
    if ($data[$userId]['balance'] < $amount) {
        error_log("余额不足: 用户{$userId}余额{$data[$userId]['balance']}，需要{$amount}");
        return false;
    }
    
    // 更新余额
    $data[$userId]['balance'] -= $amount;
    $data[$userId]['total_spent'] += $amount;
    
    // 创建交易记录
    $transaction = [
        'id' => 'tx_' . uniqid(),
        'type' => 'expense',
        'amount' => $amount,
        'source' => $reason,
        'description' => $description,
        'timestamp' => date('Y-m-d H:i:s'),
        'balance_after' => $data[$userId]['balance']
    ];
    
    $data[$userId]['transactions'][] = $transaction;
    
    // 保存数据
    if (!safeWriteJSON(CURRENCY_FILE, $data)) {
        error_log("保存货币数据失败");
        return false;
    }
    
    return true;
}

/**
 * 获取交易历史
 * @param string $userId 用户ID
 * @param int $limit 限制数量，默认50
 * @return array 交易记录数组
 */
function getTransactionHistory($userId, $limit = 50) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        error_log("用户不存在: {$userId}");
        return [];
    }
    
    $transactions = $data[$userId]['transactions'];
    
    // 按时间倒序排列（最新的在前）
    $transactions = array_reverse($transactions);
    
    // 限制数量
    if ($limit > 0 && count($transactions) > $limit) {
        $transactions = array_slice($transactions, 0, $limit);
    }
    
    return $transactions;
}

/**
 * 检查余额是否足够
 * @param string $userId 用户ID
 * @param int $amount 需要的金额
 * @return bool 是否足够
 */
function hasEnoughBalance($userId, $amount) {
    $balance = getUserBalance($userId);
    return $balance >= $amount;
}

/**
 * 获取用户货币信息
 * @param string $userId 用户ID
 * @return array|null 用户货币信息，如果用户不存在返回null
 */
function getUserCurrencyInfo($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return null;
    }
    
    return $data[$userId];
}

/**
 * 初始化用户货币账户
 * @param string $userId 用户ID
 * @return bool 是否成功
 */
function initializeUserCurrency($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    // 如果用户已存在，不重复初始化
    if (isset($data[$userId])) {
        return true;
    }
    
    $data[$userId] = [
        'balance' => 0,
        'total_earned' => 0,
        'total_spent' => 0,
        'streak_days' => 0,
        'last_checkin' => null,
        'transactions' => []
    ];
    
    return safeWriteJSON(CURRENCY_FILE, $data);
}

/**
 * 验证余额一致性
 * 检查当前余额是否等于总收入减去总支出
 * @param string $userId 用户ID
 * @return array 包含valid和message的数组
 */
function validateBalanceConsistency($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return [
            'valid' => false,
            'message' => '用户不存在'
        ];
    }
    
    $user = $data[$userId];
    $expectedBalance = $user['total_earned'] - $user['total_spent'];
    
    if ($user['balance'] !== $expectedBalance) {
        return [
            'valid' => false,
            'message' => "余额不一致: 当前{$user['balance']}，预期{$expectedBalance}",
            'current' => $user['balance'],
            'expected' => $expectedBalance
        ];
    }
    
    return [
        'valid' => true,
        'message' => '余额一致'
    ];
}

/**
 * 验证交易记录完整性
 * 检查每次余额变化是否都有对应的交易记录
 * @param string $userId 用户ID
 * @return array 包含valid和message的数组
 */
function validateTransactionIntegrity($userId) {
    $data = safeReadJSON(CURRENCY_FILE, []);
    
    if (!isset($data[$userId])) {
        return [
            'valid' => false,
            'message' => '用户不存在'
        ];
    }
    
    $user = $data[$userId];
    $transactions = $user['transactions'];
    
    // 计算交易记录中的总收入和总支出
    $totalIncome = 0;
    $totalExpense = 0;
    
    foreach ($transactions as $tx) {
        if ($tx['type'] === 'income') {
            $totalIncome += $tx['amount'];
        } elseif ($tx['type'] === 'expense') {
            $totalExpense += $tx['amount'];
        }
    }
    
    // 验证总收入
    if ($totalIncome !== $user['total_earned']) {
        return [
            'valid' => false,
            'message' => "总收入不匹配: 交易记录{$totalIncome}，用户数据{$user['total_earned']}"
        ];
    }
    
    // 验证总支出
    if ($totalExpense !== $user['total_spent']) {
        return [
            'valid' => false,
            'message' => "总支出不匹配: 交易记录{$totalExpense}，用户数据{$user['total_spent']}"
        ];
    }
    
    return [
        'valid' => true,
        'message' => '交易记录完整'
    ];
}
