"""Apply only the device-auth changes to a separately staged copy of live files."""
import pathlib, re, sys
base=pathlib.Path(sys.argv[1])
def edit(rel, transform):
    p=base/rel
    old=p.read_text()
    new=transform(old)
    if new==old: raise RuntimeError('No change: '+rel)
    p.write_text(new)
def session(s):
    s=s.replace("function isLoggedIn() {", "function isLoggedIn() {")
    old="return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;"
    assert s.count(old)==1
    s=s.replace(old,old[:-1]+" && deviceSessionValid();")
    s=s.replace("function initSession() {", "require_once __DIR__ . '/device-auth.php';\n\nfunction initSession() {",1)
    s=re.sub(r"ini_set\('session.cookie_secure', 0\);[^\n]*", "ini_set('session.cookie_secure', 1);\n    ini_set('session.cookie_samesite', 'Lax');\n    ini_set('session.use_strict_mode', 1);",s)
    return s
edit('includes/session.php',session)
def auth(s):
    marker="    // 创建会话\n    createSession($userInfo['name'], $userInfo['id']);"
    assert s.count(marker)==1
    return s.replace(marker,"    if (!deviceAuthorizeLogin($userInfo)) return false;\n\n"+marker)
edit('includes/auth.php',auth)
def login(s):
    marker="$identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';"
    assert s.count(marker)==1
    extra="""
try {
    if (!deviceRateLimit('login:' . $identifier)) {
        http_response_code(429);
        echo json_encode(['success'=>false,'message'=>'请求过于频繁，请15分钟后重试'], JSON_UNESCAPED_UNICODE); exit;
    }
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['success'=>false,'message'=>'设备验证暂不可用'], JSON_UNESCAPED_UNICODE); exit;
}
"""
    return s.replace(marker,marker+extra)
edit('api/login.php',login)
def client(s):
    marker="      return await res.json();"
    start=s.index('async function postForm')
    pos=s.index(marker,start)
    s=s[:pos]+"      const result = await res.json();\n      if (result.device_pending) window.location.href = '/device-access.php';\n      return result;"+s[pos+len(marker):]
    marker="  async function init() {\n    await fetchCSRFToken();"
    assert marker in s
    return s.replace(marker,marker+"""
    if (currentUser === '拾柒' && !document.getElementById('device-management-link')) {
      const a=document.createElement('a');a.id='device-management-link';a.href='/device-access.php';a.textContent='安全与设备';
      a.style.cssText='position:fixed;right:16px;bottom:80px;z-index:999;background:#fffdf9;color:#544139;padding:9px 14px;border:1px solid #d9cfc3;border-radius:20px;font-size:14px';
      document.body.appendChild(a);
    }
""")
edit('assets/js/api-client.js',client)
# Gateway may have loaded auth before the endpoint. Preserve all endpoint logic.
for p in (base/'api').glob('*.php'):
    s=p.read_text()
    t=s.replace("define('INCLUDED', true);", "if (!defined('INCLUDED')) define('INCLUDED', true);")
    if t!=s:p.write_text(t)
