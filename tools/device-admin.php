<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../includes/device-auth.php';
$action=$argv[1]??'';
$path=deviceStorePath();
if ($action==='init') {
    if (file_exists($path)) { fwrite(STDERR,"Already initialized; refusing to reset bindings.\n"); exit(1); }
    if (!is_dir(dirname($path)) && !mkdir(dirname($path),0700,true)) exit(1);
    $f=fopen($path,'x'); if(!$f)exit(1);
    fwrite($f,json_encode(['version'=>1,'bound'=>new stdClass(),'devices'=>new stdClass(),'rates'=>new stdClass()]));fclose($f);chmod($path,0600);
    echo "Initialized device store. No accounts bound.\n";exit;
}
if ($action==='recover' && !empty($argv[2])) {
    require_once __DIR__.'/../includes/config.php';
    $uid=$argv[2];$exists=false;
    foreach(getConfig('users',[]) as $u)if((string)$u['id']===$uid)$exists=true;
    if(!$exists)throw new RuntimeException('Unknown account');
    // Explicit server-only recovery reopens first login for this account.
    deviceTransaction(function(&$s)use($uid){
        unset($s['bound'][$uid]);
        foreach($s['devices'] as &$r)if($r['user_id']===$uid){$r['status']='revoked';$r['expires_at']=time();}
    });
    echo "Account recovery enabled. Clear this site's browser cookies, then immediately log in to bind it.\n";exit;
}
fwrite(STDERR,"Usage: php tools/device-admin.php init | recover USER_ID\n");exit(1);
