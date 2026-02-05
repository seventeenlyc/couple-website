<?php
/**
 * 我的虚拟商品页面
 * 显示用户拥有的虚拟商品及使用状态
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
$pageTitle = '我的背包';
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
            <i class="fas fa-backpack"></i> 我的背包
        </h1>
        <p class="text-gray-600">查看和使用你购买的虚拟商品</p>
    </div>
    
    <!-- 状态筛选 -->
    <div class="card p-4 mb-6">
        <div class="flex flex-wrap items-center gap-4">
            <span class="text-sm text-gray-600">状态:</span>
            <button onclick="filterByStatus('')" class="status-filter-btn active px-4 py-2 rounded-lg transition-colors" data-status="">
                全部
            </button>
            <button onclick="filterByStatus('unused')" class="status-filter-btn px-4 py-2 rounded-lg transition-colors" data-status="unused">
                <i class="fas fa-circle text-green-500"></i> 未使用
            </button>
            <button onclick="filterByStatus('pending')" class="status-filter-btn px-4 py-2 rounded-lg transition-colors" data-status="pending">
                <i class="fas fa-clock text-yellow-500"></i> 待确认
            </button>
            <button onclick="filterByStatus('used')" class="status-filter-btn px-4 py-2 rounded-lg transition-colors" data-status="used">
                <i class="fas fa-check-circle text-gray-500"></i> 已使用
            </button>
        </div>
    </div>
    
    <!-- 虚拟商品列表 -->
    <div id="items-container">
        <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-4xl text-purple-500 mb-4"></i>
            <p class="text-gray-600">加载中...</p>
        </div>
    </div>
    
    <!-- 空状态 -->
    <div id="empty-state" class="hidden text-center py-12">
        <i class="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-600 text-lg">背包空空如也</p>
        <p class="text-sm text-gray-500 mt-2">去商城看看有什么好东西吧！</p>
        <a href="shop.php" class="inline-block mt-4 btn-primary px-6 py-2">
            <i class="fas fa-store"></i> 前往商城
        </a>
    </div>
</div>

<!-- 使用商品确认弹窗 -->
<div id="use-item-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" onclick="closeUseModal(event)">
    <div class="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div id="use-modal-content">
            <!-- 内容将通过JavaScript动态加载 -->
        </div>
    </div>
</div>

<style>
.status-filter-btn {
    background-color: #f3f4f6;
    color: #6b7280;
}

.status-filter-btn.active {
    background-color: var(--primary-color);
    color: white;
}

.status-filter-btn:hover:not(.active) {
    background-color: #e5e7eb;
}

.item-card {
    transition: all 0.3s ease;
}

.item-card:hover {
    transform: translateY(-4px);
}

@keyframes fade-in {
    from {
        opacity: 0;
        transform: translate(-50%, -20px);
    }
    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}

@keyframes fade-out {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
}

.animate-fade-in {
    animation: fade-in 0.3s ease-out;
}

.animate-fade-out {
    animation: fade-out 0.3s ease-out;
}
</style>

<script>
let allItems = [];
let currentStatusFilter = '';

// 页面加载时获取虚拟商品
document.addEventListener('DOMContentLoaded', function() {
    loadItems();
});

// 加载虚拟商品
function loadItems() {
    fetch('api/virtual-items.php?action=get_my_items')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allItems = data.items;
                displayItems(allItems);
            } else {
                showError('加载失败');
            }
        })
        .catch(error => {
            console.error('加载虚拟商品错误:', error);
            showError('加载失败，请刷新页面重试');
        });
}

// 显示虚拟商品
function displayItems(items) {
    const container = document.getElementById('items-container');
    const emptyState = document.getElementById('empty-state');
    
    if (items.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${items.map(item => createItemCard(item)).join('')}
        </div>
    `;
}

// 创建商品卡片
function createItemCard(item) {
    let statusBadge = '';
    let actionButton = '';
    let cardClass = 'card overflow-hidden item-card cursor-pointer hover:shadow-lg transition-shadow';
    
    switch (item.status) {
        case 'unused':
            statusBadge = '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"><i class="fas fa-circle"></i> 可使用</span>';
            actionButton = `
                <button onclick="showUseModal('${item.id}', '${escapeHtml(item.product_name)}')" class="w-full btn-primary py-2">
                    <i class="fas fa-hand-pointer"></i> 使用
                </button>
            `;
            break;
        case 'pending':
            statusBadge = '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm"><i class="fas fa-clock"></i> 待确认</span>';
            actionButton = `
                <div class="text-center text-sm text-gray-600 py-2">
                    <i class="fas fa-hourglass-half"></i> 等待对方确认
                </div>
            `;
            cardClass += ' opacity-75';
            break;
        case 'used':
            statusBadge = '<span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"><i class="fas fa-check-circle"></i> 已使用</span>';
            cardClass += ' opacity-60';
            break;
    }
    
    return `
        <div class="${cardClass}" data-status="${item.status}">
            <div class="aspect-square bg-gradient-to-br from-purple-100 via-pink-100 to-purple-100 flex items-center justify-center relative overflow-hidden">
                <div class="absolute inset-0 bg-white opacity-20"></div>
                <i class="fas fa-gift text-7xl text-purple-500 relative z-10 ${item.status === 'used' ? 'opacity-50' : ''}"></i>
                ${item.status === 'unused' ? '<div class="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>' : ''}
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg mb-2 text-gray-800">${escapeHtml(item.product_name)}</h3>
                <div class="mb-3">
                    ${statusBadge}
                </div>
                <div class="text-xs text-gray-500 mb-3">
                    <p><i class="fas fa-calendar"></i> ${formatDate(item.purchased_at)}</p>
                    ${item.used_at ? `<p class="mt-1"><i class="fas fa-check"></i> ${formatDate(item.used_at)}</p>` : ''}
                </div>
                ${actionButton}
            </div>
        </div>
    `;
}

// 显示使用确认弹窗
function showUseModal(itemId, itemName) {
    const modal = document.getElementById('use-item-modal');
    const content = document.getElementById('use-modal-content');
    
    content.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold" style="color: var(--primary-color);">
                    <i class="fas fa-hand-pointer"></i> 使用虚拟商品
                </h2>
                <button onclick="closeUseModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="text-center mb-6">
                <div class="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                    <i class="fas fa-gift text-6xl text-purple-500"></i>
                </div>
                <h3 class="text-xl font-semibold mb-2">${itemName}</h3>
                <p class="text-gray-600 mb-2">确定要使用这个虚拟商品吗？</p>
                <p class="text-sm text-gray-500">使用后需要对方确认才能生效</p>
            </div>
            
            <div class="flex space-x-3">
                <button onclick="closeUseModal()" class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                    <i class="fas fa-times"></i> 取消
                </button>
                <button onclick="confirmUseItem('${itemId}')" class="flex-1 px-4 py-3 btn-primary">
                    <i class="fas fa-check"></i> 确认使用
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// 关闭使用弹窗
function closeUseModal(event) {
    if (event && event.target.id !== 'use-item-modal') return;
    const modal = document.getElementById('use-item-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// 确认使用虚拟商品
function confirmUseItem(itemId) {
    fetch('api/virtual-items.php?action=use', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ item_id: itemId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeUseModal();
            // 显示成功消息
            showSuccessMessage(data.message);
            // 重新加载商品列表
            setTimeout(() => loadItems(), 1000);
        } else {
            alert(data.message || '使用失败');
        }
    })
    .catch(error => {
        console.error('使用虚拟商品错误:', error);
        alert('使用失败，请重试');
    });
}

// 显示成功消息
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    toast.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 按状态筛选
function filterByStatus(status) {
    currentStatusFilter = status;
    
    // 更新按钮状态
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 筛选商品
    const filtered = status ? allItems.filter(item => item.status === status) : allItems;
    displayItems(filtered);
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
    const container = document.getElementById('items-container');
    container.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-exclamation-circle text-6xl text-red-400 mb-4"></i>
            <p class="text-gray-600 text-lg">${message}</p>
        </div>
    `;
}
</script>

<?php require_once 'includes/footer.php'; ?>
