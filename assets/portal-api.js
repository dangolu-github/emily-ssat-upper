(() => {
  'use strict';
  const key='emily-ssat-session-v1'; let token='';
  try {token=localStorage.getItem(key)||'';} catch(_){}
  const panel=document.getElementById('account-panel'), message=panel.querySelector('[data-auth-message]'),login=panel.querySelector('form'),logout=panel.querySelector('[data-logout]');
  function paint(){login.hidden=!!token;logout.hidden=!token;message.textContent=token?'Signed in.':'Enter your access code to view and submit your work.';}
  function forget(){token='';try{localStorage.removeItem(key);}catch(_){}paint();window.dispatchEvent(new Event('emily-logout'));}
  async function api(action,payload={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(window.EMILY_PORTAL.endpoint,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,token}),signal:controller.signal});
      if(!response.ok)throw new Error('Connection unavailable. Your choices are still here; please try again.');
      const data=await response.json();
      if(!data.ok){if(/Please sign in/.test(data.error||''))forget();throw new Error(data.error||'Please try again.');}return data;
    }catch(e){if(e.name==='AbortError')throw new Error('The request took too long. Your choices are still here; please try again.');throw e;}finally{clearTimeout(timer);}
  }
  login.addEventListener('submit',async event=>{
    event.preventDefault();const input=login.querySelector('input'),button=login.querySelector('button');button.disabled=true;message.textContent='Signing in…';
    try{const result=await api('authenticate',{password:input.value});token=result.token;input.value='';try{localStorage.setItem(key,token);}catch(_){}paint();window.dispatchEvent(new Event('emily-login'));}
    catch(e){message.textContent=e.message;}finally{button.disabled=false;}
  });
  logout.addEventListener('click',forget);window.EmilyAPI={call:api,signedIn:()=>!!token};paint();
})();
