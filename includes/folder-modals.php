<?php
/**
 * 文件夹管理模态框组件
 * 包含创建、重命名、移动、删除文件夹的模态框
 */

if (!defined('INCLUDED')) {
    die('Direct access not permitted');
}
?>

<!-- 创建文件夹模态框 -->
<div id="createFolderModal" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg max-w-md w-full" onclick="event.stopPropagation()">
        <div class="p-6 border-b flex justify-between items-center">
            <h3 class="text-xl font-semibold text-gray-800">
                <i class="fas fa-folder-plus text-blue-500 mr-2"></i>
                创建新文件夹
            </h3>
            <button data-close-modal class="text-gray-500 hover:text-gray-700">
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
                <p class="text-xs text-gray-500 mt-1">
                    不能包含以下字符: / \ : * ? " &lt; &gt; |
                </p>
            </div>
            
            <div class="flex justify-end space-x-3">
                <button 
                    type="button" 
                    data-close-modal
                    class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    <i class="fas fa-times mr-2"></i>取消
                </button>
                <button 
                    type="submit" 
                    class="btn-primary"
                >
                    <i class="fas fa-folder-plus mr-2"></i>创建文件夹
                </button>
            </div>
        </form>
    </div>
</div>

<!-- 重命名文件夹模态框 -->
<div id="renameFolderModal" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg max-w-md w-full" onclick="event.stopPropagation()">
        <div class="p-6 border-b flex justify-between items-center">
            <h3 class="text-xl font-semibold text-gray-800">
                <i class="fas fa-edit text-blue-500 mr-2"></i>
                重命名文件夹
            </h3>
            <button data-close-modal class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <form id="renameFolderForm" class="p-6">
            <div class="mb-4">
                <label for="newFolderName" class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-tag mr-2 text-pink-500"></i>新文件夹名称 *
                </label>
                <input 
                    type="text" 
                    id="newFolderName" 
                    name="newFolderName" 
                    placeholder="输入新的文件夹名称"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    maxlength="255"
                >
                <p class="text-xs text-gray-500 mt-1">
                    不能包含以下字符: / \ : * ? " &lt; &gt; |
                </p>
            </div>
            
            <div class="flex justify-end space-x-3">
                <button 
                    type="button" 
                    data-close-modal
                    class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    <i class="fas fa-times mr-2"></i>取消
                </button>
                <button 
                    type="submit" 
                    class="btn-primary"
                >
                    <i class="fas fa-edit mr-2"></i>重命名
                </button>
            </div>
        </form>
    </div>
</div>

<!-- 移动文件模态框 -->
<div id="moveFileModal" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg max-w-md w-full" onclick="event.stopPropagation()">
        <div class="p-6 border-b flex justify-between items-center">
            <h3 class="text-xl font-semibold text-gray-800">
                <i class="fas fa-arrows-alt text-blue-500 mr-2"></i>
                移动文件
            </h3>
            <button data-close-modal class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <div class="p-6">
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2">
                    移动文件: <span id="moveFileName" class="font-semibold"></span>
                </p>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-folder-open mr-2 text-pink-500"></i>选择目标文件夹
                </label>
                <div id="folderTreeContainer" class="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <!-- 文件夹树将通过 JavaScript 动态加载 -->
                </div>
            </div>
            
            <div class="flex justify-end space-x-3">
                <button 
                    type="button" 
                    data-close-modal
                    class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    <i class="fas fa-times mr-2"></i>取消
                </button>
                <button 
                    type="button" 
                    onclick="folderUI.handleMoveFile()"
                    class="btn-primary"
                >
                    <i class="fas fa-arrows-alt mr-2"></i>移动
                </button>
            </div>
        </div>
    </div>
</div>

<style>
/* 文件夹树样式 */
.folder-tree-item {
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: background-color 0.2s;
}

.folder-tree-item:hover {
    background-color: #f3f4f6;
}

.folder-tree-item.selected {
    background-color: #dbeafe;
    border: 2px solid #3b82f6;
}
</style>
