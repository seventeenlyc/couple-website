<?php
/**
 * 管理员补签工具（CLI / Web 通用）
 *
 * 用法：
 *   CLI:  php admin-backfill-checkin.php 2026-06-08
 *         php admin-backfill-checkin.php 2026-06-08 id1
 *   Web:  admin-backfill-checkin.php?date=2026-06-08
 *         admin-backfill-checkin.php?date=2026-06-08&user=id1
 *
 * 对指定日期注入一条签到记录，并重新计算连续签到天数。
 */

// ── 解析参数 ──────────────────────────────────────────────
$isCli = (php_sapi_name() === 'cli');

if ($isCli) {
    $backfillDate = $argv[1] ?? null;
    $targetUser   = $argv[2] ?? null;   // 可选 id1 / id2
} else {
    $backfillDate = $_GET['date']  ?? null;
    $targetUser   = $_GET['user'] ?? null;
}

if (!$backfillDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $backfillDate)) {
    die("用法: php admin-backfill-checkin.php YYYY-MM-DD [user]\n");
}

// ── 路径 ──────────────────────────────────────────────────
$jsonHelper   = __DIR__ . '/includes/json-helper.php';
$currencyFile = __DIR__ . '/data/user_currency.json';

if (!file_exists($currencyFile)) {
    die("❌ 找不到 data/user_currency.json — 请先初始化项目\n");
}

require_once $jsonHelper;

// ── 安全读写 ──────────────────────────────────────────────
function safeRead($path) {
    $raw = file_get_contents($path);
    return json_decode($raw, true) ?: [];
}
function safeWrite($path, $data) {
    return file_put_contents($path,
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    ) !== false;
}

// ── 确定要补签的用户 ──────────────────────────────────────
$data    = safeRead($currencyFile);
$allUserIds = array_keys($data);
$userIds = $targetUser ? [$targetUser] : $allUserIds;

// ── 对每个用户执行补签 ────────────────────────────────────
$report = [];

foreach ($userIds as $userId) {
    if (!isset($data[$userId])) {
        $report[$userId] = "⏭ 跳过（用户不存在）";
        continue;
    }

    // 检查该日期是否已有签到交易
    $already = false;
    foreach (($data[$userId]['transactions'] ?? []) as $tx) {
        if (($tx['source'] ?? '') === 'checkin' && strpos($tx['timestamp'] ?? '', $backfillDate) === 0) {
            $already = true;
            break;
        }
    }
    if ($already) {
        $report[$userId] = "⏭ 跳过（{$backfillDate} 已有签到记录）";
        continue;
    }

    // 注入补签交易
    $fakeTimestamp = $backfillDate . ' 12:00:00';
    $transaction = [
        'id'            => 'tx_backfill_' . uniqid(),
        'type'          => 'income',
        'amount'        => 0,            // 补签不给奖励，只恢复连续
        'source'        => 'checkin',
        'description'   => '管理员补签 ' . $backfillDate,
        'timestamp'     => $fakeTimestamp,
        'balance_after' => $data[$userId]['balance'] ?? 0,
        '_backfill'     => true,         // 标记为补签，方便以后识别
    ];
    $data[$userId]['transactions'][] = $transaction;

    // ── 重新计算连续签到天数 ─────────────────────────────
    $checkinDates = [];
    foreach ($data[$userId]['transactions'] as $tx) {
        if (($tx['source'] ?? '') === 'checkin') {
            $checkinDates[] = substr($tx['timestamp'], 0, 10);
        }
    }
    $checkinDates = array_unique($checkinDates);
    sort($checkinDates);

    // 从最新日期往前数连续天数
    $streak = 0;
    $lastCheckin = null;
    if (!empty($checkinDates)) {
        $lastCheckin = end($checkinDates);
        $cursor = new DateTime($lastCheckin);
        $dates  = array_flip($checkinDates);

        while (isset($dates[$cursor->format('Y-m-d')])) {
            $streak++;
            $cursor->modify('-1 day');
        }
    }

    $data[$userId]['streak_days']  = $streak;
    $data[$userId]['last_checkin'] = $lastCheckin;

    $report[$userId] = "✅ 补签成功 — {$backfillDate}，当前连续 " . $streak . " 天，最后签到: " . ($lastCheckin ?? '无');
}

// ── 保存 ──────────────────────────────────────────────────
if (!safeWrite($currencyFile, $data)) {
    die("❌ 写入失败，请检查 data/user_currency.json 权限\n");
}

// ── 输出结果 ──────────────────────────────────────────────
$sep = $isCli ? "\n" : "<br>\n";
echo "补签结果 ($backfillDate):$sep";
foreach ($report as $uid => $msg) {
    echo "  $uid  →  $msg$sep";
}
echo "{$sep}完成。$sep";
