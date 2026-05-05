<?php
/**
 * App configuration API
 * Returns safe (non-sensitive) config values for frontend use.
 */
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/avatar-helper.php';

initSession();
header('Content-Type: application/json; charset=utf-8');

$startDate = getStartDate();
$duration = calculateLoveDuration($startDate);
$currentUser = getCurrentUser();

// Build avatar URLs for both users
$avatars = [];
if ($currentUser) {
    $currentId = getCurrentUserId();
    $users = getConfig('users', []);
    foreach ($users as $name => $info) {
        $avatarPath = getUserAvatarUrl($name);
        $avatars[] = [
            'user_id' => $info['id'],
            'username' => $name,
            'avatar' => $avatarPath
        ];
    }
}


$response = [
    'success' => true,
    'startDate' => $startDate,
    'love_days' => $duration['days'],
    'love_duration' => [
        'years' => $duration['years'],
        'months' => $duration['months'],
        'days' => $duration['remainingDays'],
        'total_days' => $duration['days']
    ],
    'logged_in' => isLoggedIn(),
    'current_user' => $currentUser,
    'current_user_id' => $currentId ?? null,
    'avatars' => $avatars
];

echo json_encode($response, JSON_UNESCAPED_UNICODE);
