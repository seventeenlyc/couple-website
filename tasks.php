<?php
/**
 * 任务页面
 * 显示每日签到和任务列表
 */

define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/checkin-helper.php';
require_once 'includes/auto-sync-helper.php';

// 初始化会话
initSession();

// 检查登录状态
if (!isLoggedIn()) {
    header('Location: index.php');
    exit;
}

// 自动同步数据
autoSyncData();

$userId = getCurrentUserId();
$pageTitle = '每日任务';
$additionalStyles = '<link rel="stylesheet" href="assets/css/shop.css">';

// 获取签到信息
$hasCheckedIn = hasCheckedInToday($userId);
$streakDays = getStreakDays($userId);

// 获取签到日历数据
$calendarData = getCheckinCalendar($userId);
?>

<?php require_once 'includes/header.php'; ?>

<!-- 引入商城特效 -->
<script src="assets/js/shop-effects.js"></script>

<div class="container mx-auto px-4 py-8">
    <!-- 页面标题 -->
    <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2" style="color: var(--primary-color);">
            <i class="fas fa-tasks"></i> 每日任务
        </h1>
        <p class="text-gray-600">完成任务赚取爱心币 💕</p>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 左侧：签到区域 -->
        <div class="lg:col-span-1">
            <!-- 签到卡片 -->
            <div class="card p-6 mb-6">
                <h2 class="text-xl font-bold mb-4 flex items-center">
                    <i class="fas fa-calendar-check text-pink-500 mr-2"></i>
                    每日签到
                </h2>
                
                <div class="text-center mb-4">
                    <div class="inline-block p-6 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full mb-3">
                        <i class="fas fa-heart text-5xl text-pink-500"></i>
                    </div>
                    <div class="text-3xl font-bold text-pink-600 mb-2">
                        连续 <?php echo $streakDays; ?> 天
                    </div>
                    <p class="text-sm text-gray-600">坚持签到，获得更多奖励！</p>
                </div>
                
                <?php if ($hasCheckedIn): ?>
                    <button disabled class="w-full py-3 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed">
                        <i class="fas fa-check-circle"></i> 今日已签到
                    </button>
                    <p class="text-center text-sm text-gray-500 mt-2">明天再来吧 💕</p>
                <?php else: ?>
                    <button onclick="checkIn()" id="checkin-btn" class="w-full btn-primary py-3">
                        <i class="fas fa-hand-pointer"></i> 立即签到
                    </button>
                    <p class="text-center text-sm text-gray-600 mt-2">
                        签到可获得 <span class="font-semibold text-pink-600">10-20</span> 爱心币
                    </p>
                <?php endif; ?>
                
                <!-- 签到日历 -->
                <div class="mt-4 p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg">
                    <h3 class="font-semibold text-sm mb-3 text-gray-800 flex items-center justify-between">
                        <span><i class="fas fa-calendar-alt text-pink-500"></i> 本月签到</span>
                        <span class="text-pink-600"><?php echo $calendarData['checkin_count']; ?> 天</span>
                    </h3>
                    
                    <!-- 星期标题 -->
                    <div class="grid grid-cols-7 gap-1 mb-2">
                        <div class="text-center text-xs text-gray-500 font-medium">日</div>
                        <div class="text-center text-xs text-gray-500 font-medium">一</div>
                        <div class="text-center text-xs text-gray-500 font-medium">二</div>
                        <div class="text-center text-xs text-gray-500 font-medium">三</div>
                        <div class="text-center text-xs text-gray-500 font-medium">四</div>
                        <div class="text-center text-xs text-gray-500 font-medium">五</div>
                        <div class="text-center text-xs text-gray-500 font-medium">六</div>
                    </div>
                    
                    <!-- 日历格子 -->
                    <div class="grid grid-cols-7 gap-1">
                        <?php
                        // 填充第一周的空白
                        for ($i = 0; $i < $calendarData['first_day_of_week']; $i++) {
                            echo '<div class="aspect-square"></div>';
                        }
                        
                        // 显示每一天
                        foreach ($calendarData['days'] as $dayData) {
                            $classes = 'aspect-square flex items-center justify-center text-xs rounded-lg transition-all';
                            
                            if ($dayData['is_checked_in']) {
                                // 已签到
                                $classes .= ' bg-gradient-to-br from-pink-400 to-pink-500 text-white font-bold shadow-sm';
                                $icon = '<i class="fas fa-check text-xs"></i>';
                            } else if ($dayData['is_today']) {
                                // 今天但未签到
                                $classes .= ' border-2 border-pink-400 text-pink-600 font-semibold';
                                $icon = '';
                            } else {
                                // 普通日期
                                $classes .= ' bg-white text-gray-600 hover:bg-gray-50';
                                $icon = '';
                            }
                            
                            echo "<div class=\"{$classes}\" title=\"{$dayData['date']}\">";
                            if ($dayData['is_checked_in']) {
                                echo $icon;
                            } else {
                                echo $dayData['day'];
                            }
                            echo '</div>';
                        }
                        ?>
                    </div>
                    
                    <div class="mt-3 flex items-center justify-center gap-4 text-xs text-gray-600">
                        <div class="flex items-center gap-1">
                            <div class="w-4 h-4 bg-gradient-to-br from-pink-400 to-pink-500 rounded"></div>
                            <span>已签到</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <div class="w-4 h-4 border-2 border-pink-400 rounded"></div>
                            <span>今天</span>
                        </div>
                    </div>
                </div>
                
                <!-- 签到奖励说明 -->
                <div class="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <h3 class="font-semibold text-sm mb-2 text-yellow-800">
                        <i class="fas fa-gift"></i> 连续签到奖励
                    </h3>
                    <ul class="text-xs text-gray-700 space-y-1">
                        <li>• 第1天: 10 💕</li>
                        <li>• 第2-6天: 15 💕</li>
                        <li>• 第7天及以上: 20 💕</li>
                    </ul>
                </div>
            </div>
            
            <!-- 快捷链接 -->
            <div class="card p-4">
                <h3 class="font-semibold mb-3 text-gray-700">
                    <i class="fas fa-link"></i> 快捷链接
                </h3>
                <div class="space-y-2">
                    <a href="shop.php" class="block px-3 py-2 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors">
                        <i class="fas fa-store text-pink-500"></i> 前往商城
                    </a>
                    <a href="transaction-history.php" class="block px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        <i class="fas fa-history text-blue-500"></i> 交易历史
                    </a>
                    <a href="my-items.php" class="block px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                        <i class="fas fa-backpack text-purple-500"></i> 我的背包
                    </a>
                </div>
            </div>
        </div>
        
        <!-- 右侧：任务列表 -->
        <div class="lg:col-span-2">
            <div class="card p-6">
                <h2 class="text-xl font-bold mb-4 flex items-center justify-between">
                    <span>
                        <i class="fas fa-list-check text-blue-500 mr-2"></i>
                        今日任务
                    </span>
                    <button onclick="loadTasks()" class="text-sm text-blue-500 hover:text-blue-700">
                        <i class="fas fa-sync-alt"></i> 刷新
                    </button>
                </h2>
                
                <div id="tasks-container">
                    <div class="text-center py-12">
                        <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
                        <p class="text-gray-600">加载任务中...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
const currentUserId = '<?php echo $userId; ?>';

// 显示成功提示
function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 页面加载时获取任务
document.addEventListener('DOMContentLoaded', function() {
    loadTasks();
});

// 签到
function checkIn() {
    const btn = document.getElementById('checkin-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 签到中...';
    
    fetch('api/checkin.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('签到响应状态:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
    })
    .then(text => {
        console.log('签到响应内容:', text);
        const data = JSON.parse(text);
        console.log('签到解析数据:', data);
        
        if (data.success) {
            showSuccessToast(`签到成功！获得 ${data.reward} 爱心币 💕 连续签到 ${data.streak_days} 天`);
            setTimeout(() => window.location.reload(), 1500);
        } else {
            alert(data.message || '签到失败');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-hand-pointer"></i> 立即签到';
        }
    })
    .catch(error => {
        console.error('签到错误:', error);
        alert('签到失败，请重试');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-hand-pointer"></i> 立即签到';
    });
}

// 加载任务
function loadTasks() {
    fetch('api/tasks.php?action=get_today')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayTasks(data.tasks);
            } else {
                showError('加载任务失败');
            }
        })
        .catch(error => {
            console.error('加载任务错误:', error);
            showError('加载任务失败，请刷新页面重试');
        });
}

// 显示任务
function displayTasks(tasks) {
    const container = document.getElementById('tasks-container');
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                <p class="text-gray-600">今天还没有任务</p>
                <p class="text-sm text-gray-500 mt-2">系统会自动生成每日任务</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const isCompleted = task.completed_by && task.completed_by.includes(currentUserId);
        const otherUserId = currentUserId === 'shiqi' ? 'shisan' : 'shiqi';
        const otherCompleted = task.completed_by && task.completed_by.includes(otherUserId);
        const canClaim = task.status === 'completed';
        const isRewarded = task.status === 'rewarded';
        
        let statusBadge = '';
        let actionButtons = '';
        
        if (isRewarded) {
            // 已领取奖励
            statusBadge = '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"><i class="fas fa-check-circle"></i> 已完成</span>';
        } else if (canClaim) {
            // 双方都标记完成，可以领取奖励
            statusBadge = '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm"><i class="fas fa-gift"></i> 可领取</span>';
            actionButtons = `
                <button onclick="claimReward('${task.id}')" class="btn-primary px-4 py-2">
                    <i class="fas fa-gift"></i> 领取奖励
                </button>
            `;
        } else if (isCompleted && otherCompleted) {
            // 双方都标记完成，但还没领取（不应该出现这种情况）
            statusBadge = '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm"><i class="fas fa-gift"></i> 可领取</span>';
            actionButtons = `
                <button onclick="claimReward('${task.id}')" class="btn-primary px-4 py-2">
                    <i class="fas fa-gift"></i> 领取奖励
                </button>
            `;
        } else if (isCompleted) {
            // 自己标记了，对方还没标记
            statusBadge = '<span class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"><i class="fas fa-hourglass-half"></i> 等待对方</span>';
        } else if (otherCompleted) {
            // 对方标记了，自己还没标记 - 显示"确认完成"
            statusBadge = '<span class="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"><i class="fas fa-exclamation-circle"></i> 对方已完成</span>';
            actionButtons = `
                <button onclick="confirmComplete('${task.id}')" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                    <i class="fas fa-check"></i> 确认完成
                </button>
            `;
        } else {
            // 都还没标记
            statusBadge = '<span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"><i class="fas fa-circle"></i> 进行中</span>';
            actionButtons = `
                <button onclick="markComplete('${task.id}')" class="btn-primary px-4 py-2">
                    <i class="fas fa-check"></i> 标记完成
                </button>
            `;
        }
        
        return `
            <div class="border-b pb-4 mb-4 last:border-b-0 last:mb-0">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg mb-1">${escapeHtml(task.title)}</h3>
                        <p class="text-gray-600 text-sm mb-2">${escapeHtml(task.description)}</p>
                        <div class="flex items-center space-x-3 text-sm">
                            <span class="text-pink-600 font-semibold">
                                <i class="fas fa-heart"></i> ${task.reward} 爱心币
                            </span>
                            ${statusBadge}
                        </div>
                    </div>
                </div>
                ${actionButtons ? `<div class="mt-3 flex space-x-2">${actionButtons}</div>` : ''}
                ${task.completed_by && task.completed_by.length > 0 ? `
                    <div class="mt-2 text-xs text-gray-500">
                        <i class="fas fa-users"></i> 完成者: ${task.completed_by.join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// 标记任务完成
function markComplete(taskId) {
    showConfirmModal(
        '确定标记此任务为完成吗？',
        '标记后对方需要确认才能领取奖励。',
        () => {
            fetch('api/tasks.php?action=mark_complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id: taskId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 不显示弹窗，直接刷新任务列表
                    loadTasks();
                } else {
                    showFloatingNotification(data.message || '操作失败', 'error');
                }
            })
            .catch(error => {
                console.error('标记完成错误:', error);
                showFloatingNotification('操作失败，请重试', 'error');
            });
        }
    );
}

// 确认完成（对方已完成时）
function confirmComplete(taskId) {
    fetch('api/tasks.php?action=mark_complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id: taskId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 不显示弹窗，直接刷新任务列表显示领取按钮
            loadTasks();
        } else {
            showFloatingNotification(data.message || '操作失败', 'error');
        }
    })
    .catch(error => {
        console.error('确认完成错误:', error);
        showFloatingNotification('操作失败，请重试', 'error');
    });
}

// 确认任务
function confirmTask(taskId) {
    showConfirmModal(
        '确认对方已完成此任务吗？',
        '确认后对方可以领取奖励。',
        () => {
            fetch('api/tasks.php?action=confirm', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id: taskId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showFloatingNotification(data.message, 'success');
                    loadTasks();
                } else {
                    showFloatingNotification(data.message || '操作失败', 'error');
                }
            })
            .catch(error => {
                console.error('确认任务错误:', error);
                showFloatingNotification('操作失败，请重试', 'error');
            });
        }
    );
}

// 拒绝任务
function rejectTask(taskId) {
    showConfirmModal(
        '确定拒绝此任务吗？',
        '拒绝后任务将重置为待完成状态。',
        () => {
            fetch('api/tasks.php?action=reject', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
                body: JSON.stringify({ task_id: taskId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showFloatingNotification(data.message, 'success');
                    loadTasks();
                } else {
                    showFloatingNotification(data.message || '操作失败', 'error');
                }
            })
            .catch(error => {
                console.error('拒绝任务错误:', error);
                showFloatingNotification('操作失败，请重试', 'error');
            });
        }
    );
}

// 领取奖励
function claimReward(taskId) {
    fetch('api/tasks.php?action=claim_reward', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id: taskId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccessToast(`${data.message} 获得 ${data.reward} 爱心币 💕`);
            loadTasks();
            // 刷新页面以更新余额
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showFloatingNotification(data.message || '领取失败', 'error');
        }
    })
    .catch(error => {
        console.error('领取奖励错误:', error);
        showFloatingNotification('领取失败，请重试', 'error');
    });
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示错误
function showError(message) {
    const container = document.getElementById('tasks-container');
    container.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-exclamation-circle text-6xl text-red-400 mb-4"></i>
            <p class="text-gray-600 text-lg">${message}</p>
        </div>
    `;
}

// 显示确认弹窗
function showConfirmModal(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg max-w-md w-full" onclick="event.stopPropagation()">
            <div class="p-6 border-b flex justify-between items-center">
                <h3 class="text-xl font-semibold text-gray-800">
                    <i class="fas fa-question-circle text-blue-500 mr-2"></i>
                    ${escapeHtml(title)}
                </h3>
                <button onclick="document.getElementById('confirm-modal').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6">
                <p class="text-gray-600 mb-6">${escapeHtml(message)}</p>
                
                <div class="flex justify-end space-x-3">
                    <button 
                        onclick="document.getElementById('confirm-modal').remove()"
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        <i class="fas fa-times mr-2"></i>取消
                    </button>
                    <button 
                        onclick="document.getElementById('confirm-modal').remove(); confirmModalCallback();"
                        class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                        <i class="fas fa-check mr-2"></i>确定
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.confirmModalCallback = onConfirm;
}
</script>

<?php require_once 'includes/footer.php'; ?>
