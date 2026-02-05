<?php
/**
 * 成就管理API
 * 处理成就的增删改查操作
 */
define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';

// 设置JSON响应头
header('Content-Type: application/json');

// 要求用户登录
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '请先登录']);
    exit();
}

// 只允许POST请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '只允许POST请求']);
    exit();
}

// 获取请求数据
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$action = $input['action'] ?? '';
$csrf_token = $input['csrf_token'] ?? '';

// 验证CSRF令牌
if (!validateCSRFToken($csrf_token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '请求无效，请重新尝试']);
    exit();
}

$achievementsFile = __DIR__ . '/../data/achievements.json';

/**
 * 读取成就数据
 * @return array 成就数据
 */
function getAchievements() {
    global $achievementsFile;
    
    if (file_exists($achievementsFile)) {
        $data = json_decode(file_get_contents($achievementsFile), true);
        return $data ?: ['achievements' => [], 'nextId' => 1];
    }
    
    return ['achievements' => [], 'nextId' => 1];
}

/**
 * 保存成就数据
 * @param array $data 成就数据
 * @return bool 是否成功
 */
function saveAchievements($data) {
    global $achievementsFile;
    return file_put_contents($achievementsFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false;
}

/**
 * 添加新成就
 * @param array $achievementData 成就数据
 * @return array 结果
 */
function addAchievement($achievementData) {
    $data = getAchievements();
    
    $newAchievement = [
        'id' => $data['nextId'],
        'title' => sanitizeInput($achievementData['title'] ?? ''),
        'date' => sanitizeInput($achievementData['date'] ?? ''),
        'description' => sanitizeInput($achievementData['description'] ?? ''),
        'completed' => false,
        'createdAt' => date('c')
    ];
    
    if (empty($newAchievement['title'])) {
        return ['success' => false, 'message' => '成就标题不能为空'];
    }
    
    $data['achievements'][] = $newAchievement;
    $data['nextId']++;
    
    if (saveAchievements($data)) {
        return [
            'success' => true,
            'message' => '成就添加成功',
            'achievement' => $newAchievement
        ];
    }
    
    return ['success' => false, 'message' => '保存失败'];
}

/**
 * 更新成就
 * @param int $achievementId 成就ID
 * @param array $updates 更新数据
 * @return array 结果
 */
function updateAchievement($achievementId, $updates) {
    $data = getAchievements();
    $found = false;
    
    foreach ($data['achievements'] as &$achievement) {
        if ($achievement['id'] === $achievementId) {
            if (isset($updates['title'])) {
                $achievement['title'] = sanitizeInput($updates['title']);
            }
            if (isset($updates['date'])) {
                $achievement['date'] = sanitizeInput($updates['date']);
            }
            if (isset($updates['description'])) {
                $achievement['description'] = sanitizeInput($updates['description']);
            }
            if (isset($updates['completed'])) {
                $achievement['completed'] = (bool)$updates['completed'];
            }
            
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        return ['success' => false, 'message' => '成就不存在'];
    }
    
    if (saveAchievements($data)) {
        return ['success' => true, 'message' => '成就更新成功'];
    }
    
    return ['success' => false, 'message' => '保存失败'];
}

/**
 * 删除成就
 * @param int $achievementId 成就ID
 * @return array 结果
 */
function deleteAchievement($achievementId) {
    $data = getAchievements();
    $originalCount = count($data['achievements']);
    
    $data['achievements'] = array_values(array_filter(
        $data['achievements'],
        function($a) use ($achievementId) { return $a['id'] !== $achievementId; }
    ));
    
    if (count($data['achievements']) === $originalCount) {
        return ['success' => false, 'message' => '成就不存在'];
    }
    
    if (saveAchievements($data)) {
        return ['success' => true, 'message' => '成就删除成功'];
    }
    
    return ['success' => false, 'message' => '保存失败'];
}

/**
 * 切换成就完成状态
 * @param int $achievementId 成就ID
 * @return array 结果
 */
function toggleAchievementStatus($achievementId) {
    $data = getAchievements();
    $found = false;
    
    foreach ($data['achievements'] as &$achievement) {
        if ($achievement['id'] === $achievementId) {
            $achievement['completed'] = !$achievement['completed'];
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        return ['success' => false, 'message' => '成就不存在'];
    }
    
    if (saveAchievements($data)) {
        return ['success' => true, 'message' => '状态更新成功'];
    }
    
    return ['success' => false, 'message' => '保存失败'];
}

// 处理请求
switch ($action) {
    case 'get':
        // 获取成就列表
        $data = getAchievements();
        
        // 按时间倒序排列
        usort($data['achievements'], function($a, $b) {
            return strtotime($b['createdAt']) - strtotime($a['createdAt']);
        });
        
        echo json_encode([
            'success' => true,
            'achievements' => $data['achievements'],
            'total' => count($data['achievements'])
        ]);
        break;
        
    case 'add':
        // 添加成就
        $result = addAchievement($input);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(400);
            echo json_encode($result);
        }
        break;
        
    case 'update':
        // 更新成就
        $achievementId = intval($input['achievement_id'] ?? 0);
        $updates = $input['updates'] ?? [];
        
        if ($achievementId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '无效的成就ID']);
            exit();
        }
        
        $result = updateAchievement($achievementId, $updates);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(400);
            echo json_encode($result);
        }
        break;
        
    case 'delete':
        // 删除成就
        $achievementId = intval($input['achievement_id'] ?? 0);
        
        if ($achievementId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '无效的成就ID']);
            exit();
        }
        
        $result = deleteAchievement($achievementId);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(404);
            echo json_encode($result);
        }
        break;
        
    case 'toggle':
        // 切换完成状态
        $achievementId = intval($input['achievement_id'] ?? 0);
        
        if ($achievementId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '无效的成就ID']);
            exit();
        }
        
        $result = toggleAchievementStatus($achievementId);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(404);
            echo json_encode($result);
        }
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '未知的操作']);
        break;
}
