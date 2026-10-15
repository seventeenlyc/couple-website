import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMedicalSearch} from '../src/modules/medical/search.js';
const corpus=process.argv[2]||fileURLToPath(new URL('../data/medical-knowledge.db',import.meta.url));
const output=process.argv[3]||fileURLToPath(new URL('../data/medical-debug-evaluation.json',import.meta.url));
const fixtures=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/medical-queries.json',import.meta.url),'utf8'));
const db=new Database(corpus,{readonly:true});const search=createMedicalSearch(db);
const corpusUrls=db.prepare('SELECT url FROM medical_documents').all().map(r=>r.url);
const results=[];
for(const fixture of fixtures){
 const result=await search.search(fixture);
 const relevant=h=>fixture.expectedUrls?.some(part=>h.url.includes(part));
 const rank=result.hits.findIndex(relevant);
 results.push({...fixture,expectedSourceInCorpus:fixture.expectedUrls?corpusUrls.some(url=>fixture.expectedUrls.some(part=>url.includes(part))):null,status:result.status,statusCorrect:result.status===fixture.expectedStatus,hitAt1:fixture.expectedUrls?rank===0:null,hitAt5:fixture.expectedUrls?rank>=0:null,rank:rank<0?null:rank+1,hits:result.hits.map(h=>({id:h.documentId,title:h.title,url:h.url,population:h.population})),trace:result.trace});
}
const positives=results.filter(r=>r.expectedUrls);
const report={createdAt:new Date().toISOString(),mode:'local_lexicon_fts5',dataset:'medical-queries-v1',cases:results.length,relevantSourceCases:positives.length,expectedSourceInCorpus:positives.filter(r=>r.expectedSourceInCorpus).length,hitAt1:positives.filter(r=>r.hitAt1).length/positives.length,hitAt5:positives.filter(r=>r.hitAt5).length/positives.length,statusCorrect:results.filter(r=>r.statusCorrect).length,statusTotal:results.length,note:'人工指定期望来源的首批开发集；缺少期望来源仍计作未命中，另列语料覆盖数。仅评估来源命中，不代表回答正确率、医学审核或独立测试集成绩。未评估向量检索。',results};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:results.filter(r=>r.hitAt5===false||!r.statusCorrect).map(r=>({id:r.id,query:r.query,status:r.status,top:r.hits[0]?.title,expected:r.expectedUrls}))},null,2));
search.close();db.close();
