import Fastify from 'fastify';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMedicalSearch} from './search.js';
import {createQueryRewriter} from './rewrite.js';

const webRoot=fileURLToPath(new URL('../../../public/medical-debug/',import.meta.url));
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};

export async function buildMedicalDebug({corpusPath,configDbPath,rewrite}={}) {
  const corpus=new Database(corpusPath,{readonly:true,fileMustExist:true});
  let modelConfig=null;
  if(configDbPath) {
    const configDb=new Database(configDbPath,{readonly:true,fileMustExist:true});
    try {const row=configDb.prepare("SELECT value FROM site_config WHERE key='ai'").get();modelConfig=row?JSON.parse(row.value):null;} finally {configDb.close();}
  }
  const search=createMedicalSearch(corpus,{rewrite:rewrite||createQueryRewriter(modelConfig)});
  const app=Fastify({logger:false,bodyLimit:8192});
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store');
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    // Local-only tool: reject cross-site requests and DNS rebinding.
    const host=(req.headers.host||'').split(':')[0];
    if(!['127.0.0.1','localhost'].includes(host)) return reply.code(403).send({error:'仅允许本机访问'});
    const origin=req.headers.origin;
    if(origin && origin!==`http://${req.headers.host}`) return reply.code(403).send({error:'拒绝跨站请求'});
  });
  for(const [url,[file,type]] of Object.entries(files)) app.get(url,async(_,reply)=>reply.type(type).send(fs.readFileSync(path.join(webRoot,file))));
  app.get('/api/status',async()=>search.stats());
  app.get('/api/evaluation',async(_,reply)=>{
    const report=fileURLToPath(new URL('../../../data/medical-debug-evaluation.json',import.meta.url));
    if(!fs.existsSync(report)) return reply.code(404).send({error:'尚未运行固定验收集'});
    return JSON.parse(fs.readFileSync(report,'utf8'));
  });
  app.post('/api/search',async(req,reply)=>{
    try {return await search.search(req.body||{});} catch(error) {
      const message=error.name==='TimeoutError'?'模型改写超时':error.message;
      return reply.code(400).send({error:message});
    }
  });
  app.get('/api/documents/:id',async(req,reply)=>{
    const doc=search.document(req.params.id);
    return doc||reply.code(404).send({error:'正文不存在'});
  });
  app.addHook('onClose',()=>{search.close();corpus.close();});
  return app;
}
