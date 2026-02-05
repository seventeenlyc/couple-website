<?php
/**
 * 手动触发数据同步
 */
require_once 'includes/auto-sync-helper.php';

echo "开始同步...\n";

// 同步商品
if (syncProductsFromTxt()) {
    echo "✓ 商品数据同步成功\n";
} else {
    echo "✗ 商品数据同步失败\n";
}

// 同步任务
if (syncTasksFromTxt()) {
    echo "✓ 任务数据同步成功\n";
} else {
    echo "✗ 任务数据同步失败\n";
}

echo "\n同步完成！\n";
