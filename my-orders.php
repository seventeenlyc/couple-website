<?php
/**
 * 我的订单页面
 * 显示用户的订单历史
 */

define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';

// 初始化会话
initSession();

// 检查登录状态
if (!isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$userId = getCurrentUserId();
$pageTitle = '我的订单';
$additionalStyles = '<link rel="stylesheet" href="assets/css/shop.css">';
?>

<?php require_once 'includes/header.php'; ?>
<!-- 商城特效样式和脚本 -->
<link rel="stylesheet" href="assets/css/shop-effects.css">
<script src="assets/js/shop-effects.js"></script>

<div class="container mx-auto px-4 py-8">
    <!-- 页面标题 -->
    <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2" style="color: var(--primary-color);">
            <i class="fas fa-shopping-bag"></i> 我的订单
        </h1>
        <p class="text-gray-600">查看你的购买记录</p>
    </div>
    
    <!-- 分类筛选 -->
    <div class="card p-4 mb-6">
        <div class="flex flex-wrap items-center gap-4">
            <span class="text-sm text-gray-600">商品类型:</span>
            <button onclick="filterByCategory('')" class="category-filter-btn active px-4 py-2 rounded-lg transition-colors" data-category="">
                全部
            </button>
            <button onclick="filterByCategory('virtual')" class="category-filter-btn px-4 py-2 rounded-lg transition-colors" data-category="virtual">
                <i class="fas fa-cloud text-purple-500"></i> 虚拟商品
            </button>
            <button onclick="filterByCategory('physical')" class="category-filter-btn px-4 py-2 rounded-lg transition-colors" data-category="physical">
                <i class="fas fa-box text-blue-500"></i> 实体商品
            </button>
        </div>
    </div>
    
    <!-- 订单列表 -->
    <div id="orders-container">
        <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-4xl text-pink-500 mb-4"></i>
            <p class="text-gray-600">加载订单中...</p>
        </div>
    </div>
    
    <!-- 空状态 -->
    <div id="empty-state" class="hidden text-center py-12">
        <i class="fas fa-shopping-bag text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-600 text-lg">还没有订单</p>
        <a href="shop.php" class="inline-block mt-4 btn-primary px-6 py-2">
            <i class="fas fa-store"></i> 前往商城购物
        </a>
    </div>
</div>

<!-- 评价弹窗 -->
<div id="review-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" onclick="closeReviewModal(event)">
    <div class="bg-white rounded-lg max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <div class="p-6">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold" style="color: var(--primary-color);">
                    <i class="fas fa-star"></i> 评价商品
                </h2>
                <button onclick="closeReviewModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="mb-4">
                <h3 id="review-product-name" class="font-semibold text-lg mb-2"></h3>
            </div>
            
            <!-- 评分 -->
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">评分</label>
                <div class="flex items-center gap-2">
                    <div id="star-rating" class="flex gap-1">
                        <i class="fas fa-star text-3xl text-gray-300 cursor-pointer hover:text-yellow-400" data-rating="1"></i>
                        <i class="fas fa-star text-3xl text-gray-300 cursor-pointer hover:text-yellow-400" data-rating="2"></i>
                        <i class="fas fa-star text-3xl text-gray-300 cursor-pointer hover:text-yellow-400" data-rating="3"></i>
                        <i class="fas fa-star text-3xl text-gray-300 cursor-pointer hover:text-yellow-400" data-rating="4"></i>
                        <i class="fas fa-star text-3xl text-gray-300 cursor-pointer hover:text-yellow-400" data-rating="5"></i>
                    </div>
                    <span id="rating-text" class="text-sm text-gray-600"></span>
                </div>
            </div>
            
            <!-- 评价内容 -->
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">评价内容</label>
                <textarea id="review-content" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="分享你的使用体验..."></textarea>
            </div>
            
            <!-- 按钮 -->
            <div class="flex gap-3">
                <button onclick="closeReviewModal()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                    取消
                </button>
                <button onclick="submitReview()" class="flex-1 px-4 py-2 btn-primary">
                    提交评价
                </button>
            </div>
        </div>
    </div>
</div>

<style>
.category-filter-btn {
    background-color: #f3f4f6;
    color: #6b7280;
}

.category-filter-btn.active {
    background-color: var(--primary-color);
    color: white;
}

.category-filter-btn:hover:not(.active) {
    background-color: #e5e7eb;
}
</style>

<script>
let allOrders = [];
let currentCategoryFilter = '';

// 页面加载时获取订单
document.addEventListener('DOMContentLoaded', function() {
    loadOrders();
});

// 加载订单
function loadOrders() {
    fetch('api/orders.php?action=get_my_orders')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allOrders = data.orders;
                displayOrders(allOrders);
            } else {
                showError('加载订单失败');
            }
        })
        .catch(error => {
            console.error('加载订单错误:', error);
            showError('加载订单失败，请刷新页面重试');
        });
}

// 显示订单
function displayOrders(orders) {
    const container = document.getElementById('orders-container');
    const emptyState = document.getElementById('empty-state');
    
    if (orders.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = `
        <div class="space-y-4">
            ${orders.map(order => createOrderCard(order)).join('')}
        </div>
    `;
}

// 创建订单卡片
function createOrderCard(order) {
    const categoryIcon = order.category === 'virtual' ? 'fa-cloud' : 'fa-box';
    const categoryColor = order.category === 'virtual' ? 'purple' : 'blue';
    const categoryText = order.category === 'virtual' ? '虚拟商品' : '实体商品';
    
    return `
        <div class="card p-6 order-card" data-category="${order.category}">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                <div class="flex-1 mb-4 md:mb-0">
                    <div class="flex items-start space-x-4">
                        <!-- 商品图标 -->
                        <div class="w-16 h-16 rounded-lg bg-gradient-to-br from-${categoryColor}-100 to-${categoryColor}-200 flex items-center justify-center flex-shrink-0">
                            <i class="fas ${categoryIcon} text-3xl text-${categoryColor}-500"></i>
                        </div>
                        
                        <!-- 订单信息 -->
                        <div class="flex-1">
                            <h3 class="font-bold text-lg mb-1">${escapeHtml(order.product_name)}</h3>
                            <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                <span>
                                    <i class="fas fa-tag"></i> 订单号: ${order.id}
                                </span>
                                <span class="px-2 py-1 rounded-full bg-${categoryColor}-100 text-${categoryColor}-600">
                                    <i class="fas ${categoryIcon}"></i> ${categoryText}
                                </span>
                                <span class="px-2 py-1 rounded-full bg-green-100 text-green-600">
                                    <i class="fas fa-check-circle"></i> ${order.status === 'completed' ? '已完成' : order.status}
                                </span>
                            </div>
                            <p class="text-sm text-gray-500 mt-2">
                                <i class="fas fa-clock"></i> ${formatDate(order.created_at)}
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- 价格和操作 -->
                <div class="text-right">
                    <div class="text-2xl font-bold text-pink-600 mb-2">
                        <i class="fas fa-heart"></i> ${order.price}
                    </div>
                    <div class="flex flex-col gap-2">
                        ${order.category === 'virtual' ? `
                            <a href="my-items.php" class="text-sm text-purple-600 hover:text-purple-800">
                                <i class="fas fa-backpack"></i> 查看背包
                            </a>
                        ` : ''}
                        <button onclick="openReviewModal('${order.product_id}', '${escapeHtml(order.product_name)}')" class="text-sm text-blue-600 hover:text-blue-800">
                            <i class="fas fa-star"></i> 评价商品
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 按分类筛选
function filterByCategory(category) {
    currentCategoryFilter = category;
    
    // 更新按钮状态
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 筛选订单
    const filtered = category ? allOrders.filter(order => order.category === category) : allOrders;
    displayOrders(filtered);
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
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
    const container = document.getElementById('orders-container');
    container.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-exclamation-circle text-6xl text-red-400 mb-4"></i>
            <p class="text-gray-600 text-lg">${message}</p>
        </div>
    `;
}

// 评价相关变量
let currentReviewProductId = '';
let currentRating = 0;

// 打开评价弹窗
function openReviewModal(productId, productName) {
    currentReviewProductId = productId;
    currentRating = 0;
    
    document.getElementById('review-product-name').textContent = productName;
    document.getElementById('review-content').value = '';
    document.getElementById('rating-text').textContent = '';
    
    // 重置星星
    document.querySelectorAll('#star-rating i').forEach(star => {
        star.classList.remove('text-yellow-400');
        star.classList.add('text-gray-300');
    });
    
    const modal = document.getElementById('review-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// 关闭评价弹窗
function closeReviewModal(event) {
    if (event && event.target.id !== 'review-modal') return;
    const modal = document.getElementById('review-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// 星星评分交互
document.addEventListener('DOMContentLoaded', function() {
    const stars = document.querySelectorAll('#star-rating i');
    const ratingText = document.getElementById('rating-text');
    
    const ratingLabels = ['', '很差', '一般', '还行', '不错', '非常好'];
    
    stars.forEach(star => {
        star.addEventListener('click', function() {
            currentRating = parseInt(this.dataset.rating);
            updateStars(currentRating);
            ratingText.textContent = ratingLabels[currentRating];
        });
        
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.dataset.rating);
            updateStars(rating);
        });
    });
    
    document.getElementById('star-rating').addEventListener('mouseleave', function() {
        updateStars(currentRating);
        ratingText.textContent = currentRating > 0 ? ratingLabels[currentRating] : '';
    });
});

// 更新星星显示
function updateStars(rating) {
    document.querySelectorAll('#star-rating i').forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
            star.classList.add('text-gray-300');
        }
    });
}

// 提交评价
function submitReview() {
    const content = document.getElementById('review-content').value.trim();
    
    if (currentRating === 0) {
        alert('请选择评分');
        return;
    }
    
    if (!content) {
        alert('请填写评价内容');
        return;
    }
    
    fetch('api/reviews.php?action=add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            product_id: currentReviewProductId,
            rating: currentRating,
            content: content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccessToast('评价成功！感谢你的反馈 💕');
            closeReviewModal();
            // 可以选择刷新订单列表
        } else {
            alert(data.message || '评价失败，请重试');
        }
    })
    .catch(error => {
        console.error('提交评价错误:', error);
        alert('评价失败，请重试');
    });
}

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
</script>

<?php require_once 'includes/footer.php'; ?>
