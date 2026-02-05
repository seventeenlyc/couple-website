<?php
/**
 * 浪漫成就页面
 * 展示和管理情侣成就
 */
define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';

// 要求用户登录
requireLogin();

$pageTitle = '浪漫成就';
$currentUser = getCurrentUser();

// 读取成就数据
$achievementsFile = 'data/achievements.json';
$achievementsData = json_decode(file_get_contents($achievementsFile), true);
$achievements = $achievementsData['achievements'] ?? [];

// 按时间倒序排列
usort($achievements, function($a, $b) {
    return strtotime($b['createdAt']) - strtotime($a['createdAt']);
});

// 统计数据
$totalAchievements = count($achievements);
$completedAchievements = count(array_filter($achievements, function($a) { return $a['completed']; }));
$completionRate = $totalAchievements > 0 ? round(($completedAchievements / $totalAchievements) * 100) : 0;

// 处理表单提交
$message = '';
$messageType = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrf_token = $_POST['csrf_token'] ?? '';
    
    if (!validateCSRFToken($csrf_token)) {
        $message = '请求无效，请重新尝试';
        $messageType = 'error';
    } else {
        $action = $_POST['action'] ?? '';
        
        if ($action === 'add') {
            // 添加新成就
            $newAchievement = [
                'id' => $achievementsData['nextId'],
                'title' => sanitizeInput($_POST['title'] ?? ''),
                'date' => sanitizeInput($_POST['date'] ?? ''),
                'description' => sanitizeInput($_POST['description'] ?? ''),
                'completed' => false,
                'createdAt' => date('c')
            ];
            
            if (!empty($newAchievement['title'])) {
                $achievementsData['achievements'][] = $newAchievement;
                $achievementsData['nextId']++;
                
                file_put_contents($achievementsFile, json_encode($achievementsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                
                $message = '成就添加成功！';
                $messageType = 'success';
                
                // 重新加载数据
                header('Location: achievements.php');
                exit();
            } else {
                $message = '请填写成就标题';
                $messageType = 'error';
            }
        } elseif ($action === 'toggle') {
            // 切换完成状态
            $achievementId = intval($_POST['achievement_id'] ?? 0);
            
            foreach ($achievementsData['achievements'] as &$achievement) {
                if ($achievement['id'] === $achievementId) {
                    $achievement['completed'] = !$achievement['completed'];
                    break;
                }
            }
            
            file_put_contents($achievementsFile, json_encode($achievementsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            header('Location: achievements.php');
            exit();
        } elseif ($action === 'delete') {
            // 删除成就
            $achievementId = intval($_POST['achievement_id'] ?? 0);
            
            $achievementsData['achievements'] = array_values(array_filter(
                $achievementsData['achievements'],
                function($a) use ($achievementId) { return $a['id'] !== $achievementId; }
            ));
            
            file_put_contents($achievementsFile, json_encode($achievementsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            $message = '成就删除成功';
            $messageType = 'success';
            
            header('Location: achievements.php');
            exit();
        }
    }
}

// 生成CSRF令牌
$csrf_token = generateCSRFToken();

$pageHeader = '
<div class="text-center">
    <h1 class="text-4xl font-bold text-gray-800 mb-4">
        浪漫成就
    </h1>
    <p class="text-xl text-gray-600">
        记录我们一起解锁的美好时刻 🎉
    </p>
</div>';

include 'includes/header.php';
?>

<!-- 消息提示 -->
<?php if ($message): ?>
<div class="mb-6 p-4 rounded-lg <?php echo $messageType === 'success' ? 'bg-green-100 text-green-700 border border-green-400' : 'bg-red-100 text-red-700 border border-red-400'; ?>">
    <div class="flex items-center">
        <i class="fas <?php echo $messageType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'; ?> mr-2"></i>
        <?php echo htmlspecialchars($message); ?>
    </div>
</div>
<?php endif; ?>

<!-- 统计卡片 -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
    <div class="card p-6 text-center">
        <div class="text-4xl font-bold text-blue-600 mb-2"><?php echo $totalAchievements; ?></div>
        <div class="text-gray-600">总成就数</div>
    </div>
    <div class="card p-6 text-center">
        <div class="text-4xl font-bold text-green-600 mb-2"><?php echo $completedAchievements; ?></div>
        <div class="text-gray-600">已完成</div>
    </div>
    <div class="card p-6 text-center">
        <div class="text-4xl font-bold text-yellow-600 mb-2"><?php echo $completionRate; ?>%</div>
        <div class="text-gray-600">完成率</div>
    </div>
</div>

<!-- 添加成就表单 -->
<div class="card p-6 mb-6">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-plus-circle text-green-500 mr-2"></i>添加新成就
    </h2>
    <form method="POST" class="space-y-4">
        <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
        <input type="hidden" name="action" value="add">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-star mr-2 text-yellow-500"></i>成就标题 *
                </label>
                <input 
                    type="text" 
                    id="title" 
                    name="title" 
                    placeholder="例如：第一次约会"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                >
            </div>
            <div>
                <label for="date" class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-calendar mr-2 text-pink-500"></i>日期
                </label>
                <input 
                    type="date" 
                    id="date" 
                    name="date" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
            </div>
        </div>
        
        <div>
            <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
                <i class="fas fa-comment mr-2 text-blue-500"></i>描述
            </label>
            <textarea 
                id="description" 
                name="description" 
                rows="3"
                placeholder="记录这个成就的故事..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
        </div>
        
        <button 
            type="submit" 
            class="btn-primary w-full md:w-auto"
        >
            <i class="fas fa-plus mr-2"></i>添加成就
        </button>
    </form>
</div>

<!-- 成就列表 -->
<?php if (empty($achievements)): ?>
<div class="card p-8 text-center">
    <div class="text-6xl mb-4">🏆</div>
    <h3 class="text-2xl font-semibold text-gray-800 mb-2">还没有成就</h3>
    <p class="text-gray-600 mb-4">添加第一个成就，开始记录你们的美好时刻吧！</p>
</div>
<?php else: ?>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <?php foreach ($achievements as $achievement): ?>
    <div class="card overflow-hidden hover:shadow-lg transition-shadow duration-300 <?php echo $achievement['completed'] ? 'border-2 border-green-400' : ''; ?>">
        <div class="p-6">
            <!-- 成就图标和状态 -->
            <div class="flex justify-between items-start mb-4">
                <div class="text-4xl">
                    <?php if ($achievement['completed']): ?>
                        <i class="fas fa-trophy text-yellow-500"></i>
                    <?php else: ?>
                        <i class="far fa-trophy text-gray-400"></i>
                    <?php endif; ?>
                </div>
                <div>
                    <?php if ($achievement['completed']): ?>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            <i class="fas fa-check-circle mr-1"></i>已完成
                        </span>
                    <?php else: ?>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                            <i class="far fa-circle mr-1"></i>未完成
                        </span>
                    <?php endif; ?>
                </div>
            </div>
            
            <!-- 成就信息 -->
            <h3 class="text-xl font-semibold text-gray-800 mb-2">
                <?php echo htmlspecialchars($achievement['title']); ?>
            </h3>
            
            <?php if ($achievement['date']): ?>
            <div class="text-sm text-gray-500 mb-3">
                <i class="fas fa-calendar mr-1"></i>
                <?php echo htmlspecialchars($achievement['date']); ?>
            </div>
            <?php endif; ?>
            
            <?php if ($achievement['description']): ?>
            <p class="text-gray-600 text-sm mb-4">
                <?php echo htmlspecialchars($achievement['description']); ?>
            </p>
            <?php endif; ?>
            
            <!-- 操作按钮 -->
            <div class="flex space-x-2">
                <form method="POST" class="flex-1">
                    <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
                    <input type="hidden" name="action" value="toggle">
                    <input type="hidden" name="achievement_id" value="<?php echo $achievement['id']; ?>">
                    <button 
                        type="submit" 
                        class="w-full px-4 py-2 rounded-lg <?php echo $achievement['completed'] ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-500 text-white hover:bg-green-600'; ?> transition-colors"
                    >
                        <i class="fas <?php echo $achievement['completed'] ? 'fa-undo' : 'fa-check'; ?> mr-1"></i>
                        <?php echo $achievement['completed'] ? '取消完成' : '标记完成'; ?>
                    </button>
                </form>
                <form method="POST" onsubmit="return confirm('确定要删除这个成就吗？');">
                    <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="achievement_id" value="<?php echo $achievement['id']; ?>">
                    <button 
                        type="submit" 
                        class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </form>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>

<?php include 'includes/footer.php'; ?>
