<?php
/**
 * 主页
 * 登录后的欢迎页面
 */
define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/avatar-helper.php';

// 要求用户登录
requireLogin();

$pageTitle = '主页';
$currentUser = getCurrentUser();
$currentUserId = getCurrentUserId();
$userConfig = getUserConfig($currentUser);
$startDate = getStartDate();

// ========== 一次性弹窗配置 ==========
// 修改这里的内容来自定义弹窗
$oneTimePopup = [
    'enabled' => false,  // 设为 true 启用弹窗
    'target_user' => 'name1',  // 目标用户
    'title' => '💕 亲爱的',  // 弹窗标题
    'content' => '这里写你想说的话...<br><br>可以用HTML换行哦~',  // 弹窗内容（支持HTML）
    'popup_id' => 'popup_example'  // 唯一ID，改变这个ID可以让弹窗再次显示
];

// 检查是否需要显示弹窗
$showOneTimePopup = false;
if ($oneTimePopup['enabled'] && $currentUser === $oneTimePopup['target_user']) {
    $popupFile = 'data/popup_shown.json';
    $popupData = file_exists($popupFile) ? json_decode(file_get_contents($popupFile), true) : [];
    if (!isset($popupData[$oneTimePopup['popup_id']])) {
        $showOneTimePopup = true;
    }
}
// ========== 一次性弹窗配置结束 ==========

// 获取双方的头像 - 固定位置：左边name1，右边name2
$name1Avatar = getUserAvatarUrl('name1');
$name2Avatar = getUserAvatarUrl('name2');

// 判断是否有头像
$name1HasAvatar = hasUserAvatar('name1');
$name2HasAvatar = hasUserAvatar('name2');

// 计算恋爱天数
$startDateTime = new DateTime($startDate);
$currentDateTime = new DateTime();
$interval = $startDateTime->diff($currentDateTime);
$loveDays = $interval->days;

$pageHeader = '
<div class="text-center mb-8">
    <h1 class="text-4xl font-bold text-gray-800 mb-4">
        <i class="fas fa-heart text-pink-500 mr-2"></i>
        欢迎回家，' . htmlspecialchars($currentUser) . '！
        <i class="fas fa-heart text-pink-500 ml-2"></i>
    </h1>
</div>';

include 'includes/header.php';
?>

<!-- 恋爱时长显示区域 -->
<div class="love-duration-section mb-8">
    <div class="card p-8 text-center bg-gradient-to-r from-pink-50 to-purple-50">
        <div class="flex justify-center items-center mb-4">
            <!-- 左边：name1 -->
            <?php if ($name1HasAvatar): ?>
                <img src="<?php echo htmlspecialchars($name1Avatar); ?>" 
                     alt="name1的头像" 
                     class="avatar-home animate-bounce">
            <?php else: ?>
                <img src="assets/images/cat.svg" alt="小猫" class="w-24 h-24 animate-bounce">
            <?php endif; ?>
            
            <img src="assets/images/heart.svg" alt="爱心" class="w-32 h-32 mx-4">
            
            <!-- 右边：name2 -->
            <?php if ($name2HasAvatar): ?>
                <img src="<?php echo htmlspecialchars($name2Avatar); ?>" 
                     alt="name2的头像" 
                     class="avatar-home animate-bounce" 
                     style="animation-delay: 0.2s;">
            <?php else: ?>
                <img src="assets/images/dog.svg" alt="小狗" class="w-24 h-24 animate-bounce" style="animation-delay: 0.2s;">
            <?php endif; ?>
        </div>
        <h2 class="text-3xl font-bold text-gray-800 mb-4">我们在一起</h2>
        <div id="love-duration" class="text-6xl font-bold text-pink-600 mb-4">
            <span id="days"><?php echo $loveDays; ?></span> 天
        </div>
        <div id="detailed-duration" class="text-xl text-gray-600 mb-4"></div>
        <p class="text-gray-500">
            从 <span class="font-semibold text-pink-600"><?php echo $startDate; ?></span> 开始
        </p>
        <div class="mt-6 flex justify-center space-x-4">
            <!-- 左边：name1 -->
            <?php if ($name1HasAvatar): ?>
                <img src="<?php echo htmlspecialchars($name1Avatar); ?>" 
                     alt="name1的头像" 
                     class="w-12 h-12 rounded-full object-cover">
            <?php else: ?>
                <img src="assets/images/cat.svg" alt="小猫" class="w-12 h-12">
            <?php endif; ?>
            
            <img src="assets/images/heart.svg" alt="爱心" class="w-12 h-12">
            
            <!-- 右边：name2 -->
            <?php if ($name2HasAvatar): ?>
                <img src="<?php echo htmlspecialchars($name2Avatar); ?>" 
                     alt="name2的头像" 
                     class="w-12 h-12 rounded-full object-cover">
            <?php else: ?>
                <img src="assets/images/dog.svg" alt="小狗" class="w-12 h-12">
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- 快速导航 -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <div class="card p-6 hover:shadow-xl transition-shadow">
        <div class="text-center">
            <div class="text-5xl mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">
                <i class="text-blue-500 mr-2"></i>相册
            </h3>
            <p class="text-gray-600 mb-4">查看我们的美好回忆</p>
            <a href="album-fixed.php" class="btn-primary inline-block text-center w-full">
                <i class="fas fa-arrow-right mr-2"></i>进入相册
            </a>
        </div>
    </div>
    
    <div class="card p-6 hover:shadow-xl transition-shadow">
        <div class="text-center">
            <div class="text-5xl mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">
                <i class="text-yellow-500 mr-2"></i>浪漫成就
            </h3>
            <p class="text-gray-600 mb-4">我们一起解锁的成就</p>
            <a href="achievements.php" class="btn-primary inline-block text-center w-full">
                <i class="fas fa-arrow-right mr-2"></i>查看成就
            </a>
        </div>
    </div>
    
    <div class="card p-6 hover:shadow-xl transition-shadow">
        <div class="text-center">
            <div class="text-5xl mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">
                <i class="text-red-500 mr-2"></i>隐私空间
            </h3>
            <p class="text-gray-600 mb-4">不如说是暂存文件的小天地</p>
            <a href="private.php" class="btn-primary inline-block text-center w-full">
                <i class="fas fa-arrow-right mr-2"></i>进入空间
            </a>
        </div>
    </div>
</div>

<!-- 统计信息 -->
<div class="card p-6 mb-8">
    <h3 class="text-xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-chart-line text-green-500 mr-2"></i>我们的数据
    </h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div class="bg-pink-50 p-4 rounded-lg">
            <div class="text-3xl font-bold text-pink-600" id="stat-days"><?php echo $loveDays; ?></div>
            <div class="text-sm text-gray-600">相爱天数</div>
        </div>
        <div class="bg-blue-50 p-4 rounded-lg">
            <div class="text-3xl font-bold text-blue-600" id="stat-hours">0</div>
            <div class="text-sm text-gray-600">相爱小时</div>
        </div>
        <div class="bg-purple-50 p-4 rounded-lg">
            <div class="text-3xl font-bold text-purple-600" id="stat-minutes">0</div>
            <div class="text-sm text-gray-600">相爱分钟</div>
        </div>
        <div class="bg-green-50 p-4 rounded-lg">
            <div class="text-3xl font-bold text-green-600">73%</div>
            <div class="text-sm text-gray-600">许愿成功率</div>
        </div>
    </div>
</div>

<!-- 今日寄语 -->
<div class="card p-6">
    <h3 class="text-xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-quote-left text-purple-500 mr-2"></i>今日寄语
    </h3>
    <div class="text-center" id="daily-quote-container">
        <!-- 加载状态 -->
        <div id="quote-loading" class="py-4">
            <i class="fas fa-spinner fa-spin text-purple-500 text-2xl"></i>
            <p class="text-gray-500 mt-2">正在加载今日情话...</p>
        </div>
        
        <!-- 情话内容 -->
        <div id="quote-content" style="display: none;">
            <p class="text-lg text-gray-700 italic mb-4" id="quote-text">
                "爱情不是寻找一个完美的人，而是学会用完美的眼光欣赏一个不完美的人。"
            </p>
            <p class="text-sm text-gray-500">
                —— 致我们永恒的爱情 💕
            </p>
        </div>
        
        <!-- 错误状态 -->
        <div id="quote-error" class="py-4" style="display: none;">
            <i class="fas fa-exclamation-circle text-red-500 text-2xl"></i>
            <p class="text-gray-600 mt-2">暂时无法加载情话</p>
            <p class="text-sm text-gray-500 mt-1">不过我们的爱依然美好 💕</p>
        </div>
    </div>
</div>

<!-- 纪念日提醒 -->
<div class="card p-6" id="anniversary-reminders-section">
    <h3 class="text-xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-calendar-heart text-pink-500 mr-2"></i>纪念日提醒
    </h3>
    
    <!-- 加载状态 -->
    <div id="reminders-loading" class="text-center py-4" style="display: block;">
        <i class="fas fa-spinner fa-spin text-pink-500 text-2xl"></i>
        <p class="text-gray-500 mt-2">正在加载纪念日...</p>
    </div>
    
    <!-- 提醒列表 -->
    <div id="reminders-list" class="space-y-3" style="display: none;">
        <!-- 动态加载的提醒卡片将插入这里 -->
    </div>
    
    <!-- 无提醒状态 -->
    <div id="no-reminders" class="text-center py-4" style="display: none;">
        <i class="fas fa-calendar-check text-gray-400 text-3xl"></i>
        <p class="text-gray-600 mt-2">近期没有纪念日</p>
        <p class="text-sm text-gray-500 mt-1">每一天都值得纪念 💕</p>
    </div>
    
    <!-- 错误状态 -->
    <div id="reminders-error" class="text-center py-4" style="display: none;">
        <i class="fas fa-exclamation-circle text-red-500 text-2xl"></i>
        <p class="text-gray-600 mt-2">暂时无法加载纪念日</p>
    </div>
</div>

<!-- JavaScript: 恋爱时长计算 -->
<script>
/**
 * 计算恋爱时长
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @returns {Object} 包含天数、小时数、分钟数等的对象
 */
function calculateDuration(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const diff = now - start;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor(diff / 1000);
    
// 精确计算年月日
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let remainingDays = now.getDate() - start.getDate();
    
    // 处理天数为负的情况
    if (remainingDays < 0) {
        months--;
        // 获取上个月的天数
        const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        remainingDays += lastMonth.getDate();
    }
    
    // 处理月份为负的情况
    if (months < 0) {
        years--;
        months += 12;
    }
    
    return {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
        years: years,
        months: months,
        remainingDays: remainingDays
    };
}

/**
 * 格式化时长显示
 * @param {Object} duration - calculateDuration 返回的对象
 * @returns {string} 格式化的时长字符串
 */
function formatDuration(duration) {
    let parts = [];
    
    if (duration.years > 0) {
        parts.push(`${duration.years} 年`);
    }
    if (duration.months > 0) {
        parts.push(`${duration.months} 个月`);
    }
    if (duration.remainingDays > 0 || parts.length === 0) {
        parts.push(`${duration.remainingDays} 天`);
    }
    
    return parts.join(' ');
}

/**
 * 更新页面上的时长显示
 */
function updateDuration() {
    const startDate = '<?php echo $startDate; ?>';
    const duration = calculateDuration(startDate);
    
    // 更新主要显示
    document.getElementById('days').textContent = duration.days.toLocaleString();
    
    // 更新详细显示
    const detailedText = formatDuration(duration);
    document.getElementById('detailed-duration').textContent = detailedText;
    
    // 更新统计信息
    document.getElementById('stat-days').textContent = duration.days.toLocaleString();
    document.getElementById('stat-hours').textContent = duration.hours.toLocaleString();
    document.getElementById('stat-minutes').textContent = duration.minutes.toLocaleString();
}

// 页面加载时更新
document.addEventListener('DOMContentLoaded', function() {
    updateDuration();
    
    // 每分钟更新一次
    setInterval(updateDuration, 60000);
});

// 浮动爱心效果
function createFloatingHeart() {
    const icons = [
        '<img src="assets/images/heart.svg" style="width: 30px; height: 30px;">',
        '<img src="assets/images/cat.svg" style="width: 30px; height: 30px;">',
        '<img src="assets/images/dog.svg" style="width: 30px; height: 30px;">',
        '💕', '💖', '💗', '💝'
    ];
    const heart = document.createElement('div');
    heart.innerHTML = icons[Math.floor(Math.random() * icons.length)];
    heart.style.position = 'fixed';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.top = '100vh';
    heart.style.fontSize = Math.random() * 15 + 10 + 'px';
    heart.style.opacity = Math.random() * 0.7 + 0.3;
    heart.style.pointerEvents = 'none';
    heart.style.zIndex = '1000';
    heart.style.transition = 'all 4s linear';
    document.body.appendChild(heart);
    
    setTimeout(() => {
        heart.style.top = '-50px';
        heart.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
    }, 100);
    
    setTimeout(() => {
        if (document.body.contains(heart)) {
            document.body.removeChild(heart);
        }
    }, 4000);
}

// 每隔3秒创建一个浮动元素
setInterval(createFloatingHeart, 3000);

// 页面加载时创建几个浮动元素
for (let i = 0; i < 3; i++) {
    setTimeout(createFloatingHeart, i * 1000);
}
</script>

<!-- AI功能JavaScript -->
<script src="assets/js/ai-features.js"></script>

<?php if ($showOneTimePopup): ?>
<!-- 一次性弹窗 -->
<div id="oneTimePopupOverlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl transform animate-bounce-in">
        <div class="p-6">
            <div class="text-center mb-4">
                <h2 class="text-2xl font-bold text-pink-600"><?php echo $oneTimePopup['title']; ?></h2>
            </div>
            <div class="text-gray-700 text-center mb-6 leading-relaxed">
                <?php echo $oneTimePopup['content']; ?>
            </div>
            <button onclick="closeOneTimePopup()" class="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
                我知道啦 💕
            </button>
        </div>
    </div>
</div>
<style>
@keyframes bounce-in {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
}
.animate-bounce-in { animation: bounce-in 0.5s ease-out; }
</style>
<script>
function closeOneTimePopup() {
    document.getElementById('oneTimePopupOverlay').style.display = 'none';
    // 标记弹窗已显示
    fetch('api/mark-popup-shown.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popup_id: '<?php echo $oneTimePopup['popup_id']; ?>' })
    });
}
</script>
<?php endif; ?>

<?php include 'includes/footer.php'; ?>
