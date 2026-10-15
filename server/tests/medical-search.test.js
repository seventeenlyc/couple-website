import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createMedicalSearch } from '../src/modules/medical/search.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE medical_documents(id TEXT PRIMARY KEY,url TEXT,title TEXT,body_markdown TEXT,metadata_json TEXT,clinical_review_status TEXT); CREATE TABLE medical_chunks(id TEXT,document_id TEXT,start_offset INT,end_offset INT,body TEXT);`);
  for (const [id,title,body] of [
    ['adult','Treatment for GER & GERD','Gastroesophageal reflux disease treatment in adults. Medicines and proton pump inhibitors.'],
    ['child','Acid Reflux in Children','Reflux GERD treatment in children. Reflux symptoms.'],
    ['preg','Pregnancy and High Blood Pressure','Hypertension and blood pressure in pregnancy.'],
    ['bp','High Blood Pressure Diagnosis','High blood pressure hypertension diagnosis measurement.'],
    ['foot','Diabetes & Foot Problems','Diabetes diabetic foot problems neuropathy feet numbness.'],
  ]) {
    db.prepare('INSERT INTO medical_documents VALUES (?,?,?,?,?,?)').run(id,`https://www.niddk.nih.gov/health-information/${id}`,title,body,JSON.stringify({language:'en',source:'NIDDK',applicable_region:null,clinical_reviewed_at:null}),'not_reviewed');
    db.prepare('INSERT INTO medical_chunks VALUES (?,?,?,?,?)').run(`${id}:0`,id,0,body.length,body);
  }
  return {db,search:createMedicalSearch(db)};
}

test('Chinese search returns exact source text and explainable English terms', async () => {
  const {db,search}=fixture();
  const r=await search.search({query:'成年人反酸，想了解治疗',population:'adult'});
  assert.equal(r.status,'found');
  assert.equal(r.hits[0].documentId,'adult');
  assert.match(r.trace.ftsQuery,/reflux/i);
  assert.equal(r.hits[0].region,null);
  assert.equal(r.hits[0].clinicalReviewStatus,'not_reviewed');
  assert.equal(r.hits[0].text,search.document('adult').body.slice(r.hits[0].start,r.hits[0].end));
  assert.ok(!r.hits.some(h=>h.documentId==='child'));
  search.close();db.close();
});

test('child and pregnancy queries infer scope, explicit conflicting filters require clarification', async()=>{
  const {db,search}=fixture();
  const r=await search.search({query:'孩子反酸怎么办'});
  assert.equal(r.trace.population,'child');
  assert.ok(r.hits.some(h=>h.documentId==='child'));
  assert.ok(!r.hits.some(h=>h.documentId==='adult'));
  assert.equal((await search.search({query:'孕妇血压高',population:'adult'})).status,'clarify');
  search.close();db.close();
});

test('multiple medical concepts narrow candidates and unknown Chinese does not fabricate matches',async()=>{
  const {db,search}=fixture();
  const r=await search.search({query:'糖尿病脚麻'});
  assert.equal(r.hits[0].documentId,'foot');
  assert.equal((await search.search({query:'帮我找绵阳的照片'})).status,'unmapped');
  assert.equal((await search.search({query:'ZXYUNKNOWNMEDICAL'})).status,'not_found');
  await assert.rejects(()=>search.search({query:'a'.repeat(501)}),/500/);
  assert.equal(search.document('missing'),null);
  search.close();db.close();
});

test('FTS syntax is built from safe tokens; input cannot execute SQL or FTS operators',async()=>{
  const {db,search}=fixture();
  const r=await search.search({query:'反酸 " OR * ); DROP TABLE medical_documents; --'});
  assert.ok(['found','not_found'].includes(r.status));
  assert.equal(db.prepare('SELECT count(*) n FROM medical_documents').get().n,5);
  search.close();db.close();
});

test('model rewriting stays observable and provider failure has no silent fallback',async()=>{
  const {db}=fixture();
  const search=createMedicalSearch(db,{rewrite:async()=>({groups:[['reflux','gerd']],model:'test-model'})});
  const r=await search.search({query:'胃里往上冒酸水',mode:'model',population:'adult'});
  assert.equal(r.trace.mode,'model');assert.equal(r.trace.rewriteModel,'test-model');assert.equal(r.hits[0].documentId,'adult');
  search.close();
  const failed=createMedicalSearch(db,{rewrite:async()=>{throw Error('provider unavailable');}});
  await assert.rejects(()=>failed.search({query:'反酸',mode:'model'}),/provider unavailable/);
  failed.close();db.close();
});

test('adolescents stay out of adult sources and ambiguous infant/toddler scope asks for clarification',async()=>{
 const {db,search}=fixture();
 const adolescent=await search.search({query:'青少年反酸'});
 assert.equal(adolescent.trace.population,'child');
 assert.ok(!adolescent.hits.some(h=>h.documentId==='adult'));
 assert.equal((await search.search({query:'婴幼儿反酸'})).status,'clarify');
 assert.equal((await search.search({query:'幼儿反酸',population:'child'})).trace.population,'child');
 assert.equal((await search.search({query:'17岁反酸'})).trace.population,'child');
 assert.equal((await search.search({query:'2岁宝宝反酸'})).trace.population,'child');
 search.close();db.close();
});

test('generic intent cannot turn an unmapped disease into an unrelated successful match',async()=>{
 const {db,search}=fixture();
 for(const query of ['肺癌饮食','肺癌怎么治疗','应该吃什么药','我想了解运动']) {
  const result=await search.search({query});
  assert.equal(result.status,'unmapped');assert.equal(result.hits.length,0);
 }
 search.close();db.close();
});
