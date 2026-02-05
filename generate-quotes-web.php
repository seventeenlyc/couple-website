<?php
/**
 * 批量生成每日情话 - 网页版
 */

define('INCLUDED', true);
require_once 'includes/config.php';
require_once 'includes/session.php';
require_once 'includes/auth.php';
require_once 'includes/ai-helper.php';

initSession();

// 检查登录
if (!isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$generating = false;
$quotes = [];
$successCount = 0;
$failCount = 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['generate'])) {
    $generating = true;
    $count = min(30, max(1, intval($_POST['count'] ?? 30)));
    
    $prompts = [
        "请生成一句温馨浪漫的情话，适合情侣之间表达爱意。要求：简短（30字以内）、真挚、富有诗意。",
        "请生成一句关于陪伴的浪漫情话。要求：温暖、感人、30字以内。",
        "请生成一句表达思念的情话。要求：深情、细腻、30字以内。",
        "请生成一句关于未来承诺的情话。要求：坚定、浪漫、30字以内。",
        "请生成一句赞美对方的甜蜜情话。要求：真诚、动人、30字以内。",
        "请生成一句关于相遇的浪漫情话。要求：美好、温柔、30字以内。",
        "请生成一句表达珍惜的情话。要求：深情、感恩、30字以内。",
        "请生成一句关于幸福的情话。要求：甜蜜、温馨、30字以内。"
    ];
    
    for ($i = 1; $i <= $count; $i++) {
        $prompt = $prompts[($i - 1) % count($prompts)];
        
        try {
            $quote = callAI($prompt, 'daily_quote');
            
            if ($quote && !empty(trim($quote))) {
                $quotes[] = trim($quote);
                $successCount++;
            } else {
                $failCount++;
            }
            
            // 避免请求过快
            usleep(500000); // 0.5秒
            
        } catch (Exception $e) {
            $failCount++;
        }
    }
}

$pageTitle = '生成每日情话';
?>

<?php require_once 'includes/header.php'; ?>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold mb-2" style="color: var(--primary-color);">
                <i class="fas fa-heart"></i> AI情话生成器
            </h1>
            <p class="text-gray-600">批量生成高质量的浪漫情话</p>
        </div>
        
        <?php if (!$generating): ?>
        <!-- 生成表单 -->
        <div class="card p-6 mb-6">
            <form method="POST" action="">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        生成数量
                    </label>
                    <input type="number" 
                           name="count" 
                           value="30" 
                           min="1" 
                           max="50" 
                           class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <p class="text-xs text-gray-500 mt-1">建议：1-30句</p>
                </div>
                
                <button type="submit" 
                        name="generate" 
                        class="w-full btn-primary py-3 text-lg">
                    <i class="fas fa-magic"></i> 开始生成
                </button>
            </form>
        </div>
        <?php else: ?>
        <!-- 生成结果 -->
        <div class="card p-6 mb-6">
            <div class="mb-6">
                <h2 class="text-2xl font-bold mb-4">生成结果</h2>
                <div class="flex items-center justify-around p-4 bg-gray-50 rounded-lg">
                    <div class="text-center">
                        <div class="text-3xl font-bold text-green-600"><?php echo $successCount; ?></div>
                        <div class="text-sm text-gray-600">成功</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-red-600"><?php echo $failCount; ?></div>
                        <div class="text-sm text-gray-600">失败</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-blue-600"><?php echo $successCount + $failCount; ?></div>
                        <div class="text-sm text-gray-600">总计</div>
                    </div>
                </div>
            </div>
            
            <?php if (count($quotes) > 0): ?>
            <div class="mb-6">
                <h3 class="text-xl font-bold mb-4">生成的情话</h3>
                <div class="space-y-3">
                    <?php foreach ($quotes as $index => $quote): ?>
                    <div class="p-4 bg-pink-50 rounded-lg border-l-4 border-pink-500">
                        <div class="flex items-start">
                            <span class="inline-block w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold mr-3 flex-shrink-0">
                                <?php echo $index + 1; ?>
                            </span>
                            <p class="text-gray-800 flex-1"><?php echo htmlspecialchars($quote); ?></p>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            
            <!-- 复制按钮 -->
            <div class="flex gap-3">
                <button onclick="copyAllQuotes()" class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                    <i class="fas fa-copy"></i> 复制全部
                </button>
                <button onclick="downloadQuotes()" class="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                    <i class="fas fa-download"></i> 下载文本
                </button>
                <a href="generate-quotes-web.php" class="flex-1 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-center">
                    <i class="fas fa-redo"></i> 重新生成
                </a>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>
</div>

<script>
const quotes = <?php echo json_encode($quotes, JSON_UNESCAPED_UNICODE); ?>;

function copyAllQuotes() {
    const text = quotes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板！');
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制');
    });
}

function downloadQuotes() {
    const text = quotes.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quotes_' + new Date().getTime() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
</script>

<?php require_once 'includes/footer.php'; ?>
