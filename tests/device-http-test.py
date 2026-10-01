"""Integration test against an isolated staged copy, with synthetic users only."""
import http.client, json, pathlib, subprocess, sys, time, urllib.parse
from http.cookies import SimpleCookie
root=pathlib.Path(sys.argv[1]).resolve()
assert root.name.startswith('codex-device-stage-'), 'Never run on a production directory'
php='/www/server/php/82/bin/php'
state=root/'tests/http-state.json'
state.write_text(json.dumps(dict(version=1,bound={},devices={},rates={})))
(root/'data/config.json').write_text(json.dumps({'users':{'拾柒':{'id':'testadmin','partner':'testpartner'},'testpartner':{'id':'testmember','partner':'拾柒'}}}))
(root/'home.html').write_text('TEST PRIVATE HOME')
class Browser:
    def __init__(self): self.cookies={}; self.csrf=None
    def request(self,path,data=None):
        c=http.client.HTTPConnection('127.0.0.1',19085,timeout=10)
        headers={'Cookie':'; '.join(k+'='+v for k,v in self.cookies.items())}
        body=None
        if data is not None: body=urllib.parse.urlencode(data);headers['Content-Type']='application/x-www-form-urlencoded'
        c.request('POST' if data is not None else 'GET',path,body,headers)
        r=c.getresponse(); raw=r.read(); status=r.status
        for k,v in r.getheaders():
            if k.lower()=='set-cookie':
                parsed=SimpleCookie();parsed.load(v)
                for name,m in parsed.items():
                    self.cookies[name]=m.value
                    if name.startswith('__Host-couple_device_'):
                        assert m['secure'] and m['httponly'] and m['samesite']=='Strict' and m['path']=='/'
        c.close()
        try: value=json.loads(raw)
        except ValueError: value=raw.decode(errors='replace')
        return status,value
    def token(self):
        code,v=self.request('/api/csrf-token.php');assert code==200,(code,v);self.csrf=v['csrf_token']
    def login(self,admin=True):
        self.token();return self.request('/api/login.php',dict(you='拾柒' if admin else 'testpartner',baby='testpartner' if admin else '拾柒',csrf_token=self.csrf))
    def device(self,action,**kw):return self.request('/api/devices.php',dict(action=action,csrf_token=self.csrf,**kw))
log=open(root/'tests/http-test.log','w')
p=subprocess.Popen([php,'-S','127.0.0.1:19085','-t',str(root),str(root/'tests/device-http-router.php')],stdout=log,stderr=log)
try:
    time.sleep(.5)
    a=Browser();b=Browser();m=Browser()
    assert a.request('/api/app-config.php')[0]==401
    assert a.request('/uploads/photos/example.jpg')[0]==401
    code,v=a.login();assert code==200 and v.get('success'),(code,v)
    assert a.device('status')[1]['admin'] is True
    assert a.request('/home.html')[0]==200
    code,v=b.login();assert v.get('device_pending') and not v.get('success'),(code,v)
    assert b.request('/api/app-config.php')[0]==401
    code,v=b.device('status');assert v['status']=='pending';pair=v['code']
    assert m.login(False)[1]['success']
    assert m.device('list')[0]==403
    rows=a.device('list')[1]['devices'];pending=next(r['id'] for r in rows if r['status']=='pending')
    assert all('secret_hash' not in r and 'pair_code' not in r for r in rows)
    assert a.device('approve',id=pending,code=pair)[1]['success']
    assert b.device('status')[1]['status']=='active'
    assert b.request('/api/app-config.php')[0]==200
    assert a.device('revoke',id=pending)[1]['success']
    assert b.request('/api/app-config.php')[0]==401
    assert m.device('approve',id=pending,code=pair)[0]==403
    old_cookies=dict(b.cookies)
    assert b.login()[1].get('device_pending')
    v=b.device('status')[1];assert v['status']=='pending',v
    assert b.request('/api/app-config.php')[0]==401
    rows=a.device('list')[1]['devices']
    replacement=next(r['id'] for r in rows if r['status']=='pending')
    assert replacement!=pending
    assert a.device('approve',id=replacement,code=v['code'])[1]['success']
    assert b.device('status')[1]['status']=='active'
    assert b.request('/api/app-config.php')[0]==200
    stale=Browser();stale.cookies=old_cookies
    assert stale.request('/api/app-config.php')[0]==401
    assert a.request('/api/devices.php',dict(action='revoke',id=pending,csrf_token='wrong'))[0]==403
    assert a.request('/data/config.json')[0]==404
    assert a.request('/admin-backfill-checkin.php')[0]==404
    assert a.request('/uploads/private/test/file.jpg')[0]==404
    print('PASS: HTTP first binding, approval, cookies, member restrictions, revocation, CSRF, protected paths')
finally:
    p.terminate();p.wait(timeout=10);log.close()
    state.unlink(missing_ok=True)
    pathlib.Path(str(state)+'.lock').unlink(missing_ok=True)
