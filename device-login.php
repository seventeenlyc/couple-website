<?php
require_once __DIR__.'/includes/config.php';
$needPassword=false;
foreach(getConfig('users',[]) as $u) if(!empty($u['password'])) $needPassword=true;
header('Cache-Control: no-store');
?>
<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>私人空间 · 登录</title>
<link rel="stylesheet" href="/assets/css/device-access.css">
<main><h1>欢迎回来</h1><p>首次登录会绑定当前浏览器。已绑定账号的新浏览器需要管理员授权。</p>
<form id="login"><label>你的称呼<input name="you" required autocomplete="username" maxlength="80"></label><label>对方的称呼<input name="baby" required maxlength="80"></label>
<?php if($needPassword): ?><label>登录密码<input name="password" type="password" required autocomplete="current-password"></label><?php endif; ?>
<button>登录</button></form><p id="message" role="status"></p><a href="/device-access.php">查看设备授权状态</a></main>
<script src="/assets/js/device-access.js" defer></script></html>
