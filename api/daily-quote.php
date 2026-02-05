<?php
/**
 * 每日情话API
 * 每次刷新都实时生成新情话，并保存到历史记录
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../includes/ai-helper.php';
require_once __DIR__ . '/../includes/ai-config.php';

// 历史记录文件路径
$historyFile = __DIR__ . '/../generated-quotes.txt';

/**
 * 读取历史情话
 */
function getQuoteHistory() {
    global $historyFile;
    if (!file_exists($historyFile)) {
        return [];
    }
    $content = file_get_contents($historyFile);
    if (empty($content)) {
        return [];
    }
    return array_filter(array_map('trim', explode("\n", $content)));
}

/**
 * 保存新情话到历史记录
 */
function saveQuoteToHistory($quote) {
    global $historyFile;
    file_put_contents($historyFile, $quote . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * 检查情话是否与历史重复（简单检查：前5个字）
 */
function isDuplicateQuote($quote, $history) {
    if (empty($history)) {
        return false;
    }
    
    $quoteStart = mb_substr($quote, 0, 5);
    
    foreach ($history as $oldQuote) {
        // 完全相同
        if ($quote === $oldQuote) {
            return true;
        }
        // 前5个字相同
        if (mb_substr($oldQuote, 0, 5) === $quoteStart) {
            return true;
        }
    }
    
    return false;
}

/**
 * 备用AI调用函数
 */
function callBackupAI($prompt) {
    $configFile = __DIR__ . '/../data/ai_config.json';
    if (!file_exists($configFile)) {
        return ['success' => false, 'error' => '配置文件不存在'];
    }
    
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
                'content' => trim($result['choices'][0]['message']['content'])
            ];
        }
    }
    
    return ['success' => false, 'error' => 'API调用失败'];
}

try {
    // 读取历史记录
    $history = getQuoteHistory();
    
    // 检查AI是否启用
    if (!isAIEnabled() || !hasAPIKey()) {
        // 从历史记录随机选择
        if (!empty($history)) {
            $randomQuote = $history[array_rand($history)];
            echo json_encode([
                'success' => true,
                'quote' => $randomQuote,
                'source' => 'history',
                'date' => date('Y-m-d')
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        throw new Exception('AI未启用且无历史记录');
    }
    
    // 多样化的prompt模板
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
    
    // 随机选择一个prompt
    $basePrompt = $prompts[array_rand($prompts)];
    
    // 添加历史记录提示（最近10条）
    $avoidPatterns = '';
    if (!empty($history)) {
        $recentHistory = array_slice($history, -10);
        $avoidPatterns = " 注意：避免使用以下开头或相似句式：" . implode('、', array_map(function($q) {
            return mb_substr($q, 0, 6);
        }, $recentHistory));
    }
    
    $prompt = $basePrompt . " 必须用中文回答。请确保内容独特，句式新颖，不要重复。" . $avoidPatterns;
    
    $maxRetries = 3;
    $useBackup = false;
    $newQuote = null;
    
    // 尝试生成新情话
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        // 选择模型
        if (!$useBackup) {
            $result = callAIService($prompt, ['temperature' => 0.9]);
            $modelName = "主模型";
        } else {
            $result = callBackupAI($prompt);
            $modelName = "备用模型";
        }
        
        // 如果主模型失败，切换到备用模型
        if (!$result['success'] && !$useBackup) {
            $useBackup = true;
            $result = callBackupAI($prompt);
            $modelName = "备用模型";
        }
        
        if ($result['success'] && !empty($result['content'])) {
            $quote = trim($result['content']);
            
            // 检查是否重复
            if (!isDuplicateQuote($quote, $history)) {
                $newQuote = $quote;
                break;
            }
            
            // 如果重复且还没用备用模型，切换模型
            if (!$useBackup && $attempt < $maxRetries) {
                $useBackup = true;
            }
        }
        
        sleep(1); // 避免请求过快
    }
    
    // 如果成功生成新情话
    if ($newQuote !== null) {
        // 保存到历史记录
        saveQuoteToHistory($newQuote);
        
        echo json_encode([
            'success' => true,
            'quote' => $newQuote,
            'source' => 'ai_new',
            'date' => date('Y-m-d')
        ], JSON_UNESCAPED_UNICODE);
    } else {
        // 生成失败，从历史记录随机选择
        if (!empty($history)) {
            $randomQuote = $history[array_rand($history)];
            echo json_encode([
                'success' => true,
                'quote' => $randomQuote,
                'source' => 'history',
                'date' => date('Y-m-d')
            ], JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('生成失败且无历史记录');
        }
    }
    
} catch (Exception $e) {
    // 返回错误响应
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => '获取每日情话失败',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
