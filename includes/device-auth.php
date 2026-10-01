<?php
/** Browser authorization. Secrets never leave HttpOnly cookies or enter storage. */
function deviceStorePath() {
    return defined('COUPLE_DEVICE_STORE') ? COUPLE_DEVICE_STORE : dirname(__DIR__, 2) . '/.couple-device-state/' . basename(dirname(__DIR__)) . '/state.json';
}

function deviceTransaction(callable $callback) {
    $path = deviceStorePath();
    $lock = fopen($path . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Device storage unavailable');
    try {
        $raw = is_file($path) ? file_get_contents($path) : false;
        $state = $raw === false ? null : json_decode($raw, true);
        if (!is_array($state) || ($state['version'] ?? null) !== 1 || !isset($state['bound'], $state['devices'], $state['rates'])) {
            throw new RuntimeException('Device storage invalid');
        }
        $before = $state;
        $result = $callback($state);
        if ($before !== $state) {
            $tmp = $path . '.tmp.' . bin2hex(random_bytes(6));
            $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            if (file_put_contents($tmp, $json) !== strlen($json)) throw new RuntimeException('Device write failed');
            chmod($tmp, 0600);
            if (!rename($tmp, $path)) { unlink($tmp); throw new RuntimeException('Device replace failed'); }
        }
        return $result;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function deviceCookieName($userId) { return '__Host-couple_device_' . substr(hash('sha256', $userId), 0, 16); }
function deviceToken($userId) {
    $token = $_COOKIE[deviceCookieName($userId)] ?? '';
    return is_string($token) && preg_match('/^[a-f0-9]{32}\.[a-f0-9]{64}$/D', $token) ? explode('.', $token) : null;
}
function deviceMatches($record, $userId, $token) {
    return $token && $record && $record['user_id'] === $userId && hash_equals($record['secret_hash'], hash('sha256', $token[1]));
}
function deviceSetCookie($userId, $token) {
    if (PHP_SAPI !== 'cli' && empty($_SERVER['HTTPS'])) throw new RuntimeException('HTTPS required');
    if (PHP_SAPI !== 'cli') {
        if (!setcookie(deviceCookieName($userId), $token, ['expires'=>time()+15552000, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Strict'])) throw new RuntimeException('Cookie failed');
    }
    $_COOKIE[deviceCookieName($userId)] = $token;
}
function deviceSessionValid() {
    $uid = $_SESSION['user_id'] ?? '';
    $id = $_SESSION['device_id'] ?? '';
    if (!$uid || !$id || empty($_SESSION['logged_in'])) return false;
    $token = deviceToken($uid);
    if (!$token || !hash_equals($id, $token[0])) return false;
    try {
        return deviceTransaction(function (&$s) use ($uid, $id, $token) {
            $r = $s['devices'][$id] ?? null;
            $ok = deviceMatches($r, $uid, $token) && $r['status'] === 'active' && $r['expires_at'] > time();
            if ($ok && time() - $r['last_seen'] > 300) $s['devices'][$id]['last_seen'] = time();
            return $ok;
        });
    } catch (Throwable $e) { return false; }
}
function deviceIsAdmin() {
    $admin = getUserConfig('拾柒');
    return $admin && isLoggedIn() && hash_equals((string)$admin['id'], (string)getCurrentUserId());
}

/** Called only after existing account credentials have been validated. */
function deviceAuthorizeLogin($user) {
    $uid = (string)$user['id'];
    $token = deviceToken($uid);
    $newToken = [bin2hex(random_bytes(16)), bin2hex(random_bytes(32))];
    $result = deviceTransaction(function (&$s) use ($user, $uid, $token, $newToken) {
        $now = time();
        foreach ($s['devices'] as $id => $r) {
            if ($r['status'] !== 'active' && $r['expires_at'] < $now - 86400) unset($s['devices'][$id]);
        }
        if ($token && deviceMatches($s['devices'][$token[0]] ?? null, $uid, $token)) {
            $r = $s['devices'][$token[0]];
            if ($r['expires_at'] > $now && in_array($r['status'], ['active','pending'], true)) {
                return ['status'=>$r['status'], 'id'=>$token[0], 'code'=>$r['pair_code']];
            }
            // Retired credentials remain invalid. A fresh credential may request
            // approval after login, but the bound ledger prevents auto-approval.
        }
        $first = empty($s['bound'][$uid]);
        $count = 0; $own = 0;
        foreach ($s['devices'] as $r) {
            if ($r['status'] === 'pending' && $r['expires_at'] > $now) { $count++; if ($r['user_id'] === $uid) $own++; }
        }
        if (!$first && ($count >= 20 || $own >= 5)) return ['status'=>'limited'];
        $status = $first ? 'active' : 'pending';
        $s['devices'][$newToken[0]] = [
            'user_id'=>$uid, 'name'=>$user['name'], 'secret_hash'=>hash('sha256', $newToken[1]),
            'status'=>$status, 'pair_code'=>(string)random_int(10000000,99999999), 'pair_failures'=>0,
            'created_at'=>$now, 'expires_at'=>$now+($first ? 15552000 : 600), 'last_seen'=>$now,
            'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown browser'),0,240),
            'ip'=>substr((string)($_SERVER['REMOTE_ADDR'] ?? ''),0,64), 'approved_by'=>$first ? 'first-login' : null
        ];
        if ($first) $s['bound'][$uid] = $now;
        return ['status'=>$status, 'id'=>$newToken[0], 'code'=>$s['devices'][$newToken[0]]['pair_code'], 'token'=>implode('.', $newToken)];
    });
    if (isset($result['token'])) deviceSetCookie($uid, $result['token']);
    initSession();
    if ($result['status'] === 'active') {
        $_SESSION['device_id'] = $result['id'];
        unset($_SESSION['device_pending_user']);
        return true;
    }
    unset($_SESSION['logged_in'], $_SESSION['device_id'], $_SESSION['private_authenticated']);
    $_SESSION['device_pending_user'] = $uid;
    if (PHP_SAPI === 'cli') return false;
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['success'=>false, 'device_pending'=>true, 'message'=>'当前浏览器未获授权，请前往设备验证页。'], JSON_UNESCAPED_UNICODE);
    exit;
}

function deviceRateLimit($key, $limit = 30) {
    return deviceTransaction(function (&$s) use ($key, $limit) {
        foreach ($s['rates'] as $k=>$v) if ($v['until'] <= time()) unset($s['rates'][$k]);
        $key = hash('sha256', $key);
        if (!isset($s['rates'][$key]) && count($s['rates']) >= 1000) return false;
        $r = $s['rates'][$key] ?? ['count'=>0,'until'=>time()+900];
        $r['count']++; $s['rates'][$key]=$r;
        return $r['count'] <= $limit;
    });
}

function deviceAdminAction($action, $id, $code = '') {
    if (!deviceIsAdmin()) throw new RuntimeException('仅拾柒管理员可以管理设备');
    return deviceTransaction(function (&$s) use ($action, $id, $code) {
        if (!isset($s['devices'][$id])) return ['success'=>false,'message'=>'设备不存在'];
        $r =& $s['devices'][$id];
        if ($action === 'approve') {
            if ($r['status'] !== 'pending' || $r['expires_at'] <= time()) return ['success'=>false,'message'=>'申请已失效'];
            if (!hash_equals($r['pair_code'], $code)) {
                $r['pair_failures']++;
                if ($r['pair_failures'] >= 5) $r['status']='denied';
                return ['success'=>false,'message'=>'核对码错误'];
            }
            $r['status']='active'; $r['expires_at']=time()+15552000; $r['approved_by']=getCurrentUserId();
        } elseif (in_array($action, ['deny','revoke'], true)) {
            $r['status']=$action === 'deny' ? 'denied' : 'revoked'; $r['expires_at']=time();
        } else return ['success'=>false,'message'=>'操作无效'];
        return ['success'=>true];
    });
}
