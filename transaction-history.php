<?php
/**
 * 交易历史页面
 * 显示用户的所有交易记录
 */

define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/currency-helper.php';

// 初始化会话
initSession();

// 检查登录状态
if (!isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$userId = getCurrentUserId();
$pageTitle = '交易历史';

// 获取交易历史
$transactions = getTransactionHistory($userId, 100);
$balance = getUserBalance($userId);
$additionalStyles = '<link rel="stylesheet" href="assets/css/shop.css">';
?>

<?php require_once 'includes/header.php'; ?>

<!-- 引入商城特效 -->
<script src="assets/js/shop-effects.js"></script>

<div class="container mx-auto px-4 py-8">
    <!-- 页面标题 -->
    <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2" style="color: var(--primary-color);">
            <i class="fas fa-history"></i> 交易历史
        </h1>
        <p class="text-gray-600">查看你的爱心币收支记录</p>
    </div>
    
    <!-- 余额卡片 -->
    <div class="card p-6 mb-6 bg-gradient-to-br from-pink-50 to-purple-50">
        <div class="text-center">
            <p class="text-gray-600 mb-2">当前余额</p>
            <div class="text-5xl font-bold text-pink-600 mb-4">
                <i class="fas fa-heart"></i> <?php echo $balance; ?>
            </div>
            <div class="flex justify-center space-x-6 text-sm">
                <a href="tasks.php" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-tasks"></i> 做任务赚币
                </a>
                <a href="shop.php" class="text-pink-600 hover:text-pink-800">
                    <i class="fas fa-store"></i> 前往商城
                </a>
            </div>
        </div>
    </div>
    
    <!-- 筛选器 -->
    <div class="card p-4 mb-6">
        <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center space-x-2">
                <span class="text-sm text-gray-600">类型:</span>
                <select id="type-filter" class="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="">全部</option>
                    <option value="income">收入</option>
                    <option value="expense">支出</option>
                </select>
            </label>
            
            <label class="flex items-center space-x-2">
                <span class="text-sm text-gray-600">来源:</span>
                <select id="source-filter" class="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="">全部</option>
                    <option value="checkin">签到</option>
                    <option value="task">任务</option>
                    <option value="purchase">购买</option>
                    <option value="refund">退款</option>
                </select>
            </label>
            
            <button onclick="resetFilters()" class="ml-auto px-4 py-1 text-sm text-gray-600 hover:text-gray-800">
                <i class="fas fa-redo"></i> 重置
            </button>
        </div>
    </div>
    
    <!-- 交易列表 -->
    <div class="card">
        <div class="p-4 border-b">
            <h2 class="font-bold text-lg">
                <i class="fas fa-list"></i> 交易记录
                <span id="transaction-count" class="text-sm text-gray-500 ml-2">(<?php echo count($transactions); ?> 条)</span>
            </h2>
        </div>
        
        <div id="transactions-container">
            <?php if (empty($transactions)): ?>
                <div class="text-center py-12">
                    <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-600">还没有交易记录</p>
                    <p class="text-sm text-gray-500 mt-2">去做任务或购买商品吧！</p>
                </div>
            <?php else: ?>
                <?php foreach ($transactions as $transaction): ?>
                    <div class="transaction-item border-b p-4 hover:bg-gray-50 transition-colors" 
                         data-type="<?php echo $transaction['type']; ?>" 
                         data-source="<?php echo $transaction['source']; ?>">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-4">
                                <!-- 图标 -->
                                <div class="w-12 h-12 rounded-full flex items-center justify-center <?php echo $transaction['type'] === 'income' ? 'bg-green-100' : 'bg-red-100'; ?>">
                                    <?php
                                    $icon = 'fa-exchange-alt';
                                    if ($transaction['source'] === 'checkin') $icon = 'fa-calendar-check';
                                    elseif ($transaction['source'] === 'task') $icon = 'fa-tasks';
                                    elseif ($transaction['source'] === 'purchase') $icon = 'fa-shopping-cart';
                                    elseif ($transaction['source'] === 'refund') $icon = 'fa-undo';
                                    ?>
                                    <i class="fas <?php echo $icon; ?> text-xl <?php echo $transaction['type'] === 'income' ? 'text-green-600' : 'text-red-600'; ?>"></i>
                                </div>
                                
                                <!-- 描述 -->
                                <div>
                                    <h3 class="font-semibold"><?php echo htmlspecialchars($transaction['description']); ?></h3>
                                    <p class="text-sm text-gray-500">
                                        <?php echo date('Y-m-d H:i:s', strtotime($transaction['timestamp'])); ?>
                                    </p>
                                </div>
                            </div>
                            
                            <!-- 金额 -->
                            <div class="text-right">
                                <div class="text-xl font-bold <?php echo $transaction['type'] === 'income' ? 'text-green-600' : 'text-red-600'; ?>">
                                    <?php echo $transaction['type'] === 'income' ? '+' : '-'; ?>
                                    <i class="fas fa-heart"></i> <?php echo $transaction['amount']; ?>
                                </div>
                                <div class="text-sm text-gray-500">
                                    余额: <?php echo $transaction['balance_after']; ?>
                                </div>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>

<script>
// 筛选功能
document.getElementById('type-filter').addEventListener('change', filterTransactions);
document.getElementById('source-filter').addEventListener('change', filterTransactions);

function filterTransactions() {
    const typeFilter = document.getElementById('type-filter').value;
    const sourceFilter = document.getElementById('source-filter').value;
    const items = document.querySelectorAll('.transaction-item');
    
    let visibleCount = 0;
    
    items.forEach(item => {
        const type = item.dataset.type;
        const source = item.dataset.source;
        
        const typeMatch = !typeFilter || type === typeFilter;
        const sourceMatch = !sourceFilter || source === sourceFilter;
        
        if (typeMatch && sourceMatch) {
            item.style.display = '';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    document.getElementById('transaction-count').textContent = `(${visibleCount} 条)`;
}

function resetFilters() {
    document.getElementById('type-filter').value = '';
    document.getElementById('source-filter').value = '';
    filterTransactions();
}
</script>

<?php require_once 'includes/footer.php'; ?>
