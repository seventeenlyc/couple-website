<?php
/**
 * 文件夹列表渲染组件
 * 显示文件夹和文件的列表视图
 */

if (!defined('INCLUDED')) {
    die('Direct access not permitted');
}

/**
 * 渲染文件夹列表
 * @param array $folders 文件夹数组
 * @param string $context 上下文 ('album' 或 'private')
 * @return string HTML 输出
 */
function renderFolderList($folders, $context = 'album') {
    if (empty($folders)) {
        return '';
    }
    
    $html = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">';
    
    foreach ($folders as $folder) {
        $folderName = htmlspecialchars($folder['name']);
        $folderPath = htmlspecialchars($folder['path']);
        $createdAt = isset($folder['created_at']) ? date('Y-m-d', strtotime($folder['created_at'])) : '';
        
        $html .= '
        <div class="folder-item card p-4 hover:shadow-lg transition-shadow duration-300 cursor-pointer group">
            <a href="?folder=' . urlencode($folderPath) . '" class="block">
                <div class="text-center mb-3">
                    <i class="fas fa-folder text-6xl text-yellow-500 group-hover:text-yellow-600 transition-colors"></i>
                </div>
                <h3 class="text-center font-semibold text-gray-800 mb-1 truncate" title="' . $folderName . '">
                    ' . $folderName . '
                </h3>
                ' . ($createdAt ? '<p class="text-xs text-gray-500 text-center">' . $createdAt . '</p>' : '') . '
            </a>
            
            <!-- 文件夹操作按钮 -->
            <div class="mt-3 pt-3 border-t border-gray-200 flex justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onclick="event.preventDefault(); folderUI.showRenameModal(\'' . $folderPath . '\', \'' . $folderName . '\')"
                    class="text-blue-600 hover:text-blue-800 text-sm"
                    title="重命名"
                >
                    <i class="fas fa-edit"></i>
                </button>
                <button 
                    onclick="event.preventDefault(); folderUI.showDeleteConfirm(\'' . $folderPath . '\', \'' . $folderName . '\')"
                    class="text-red-600 hover:text-red-800 text-sm"
                    title="删除"
                >
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>';
    }
    
    $html .= '</div>';
    
    return $html;
}

/**
 * 渲染文件列表（照片或私密文件）
 * @param array $files 文件数组
 * @param string $type 文件类型 ('photo' 或 'file')
 * @param string $context 上下文 ('album' 或 'private')
 * @return string HTML 输出
 */
function renderFileList($files, $type = 'photo', $context = 'album') {
    if (empty($files)) {
        return '<div class="card p-8 text-center">
            <div class="text-6xl mb-4">📁</div>
            <h3 class="text-2xl font-semibold text-gray-800 mb-2">此文件夹为空</h3>
            <p class="text-gray-600">上传文件开始使用此文件夹</p>
        </div>';
    }
    
    if ($type === 'photo') {
        return renderPhotoGrid($files, $context);
    } else {
        return renderFileGrid($files, $context);
    }
}

/**
 * 渲染照片网格
 */
function renderPhotoGrid($photos, $context) {
    $html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
    
    foreach ($photos as $photo) {
        $photoId = htmlspecialchars($photo['id'] ?? '');
        $photoPath = htmlspecialchars($photo['path'] ?? '');
        $photoTitle = htmlspecialchars($photo['title'] ?? '无标题');
        $photoDesc = htmlspecialchars($photo['description'] ?? '');
        $uploadedBy = htmlspecialchars($photo['uploaded_by'] ?? '未知');
        $uploadedAt = isset($photo['uploaded_at']) ? date('m-d H:i', strtotime($photo['uploaded_at'])) : '';
        
        $html .= '
        <div class="card overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div class="relative group">
                <img 
                    src="' . $photoPath . '" 
                    alt="' . $photoTitle . '"
                    class="w-full h-64 object-cover cursor-pointer"
                    onclick="openPhotoModal(\'' . $photoId . '\')"
                >
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 space-x-2">
                        <button 
                            onclick="openPhotoModal(\'' . $photoId . '\')"
                            class="bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100"
                        >
                            <i class="fas fa-eye mr-1"></i>查看
                        </button>
                        <button 
                            onclick="folderUI.showMoveFileModal(\'' . $photoId . '\', \'' . $photoTitle . '\')"
                            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                        >
                            <i class="fas fa-arrows-alt mr-1"></i>移动
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="p-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">' . $photoTitle . '</h3>
                ' . ($photoDesc ? '<p class="text-gray-600 text-sm mb-3">' . $photoDesc . '</p>' : '') . '
                
                <div class="text-xs text-gray-500 flex justify-between items-center">
                    <span><i class="fas fa-user mr-1"></i>' . $uploadedBy . '</span>
                    <span><i class="fas fa-clock mr-1"></i>' . $uploadedAt . '</span>
                </div>
            </div>
        </div>';
    }
    
    $html .= '</div>';
    
    return $html;
}

/**
 * 渲染文件网格（私密文件）
 */
function renderFileGrid($files, $context) {
    $html = '<div class="space-y-3">';
    
    foreach ($files as $file) {
        $fileId = htmlspecialchars($file['id'] ?? '');
        $fileName = htmlspecialchars($file['filename'] ?? '未命名文件');
        $fileType = htmlspecialchars($file['type'] ?? 'file');
        $uploadedBy = htmlspecialchars($file['uploaded_by'] ?? '未知');
        $uploadedAt = isset($file['uploaded_at']) ? date('Y-m-d H:i', strtotime($file['uploaded_at'])) : '';
        
        // 根据文件类型选择图标
        $icon = 'fa-file';
        if (strpos($fileType, 'image') !== false) {
            $icon = 'fa-file-image';
        } elseif (strpos($fileType, 'pdf') !== false) {
            $icon = 'fa-file-pdf';
        } elseif (strpos($fileType, 'word') !== false || strpos($fileType, 'document') !== false) {
            $icon = 'fa-file-word';
        } elseif (strpos($fileType, 'excel') !== false || strpos($fileType, 'spreadsheet') !== false) {
            $icon = 'fa-file-excel';
        }
        
        $html .= '
        <div class="card p-4 hover:shadow-md transition-shadow duration-300 flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <i class="fas ' . $icon . ' text-3xl text-blue-500"></i>
                <div>
                    <h4 class="font-semibold text-gray-800">' . $fileName . '</h4>
                    <p class="text-xs text-gray-500">
                        <i class="fas fa-user mr-1"></i>' . $uploadedBy . ' • 
                        <i class="fas fa-clock mr-1"></i>' . $uploadedAt . '
                    </p>
                </div>
            </div>
            
            <div class="flex space-x-2">
                <button 
                    onclick="folderUI.showMoveFileModal(\'' . $fileId . '\', \'' . $fileName . '\')"
                    class="text-blue-600 hover:text-blue-800"
                    title="移动文件"
                >
                    <i class="fas fa-arrows-alt"></i>
                </button>
                <a 
                    href="' . htmlspecialchars($file['path'] ?? '#') . '" 
                    download
                    class="text-green-600 hover:text-green-800"
                    title="下载文件"
                >
                    <i class="fas fa-download"></i>
                </a>
            </div>
        </div>';
    }
    
    $html .= '</div>';
    
    return $html;
}
?>
