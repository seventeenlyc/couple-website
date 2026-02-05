<?php
/**
 * AI功能配置管理
 * 管理AI服务的配置、API密钥和相关设置
 */

require_once __DIR__ . '/json-helper.php';

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

// AI配置文件路径
define('AI_CONFIG_FILE', __DIR__ . '/../data/ai_config.json');

/**
 * 加载AI配置
 * @return array AI配置数组
 */
function loadAIConfig() {
    $defaultConfig = [
        'enabled' => false,
        'api_provider' => 'openai', // openai, anthropic, deepseek等
        'api_key' => '',
        'api_endpoint' => '',
        'model' => 'gpt-3.5-turbo',
        'max_tokens' => 150,
        'temperature' => 0.7,
        'timeout' => 30,
        'retry_attempts' => 3,
        'retry_delay' => 2,
        'rate_limit' => [
            'enabled' => true,
            'max_calls_per_day' => 100,
            'max_calls_per_hour' => 20
        ],
        'cache' => [
            'enabled' => true,
            'ttl' => 86400, // 24小时
            'daily_quote_ttl' => 86400,
            'anniversary_ttl' => 3600
        ],
        'fallback' => [
            'enabled' => true,
            'quotes' => [
                '愿我们的爱情如同星辰，永恒闪耀。',
                '每一天与你在一起，都是最美好的时光。',
                '你是我生命中最美的遇见。',
                '爱你，是我做过最对的决定。',
                '余生很长，我只想和你一起走。'
            ]
        ],
        'prompts' => [
            'daily_quote' => '请生成一句温馨浪漫的情话，适合情侣之间表达爱意。要求：简短、真挚、富有诗意。',
            'anniversary' => '请为{type}纪念日生成一句祝福语。今天是我们在一起的第{days}天。要求：温馨、浪漫、有纪念意义。'
        ],
        'statistics' => [
            'total_calls' => 0,
            'successful_calls' => 0,
            'failed_calls' => 0,
            'cache_hits' => 0,
            'last_call_time' => null
        ]
    ];
    
    return safeReadJSON(AI_CONFIG_FILE, $defaultConfig);
}

/**
 * 保存AI配置
 * @param array $config 配置数组
 * @return bool 是否成功
 */
function saveAIConfig($config) {
    return safeWriteJSON(AI_CONFIG_FILE, $config);
}

/**
 * 获取AI配置项
 * @param string $key 配置键名（支持点号分隔的嵌套键）
 * @param mixed $default 默认值
 * @return mixed 配置值
 */
function getAIConfig($key = null, $default = null) {
    static $config = null;
    
    // 首次调用时加载配置
    if ($config === null) {
        $config = loadAIConfig();
    }
    
    // 如果没有指定键，返回整个配置
    if ($key === null) {
        return $config;
    }
    
    // 支持点号分隔的嵌套键
    $keys = explode('.', $key);
    $value = $config;
    
    foreach ($keys as $k) {
        if (!is_array($value) || !isset($value[$k])) {
            return $default;
        }
        $value = $value[$k];
    }
    
    return $value;
}

/**
 * 更新AI配置项
 * @param string $key 配置键名（支持点号分隔的嵌套键）
 * @param mixed $value 配置值
 * @return bool 是否成功
 */
function updateAIConfig($key, $value) {
    $config = loadAIConfig();
    
    // 支持点号分隔的嵌套键
    $keys = explode('.', $key);
    $current = &$config;
    
    foreach ($keys as $i => $k) {
        if ($i === count($keys) - 1) {
            $current[$k] = $value;
        } else {
            if (!isset($current[$k]) || !is_array($current[$k])) {
                $current[$k] = [];
            }
            $current = &$current[$k];
        }
    }
    
    return saveAIConfig($config);
}

/**
 * 检查AI功能是否启用
 * @return bool 是否启用
 */
function isAIEnabled() {
    return getAIConfig('enabled', false) === true;
}

/**
 * 检查API密钥是否配置
 * @return bool 是否配置
 */
function hasAPIKey() {
    $apiKey = getAIConfig('api_key', '');
    return !empty($apiKey);
}

/**
 * 验证AI配置
 * @return array 包含valid和message的数组
 */
function validateAIConfig() {
    $config = loadAIConfig();
    
    if (!$config['enabled']) {
        return [
            'valid' => false,
            'message' => 'AI功能未启用'
        ];
    }
    
    if (empty($config['api_key'])) {
        return [
            'valid' => false,
            'message' => 'API密钥未配置'
        ];
    }
    
    if (empty($config['api_provider'])) {
        return [
            'valid' => false,
            'message' => 'API提供商未配置'
        ];
    }
    
    if (empty($config['model'])) {
        return [
            'valid' => false,
            'message' => '模型未配置'
        ];
    }
    
    return [
        'valid' => true,
        'message' => 'AI配置有效'
    ];
}

/**
 * 增加API调用统计
 * @param bool $success 是否成功
 * @param bool $fromCache 是否来自缓存
 * @return bool 是否成功
 */
function incrementAPIStats($success = true, $fromCache = false) {
    $config = loadAIConfig();
    
    // 只有非缓存调用才增加total_calls（实际的API调用）
    if (!$fromCache) {
        $config['statistics']['total_calls']++;
        
        if ($success) {
            $config['statistics']['successful_calls']++;
        } else {
            $config['statistics']['failed_calls']++;
        }
    }
    
    // 缓存命中单独统计
    if ($fromCache) {
        $config['statistics']['cache_hits']++;
    }
    
    $config['statistics']['last_call_time'] = date('Y-m-d H:i:s');
    
    return saveAIConfig($config);
}

/**
 * 获取API调用统计
 * @return array 统计信息
 */
function getAPIStats() {
    $config = loadAIConfig();
    return $config['statistics'];
}

/**
 * 重置API调用统计
 * @return bool 是否成功
 */
function resetAPIStats() {
    return updateAIConfig('statistics', [
        'total_calls' => 0,
        'successful_calls' => 0,
        'failed_calls' => 0,
        'cache_hits' => 0,
        'last_call_time' => null,
        'total_tokens' => 0,
        'estimated_cost' => 0.0
    ]);
}

/**
 * 记录API调用成本
 * @param int $tokensUsed 使用的令牌数
 * @return bool 是否成功
 */
function recordAPICost($tokensUsed) {
    $config = loadAIConfig();
    
    // 累加令牌数
    if (!isset($config['statistics']['total_tokens'])) {
        $config['statistics']['total_tokens'] = 0;
    }
    $config['statistics']['total_tokens'] += $tokensUsed;
    
    // 计算成本（根据不同模型的定价）
    $provider = getAIConfig('api_provider', 'openai');
    $model = getAIConfig('model', 'gpt-3.5-turbo');
    
    $costPer1kTokens = getCostPer1kTokens($provider, $model);
    $cost = ($tokensUsed / 1000) * $costPer1kTokens;
    
    if (!isset($config['statistics']['estimated_cost'])) {
        $config['statistics']['estimated_cost'] = 0.0;
    }
    $config['statistics']['estimated_cost'] += $cost;
    
    return saveAIConfig($config);
}

/**
 * 获取每1000令牌的成本
 * @param string $provider API提供商
 * @param string $model 模型名称
 * @return float 成本（美元）
 */
function getCostPer1kTokens($provider, $model) {
    // 定价表（美元/1000令牌）
    $pricing = [
        'openai' => [
            'gpt-3.5-turbo' => 0.002,
            'gpt-4' => 0.03,
            'gpt-4-turbo' => 0.01
        ],
        'deepseek' => [
            'deepseek-chat' => 0.0014,
            'deepseek-coder' => 0.0014
        ],
        'anthropic' => [
            'claude-3-haiku' => 0.00025,
            'claude-3-sonnet' => 0.003,
            'claude-3-opus' => 0.015
        ]
    ];
    
    if (isset($pricing[$provider][$model])) {
        return $pricing[$provider][$model];
    }
    
    // 默认成本
    return 0.002;
}

/**
 * 获取使用统计报告
 * @return array 详细的统计报告
 */
function getUsageReport() {
    $stats = getAPIStats();
    $config = loadAIConfig();
    
    // 计算成功率
    $totalCalls = $stats['total_calls'];
    $successRate = $totalCalls > 0 ? ($stats['successful_calls'] / $totalCalls * 100) : 0;
    
    // 计算缓存命中率
    $totalRequests = $totalCalls + ($stats['cache_hits'] ?? 0);
    $cacheHitRate = $totalRequests > 0 ? (($stats['cache_hits'] ?? 0) / $totalRequests * 100) : 0;
    
    // 获取速率限制信息
    $rateLimit = $config['rate_limit'] ?? [];
    $maxPerDay = $rateLimit['max_calls_per_day'] ?? 100;
    $usagePercent = $maxPerDay > 0 ? ($totalCalls / $maxPerDay * 100) : 0;
    
    // 估算节省的成本（通过缓存）
    $cacheHits = $stats['cache_hits'] ?? 0;
    $provider = getAIConfig('api_provider', 'openai');
    $model = getAIConfig('model', 'gpt-3.5-turbo');
    $avgTokens = getAIConfig('max_tokens', 150);
    $costPer1k = getCostPer1kTokens($provider, $model);
    $savedCost = ($cacheHits * $avgTokens / 1000) * $costPer1k;
    
    return [
        'api_calls' => [
            'total' => $totalCalls,
            'successful' => $stats['successful_calls'],
            'failed' => $stats['failed_calls'],
            'success_rate' => round($successRate, 2)
        ],
        'cache' => [
            'hits' => $stats['cache_hits'] ?? 0,
            'total_requests' => $totalRequests,
            'hit_rate' => round($cacheHitRate, 2),
            'saved_cost' => round($savedCost, 4)
        ],
        'cost' => [
            'total_tokens' => $stats['total_tokens'] ?? 0,
            'estimated_cost' => round($stats['estimated_cost'] ?? 0, 4),
            'currency' => 'USD'
        ],
        'rate_limit' => [
            'max_per_day' => $maxPerDay,
            'current_usage' => $totalCalls,
            'usage_percent' => round($usagePercent, 2),
            'remaining' => max(0, $maxPerDay - $totalCalls)
        ],
        'last_call' => $stats['last_call_time'] ?? 'Never',
        'provider' => $provider,
        'model' => $model
    ];
}

/**
 * 格式化使用报告为可读文本
 * @return string 格式化的报告
 */
function formatUsageReport() {
    $report = getUsageReport();
    
    $output = "=== AI API 使用统计报告 ===\n\n";
    
    $output .= "【API调用】\n";
    $output .= "  总调用次数: {$report['api_calls']['total']}\n";
    $output .= "  成功: {$report['api_calls']['successful']}\n";
    $output .= "  失败: {$report['api_calls']['failed']}\n";
    $output .= "  成功率: {$report['api_calls']['success_rate']}%\n\n";
    
    $output .= "【缓存效率】\n";
    $output .= "  缓存命中: {$report['cache']['hits']}\n";
    $output .= "  总请求数: {$report['cache']['total_requests']}\n";
    $output .= "  命中率: {$report['cache']['hit_rate']}%\n";
    $output .= "  节省成本: \${$report['cache']['saved_cost']}\n\n";
    
    $output .= "【成本统计】\n";
    $output .= "  总令牌数: {$report['cost']['total_tokens']}\n";
    $output .= "  估算成本: \${$report['cost']['estimated_cost']} {$report['cost']['currency']}\n\n";
    
    $output .= "【速率限制】\n";
    $output .= "  每日限制: {$report['rate_limit']['max_per_day']}\n";
    $output .= "  当前使用: {$report['rate_limit']['current_usage']}\n";
    $output .= "  使用率: {$report['rate_limit']['usage_percent']}%\n";
    $output .= "  剩余额度: {$report['rate_limit']['remaining']}\n\n";
    
    $output .= "【其他信息】\n";
    $output .= "  提供商: {$report['provider']}\n";
    $output .= "  模型: {$report['model']}\n";
    $output .= "  最后调用: {$report['last_call']}\n";
    
    return $output;
}

/**
 * 检查速率限制
 * @return array 包含allowed和message的数组
 */
function checkRateLimit() {
    if (!getAIConfig('rate_limit.enabled', true)) {
        return [
            'allowed' => true,
            'message' => '速率限制未启用'
        ];
    }
    
    $maxPerDay = getAIConfig('rate_limit.max_calls_per_day', 100);
    $maxPerHour = getAIConfig('rate_limit.max_calls_per_hour', 20);
    
    // 这里简化实现，实际应该检查时间窗口内的调用次数
    $stats = getAPIStats();
    $totalCalls = $stats['total_calls'];
    
    // 简单检查：如果今天的调用次数超过限制
    // 实际应该检查最近24小时和最近1小时的调用次数
    if ($totalCalls >= $maxPerDay) {
        return [
            'allowed' => false,
            'message' => '已达到每日调用限制'
        ];
    }
    
    return [
        'allowed' => true,
        'message' => '速率限制检查通过'
    ];
}

/**
 * 获取备用内容
 * @param string $type 内容类型（quote, anniversary等）
 * @param string $seed 种子（用于确定性选择，如日期）
 * @param string $subType 子类型（对于anniversary: monthly/yearly/special）
 * @return string 备用内容
 */
function getFallbackContent($type = 'quote', $seed = null, $subType = null) {
    if ($type === 'anniversary') {
        $messages = getAIConfig('fallback.anniversary_messages', []);
        
        // 如果有子类型，尝试获取特定类型的消息
        if ($subType && isset($messages[$subType]) && !empty($messages[$subType])) {
            $typeMessages = $messages[$subType];
            
            if ($seed !== null) {
                $index = crc32($seed) % count($typeMessages);
                return $typeMessages[$index];
            }
            
            return $typeMessages[array_rand($typeMessages)];
        }
        
        // 否则从所有消息中选择
        $allMessages = [];
        foreach ($messages as $msgs) {
            if (is_array($msgs)) {
                $allMessages = array_merge($allMessages, $msgs);
            }
        }
        
        if (empty($allMessages)) {
            return '祝我们的爱情长长久久！💕';
        }
        
        if ($seed !== null) {
            $index = crc32($seed) % count($allMessages);
            return $allMessages[$index];
        }
        
        return $allMessages[array_rand($allMessages)];
    }
    
    // 默认处理情话类型
    $quotes = getAIConfig('fallback.quotes', []);
    
    if (empty($quotes)) {
        return '今天也要开心哦！';
    }
    
    // 如果提供了种子，使用确定性选择
    if ($seed !== null) {
        $index = crc32($seed) % count($quotes);
        return $quotes[$index];
    }
    
    // 否则随机返回一条
    return $quotes[array_rand($quotes)];
}

/**
 * 获取提示词模板
 * @param string $type 提示词类型
 * @param array $params 参数
 * @return string 提示词
 */
function getPromptTemplate($type, $params = []) {
    $template = getAIConfig("prompts.{$type}", '');
    
    if (empty($template)) {
        // 提供默认模板
        if ($type === 'daily_quote') {
            $template = '请生成一句浪漫温馨的情话，适合情侣之间表达爱意。要求简短、真挚、富有情感。';
        } elseif ($type === 'anniversary') {
            $anniversaryType = $params['type'] ?? 'monthly';
            $count = $params['count'] ?? 1;
            
            if ($anniversaryType === 'monthly') {
                $template = "请为恋爱{$count}个月纪念日生成一句温馨的祝福语，表达对这段感情的珍惜和期待。";
            } elseif ($anniversaryType === 'yearly') {
                $template = "请为恋爱{$count}周年纪念日生成一句浪漫的祝福语，回顾这段时光并展望未来。";
            } elseif ($anniversaryType === 'special') {
                $template = "请为在一起{$count}天的特殊纪念日生成一句有意义的祝福语，庆祝这个里程碑。";
            }
        }
    }
    
    // 替换参数
    foreach ($params as $key => $value) {
        $template = str_replace('{' . $key . '}', $value, $template);
    }
    
    return $template;
}

/**
 * ============================================
 * 安全功能
 * ============================================
 */

/**
 * 验证API密钥格式
 * @param string $apiKey API密钥
 * @param string $provider API提供商
 * @return array 包含valid和message的数组
 */
function validateAPIKey($apiKey, $provider = 'openai') {
    if (empty($apiKey)) {
        return [
            'valid' => false,
            'message' => 'API密钥不能为空'
        ];
    }
    
    // 检查是否是示例密钥
    if (in_array($apiKey, ['YOUR_API_KEY_HERE', 'your-api-key-here', 'sk-your-api-key-here'])) {
        return [
            'valid' => false,
            'message' => '请替换为真实的API密钥'
        ];
    }
    
    // 根据提供商验证格式
    switch ($provider) {
        case 'openai':
            // OpenAI密钥格式: sk-proj-xxx 或 sk-xxx
            if (!preg_match('/^sk-(proj-)?[A-Za-z0-9_-]{20,}$/', $apiKey)) {
                return [
                    'valid' => false,
                    'message' => 'OpenAI API密钥格式不正确（应以sk-开头）'
                ];
            }
            break;
            
        case 'deepseek':
            // DeepSeek密钥格式: sk-xxx
            if (!preg_match('/^sk-[A-Za-z0-9_-]{20,}$/', $apiKey)) {
                return [
                    'valid' => false,
                    'message' => 'DeepSeek API密钥格式不正确（应以sk-开头）'
                ];
            }
            break;
            
        case 'anthropic':
            // Anthropic密钥格式: sk-ant-xxx
            if (!preg_match('/^sk-ant-[A-Za-z0-9_-]{20,}$/', $apiKey)) {
                return [
                    'valid' => false,
                    'message' => 'Anthropic API密钥格式不正确（应以sk-ant-开头）'
                ];
            }
            break;
    }
    
    return [
        'valid' => true,
        'message' => 'API密钥格式有效'
    ];
}

/**
 * 验证配置参数
 * @param string $key 配置键名
 * @param mixed $value 配置值
 * @return array 包含valid和message的数组
 */
function validateConfigValue($key, $value) {
    switch ($key) {
        case 'enabled':
            if (!is_bool($value)) {
                return ['valid' => false, 'message' => 'enabled必须是布尔值'];
            }
            break;
            
        case 'api_provider':
            $validProviders = ['openai', 'deepseek', 'anthropic'];
            if (!in_array($value, $validProviders)) {
                return ['valid' => false, 'message' => 'api_provider必须是: ' . implode(', ', $validProviders)];
            }
            break;
            
        case 'model':
            if (!is_string($value) || empty($value)) {
                return ['valid' => false, 'message' => 'model必须是非空字符串'];
            }
            break;
            
        case 'max_tokens':
            if (!is_int($value) || $value < 1 || $value > 4096) {
                return ['valid' => false, 'message' => 'max_tokens必须是1-4096之间的整数'];
            }
            break;
            
        case 'temperature':
            if (!is_numeric($value) || $value < 0 || $value > 1) {
                return ['valid' => false, 'message' => 'temperature必须是0-1之间的数值'];
            }
            break;
            
        case 'timeout':
            if (!is_int($value) || $value < 1 || $value > 300) {
                return ['valid' => false, 'message' => 'timeout必须是1-300之间的整数'];
            }
            break;
            
        case 'retry_attempts':
            if (!is_int($value) || $value < 0 || $value > 10) {
                return ['valid' => false, 'message' => 'retry_attempts必须是0-10之间的整数'];
            }
            break;
    }
    
    return ['valid' => true, 'message' => '配置值有效'];
}

/**
 * 清理和验证输入
 * @param string $input 输入字符串
 * @param string $type 输入类型（text, html, json等）
 * @return string 清理后的输入
 */
function sanitizeInput($input, $type = 'text') {
    if (!is_string($input)) {
        return '';
    }
    
    switch ($type) {
        case 'html':
            // 允许基本HTML标签
            return strip_tags($input, '<p><br><strong><em><a>');
            
        case 'json':
            // JSON不需要额外清理，但要验证
            $decoded = json_decode($input);
            return json_last_error() === JSON_ERROR_NONE ? $input : '';
            
        case 'text':
        default:
            // 移除所有HTML标签和特殊字符
            return htmlspecialchars(strip_tags($input), ENT_QUOTES, 'UTF-8');
    }
}

/**
 * 转义输出
 * @param string $output 输出字符串
 * @param string $context 输出上下文（html, json, js等）
 * @return string 转义后的输出
 */
function escapeOutput($output, $context = 'html') {
    if (!is_string($output)) {
        return '';
    }
    
    switch ($context) {
        case 'html':
            return htmlspecialchars($output, ENT_QUOTES, 'UTF-8');
            
        case 'json':
            return json_encode($output, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
            
        case 'js':
            // JavaScript字符串转义
            $output = str_replace(['\\', "'", '"', "\n", "\r", "\t"], ['\\\\', "\\'", '\\"', '\\n', '\\r', '\\t'], $output);
            return $output;
            
        case 'url':
            return urlencode($output);
            
        default:
            return htmlspecialchars($output, ENT_QUOTES, 'UTF-8');
    }
}

/**
 * 验证配置文件权限
 * @return array 包含valid和message的数组
 */
function validateConfigFilePermissions() {
    $configFile = AI_CONFIG_FILE;
    
    if (!file_exists($configFile)) {
        return [
            'valid' => false,
            'message' => '配置文件不存在'
        ];
    }
    
    // 检查文件是否可读
    if (!is_readable($configFile)) {
        return [
            'valid' => false,
            'message' => '配置文件不可读'
        ];
    }
    
    // 检查文件是否可写
    if (!is_writable($configFile)) {
        return [
            'valid' => false,
            'message' => '配置文件不可写'
        ];
    }
    
    // 在Unix系统上检查权限
    if (function_exists('fileperms')) {
        $perms = fileperms($configFile);
        $octal = substr(sprintf('%o', $perms), -4);
        
        // 建议权限: 600 (仅所有者可读写) 或 644 (所有者可读写，其他人只读)
        if ($octal !== '0600' && $octal !== '0644') {
            return [
                'valid' => false,
                'message' => "配置文件权限不安全（当前: {$octal}，建议: 0600或0644）"
            ];
        }
    }
    
    return [
        'valid' => true,
        'message' => '配置文件权限正常'
    ];
}

/**
 * 检查配置文件是否被Web服务器保护
 * @return array 包含protected和message的数组
 */
function checkConfigFileProtection() {
    $dataDir = dirname(AI_CONFIG_FILE);
    $htaccessFile = $dataDir . '/.htaccess';
    
    if (!file_exists($htaccessFile)) {
        return [
            'protected' => false,
            'message' => '缺少.htaccess保护文件'
        ];
    }
    
    $content = file_get_contents($htaccessFile);
    
    // 检查是否包含保护配置文件的规则
    if (strpos($content, 'ai_config.json') === false) {
        return [
            'protected' => false,
            'message' => '.htaccess未包含配置文件保护规则'
        ];
    }
    
    return [
        'protected' => true,
        'message' => '配置文件已被.htaccess保护'
    ];
}

/**
 * 执行完整的安全检查
 * @return array 安全检查结果
 */
function performSecurityCheck() {
    $results = [];
    
    // 1. 检查API密钥
    $apiKey = getAIConfig('api_key', '');
    $provider = getAIConfig('api_provider', 'openai');
    $results['api_key'] = validateAPIKey($apiKey, $provider);
    
    // 2. 检查配置有效性
    $results['config'] = validateAIConfig();
    
    // 3. 检查文件权限
    $results['permissions'] = validateConfigFilePermissions();
    
    // 4. 检查Web保护
    $results['web_protection'] = checkConfigFileProtection();
    
    // 5. 检查关键配置值
    $results['max_tokens'] = validateConfigValue('max_tokens', getAIConfig('max_tokens', 150));
    $results['temperature'] = validateConfigValue('temperature', getAIConfig('temperature', 0.7));
    $results['timeout'] = validateConfigValue('timeout', getAIConfig('timeout', 30));
    
    // 计算总体安全评分
    $totalChecks = count($results);
    $passedChecks = 0;
    
    foreach ($results as $result) {
        if (isset($result['valid']) && $result['valid']) {
            $passedChecks++;
        } elseif (isset($result['protected']) && $result['protected']) {
            $passedChecks++;
        }
    }
    
    $securityScore = $totalChecks > 0 ? round(($passedChecks / $totalChecks) * 100, 2) : 0;
    
    return [
        'checks' => $results,
        'score' => $securityScore,
        'passed' => $passedChecks,
        'total' => $totalChecks,
        'status' => $securityScore >= 80 ? 'good' : ($securityScore >= 60 ? 'warning' : 'critical')
    ];
}

/**
 * 格式化安全检查报告
 * @return string 格式化的报告
 */
function formatSecurityReport() {
    $report = performSecurityCheck();
    
    $output = "=== AI功能安全检查报告 ===\n\n";
    $output .= "安全评分: {$report['score']}% ({$report['passed']}/{$report['total']} 通过)\n";
    $output .= "状态: ";
    
    switch ($report['status']) {
        case 'good':
            $output .= "✅ 良好\n\n";
            break;
        case 'warning':
            $output .= "⚠️ 警告\n\n";
            break;
        case 'critical':
            $output .= "❌ 严重\n\n";
            break;
    }
    
    $output .= "详细检查结果:\n";
    
    foreach ($report['checks'] as $name => $result) {
        $status = '❌';
        if (isset($result['valid']) && $result['valid']) {
            $status = '✅';
        } elseif (isset($result['protected']) && $result['protected']) {
            $status = '✅';
        }
        
        $message = $result['message'] ?? 'Unknown';
        $output .= "  {$status} {$name}: {$message}\n";
    }
    
    return $output;
}

/**
 * 记录安全事件
 * @param string $event 事件类型
 * @param array $details 事件详情
 * @return bool 是否成功
 */
function logSecurityEvent($event, $details = []) {
    $logFile = dirname(AI_CONFIG_FILE) . '/logs/security.log';
    $logDir = dirname($logFile);
    
    // 确保日志目录存在
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'CLI';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'event' => $event,
        'ip' => $ip,
        'user_agent' => $userAgent,
        'details' => $details
    ];
    
    $logLine = json_encode($logEntry, JSON_UNESCAPED_UNICODE) . "\n";
    
    return file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX) !== false;
}
