        </div>
    </main>
    
    <!-- 页脚 -->
    <footer class="bg-white shadow-md mt-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div class="text-center text-gray-600 text-sm">
                <i class="fas fa-heart text-pink-500"></i>
                <span>我们的小窝 © <?php echo date('Y'); ?></span>
                <i class="fas fa-heart text-pink-500"></i>
            </div>
        </div>
    </footer>
    
    <!-- 移动端菜单切换脚本 -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const menuButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.getElementById('mobile-menu');
            
            if (menuButton && mobileMenu) {
                menuButton.addEventListener('click', function() {
                    mobileMenu.classList.toggle('hidden');
                });
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
    
    <?php if (isset($additionalScripts)) echo $additionalScripts; ?>
</body>
</html>
