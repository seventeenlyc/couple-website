/**
 * H5 移动端设备切换组件
 * 提供切换到桌面端的入口，并记住用户选择
 */
(function() {
  'use strict';

  // 创建切换入口（集成到"我们"页面的功能列表）
  function createSwitchEntry() {
    // 等待 DOM 加载完成
    const checkInterval = setInterval(() => {
      // 查找"我们"页面的功能入口容器（在退出按钮之前）
      const logoutBtn = document.getElementById('h5LogoutBtn');
      if (!logoutBtn) return;
      
      clearInterval(checkInterval);
      
      // 创建切换入口卡片
      const switchCard = document.createElement('div');
      switchCard.id = 'deviceSwitchCard';
      switchCard.style.cssText = 'margin:0 20px 16px; background:var(--color-surface); border-radius:var(--radius-sm); border:1px solid var(--color-divider); overflow:hidden;';
      switchCard.innerHTML = `
        <div style="padding:16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:12px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <div>
              <span style="font-size:16px; font-weight:500;">切换到桌面版</span>
              <span style="font-size:13px; color:var(--color-muted); margin-left:8px;">更多功能与操作</span>
            </div>
          </div>
          <span style="font-size:14px; color:var(--color-muted);">↗</span>
        </div>
      `;
      switchCard.addEventListener('click', switchToDesktop);
      
      // 插入到退出按钮之前（父容器的子节点）
      if (logoutBtn.parentElement) {
        logoutBtn.parentElement.insertBefore(switchCard, logoutBtn);
      }
    }, 100);
    
    // 5秒后停止检查
    setTimeout(() => clearInterval(checkInterval), 5000);
  }

  // 切换到桌面端
  window.switchToDesktop = function() {
    if (typeof DeviceRouter !== 'undefined') {
      DeviceRouter.switchTo('desktop', true);
    } else {
      // 兜底：直接跳转
      window.location.href = '/desktop/index.html';
    }
  };

  // 检查视口大小，桌面尺寸时显示提示
  function checkViewportSize() {
    const isDesktopSize = window.innerWidth >= 1024;
    const card = document.getElementById('deviceSwitchCard');
    
    if (card && isDesktopSize) {
      // 添加提示样式
      card.style.borderColor = 'var(--color-accent)';
      card.style.animation = 'pulse-hint 2s ease-in-out infinite';
    } else if (card) {
      card.style.borderColor = 'var(--color-divider)';
      card.style.animation = 'none';
    }
  }

  // 添加动画样式
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-hint {
        0%, 100% {
          box-shadow: 0 0 0 rgba(201, 162, 75, 0);
        }
        50% {
          box-shadow: 0 0 12px rgba(201, 162, 75, 0.3);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 初始化
  function init() {
    addStyles();
    createSwitchEntry();
    
    // 监听窗口变化
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkViewportSize, 150);
    });
    
    // 初始检查
    setTimeout(checkViewportSize, 1000);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
