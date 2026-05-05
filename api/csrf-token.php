<?php
/**
 * CSRF Token API
 * Returns the current CSRF token for frontend JavaScript use.
 * Also reports login state so the frontend can know who is logged in.
 */
define('INCLUDED', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

$response = [
    'success' => true,
    'csrf_token' => generateCSRFToken()
];

if (isLoggedIn()) {
    $response['user'] = getCurrentUser();
    $response['user_id'] = getCurrentUserId();
    $response['logged_in'] = true;
} else {
    $response['user'] = null;
    $response['user_id'] = null;
    $response['logged_in'] = false;
}

echo json_encode($response, JSON_UNESCAPED_UNICODE);
