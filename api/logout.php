<?php
/**
 * 登出API
 * 销毁用户会话并重定向到登录页面
 */

define('INCLUDED', true);

require_once __DIR__ . '/../includes/session.php';

// 销毁会话
destroySession();

// 重定向到登录页面
header('Location: ../index.php');
exit();
