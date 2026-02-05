/**
 * AI功能前端JavaScript
 * 处理每日情话和纪念日提醒的加载和显示
 */

/**
 * 加载每日情话
 * @param {number} retryCount - 重试次数（默认0）
 */
function loadDailyQuote(retryCount = 0) {
    const loadingEl = document.getElementById('quote-loading');
    const contentEl = document.getElementById('quote-content');
    const errorEl = document.getElementById('quote-error');
    const quoteTextEl = document.getElementById('quote-text');
    
    // 显示加载状态
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';
    
    // 发送AJAX请求
    fetch('api/daily-quote.php')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // 更新情话内容
                quoteTextEl.textContent = `"${data.quote}"`;
                
                // 显示内容，隐藏加载状态
                loadingEl.style.display = 'none';
                contentEl.style.display = 'block';
            } else {
                throw new Error(data.error || '加载失败');
            }
        })
        .catch(error => {
            console.error('加载每日情话失败:', error);
            
            // 重试逻辑（最多重试2次）
            if (retryCount < 2) {
                console.log(`重试加载每日情话 (${retryCount + 1}/2)...`);
                setTimeout(() => {
                    loadDailyQuote(retryCount + 1);
                }, 1000 * (retryCount + 1)); // 递增延迟
            } else {
                // 显示错误状态
                loadingEl.style.display = 'none';
                errorEl.style.display = 'block';
            }
        });
}

/**
 * 加载纪念日提醒
 * @param {number} retryCount - 重试次数（默认0）
 */
function loadAnniversaryReminders(retryCount = 0) {
    const loadingEl = document.getElementById('reminders-loading');
    const listEl = document.getElementById('reminders-list');
    const noRemindersEl = document.getElementById('no-reminders');
    const errorEl = document.getElementById('reminders-error');
    
    // 显示加载状态
    loadingEl.style.display = 'block';
    listEl.style.display = 'none';
    noRemindersEl.style.display = 'none';
    errorEl.style.display = 'none';
    
    // 发送AJAX请求
    fetch('api/anniversary-reminders.php')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                loadingEl.style.display = 'none';
                
                if (data.count > 0) {
                    // 显示提醒列表
                    listEl.innerHTML = '';
                    data.reminders.forEach(reminder => {
                        const card = createReminderCard(reminder);
                        listEl.appendChild(card);
                    });
                    listEl.style.display = 'block';
                } else {
                    // 显示无提醒状态
                    noRemindersEl.style.display = 'block';
                }
            } else {
                throw new Error(data.error || '加载失败');
            }
        })
        .catch(error => {
            console.error('加载纪念日提醒失败:', error);
            
            // 重试逻辑（最多重试2次）
            if (retryCount < 2) {
                console.log(`重试加载纪念日提醒 (${retryCount + 1}/2)...`);
                setTimeout(() => {
                    loadAnniversaryReminders(retryCount + 1);
                }, 1000 * (retryCount + 1)); // 递增延迟
            } else {
                // 显示错误状态
                loadingEl.style.display = 'none';
                errorEl.style.display = 'block';
            }
        });
}

/**
 * 创建纪念日提醒卡片
 * @param {Object} reminder - 纪念日提醒数据
 * @returns {HTMLElement} 卡片元素
 */
function createReminderCard(reminder) {
    const card = document.createElement('div');
    card.className = 'bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 border border-pink-200 transition-all duration-300 hover:shadow-md';
    
    // 确定颜色主题
    let iconColor = 'text-pink-500';
    if (reminder.type === 'yearly') {
        iconColor = 'text-red-500';
    } else if (reminder.type === 'special') {
        iconColor = 'text-purple-500';
    }
    
    // 倒计时文本
    let countdownText = '';
    if (reminder.days_until === 0) {
        countdownText = '<span class="text-red-600 font-bold">今天</span>';
    } else if (reminder.days_until === 1) {
        countdownText = '<span class="text-orange-600 font-bold">明天</span>';
    } else {
        countdownText = `还有 <span class="font-bold text-pink-600">${reminder.days_until}</span> 天`;
    }
    
    card.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex-1">
                <div class="flex items-center mb-2">
                    <i class="fas fa-heart ${iconColor} mr-2"></i>
                    <h4 class="font-semibold text-gray-800">${escapeHtml(reminder.name)}</h4>
                </div>
                <p class="text-sm text-gray-600 mb-2">${escapeHtml(reminder.message)}</p>
                <div class="flex items-center text-sm text-gray-500">
                    <i class="far fa-calendar mr-1"></i>
                    <span>${escapeHtml(reminder.date)}</span>
                    <span class="mx-2">•</span>
                    <span>${countdownText}</span>
                </div>
            </div>
            <div class="text-3xl ml-3">
                ${reminder.icon}
            </div>
        </div>
    `;
    
    return card;
}

/**
 * HTML转义函数，防止XSS攻击
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 初始化AI功能
 * 在页面加载完成后自动调用
 */
function initAIFeatures() {
    // 检查必需的DOM元素是否存在
    if (document.getElementById('daily-quote-container')) {
        loadDailyQuote();
    }
    
    if (document.getElementById('anniversary-reminders-section')) {
        loadAnniversaryReminders();
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAIFeatures);
} else {
    // DOM已经加载完成
    initAIFeatures();
}
