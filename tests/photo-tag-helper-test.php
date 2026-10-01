<?php

require_once __DIR__ . '/../includes/photo-tag-helper.php';

function assertTagList($expected, $actual, $message) {
    if ($expected !== $actual) {
        fwrite(STDERR, $message . PHP_EOL);
        fwrite(STDERR, 'Expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . PHP_EOL);
        fwrite(STDERR, 'Actual:   ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . PHP_EOL);
        exit(1);
    }
}

assertTagList(
    ['约会', '甜甜蜜蜜', '日常'],
    splitPhotoTags('约会，甜甜蜜蜜, 日常'),
    '照片标签应同时支持中文和英文逗号分隔'
);

assertTagList(
    ['旅行', '生活'],
    splitPhotoTags(' 旅行，，生活, ,'),
    '照片标签应去除空白项'
);

echo "photo-tag-helper-test: PASS" . PHP_EOL;
