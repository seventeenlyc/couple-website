<?php
/**
 * AI功能核心助手
 * 提供AI服务调用、缓存管理和内容生成功能
 */

require_once __DIR__ . '/ai-config.php';
require_once __DIR__ . '/json-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// 缓存目录路径
define('AI_CACHE_DIR', __DIR__ . '/../data/cache');

/**
 * 确保缓存目录存在
 */
function ensureCacheDirectory() {
    if (!file_exists(AI_CACHE_DIR)) {
        mkdir(AI_CACHE_DIR, 0755, true);
    }
}

/**
 * 生成每日情话
 * @param string $date 日期（YYYY-MM-DD），默认为今天
 * @return array 包含success、content和source的数组
 */
function generateDailyLoveQuote($date = null) {
    if ($date === null) {
        $date = date('Y-m-d');
    }
    
    // 检查缓存
    $cacheKey = "daily_quote_{$date}";
    $cached = getCachedContent($cacheKey);
    
    if ($cached !== null) {
        incrementAPIStats(true, true);
        return [
            'success' => true,
            'content' => $cached,
            'source' => 'cache',
            'date' => $date
        ];
    }
    
    // 检查AI是否启用
    if (!isAIEnabled() || !hasAPIKey()) {
        $fallback = getFallbackContent('quote', $date);
        
        // 在备用模式下也缓存内容，以便测试缓存功能
        $ttl = getAIConfig('cache.daily_quote_ttl', 86400);
        setCachedContent($cacheKey, $fallback, $ttl);
        
        // 增加统计（虽然不是真正的API调用，但用于测试缓存功能）
        incrementAPIStats(true, false);
        
        return [
            'success' => true,
            'content' => $fallback,
            'source' => 'fallback',
            'date' => $date
        ];
    }
    
    // 检查速率限制
    $rateCheck = checkRateLimit();
    if (!$rateCheck['allowed']) {
        // 记录速率限制事件
        logAIError("速率限制超出", [
            'message' => $rateCheck['message'],
            'date' => $date
        ]);
        
        $fallback = getFallbackContent('quote', $date);
        
        // 缓存备用内容
        $ttl = getAIConfig('cache.daily_quote_ttl', 86400);
        setCachedContent($cacheKey, $fallback, $ttl);
        
        // 增加统计
        incrementAPIStats(true, false);
        
        return [
            'success' => true,
            'content' => $fallback,
            'source' => 'fallback',
            'date' => $date
        ];
    }
    
    // 调用AI服务
    $prompt = getPromptTemplate('daily_quote');
    $result = callAIService($prompt);
    
    if ($result['success']) {
        // 缓存结果
        $ttl = getAIConfig('cache.daily_quote_ttl', 86400);
        setCachedContent($cacheKey, $result['content'], $ttl);
        
        incrementAPIStats(true, false);
        
        return [
            'success' => true,
            'content' => $result['content'],
            'source' => 'ai',
            'date' => $date
        ];
    } else {
        // AI调用失败，使用备用内容
        incrementAPIStats(false, false);
        $fallback = getFallbackContent('quote', $date);
        
        // 缓存备用内容
        $ttl = getAIConfig('cache.daily_quote_ttl', 86400);
        setCachedContent($cacheKey, $fallback, $ttl);
        
        return [
            'success' => true,
            'content' => $fallback,
            'source' => 'fallback',
            'date' => $date,
            'error' => $result['error']
        ];
    }
}

/**
 * 调用AI服务
 * @param string $prompt 提示词
 * @param array $options 额外选项
 * @return array 包含success、content和error的数组
 */
function callAIService($prompt, $options = []) {
    // 输入验证
    if (!is_string($prompt) || empty(trim($prompt))) {
        logAIError("无效的提示词", ['prompt' => $prompt]);
        return [
            'success' => false,
            'content' => '',
            'error' => '提示词不能为空'
        ];
    }
    
    // 清理提示词（移除潜在的注入攻击）
    $prompt = sanitizeInput($prompt, 'text');
    
    // 检查提示词长度
    $maxPromptLength = 2000; // 最大2000字符
    if (strlen($prompt) > $maxPromptLength) {
        logAIError("提示词过长", ['length' => strlen($prompt), 'max' => $maxPromptLength]);
        return [
            'success' => false,
            'content' => '',
            'error' => '提示词长度超过限制'
        ];
    }
    
    $maxRetries = getAIConfig('retry_attempts', 3);
    $retryDelay = getAIConfig('retry_delay', 2);
    
    $lastError = '';
    
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        try {
            $result = performAPICall($prompt, $options);
            
            if ($result['success']) {
                return $result;
            }
            
            $lastError = $result['error'];
            
            // 记录错误（但不是最后一次尝试时只记录到系统日志）
            if ($attempt < $maxRetries) {
                error_log("AI服务调用失败 (尝试 {$attempt}/{$maxRetries}): {$lastError}");
                sleep($retryDelay);
            }
            
        } catch (Exception $e) {
            $lastError = $e->getMessage();
            
            // 记录异常
            logAIError("AI服务调用异常 (尝试 {$attempt}/{$maxRetries})", [
                'error' => $e->getMessage(),
                'attempt' => $attempt,
                'max_retries' => $maxRetries
            ]);
            
            if ($attempt < $maxRetries) {
                sleep($retryDelay);
            }
        }
    }
    
    // 所有重试都失败，记录到AI错误日志
    logAIError("AI服务调用失败，已重试{$maxRetries}次", [
        'error' => $lastError,
        'attempts' => $maxRetries,
        'prompt_length' => strlen($prompt)
    ]);
    
    return [
        'success' => false,
        'content' => '',
        'error' => $lastError,
        'attempts' => $maxRetries
    ];
}

/**
 * 执行实际的API调用
 * @param string $prompt 提示词
 * @param array $options 额外选项
 * @return array 包含success、content和error的数组
 */
function performAPICall($prompt, $options = []) {
    $provider = getAIConfig('api_provider', 'openai');
    $apiKey = getAIConfig('api_key', '');
    $model = getAIConfig('model', 'gpt-3.5-turbo');
    $maxTokens = getAIConfig('max_tokens', 150);
    $temperature = getAIConfig('temperature', 0.7);
    $timeout = getAIConfig('timeout', 30);
    
    // 根据不同的提供商构建请求
    switch ($provider) {
        case 'openai':
            return callOpenAI($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout);
        
        case 'anthropic':
            return callAnthropic($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout);
        
        case 'deepseek':
            return callDeepSeek($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout);
        
        case 'dashscope':
            return callDashScope($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout);
        
        default:
            return [
                'success' => false,
                'content' => '',
                'error' => "不支持的API提供商: {$provider}"
            ];
    }
}

/**
 * 调用OpenAI API
 * @param string $apiKey API密钥
 * @param string $model 模型名称
 * @param string $prompt 提示词
 * @param int $maxTokens 最大令牌数
 * @param float $temperature 温度参数
 * @param int $timeout 超时时间
 * @return array 包含success、content和error的数组
 */
function callOpenAI($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout) {
    $endpoint = getAIConfig('api_endpoint', 'https://api.openai.com/v1/chat/completions');
    
    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'max_tokens' => $maxTokens,
        'temperature' => $temperature
    ];
    
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        return [
            'success' => false,
            'content' => '',
            'error' => "cURL错误: {$error}"
        ];
    }
    
    if ($httpCode !== 200) {
        return [
            'success' => false,
            'content' => '',
            'error' => "HTTP错误: {$httpCode}"
        ];
    }
    
    $result = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'content' => '',
            'error' => "JSON解析错误: " . json_last_error_msg()
        ];
    }
    
    if (!isset($result['choices'][0]['message']['content'])) {
        return [
            'success' => false,
            'content' => '',
            'error' => "响应格式错误"
        ];
    }
    
    // 获取内容并清理
    $content = $result['choices'][0]['message']['content'];
    
    // 清理输出（移除潜在的恶意内容）
    $content = sanitizeInput($content, 'text');
    $content = trim($content);
    
    // 验证内容长度
    if (empty($content)) {
        return [
            'success' => false,
            'content' => '',
            'error' => "AI返回空内容"
        ];
    }
    
    return [
        'success' => true,
        'content' => $content,
        'error' => ''
    ];
}

/**
 * 调用Anthropic API (Claude)
 * @param string $apiKey API密钥
 * @param string $model 模型名称
 * @param string $prompt 提示词
 * @param int $maxTokens 最大令牌数
 * @param float $temperature 温度参数
 * @param int $timeout 超时时间
 * @return array 包含success、content和error的数组
 */
function callAnthropic($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout) {
    // TODO: 实现Anthropic API调用
    return [
        'success' => false,
        'content' => '',
        'error' => 'Anthropic API暂未实现'
    ];
}

/**
 * 调用阿里云DashScope API
 * @param string $apiKey API密钥
 * @param string $model 模型名称
 * @param string $prompt 提示词
 * @param int $maxTokens 最大令牌数
 * @param float $temperature 温度参数
 * @param int $timeout 超时时间
 * @return array 包含success、content和error的数组
 */
function callDashScope($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout) {
    $endpoint = getAIConfig('api_endpoint', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    
    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'max_tokens' => $maxTokens,
        'temperature' => $temperature
    ];
    
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        return [
            'success' => false,
            'content' => '',
            'error' => "cURL错误: {$error}"
        ];
    }
    
    if ($httpCode !== 200) {
        // 尝试解析错误响应
        $errorData = json_decode($response, true);
        $errorMsg = "HTTP错误: {$httpCode}";
        if ($errorData && isset($errorData['message'])) {
            $errorMsg .= " - " . $errorData['message'];
        }
        return [
            'success' => false,
            'content' => '',
            'error' => $errorMsg,
            'response' => $response
        ];
    }
    
    $result = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'content' => '',
            'error' => "JSON解析错误: " . json_last_error_msg()
        ];
    }
    
    if (!isset($result['choices'][0]['message']['content'])) {
        return [
            'success' => false,
            'content' => '',
            'error' => "响应格式错误",
            'response' => $response
        ];
    }
    
    // 获取内容并清理
    $content = $result['choices'][0]['message']['content'];
    $content = sanitizeInput($content, 'text');
    $content = trim($content);
    
    // 验证内容长度
    if (empty($content)) {
        return [
            'success' => false,
            'content' => '',
            'error' => "AI返回空内容"
        ];
    }
    
    return [
        'success' => true,
        'content' => $content,
        'error' => ''
    ];
}

/**
 * 调用DeepSeek API
 * @param string $apiKey API密钥
 * @param string $model 模型名称
 * @param string $prompt 提示词
 * @param int $maxTokens 最大令牌数
 * @param float $temperature 温度参数
 * @param int $timeout 超时时间
 * @return array 包含success、content和error的数组
 */
function callDeepSeek($apiKey, $model, $prompt, $maxTokens, $temperature, $timeout) {
    // DeepSeek使用OpenAI兼容的API
    $endpoint = getAIConfig('api_endpoint', 'https://api.deepseek.com/v1/chat/completions');
    
    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'max_tokens' => $maxTokens,
        'temperature' => $temperature
    ];
    
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        return [
            'success' => false,
            'content' => '',
            'error' => "cURL错误: {$error}"
        ];
    }
    
    if ($httpCode !== 200) {
        return [
            'success' => false,
            'content' => '',
            'error' => "HTTP错误: {$httpCode}"
        ];
    }
    
    $result = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'content' => '',
            'error' => "JSON解析错误: " . json_last_error_msg()
        ];
    }
    
    if (!isset($result['choices'][0]['message']['content'])) {
        return [
            'success' => false,
            'content' => '',
            'error' => "响应格式错误"
        ];
    }
    
    return [
        'success' => true,
        'content' => trim($result['choices'][0]['message']['content']),
        'error' => ''
    ];
}

/**
 * 获取缓存内容
 * @param string $key 缓存键
 * @return string|null 缓存内容，如果不存在或过期返回null
 */
function getCachedContent($key) {
    ensureCacheDirectory();
    
    $cacheFile = AI_CACHE_DIR . '/' . md5($key) . '.json';
    
    if (!file_exists($cacheFile)) {
        return null;
    }
    
    $data = safeReadJSON($cacheFile, null);
    
    // 如果读取失败或数据为null，可能是文件损坏
    if ($data === null) {
        handleCorruptedCache($cacheFile, $key);
        return null;
    }
    
    // 检查是否过期
    if (isset($data['expires_at']) && time() > $data['expires_at']) {
        // 删除过期缓存
        unlink($cacheFile);
        return null;
    }
    
    return $data['content'] ?? null;
}

/**
 * 设置缓存内容
 * @param string $key 缓存键
 * @param string $content 内容
 * @param int $ttl 生存时间（秒）
 * @return bool 是否成功
 */
function setCachedContent($key, $content, $ttl = 86400) {
    ensureCacheDirectory();
    
    $cacheFile = AI_CACHE_DIR . '/' . md5($key) . '.json';
    
    $data = [
        'key' => $key,
        'content' => $content,
        'created_at' => time(),
        'expires_at' => time() + $ttl
    ];
    
    return safeWriteJSON($cacheFile, $data, false);
}

/**
 * 清除过期缓存
 * @return int 清除的文件数量
 */
function clearExpiredCache() {
    ensureCacheDirectory();
    
    $files = glob(AI_CACHE_DIR . '/*.json');
    $cleared = 0;
    
    foreach ($files as $file) {
        $data = safeReadJSON($file, null);
        
        if ($data === null) {
            continue;
        }
        
        // 检查是否过期
        if (isset($data['expires_at']) && time() > $data['expires_at']) {
            unlink($file);
            $cleared++;
        }
    }
    
    return $cleared;
}

/**
 * 清除所有缓存
 * @return int 清除的文件数量
 */
function clearAllCache() {
    ensureCacheDirectory();
    
    $files = glob(AI_CACHE_DIR . '/*.json');
    $cleared = 0;
    
    foreach ($files as $file) {
        if (unlink($file)) {
            $cleared++;
        }
    }
    
    return $cleared;
}

/**
 * 获取缓存统计信息
 * @return array 统计信息
 */
function getCacheStats() {
    ensureCacheDirectory();
    
    $files = glob(AI_CACHE_DIR . '/*.json');
    $total = count($files);
    $expired = 0;
    $totalSize = 0;
    
    foreach ($files as $file) {
        $totalSize += filesize($file);
        
        $data = safeReadJSON($file, null);
        if ($data !== null && isset($data['expires_at']) && time() > $data['expires_at']) {
            $expired++;
        }
    }
    
    return [
        'total_files' => $total,
        'expired_files' => $expired,
        'active_files' => $total - $expired,
        'total_size' => $totalSize,
        'total_size_mb' => round($totalSize / 1024 / 1024, 2)
    ];
}


/**
 * 记录AI错误日志
 * @param string $message 错误消息
 * @param array $context 上下文信息
 * @return bool 是否成功
 */
function logAIError($message, $context = []) {
    $logDir = __DIR__ . '/../data/logs';
    
    // 确保日志目录存在
    if (!file_exists($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/ai_errors.log';
    
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? ' | Context: ' . json_encode($context) : '';
    $logEntry = "[{$timestamp}] {$message}{$contextStr}\n";
    
    return file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX) !== false;
}

/**
 * 处理缓存文件损坏
 * @param string $cacheFile 缓存文件路径
 * @param string $key 缓存键
 * @return bool 是否成功恢复
 */
function handleCorruptedCache($cacheFile, $key) {
    try {
        // 记录错误
        logAIError("缓存文件损坏", [
            'file' => $cacheFile,
            'key' => $key
        ]);
        
        // 尝试删除损坏的文件
        if (file_exists($cacheFile)) {
            unlink($cacheFile);
        }
        
        return true;
    } catch (Exception $e) {
        logAIError("处理损坏缓存失败: " . $e->getMessage(), [
            'file' => $cacheFile,
            'key' => $key
        ]);
        return false;
    }
}

/**
 * 获取错误日志内容
 * @param int $lines 读取的行数，默认100行
 * @return array 日志行数组
 */
function getAIErrorLogs($lines = 100) {
    $logFile = __DIR__ . '/../data/logs/ai_errors.log';
    
    if (!file_exists($logFile)) {
        return [];
    }
    
    $content = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    if ($content === false) {
        return [];
    }
    
    // 返回最后N行
    return array_slice($content, -$lines);
}

/**
 * 清除错误日志
 * @return bool 是否成功
 */
function clearAIErrorLogs() {
    $logFile = __DIR__ . '/../data/logs/ai_errors.log';
    
    if (!file_exists($logFile)) {
        return true;
    }
    
    return unlink($logFile);
}

/**
 * 生成纪念日祝福语
 * @param string $anniversaryType 纪念日类型 (monthly/yearly/special)
 * @param int $count 计数（月数、年数或天数）
 * @param string $date 纪念日日期 (YYYY-MM-DD)
 * @return array 包含success、content和source的数组
 */
function generateAnniversaryMessage($anniversaryType, $count, $date) {
    // 构建缓存键
    $cacheKey = "anniversary_{$anniversaryType}_{$count}_{$date}";
    
    // 检查缓存
    $cached = getCachedContent($cacheKey);
    
    if ($cached !== null) {
        incrementAPIStats(true, true);
        return [
            'success' => true,
            'content' => $cached,
            'source' => 'cache',
            'type' => $anniversaryType,
            'count' => $count,
            'date' => $date
        ];
    }
    
    // 检查AI是否启用
    if (!isAIEnabled() || !hasAPIKey()) {
        $fallback = getFallbackContent('anniversary', null, $anniversaryType);
        
        // 缓存到纪念日过去
        $expiresAt = strtotime($date . ' +1 day');
        $ttl = max(0, $expiresAt - time());
        setCachedContent($cacheKey, $fallback, $ttl);
        
        incrementAPIStats(true, false);
        
        return [
            'success' => true,
            'content' => $fallback,
            'source' => 'fallback',
            'type' => $anniversaryType,
            'count' => $count,
            'date' => $date
        ];
    }
    
    // 检查速率限制
    $rateCheck = checkRateLimit();
    if (!$rateCheck['allowed']) {
        logAIError("速率限制超出", [
            'message' => $rateCheck['message'],
            'type' => $anniversaryType,
            'date' => $date
        ]);
        
        $fallback = getFallbackContent('anniversary', null, $anniversaryType);
        
        $expiresAt = strtotime($date . ' +1 day');
        $ttl = max(0, $expiresAt - time());
        setCachedContent($cacheKey, $fallback, $ttl);
        
        incrementAPIStats(true, false);
        
        return [
            'success' => true,
            'content' => $fallback,
            'source' => 'fallback',
            'type' => $anniversaryType,
            'count' => $count,
            'date' => $date
        ];
    }
    
    // 调用AI服务
    $prompt = getPromptTemplate('anniversary', [
        'type' => $anniversaryType,
        'count' => $count
    ]);
    
    $result = callAIService($prompt);
    
    if ($result['success']) {
        // 缓存到纪念日过去
        $expiresAt = strtotime($date . ' +1 day');
        $ttl = max(0, $expiresAt - time());
        setCachedContent($cacheKey, $result['content'], $ttl);
        
        incrementAPIStats(true, false);
        
        return [
            'success' => true,
            'content' => $result['content'],
            'source' => 'ai',
            'type' => $anniversaryType,
            'count' => $count,
            'date' => $date
        ];
    } else {
        // AI调用失败，使用备用内容
        incrementAPIStats(false, false);
        $fallback = getFallbackContent('anniversary', null, $anniversaryType);
        
        $expiresAt = strtotime($date . ' +1 day');
        $ttl = max(0, $expiresAt - time());
        setCachedContent($cacheKey, $fallback, $ttl);
        
        return [
            'success' => true,
            'content' => $fallback,
            'source' => 'fallback',
            'type' => $anniversaryType,
            'count' => $count,
            'date' => $date,
            'error' => $result['error']
        ];
    }
}

/**
 * 获取纪念日提醒列表（带祝福语）
 * @param string $startDate 开始日期 (YYYY-MM-DD)
 * @param int $daysAhead 提前多少天提醒 (默认7天)
 * @return array 纪念日提醒数组
 */
function getAnniversaryReminders($startDate, $daysAhead = 7) {
    require_once __DIR__ . '/anniversary-helper.php';
    
    // 获取即将到来的纪念日
    $anniversaries = getUpcomingAnniversaries($startDate, $daysAhead);
    
    // 为每个纪念日生成祝福语
    $reminders = [];
    
    foreach ($anniversaries as $anniversary) {
        // 确定计数
        $count = 0;
        if ($anniversary['type'] === 'monthly') {
            $count = $anniversary['months_count'];
        } elseif ($anniversary['type'] === 'yearly') {
            $count = $anniversary['years_count'];
        } elseif ($anniversary['type'] === 'special') {
            $count = $anniversary['special_days'];
        }
        
        // 生成祝福语
        $messageResult = generateAnniversaryMessage(
            $anniversary['type'],
            $count,
            $anniversary['date']
        );
        
        // 构建提醒数据
        $reminder = [
            'type' => $anniversary['type'],
            'name' => $anniversary['name'],
            'date' => $anniversary['date'],
            'days_until' => $anniversary['days_until'],
            'message' => $messageResult['content'],
            'icon' => $anniversary['icon'],
            'message_source' => $messageResult['source']
        ];
        
        $reminders[] = $reminder;
    }
    
    return $reminders;
}

/**
 * 检查纪念日缓存是否过期
 * @param string $date 纪念日日期 (YYYY-MM-DD)
 * @return bool 是否过期
 */
function isAnniversaryCacheExpired($date) {
    $today = date('Y-m-d');
    return $date < $today;
}

/**
 * 清除过期的纪念日缓存
 * @return int 清除的缓存数量
 */
function clearExpiredAnniversaryCache() {
    ensureCacheDirectory();
    
    $files = glob(AI_CACHE_DIR . '/*.json');
    $cleared = 0;
    $today = date('Y-m-d');
    
    foreach ($files as $file) {
        $data = safeReadJSON($file, null);
        
        if ($data === null) {
            continue;
        }
        
        // 检查是否是纪念日缓存
        if (isset($data['key']) && strpos($data['key'], 'anniversary_') === 0) {
            // 提取日期
            $parts = explode('_', $data['key']);
            if (count($parts) >= 4) {
                $date = $parts[3];
                
                // 如果日期已过，删除缓存
                if ($date < $today) {
                    unlink($file);
                    $cleared++;
                }
            }
        }
    }
    
    return $cleared;
}

