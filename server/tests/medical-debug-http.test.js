import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildMedicalDebug} from '../src/modules/medical/debug-app.js';

test('local debug serves UI and real corpus APIs without exposing files or credentials',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'medical-debug-'));const corpusPath=path.join(dir,'corpus.db');const db=new Database(corpusPath);
 db.exec(`CREATE TABLE medical_documents(id TEXT,url TEXT,title TEXT,body_markdown TEXT,metadata_json TEXT,clinical_review_status TEXT);CREATE TABLE medical_chunks(id TEXT,document_id TEXT,start_offset INT,end_offset INT,body TEXT);INSERT INTO medical_documents VALUES ('reflux','https://www.niddk.nih.gov/adults','Adult reflux','Reflux treatment source.','{}','not_reviewed');INSERT INTO medical_chunks VALUES ('reflux:0','reflux',0,24,'Reflux treatment source.');`);db.close();
 const app=await buildMedicalDebug({corpusPath});
 const request=(url,options={})=>app.inject({url,headers:{host:'127.0.0.1:19086',...options.headers},...options});
 try {
  assert.equal((await request('/')).statusCode,200);
  assert.match((await request('/app.js')).body,/textContent/);
  const status=await request('/api/status');assert.equal(status.json().documents,1);assert.ok(!status.body.includes('api_key'));
  const r=await request('/api/search',{method:'POST',payload:{query:'反酸治疗',population:'adult'}});assert.equal(r.json().hits[0].documentId,'reflux');
  assert.equal((await request('/api/documents/reflux')).json().body,'Reflux treatment source.');
  assert.equal((await request('/api/documents/missing')).statusCode,404);
  assert.equal((await request('/server/data/corpus.db')).statusCode,404);
  assert.equal((await app.inject({url:'/',headers:{host:'attacker.example'}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/api/search',headers:{host:'127.0.0.1:19086',origin:'https://attacker.example'},payload:{query:'反酸'}})).statusCode,403);
  assert.equal((await request('/api/search',{method:'POST',payload:{query:'反酸',mode:'model'}})).statusCode,400);
 } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
