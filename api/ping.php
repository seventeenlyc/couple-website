<?php
// 最简单的测试API
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true, 'message' => 'API工作正常', 'time' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE);
?>