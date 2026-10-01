"""Install tested files while preserving current live site-specific changes."""
import hashlib, os, pathlib, shutil, subprocess, sys, time
source=pathlib.Path(sys.argv[1]).resolve()
assert source.name=='codex-device-stage-20260905'
live=pathlib.Path('/www/wwwroot/lyczwc520.site')
nginx=pathlib.Path('/www/server/panel/vhost/nginx/lyczwc520.site.conf')
stamp=time.strftime('%Y%m%d-%H%M%S')
backup=pathlib.Path('/www/backup')/('codex-device-auth-'+stamp)
release=backup/'release'
backup.mkdir(mode=0o700);release.mkdir()
existing=['includes/auth.php','includes/session.php','assets/js/api-client.js']
existing += [str(p.relative_to(live)) for p in (live/'api').glob('*.php')]
existing += [p.name for p in live.glob('*.html') if 'assets/js/api-client.js' in p.read_text()]
digests={}
for rel in existing:
    src=live/rel;digests[rel]=hashlib.sha256(src.read_bytes()).hexdigest()
    for dest in (backup/'original'/rel,release/rel):
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
shutil.copy2(nginx,backup/'nginx.conf')
subprocess.run(['python3',str(source/'tools/deploy-device-auth.py'),str(release)],check=True)
new=['includes/device-auth.php','api/devices.php','device-gateway.php','device-login.php','device-access.php','assets/css/device-access.css','assets/js/device-access.js','tools/device-admin.php']
for rel in new:
    assert not (live/rel).exists(), 'Already installed: '+rel
    dest=release/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/rel,dest)
for p in release.glob('*.html'):
    s=p.read_text();p.write_text(s.replace('assets/js/api-client.js','assets/js/api-client.js?v=device-auth-20260905'))
for p in release.rglob('*.php'):
    subprocess.run(['/www/server/php/82/bin/php','-l',str(p)],check=True,stdout=subprocess.DEVNULL)
s=nginx.read_text()
assert s.count('include enable-php-82.conf;')==1
conf=pathlib.Path('/www/server/panel/vhost/nginx/device-access-lyczwc520.inc')
assert not conf.exists()
s=s.replace('include enable-php-82.conf;','include '+str(conf)+';')
for marker in ['    location ~ .*\\.(gif','    location ~ .*\\.(js']:
    start=s.index(marker);end=s.index('\n    }',start)+len('\n    }')
    s=s[:start]+s[end:]
(backup/'nginx-new.conf').write_text(s)
for rel,h in digests.items():
    assert hashlib.sha256((live/rel).read_bytes()).hexdigest()==h, 'Live file changed: '+rel
assert nginx.read_bytes()==(backup/'nginx.conf').read_bytes(), 'Nginx changed'
for p in release.rglob('*'):
    if p.is_file():
        dest=live/p.relative_to(release);dest.parent.mkdir(parents=True,exist_ok=True)
        tmp=dest.with_name(dest.name+'.device-new');shutil.copyfile(p,tmp);os.chmod(tmp,0o644);os.replace(tmp,dest)
# Initialize outside docroot only once. Never reset a populated state store.
subprocess.run(['/www/server/php/82/bin/php',str(live/'tools/device-admin.php'),'init'],check=True)
state=pathlib.Path('/www/wwwroot/.couple-device-state/lyczwc520.site')
os.chmod(state.parent,0o711)
subprocess.run(['chown','-R','www:www',str(state)],check=True)
shutil.copyfile(source/'tools/device-nginx.conf',conf)
nginx.write_text(s)
try:
    subprocess.run(['/www/server/nginx/sbin/nginx','-t'],check=True)
except Exception:
    shutil.copyfile(backup/'nginx.conf',nginx)
    raise
subprocess.run(['/www/server/nginx/sbin/nginx','-s','reload'],check=True)
(backup/'manifest.txt').write_text('\n'.join(existing+new))
print('DEPLOYED backup='+str(backup))
