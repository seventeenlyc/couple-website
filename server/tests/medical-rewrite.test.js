import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueryRewriter} from '../src/modules/medical/rewrite.js';
const config={enabled:true,api_key:'test-key-not-real',model:'test-model',base_url:'http://127.0.0.1:8045/v1'};
test('rewriter sends only current question and returns parsed search concepts',async()=>{
 let payload;
 const rewrite=createQueryRewriter(config,{fetchImpl:async(url,options)=>{
  assert.equal(String(url),'http://127.0.0.1:8045/v1/chat/completions');
  payload=JSON.parse(options.body);
  return Response.json({choices:[{finish_reason:'stop',message:{content:'```json\n{"groups":[["acid reflux"]]}\n```'}}]});
 }});
 assert.deepEqual(await rewrite('嘴里有酸味'),{groups:[['acid reflux']],model:'test-model'});
 assert.equal(payload.messages.length,2);assert.equal(payload.messages[1].content,'嘴里有酸味');
 assert.ok(payload.max_tokens>=2048);
});
test('truncated or invalid rewrites fail rather than returning partial concepts',async()=>{
 for(const choice of [{finish_reason:'length',message:{content:'{"groups":[]}'}},{finish_reason:'stop',message:{content:'not json'}}]){
  const rewrite=createQueryRewriter(config,{fetchImpl:async()=>Response.json({choices:[choice]})});
  await assert.rejects(()=>rewrite('中文问题'));
 }
 assert.equal(createQueryRewriter(null),null);
});
