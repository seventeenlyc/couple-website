(() => {
  const msg=document.getElementById('message'); let csrf='',timer;
  const call=async(url,data)=>{
    const res=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...data,csrf_token:csrf})});
    const value=await res.json(); if(!res.ok && !value.message) throw Error('请求失败，请重新登录'); return value;
  };
  const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
  async function list(){
    const data=await call('/api/devices.php',{action:'list'}); if(!data.success) throw Error(data.message);
    const box=document.getElementById('devices');box.replaceChildren();
    for(const r of data.devices){
      const item=document.createElement('article');
      const labels={active:'已授权',pending:'等待审批',revoked:'已撤销',denied:'已拒绝',expired:'已过期'};
      item.append(text('strong',`${r.name} · ${labels[r.status]||r.status}${r.current?' · 当前浏览器':''}`),text('p',r.agent),text('p',`申请时间：${new Date(r.created_at*1000).toLocaleString()} · IP：${r.ip}`));
      const actions=r.status==='pending'?['approve','deny']:r.status==='active'?['revoke']:[];
      for(const action of actions){
        const b=text('button',({approve:'批准',deny:'拒绝',revoke:'撤销授权'})[action]);
        b.onclick=async()=>{
          let code=''; if(action==='approve'){code=prompt('请输入对方浏览器显示的 8 位核对码。请通过可信方式核对申请人，浏览器名称不能证明身份。');if(!code)return;}
          else if(!confirm(r.current?'撤销当前浏览器后会立即退出，需其他管理员设备或服务器恢复。确定吗？':'确定执行此操作？'))return;
          b.disabled=true;try{const out=await call('/api/devices.php',{action,id:r.id,code});if(!out.success)throw Error(out.message);if(r.current){location.href='/device-login.php';return;}await list();}catch(e){msg.textContent=e.message;b.disabled=false;}
        };item.append(b);
      } box.append(item);
    }
  }
  async function status(){
    clearTimeout(timer);
    try{
      const d=await call('/api/devices.php',{action:'status'});if(!d.success)throw Error(d.message);
      document.getElementById('pair').replaceChildren();
      if(d.status==='active'){
        msg.textContent=d.admin?'你是拾柒管理员，可以审批和撤销设备。':'当前浏览器已授权，可以返回首页。';
        if(d.admin){await list();timer=setTimeout(status,10000);} return;
      }
      if(d.status==='pending'){
        msg.textContent='请让拾柒在已授权浏览器打开“安全与设备”，核对下方代码后批准。申请 10 分钟内有效。';
        document.getElementById('pair').append(text('code',d.code));timer=setTimeout(status,5000);
      }else msg.textContent=({expired:'申请或授权已过期，请重新登录。',denied:'申请已被拒绝。',revoked:'此浏览器授权已撤销。',missing:'没有有效申请，请先登录。'})[d.status]||'请重新登录。';
    }catch(e){msg.textContent=e.message;}
  }
  async function init(){
    const r=await fetch('/api/csrf-token.php',{credentials:'same-origin',cache:'no-store'});const d=await r.json();csrf=d.csrf_token;
    const form=document.getElementById('login');
    if(form){form.onsubmit=async(e)=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;msg.textContent='正在验证…';try{
      const out=await call('/api/login.php',Object.fromEntries(new FormData(form)));
      if(out.device_pending)location.href='/device-access.php';else if(out.success)location.href='/home.html';else msg.textContent=out.message||'登录失败';
    }catch(err){msg.textContent=err.message;}finally{b.disabled=false;}};}else await status();
  }
  init().catch(()=>{msg.textContent='暂时无法连接，请刷新页面重试。';});
})();
