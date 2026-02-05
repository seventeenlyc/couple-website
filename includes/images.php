<?php
/**
 * 图片辅助函数
 * 提供真实图片链接（使用Unsplash）
 */

// 防止直接访问
if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

/**
 * 获取情侣主题的示例图片
 * 使用Unsplash的免费图片服务
 * 
 * @param string $category 图片类别
 * @param int $width 图片宽度
 * @param int $height 图片高度
 * @return string 图片URL
 */
function getUnsplashImage($category = 'couple', $width = 800, $height = 600) {
    // Unsplash Source API (免费，无需API key)
    // 注意：这个API已经被弃用，但仍然可用于演示
    // 生产环境应该使用官方API
    
    $categories = [
        'couple' => 'couple,love,romance',
        'nature' => 'nature,landscape',
        'food' => 'food,restaurant',
        'travel' => 'travel,adventure',
        'pet' => 'pet,dog,cat',
        'sunset' => 'sunset,sky',
        'beach' => 'beach,ocean',
        'city' => 'city,urban',
    ];
    
    $query = isset($categories[$category]) ? $categories[$category] : $category;
    
    // 使用Unsplash的随机图片API
    return "https://source.unsplash.com/{$width}x{$height}/?{$query}";
}

/**
 * 获取预定义的情侣主题图片集合
 * 使用Unsplash的特定图片ID，确保图片质量和主题相关性
 * 
 * @return array 图片URL数组
 */
function getCoupleThemeImages() {
    // 这些是精选的情侣/爱情主题图片
    // 使用Unsplash的特定图片，确保内容适合
    return [
        [
            'url' => 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&h=600&fit=crop',
            'alt' => '情侣牵手',
            'title' => '牵手的温暖',
            'description' => '十指相扣，温暖彼此'
        ],
        [
            'url' => 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=800&h=600&fit=crop',
            'alt' => '情侣看日落',
            'title' => '日落时分',
            'description' => '一起看最美的日落'
        ],
        [
            'url' => 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&h=600&fit=crop',
            'alt' => '情侣野餐',
            'title' => '浪漫野餐',
            'description' => '草地上的美好时光'
        ],
        [
            'url' => 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop',
            'alt' => '情侣旅行',
            'title' => '一起旅行',
            'description' => '探索世界的每个角落'
        ],
        [
            'url' => 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&h=600&fit=crop',
            'alt' => '情侣咖啡',
            'title' => '咖啡时光',
            'description' => '享受悠闲的下午茶'
        ],
    ];
}

/**
 * 获取背景图片
 * 
 * @param string $theme 主题（romantic, nature, abstract）
 * @return string 图片URL
 */
function getBackgroundImage($theme = 'romantic') {
    $themes = [
        'romantic' => 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=1920&h=1080&fit=crop',
        'nature' => 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
        'abstract' => 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&h=1080&fit=crop',
    ];
    
    return isset($themes[$theme]) ? $themes[$theme] : $themes['romantic'];
}

/**
 * 获取占位符图片
 * 当用户还没有上传照片时使用
 * 
 * @param int $width 宽度
 * @param int $height 高度
 * @param string $text 显示文字
 * @return string 图片URL
 */
function getPlaceholderImage($width = 800, $height = 600, $text = '暂无图片') {
    // 使用placeholder.com服务
    $encodedText = urlencode($text);
    return "https://via.placeholder.com/{$width}x{$height}/ffc0cb/ffffff?text={$encodedText}";
}

/**
 * 验证图片URL是否可访问
 * 
 * @param string $url 图片URL
 * @return bool 是否可访问
 */
function isImageAccessible($url) {
    $headers = @get_headers($url);
    return $headers && strpos($headers[0], '200') !== false;
}

/**
 * 获取图片的alt文本建议
 * 基于图片URL或上下文生成有意义的alt文本
 * 
 * @param string $context 上下文（如：couple, nature, food）
 * @return string alt文本
 */
function generateAltText($context = 'photo') {
    $altTexts = [
        'couple' => '情侣合照',
        'nature' => '自然风景',
        'food' => '美食照片',
        'travel' => '旅行照片',
        'pet' => '宠物照片',
        'selfie' => '自拍照',
        'group' => '合影',
        'default' => '照片'
    ];
    
    return isset($altTexts[$context]) ? $altTexts[$context] : $altTexts['default'];
}
