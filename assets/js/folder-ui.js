/**
 * 文件夹 UI 管理模块
 * 提供文件夹创建、重命名、删除、移动等 UI 功能
 */

class FolderUI {
    constructor(context = 'album') {
        this.context = context; // 'album' 或 'private'
        this.currentPath = '';
        this.csrfToken = '';
        this.init();
    }

    /**
     * 初始化文件夹 UI
     */
    init() {
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        this.attachEventListeners();
    }

    /**
     * 附加事件监听器
     */
    attachEventListeners() {
        // 创建文件夹按钮
        const createBtn = document.getElementById('createFolderBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateModal());
        }

        // 创建文件夹表单提交
        const createForm = document.getElementById('createFolderForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreateFolder(e));
        }

        // 关闭模态框按钮
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // 点击模态框背景关闭
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeAllModals();
                }
            });
        });

        // ESC 键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    /**
     * 显示创建文件夹模态框
     */
    showCreateModal() {
        const modal = document.getElementById('createFolderModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('folderName')?.focus();
        }
    }

    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });
        // 清空表单
        document.querySelectorAll('.modal-overlay form').forEach(form => {
            form.reset();
        });
    }

    /**
     * 处理创建文件夹
     */
    async handleCreateFolder(e) {
        e.preventDefault();
        
        const form = e.target;
        const folderName = form.querySelector('#folderName').value.trim();
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!folderName) {
            this.showError('请输入文件夹名称');
            return;
        }

        // 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>创建中...';

        try {
            const response = await fetch('api/folders.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'create',
                    folder_name: folderName,
                    parent_path: this.currentPath,
                    context: this.context,
                    csrf_token: this.csrfToken
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('文件夹创建成功！');
                this.closeAllModals();
                // 刷新文件夹列表
                await this.refreshFolderList();
            } else {
                this.showError(data.message || '创建文件夹失败');
            }
        } catch (error) {
            console.error('创建文件夹错误:', error);
            this.showError('创建文件夹时发生错误');
        } finally {
            // 恢复提交按钮
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-folder-plus mr-2"></i>创建文件夹';
        }
    }

    /**
     * 显示重命名文件夹模态框
     */
    showRenameModal(folderPath, currentName) {
        const modal = document.getElementById('renameFolderModal');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('newFolderName');
            if (input) {
                input.value = currentName;
                input.dataset.folderPath = folderPath;
                input.focus();
                input.select();
            }
        }
    }

    /**
     * 处理重命名文件夹
     */
    async handleRenameFolder(e) {
        e.preventDefault();
        
        const form = e.target;
        const input = form.querySelector('#newFolderName');
        const newName = input.value.trim();
        const folderPath = input.dataset.folderPath;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!newName) {
            this.showError('请输入新的文件夹名称');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>重命名中...';

        try {
            const response = await fetch('api/folders.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'rename',
                    folder_path: folderPath,
                    new_name: newName,
                    context: this.context,
                    csrf_token: this.csrfToken
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('文件夹重命名成功！');
                this.closeAllModals();
                await this.refreshFolderList();
            } else {
                this.showError(data.message || '重命名文件夹失败');
            }
        } catch (error) {
            console.error('重命名文件夹错误:', error);
            this.showError('重命名文件夹时发生错误');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-edit mr-2"></i>重命名';
        }
    }

    /**
     * 显示删除文件夹确认
     */
    showDeleteConfirm(folderPath, folderName, hasContent = false) {
        const message = hasContent 
            ? `此文件夹包含文件或子文件夹，删除后将无法恢复！`
            : `删除后将无法恢复`;
        
        const title = `确定要删除文件夹"${folderName}"吗？`;
        
        this.showCustomConfirm(title, message, () => {
            this.handleDeleteFolder(folderPath);
        });
    }

    /**
     * 显示自定义确认对话框
     */
    showCustomConfirm(title, message, onConfirm) {
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
                <button id="cancelBtn" style="
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
                <button id="confirmBtn" style="
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

        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            overlay.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => overlay.remove(), 200);
        });

        // 确定按钮
        confirmBtn.addEventListener('click', () => {
            overlay.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => overlay.remove(), 200);
            if (onConfirm) onConfirm();
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => overlay.remove(), 200);
            }
        });

        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => overlay.remove(), 200);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

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

    /**
     * 处理删除文件夹
     */
    async handleDeleteFolder(folderPath) {
        try {
            const response = await fetch('api/folders.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'delete',
                    folder_path: folderPath,
                    context: this.context,
                    csrf_token: this.csrfToken
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`文件夹删除成功！删除了 ${data.deleted_count} 个项目`);
                await this.refreshFolderList();
            } else {
                this.showError(data.message || '删除文件夹失败');
            }
        } catch (error) {
            console.error('删除文件夹错误:', error);
            this.showError('删除文件夹时发生错误');
        }
    }

    /**
     * 显示移动文件对话框
     */
    async showMoveFileModal(fileId, fileName) {
        const modal = document.getElementById('moveFileModal');
        if (!modal) return;

        // 加载文件夹列表
        await this.loadFolderTree(fileId);
        
        modal.classList.remove('hidden');
        modal.dataset.fileId = fileId;
        modal.dataset.fileName = fileName;
        
        document.getElementById('moveFileName').textContent = fileName;
    }

    /**
     * 加载文件夹树
     */
    async loadFolderTree(fileId) {
        try {
            const response = await fetch(`api/folders.php?action=list&context=${this.context}`);
            const data = await response.json();

            if (data.success) {
                this.renderFolderTree(data.folders);
            }
        } catch (error) {
            console.error('加载文件夹树错误:', error);
        }
    }

    /**
     * 渲染文件夹树
     */
    renderFolderTree(folders) {
        const container = document.getElementById('folderTreeContainer');
        if (!container) return;

        let html = `
            <div class="folder-tree-item" data-path="">
                <i class="fas fa-home mr-2"></i>
                <span>根目录</span>
            </div>
        `;

        folders.forEach(folder => {
            html += `
                <div class="folder-tree-item" data-path="${folder.path}">
                    <i class="fas fa-folder mr-2 text-yellow-500"></i>
                    <span>${folder.name}</span>
                </div>
            `;
        });

        container.innerHTML = html;

        // 添加点击事件
        container.querySelectorAll('.folder-tree-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.folder-tree-item').forEach(i => 
                    i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
    }

    /**
     * 处理移动文件
     */
    async handleMoveFile() {
        const modal = document.getElementById('moveFileModal');
        const fileId = modal.dataset.fileId;
        const selectedFolder = document.querySelector('.folder-tree-item.selected');
        
        if (!selectedFolder) {
            this.showError('请选择目标文件夹');
            return;
        }

        const targetPath = selectedFolder.dataset.path;

        try {
            const response = await fetch('api/folders.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'move_file',
                    file_id: fileId,
                    target_folder: targetPath,
                    context: this.context,
                    csrf_token: this.csrfToken
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('文件移动成功！');
                this.closeAllModals();
                await this.refreshFolderList();
            } else {
                this.showError(data.message || '移动文件失败');
            }
        } catch (error) {
            console.error('移动文件错误:', error);
            this.showError('移动文件时发生错误');
        }
    }

    /**
     * 刷新文件夹列表
     */
    async refreshFolderList() {
        // 重新加载页面或使用 AJAX 刷新
        window.location.reload();
    }

    /**
     * 导航到文件夹
     */
    navigateToFolder(folderPath) {
        this.currentPath = folderPath;
        this.refreshFolderList();
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        this.showMessage(message, 'error');
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
            type === 'success' ? 'bg-green-100 text-green-700 border border-green-400' :
            type === 'error' ? 'bg-red-100 text-red-700 border border-red-400' :
            'bg-blue-100 text-blue-700 border border-blue-400'
        }`;
        
        messageDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${
                    type === 'success' ? 'fa-check-circle' :
                    type === 'error' ? 'fa-exclamation-circle' :
                    'fa-info-circle'
                } mr-2"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(messageDiv);

        // 3秒后自动移除
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 300);
        }, 3000);
    }
}

// 导出供全局使用
window.FolderUI = FolderUI;
