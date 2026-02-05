<?php
/**
 * 缩略图生成助手
 */

if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

/**
 * 生成缩略图
 * @param string $sourcePath 原图路径
 * @param string $thumbPath 缩略图保存路径
 * @param int $maxWidth 最大宽度
 * @param int $maxHeight 最大高度
 * @param int $quality 质量 (1-100)
 * @return bool 是否成功
 */
function generateThumbnail($sourcePath, $thumbPath, $maxWidth = 400, $maxHeight = 400, $quality = 80) {
    // 获取原图信息
    $imageInfo = @getimagesize($sourcePath);
    if ($imageInfo === false) {
        return false;
    }
    
    $width = $imageInfo[0];
    $height = $imageInfo[1];
    $type = $imageInfo[2];
    
    // 计算缩略图尺寸
    $ratio = min($maxWidth / $width, $maxHeight / $height);
    
    // 如果原图已经够小，直接复制
    if ($ratio >= 1) {
        return copy($sourcePath, $thumbPath);
    }
    
    $newWidth = (int)($width * $ratio);
    $newHeight = (int)($height * $ratio);
    
    // 创建原图资源
    switch ($type) {
        case IMAGETYPE_JPEG:
            $source = @imagecreatefromjpeg($sourcePath);
            break;
        case IMAGETYPE_PNG:
            $source = @imagecreatefrompng($sourcePath);
            break;
        case IMAGETYPE_GIF:
            $source = @imagecreatefromgif($sourcePath);
            break;
        default:
            return false;
    }
    
    if (!$source) {
        return false;
    }
    
    // 创建缩略图资源
    $thumb = imagecreatetruecolor($newWidth, $newHeight);
    
    // 处理PNG和GIF的透明度
    if ($type == IMAGETYPE_PNG || $type == IMAGETYPE_GIF) {
        imagealphablending($thumb, false);
        imagesavealpha($thumb, true);
        $transparent = imagecolorallocatealpha($thumb, 255, 255, 255, 127);
        imagefilledrectangle($thumb, 0, 0, $newWidth, $newHeight, $transparent);
    }
    
    // 缩放图片
    imagecopyresampled($thumb, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
    
    // 确保目录存在
    $thumbDir = dirname($thumbPath);
    if (!is_dir($thumbDir)) {
        mkdir($thumbDir, 0755, true);
    }
    
    // 保存缩略图
    $result = false;
    switch ($type) {
        case IMAGETYPE_JPEG:
            $result = imagejpeg($thumb, $thumbPath, $quality);
            break;
        case IMAGETYPE_PNG:
            $result = imagepng($thumb, $thumbPath, 9 - (int)($quality / 11));
            break;
        case IMAGETYPE_GIF:
            $result = imagegif($thumb, $thumbPath);
            break;
    }
    
    // 释放资源
    imagedestroy($source);
    imagedestroy($thumb);
    
    return $result;
}

/**
 * 获取缩略图路径
 * @param string $originalPath 原图路径
 * @return string 缩略图路径
 */
function getThumbnailPath($originalPath) {
    $pathInfo = pathinfo($originalPath);
    $dir = $pathInfo['dirname'];
    $filename = $pathInfo['filename'];
    $ext = $pathInfo['extension'];
    
    // 缩略图放在 thumbs 子目录
    return $dir . '/thumbs/' . $filename . '_thumb.' . $ext;
}

/**
 * 检查缩略图是否存在
 * @param string $originalPath 原图路径
 * @return bool
 */
function thumbnailExists($originalPath) {
    $thumbPath = getThumbnailPath($originalPath);
    return file_exists($thumbPath);
}

/**
 * 获取图片的缩略图URL（如果存在）或原图URL
 * @param string $originalPath 原图路径
 * @return string
 */
function getImageDisplayUrl($originalPath) {
    $thumbPath = getThumbnailPath($originalPath);
    if (file_exists($thumbPath)) {
        return $thumbPath;
    }
    return $originalPath;
}
