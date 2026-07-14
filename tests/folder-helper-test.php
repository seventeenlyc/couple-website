<?php

define('INCLUDED', true);
require_once __DIR__ . '/../includes/folder-helper.php';

function assertSameValue($expected, $actual, $message) {
    if ($expected !== $actual) {
        fwrite(STDERR, $message . PHP_EOL);
        fwrite(STDERR, 'Expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . PHP_EOL);
        fwrite(STDERR, 'Actual:   ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . PHP_EOL);
        exit(1);
    }
}

$tempFile = tempnam(sys_get_temp_dir(), 'album-folders-');

try {
    file_put_contents($tempFile, json_encode([
        'folders' => [
            ['name' => '26.7.13', 'path' => 'Date/26.7/26.7.13', 'parent_path' => 'Date/26.7'],
            ['name' => 'Date', 'path' => 'Date', 'parent_path' => ''],
            ['name' => 'invalid'],
            ['name' => '26.7', 'path' => 'Date/26.7', 'parent_path' => 'Date'],
        ],
        'photos' => [],
    ], JSON_UNESCAPED_UNICODE));

    $folders = getAllFolders($tempFile);
    $paths = array_column($folders, 'path');

    assertSameValue(
        ['Date', 'Date/26.7', 'Date/26.7/26.7.13'],
        $paths,
        '完整文件夹列表应包含所有有效层级并按路径排序'
    );

    echo "folder-helper-test: PASS" . PHP_EOL;
} finally {
    @unlink($tempFile);
}
