<?php
/**
 * 悄悄话辅助函数
 * 存储和读取用户之间发送的悄悄话
 */

require_once __DIR__ . '/json-helper.php';

if (!defined('INCLUDED')) {
    define('INCLUDED', true);
}

define('WHISPERS_FILE', __DIR__ . '/../data/whispers.json');

/**
 * 发送悄悄话
 * @param string $fromUserId 发送者ID
 * @param string $toUserId 接收者ID
 * @param string $content 悄悄话内容
 * @return array 结果
 */
function sendWhisper($fromUserId, $toUserId, $content) {
    $content = trim($content);
    if (empty($content)) {
        return ['success' => false, 'message' => '内容不能为空'];
    }

    $data = safeReadJSON(WHISPERS_FILE, ['whispers' => []]);

    $whisper = [
        'id' => 'whisper_' . uniqid(),
        'from_user' => $fromUserId,
        'to_user' => $toUserId,
        'content' => $content,
        'created_at' => date('Y-m-d H:i:s'),
        'read' => false
    ];

    $data['whispers'][] = $whisper;

    if (!safeWriteJSON(WHISPERS_FILE, $data)) {
        return ['success' => false, 'message' => '保存失败'];
    }

    return ['success' => true, 'message' => '悄悄话已发送'];
}

/**
 * 获取未读悄悄话
 * @param string $userId 当前用户ID
 * @return array 未读悄悄话列表
 */
function getUnreadWhispers($userId) {
    $data = safeReadJSON(WHISPERS_FILE, ['whispers' => []]);

    $unread = array_filter($data['whispers'], function($w) use ($userId) {
        return $w['to_user'] === $userId && !$w['read'];
    });

    // Sort by newest first
    usort($unread, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    return array_values($unread);
}

/**
 * 标记悄悄话为已读
 * @param string $whisperId 悄悄话ID
 * @param string $userId 当前用户ID（验证接收者身份）
 * @return bool 是否成功
 */
function markWhisperRead($whisperId, $userId) {
    $data = safeReadJSON(WHISPERS_FILE, ['whispers' => []]);

    foreach ($data['whispers'] as &$whisper) {
        if ($whisper['id'] === $whisperId && $whisper['to_user'] === $userId) {
            $whisper['read'] = true;

            // Also save to recipient's private space notes
            $privateFile = __DIR__ . '/../data/private_' . $userId . '.json';
            $privateData = safeReadJSON($privateFile, ['folders' => [], 'files' => [], 'notes' => []]);
            $privateData['notes'][] = [
                'id' => 'note_' . uniqid(),
                'content' => $whisper['content'],
                'from_user' => $whisper['from_user'],
                'whisper_id' => $whisperId,
                'created_at' => $whisper['created_at'],
                'read_at' => date('Y-m-d H:i:s')
            ];
            safeWriteJSON($privateFile, $privateData);

            return safeWriteJSON(WHISPERS_FILE, $data);
        }
    }

    return false;
}
