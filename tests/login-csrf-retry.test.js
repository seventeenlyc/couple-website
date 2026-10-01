const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function run(failure,expected){
  let version='old',posts=0,reads=0;
  const context={URLSearchParams,console,document:{addEventListener(){}},window:{location:{}},fetch:async(url,options)=>{
    if(url==='api/csrf-token.php') {reads++;return {ok:true,json:async()=>({success:true,csrf_token:version})};}
    posts++;
    if(posts===1)return {status:failure.status,json:async()=>failure.body};
    assert.equal(new URLSearchParams(options.body).get('csrf_token'),'new');
    return {status:200,json:async()=>({success:true})};
  }};
  vm.createContext(context);vm.runInContext(fs.readFileSync(process.env.CLIENT_FILE || 'assets/js/api-client.js','utf8')+';globalThis.api=API;',context);
  await context.api.getCSRFToken();version='new';
  const out=await context.api.postForm('api/login.php',{you:'test'});
  assert.equal(posts,expected);assert.equal(reads,expected);
  if(expected===2)assert.equal(out.success,true);
}
(async()=>{
  await run({status:403,body:{success:false,code:'csrf_invalid'}},2);
  await run({status:403,body:{success:false,message:'denied'}},1);
  await run({status:200,body:{success:false,message:'bad credentials'}},1);
  console.log('PASS: stale CSRF recovered; other login failures never retried');
})().catch(e=>{console.error(e);process.exit(1);});
