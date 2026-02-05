<?php
/**
 * 隐私空间页面
 * 需要额外的密码验证才能访问
 */
define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/json-helper.php';
require_once 'includes/folder-helper.php';
require_once 'includes/folder-breadcrumbs.php';
require_once 'includes/folder-list.php';

// 要求用户登录
requireLogin();

$pageTitle = '隐私空间';
$currentUser = getCurrentUser();
$currentUserId = getCurrentUserId();

// 检查是否已通过隐私空间认证
$isPrivateAuthenticated = isPrivateAuthenticated();

// 处理密码验证
$errorMessage = '';
$successMessage = '';

// 获取一次性消息
$flashMessage = getFlashMessage();
if ($flashMessage) {
    if ($flashMessage['type'] === 'error') {
        $errorMessage = $flashMessage['message'];
    } else {
        $successMessage = $flashMessage['message'];
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrf_token = $_POST['csrf_token'] ?? '';
    $action = $_POST['action'] ?? '';
    
    if (!validateCSRFToken($csrf_token)) {
        $errorMessage = '请求无效，请重新尝试';
    } else {
        if ($action === 'verify_password') {
            // 验证密码
            $password = $_POST['password'] ?? '';
            $result = validatePrivatePassword($password);
            
            if ($result) {
                // 密码正确，设置认证状态
                setPrivateAuthenticated($result);
                $isPrivateAuthenticated = true;
            } else {
                $errorMessage = '密码错误，请重试';
            }
        } elseif ($action === 'add_note') {
            // 添加笔记
            $noteTitle = sanitizeInput($_POST['note_title'] ?? '');
            $noteContent = sanitizeInput($_POST['note_content'] ?? '');
            
            if (empty($noteContent)) {
                $errorMessage = '笔记内容不能为空';
            } else {
                // 读取私人数据
                $privateFile = "data/private_{$currentUserId}.json";
                $privateData = [];
                if (file_exists($privateFile)) {
                    $privateData = json_decode(file_get_contents($privateFile), true) ?: [];
                }
                
                // 添加新笔记
                if (!isset($privateData['notes'])) {
                    $privateData['notes'] = [];
                }
                
                $newNote = [
                    'id' => uniqid(),
                    'title' => $noteTitle,
                    'content' => $noteContent,
                    'created_at' => date('Y-m-d H:i:s')
                ];
                
                $privateData['notes'][] = $newNote;
                
                // 保存
                if (file_put_contents($privateFile, json_encode($privateData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                    setFlashMessage('笔记添加成功！', 'success');
                    // 重新加载数据
                    header('Location: private.php');
                    exit();
                } else {
                    $errorMessage = '笔记保存失败，请重试';
                }
            }
        } elseif ($action === 'delete_note') {
            // 删除笔记
            $noteId = $_POST['note_id'] ?? '';
            
            // 读取私人数据
            $privateFile = "data/private_{$currentUserId}.json";
            if (file_exists($privateFile)) {
                $privateData = json_decode(file_get_contents($privateFile), true) ?: [];
                
                if (isset($privateData['notes'])) {
                    $privateData['notes'] = array_values(array_filter(
                        $privateData['notes'],
                        function($note) use ($noteId) { return $note['id'] !== $noteId; }
                    ));
                    
                    file_put_contents($privateFile, json_encode($privateData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                    setFlashMessage('笔记删除成功', 'success');
                    header('Location: private.php');
                    exit();
                }
            }
        } elseif ($action === 'change_password') {
            // 更改密码
            $oldPassword = $_POST['old_password'] ?? '';
            $newPassword = $_POST['new_password'] ?? '';
            $confirmPassword = $_POST['confirm_password'] ?? '';
            
            // 验证旧密码
            if (!validatePrivatePassword($oldPassword)) {
                $errorMessage = '旧密码错误';
            } elseif (empty($newPassword)) {
                $errorMessage = '新密码不能为空';
            } elseif ($newPassword !== $confirmPassword) {
                $errorMessage = '两次输入的新密码不一致';
            } else {
                // 更新密码
                $userConfig = getUserConfig($currentUser);
                if ($userConfig) {
                    // 读取配置文件
                    $configFile = 'data/config.json';
                    $config = json_decode(file_get_contents($configFile), true);
                    
                    // 更新密码
                    $config['users'][$currentUser]['privatePassword'] = $newPassword;
                    
                    // 保存配置
                    if (file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                        setFlashMessage('密码修改成功！', 'success');
                        header('Location: private.php');
                        exit();
                    } else {
                        $errorMessage = '密码修改失败，请重试';
                    }
                }
            }
        }
    }
}

// 生成CSRF令牌
$csrf_token = generateCSRFToken();

// 如果未认证，显示密码输入界面
if (!$isPrivateAuthenticated) {
    ?>
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>隐私空间 - 密码验证</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        </style>
    </head>
    <body>
        <div class="max-w-md w-full mx-4">
            <div class="bg-white rounded-2xl shadow-2xl p-8">
                <div class="text-center mb-6">
                    <div class="text-6xl mb-4">🔒</div>
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">隐私空间</h1>
                    <p class="text-gray-600">请输入你的专属密码</p>
                </div>
                
                <?php if ($errorMessage): ?>
                <div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    <i class="fas fa-exclamation-circle mr-2"></i>
                    <?php echo htmlspecialchars($errorMessage); ?>
                </div>
                <?php endif; ?>
                
                <form method="POST" class="space-y-4">
                    <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
                    <input type="hidden" name="action" value="verify_password">
                    
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-key mr-2 text-purple-500"></i>密码
                        </label>
                        <div class="relative">
                            <input 
                                type="password" 
                                id="password" 
                                name="password" 
                                required
                                autofocus
                                autocomplete="new-password"
                                inputmode="text"
                                class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="输入你的专属密码"
                            >
                            <button 
                                type="button" 
                                onclick="togglePassword()"
                                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                <i id="password-icon" class="fas fa-eye"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            <i class="fas fa-info-circle mr-1"></i>
                            可以使用中文输入法，点击眼睛图标查看输入内容
                        </p>
                    </div>
                    
                    <script>
                        function togglePassword() {
                            const passwordInput = document.getElementById('password');
                            const passwordIcon = document.getElementById('password-icon');
                            
                            if (passwordInput.type === 'password') {
                                passwordInput.type = 'text';
                                passwordIcon.classList.remove('fa-eye');
                                passwordIcon.classList.add('fa-eye-slash');
                            } else {
                                passwordInput.type = 'password';
                                passwordIcon.classList.remove('fa-eye-slash');
                                passwordIcon.classList.add('fa-eye');
                            }
                        }
                    </script>
                    
                    <button 
                        type="submit" 
                        class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition duration-200"
                    >
                        <i class="fas fa-unlock mr-2"></i>解锁隐私空间
                    </button>
                </form>
                
                <div class="mt-6 text-center space-y-3">
                    <p class="text-sm text-gray-500">
                        <i class="fas fa-question-circle mr-1"></i>
                        忘记密码？请<span class="line-through"> 贿赂 </span> 求助管理员 <img src="https://ts1.tc.mm.bing.net/th/id/OIP-C.JqtutuIUT2Pxe6BsgdseGwAAAA?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="狗头" style="display: inline-block; width: 20px; height: 20px; vertical-align: middle;">
                    </p>
                    <a href="home.php" class="text-sm text-gray-600 hover:text-gray-800">
                        <i class="fas fa-arrow-left mr-1"></i>返回主页
                    </a>
                </div>
            </div>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </body>
    </html>
    <?php
    exit();
}

// 已认证，显示隐私空间内容

// 获取当前文件夹路径
$currentPath = $_GET['folder'] ?? '';
$context = 'private';

// 读取用户的私人数据
$privateFile = "data/private_{$currentUserId}.json";
$privateData = safeReadJSON($privateFile, ['folders' => [], 'files' => [], 'notes' => []]);

// 确保数据结构正确
if (!isset($privateData['folders'])) {
    $privateData['folders'] = [];
}
if (!isset($privateData['files'])) {
    $privateData['files'] = [];
}
if (!isset($privateData['notes'])) {
    $privateData['notes'] = [];
}

// 获取当前文件夹的内容
$folderContents = getFolderContents($privateFile, $currentPath);

// 获取笔记
$notes = $privateData['notes'] ?? [];
$noteCount = count($notes);

// 获取文件
$files = $privateData['files'] ?? [];
$fileCount = count($files);

$pageHeader = '
<div class="text-center">
    <h1 class="text-4xl font-bold text-gray-800 mb-4">
        <i class="fas fa-lock-open text-purple-500 mr-2"></i>
        隐私空间
        <i class="fas fa-heart text-pink-500 ml-2"></i>
    </h1>
    <p class="text-xl text-gray-600">
        欢迎来到你的专属空间，' . htmlspecialchars($currentUser) . ' 💜
    </p>
</div>';

include 'includes/header.php';
?>

<!-- 飘字通知 -->
<?php if ($errorMessage): ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    showFloatingNotification('<?php echo addslashes($errorMessage); ?>', 'error');
});
</script>
<?php endif; ?>

<?php if ($successMessage): ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    showFloatingNotification('<?php echo addslashes($successMessage); ?>', 'success');
});
</script>
<?php endif; ?>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
    <div class="card p-6 text-center">
        <div class="text-4xl font-bold text-purple-600 mb-2"><?php echo $noteCount; ?></div>
        <div class="text-gray-600">我的笔记</div>
    </div>
    <div class="card p-6 text-center">
        <div class="text-4xl font-bold text-pink-600 mb-2"><?php echo $fileCount; ?></div>
        <div class="text-gray-600">私人文件</div>
    </div>
    <div class="card p-6 text-center">
        <div class="text-4xl font-bold text-blue-600 mb-2">🔒</div>
        <div class="text-gray-600">安全保护</div>
    </div>
</div>

<div class="card p-6 mb-6">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-info-circle text-blue-500 mr-2"></i>关于隐私空间
    </h2>
    <div class="space-y-3 text-gray-600">
        <p><i class="fas fa-check text-green-500 mr-2"></i>这是你的专属私密空间</p>
        <p><i class="fas fa-check text-green-500 mr-2"></i>只有输入正确密码才能访问</p>
        <p><i class="fas fa-check text-green-500 mr-2"></i>你可以在这里记录私人笔记</p>
        <p><i class="fas fa-check text-green-500 mr-2"></i>所有数据都独立存储，互不干扰</p>
    </div>
</div>

<div class="card p-6 mb-6">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-key text-purple-500 mr-2"></i>更改密码
    </h2>
    
    <form method="POST" class="space-y-4">
        <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
        <input type="hidden" name="action" value="change_password">
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label for="old_password" class="block text-sm font-medium text-gray-700 mb-2">
                    旧密码
                </label>
                <input 
                    type="password" 
                    id="old_password" 
                    name="old_password" 
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="输入当前密码"
                >
            </div>
            <div>
                <label for="new_password" class="block text-sm font-medium text-gray-700 mb-2">
                    新密码
                </label>
                <input 
                    type="password" 
                    id="new_password" 
                    name="new_password" 
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="输入新密码"
                >
            </div>
            <div>
                <label for="confirm_password" class="block text-sm font-medium text-gray-700 mb-2">
                    确认新密码
                </label>
                <input 
                    type="password" 
                    id="confirm_password" 
                    name="confirm_password" 
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="再次输入新密码"
                >
            </div>
        </div>
        
        <button 
            type="submit" 
            class="btn-primary"
        >
            <i class="fas fa-save mr-2"></i>保存新密码
        </button>
    </form>
</div>

<!-- CSRF Token for JavaScript -->
<meta name="csrf-token" content="<?php echo $csrf_token; ?>">

<!-- 文件夹管理工具栏 -->
<div class="card p-4 mb-6 flex justify-between items-center">
    <div>
        <button id="createFolderBtn" class="btn-primary">
            <i class="fas fa-folder-plus mr-2"></i>创建文件夹
        </button>
    </div>
    <div class="text-sm text-gray-600">
        <i class="fas fa-folder mr-2 text-yellow-500"></i>
        <?php echo count($folderContents['folders']); ?> 个文件夹 • 
        <i class="fas fa-file mr-2 text-blue-500"></i>
        <?php echo count($folderContents['files']); ?> 个文件
    </div>
</div>

<!-- 面包屑导航 -->
<?php echo renderBreadcrumbs($currentPath, $context); ?>

<!-- 文件夹列表 -->
<?php if (!empty($folderContents['folders'])): ?>
    <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">
            <i class="fas fa-folder text-yellow-500 mr-2"></i>文件夹
        </h2>
        <?php echo renderFolderList($folderContents['folders'], $context); ?>
    </div>
<?php endif; ?>

<div class="card p-6 mb-6">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-cloud-upload-alt text-blue-500 mr-2"></i>上传私人文件
    </h2>
    
    <!-- 多文件上传区域 -->
    <div id="multiUploadArea" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 transition-colors hover:border-purple-400 hover:bg-purple-50 cursor-pointer">
        <div id="uploadPrompt">
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
            <p class="text-lg text-gray-600 mb-2">选择文件或拖拽到此处</p>
            <p class="text-sm text-gray-500 mb-4">支持多文件同时上传 • 最大 10MB/个</p>
            
            <div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button type="button" id="selectFilesBtn" class="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors">
                    <i class="fas fa-folder-open mr-2"></i>选择文件
                </button>
            </div>
        </div>
        
        <!-- 隐藏的文件输入 -->
        <input type="file" id="multiFileInput" multiple style="display: none;">
    </div>
    
    <!-- 文件预览区域 -->
    <div id="filePreviewArea" class="hidden">
        <h3 class="text-lg font-semibold text-gray-800 mb-3">
            <i class="fas fa-eye mr-2"></i>文件预览 (<span id="fileCount">0</span>)
        </h3>
        <div id="filePreviewGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
            <!-- 预览文件将在这里动态添加 -->
        </div>
        
        <!-- 批量操作 -->
        <div class="flex flex-col md:flex-row gap-4 mb-4">
            <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-folder mr-2 text-yellow-500"></i>上传到文件夹
                </label>
                <select id="privateFolderSelect" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="">根目录</option>
                    <?php foreach ($privateData['folders'] as $folder): ?>
                    <option value="<?php echo htmlspecialchars($folder['path']); ?>" <?php echo ($folder['path'] ?? '') === $currentPath ? 'selected' : ''; ?>>
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
                <div id="progressBar" class="bg-purple-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
            <p id="progressText" class="text-sm text-gray-600 text-center">准备上传...</p>
        </div>
    </div>
</div>

<div class="card p-6 mb-6">
    <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-semibold text-gray-800">
            <i class="fas fa-folder-open text-blue-500 mr-2"></i>文件 (<?php echo count($folderContents['files']); ?>)
        </h2>
        <?php if (!empty($folderContents['files'])): ?>
        <div class="flex items-center space-x-2 flex-wrap gap-2">
            <button id="toggleSelectMode" onclick="toggleSelectMode()" class="text-purple-600 hover:text-purple-800 px-3 py-1 border border-purple-300 rounded-lg text-sm">
                <i class="fas fa-check-square mr-1"></i>批量选择
            </button>
            <button id="selectAllBtn" onclick="selectAllFiles()" class="hidden text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-300 rounded-lg text-sm">
                <i class="fas fa-check-double mr-1"></i>全选
            </button>
            <button id="downloadSelectedBtn" onclick="downloadSelectedFiles()" class="hidden bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">
                <i class="fas fa-download mr-1"></i>下载选中
            </button>
            <button id="deleteSelectedBtn" onclick="deleteSelectedFiles()" class="hidden bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm">
                <i class="fas fa-trash mr-1"></i>删除选中 (<span id="selectedCount">0</span>)
            </button>
        </div>
        <?php endif; ?>
    </div>
    
    <?php if (empty($folderContents['files'])): ?>
    <div class="text-center py-8">
        <div class="text-6xl mb-4">📁</div>
        <h3 class="text-2xl font-semibold text-gray-800 mb-2">
            <?php echo $currentPath ? '此文件夹为空' : '还没有上传文件'; ?>
        </h3>
        <p class="text-gray-600 mb-4">上传文件开始使用<?php echo $currentPath ? '此文件夹' : '私密空间'; ?></p>
    </div>
    <?php else: ?>
    <div class="space-y-3" id="fileList">
        <?php foreach (array_reverse($folderContents['files']) as $file): ?>
        <div class="file-item border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex items-center justify-between" data-file-id="<?php echo htmlspecialchars($file['id']); ?>">
            <div class="flex items-center flex-1">
                <!-- 选择框 -->
                <div class="file-checkbox hidden mr-3">
                    <input type="checkbox" class="w-5 h-5 text-purple-600 rounded" onchange="updateSelectedCount()">
                </div>
                <div class="text-3xl mr-4">
                    <?php
                    $ext = strtolower($file['extension'] ?? '');
                    $icon = 'fa-file';
                    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])) {
                        $icon = 'fa-file-image';
                    } elseif (in_array($ext, ['pdf'])) {
                        $icon = 'fa-file-pdf';
                    } elseif (in_array($ext, ['doc', 'docx'])) {
                        $icon = 'fa-file-word';
                    } elseif (in_array($ext, ['xls', 'xlsx'])) {
                        $icon = 'fa-file-excel';
                    } elseif (in_array($ext, ['zip', 'rar', '7z'])) {
                        $icon = 'fa-file-archive';
                    } elseif (in_array($ext, ['mp4', 'avi', 'mov', 'mkv'])) {
                        $icon = 'fa-file-video';
                    } elseif (in_array($ext, ['mp3', 'wav', 'flac'])) {
                        $icon = 'fa-file-audio';
                    }
                    ?>
                    <i class="fas <?php echo $icon; ?> text-blue-500"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-800"><?php echo htmlspecialchars($file['original_name']); ?></h3>
                    <div class="text-sm text-gray-500">
                        <i class="fas fa-hdd mr-1"></i>
                        <?php echo number_format($file['size'] / 1024, 2); ?> KB
                        <span class="mx-2">•</span>
                        <i class="fas fa-clock mr-1"></i>
                        <?php echo date('Y-m-d H:i', strtotime($file['uploaded_at'])); ?>
                    </div>
                </div>
            </div>
            <div class="file-actions flex items-center space-x-2">
                <button 
                    onclick="folderUI.showMoveFileModal('<?php echo htmlspecialchars($file['id']); ?>', '<?php echo htmlspecialchars($file['original_name']); ?>')"
                    class="text-green-500 hover:text-green-700 px-3 py-2"
                    title="移动文件"
                >
                    <i class="fas fa-arrows-alt"></i>
                </button>
                <a 
                    href="<?php echo htmlspecialchars($file['path']); ?>" 
                    download="<?php echo htmlspecialchars($file['original_name']); ?>"
                    class="text-blue-500 hover:text-blue-700 px-3 py-2"
                    title="下载"
                >
                    <i class="fas fa-download"></i>
                </a>
                <form method="POST" action="api/private-files.php" class="inline" id="deleteFileForm_<?php echo $file['id']; ?>">
                    <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="file_id" value="<?php echo $file['id']; ?>">
                    <button type="button" onclick="confirmDeleteFile('<?php echo $file['id']; ?>', '<?php echo htmlspecialchars($file['original_name']); ?>')" class="text-red-500 hover:text-red-700 px-3 py-2" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </form>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>

<div class="card p-6 mb-6">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-plus-circle text-green-500 mr-2"></i>添加笔记
    </h2>
    
    <form method="POST" class="space-y-4">
        <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
        <input type="hidden" name="action" value="add_note">
        
        <div>
            <label for="note_title" class="block text-sm font-medium text-gray-700 mb-2">
                <i class="fas fa-heading mr-2 text-purple-500"></i>标题（可选）
            </label>
            <input 
                type="text" 
                id="note_title" 
                name="note_title" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="给笔记起个标题"
            >
        </div>
        
        <div>
            <label for="note_content" class="block text-sm font-medium text-gray-700 mb-2">
                <i class="fas fa-pen mr-2 text-purple-500"></i>内容 *
            </label>
            <textarea 
                id="note_content" 
                name="note_content" 
                rows="4"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="写下你的想法..."
            ></textarea>
        </div>
        
        <button 
            type="submit" 
            class="btn-primary"
        >
            <i class="fas fa-save mr-2"></i>保存笔记
        </button>
    </form>
</div>

<div class="card p-6">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        <i class="fas fa-sticky-note text-yellow-500 mr-2"></i>我的笔记 (<?php echo $noteCount; ?>)
    </h2>
    
    <?php if (empty($notes)): ?>
    <div class="text-center py-8">
        <div class="text-6xl mb-4">📝</div>
        <p class="text-gray-600 mb-4">还没有笔记，开始记录你的想法吧！</p>
    </div>
    <?php else: ?>
    <div class="space-y-4">
        <?php foreach (array_reverse($notes) as $note): ?>
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <?php if (!empty($note['title'])): ?>
                    <h3 class="font-semibold text-gray-800 mb-2"><?php echo htmlspecialchars($note['title']); ?></h3>
                    <?php endif; ?>
                </div>
                <form method="POST" class="inline" id="deleteNoteForm_<?php echo $note['id']; ?>">
                    <input type="hidden" name="csrf_token" value="<?php echo $csrf_token; ?>">
                    <input type="hidden" name="action" value="delete_note">
                    <input type="hidden" name="note_id" value="<?php echo $note['id']; ?>">
                    <button type="button" onclick="confirmDeleteNote('<?php echo $note['id']; ?>')" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </form>
            </div>
            <p class="text-gray-600 mb-2 whitespace-pre-wrap"><?php echo htmlspecialchars($note['content']); ?></p>
            <?php if (isset($note['created_at']) || isset($note['timestamp'])): ?>
            <div class="text-xs text-gray-500">
                <i class="fas fa-clock mr-1"></i>
                <?php 
                $time = $note['created_at'] ?? $note['timestamp'] ?? '';
                echo $time ? date('Y-m-d H:i', strtotime($time)) : '未知时间';
                ?>
            </div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>

<div class="mt-6 text-center">
    <form method="POST" action="api/logout.php" class="inline">
        <button 
            type="button" 
            class="text-red-600 hover:text-red-800"
            onclick="confirmLogout(this.form)"
        >
            <i class="fas fa-lock mr-1"></i>锁定隐私空间
        </button>
    </form>
</div>

<!-- 文件夹管理模态框 -->
<?php include 'includes/folder-modals.php'; ?>

<!-- 文件夹 UI JavaScript -->
<script src="assets/js/folder-ui.js"></script>
<script>
// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 初始化文件夹 UI
    window.folderUI = new FolderUI('private');
    window.folderUI.currentPath = '<?php echo addslashes($currentPath); ?>';

    // 重写刷新方法以保持当前路径
    window.folderUI.refreshFolderList = function() {
        const path = this.currentPath ? '?folder=' + encodeURIComponent(this.currentPath) : '';
        window.location.href = window.location.pathname + path;
    };

    // 添加重命名表单提交处理
    const renameForm = document.getElementById('renameFolderForm');
    if (renameForm) {
        renameForm.addEventListener('submit', (e) => window.folderUI.handleRenameFolder(e));
    }
    
    console.log('文件夹 UI 已初始化', window.folderUI);
});

// 自定义确认对话框
function showConfirmDialog(title, message, onConfirm, onCancel = null) {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
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
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        animation: scaleIn 0.2s ease-out;
    `;
    
    dialog.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">
                ${title}
            </h3>
            <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
                ${message}
            </p>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancelBtn" style="
                padding: 10px 20px;
                border: 1px solid #d1d5db;
                background: white;
                color: #374151;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">取消</button>
            <button id="confirmBtn" style="
                padding: 10px 20px;
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
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const confirmBtn = dialog.querySelector('#confirmBtn');
    
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
    
    // 关闭对话框
    const closeDialog = () => {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => overlay.remove(), 200);
    };
    
    // 取消按钮
    cancelBtn.addEventListener('click', () => {
        closeDialog();
        if (onCancel) onCancel();
    });
    
    // 确定按钮
    confirmBtn.addEventListener('click', () => {
        closeDialog();
        if (onConfirm) onConfirm();
    });
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
            if (onCancel) onCancel();
        }
    });
    
    // ESC键关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// 添加动画样式
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
        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
}

// 确认删除文件
function confirmDeleteFile(fileId, fileName) {
    showConfirmDialog(
        '确定要删除这个文件吗？',
        `文件名：${fileName}`,
        () => {
            document.getElementById('deleteFileForm_' + fileId).submit();
        }
    );
}

// 确认删除笔记
function confirmDeleteNote(noteId) {
    showConfirmDialog(
        '确定要删除这条笔记吗？',
        '删除后无法恢复。',
        () => {
            document.getElementById('deleteNoteForm_' + noteId).submit();
        }
    );
}

// 确认退出
function confirmLogout(form) {
    showConfirmDialog(
        '确定要退出隐私空间吗？',
        '退出后需要重新输入密码才能访问。',
        () => {
            form.submit();
        }
    );
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

// 多文件上传功能
class MultiFileUploader {
    constructor() {
        this.selectedFiles = [];
        this.initElements();
        this.bindEvents();
    }
    
    initElements() {
        this.uploadArea = document.getElementById('multiUploadArea');
        this.fileInput = document.getElementById('multiFileInput');
        this.selectBtn = document.getElementById('selectFilesBtn');
        this.previewArea = document.getElementById('filePreviewArea');
        this.previewGrid = document.getElementById('filePreviewGrid');
        this.fileCount = document.getElementById('fileCount');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.uploadAllBtn = document.getElementById('uploadAllBtn');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
    }
    
    bindEvents() {
        if (this.selectBtn) {
            this.selectBtn.addEventListener('click', () => this.fileInput.click());
        }
        
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        }
        
        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => this.clearAll());
        }
        
        if (this.uploadAllBtn) {
            this.uploadAllBtn.addEventListener('click', () => this.uploadAll());
        }
        
        // 拖拽上传
        if (this.uploadArea) {
            this.uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.uploadArea.classList.add('border-purple-500', 'bg-purple-50');
            });
            
            this.uploadArea.addEventListener('dragleave', () => {
                this.uploadArea.classList.remove('border-purple-500', 'bg-purple-50');
            });
            
            this.uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                this.uploadArea.classList.remove('border-purple-500', 'bg-purple-50');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }
    }
    
    handleFileSelect(files) {
        if (!files || files.length === 0) return;
        
        Array.from(files).forEach(file => {
            if (file.size <= 10 * 1024 * 1024) {
                this.addFile(file);
            } else {
                showFloatingNotification(`文件 ${file.name} 超过10MB限制`, 'error');
            }
        });
        
        this.updateUI();
    }
    
    addFile(file) {
        const fileData = {
            file: file,
            id: Date.now() + Math.random(),
            name: file.name
        };
        
        this.selectedFiles.push(fileData);
        this.renderPreview(fileData);
    }
    
    renderPreview(fileData) {
        const previewItem = document.createElement('div');
        previewItem.className = 'relative bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm p-4';
        previewItem.dataset.fileId = fileData.id;
        
        // 获取文件图标
        const ext = fileData.file.name.split('.').pop().toLowerCase();
        let icon = 'fa-file';
        let iconColor = 'text-gray-500';
        
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
            icon = 'fa-file-image';
            iconColor = 'text-blue-500';
        } else if (ext === 'pdf') {
            icon = 'fa-file-pdf';
            iconColor = 'text-red-500';
        } else if (['doc', 'docx'].includes(ext)) {
            icon = 'fa-file-word';
            iconColor = 'text-blue-600';
        } else if (['xls', 'xlsx'].includes(ext)) {
            icon = 'fa-file-excel';
            iconColor = 'text-green-600';
        } else if (['zip', 'rar', '7z'].includes(ext)) {
            icon = 'fa-file-archive';
            iconColor = 'text-yellow-600';
        } else if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) {
            icon = 'fa-file-video';
            iconColor = 'text-purple-500';
        } else if (['mp3', 'wav', 'flac'].includes(ext)) {
            icon = 'fa-file-audio';
            iconColor = 'text-pink-500';
        }
        
        const sizeMB = (fileData.file.size / (1024 * 1024)).toFixed(2);
        
        previewItem.innerHTML = `
            <button type="button" class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors" onclick="multiUploader.removeFile('${fileData.id}')">
                <i class="fas fa-times"></i>
            </button>
            <div class="text-center">
                <i class="fas ${icon} ${iconColor} text-4xl mb-2"></i>
                <p class="text-sm text-gray-800 truncate" title="${fileData.name}">${fileData.name}</p>
                <p class="text-xs text-gray-500">${sizeMB} MB</p>
            </div>
        `;
        
        this.previewGrid.appendChild(previewItem);
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
        this.updateUI();
    }
    
    updateUI() {
        const count = this.selectedFiles.length;
        this.fileCount.textContent = count;
        
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
        
        let uploaded = 0;
        let failed = 0;
        
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const fileData = this.selectedFiles[i];
            const progress = ((i + 1) / this.selectedFiles.length) * 100;
            
            this.progressBar.style.width = progress + '%';
            this.progressText.textContent = `正在上传 ${i + 1}/${this.selectedFiles.length}: ${fileData.file.name}`;
            
            try {
                await this.uploadSingleFile(fileData);
                uploaded++;
            } catch (error) {
                console.error('上传失败:', error);
                failed++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.progressBar.style.width = '100%';
        
        if (uploaded > 0) {
            this.progressText.textContent = `上传完成！成功 ${uploaded} 个${failed > 0 ? `，失败 ${failed} 个` : ''}`;
            showFloatingNotification(`成功上传 ${uploaded} 个文件！`, 'success');
            setTimeout(() => window.location.reload(), 2000);
        } else {
            this.progressText.textContent = '所有文件上传失败';
            showFloatingNotification('所有文件上传失败', 'error');
            this.resetUploadUI();
        }
    }
    
    async uploadSingleFile(fileData) {
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('action', 'upload');
        formData.append('csrf_token', document.querySelector('meta[name="csrf-token"]').content);
        
        // 添加文件夹路径
        const folderSelect = document.getElementById('privateFolderSelect');
        const selectedFolder = folderSelect ? folderSelect.value : '';
        formData.append('folder_path', selectedFolder);
        
        const response = await fetch('./api/private-files.php', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
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

// 初始化多文件上传器
let multiUploader;
document.addEventListener('DOMContentLoaded', function() {
    multiUploader = new MultiFileUploader();
});

// 批量选择模式
let selectMode = false;

function toggleSelectMode() {
    selectMode = !selectMode;
    const checkboxes = document.querySelectorAll('.file-checkbox');
    const actions = document.querySelectorAll('.file-actions');
    const toggleBtn = document.getElementById('toggleSelectMode');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const downloadBtn = document.getElementById('downloadSelectedBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    
    if (selectMode) {
        checkboxes.forEach(cb => cb.classList.remove('hidden'));
        actions.forEach(a => a.classList.add('hidden'));
        toggleBtn.innerHTML = '<i class="fas fa-times mr-1"></i>取消选择';
        toggleBtn.classList.add('bg-gray-200');
        deleteBtn.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        selectAllBtn.classList.remove('hidden');
    } else {
        checkboxes.forEach(cb => {
            cb.classList.add('hidden');
            cb.querySelector('input').checked = false;
        });
        actions.forEach(a => a.classList.remove('hidden'));
        toggleBtn.innerHTML = '<i class="fas fa-check-square mr-1"></i>批量选择';
        toggleBtn.classList.remove('bg-gray-200');
        deleteBtn.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        selectAllBtn.classList.add('hidden');
        document.getElementById('selectedCount').textContent = '0';
    }
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.file-checkbox input:checked').length;
    const total = document.querySelectorAll('.file-checkbox input').length;
    document.getElementById('selectedCount').textContent = checked;
    
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const downloadBtn = document.getElementById('downloadSelectedBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    
    if (checked > 0) {
        deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        deleteBtn.disabled = false;
        downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        downloadBtn.disabled = false;
    } else {
        deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        deleteBtn.disabled = true;
        downloadBtn.classList.add('opacity-50', 'cursor-not-allowed');
        downloadBtn.disabled = true;
    }
    
    // 更新全选按钮文字
    if (checked === total && total > 0) {
        selectAllBtn.innerHTML = '<i class="fas fa-square mr-1"></i>取消全选';
    } else {
        selectAllBtn.innerHTML = '<i class="fas fa-check-double mr-1"></i>全选';
    }
}

function selectAllFiles() {
    const checkboxes = document.querySelectorAll('.file-checkbox input');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    updateSelectedCount();
}

function downloadSelectedFiles() {
    const checkedBoxes = document.querySelectorAll('.file-checkbox input:checked');
    if (checkedBoxes.length === 0) {
        showFloatingNotification('请先选择要下载的文件', 'error');
        return;
    }
    
    // 逐个下载文件
    checkedBoxes.forEach((cb, index) => {
        const fileItem = cb.closest('.file-item');
        if (fileItem) {
            const downloadLink = fileItem.querySelector('a[download]');
            if (downloadLink) {
                // 延迟下载避免浏览器阻止
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = downloadLink.href;
                    link.download = downloadLink.download;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, index * 500);
            }
        }
    });
    
    showFloatingNotification(`开始下载 ${checkedBoxes.length} 个文件`, 'success');
}

async function deleteSelectedFiles() {
    const checkedBoxes = document.querySelectorAll('.file-checkbox input:checked');
    if (checkedBoxes.length === 0) {
        showFloatingNotification('请先选择要删除的文件', 'error');
        return;
    }
    
    const fileIds = [];
    checkedBoxes.forEach(cb => {
        const fileItem = cb.closest('.file-item');
        if (fileItem) {
            fileIds.push(fileItem.dataset.fileId);
        }
    });
    
    showConfirmDialog(
        '确定要删除选中的文件吗？',
        `将删除 ${fileIds.length} 个文件，此操作无法撤销。`,
        async () => {
            let deleted = 0;
            let failed = 0;
            
            for (const fileId of fileIds) {
                try {
                    const formData = new FormData();
                    formData.append('action', 'delete');
                    formData.append('file_id', fileId);
                    formData.append('csrf_token', document.querySelector('meta[name="csrf-token"]').content);
                    
                    const response = await fetch('./api/private-files.php', {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        deleted++;
                        // 移除DOM元素
                        const fileItem = document.querySelector(`.file-item[data-file-id="${fileId}"]`);
                        if (fileItem) fileItem.remove();
                    } else {
                        failed++;
                    }
                } catch (error) {
                    console.error('删除失败:', error);
                    failed++;
                }
            }
            
            if (deleted > 0) {
                showFloatingNotification(`成功删除 ${deleted} 个文件${failed > 0 ? `，${failed} 个失败` : ''}`, 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showFloatingNotification('删除失败', 'error');
            }
        }
    );
}
</script>

<?php include 'includes/footer.php'; ?>
