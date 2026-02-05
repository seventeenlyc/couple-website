<?php
/**
 * 批量生成每日情话
 * 使用AI生成30句高质量情话
 */

require_once 'includes/config.php';
require_once 'includes/ai-helper.php';

// 备用AI调用函数
function callBackupAI($prompt) {
    $configFile = __DIR__ . '/data/ai_config.json';
    $config = json_decode(file_get_contents($configFile), true);
    
    if (!isset($config['backup_provider']) || !$config['backup_provider']['enabled']) {
        return ['success' => false, 'error' => '备用模型未配置'];
    }
    
    $backup = $config['backup_provider'];
    
    $data = [
        'model' => $backup['model'],
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'max_tokens' => $backup['max_tokens'],
        'temperature' => $backup['temperature']
    ];
    
    $ch = curl_init($backup['api_endpoint']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $backup['api_key']
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, $backup['timeout']);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $result = json_decode($response, true);
        if (isset($result['choices'][0]['message']['content'])) {
            return [
                'success' => true,
                'content' => $result['choices'][0]['message']['content']
            ];
        }
    }
    
    return ['success' => false, 'error' => 'API调用失败'];
}

echo "开始生成30句每日情话...\n\n";

$quotes = [];
$successCount = 0;
$failCount = 0;

// 更多样化的prompt，强调逻辑连贯性
$prompts = [
    "请生成一句关于星空和爱情的浪漫情话。要求：前后两句必须有逻辑关联，比如'你是我心中的星辰，照亮我前行的路'这样前后呼应。30字以内，诗意唯美。",
    "请生成一句关于陪伴的温暖情话。要求：前后句要有因果或递进关系，比如'有你在身边，每个平凡的日子都变得温暖'。30字以内，感人真挚。",
    "请生成一句表达深深思念的情话。要求：前后句要逻辑连贯，比如'想你时抬头望月，因为月光也曾照过你'。30字以内，细腻动人。",
    "请生成一句关于未来承诺的情话。要求：前后句要有承接关系，比如'愿与你携手余生，共赴每一个春夏秋冬'。30字以内，坚定浪漫。",
    "请生成一句赞美对方的甜蜜情话。要求：前后句要有因果关系，比如'你的笑容如春风，融化了我心中的冰雪'。30字以内，真诚温柔。",
    "请生成一句关于相遇的情话。要求：前后句要逻辑连贯，比如'遇见你是命运的安排，爱上你是我的选择'。30字以内，美好感恩。",
    "请生成一句表达珍惜的情话。要求：前后句要有递进关系，比如'珍惜每个与你相伴的瞬间，因为那是我最美的时光'。30字以内，深情温馨。",
    "请生成一句关于幸福的情话。要求：前后句要逻辑连贯，比如'幸福很简单，就是每天醒来第一个想到你'。30字以内，甜蜜质朴。",
    "请生成一句关于四季的情话。要求：前后句要有对应关系，比如'春赏花夏观星秋看月冬听雪，四季轮回只想与你共度'。30字以内，诗意浪漫。",
    "请生成一句关于心跳的情话。要求：前后句要有因果关系，比如'每次见到你心跳加速，因为你是我心中唯一的答案'。30字以内，甜蜜动人。",
    "请生成一句关于时光的情话。要求：前后句要逻辑连贯，比如'时光会老去，但我对你的爱永远年轻'。30字以内，深情唯美。",
    "请生成一句关于守护的情话。要求：前后句要有承诺关系，比如'我愿做你的守护者，为你遮风挡雨一生一世'。30字以内，温暖坚定。",
    "请生成一句关于月光的情话。要求：前后句要逻辑连贯，比如'月光洒满窗台，思念也随之蔓延到你身边'。30字以内，诗意细腻。",
    "请生成一句关于余生的情话。要求：前后句要有递进关系，比如'余生很长，我只想和你一起慢慢变老'。30字以内，浪漫真挚。",
    "请生成一句关于心动的情话。要求：前后句要有因果关系，比如'第一次见你就心动了，从此再也没有停止过'。30字以内，甜蜜生动。",
    "请生成一句关于岁月的情话。要求：前后句要逻辑连贯，比如'岁月温柔了你的眉眼，也深刻了我的爱意'。30字以内，感人诗意。",
    "请生成一句关于依靠的情话。要求：前后句要有对应关系，比如'你是我疲惫时的港湾，也是我快乐时的分享者'。30字以内，温暖真诚。",
    "请生成一句关于勇气的情话。要求：前后句要有因果关系，比如'因为爱你，我变得勇敢无畏'。30字以内，坚定动人。",
    "请生成一句关于晨曦的情话。要求：前后句要逻辑连贯，比如'晨曦唤醒沉睡的大地，你的笑容唤醒我的心'。30字以内，清新浪漫。",
    "请生成一句关于誓言的情话。要求：前后句要有承诺关系，比如'我向星辰许下誓言，此生只爱你一人'。30字以内，深情庄重。"
];

$usedQuotes = []; // 用于去重

for ($i = 1; $i <= 30; $i++) {
    echo "正在生成第 {$i} 句... ";
    
    // 随机选择prompt增加多样性
    $basePrompt = $prompts[array_rand($prompts)];
    
    // 添加已生成内容的上下文，避免重复句式
    $usedPatterns = [];
    foreach ($usedQuotes as $q) {
        // 提取句子开头的模式
        if (preg_match('/^(.{2,6})[，,]/', $q, $matches)) {
            $usedPatterns[] = $matches[1];
        }
    }
    
    $avoidPatterns = '';
    if (count($usedPatterns) > 0) {
        $uniquePatterns = array_unique($usedPatterns);
        $avoidPatterns = " 注意：避免使用以下开头：" . implode('、', array_slice($uniquePatterns, -5));
    }
    
    $prompt = $basePrompt . " 必须用中文回答。请确保内容独特，句式新颖，不要重复。" . $avoidPatterns;
    
    $retryCount = 0;
    $maxRetries = 3;
    $useBackup = false; // 标记是否使用备用模型
    
    while ($retryCount < $maxRetries) {
        try {
            // 根据标记选择模型
            if (!$useBackup) {
                $result = callAIService($prompt, ['temperature' => 0.9]);
                $modelName = "主模型(通义千问)";
            } else {
                echo "   切换到备用模型...\n";
                $result = callBackupAI($prompt);
                $modelName = "备用模型(DeepSeek)";
            }
            
            // 如果当前模型失败，尝试另一个模型
            if (!$result['success'] && !$useBackup) {
                echo "   主模型失败，尝试备用模型...\n";
                $result = callBackupAI($prompt);
                $modelName = "备用模型(DeepSeek)";
            }
            
            if ($result['success'] && !empty(trim($result['content']))) {
                $quote = trim($result['content']);
                
                // 严格检查：完全重复和前4个字重复
                $quoteStart = mb_substr($quote, 0, 4);
                $isDuplicate = in_array($quote, $usedQuotes);
                
                // 检查前4个字是否已经出现过
                $hasStartDuplicate = false;
                foreach ($usedQuotes as $used) {
                    if (mb_substr($used, 0, 4) === $quoteStart) {
                        $hasStartDuplicate = true;
                        break;
                    }
                }
                
                if (!$isDuplicate && !$hasStartDuplicate) {
                    $quotes[] = $quote;
                    $usedQuotes[] = $quote;
                    $successCount++;
                    echo "✓ 成功 ({$modelName})\n";
                    echo "   内容: {$quote}\n\n";
                    break;
                } else {
                    echo "⚠ 句式重复";
                    // 如果重复且还没用备用模型，切换模型
                    if (!$useBackup && $retryCount < 2) {
                        echo "，切换模型重试...\n";
                        $useBackup = true;
                        $retryCount++;
                        sleep(1);
                        continue;
                    } else {
                        echo "，重试...\n";
                        $retryCount++;
                        sleep(1);
                        continue;
                    }
                }
            } else {
                $failCount++;
                echo "✗ 失败（返回空内容）\n";
                if (isset($result['error'])) {
                    echo "   错误: {$result['error']}\n";
                }
                echo "\n";
                break;
            }
            
        } catch (Exception $e) {
            $retryCount++;
            if ($retryCount >= $maxRetries) {
                $failCount++;
                echo "✗ 失败\n";
                echo "   错误: " . $e->getMessage() . "\n\n";
            }
            sleep(2);
        }
    }
    
    // 避免请求过快
    sleep(1);
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "生成完成！\n";
echo "成功: {$successCount} 句\n";
echo "失败: {$failCount} 句\n";
echo str_repeat("=", 50) . "\n\n";

if (count($quotes) > 0) {
    echo "生成的情话列表：\n\n";
    foreach ($quotes as $index => $quote) {
        echo ($index + 1) . ". {$quote}\n";
    }
    
    // 保存到文件
    $jsonData = json_encode($quotes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents('generated-quotes.json', $jsonData);
    echo "\n已保存到 generated-quotes.json\n";
    
    // 也保存为文本格式
    $textData = implode("\n", $quotes);
    file_put_contents('generated-quotes.txt', $textData);
    echo "已保存到 generated-quotes.txt\n";
}
