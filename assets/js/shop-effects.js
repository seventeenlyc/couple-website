/**
 * 商城特效脚本
 * 实现点击星星特效、漂浮爱心、猫爪和小狗装饰
 */

// 初始化特效
document.addEventListener('DOMContentLoaded', function() {
    initFloatingHearts();
    initPawDecorations();
    initClickStarEffect();
});

/**
 * 初始化漂浮爱心背景
 */
function initFloatingHearts() {
    // 创建爱心容器
    const container = document.createElement('div');
    container.className = 'floating-hearts-container';
    container.id = 'floating-hearts';
    document.body.appendChild(container);
    
    // 定期生成爱心
    setInterval(() => {
        createFloatingHeart();
    }, 2000); // 每2秒生成一个爱心
    
    // 初始生成几个爱心
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createFloatingHeart(), i * 400);
    }
}

/**
 * 创建单个漂浮爱心
 */
function createFloatingHeart() {
    const container = document.getElementById('floating-hearts');
    if (!container) return;
    
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = '💕';
    
    // 随机水平位置
    heart.style.left = Math.random() * 100 + '%';
    
    // 随机动画延迟
    heart.style.animationDelay = Math.random() * 2 + 's';
    
    // 随机动画持续时间
    heart.style.animationDuration = (6 + Math.random() * 4) + 's';
    
    container.appendChild(heart);
    
    // 动画结束后移除元素
    setTimeout(() => {
        heart.remove();
    }, 10000);
}

/**
 * 初始化猫爪和小狗装饰
 */
function initPawDecorations() {
    // 猫爪装饰位置
    const pawPositions = [
        { top: '10%', left: '5%' },
        { top: '20%', right: '8%' },
        { bottom: '15%', left: '10%' },
        { bottom: '25%', right: '5%' }
    ];
    
    pawPositions.forEach((pos, index) => {
        const paw = document.createElement('div');
        paw.className = 'paw-decoration';
        paw.innerHTML = '<img src="assets/images/cat.svg" style="width: 40px; height: 40px;">';
        paw.style.animationDelay = (index * 0.5) + 's';
        
        Object.assign(paw.style, pos);
        document.body.appendChild(paw);
    });
    
    // 小狗装饰位置
    const dogPositions = [
        { top: '30%', left: '3%' },
        { bottom: '35%', right: '3%' }
    ];
    
    dogPositions.forEach((pos, index) => {
        const dog = document.createElement('div');
        dog.className = 'dog-decoration';
        dog.innerHTML = '<img src="assets/images/dog.svg" style="width: 60px; height: 60px;">';
        dog.style.animationDelay = (index * 1) + 's';
        
        Object.assign(dog.style, pos);
        document.body.appendChild(dog);
    });
}

/**
 * 初始化点击星星特效
 */
function initClickStarEffect() {
    document.addEventListener('click', function(e) {
        // 只在特定元素上触发
        const target = e.target;
        const shouldTrigger = target.closest('.btn-primary, .product-card, .task-card, .checkin-btn');
        
        if (shouldTrigger) {
            createStarBurst(e.clientX, e.clientY);
        }
    });
}

/**
 * 创建星星爆炸特效
 */
function createStarBurst(x, y) {
    const starCount = 8; // 星星数量
    const stars = ['⭐', '✨', '💫', '🌟'];
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star-effect';
        star.textContent = stars[Math.floor(Math.random() * stars.length)];
        
        // 计算星星飞出的方向
        const angle = (360 / starCount) * i;
        const distance = 50 + Math.random() * 50;
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        
        star.style.left = x + 'px';
        star.style.top = y + 'px';
        star.style.setProperty('--tx', tx + 'px');
        star.style.setProperty('--ty', ty + 'px');
        
        document.body.appendChild(star);
        
        // 动画结束后移除
        setTimeout(() => {
            star.remove();
        }, 800);
    }
}

/**
 * 创建爱心爆炸特效（用于特殊事件）
 */
function createHeartBurst(x, y) {
    const heartCount = 12;
    
    for (let i = 0; i < heartCount; i++) {
        const heart = document.createElement('div');
        heart.className = 'star-effect';
        heart.textContent = '💕';
        heart.style.fontSize = (15 + Math.random() * 10) + 'px';
        
        const angle = (360 / heartCount) * i;
        const distance = 60 + Math.random() * 60;
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        
        heart.style.left = x + 'px';
        heart.style.top = y + 'px';
        heart.style.setProperty('--tx', tx + 'px');
        heart.style.setProperty('--ty', ty + 'px');
        
        document.body.appendChild(heart);
        
        setTimeout(() => {
            heart.remove();
        }, 1000);
    }
}

/**
 * 创建成功特效（购买成功、签到成功等）
 */
function showSuccessEffect() {
    // 屏幕中心位置
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    
    createHeartBurst(x, y);
    
    // 额外的星星特效
    setTimeout(() => {
        createStarBurst(x, y);
    }, 200);
}

/**
 * 添加按钮猫爪效果
 */
function addPawEffectToButtons() {
    const buttons = document.querySelectorAll('.btn-primary, .btn-pink-gradient');
    buttons.forEach(btn => {
        if (!btn.classList.contains('btn-paw')) {
            btn.classList.add('btn-paw');
        }
    });
}

// 页面加载完成后添加猫爪效果
window.addEventListener('load', function() {
    addPawEffectToButtons();
});

// 导出函数供其他脚本使用
window.shopEffects = {
    createStarBurst,
    createHeartBurst,
    showSuccessEffect,
    createFloatingHeart
};
