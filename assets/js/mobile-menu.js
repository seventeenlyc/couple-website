/**
 * 移动端菜单功能
 * 独立文件，避免与其他 JavaScript 冲突
 */

(function() {
    'use strict';
    
    // 立即执行函数，避免全局变量污染
    function initMobileMenu() {
        console.log('[Mobile Menu] 初始化开始');
        
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (!mobileMenuButton) {
            console.error('[Mobile Menu] 找不到菜单按钮元素');
            return;
        }
        
        if (!mobileMenu) {
            console.error('[Mobile Menu] 找不到菜单元素');
            return;
        }
        
        console.log('[Mobile Menu] 元素找到成功');
        console.log('[Mobile Menu] 按钮:', mobileMenuButton);
        console.log('[Mobile Menu] 菜单:', mobileMenu);
        
        // 移除可能存在的旧事件监听器
        const newButton = mobileMenuButton.cloneNode(true);
        mobileMenuButton.parentNode.replaceChild(newButton, mobileMenuButton);
        
        // 绑定点击事件
        newButton.addEventListener('click', function(e) {
            console.log('[Mobile Menu] 按钮被点击');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            mobileMenu.classList.toggle('hidden');
            
            const isHidden = mobileMenu.classList.contains('hidden');
            console.log('[Mobile Menu] 菜单状态:', isHidden ? '隐藏' : '显示');
            console.log('[Mobile Menu] 菜单类名:', mobileMenu.className);
        }, true); // 使用捕获阶段
        
        // 点击菜单外部关闭菜单
        document.addEventListener('click', function(event) {
            if (!mobileMenu.contains(event.target) && !newButton.contains(event.target)) {
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    console.log('[Mobile Menu] 点击外部，菜单已关闭');
                }
            }
        });
        
        console.log('[Mobile Menu] 初始化完成');
    }
    
    // 确保在 DOM 加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileMenu);
    } else {
        // DOM 已经加载完成，立即执行
        initMobileMenu();
    }
})();
