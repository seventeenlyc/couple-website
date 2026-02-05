<?php
/**
 * 标记弹窗已显示
 */
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$popupId = $input['popup_id'] ?? '';

if (empty($popupId)) {
    echo json_encode(['success' => false]);
    exit;
}

$popupFile = __DIR__ . '/../data/popup_shown.json';
$popupData = file_exists($popupFile) ? json_decode(file_get_contents($popupFile), true) : [];
$popupData[$popupId] = date('Y-m-d H:i:s');
file_put_contents($popupFile, json_encode($popupData, JSON_PRETTY_PRINT));

echo json_encode(['success' => true]);
