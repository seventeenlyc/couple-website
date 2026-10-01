"""Verify real Nginx/FPM routing on loopback using synthetic accounts."""
import base64, http.client, json, os, pathlib, subprocess, sys, time, urllib.parse
from http.cookies import SimpleCookie
root=pathlib.Path(sys.argv[1]).resolve()
assert root.name.startswith('codex-device-stage-')
state=root.parent/'.couple-device-state'/root.name/'state.json'
state.parent.mkdir(parents=True,exist_ok=True)
state.write_text(json.dumps(dict(version=1,bound={},devices={},rates={})))
subprocess.run(['chown','-R','www:www',str(state.parent)],check=True)
os.chmod(state.parent,0o700);os.chmod(state,0o600);os.chmod(root,0o755)
(root/'uploads/photos').mkdir(parents=True,exist_ok=True)
image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==')
(root/'uploads/photos/probe.png').write_bytes(image)
conf=(root/'tools/device-nginx.conf').read_text().replace('/www/wwwroot/lyczwc520.site',str(root)).replace('/www/wwwroot/.couple-device-state/lyczwc520.site',str(state.parent)).replace('include fastcgi_params;','include /www/server/nginx/conf/fastcgi_params;\n    fastcgi_param HTTPS on;')
routes=root/'tests/nginx-routes.conf';routes.write_text(conf)
nginxconf=root/'tests/nginx-test.conf'
nginxconf.write_text(f'user www www;\npid {root}/tests/nginx.pid;\nerror_log {root}/tests/nginx-error.log;\nevents {{ worker_connections 128; }}\nhttp {{ include /www/server/nginx/conf/mime.types; access_log off; server {{ listen 127.0.0.1:19086; server_name localhost; root {root}; include {routes}; }} }}')
nginx='/www/server/nginx/sbin/nginx'
nginxconf.write_text(nginxconf.read_text().replace('http {', 'http { lua_package_path "/www/server/nginx/lib/lua/?.lua;;";'))
subprocess.run([nginx,'-t','-c',str(nginxconf)],check=True)
subprocess.run([nginx,'-c',str(nginxconf)],check=True)
cookies={}
def request(path,data=None):
    c=http.client.HTTPConnection('127.0.0.1',19086,timeout=10)
    headers={'Cookie':'; '.join(k+'='+v for k,v in cookies.items())}
    if data is not None:headers['Content-Type']='application/x-www-form-urlencoded'
    c.request('POST' if data is not None else 'GET',path,urllib.parse.urlencode(data) if data is not None else None,headers)
    r=c.getresponse();body=r.read();status=r.status;rh=dict(r.getheaders())
    for k,v in r.getheaders():
        if k.lower()=='set-cookie':
            jar=SimpleCookie();jar.load(v)
            for name,m in jar.items():cookies[name]=m.value
    c.close();return status,body,rh
try:
    time.sleep(.3)
    for path,expected in [('/device-login.php',200),('/api/app-config.php',401),('/uploads/photos/probe.png',401),('/_device_files/home.html',404),('/home.html',302),('/assets/js/device-access.js',200)]:
        got=request(path)[0];assert got==expected,(path,got)
    csrf=json.loads(request('/api/csrf-token.php')[1])['csrf_token']
    code,body,_=request('/api/login.php',dict(you='拾柒',baby='testpartner',csrf_token=csrf));assert code==200 and json.loads(body)['success'],(code,body)
    assert request('/home.html')[1]==b'TEST PRIVATE HOME'
    code,body,h=request('/uploads/photos/probe.png');assert code==200 and body==image and h['Content-Type']=='image/png',(code,body,h)
    assert 'no-store' in h['Cache-Control']
    assert request('/data/config.json')[0]==404
    assert request('/tools/device-admin.php')[0]==404
    assert request('/_device_files/uploads/photos/probe.png')[0]==404
    cookies.clear();assert request('/uploads/photos/probe.png')[0]==401
    print('PASS: Nginx/FPM login, external state access, private HTML, image bytes/type/cache, direct-path protection')
finally:
    subprocess.run([nginx,'-s','quit','-c',str(nginxconf)],check=True)
