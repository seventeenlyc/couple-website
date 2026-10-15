/**
 * 桌面端设备切换组件
 * 提供切换到移动端的入口，并记住用户选择
 */
(function() {
  'use strict';

  // 创建切换按钮
  function createSwitchButton() {
    const button = document.createElement('button');
    button.id = 'deviceSwitchBtn';
    button.className = 'device-switch-btn';
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
      <span>切换到移动版</span>
    `;
    button.title = '切换到移动端界面';
    button.onclick = switchToMobile;
    
    // 添加到页面
    document.body.appendChild(button);
  }

  // 切换到移动端
  function switchToMobile() {
    if (typeof DeviceRouter !== 'undefined') {
      DeviceRouter.switchTo('mobile', true);
    } else {
      // 兜底：直接跳转
      window.location.href = '/h5/index.html';
    }
  }

  // 检查是否需要显示提示（窗口缩小到移动尺寸）
  function checkViewportSize() {
    const isMobileSize = window.innerWidth < 1024;
    const button = document.getElementById('deviceSwitchBtn');
    
    if (button) {
      // 窗口缩小时增加提示效果
      if (isMobileSize) {
        button.classList.add('viewport-hint');
      } else {
        button.classList.remove('viewport-hint');
      }
    }
  }

  // 初始化
  function init() {
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .device-switch-btn {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 9998;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #d9cfc3);
        border-radius: 24px;
        font-size: 14px;
        font-weight: 500;
        color: var(--color-ink, #3d3935);
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      
      .device-switch-btn:hover {
        background: var(--color-surface-subtle, #f7f5f1);
        border-color: var(--color-accent, #c9a24b);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      .device-switch-btn svg {
        flex-shrink: 0;
      }
      
      .device-switch-btn.viewport-hint {
        animation: pulse-hint 2s ease-in-out infinite;
        border-color: var(--color-accent, #c9a24b);
      }
      
      @keyframes pulse-hint {
        0%, 100% {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        50% {
          box-shadow: 0 4px 16px rgba(201, 162, 75, 0.3);
        }
      }
      
      /* 移动端隐藏按钮 */
      @media (max-width: 768px) {
        .device-switch-btn {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
    
    // 创建按钮
    createSwitchButton();
    
    // 监听窗口变化
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkViewportSize, 150);
    });
    
    // 初始检查
    checkViewportSize();
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
