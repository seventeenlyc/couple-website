<?php
if (($argv[1]??'')==='child') {
    define('COUPLE_DEVICE_STORE',$argv[2]);
    require __DIR__.'/../includes/device-auth.php';
    function initSession(){}
    $_COOKIE=[];$_SESSION=[];
    echo deviceAuthorizeLogin(['id'=>'race','name'=>'race']) ? 'active' : 'pending';exit;
}
$dir=sys_get_temp_dir().'/couple-race-'.bin2hex(random_bytes(8));mkdir($dir,0700);
$file=$dir.'/state.json';file_put_contents($file,json_encode(['version'=>1,'bound'=>[],'devices'=>[],'rates'=>[]]));
$jobs=[];
try {
    for($i=0;$i<8;$i++){
        $proc=proc_open([PHP_BINARY,__FILE__,'child',$file],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
        $jobs[]=[$proc,$pipes];
    }
    $active=0;
    foreach($jobs as [$proc,$pipes]){
        $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
        if(proc_close($proc)!==0||$err)throw new RuntimeException('Child error: '.$err);
        if($out==='active')$active++;
    }
    if($active!==1)throw new RuntimeException('Expected one initial binding, got '.$active);
    echo "PASS: eight concurrent first logins produce exactly one authorized browser\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
