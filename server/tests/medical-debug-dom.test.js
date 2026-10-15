import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

test('UI renders source text as text, and fetches complete body separately',async()=>{
 const html=fs.readFileSync(new URL('../public/medical-debug/index.html',import.meta.url),'utf8');
 const script=fs.readFileSync(new URL('../public/medical-debug/app.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'http://127.0.0.1:19086',runScripts:'outside-only'});const w=dom.window;
 const hostile='<img src=x onerror="window.pwned=true">';
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const calls=[];
 w.fetch=async(url,options)=>{calls.push({url,body:options?.body});let data;
  if(url==='/api/status') data={documents:1,chunks:1,modelRewriteAvailable:false};
  else if(url==='/api/search') data={status:'found',message:'候选资料',trace:{groups:[['reflux']],population:'adult',ftsQuery:'reflux',excluded:0,scopeBasis:'测试',elapsedMs:1},hits:[{title:hostile,population:'unspecified',text:`reflux ${hostile}`,url:'https://www.niddk.nih.gov/source',score:1,documentId:'source'}]};
  else data={title:'Source',body:`Complete source ${hostile}`,url:'https://www.niddk.nih.gov/source'};
  return {ok:true,json:async()=>data};};
 try {
  w.eval(script);await new Promise(setImmediate);
  w.document.querySelector('#query').value='反酸';w.document.querySelector('#search-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(setImmediate);
  assert.equal(w.document.querySelectorAll('.result').length,1);
  assert.equal(w.document.querySelectorAll('.result img').length,0);
  assert.match(w.document.querySelector('.snippet').textContent,/<img/);
  assert.equal(w.pwned,undefined);
  w.document.querySelector('.result-actions button').click();await new Promise(setImmediate);
  assert.equal(w.document.querySelector('#source-body').textContent,`Complete source ${hostile}`);
  assert.equal(w.document.querySelector('#source-dialog').open,true);
  assert.equal(w.document.querySelectorAll('#source-body img').length,0);
  assert.equal(calls.at(-1).url,'/api/documents/source');
 }finally{w.close();}
});
