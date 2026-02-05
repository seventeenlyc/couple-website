<?php
/**
 * 工作版相册页面 - 支持文件夹功能
 */
define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';

// 要求用户登录
requireLogin();

$pageTitle = '我们的相册';
$currentPage = 'album';
$currentUser = getCurrentUser();

// 获取当前文件夹路径
$currentFolder = $_GET['folder'] ?? '';

// 调试当前文件夹值
error_log('当前文件夹原始值: "' . $currentFolder . '"');
error_log('当前文件夹长度: ' . strlen($currentFolder));
error_log('当前文件夹是否为空: ' . (empty($currentFolder) ? 'true' : 'false'));

// 获取相册数据
$albumFile = 'data/album.json';
$albumData = ['folders' => [], 'photos' => []];

if (file_exists($albumFile)) {
    $content = file_get_contents($albumFile);
    if ($content) {
        $decoded = json_decode($content, true);
        if ($decoded) {
            $albumData = $decoded;
        }
    }
}

// 确保数据结构完整
if (!isset($albumData['photos'])) {
    $albumData['photos'] = [];
}
if (!isset($albumData['folders'])) {
    $albumData['folders'] = [];
}

// 简单的文件夹内容获取函数
function getFolderContents($data, $path = '') {
    $result = ['folders' => [], 'files' => []];
    
    // 获取子文件夹
    foreach ($data['folders'] as $folder) {
        if (($folder['parent_path'] ?? '') === $path) {
            $result['folders'][] = $folder;
        }
    }
    
    // 获取文件 - 如果是根目录，显示所有folder_path为空的照片
    if (empty($path)) {
        // 根目录：显示所有folder_path为空或不存在的照片
        foreach ($data['photos'] as $photo) {
            if (empty($photo['folder_path'] ?? '')) {
                $result['files'][] = $photo;
            }
        }
    } else {
        // 子文件夹：精确匹配
        foreach ($data['photos'] as $photo) {
            if (($photo['folder_path'] ?? '') === $path) {
                $result['files'][] = $photo;
            }
        }
    }
    
    return $result;
}

// 简单的面包屑生成函数
function generateBreadcrumbs($path) {
    $breadcrumbs = [['name' => '根目录', 'path' => '']];
    
    if (!empty($path)) {
        $parts = explode('/', $path);
        $currentPath = '';
        
        foreach ($parts as $part) {
            if (!empty($part)) {
                $currentPath .= ($currentPath === '' ? '' : '/') . $part;
                $breadcrumbs[] = ['name' => $part, 'path' => $currentPath];
            }
        }
    }
    
    return $breadcrumbs;
}

// 获取当前文件夹内容
$folderContents = getFolderContents($albumData, $currentFolder);
$breadcrumbs = generateBreadcrumbs($currentFolder);

// 调试信息
error_log('当前文件夹: ' . $currentFolder);
error_log('相册数据照片数量: ' . count($albumData['photos']));
error_log('过滤后照片数量: ' . count($folderContents['files']));
if (!empty($folderContents['files'])) {
    error_log('第一张照片数据: ' . print_r($folderContents['files'][0], true));
}

// 处理消息
$uploadMessage = '';
$messageType = '';
if (isset($_SESSION['flash_message'])) {
    $uploadMessage = $_SESSION['flash_message']['message'];
    $messageType = $_SESSION['flash_message']['type'];
    unset($_SESSION['flash_message']);
}

$csrf_token = generateCSRFToken();

// 自定义样式
$additionalStyles = '
<meta name="csrf-token" content="' . $csrf_token . '">
<style>
    .card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        padding: 24px;
        margin-bottom: 24px;
    }
    
    /* 移动端触摸优化 */
    @media (max-width: 767px) {
        .photo-card img {
            -webkit-tap-highlight-color: transparent;
        }
    }
</style>
';

include 'includes/header.php';
?>

    <div class="max-w-6xl mx-auto p-4">
        <!-- 标题 -->
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-gray-800 mb-4">
                
                我们的相册
                
            </h1>
            <p class="text-xl text-gray-600">
                记录我们的美好时光 <br> 共有 <span class="font-bold"><?php echo count($albumData['photos']); ?></span> 张照片
            </p>
        </div>

        <!-- 面包屑导航 -->
        <?php if (!empty($currentFolder) || !empty($folderContents['folders'])): ?>
        <nav class="flex items-center space-x-2 text-sm mb-4 p-3 bg-white rounded-lg shadow">
            <i class="fas fa-folder-open text-blue-500"></i>
            <?php foreach ($breadcrumbs as $index => $crumb): ?>
                <?php $isLast = ($index === count($breadcrumbs) - 1); ?>
                <?php if ($isLast): ?>
                    <span class="text-gray-800 font-semibold"><?php echo htmlspecialchars($crumb['name']); ?></span>
                <?php else: ?>
                    <a href="?folder=<?php echo urlencode($crumb['path']); ?>" class="text-blue-600 hover:text-blue-800 hover:underline">
                        <?php echo htmlspecialchars($crumb['name']); ?>
                    </a>
                    <i class="fas fa-chevron-right text-gray-400 text-xs"></i>
                <?php endif; ?>
            <?php endforeach; ?>
        </nav>
        <?php endif; ?>

        <!-- 文件夹工具栏 -->
        <div class="card">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex items-center gap-4">
                    <h2 class="text-xl font-semibold text-gray-800">
                        <i class="fas fa-folder-open text-yellow-500 mr-2"></i>
                        <?php echo empty($currentFolder) ? '根目录' : basename($currentFolder); ?>
                    </h2>
                    <div class="text-sm text-gray-600">
                        <span><i class="fas fa-folder mr-1"></i><?php echo count($folderContents['folders']); ?> 个文件夹</span>
                        <span class="ml-4"><i class="fas fa-image mr-1"></i><?php echo count($folderContents['files']); ?> 张照片</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button id="createFolderBtn" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                        <i class="fas fa-folder-plus mr-2"></i>新建文件夹
                    </button>
                </div>
            </div>
            
            <!-- 标签筛选 -->
            <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex flex-col md:flex-row gap-3 items-start md:items-center">
                    <div class="flex items-center gap-2 flex-1">
                        <i class="fas fa-filter text-purple-500"></i>
                        <input type="text" id="tagFilterInput" placeholder="输入标签筛选照片，如：约会" 
                               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <button id="tagFilterBtn" class="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors">
                            <i class="fas fa-search mr-1"></i>筛选
                        </button>
                        <button id="clearFilterBtn" class="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors hidden">
                            <i class="fas fa-times mr-1"></i>清除
                        </button>
                    </div>
                    <div id="filterStatus" class="text-sm text-gray-600 hidden">
                        <span class="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            筛选: <span id="filterTagName"></span> (<span id="filterCount">0</span> 张)
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 飘字通知 -->
        <?php if ($uploadMessage): ?>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            showFloatingNotification('<?php echo addslashes($uploadMessage); ?>', '<?php echo $messageType; ?>');
        });
        </script>
        <?php endif; ?>

        <!-- 上传区域 -->
        <div class="card">
            <h2 class="text-2xl font-semibold text-gray-800 mb-4">
                <i class="fas fa-cloud-upload-alt text-blue-500 mr-2"></i>上传新照片
            </h2>
            
            <!-- 多照片上传区域 -->
            <div id="multiUploadArea" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 transition-colors hover:border-blue-400 hover:bg-blue-50 cursor-pointer">
                <div id="uploadPrompt">
                    <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                    <p class="text-lg text-gray-600 mb-2">选择照片或拖拽到此处</p>
                    <p class="text-sm text-gray-500 mb-4">支持多张照片同时上传 • JPG、PNG、GIF • 最大 10MB/张</p>
                    
                    <div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <button type="button" id="selectPhotosBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                            <i class="fas fa-images mr-2"></i>从相册选择
                        </button>
                        
                    </div>
                </div>
                
                <!-- 隐藏的文件输入 -->
                <input type="file" id="multiPhotoInput" accept="image/*" multiple style="display: none;">
                <input type="file" id="cameraInput" accept="image/*" capture="environment" multiple style="display: none;">
            </div>
            
            <!-- 照片预览区域 -->
            <div id="photoPreviewArea" class="hidden">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">
                    <i class="fas fa-eye mr-2"></i>照片预览 (<span id="photoCount">0</span>)
                </h3>
                <div id="photoPreviewGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    <!-- 预览照片将在这里动态添加 -->
                </div>
                
                <!-- 批量操作 -->
                <div class="flex flex-col md:flex-row gap-4 mb-4">
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-tags mr-2 text-pink-500"></i>批量标签 (用逗号分隔)
                        </label>
                        <input type="text" id="batchTags" placeholder="旅行, 约会, 纪念日" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-folder mr-2 text-yellow-500"></i>上传到文件夹
                        </label>
                        <select id="folderSelect" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">根目录</option>
                            <?php foreach ($albumData['folders'] as $folder): ?>
                            <option value="<?php echo htmlspecialchars($folder['path']); ?>" <?php echo $folder['path'] === $currentFolder ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($folder['path']); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="flex gap-2 items-end">
                        <button type="button" id="clearAllBtn" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                            <i class="fas fa-trash mr-2"></i>清空
                        </button>
                        <button type="button" id="uploadAllBtn" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors opacity-50 cursor-not-allowed" disabled>
                            <i class="fas fa-upload mr-2"></i>上传全部
                        </button>
                    </div>
                </div>
                
                <!-- 上传进度 -->
                <div id="uploadProgress" class="hidden">
                    <div class="bg-gray-200 rounded-full h-2 mb-2">
                        <div id="progressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p id="progressText" class="text-sm text-gray-600 text-center">准备上传...</p>
                </div>
            </div>
        </div>

        <!-- 文件夹和照片展示区域 -->
        <div class="card" id="photoDisplayCard">
            <!-- 文件夹列表 -->
            <?php if (!empty($folderContents['folders'])): ?>
            <div class="mb-8">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                    <i class="fas fa-folder text-yellow-500 mr-2"></i>文件夹
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <?php foreach ($folderContents['folders'] as $folder): ?>
                    <div class="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group">
                        <a href="?folder=<?php echo urlencode($folder['path']); ?>" class="block">
                            <div class="text-center mb-3">
                                <i class="fas fa-folder text-6xl text-yellow-500 group-hover:text-yellow-600 transition-colors"></i>
                            </div>
                            <h3 class="text-center font-semibold text-gray-800 mb-1 truncate" title="<?php echo htmlspecialchars($folder['name']); ?>">
                                <?php echo htmlspecialchars($folder['name']); ?>
                            </h3>
                            <?php if (isset($folder['created_at'])): ?>
                            <p class="text-xs text-gray-500 text-center"><?php echo date('Y-m-d', strtotime($folder['created_at'])); ?></p>
                            <?php endif; ?>
                        </a>
                        
                        <!-- 文件夹操作按钮 -->
                        <div class="mt-3 pt-3 border-t border-gray-200 flex justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onclick="event.preventDefault(); showRenameModal('<?php echo htmlspecialchars($folder['path']); ?>', '<?php echo htmlspecialchars($folder['name']); ?>')"
                                class="text-blue-600 hover:text-blue-800 text-sm"
                                title="重命名"
                            >
                                <i class="fas fa-edit"></i>
                            </button>
                            <button 
                                onclick="event.preventDefault(); showDeleteConfirm('<?php echo htmlspecialchars($folder['path']); ?>', '<?php echo htmlspecialchars($folder['name']); ?>')"
                                class="text-red-600 hover:text-red-800 text-sm"
                                title="删除"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>

            <!-- 照片列表 -->
            <h2 class="text-xl font-semibold text-gray-800 mb-4">
                <i class="fas fa-images text-blue-500 mr-2"></i>照片
            </h2>
            
            <?php if (empty($folderContents['files'])): ?>
            <div class="text-center py-8">
                <div class="text-6xl mb-4">📷</div>
                <h3 class="text-2xl font-semibold text-gray-800 mb-2">
                    <?php echo empty($currentFolder) ? '还没有照片' : '此文件夹为空'; ?>
                </h3>
                <p class="text-gray-600 mb-4">上传照片开始使用相册</p>
            </div>
            <?php else: ?>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <?php 
                $photoIndex = 0;
                $reversedPhotos = array_reverse($folderContents['files']);
                foreach ($reversedPhotos as $photo): 
                    $photoId = $photo['id'] ?? '';
                    if (empty($photoId)) {
                        continue;
                    }
                    // 获取缩略图路径，如果没有则使用原图
                    $displayPath = !empty($photo['thumb_path']) && file_exists($photo['thumb_path']) 
                        ? $photo['thumb_path'] 
                        : $photo['path'];
                ?>
                <div class="bg-gray-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group photo-card">
                    <div class="relative">
                        <img src="<?php echo htmlspecialchars($displayPath); ?>" 
                             alt="<?php echo htmlspecialchars($photo['title'] ?? '照片'); ?>"
                             class="w-full h-64 object-cover cursor-pointer"
                             onclick="openPhotoModal('<?php echo $photoId; ?>')"
                             title="照片ID: <?php echo htmlspecialchars($photo['id'] ?? 'NO_ID'); ?> | 路径: <?php echo htmlspecialchars($photo['path']); ?>">
                        
                        <!-- 桌面端操作按钮 - 简单悬停样式 -->
                        <div class="hidden md:block absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button 
                                    onclick="event.stopPropagation(); openPhotoModal('<?php echo $photoId; ?>')"
                                    class="bg-white text-gray-800 px-4 py-2 rounded-lg mr-2 hover:bg-gray-100 transition-colors"
                                >
                                    <i class="fas fa-eye mr-1"></i>查看
                                </button>
                                <button 
                                    onclick="event.stopPropagation(); testDelete('<?php echo $photoId; ?>')"
                                    class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors delete-btn"
                                    data-id="<?php echo $photoId; ?>"
                                >
                                    <i class="fas fa-trash mr-1"></i>删除
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-4">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">
                            <?php echo htmlspecialchars($photo['title'] ?? '无标题'); ?>
                        </h3>
                        <?php if (isset($photo['description']) && $photo['description']): ?>
                        <p class="text-gray-600 text-sm mb-3">
                            <?php echo htmlspecialchars($photo['description']); ?>
                        </p>
                        <?php endif; ?>
                        
                        <!-- 标签 -->
                        <?php if (isset($photo['tags']) && !empty($photo['tags'])): ?>
                        <div class="mb-3">
                            <?php foreach ($photo['tags'] as $tag): ?>
                            <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
                                #<?php echo htmlspecialchars($tag); ?>
                            </span>
                            <?php endforeach; ?>
                        </div>
                        <?php endif; ?>
                        
                        <!-- 上传信息和操作按钮 -->
                        <div class="flex justify-between items-center">
                            <div class="text-xs text-gray-500">
                                <div>
                                    <i class="fas fa-user mr-1"></i><?php echo htmlspecialchars($photo['uploaded_by'] ?? '未知'); ?>
                                </div>
                                <div>
                                    <i class="fas fa-clock mr-1"></i><?php echo isset($photo['uploaded_at']) ? date('m-d H:i', strtotime($photo['uploaded_at'])) : ''; ?>
                                </div>
                            </div>
                            <!-- 移动端操作按钮 -->
                            <div class="md:hidden flex space-x-3">
                                <button 
                                    onclick="showMovePhotoModal('<?php echo htmlspecialchars($photo['id']); ?>', '<?php echo htmlspecialchars($photo['title'] ?? '此照片'); ?>')"
                                    class="text-green-600 hover:text-green-800 p-2"
                                    title="移动照片"
                                >
                                    <i class="fas fa-arrows-alt text-lg"></i>
                                </button>
                                <button 
                                    onclick="testDelete('<?php echo $photoId; ?>')"
                                    class="text-red-500 hover:text-red-700 p-2"
                                    title="删除照片"
                                >
                                    <i class="fas fa-trash text-lg"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <?php 
                $photoIndex++;
                endforeach; 
                ?>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- 创建文件夹模态框 -->
    <div id="createFolderModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg max-w-md w-full" onclick="event.stopPropagation()">
            <div class="p-6 border-b flex justify-between items-center">
                <h3 class="text-xl font-semibold text-gray-800">
                    <i class="fas fa-folder-plus text-blue-500 mr-2"></i>
                    创建新文件夹
                </h3>
                <button onclick="closeModal('createFolderModal')" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="createFolderForm" class="p-6">
                <div class="mb-4">
                    <label for="folderName" class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-tag mr-2 text-pink-500"></i>文件夹名称 *
                    </label>
                    <input 
                        type="text" 
                        id="folderName" 
                        name="folderName" 
                        placeholder="输入文件夹名称"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        maxlength="255"
                    >
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button 
                        type="button" 
                        onclick="closeModal('createFolderModal')"
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        <i class="fas fa-times mr-2"></i>取消
                    </button>
                    <button 
                        type="submit" 
                        class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <i class="fas fa-folder-plus mr-2"></i>创建文件夹
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- 移动照片模态框 -->
    <div id="movePhotoModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg max-w-md w-full" onclick="event.stopPropagation()">
            <div class="p-6 border-b flex justify-between items-center">
                <h3 class="text-xl font-semibold text-gray-800">
                    <i class="fas fa-arrows-alt text-blue-500 mr-2"></i>
                    移动照片
                </h3>
                <button onclick="closeModal('movePhotoModal')" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="p-6">
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-2">
                        移动照片: <span id="movePhotoName" class="font-semibold"></span>
                    </p>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-folder-open mr-2 text-pink-500"></i>选择目标文件夹
                    </label>
                    <select id="targetFolderSelect" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">根目录</option>
                        <?php foreach ($albumData['folders'] as $folder): ?>
                        <option value="<?php echo htmlspecialchars($folder['path']); ?>">
                            <?php echo htmlspecialchars($folder['path']); ?>
                        </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button 
                        type="button" 
                        onclick="closeModal('movePhotoModal')"
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        <i class="fas fa-times mr-2"></i>取消
                    </button>
                    <button 
                        type="button" 
                        onclick="movePhoto()"
                        class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <i class="fas fa-arrows-alt mr-2"></i>移动
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 照片查看模态框 -->
    <div id="photoModal" class="fixed inset-0 bg-black bg-opacity-75 hidden z-50 flex items-center justify-center p-4" onclick="closePhotoModal()">
        <div class="bg-white rounded-lg max-w-4xl max-h-full overflow-auto" onclick="event.stopPropagation()">
            <div class="p-4 border-b flex justify-between items-center">
                <h3 id="modalTitle" class="text-xl font-semibold"></h3>
                <button onclick="closePhotoModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            <div class="p-4">
                <img id="modalImage" src="" alt="照片预览" class="w-full max-h-96 object-contain mb-4">
                <div id="modalDescription" class="text-gray-600 mb-4"></div>
                <div id="modalTags" class="mb-4"></div>
                <div id="modalInfo" class="text-sm text-gray-500 mb-4"></div>
                
                <!-- 照片操作按钮 -->
                <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button 
                        onclick="closePhotoModal(); showMovePhotoModal(currentPhotoId, currentPhotoTitle);"
                        class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <i class="fas fa-arrows-alt mr-2"></i>移动
                    </button>
                    <button 
                        onclick="var pid = currentPhotoId; closePhotoModal(); if(pid) testDelete(pid); else alert('请先选择照片');"
                        class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                        <i class="fas fa-trash mr-2"></i>删除
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 照片数据 - 直接使用PHP过滤后的数据
        const photoData = <?php echo json_encode(array_reverse($folderContents['files']), JSON_UNESCAPED_UNICODE); ?>;
        // 所有照片数据（用于标签筛选，包含所有文件夹）
        const allPhotosData = <?php echo json_encode($albumData['photos'], JSON_UNESCAPED_UNICODE); ?>;
        const currentFolder = '<?php echo addslashes($currentFolder); ?>';
        const csrfToken = '<?php echo $csrf_token; ?>';

        // 标签筛选功能
        let isFiltering = false;
        
        function initTagFilter() {
            const filterInput = document.getElementById('tagFilterInput');
            const filterBtn = document.getElementById('tagFilterBtn');
            const clearBtn = document.getElementById('clearFilterBtn');
            
            filterBtn.addEventListener('click', () => applyTagFilter());
            clearBtn.addEventListener('click', () => clearTagFilter());
            filterInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') applyTagFilter();
            });
        }
        
        function applyTagFilter() {
            const tag = document.getElementById('tagFilterInput').value.trim();
            if (!tag) {
                showFloatingNotification('请输入要筛选的标签', 'error');
                return;
            }
            
            // 从所有照片中筛选包含该标签的照片
            const filteredPhotos = allPhotosData.filter(photo => {
                if (!photo.tags || !Array.isArray(photo.tags)) return false;
                return photo.tags.some(t => t.includes(tag) || tag.includes(t));
            });
            
            if (filteredPhotos.length === 0) {
                showFloatingNotification('没有找到包含该标签的照片', 'info');
                return;
            }
            
            // 显示筛选结果
            isFiltering = true;
            renderFilteredPhotos(filteredPhotos.reverse());
            
            // 更新UI状态
            document.getElementById('clearFilterBtn').classList.remove('hidden');
            document.getElementById('filterStatus').classList.remove('hidden');
            document.getElementById('filterTagName').textContent = tag;
            document.getElementById('filterCount').textContent = filteredPhotos.length;
            
            showFloatingNotification(`找到 ${filteredPhotos.length} 张包含"${tag}"标签的照片`, 'success');
        }
        
        function renderFilteredPhotos(photos) {
            // 找到照片展示区域的card
            const photoCard = document.getElementById('photoDisplayCard');
            if (!photoCard) {
                console.error('找不到照片展示区域');
                return;
            }
            
            // 隐藏文件夹区域（如果有）
            const folderSection = photoCard.querySelector('.mb-8');
            if (folderSection) {
                folderSection.style.display = 'none';
            }
            
            // 隐藏空状态提示
            const emptyState = photoCard.querySelector('.text-center.py-8');
            if (emptyState) {
                emptyState.style.display = 'none';
            }
            
            // 隐藏原有的照片网格
            const existingGrid = photoCard.querySelector('.grid');
            if (existingGrid) {
                existingGrid.style.display = 'none';
            }
            
            // 更新标题
            const photoTitles = photoCard.querySelectorAll('h2');
            const photoTitle = photoTitles[photoTitles.length - 1];
            if (photoTitle) {
                photoTitle.innerHTML = '<i class="fas fa-filter text-purple-500 mr-2"></i>筛选结果 (' + photos.length + ' 张)';
            }
            
            // 移除之前的筛选结果容器
            const oldFilterGrid = document.getElementById('filterResultGrid');
            if (oldFilterGrid) {
                oldFilterGrid.remove();
            }
            
            // 创建新的网格容器
            const container = document.createElement('div');
            container.id = 'filterResultGrid';
            container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4';
            
            // 渲染筛选后的照片
            container.innerHTML = photos.map(photo => {
                const photoId = photo.id || '';
                const displayPath = photo.thumb_path && photo.thumb_path !== '' ? photo.thumb_path : photo.path;
                const tags = photo.tags || [];
                const safeTitle = (photo.title || '').replace(/'/g, "\\'");
                const safePath = (photo.path || '').replace(/'/g, "\\'");
                
                return `
                <div class="bg-gray-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group photo-card">
                    <div class="relative">
                        <img src="${displayPath}" 
                             alt="${escapeHtml(photo.title || '照片')}"
                             class="w-full h-64 object-cover cursor-pointer"
                             onclick="openFilteredPhotoModal('${photoId}', '${safePath}', '${safeTitle}')">
                        <div class="hidden md:block absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button onclick="event.stopPropagation(); openFilteredPhotoModal('${photoId}', '${safePath}', '${safeTitle}')"
                                    class="bg-white text-gray-800 px-4 py-2 rounded-lg mr-2 hover:bg-gray-100 transition-colors">
                                    <i class="fas fa-eye mr-1"></i>查看
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">${escapeHtml(photo.title || '无标题')}</h3>
                        <div class="text-xs text-gray-500 mb-2">
                            <i class="fas fa-folder mr-1"></i>${escapeHtml(photo.folder_path || '根目录')}
                        </div>
                        ${tags.length > 0 ? `
                        <div class="mb-2">
                            ${tags.map(tag => `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">#${escapeHtml(tag)}</span>`).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
                `;
            }).join('');
            
            // 插入到标题后面
            if (photoTitle) {
                photoTitle.after(container);
            } else {
                photoCard.appendChild(container);
            }
            
            console.log('渲染了', photos.length, '张照片');
        }
        
        // 筛选结果的照片查看
        function openFilteredPhotoModal(photoId, photoPath, photoTitle) {
            currentPhotoId = photoId;
            currentPhotoTitle = photoTitle || '照片';
            document.getElementById('modalTitle').textContent = currentPhotoTitle;
            document.getElementById('modalImage').src = photoPath;
            document.getElementById('modalImage').alt = currentPhotoTitle;
            document.getElementById('modalDescription').textContent = '';
            document.getElementById('modalTags').innerHTML = '';
            document.getElementById('modalInfo').innerHTML = '';
            document.getElementById('photoModal').classList.remove('hidden');
        }
        
        function clearTagFilter() {
            isFiltering = false;
            document.getElementById('tagFilterInput').value = '';
            document.getElementById('clearFilterBtn').classList.add('hidden');
            document.getElementById('filterStatus').classList.add('hidden');
            
            // 刷新页面恢复原始状态
            window.location.reload();
        }
        
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // 简单删除函数
        function testDelete(photoId) {
            console.log('删除照片，ID:', photoId);
            
            if (!photoId) {
                alert('照片ID为空');
                return;
            }
            
            // 使用自定义确认弹窗
            showCustomConfirm(
                '确定要删除这张照片吗？',
                '删除后将无法恢复，照片文件也会从服务器中永久删除。',
                function() {
                    const formData = new URLSearchParams();
                    formData.append('action', 'delete');
                    formData.append('photo_id', photoId);
                    formData.append('csrf_token', csrfToken);
                    
                    fetch('./api/photos.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showFloatingNotification('照片删除成功！', 'success');
                            setTimeout(() => location.reload(), 1000);
                        } else {
                            showFloatingNotification('删除失败: ' + data.message, 'error');
                        }
                    })
                    .catch(error => {
                        console.error('错误:', error);
                        showFloatingNotification('请求失败: ' + error.message, 'error');
                    });
                }
            );
        }

        // 多照片上传功能
        class MultiPhotoUploader {
            constructor() {
                this.selectedFiles = [];
                this.initElements();
                this.bindEvents();
            }
            
            initElements() {
                this.uploadArea = document.getElementById('multiUploadArea');
                this.fileInput = document.getElementById('multiPhotoInput');
                this.cameraInput = document.getElementById('cameraInput');
                this.selectBtn = document.getElementById('selectPhotosBtn');
                this.takePhotoBtn = document.getElementById('takePhotoBtn');
                this.previewArea = document.getElementById('photoPreviewArea');
                this.previewGrid = document.getElementById('photoPreviewGrid');
                this.photoCount = document.getElementById('photoCount');
                this.batchTags = document.getElementById('batchTags');
                this.clearAllBtn = document.getElementById('clearAllBtn');
                this.uploadAllBtn = document.getElementById('uploadAllBtn');
                this.uploadProgress = document.getElementById('uploadProgress');
                this.progressBar = document.getElementById('progressBar');
                this.progressText = document.getElementById('progressText');
            }
            
            bindEvents() {
                this.selectBtn.addEventListener('click', () => this.fileInput.click());
                if (this.takePhotoBtn) {
                    this.takePhotoBtn.addEventListener('click', () => this.cameraInput.click());
                }
                
                this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
                if (this.cameraInput) {
                    this.cameraInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
                }
                
                this.clearAllBtn.addEventListener('click', () => this.clearAll());
                this.uploadAllBtn.addEventListener('click', () => this.uploadAll());
            }
            
            handleFileSelect(files) {
                if (!files || files.length === 0) return;
                
                Array.from(files).forEach(file => {
                    if (file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024) {
                        this.addFile(file);
                    }
                });
                
                this.updateUI();
            }
            
            addFile(file) {
                const fileData = {
                    file: file,
                    id: Date.now() + Math.random(),
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    description: ''
                };
                
                this.selectedFiles.push(fileData);
                this.renderPreview(fileData);
            }
            
            renderPreview(fileData) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'relative bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm';
                    previewItem.dataset.fileId = fileData.id;
                    
                    previewItem.innerHTML = `
                        <div class="aspect-square relative">
                            <img src="${e.target.result}" alt="预览" class="w-full h-full object-cover">
                            <button type="button" class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors" onclick="multiUploader.removeFile('${fileData.id}')">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="p-3">
                            <input type="text" placeholder="照片标题" class="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 title-input" value="${fileData.title}">
                            <textarea placeholder="描述..." class="w-full text-xs border border-gray-300 rounded px-2 py-1 resize-none description-input" rows="2">${fileData.description}</textarea>
                        </div>
                    `;
                    
                    const titleInput = previewItem.querySelector('.title-input');
                    const descInput = previewItem.querySelector('.description-input');
                    
                    titleInput.addEventListener('input', (e) => fileData.title = e.target.value);
                    descInput.addEventListener('input', (e) => fileData.description = e.target.value);
                    
                    this.previewGrid.appendChild(previewItem);
                };
                reader.readAsDataURL(fileData.file);
            }
            
            removeFile(fileId) {
                this.selectedFiles = this.selectedFiles.filter(f => f.id != fileId);
                const previewItem = document.querySelector(`[data-file-id="${fileId}"]`);
                if (previewItem) previewItem.remove();
                this.updateUI();
            }
            
            clearAll() {
                this.selectedFiles = [];
                this.previewGrid.innerHTML = '';
                this.fileInput.value = '';
                if (this.cameraInput) this.cameraInput.value = '';
                this.updateUI();
            }
            
            updateUI() {
                const count = this.selectedFiles.length;
                this.photoCount.textContent = count;
                
                if (count > 0) {
                    this.previewArea.classList.remove('hidden');
                    this.uploadAllBtn.disabled = false;
                    this.uploadAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    this.previewArea.classList.add('hidden');
                    this.uploadAllBtn.disabled = true;
                    this.uploadAllBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
            
            async uploadAll() {
                if (this.selectedFiles.length === 0) return;
                
                this.uploadProgress.classList.remove('hidden');
                this.uploadAllBtn.disabled = true;
                this.uploadAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>上传中...';
                
                const batchTags = this.batchTags.value.trim();
                let uploaded = 0;
                let failed = 0;
                
                for (let i = 0; i < this.selectedFiles.length; i++) {
                    const fileData = this.selectedFiles[i];
                    const progress = ((i + 1) / this.selectedFiles.length) * 100;
                    
                    this.progressBar.style.width = progress + '%';
                    this.progressText.textContent = `正在上传 ${i + 1}/${this.selectedFiles.length}: ${fileData.file.name}`;
                    
                    try {
                        await this.uploadSingleFile(fileData, batchTags);
                        uploaded++;
                    } catch (error) {
                        console.error('上传失败:', error);
                        failed++;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                this.progressBar.style.width = '100%';
                
                if (uploaded > 0) {
                    this.progressText.textContent = `上传完成！成功 ${uploaded} 张${failed > 0 ? `，失败 ${failed} 张` : ''}`;
                    showFloatingNotification(`成功上传 ${uploaded} 张照片！`, 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    this.progressText.textContent = '所有照片上传失败';
                    showFloatingNotification('所有照片上传失败', 'error');
                    this.resetUploadUI();
                }
            }
            
            async uploadSingleFile(fileData, batchTags) {
                const formData = new FormData();
                formData.append('photo', fileData.file);
                formData.append('title', fileData.title);
                formData.append('description', fileData.description);
                formData.append('tags', batchTags);
                
                // 添加文件夹路径
                const folderSelect = document.getElementById('folderSelect');
                const selectedFolder = folderSelect ? folderSelect.value : '';
                formData.append('folder_path', selectedFolder);
                
                const response = await fetch('./api/final-upload.php', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.message);
                }
                
                return result;
            }
            
            resetUploadUI() {
                this.uploadProgress.classList.add('hidden');
                this.uploadAllBtn.disabled = false;
                this.uploadAllBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>上传全部';
                this.progressBar.style.width = '0%';
            }
        }

        // 文件夹管理功能
        function showCreateModal() {
            document.getElementById('createFolderModal').classList.remove('hidden');
            document.getElementById('folderName').focus();
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.add('hidden');
            // 清空表单
            const form = document.querySelector(`#${modalId} form`);
            if (form) form.reset();
        }

        function showRenameModal(folderPath, currentName) {
            // 简化版：直接使用prompt
            const newName = prompt('请输入新的文件夹名称:', currentName);
            if (newName && newName !== currentName) {
                renameFolder(folderPath, newName);
            }
        }

        function showDeleteConfirm(folderPath, folderName) {
            showCustomConfirm(
                `确定要删除文件夹"${folderName}"吗？`,
                `此文件夹包含的所有文件和子文件夹都将被删除，删除后将无法恢复！`,
                () => deleteFolder(folderPath)
            );
        }

        async function createFolder(folderName) {
            try {
                const response = await fetch('./api/folders.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'create',
                        folder_name: folderName,
                        parent_path: currentFolder,
                        context: 'album',
                        csrf_token: csrfToken
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showFloatingNotification('文件夹创建成功！', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showFloatingNotification(data.message || '创建文件夹失败', 'error');
                }
            } catch (error) {
                console.error('创建文件夹错误:', error);
                showFloatingNotification('创建文件夹时发生错误', 'error');
            }
        }

        async function renameFolder(folderPath, newName) {
            try {
                const response = await fetch('./api/folders.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'rename',
                        folder_path: folderPath,
                        new_name: newName,
                        context: 'album',
                        csrf_token: csrfToken
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showFloatingNotification('文件夹重命名成功！', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showFloatingNotification(data.message || '重命名文件夹失败', 'error');
                }
            } catch (error) {
                console.error('重命名文件夹错误:', error);
                showFloatingNotification('重命名文件夹时发生错误', 'error');
            }
        }

        async function deleteFolder(folderPath) {
            try {
                const response = await fetch('./api/folders.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'delete',
                        folder_path: folderPath,
                        context: 'album',
                        csrf_token: csrfToken
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showFloatingNotification(`文件夹删除成功！删除了 ${data.deletedCount} 个项目`, 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showFloatingNotification(data.message || '删除文件夹失败', 'error');
                }
            } catch (error) {
                console.error('删除文件夹错误:', error);
                showFloatingNotification('删除文件夹时发生错误', 'error');
            }
        }

        // 照片点击处理 - 区分桌面端和移动端
        function handlePhotoClick(photoIndex) {
            // 检测是否为移动端
            if (window.innerWidth < 768) {
                // 移动端：显示操作菜单
                showMobileMenu(photoIndex);
            } else {
                // 桌面端：直接打开模态框
                if (photoIndex >= 0 && photoIndex < photoData.length) {
                    openPhotoModal(photoData[photoIndex].id);
                }
            }
        }

        // 移动端菜单管理
        function showMobileMenu(photoIndex) {
            // 先关闭所有其他菜单
            document.querySelectorAll('[id^="mobileMenu_"]').forEach(menu => {
                menu.classList.add('hidden');
            });
            
            // 显示当前菜单
            const menu = document.getElementById('mobileMenu_' + photoIndex);
            if (menu) {
                menu.classList.remove('hidden');
                
                // 3秒后自动关闭
                setTimeout(() => {
                    closeMobileMenu(photoIndex);
                }, 3000);
            }
        }

        function closeMobileMenu(photoIndex) {
            const menu = document.getElementById('mobileMenu_' + photoIndex);
            if (menu) {
                menu.classList.add('hidden');
            }
        }

        function closeAllMobileMenus() {
            document.querySelectorAll('[id^="mobileMenu_"]').forEach(menu => {
                menu.classList.add('hidden');
            });
        }

        // 照片管理功能
        function showMovePhotoModal(photoId, photoTitle) {
            document.getElementById('movePhotoModal').classList.remove('hidden');
            document.getElementById('movePhotoName').textContent = photoTitle;
            document.getElementById('movePhotoModal').dataset.photoId = photoId;
        }

        // 通过按钮的 data-photo-id 属性删除照片
        function deletePhotoByDataId(button) {
            const photoId = button.getAttribute('data-photo-id');
            console.log('删除照片ID:', photoId);
            
            if (!photoId || photoId.trim() === '') {
                console.error('照片ID缺失或为空');
                console.log('按钮元素:', button);
                console.log('按钮所有属性:');
                for (let attr of button.attributes) {
                    console.log(`  ${attr.name} = "${attr.value}"`);
                }
                alert('照片ID缺失');
                return;
            }
            
            const cleanPhotoId = photoId.trim();
            
            // 使用简单的确认对话框
            if (confirm('确定要删除这张照片吗？删除后无法恢复！')) {
                console.log('用户确认删除，调用deletePhoto');
                deletePhoto(cleanPhotoId);
            } else {
                console.log('用户取消删除');
            }
        }

        // 直接通过ID删除照片
        function deletePhotoById(photoId) {
            console.log('deletePhotoById called with ID:', photoId);
            console.log('Type of photoId:', typeof photoId);
            console.log('PhotoId length:', photoId ? photoId.length : 'undefined');
            
            if (!photoId || photoId.trim() === '') {
                console.error('No photo ID provided or empty');
                alert('照片ID缺失或为空');
                return;
            }
            
            // 清理照片ID
            photoId = photoId.trim();
            console.log('Cleaned photoId:', photoId);
            
            // 从照片数据中查找照片信息
            const photo = photoData.find(p => p.id === photoId);
            console.log('Found photo:', photo);
            
            if (photo) {
                showDeletePhotoConfirm(photoId, photo.title || '此照片');
            } else {
                console.error('Photo not found with ID:', photoId);
                console.log('Available photo IDs:', photoData.map(p => p.id));
                alert('找不到照片，ID: ' + photoId);
            }
        }

        // 通过索引删除照片（使用JavaScript数据）
        function deletePhotoByIndex(index) {
            console.log('deletePhotoByIndex called with index:', index);
            console.log('photoData:', photoData);
            console.log('photoData.length:', photoData.length);
            
            if (index >= 0 && index < photoData.length) {
                const photo = photoData[index];
                console.log('Found photo at index', index, ':', photo);
                console.log('Photo keys:', Object.keys(photo));
                console.log('Photo.id:', photo.id);
                console.log('Photo.title:', photo.title);
                
                if (photo.id) {
                    showDeletePhotoConfirm(photo.id, photo.title || '此照片');
                } else {
                    console.error('Photo object has no id field:', photo);
                    alert('照片数据错误：缺少ID字段');
                }
            } else {
                console.error('Invalid photo index:', index, 'photoData.length:', photoData.length);
            }
        }

        function showDeletePhotoConfirm(photoId, photoTitle) {
            console.log('确认删除照片:', photoId, photoTitle);
            
            if (confirm(`确定要删除照片"${photoTitle}"吗？删除后将无法恢复！`)) {
                deletePhoto(photoId);
            }
        }

        async function movePhoto() {
            const modal = document.getElementById('movePhotoModal');
            const photoId = modal.dataset.photoId;
            const targetFolder = document.getElementById('targetFolderSelect').value;
            
            try {
                const response = await fetch('./api/folders.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'move',
                        file_id: photoId,
                        target_path: targetFolder,
                        context: 'album',
                        csrf_token: csrfToken
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showFloatingNotification('照片移动成功！', 'success');
                    closeModal('movePhotoModal');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showFloatingNotification(data.message || '移动照片失败', 'error');
                }
            } catch (error) {
                console.error('移动照片错误:', error);
                showFloatingNotification('移动照片时发生错误', 'error');
            }
        }

        async function deletePhoto(photoId) {
            try {
                console.log('删除照片:', photoId);
                
                if (!photoId || photoId.toString().trim() === '') {
                    throw new Error('照片ID为空');
                }
                
                const cleanPhotoId = photoId.toString().trim();
                
                const formData = new URLSearchParams();
                formData.append('action', 'delete');
                formData.append('photo_id', cleanPhotoId);
                formData.append('context', 'album');
                formData.append('csrf_token', csrfToken);
                
                console.log('发送数据:', Object.fromEntries(formData));
                
                const response = await fetch('./api/photos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('服务器响应:', data);
                
                if (data.success) {
                    showFloatingNotification('照片删除成功！', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showFloatingNotification(data.message || '删除照片失败', 'error');
                }
            } catch (error) {
                console.error('删除照片错误:', error);
                showFloatingNotification('删除照片时发生错误: ' + error.message, 'error');
            }
        }
        // 照片模态框功能
        let currentPhotoId = '';
        let currentPhotoTitle = '';
        
        function openPhotoModal(photoId) {
            console.log('openPhotoModal called with photoId:', photoId);
            
            // 直接设置currentPhotoId，不管是否在photoData中找到
            currentPhotoId = photoId;
            
            const photo = photoData.find(p => p.id === photoId);
            console.log('Found photo:', photo);
            
            if (!photo) {
                // 如果在photoData中找不到，尝试从页面上获取信息
                currentPhotoTitle = '照片';
                document.getElementById('modalTitle').textContent = currentPhotoTitle;
                // 尝试从页面上找到对应的图片
                const imgElements = document.querySelectorAll('img[title*="' + photoId + '"]');
                if (imgElements.length > 0) {
                    document.getElementById('modalImage').src = imgElements[0].src;
                }
                document.getElementById('modalDescription').textContent = '';
                document.getElementById('modalTags').innerHTML = '';
                document.getElementById('modalInfo').innerHTML = '';
                document.getElementById('photoModal').classList.remove('hidden');
                return;
            }
            
            currentPhotoTitle = photo.title || '无标题';
            
            document.getElementById('modalTitle').textContent = currentPhotoTitle;
            document.getElementById('modalImage').src = photo.path;
            document.getElementById('modalImage').alt = currentPhotoTitle;
            document.getElementById('modalDescription').textContent = photo.description || '';
            
            const tagsContainer = document.getElementById('modalTags');
            if (photo.tags && photo.tags.length > 0) {
                tagsContainer.innerHTML = photo.tags.map(tag => 
                    `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">#${tag}</span>`
                ).join('');
            } else {
                tagsContainer.innerHTML = '';
            }
            
            document.getElementById('modalInfo').innerHTML = `
                <i class="fas fa-user mr-1"></i>${photo.uploaded_by} • 
                <i class="fas fa-clock mr-1"></i>${new Date(photo.uploaded_at).toLocaleString('zh-CN')}
            `;
            
            document.getElementById('photoModal').classList.remove('hidden');
        }

        function closePhotoModal() {
            document.getElementById('photoModal').classList.add('hidden');
            currentPhotoId = '';
            currentPhotoTitle = '';
        }

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
                max-width: 90vw;
                word-wrap: break-word;
                white-space: pre-line;
            `;
            
            if (type === 'success') {
                notification.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                notification.style.color = 'white';
                notification.innerHTML = '<i class="fas fa-check-circle"></i><span>' + message + '</span>';
            } else {
                notification.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                notification.style.color = 'white';
                notification.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>' + message + '</span>';
            }
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.top = '20px';
                notification.style.opacity = '1';
            }, 10);
            
            const displayTime = Math.max(3000, message.length * 50);
            
            setTimeout(() => {
                notification.style.top = '-100px';
                notification.style.opacity = '0';
            }, displayTime);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, displayTime + 500);
        }

        // 初始化上传器
        let multiUploader;
        document.addEventListener('DOMContentLoaded', function() {
            multiUploader = new MultiPhotoUploader();
            
            // 初始化标签筛选
            initTagFilter();
            
            // 绑定创建文件夹表单
            document.getElementById('createFolderForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const folderName = document.getElementById('folderName').value.trim();
                if (folderName) {
                    createFolder(folderName);
                    closeModal('createFolderModal');
                }
            });

            // 绑定创建文件夹按钮
            document.getElementById('createFolderBtn').addEventListener('click', showCreateModal);
            
            // 点击页面其他地方关闭移动端菜单
            document.addEventListener('click', function(e) {
                // 检查点击的元素是否是照片或菜单内的元素
                if (!e.target.closest('[id^="mobileMenu_"]') && !e.target.closest('img')) {
                    closeAllMobileMenus();
                }
            });
        });

        // ESC键关闭模态框和菜单
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closePhotoModal();
                closeModal('createFolderModal');
                closeModal('movePhotoModal');
                closeAllMobileMenus();
            }
        });

        // 自定义确认对话框
        function showCustomConfirm(title, message, onConfirm) {
            // 创建遮罩层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.2s ease-out;
            `;

            // 创建对话框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 16px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                animation: slideIn 0.3s ease-out;
            `;

            dialog.innerHTML = `
                <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">
                    ${title}
                </h3>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    ${message}
                </p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="cancel-btn" style="
                        padding: 10px 24px;
                        border: 1px solid #d1d5db;
                        background: white;
                        color: #374151;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">取消</button>
                    <button class="confirm-btn" style="
                        padding: 10px 24px;
                        border: none;
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">确定</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 按钮悬停效果
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const confirmBtn = dialog.querySelector('.confirm-btn');

            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#f3f4f6';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'white';
            });

            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.transform = 'translateY(-1px)';
                confirmBtn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            });
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.transform = 'translateY(0)';
                confirmBtn.style.boxShadow = 'none';
            });

            // 关闭对话框函数
            const closeDialog = () => {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => overlay.remove(), 200);
            };

            // 取消按钮
            cancelBtn.addEventListener('click', closeDialog);

            // 确定按钮
            confirmBtn.addEventListener('click', () => {
                closeDialog();
                if (onConfirm) onConfirm();
            });

            // 点击遮罩层关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog();
                }
            });

            // ESC 键关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeDialog();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            // 添加动画样式（只添加一次）
            if (!document.getElementById('confirmDialogStyles')) {
                const style = document.createElement('style');
                style.id = 'confirmDialogStyles';
                style.textContent = `
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes fadeOut {
                        from { opacity: 1; }
                        to { opacity: 0; }
                    }
                    @keyframes slideIn {
                        from {
                            opacity: 0;
                            transform: translateY(-20px) scale(0.95);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    </script>
    </div>

<?php include 'includes/footer.php'; ?>