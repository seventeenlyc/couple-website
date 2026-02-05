<?php
/**
 * 自动同步助手
 * 检查 TXT 文件是否有更新，如果有则自动同步到 JSON
 */

if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

/**
 * 检查并自动同步数据
 * @return array 同步结果
 */
function autoSyncData() {
    $result = [
        'products_synced' => false,
        'tasks_synced' => false,
        'message' => ''
    ];
    
    // 检查商品数据
    $productsTxt = __DIR__ . '/../data/products.txt';
    $productsJson = __DIR__ . '/../data/products.json';
    
    if (file_exists($productsTxt) && file_exists($productsJson)) {
        $txtTime = filemtime($productsTxt);
        $jsonTime = filemtime($productsJson);
        
        // 如果 TXT 文件比 JSON 文件新，则同步
        if ($txtTime > $jsonTime) {
            $result['products_synced'] = syncProductsFromTxt();
        }
    }
    
    // 检查任务数据
    $tasksTxt = __DIR__ . '/../data/tasks.txt';
    $tasksJson = __DIR__ . '/../data/tasks.json';
    
    if (file_exists($tasksTxt) && file_exists($tasksJson)) {
        $txtTime = filemtime($tasksTxt);
        $jsonTime = filemtime($tasksJson);
        
        // 如果 TXT 文件比 JSON 文件新，则同步
        if ($txtTime > $jsonTime) {
            $result['tasks_synced'] = syncTasksFromTxt();
        }
    }
    
    // 生成消息
    if ($result['products_synced'] && $result['tasks_synced']) {
        $result['message'] = '商品和任务数据已自动同步';
    } elseif ($result['products_synced']) {
        $result['message'] = '商品数据已自动同步';
    } elseif ($result['tasks_synced']) {
        $result['message'] = '任务数据已自动同步';
    }
    
    return $result;
}

/**
 * 从 TXT 同步商品数据
 */
function syncProductsFromTxt() {
    $txtFile = __DIR__ . '/../data/products.txt';
    $jsonFile = __DIR__ . '/../data/products.json';
    
    if (!file_exists($txtFile)) {
        return false;
    }
    
    // 读取现有 JSON 数据（保留销售数据和评价）
    $existingData = [];
    if (file_exists($jsonFile)) {
        $json = file_get_contents($jsonFile);
        $data = json_decode($json, true);
        if ($data && isset($data['products'])) {
            foreach ($data['products'] as $product) {
                $existingData[$product['name']] = [
                    'sales' => $product['sales'] ?? 0,
                    'rating' => $product['rating'] ?? 0,
                    'review_count' => $product['review_count'] ?? 0
                ];
            }
        }
    }
    
    // 读取 TXT 文件
    $lines = file($txtFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $products = [];
    
    foreach ($lines as $line) {
        $line = trim($line);
        
        // 跳过注释和空行
        if (empty($line) || $line[0] === '#') {
            continue;
        }
        
        // 解析行
        $parts = array_map('trim', explode('|', $line));
        
        if (count($parts) < 6) {
            continue;
        }
        
        list($name, $price, $image, $description, $category, $stock) = $parts;
        
        // 生成 ID
        $id = 'prod_' . str_pad(count($products) + 1, 3, '0', STR_PAD_LEFT);
        
        // 保留现有的销售数据
        $existingInfo = $existingData[$name] ?? [
            'sales' => 0,
            'rating' => 0,
            'review_count' => 0
        ];
        
        $products[] = [
            'id' => $id,
            'name' => $name,
            'description' => $description,
            'price' => (int)$price,
            'category' => $category,
            'image' => $image,
            'stock' => (int)$stock,
            'sales' => $existingInfo['sales'],
            'rating' => $existingInfo['rating'],
            'review_count' => $existingInfo['review_count'],
            'created_at' => date('Y-m-d H:i:s')
        ];
    }
    
    // 保存到 JSON
    $jsonData = ['products' => $products];
    $json = json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents($jsonFile, $json);
    
    return true;
}

/**
 * 从 TXT 同步任务数据
 */
function syncTasksFromTxt() {
    $txtFile = __DIR__ . '/../data/tasks.txt';
    $jsonFile = __DIR__ . '/../data/tasks.json';
    
    if (!file_exists($txtFile)) {
        return false;
    }
    
    // 读取现有 JSON 数据（保留每日任务）
    $dailyTasks = [];
    if (file_exists($jsonFile)) {
        $json = file_get_contents($jsonFile);
        $data = json_decode($json, true);
        if ($data && isset($data['daily_tasks'])) {
            $dailyTasks = $data['daily_tasks'];
        }
    }
    
    // 读取 TXT 文件
    $lines = file($txtFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $taskPool = [];
    
    foreach ($lines as $line) {
        $line = trim($line);
        
        // 跳过注释和空行
        if (empty($line) || $line[0] === '#') {
            continue;
        }
        
        // 解析行
        $parts = array_map('trim', explode('|', $line));
        
        if (count($parts) < 5) {
            continue;
        }
        
        list($title, $description, $rewardMin, $rewardMax, $category) = $parts;
        
        // 生成 ID
        $id = 'task_' . str_pad(count($taskPool) + 1, 3, '0', STR_PAD_LEFT);
        
        $taskPool[] = [
            'id' => $id,
            'title' => $title,
            'description' => $description,
            'reward_min' => (int)$rewardMin,
            'reward_max' => (int)$rewardMax,
            'category' => $category
        ];
    }
    
    // 保存到 JSON
    $jsonData = [
        'task_pool' => $taskPool,
        'daily_tasks' => $dailyTasks
    ];
    
    $json = json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents($jsonFile, $json);
    
    return true;
}
