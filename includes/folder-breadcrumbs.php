<?php
/**
 * 面包屑导航组件
 * 显示当前文件夹路径的导航
 */

if (!defined('INCLUDED')) {
    die('Direct access not permitted');
}

require_once 'folder-helper.php';

/**
 * 渲染面包屑导航
 * @param string $currentPath 当前文件夹路径
 * @param string $context 上下文 ('album' 或 'private')
 * @return string HTML 输出
 */
function renderBreadcrumbs($currentPath = '', $context = 'album') {
    $breadcrumbs = generateBreadcrumbs($currentPath);
    
    if (empty($breadcrumbs)) {
        return '';
    }
    
    $html = '<nav class="flex items-center space-x-2 text-sm mb-4 p-3 bg-gray-50 rounded-lg">';
    $html .= '<i class="fas fa-folder-open text-blue-500"></i>';
    
    foreach ($breadcrumbs as $index => $crumb) {
        $isLast = ($index === count($breadcrumbs) - 1);
        
        if ($isLast) {
            // 当前文件夹 - 不可点击
            $html .= '<span class="text-gray-800 font-semibold">' . htmlspecialchars($crumb['name']) . '</span>';
        } else {
            // 可点击的面包屑
            $html .= '<a href="?folder=' . urlencode($crumb['path']) . '" class="text-blue-600 hover:text-blue-800 hover:underline">';
            $html .= htmlspecialchars($crumb['name']);
            $html .= '</a>';
            $html .= '<i class="fas fa-chevron-right text-gray-400 text-xs"></i>';
        }
    }
    
    $html .= '</nav>';
    
    return $html;
}
?>
