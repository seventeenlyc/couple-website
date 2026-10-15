import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {buildApp} from '../src/app.js';
import {closeDb} from '../src/storage/db.js';

test('legacy passwordless users can log in while configured passwords remain required', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'couple-login-compat-'));
  const app=await buildApp({dbPath:path.join(dir,'test.db'),secureCookie:false});
  try {
    app.db.prepare('INSERT INTO users(id,username,password_hash,partner_id) VALUES(?,?,?,?)').run('legacy','Legacy','','secured');
    app.db.prepare('INSERT INTO users(id,username,password_hash,partner_id) VALUES(?,?,?,?)').run('secured','Secured',bcrypt.hashSync('required-password',10),'legacy');
    async function login(you,baby,password){
      const csrf=await app.inject('/api/csrf-token.php');
      const cookie=[].concat(csrf.headers['set-cookie']||[]).map(s=>s.split(';')[0]).join('; ');
      const response=await app.inject({method:'POST',url:'/api/login.php',headers:{cookie},payload:{you,baby,...(password===undefined?{}:{password}),csrf_token:csrf.json().csrf_token}});
      return response.json();
    }
    assert.equal((await login('Secured','Legacy')).success,false);
    assert.equal((await login('Secured','Legacy','wrong')).success,false);
    assert.equal((await login('Legacy','Secured')).success,true);
    assert.equal((await login('Secured','Legacy','required-password')).success,true);
  } finally {await app.close();closeDb();fs.rmSync(dir,{recursive:true,force:true});}
});
