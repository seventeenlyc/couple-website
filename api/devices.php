<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/device-auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) $input = $_POST;
    if (!is_string($input['csrf_token'] ?? null) || !validateCSRFToken($input['csrf_token'])) { http_response_code(403); exit; }
    $action = $input['action'] ?? '';
    if ($action === 'status') {
        if (isLoggedIn()) {
            echo json_encode(['success'=>true,'status'=>'active','admin'=>deviceIsAdmin()]); exit;
        }
        $uid = $_SESSION['device_pending_user'] ?? '';
        $token = deviceToken($uid);
        $result = deviceTransaction(function (&$s) use ($uid, $token) {
            $r = $token ? ($s['devices'][$token[0]] ?? null) : null;
            if (!deviceMatches($r,$uid,$token)) return ['status'=>'missing'];
            if ($r['expires_at'] <= time()) return ['status'=>'expired'];
            return ['status'=>$r['status'],'code'=>$r['pair_code']];
        });
        if ($result['status'] === 'active') {
            foreach (getConfig('users',[]) as $name=>$user) {
                if ((string)$user['id'] === $uid) {
                    initSession(); $_SESSION['device_id']=$token[0]; createSession($name,$uid);
                    unset($_SESSION['device_pending_user']); break;
                }
            }
            if (!isLoggedIn()) $result=['status'=>'missing'];
        }
        echo json_encode(['success'=>true]+$result); exit;
    }
    if (!deviceIsAdmin()) { http_response_code(403); echo json_encode(['success'=>false,'message'=>'仅拾柒管理员可以管理设备'],JSON_UNESCAPED_UNICODE); exit; }
    if ($action === 'list') {
        $rows=deviceTransaction(function (&$s) {
            $rows=[];
            foreach ($s['devices'] as $id=>$r) {
                unset($r['secret_hash'], $r['pair_code']);
                if ($r['expires_at'] <= time() && in_array($r['status'],['pending','active'],true)) $r['status']='expired';
                $rows[]=['id'=>$id,'current'=>$id===($_SESSION['device_id']??'')]+$r;
            }
            return $rows;
        });
        echo json_encode(['success'=>true,'devices'=>$rows],JSON_UNESCAPED_UNICODE); exit;
    }
    echo json_encode(deviceAdminAction((string)$action,(string)($input['id']??''),(string)($input['code']??'')),JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(503); echo json_encode(['success'=>false,'message'=>'设备验证暂不可用，请稍后重试'],JSON_UNESCAPED_UNICODE);
}
