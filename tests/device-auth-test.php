<?php
// Runs with isolated state; never reads or binds production accounts.
$dir=sys_get_temp_dir().'/couple-device-test-'.bin2hex(random_bytes(8));mkdir($dir,0700);
define('COUPLE_DEVICE_STORE',$dir.'/state.json');
require __DIR__.'/../includes/device-auth.php';
function initSession() {}
function getUserConfig($name){return $name==='拾柒'?['id'=>'admin']:null;}
function isLoggedIn(){return deviceSessionValid();}
function getCurrentUserId(){return $_SESSION['user_id']??null;}
function check($ok,$message){if(!$ok)throw new RuntimeException($message);}
function loginAs($u){$ok=deviceAuthorizeLogin($u);if($ok){$_SESSION['user_id']=$u['id'];$_SESSION['logged_in']=true;}return $ok;}
file_put_contents(COUPLE_DEVICE_STORE,json_encode(['version'=>1,'bound'=>[],'devices'=>[],'rates'=>[]]));
$_SESSION=[];$_COOKIE=[];
$admin=['id'=>'admin','name'=>'拾柒'];$member=['id'=>'member','name'=>'Partner'];
try{
    check(loginAs($admin),'first admin login binds');check(deviceIsAdmin(),'admin role');
    $adminSession=$_SESSION;$adminCookies=$_COOKIE;$adminId=$_SESSION['device_id'];
    $_SESSION=[];$_COOKIE=[];check(!loginAs($admin),'second admin browser blocked');
    $pendingCookies=$_COOKIE;$token=deviceToken('admin');
    $pendingId=$token[0];$code=deviceTransaction(fn(&$s)=>$s['devices'][$pendingId]['pair_code']);
    check(!deviceSessionValid(),'pending no session');
    $_SESSION=[];$_COOKIE=[];check(loginAs($member),'first member independently binds');check(!deviceIsAdmin(),'member not admin');
    $memberSession=$_SESSION;$memberCookies=$_COOKIE;
    try{deviceAdminAction('approve',$pendingId,$code);throw new RuntimeException('member approved');}catch(RuntimeException $e){check($e->getMessage()!=='member approved','member cannot approve');}
    $_SESSION=$adminSession;$_COOKIE=$adminCookies;
    check(!deviceAdminAction('approve',$pendingId,'wrong')['success'],'wrong code blocked');
    check(deviceAdminAction('approve',$pendingId,$code)['success'],'admin approval');
    check(!deviceAdminAction('approve',$pendingId,$code)['success'],'approval replay blocked');
    $_SESSION=[];$_COOKIE=$pendingCookies;check(loginAs($admin),'approved device logs in');check(deviceSessionValid(),'approved valid');
    $_COOKIE[deviceCookieName('admin')]=substr($_COOKIE[deviceCookieName('admin')],0,-1).'z';check(!deviceSessionValid(),'tampered token rejected');
    $_SESSION=$adminSession;$_COOKIE=$adminCookies;check(deviceAdminAction('revoke',$pendingId)['success'],'revoke');
    $_SESSION=[];$_COOKIE=$pendingCookies;check(!loginAs($admin),'revoked denied');
    $replacement=deviceToken('admin');
    check($replacement[0]!==$pendingId,'revoked browser gets a fresh approval request');
    $replacementId=$replacement[0];$replacementCookies=$_COOKIE;
    $fresh=deviceTransaction(fn(&$s)=>$s['devices'][$replacementId]);
    check($fresh['status']==='pending' && $fresh['expires_at']>time(),'replacement waits for admin approval');
    check(!deviceSessionValid(),'replacement cannot access before approval');
    check(!loginAs($admin) && deviceToken('admin')[0]===$replacementId,'repeat login reuses live pending request');
    $_SESSION=$adminSession;$_COOKIE=$adminCookies;
    check(deviceAdminAction('approve',$replacementId,$fresh['pair_code'])['success'],'replacement can be approved');
    $_SESSION=[];$_COOKIE=$replacementCookies;check(loginAs($admin),'reapproved browser logs in');
    $_SESSION=[];$_COOKIE=$pendingCookies;check(!deviceSessionValid(),'old revoked token remains invalid');
    deviceTransaction(function (&$s) use ($replacementId) {$s['devices'][$replacementId]['expires_at']=time()-1;});
    $_SESSION=[];$_COOKIE=$replacementCookies;check(!loginAs($admin),'expired authorization requires approval');
    check(deviceToken('admin')[0]!==$replacementId,'expired authorization receives fresh request');
    $_SESSION=$adminSession;$_COOKIE=$adminCookies;deviceAdminAction('revoke',$adminId);check(!deviceSessionValid(),'current revoked immediately');
    $_SESSION=[];$_COOKIE=[];check(!loginAs($admin),'all revoked does not reopen first login');
    $_SESSION=$memberSession;$_COOKIE=$adminCookies;check(!deviceSessionValid(),'cross-account cookie rejected');
    check(deviceRateLimit('test',2),'rate1');check(deviceRateLimit('test',2),'rate2');check(!deviceRateLimit('test',2),'persistent rate limit');
    $_SESSION=$memberSession;$_COOKIE=$memberCookies;
    file_put_contents(COUPLE_DEVICE_STORE,'invalid');check(!deviceSessionValid(),'corruption fails closed');
    unlink(COUPLE_DEVICE_STORE);check(!deviceSessionValid(),'missing store fails closed');
    echo "PASS: initial binding, account isolation, pending, admin role, approval, replay, tamper, revocation, rate limits, fail-closed\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
