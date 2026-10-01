<?php
// Nginx sends all private resources through this entry point.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (strpos($path, "\0") !== false || strpos($path, '\\') !== false || preg_match('#(^|/)\.{1,2}(/|$)#', $path)) { http_response_code(404); exit; }
$public = ['/api/login.php','/api/csrf-token.php','/api/devices.php','/device-login.php','/device-access.php'];
header('Cache-Control: private, no-store');
if (!in_array($path,$public,true)) {
    require_once __DIR__ . '/includes/auth.php';
    if (!isLoggedIn()) {
        if (preg_match('#^/[^/]+\.html$#',$path)) header('Location: /device-login.php');
        else { http_response_code(401); header('Content-Type: application/json'); echo '{"success":false,"message":"Login and device authorization required"}'; }
        exit;
    }
}
if (preg_match('#^/api/[a-z0-9-]+\.php$#D',$path) || in_array($path,['/device-login.php','/device-access.php'],true)) {
    $file=__DIR__.$path;
    if (!is_file($file)) { http_response_code(404); exit; }
    require $file; exit;
}
$private = false;
if (preg_match('#^/uploads/(?:private/)?([^/]+)/#',$path,$parts) && !in_array($parts[1],['photos','avatars','story'],true)) {
    if ($parts[1] !== (string)getCurrentUserId() || !isPrivateAuthenticated() || getPrivateUser() !== getCurrentUserId()) { http_response_code(404); exit; }
    $private = true;
}
if ((!$private && !preg_match('#^/(?:[a-z0-9-]+\.html|uploads/(?:photos|avatars|story)/[^\x00-\x1f]+)$#D',$path)) || preg_match('/\.(php\d*|phtml|phar|htaccess|ini)$/i',$path)) { http_response_code(404); exit; }
$ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
$types=['html'=>'text/html; charset=utf-8','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png','gif'=>'image/gif','webp'=>'image/webp','avif'=>'image/avif','mp4'=>'video/mp4','webm'=>'video/webm'];
if (!$private && (!isset($types[$ext]) || ($ext==='html' && strpos($path,'/uploads/')===0))) { http_response_code(404); exit; }
$file=realpath(__DIR__.$path);
if (!$file || strpos($file, realpath(__DIR__).DIRECTORY_SEPARATOR)!==0 || !is_file($file)) { http_response_code(404); exit; }
header('X-Content-Type-Options: nosniff');
header('Content-Type: '.($private ? 'application/octet-stream' : $types[$ext]));
if ($private) header("Content-Disposition: attachment; filename*=UTF-8''".rawurlencode(basename($path)));
header('X-Accel-Redirect: /_device_files' . implode('/',array_map('rawurlencode',explode('/',$path))));
