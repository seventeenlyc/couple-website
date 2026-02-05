<?php
/**
 * 商城主页面
 * 显示商品列表、搜索和筛选功能
 */

define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';
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

$pageTitle = '商城';
$additionalStyles = '<link rel="stylesheet" href="assets/css/shop.css">
<style>
    .lazy-img {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
</style>';

// 引入商城助手
require_once 'includes/shop-helper.php';

// 检查是否是特殊日期
$specialDate = checkSpecialDate();
?>

<?php require_once 'includes/header.php'; ?>

<!-- 引入商城特效 -->
<script src="assets/js/shop-effects.js"></script>

<div class="container mx-auto px-4 py-8">
    <?php if ($specialDate['is_special']): ?>
    <!-- 特殊日期横幅 -->
    <div class="mb-6 bg-gradient-to-r from-pink-500 via-red-500 to-pink-500 text-white rounded-lg shadow-lg overflow-hidden animate-pulse">
        <div class="p-6 text-center">
            <div class="flex items-center justify-center mb-2">
                <i class="fas fa-gift text-3xl mr-3"></i>
                <h2 class="text-2xl font-bold">🎉 特殊日期优惠 🎉</h2>
                <i class="fas fa-heart text-3xl ml-3"></i>
            </div>
            <p class="text-xl mb-2">今天是 <span class="font-bold text-yellow-300"><?php echo $specialDate['reason']; ?></span></p>
            <p class="text-3xl font-bold">
                全场商品 <span class="text-yellow-300"><?php echo (int)($specialDate['discount'] * 10); ?>折</span> 优惠！
            </p>
            <p class="text-sm mt-2 opacity-90">💝 用爱心币给 TA 一个惊喜吧 💝</p>
        </div>
    </div>
    <?php endif; ?>
    
    <!-- 页面标题 -->
    <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2" style="color: var(--primary-color);">
            <i class="fas fa-store"></i> 爱心商城
        </h1>
        <p class="text-gray-600">用爱心币兑换心仪的礼物 💕</p>
    </div>
    
    <!-- 搜索和筛选区域 -->
    <div class="card p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <!-- 搜索框 -->
            <div class="md:col-span-2">
                <div class="relative">
                    <input type="text" 
                           id="search-input" 
                           placeholder="搜索商品..." 
                           class="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                </div>
            </div>
            
            <!-- 分类筛选 -->
            <div>
                <select id="category-filter" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="">全部分类</option>
                    <option value="virtual">虚拟商品</option>
                    <option value="physical">实体商品</option>
                </select>
            </div>
            
            <!-- 价格筛选 -->
            <div>
                <select id="price-filter" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="">全部价格</option>
                    <option value="0-100">0-100 💕</option>
                    <option value="101-300">101-300 💕</option>
                    <option value="301-520">301-520 💕</option>
                    <option value="521-9999">521+ 💕</option>
                </select>
            </div>
        </div>
    </div>
    
    <!-- 商品网格 -->
    <div id="products-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <!-- 商品卡片将通过JavaScript动态加载 -->
        <div class="col-span-full text-center py-12">
            <i class="fas fa-spinner fa-spin text-4xl text-pink-500 mb-4"></i>
            <p class="text-gray-600">加载中...</p>
        </div>
    </div>
    
    <!-- 空状态 -->
    <div id="empty-state" class="hidden text-center py-12">
        <i class="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-600 text-lg">没有找到商品</p>
    </div>
</div>

<!-- 商品详情模态框 -->
<div id="product-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" onclick="closeProductModal(event)">
    <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div id="product-modal-content">
            <!-- 内容将通过JavaScript动态加载 -->
        </div>
    </div>
</div>

<script>
let allProducts = [];
let currentFilters = {
    keyword: '',
    category: '',
    minPrice: null,
    maxPrice: null
};

// 页面加载时获取商品
document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
    
    // 搜索输入事件
    document.getElementById('search-input').addEventListener('input', function(e) {
        currentFilters.keyword = e.target.value;
        filterProducts();
    });
    
    // 分类筛选事件
    document.getElementById('category-filter').addEventListener('change', function(e) {
        currentFilters.category = e.target.value;
        filterProducts();
    });
    
    // 价格筛选事件
    document.getElementById('price-filter').addEventListener('change', function(e) {
        const value = e.target.value;
        if (value) {
            const [min, max] = value.split('-');
            currentFilters.minPrice = parseInt(min);
            currentFilters.maxPrice = max === '999' ? 999999 : parseInt(max);
        } else {
            currentFilters.minPrice = null;
            currentFilters.maxPrice = null;
        }
        filterProducts();
    });
});

// 加载商品
function loadProducts() {
    fetch('api/shop.php?action=get_all')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allProducts = data.products;
                displayProducts(allProducts);
            } else {
                showError('加载商品失败');
            }
        })
        .catch(error => {
            console.error('加载商品错误:', error);
            showError('加载商品失败，请刷新页面重试');
        });
}

// 筛选商品
function filterProducts() {
    let filtered = allProducts;
    
    // 关键词搜索
    if (currentFilters.keyword) {
        const keyword = currentFilters.keyword.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(keyword) || 
            p.description.toLowerCase().includes(keyword)
        );
    }
    
    // 分类筛选
    if (currentFilters.category) {
        filtered = filtered.filter(p => p.category === currentFilters.category);
    }
    
    // 价格筛选
    if (currentFilters.minPrice !== null && currentFilters.maxPrice !== null) {
        filtered = filtered.filter(p => 
            p.price >= currentFilters.minPrice && p.price <= currentFilters.maxPrice
        );
    }
    
    displayProducts(filtered);
}

// 显示商品
function displayProducts(products) {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (products.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    grid.innerHTML = products.map(product => `
        <div class="card overflow-hidden cursor-pointer transform transition-all hover:scale-105" onclick="showProductDetails('${product.id}')">
            <div class="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center overflow-hidden">
                ${product.image ? `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==" data-src="${product.image}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover lazy-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fas ${product.category === 'virtual' ? 'fa-gift' : 'fa-box'} text-6xl text-pink-400" style="display:none;"></i>` : `<i class="fas ${product.category === 'virtual' ? 'fa-gift' : 'fa-box'} text-6xl text-pink-400"></i>`}
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg mb-2 truncate">${escapeHtml(product.name)}</h3>
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${escapeHtml(product.description)}</p>
                <div class="flex items-center justify-between">
                    <div class="flex flex-col">
                        ${product.price_info && product.price_info.is_special ? `
                            <div class="flex items-center gap-2">
                                <span class="text-pink-600 font-bold text-xl">
                                    <i class="fas fa-heart"></i> ${product.price_info.final_price}
                                </span>
                                <span class="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                                    ${product.price_info.discount_percent/10}折
                                </span>
                            </div>
                            <span class="text-gray-400 text-sm line-through">
                                原价 ${product.price_info.original_price}
                            </span>
                        ` : `
                            <span class="text-pink-600 font-bold text-xl">
                                <i class="fas fa-heart"></i> ${product.price}
                            </span>
                        `}
                    </div>
                    <span class="text-xs text-gray-500">
                        ${product.category === 'virtual' ? '虚拟' : '实体'}
                    </span>
                </div>
                ${product.stock > 0 ? `
                    <div class="mt-3 flex items-center justify-between text-sm">
                        <span class="text-gray-500">
                            <i class="fas fa-star text-yellow-400"></i> ${product.rating || 0}
                            ${product.review_count > 0 ? `(${product.review_count})` : ''}
                        </span>
                        <span class="text-gray-500">库存: ${product.stock}</span>
                    </div>
                ` : `
                    <div class="mt-3 text-center text-red-500 font-semibold">
                        <i class="fas fa-times-circle"></i> 已售罄
                    </div>
                `}
            </div>
        </div>
    `).join('');
    
    // 初始化懒加载
    initLazyLoad();
}

// 懒加载初始化
function initLazyLoad() {
    const lazyImages = document.querySelectorAll('.lazy-img');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-img');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '100px'
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        // 降级处理：直接加载所有图片
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy-img');
        });
    }
}

// 显示商品详情
function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('product-modal-content');
    
    content.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold" style="color: var(--primary-color);">
                    ${escapeHtml(product.name)}
                </h2>
                <button onclick="closeProductModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="aspect-video bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                ${product.image ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fas ${product.category === 'virtual' ? 'fa-gift' : 'fa-box'} text-8xl text-pink-400" style="display:none;"></i>` : `<i class="fas ${product.category === 'virtual' ? 'fa-gift' : 'fa-box'} text-8xl text-pink-400"></i>`}
            </div>
            
            <div class="mb-4">
                <span class="inline-block px-3 py-1 rounded-full text-sm ${product.category === 'virtual' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}">
                    <i class="fas ${product.category === 'virtual' ? 'fa-cloud' : 'fa-box'}"></i>
                    ${product.category === 'virtual' ? '虚拟商品' : '实体商品'}
                </span>
            </div>
            
            <p class="text-gray-700 mb-4">${escapeHtml(product.description)}</p>
            
            <div class="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                    ${product.price_info && product.price_info.is_special ? `
                        <div class="mb-2">
                            <span class="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                                <i class="fas fa-gift"></i> ${product.price_info.reason} 特惠
                            </span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-3xl font-bold text-pink-600">
                                <i class="fas fa-heart"></i> ${product.price_info.final_price}
                            </div>
                            <div class="text-lg text-gray-400 line-through">
                                ${product.price_info.original_price}
                            </div>
                            <div class="text-lg font-bold text-red-500">
                                省${product.price_info.saved}币
                            </div>
                        </div>
                    ` : `
                        <div class="text-3xl font-bold text-pink-600">
                            <i class="fas fa-heart"></i> ${product.price}
                        </div>
                    `}
                    <div class="text-sm text-gray-500 mt-1">
                        库存: ${product.stock} 件 | 已售: ${product.sales} 件
                    </div>
                </div>
                <div class="text-right">
                    <div class="flex items-center">
                        <i class="fas fa-star text-yellow-400"></i>
                        <span class="ml-1 font-semibold">${product.rating || 0}</span>
                    </div>
                    <div class="text-sm text-gray-500">
                        ${product.review_count} 条评价
                    </div>
                </div>
            </div>
            
            ${product.stock > 0 ? `
                <button onclick="purchaseProduct('${product.id}')" class="w-full btn-primary py-3 text-lg">
                    <i class="fas fa-shopping-cart"></i> 立即购买
                </button>
            ` : `
                <button disabled class="w-full py-3 text-lg bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed">
                    <i class="fas fa-times-circle"></i> 已售罄
                </button>
            `}
            
            <div class="mt-6">
                <h3 class="font-bold text-lg mb-3">
                    <i class="fas fa-comments"></i> 用户评价
                </h3>
                <div id="reviews-container">
                    <div class="text-center py-4 text-gray-500">
                        <i class="fas fa-spinner fa-spin"></i> 加载评价中...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // 加载评价
    loadReviews(productId);
}

// 加载评价
function loadReviews(productId) {
    fetch(`api/reviews.php?action=get_product_reviews&product_id=${productId}`)
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('reviews-container');
            if (data.success && data.reviews.length > 0) {
                container.innerHTML = data.reviews.map(review => `
                    <div class="border-b pb-3 mb-3 last:border-b-0">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-semibold">${escapeHtml(review.user_name)}</span>
                            <div class="flex items-center">
                                ${Array(5).fill(0).map((_, i) => `
                                    <i class="fas fa-star ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}"></i>
                                `).join('')}
                            </div>
                        </div>
                        <p class="text-gray-700 text-sm">${escapeHtml(review.content)}</p>
                        <p class="text-xs text-gray-500 mt-1">${review.created_at}</p>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-center text-gray-500 py-4">暂无评价</p>';
            }
        })
        .catch(error => {
            console.error('加载评价错误:', error);
            document.getElementById('reviews-container').innerHTML = '<p class="text-center text-red-500 py-4">加载评价失败</p>';
        });
}

// 购买商品
function purchaseProduct(productId) {
    // 获取商品信息
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    // 创建确认弹窗
    const confirmModal = document.createElement('div');
    confirmModal.id = 'purchase-confirm-modal';
    confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    confirmModal.onclick = function(e) {
        if (e.target === confirmModal) {
            confirmModal.remove();
        }
    };
    
    confirmModal.innerHTML = `
        <div class="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
            <div class="p-6">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-2xl font-bold" style="color: var(--primary-color);">
                        <i class="fas fa-shopping-cart"></i> 确认购买
                    </h2>
                    <button onclick="document.getElementById('purchase-confirm-modal').remove()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                
                <div class="text-center mb-6">
                    <div class="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center overflow-hidden">
                        ${product.image ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <i class="fas ${product.category === 'virtual' ? 'fa-gift' : 'fa-box'} text-6xl text-pink-500" style="display:none;"></i>` : `<i class="fas ${product.category === 'virtual' ? 'fa-gift' : 'fa-box'} text-6xl text-pink-500"></i>`}
                    </div>
                    <h3 class="text-xl font-semibold mb-2">${escapeHtml(product.name)}</h3>
                    <p class="text-gray-600 mb-2">确定要购买这件商品吗？</p>
                    <div class="text-3xl font-bold text-pink-600 mt-4">
                        <i class="fas fa-heart"></i> ${product.price}
                    </div>
                </div>
                
                <div class="flex space-x-3">
                    <button onclick="document.getElementById('purchase-confirm-modal').remove()" class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                        <i class="fas fa-times"></i> 取消
                    </button>
                    <button onclick="confirmPurchase('${productId}')" class="flex-1 px-4 py-3 btn-primary">
                        <i class="fas fa-check"></i> 确认购买
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(confirmModal);
}

// 确认购买
function confirmPurchase(productId) {
    // 移除确认弹窗
    const confirmModal = document.getElementById('purchase-confirm-modal');
    if (confirmModal) confirmModal.remove();
    
    fetch('api/shop.php?action=purchase', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product_id: productId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 显示成功消息
            showSuccessToast('购买成功！💕');
            closeProductModal();
            loadProducts(); // 重新加载商品列表
            // 刷新页面以更新余额
            setTimeout(() => window.location.reload(), 1000);
        } else {
            alert(data.message || '购买失败');
        }
    })
    .catch(error => {
        console.error('购买错误:', error);
        alert('购买失败，请重试');
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

// 关闭模态框
function closeProductModal(event) {
    if (event && event.target.id !== 'product-modal') return;
    const modal = document.getElementById('product-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示错误
function showError(message) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = `
        <div class="col-span-full text-center py-12">
            <i class="fas fa-exclamation-circle text-6xl text-red-400 mb-4"></i>
            <p class="text-gray-600 text-lg">${message}</p>
        </div>
    `;
}
</script>

<?php require_once 'includes/footer.php'; ?>
