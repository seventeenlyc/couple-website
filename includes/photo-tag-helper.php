<?php
/**
 * 拆分照片标签，支持英文逗号和中文逗号。
 *
 * @param mixed $value 原始标签字符串
 * @return array
 */
function splitPhotoTags($value) {
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $parts = preg_split('/[,，]+/u', $value);
    if ($parts === false) {
        return [];
    }

    return array_values(array_filter(array_map('trim', $parts), function($tag) {
        return $tag !== '';
    }));
}
