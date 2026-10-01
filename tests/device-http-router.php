<?php
// Only used by the loopback PHP integration-test server.
define('COUPLE_DEVICE_STORE',__DIR__.'/http-state.json');
$_SERVER['HTTPS']='on';
require __DIR__.'/../device-gateway.php';
