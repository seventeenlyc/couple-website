<?php
/**
 * 登录页面
 * 情侣网站的入口页面
 */

define('INCLUDED', true);
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/auth.php';

// 如果已经登录，重定向到主页
if (isLoggedIn()) {
    header('Location: /home.php');
    exit();
}

// 生成CSRF令牌
$csrfToken = generateCSRFToken();
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - 我们的小窝</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #ffc0cb 0%, #ffb6c1 100%);
            min-height: 100vh;
        }
        .login-card {
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.95);
        }
        .paw-decoration {
            animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }
    </style>
</head>
<body class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
        <!-- 装饰元素 -->
        <div class="text-center mb-8">
            <div class="inline-block paw-decoration">
                <i class="fas fa-heart text-6xl text-red-400"></i>
            </div>
            <h1 class="text-4xl font-bold text-white mt-4 drop-shadow-lg">我们的小窝</h1>
            <p class="text-white text-lg mt-2">欢迎回家 💕</p>
        </div>

        <!-- 登录卡片 -->
        <div class="login-card rounded-lg shadow-2xl p-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                <i class="fas fa-paw text-pink-400 mr-2"></i>
                登录
            </h2>

            <!-- 错误提示 -->
            <div id="error-message" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-circle mr-2"></i>
                    <span id="error-text"></span>
                </div>
            </div>

            <!-- 登录表单 -->
            <form id="login-form" class="space-y-6">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
                
                <div>
                    <label for="you" class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-user text-blue-500 mr-1"></i>
                        你是谁
                    </label>
                    <input 
                        type="text" 
                        id="you" 
                        name="you" 
                        required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="请输入你的名字"
                        autocomplete="off"
                    >
                </div>

                <div>
                    <label for="baby" class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-heart text-pink-500 mr-1"></i>
                        你的宝宝是谁
                    </label>
                    <input 
                        type="text" 
                        id="baby" 
                        name="baby" 
                        required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                        placeholder="请输入宝宝的名字"
                        autocomplete="off"
                    >
                </div>

                <button 
                    type="submit" 
                    id="login-button"
                    class="w-full bg-gradient-to-r from-blue-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-pink-600 transition duration-200 shadow-lg"
                >
                    <i class="fas fa-sign-in-alt mr-2"></i>
                    进入我们的小窝
                </button>
            </form>

           
            
            <!-- 提示信息 -->
            <div class="text-center mt-4">
                <p class="text-xs text-gray-500">
                    <i class="fas fa-info-circle mr-1"></i>
                    如有问题，请<span class="line-through">诱惑</span> 贿赂管理员 <img src="https://ts1.tc.mm.bing.net/th/id/OIP-C.JqtutuIUT2Pxe6BsgdseGwAAAA?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="狗头" style="display: inline-block; width: 18px; height: 18px; vertical-align: middle;">
                </p>
            </div>
        </div>
        
        <!-- 备案信息 -->
        <div class="text-center mt-6">
            <p class="text-xs text-gray-800 drop-shadow-md">
                <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" class="hover:text-gray-200 transition-colors"></a>
                    <i class="fas fa-shield-alt mr-1"></i>
                    粤ICP备2025512966号-1
                </a>
            </p>
        </div>
    </div>

    <script>
        const form = document.getElementById('login-form');
        const errorMessage = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        const loginButton = document.getElementById('login-button');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 隐藏之前的错误
            errorMessage.classList.add('hidden');
            
            // 禁用按钮，防止重复提交
            loginButton.disabled = true;
            loginButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>登录中...';
            
            // 获取表单数据
            const formData = new FormData(form);
            
            try {
                const response = await fetch('api/login.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // 登录成功，显示成功消息并跳转
                    loginButton.innerHTML = '<i class="fas fa-check mr-2"></i>登录成功！';
                    loginButton.classList.remove('from-blue-500', 'to-pink-500');
                    loginButton.classList.add('from-green-500', 'to-green-600');
                    
                    setTimeout(() => {
                        window.location.href = result.redirect || 'home.php';
                    }, 500);
                } else {
                    // 登录失败，显示错误消息
                    errorText.textContent = result.message || '登录失败，请检查输入的名字是否正确';
                    errorMessage.classList.remove('hidden');
                    
                    // 恢复按钮
                    loginButton.disabled = false;
                    loginButton.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>进入我们的小窝';
                }
            } catch (error) {
                // 网络错误
                errorText.textContent = '网络错误，请稍后重试';
                errorMessage.classList.remove('hidden');
                
                // 恢复按钮
                loginButton.disabled = false;
                loginButton.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>进入我们的小窝';
            }
        });
    </script>
    
    <!-- 鼠标点击小星星特效 -->
    <style>
        .click-star {
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            font-size: 8px;
        }
    </style>
    
    <script>
        // 鼠标点击小星星特效 - 四散效果
        document.addEventListener('click', function(e) {
            // 星星样式数组
            const stars = ['⭐', '✨', '💫', '🌟'];
            
            // 每次点击创建10-20个星星
            const starCount = Math.floor(Math.random() * 11) + 10; // 10-20个星星
            
            for (let i = 0; i < starCount; i++) {
                setTimeout(() => {
                    const star = document.createElement('div');
                    star.className = 'click-star';
                    
                    // 随机选择星星样式
                    star.textContent = stars[Math.floor(Math.random() * stars.length)];
                    
                    // 随机大小 2-8px
                    const size = Math.random() * 6 + 2;
                    star.style.fontSize = size + 'px';
                    
                    // 初始位置
                    star.style.left = e.clientX + 'px';
                    star.style.top = e.clientY + 'px';
                    
                    // 随机方向和距离（360度全方向）
                    const angle = Math.random() * Math.PI * 2; // 0-360度
                    const distance = Math.random() * 100 + 50; // 50-150px
                    const endX = e.clientX + Math.cos(angle) * distance;
                    const endY = e.clientY + Math.sin(angle) * distance;
                    
                    // 添加到页面
                    document.body.appendChild(star);
                    
                    // 动画参数
                    const duration = 800 + Math.random() * 400; // 800-1200ms
                    const startTime = Date.now();
                    
                    // 动画函数
                    function animate() {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // 缓动函数（ease-out）
                        const easeProgress = 1 - Math.pow(1 - progress, 3);
                        
                        // 更新位置
                        const currentX = e.clientX + (endX - e.clientX) * easeProgress;
                        const currentY = e.clientY + (endY - e.clientY) * easeProgress;
                        
                        star.style.left = currentX + 'px';
                        star.style.top = currentY + 'px';
                        
                        // 更新透明度和旋转
                        star.style.opacity = 1 - progress;
                        star.style.transform = `rotate(${progress * 360}deg) scale(${1 + progress * 0.5})`;
                        
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            if (document.body.contains(star)) {
                                document.body.removeChild(star);
                            }
                        }
                    }
                    
                    animate();
                }, i * 20); // 每个星星延迟20ms
            }
        });
    </script>
</body>
</html>
