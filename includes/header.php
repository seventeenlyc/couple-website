<?php
/**
 * 公共头部组件
 * 包含导航栏和页面头部HTML
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/avatar-helper.php';
require_once __DIR__ . '/currency-helper.php';

// 获取当前页面
$currentPage = basename($_SERVER['PHP_SELF'], '.php');

// 获取主题配置
$theme = getThemeConfig();

// 获取当前用户
$currentUser = getCurrentUser();

// 获取用户头像
$avatarUrl = $currentUser ? getUserAvatarUrl($currentUser) : getDefaultAvatarUrl();

// 获取用户余额
$userBalance = 0;
if (isLoggedIn()) {
    $userId = getCurrentUserId();
    $userBalance = getUserBalance($userId);
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($pageTitle) ? $pageTitle . ' - ' : ''; ?>我们的小窝</title>
    
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Font Awesome CDN -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- 自定义CSS -->
    <link rel="stylesheet" href="assets/css/custom.css">
    
    <!-- AI功能专用CSS -->
    <link rel="stylesheet" href="assets/css/ai-features.css">
    
    <!-- 移动端菜单JavaScript - 优先加载 -->
    <script src="assets/js/mobile-menu.js" defer></script>
    
    <!-- 内联样式 -->
    <style>
        :root {
            --primary-color: <?php echo $theme['primaryColor']; ?>;
            --secondary-color: <?php echo $theme['secondaryColor']; ?>;
            --success-color: <?php echo $theme['successColor']; ?>;
            --bg-color: <?php echo $theme['backgroundColor']; ?>;
        }
        
        body {
            background-color: var(--bg-color);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        }
        
        .nav-link {
            transition: all 0.3s ease;
        }
        
        .nav-link:hover {
            transform: translateY(-2px);
        }
        
        .nav-link.active {
            background-color: var(--primary-color);
            color: white;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: box-shadow 0.3s ease;
        }
        
        .card:hover {
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.15);
        }
        
        .btn-primary {
            background-color: var(--primary-color);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        /* 头像样式 */
        .avatar-nav {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--primary-color);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .avatar-nav:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        /* 头像模态框样式 */
        .avatar-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }
        
        .avatar-modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .avatar-modal-content {
            background-color: white;
            padding: 2rem;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        
        .avatar-preview {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            object-fit: cover;
            margin: 0 auto;
            border: 3px solid var(--primary-color);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .file-info {
            font-size: 0.875rem;
            color: #666;
            margin-top: 0.5rem;
        }
        
        .upload-progress {
            display: none;
            margin-top: 1rem;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background-color: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--primary-color);
            transition: width 0.3s ease;
        }
        
        /* 移动端菜单按钮样式 */
        #mobile-menu-button {
            padding: 8px;
            min-width: 44px;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        
        #mobile-menu-button:active {
            background-color: rgba(0, 0, 0, 0.05);
            border-radius: 8px;
        }
        
        /* 移动端头像容器 */
        .md\:hidden {
            display: flex !important;
        }
        
        @media (min-width: 768px) {
            .md\:hidden {
                display: none !important;
            }
        }
        
        /* 响应式：桌面端隐藏移动端菜单按钮 */
        @media (min-width: 768px) {
            #mobile-menu-button {
                display: none !important;
            }
            .desktop-nav {
                display: flex !important;
            }
            #mobile-menu {
                display: none !important;
            }
        }
        
        /* 响应式：移动端隐藏桌面端导航 */
        @media (max-width: 767px) {
            .desktop-nav {
                display: none !important;
            }
        }
        
        /* 移动端菜单动画 */
        #mobile-menu {
            transition: all 0.3s ease-in-out;
            overflow: hidden;
        }
        
        #mobile-menu.hidden {
            max-height: 0 !important;
            display: block !important;
        }
        
        #mobile-menu:not(.hidden) {
            max-height: 500px !important;
            display: block !important;
        }
    </style>
    
    <?php if (isset($additionalStyles)) echo $additionalStyles; ?>
</head>
<body class="min-h-screen">
    <!-- 固定顶部导航栏 -->
    <nav class="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <!-- Logo和标题 -->
                <div class="flex items-center space-x-2">
                    <i class="fas fa-heart text-pink-500 text-2xl"></i>
                    <span class="text-xl font-bold" style="color: var(--primary-color);">我们的小窝</span>
                </div>
                
                <!-- 导航链接和头像 -->
                <?php if (isLoggedIn()): ?>
                <!-- 移动端头像（显示在右上角） -->
                <div class="md:hidden flex items-center space-x-3">
                    <img src="<?php echo htmlspecialchars($avatarUrl); ?>" 
                         alt="<?php echo htmlspecialchars($currentUser); ?>的头像" 
                         class="avatar-nav"
                         onclick="openAvatarModal()"
                         title="点击更改头像">
                    <button id="mobile-menu-button" class="text-gray-700 hover:text-gray-900">
                        <i class="fas fa-bars text-2xl"></i>
                    </button>
                </div>
                
                <div class="desktop-nav items-center space-x-4" style="display: none;">
                    <!-- 导航链接 -->
                    <a href="home.php" class="nav-link px-4 py-2 rounded-lg <?php echo $currentPage === 'home' ? 'active' : 'text-gray-700 hover:bg-gray-100'; ?>">
                        <i class="fas fa-home"></i> 主页
                    </a>
                    <a href="album-fixed.php" class="nav-link px-4 py-2 rounded-lg <?php echo ($currentPage === 'album' || $currentPage === 'album-fixed') ? 'active' : 'text-gray-700 hover:bg-gray-100'; ?>"></a>
                        <i class="fas fa-images"></i> 相册
                    </a>
                    <a href="achievements.php" class="nav-link px-4 py-2 rounded-lg <?php echo $currentPage === 'achievements' ? 'active' : 'text-gray-700 hover:bg-gray-100'; ?>">
                        <i class="fas fa-trophy"></i> 浪漫成就
                    </a>
                    <a href="shop.php" class="nav-link px-4 py-2 rounded-lg <?php echo $currentPage === 'shop' ? 'active' : 'text-gray-700 hover:bg-gray-100'; ?>">
                        <i class="fas fa-store"></i> 商城
                    </a>
                    <a href="my-orders.php" class="nav-link px-4 py-2 rounded-lg <?php echo $currentPage === 'my-orders' ? 'active' : 'text-gray-700 hover:bg-gray-100'; ?>">
                        <i class="fas fa-shopping-bag"></i> 我的订单
                    </a>
                    <a href="private.php" class="nav-link px-4 py-2 rounded-lg <?php echo $currentPage === 'private' ? 'active' : 'text-gray-700 hover:bg-gray-100'; ?>">
                        <i class="fas fa-lock"></i> 隐私空间
                    </a>
                    
                    <!-- 分隔线 -->
                    <div class="h-8 w-px bg-gray-300"></div>
                    
                    <!-- 爱心币余额 -->
                    <a href="transaction-history.php" class="flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-pink-50 transition-colors" title="查看交易历史">
                        <i class="fas fa-heart text-pink-500"></i>
                        <span class="font-semibold text-pink-600"><?php echo $userBalance; ?></span>
                    </a>
                    
                    <!-- 用户名 -->
                    <span class="text-sm text-gray-600">
                        <i class="fas fa-user-circle"></i> <?php echo htmlspecialchars($currentUser); ?>
                    </span>
                    
                    <!-- 头像下拉菜单 -->
                    <div class="relative avatar-dropdown">
                        <img src="<?php echo htmlspecialchars($avatarUrl); ?>" 
                             alt="<?php echo htmlspecialchars($currentUser); ?>的头像" 
                             class="avatar-nav"
                             onclick="toggleAvatarMenu()"
                             title="点击查看菜单">
                        
                        <!-- 下拉菜单 -->
                        <div id="avatar-menu" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                            <a href="my-items.php" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors">
                                <i class="fas fa-backpack text-purple-500"></i> 我的背包
                            </a>
                            <a href="#" onclick="openAvatarModal(); return false;" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors">
                                <i class="fas fa-user-circle text-blue-500"></i> 更改头像
                            </a>
                            <div class="border-t my-1"></div>
                            <a href="api/logout.php" class="block px-4 py-2 text-red-600 hover:bg-red-50 transition-colors">
                                <i class="fas fa-sign-out-alt"></i> 退出登录
                            </a>
                        </div>
                    </div>
                </div>
                <?php endif; ?>
            </div>
        </div>
        
        <!-- 移动端菜单 -->
        <?php if (isLoggedIn()): ?>
        <div id="mobile-menu" class="hidden bg-white border-t">
            <div class="px-2 pt-2 pb-3 space-y-1">
                <a href="home.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'home' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-home"></i> 主页
                </a>
                <a href="album-fixed.php" class="block px-3 py-2 rounded-md <?php echo ($currentPage === 'album' || $currentPage === 'album-fixed') ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>"></a>
                    <i class="fas fa-images"></i> 相册
                </a>
                <a href="achievements.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'achievements' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-trophy"></i> 浪漫成就
                </a>
                <a href="shop.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'shop' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-store"></i> 商城
                </a>
                <a href="my-orders.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'my-orders' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-shopping-bag"></i> 我的订单
                </a>
                <a href="tasks.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'tasks' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-tasks"></i> 任务
                </a>
                <a href="my-items.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'my-items' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-backpack"></i> 我的背包
                </a>
                <a href="private.php" class="block px-3 py-2 rounded-md <?php echo $currentPage === 'private' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'; ?>">
                    <i class="fas fa-lock"></i> 隐私空间
                </a>
                <div class="px-3 py-2 text-pink-600 font-semibold">
                    <i class="fas fa-heart"></i> 爱心币: <?php echo $userBalance; ?>
                </div>
                <a href="api/logout.php" class="block px-3 py-2 rounded-md text-red-600 hover:bg-red-50">
                    <i class="fas fa-sign-out-alt"></i> 退出
                </a>
            </div>
        </div>
        <?php endif; ?>
    </nav>
    
    <!-- 主内容区域 (留出导航栏空间) -->
    <main class="pt-20 pb-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <?php if (isset($pageHeader)): ?>
                <div class="mb-6">
                    <?php echo $pageHeader; ?>
                </div>
            <?php endif; ?>
            
            <!-- 页面内容将在这里插入 -->
            
    <!-- 头像上传模态框 -->
    <?php if (isLoggedIn()): ?>
    <div id="avatar-modal" class="avatar-modal">
        <div class="avatar-modal-content">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold" style="color: var(--primary-color);">
                    <i class="fas fa-user-circle"></i> 上传头像
                </h2>
                <button onclick="closeAvatarModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="text-center mb-4">
                <img id="avatar-preview" 
                     src="<?php echo htmlspecialchars($avatarUrl); ?>" 
                     alt="头像预览" 
                     class="avatar-preview">
            </div>
            
            <div id="file-info" class="file-info text-center mb-4"></div>
            
            <div class="mb-4">
                <label class="block w-full">
                    <input type="file" 
                           id="avatar-input" 
                           accept="image/jpeg,image/png,image/gif"
                           class="hidden"
                           onchange="handleFileSelect(event)">
                    <span class="btn-primary block text-center cursor-pointer">
                        <i class="fas fa-upload"></i> 选择图片
                    </span>
                </label>
                <p class="text-xs text-gray-500 mt-2 text-center">
                    支持 JPG、PNG、GIF 格式，最大 2MB
                </p>
            </div>
            
            <div id="upload-progress" class="upload-progress">
                <div class="progress-bar">
                    <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
                </div>
                <p class="text-sm text-center mt-2" id="progress-text">上传中...</p>
            </div>
            
            <div id="upload-message" class="text-center mb-4"></div>
            
            <div class="flex space-x-4">
                <button id="upload-button" 
                        onclick="uploadAvatar()" 
                        class="btn-primary flex-1"
                        disabled>
                    <i class="fas fa-check"></i> 上传
                </button>
                <button onclick="closeAvatarModal()" 
                        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <i class="fas fa-times"></i> 取消
                </button>
            </div>
        </div>
    </div>
    <?php endif; ?>
    
    <script>
        // 飘字通知函数
        function showFloatingNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = 'floating-notification';
            notification.style.cssText = `
                position: fixed;
                top: -100px;
                left: 50%;
                transform: translateX(-50%);
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 9999;
                font-size: 16px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: all 0.4s ease-out;
                opacity: 0;
            `;
            
            if (type === 'success') {
                notification.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                notification.style.color = 'white';
                notification.innerHTML = '<i class="fas fa-check-circle"></i><span>' + message + '</span>';
            } else if (type === 'error') {
                notification.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                notification.style.color = 'white';
                notification.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>' + message + '</span>';
            } else if (type === 'info') {
                notification.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                notification.style.color = 'white';
                notification.innerHTML = '<i class="fas fa-info-circle"></i><span>' + message + '</span>';
            }
            
            document.body.appendChild(notification);
            
            // 滑入动画
            setTimeout(() => {
                notification.style.top = '20px';
                notification.style.opacity = '1';
            }, 10);
            
            // 2.5秒后开始滑出
            setTimeout(() => {
                notification.style.top = '-100px';
                notification.style.opacity = '0';
            }, 2500);
            
            // 3秒后移除
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
        
        // 移动端菜单功能已移至独立文件 assets/js/mobile-menu.js
        
        // 点击页面其他地方关闭头像菜单
            document.addEventListener('click', function(event) {
                const avatarMenu = document.getElementById('avatar-menu');
                const avatarDropdown = document.querySelector('.avatar-dropdown');
                
                if (avatarMenu && avatarDropdown && !avatarDropdown.contains(event.target)) {
                    avatarMenu.classList.add('hidden');
                }
            });
        });
    </script>
    
    <script>
        // 切换头像下拉菜单 - 全局函数
        function toggleAvatarMenu() {
            const menu = document.getElementById('avatar-menu');
            if (menu) {
                menu.classList.toggle('hidden');
            }
        }
        
        // 检查待确认的物品
        function checkPendingItems() {
            fetch('api/virtual-items.php?action=get_pending_confirmations')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.items && data.items.length > 0) {
                        // 显示第一个待确认的物品
                        showItemConfirmationModal(data.items[0]);
                    }
                })
                .catch(error => {
                    console.error('检查待确认物品错误:', error);
                });
        }
        
        // 显示物品确认弹窗
        function showItemConfirmationModal(item) {
            // 创建弹窗
            const modal = document.createElement('div');
            modal.id = 'item-confirmation-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.onclick = function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            };
            
            modal.innerHTML = `
                <div class="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                    <div class="p-6">
                        <div class="flex justify-between items-start mb-4">
                            <h2 class="text-2xl font-bold" style="color: var(--primary-color);">
                                <i class="fas fa-gift"></i> 物品使用确认
                            </h2>
                            <button onclick="document.getElementById('item-confirmation-modal').remove()" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times text-2xl"></i>
                            </button>
                        </div>
                        
                        <div class="text-center mb-6">
                            <div class="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                                <i class="fas fa-gift text-6xl text-purple-500"></i>
                            </div>
                            <h3 class="text-xl font-semibold mb-2">${escapeHtml(item.product_name)}</h3>
                            <p class="text-gray-600 mb-2">对方想要使用这个虚拟商品</p>
                            <p class="text-sm text-gray-500">是否同意？</p>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="rejectItemUse('${item.id}')" class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                                <i class="fas fa-times"></i> 拒绝
                            </button>
                            <button onclick="confirmItemUse('${item.id}')" class="flex-1 px-4 py-3 btn-primary">
                                <i class="fas fa-check"></i> 同意
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // 确认物品使用
        function confirmItemUse(itemId) {
            fetch('api/virtual-items.php?action=confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ item_id: itemId })
            })
            .then(response => response.json())
            .then(data => {
                const modal = document.getElementById('item-confirmation-modal');
                if (modal) modal.remove();
                
                if (data.success) {
                    showFloatingNotification('已确认使用 ✓', 'success');
                    // 检查是否还有其他待确认的物品
                    setTimeout(checkPendingItems, 500);
                } else {
                    showFloatingNotification(data.message || '确认失败', 'error');
                }
            })
            .catch(error => {
                console.error('确认物品使用错误:', error);
                showFloatingNotification('确认失败，请重试', 'error');
            });
        }
        
        // 拒绝物品使用
        function rejectItemUse(itemId) {
            // TODO: 实现拒绝逻辑
            const modal = document.getElementById('item-confirmation-modal');
            if (modal) modal.remove();
            showFloatingNotification('已拒绝', 'info');
            // 检查是否还有其他待确认的物品
            setTimeout(checkPendingItems, 500);
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // 页面加载时检查待确认的物品
        <?php if (isLoggedIn()): ?>
        setTimeout(checkPendingItems, 1000);
        <?php endif; ?>
        
        // 头像上传相关功能
        let selectedFile = null;
        
        function openAvatarModal() {
            document.getElementById('avatar-modal').classList.add('active');
            // 重置状态
            selectedFile = null;
            document.getElementById('upload-button').disabled = true;
            document.getElementById('file-info').innerHTML = '';
            document.getElementById('upload-message').innerHTML = '';
            document.getElementById('upload-progress').style.display = 'none';
        }
        
        function closeAvatarModal() {
            document.getElementById('avatar-modal').classList.remove('active');
        }
        
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            // 验证文件类型
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                showMessage('只支持 JPG、PNG、GIF 格式的图片', 'error');
                return;
            }
            
            // 验证文件大小 (2MB)
            if (file.size > 2 * 1024 * 1024) {
                showMessage('文件大小不能超过 2MB', 'error');
                return;
            }
            
            selectedFile = file;
            
            // 显示文件信息
            const sizeInKB = (file.size / 1024).toFixed(2);
            document.getElementById('file-info').innerHTML = `
                <i class="fas fa-file-image"></i> ${file.name}<br>
                <span class="text-xs">大小: ${sizeInKB} KB</span>
            `;
            
            // 预览图片
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('avatar-preview').src = e.target.result;
            };
            reader.readAsDataURL(file);
            
            // 启用上传按钮
            document.getElementById('upload-button').disabled = false;
            document.getElementById('upload-message').innerHTML = '';
        }
        
        function uploadAvatar() {
            if (!selectedFile) {
                showMessage('请先选择图片', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('avatar', selectedFile);
            formData.append('csrf_token', '<?php echo generateCSRFToken(); ?>');
            
            // 显示进度条
            document.getElementById('upload-progress').style.display = 'block';
            document.getElementById('upload-button').disabled = true;
            
            fetch('api/upload-avatar.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('upload-progress').style.display = 'none';
                
                if (data.success) {
                    showMessage(data.message, 'success');
                    
                    // 1秒后刷新页面以显示新头像
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    showMessage(data.message || '上传失败', 'error');
                    document.getElementById('upload-button').disabled = false;
                }
            })
            .catch(error => {
                console.error('上传错误:', error);
                document.getElementById('upload-progress').style.display = 'none';
                showMessage('上传失败，请重试', 'error');
                document.getElementById('upload-button').disabled = false;
            });
        }
        
        function showMessage(message, type) {
            const messageDiv = document.getElementById('upload-message');
            const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
            const color = type === 'success' ? 'text-green-600' : 'text-red-600';
            
            messageDiv.innerHTML = `
                <div class="${color}">
                    <i class="fas ${icon}"></i> ${message}
                </div>
            `;
        }
        
        // 点击模态框外部关闭
        document.addEventListener('click', function(event) {
            const modal = document.getElementById('avatar-modal');
            if (event.target === modal) {
                closeAvatarModal();
            }
        });
    </script>
