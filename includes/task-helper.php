<?php
/**
 * 任务系统辅助函数
 * 生成每日任务、处理任务完成确认
 */

require_once __DIR__ . '/json-helper.php';
require_once __DIR__ . '/currency-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 任务数据文件路径
define('TASKS_FILE', __DIR__ . '/../data/tasks.json');

/**
 * 生成每日任务
 * @return array 生成的任务列表
 */
function generateDailyTasks() {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $taskPool = $data['task_pool'];
    
    if (count($taskPool) < 2) {
        error_log("任务池中任务不足");
        return [];
    }
    
    $today = date('Y-m-d');
    
    // 检查今日任务是否已生成
    if (isset($data['daily_tasks'][$today])) {
        return $data['daily_tasks'][$today];
    }
    
    // 随机选择2个任务
    $selectedTasks = [];
    $poolCopy = $taskPool;
    shuffle($poolCopy);
    
    for ($i = 0; $i < 2 && $i < count($poolCopy); $i++) {
        $task = $poolCopy[$i];
        
        // 生成随机奖励
        $reward = rand($task['reward_min'], $task['reward_max']);
        
        $dailyTask = [
            'id' => 'daily_' . uniqid(),
            'task_id' => $task['id'],
            'title' => $task['title'],
            'description' => $task['description'],
            'reward' => $reward,
            'status' => 'pending',
            'completed_by' => [],
            'confirmed_by' => [],
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        $selectedTasks[] = $dailyTask;
    }
    
    // 保存今日任务
    $data['daily_tasks'][$today] = $selectedTasks;
    
    if (!safeWriteJSON(TASKS_FILE, $data)) {
        error_log("保存每日任务失败");
        return [];
    }
    
    return $selectedTasks;
}

/**
 * 获取今日任务
 * @return array 今日任务列表
 */
function getTodayTasks() {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    // 如果今日任务不存在，生成新任务
    if (!isset($data['daily_tasks'][$today])) {
        return generateDailyTasks();
    }
    
    return $data['daily_tasks'][$today];
}

/**
 * 标记用户完成任务
 * @param string $taskId 任务ID
 * @param string $userId 用户ID
 * @return bool 是否成功
 */
function markTaskComplete($taskId, $userId) {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    if (!isset($data['daily_tasks'][$today])) {
        error_log("今日任务不存在");
        return false;
    }
    
    // 查找任务
    $taskIndex = -1;
    foreach ($data['daily_tasks'][$today] as $index => $task) {
        if ($task['id'] === $taskId) {
            $taskIndex = $index;
            break;
        }
    }
    
    if ($taskIndex === -1) {
        error_log("任务不存在: {$taskId}");
        return false;
    }
    
    // 检查是否已标记
    if (in_array($userId, $data['daily_tasks'][$today][$taskIndex]['completed_by'])) {
        error_log("用户已标记完成: {$userId}");
        return false;
    }
    
    // 标记完成
    $data['daily_tasks'][$today][$taskIndex]['completed_by'][] = $userId;
    
    // 检查是否双方都标记完成
    if (count($data['daily_tasks'][$today][$taskIndex]['completed_by']) === 2) {
        // 双方都标记完成，状态改为可领取
        $data['daily_tasks'][$today][$taskIndex]['status'] = 'completed';
    }
    
    // 保存数据
    return safeWriteJSON(TASKS_FILE, $data);
}

/**
 * 确认任务完成
 * @param string $taskId 任务ID
 * @param string $userId 确认者ID
 * @return array 确认结果
 */
function confirmTaskComplete($taskId, $userId) {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    if (!isset($data['daily_tasks'][$today])) {
        return [
            'success' => false,
            'message' => '任务不存在或已过期'
        ];
    }
    
    // 查找任务
    $taskIndex = -1;
    foreach ($data['daily_tasks'][$today] as $index => $task) {
        if ($task['id'] === $taskId) {
            $taskIndex = $index;
            break;
        }
    }
    
    if ($taskIndex === -1) {
        return [
            'success' => false,
            'message' => '任务不存在或已过期'
        ];
    }
    
    $task = $data['daily_tasks'][$today][$taskIndex];
    
    // 检查是否已确认
    if (in_array($userId, $task['confirmed_by'])) {
        return [
            'success' => false,
            'message' => '已经确认过了'
        ];
    }
    
    // 检查自己是否已标记完成
    if (!in_array($userId, $task['completed_by'])) {
        return [
            'success' => false,
            'message' => '你还未标记完成'
        ];
    }
    
    // 检查对方是否已标记完成
    $otherUserId = $userId === 'shiqi' ? 'shisan' : 'shiqi';
    if (!in_array($otherUserId, $task['completed_by'])) {
        return [
            'success' => false,
            'message' => '对方还未标记完成'
        ];
    }
    
    // 确认完成
    $data['daily_tasks'][$today][$taskIndex]['confirmed_by'][] = $userId;
    
    // 检查是否双方都确认
    if (count($data['daily_tasks'][$today][$taskIndex]['confirmed_by']) === 2) {
        $data['daily_tasks'][$today][$taskIndex]['status'] = 'completed';
    }
    
    // 保存数据
    if (!safeWriteJSON(TASKS_FILE, $data)) {
        return [
            'success' => false,
            'message' => '保存失败'
        ];
    }
    
    return [
        'success' => true,
        'message' => '确认成功',
        'can_claim' => $data['daily_tasks'][$today][$taskIndex]['status'] === 'completed'
    ];
}

/**
 * 拒绝任务完成
 * @param string $taskId 任务ID
 * @param string $userId 拒绝者ID
 * @return bool 是否成功
 */
function rejectTaskComplete($taskId, $userId) {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    if (!isset($data['daily_tasks'][$today])) {
        return false;
    }
    
    // 查找任务
    $taskIndex = -1;
    foreach ($data['daily_tasks'][$today] as $index => $task) {
        if ($task['id'] === $taskId) {
            $taskIndex = $index;
            break;
        }
    }
    
    if ($taskIndex === -1) {
        return false;
    }
    
    // 移除对方的完成标记
    $otherUserId = $userId === 'shiqi' ? 'shisan' : 'shiqi';
    $completedBy = $data['daily_tasks'][$today][$taskIndex]['completed_by'];
    $data['daily_tasks'][$today][$taskIndex]['completed_by'] = array_values(
        array_filter($completedBy, function($id) use ($otherUserId) {
            return $id !== $otherUserId;
        })
    );
    
    // 保存数据
    return safeWriteJSON(TASKS_FILE, $data);
}

/**
 * 检查任务是否可以发放奖励
 * @param string $taskId 任务ID
 * @return bool 是否可以发放
 */
function canClaimReward($taskId) {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    if (!isset($data['daily_tasks'][$today])) {
        return false;
    }
    
    // 查找任务
    foreach ($data['daily_tasks'][$today] as $task) {
        if ($task['id'] === $taskId) {
            return $task['status'] === 'completed';
        }
    }
    
    return false;
}

/**
 * 发放任务奖励
 * @param string $taskId 任务ID
 * @return array 发放结果
 */
function claimTaskReward($taskId) {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    if (!isset($data['daily_tasks'][$today])) {
        return [
            'success' => false,
            'message' => '任务不存在或已过期'
        ];
    }
    
    // 查找任务
    $taskIndex = -1;
    foreach ($data['daily_tasks'][$today] as $index => $task) {
        if ($task['id'] === $taskId) {
            $taskIndex = $index;
            break;
        }
    }
    
    if ($taskIndex === -1) {
        return [
            'success' => false,
            'message' => '任务不存在或已过期'
        ];
    }
    
    $task = $data['daily_tasks'][$today][$taskIndex];
    
    // 检查状态
    if ($task['status'] !== 'completed') {
        return [
            'success' => false,
            'message' => '任务未完成'
        ];
    }
    
    // 检查是否已发放
    if ($task['status'] === 'rewarded') {
        return [
            'success' => false,
            'message' => '奖励已发放'
        ];
    }
    
    // 发放奖励给双方
    $reward = $task['reward'];
    $description = "完成任务：{$task['title']}";
    
    $success1 = addBalance('shiqi', $reward, 'task', $description);
    $success2 = addBalance('shisan', $reward, 'task', $description);
    
    if (!$success1 || !$success2) {
        return [
            'success' => false,
            'message' => '奖励发放失败'
        ];
    }
    
    // 更新任务状态
    $data['daily_tasks'][$today][$taskIndex]['status'] = 'rewarded';
    
    if (!safeWriteJSON(TASKS_FILE, $data)) {
        return [
            'success' => false,
            'message' => '保存失败'
        ];
    }
    
    return [
        'success' => true,
        'message' => '奖励发放成功',
        'reward' => $reward
    ];
}

/**
 * 获取任务详情
 * @param string $taskId 任务ID
 * @return array|null 任务详情
 */
function getTaskDetails($taskId) {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    
    if (!isset($data['daily_tasks'][$today])) {
        return null;
    }
    
    foreach ($data['daily_tasks'][$today] as $task) {
        if ($task['id'] === $taskId) {
            return $task;
        }
    }
    
    return null;
}

/**
 * 获取任务统计
 * @return array 统计信息
 */
function getTaskStats() {
    $data = safeReadJSON(TASKS_FILE, ['task_pool' => [], 'daily_tasks' => []]);
    
    $today = date('Y-m-d');
    $todayTasks = isset($data['daily_tasks'][$today]) ? $data['daily_tasks'][$today] : [];
    
    $stats = [
        'total' => count($todayTasks),
        'pending' => 0,
        'completed' => 0,
        'rewarded' => 0
    ];
    
    foreach ($todayTasks as $task) {
        $stats[$task['status']]++;
    }
    
    return $stats;
}
