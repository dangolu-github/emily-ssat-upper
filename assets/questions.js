(() => {
  'use strict';
  // Questions for class. Sets and files go to the private service after sign-in (EmilyAPI from portal-api.js).
  // One set = the questions of one practice set. A set is named once, takes several files and is sent with one button;
  // files go up one at a time, and a file that did not go stays in the list for the next Send.
  const app=document.querySelector('[data-questions-app]');
  const TYPES={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',heic:'image/heic',heif:'image/heif',pdf:'application/pdf'};
  const EXT_OF={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/heic':'heic','image/heif':'heif','application/pdf':'pdf'};
  const ACCEPT='image/*,application/pdf,.heic,.heif,.pdf';
  const S={ready:false,sets:[],limits:{fileBytes:12*1024*1024,filesPerSet:30},loaded:false,composers:{},active:'new',pasted:0};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const newId=p=>{const a=new Uint8Array(12);crypto.getRandomValues(a);return p+'-'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');};
  const size=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
  const mb=n=>Math.round(n/1048576);
  const when=v=>{const d=new Date(v);return isNaN(d)?'':d.toLocaleDateString(undefined,{day:'numeric',month:'short'})+', '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});};
  const count=n=>n+' file'+(n===1?'':'s');
  const kindOf=type=>type==='application/pdf'?'pdf':'image';
  const extOf=name=>((String(name||'').match(/\.([A-Za-z0-9]{2,5})$/)||['',''])[1]).toLowerCase();
  function composer(key){return S.composers[key]||(S.composers[key]={key,setId:key==='new'?'':key,title:'',note:'',files:[],sending:false,locked:false,message:'',tone:''});}

  // A large photo is redrawn at a readable size before it is sent, so a set of photos goes quickly; a photo format
  // this browser can show is sent as JPG. A file the browser cannot draw is sent as it is.
  function draw(blob){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{try{
        const max=2600,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
        canvas.toBlob(out=>{URL.revokeObjectURL(url);out?resolve(out):reject(new Error('draw'));},'image/jpeg',0.86);
      }catch(e){URL.revokeObjectURL(url);reject(e);}};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('decode'));};
      img.src=url;
    });
  }
  async function prepare(file){
    let ext=extOf(file.name),type=TYPES[ext]||'';
    if(!type&&EXT_OF[file.type]){type=file.type;ext=EXT_OF[type];}
    const other=!type&&/^image\//.test(file.type||'');   // another picture format: sent as JPG when this browser can draw it
    if(!type&&!other)return {error:'This kind of file cannot be sent here. Use a screenshot, a photo or a PDF.'};
    let name=String(file.name||'').trim();
    if(!name||/^image\.(png|jpe?g|webp)$/i.test(name)){S.pasted+=1;name='Screenshot '+S.pasted+'.'+(ext||'jpg');}
    else if(!extOf(name))name+='.'+(ext||'jpg');
    let blob=file;
    const heic=type==='image/heic'||type==='image/heif';
    if(type!=='application/pdf'&&(other||heic||file.size>1.5*1048576)){
      try{const out=await draw(file);if(other||heic||out.size<file.size){blob=out;type='image/jpeg';name=name.replace(/\.[A-Za-z0-9]{2,5}$/,'')+'.jpg';}}catch(_){}
    }
    if(!type)return {error:'This kind of file cannot be sent here. Use a screenshot, a photo or a PDF.',name};
    if(blob.size>S.limits.fileBytes)return {error:'This file is larger than '+mb(S.limits.fileBytes)+' MB. Send a smaller file or a screenshot.',name};
    if(!blob.size)return {error:'This file is empty.',name};
    return {blob,name,type};
  }
  async function addFiles(c,list){
    const files=Array.from(list||[]);if(!files.length||c.sending)return;
    const set=S.sets.find(s=>s.id===c.setId),already=set?set.files.length:0;
    let refused='';
    for(const file of files){
      if(already+c.files.length>=S.limits.filesPerSet){refused='A set takes up to '+S.limits.filesPerSet+' files. Start a new set for the rest.';break;}
      const p=await prepare(file);
      if(p.error){refused=(p.name||file.name||'A file')+': '+p.error;continue;}
      c.files.push({id:newId('qf'),blob:p.blob,name:p.name,type:p.type,bytes:p.blob.size,note:'',status:'ready',message:'',thumb:kindOf(p.type)==='image'?URL.createObjectURL(p.blob):''});
    }
    c.message=refused;c.tone=refused?'error':'';
    paintComposer(c);
  }

  function fileRow(c,f){
    const kind=kindOf(f.type),label=kind==='pdf'?'PDF':extOf(f.name).toUpperCase();
    const state=f.status==='sending'?'<span class="q-file-state">Sending…</span>':f.status==='sent'?'<span class="q-file-state is-sent">Sent</span>':f.status==='error'?'<span class="q-file-state is-error">'+esc(f.message||'Not sent.')+'</span>':'';
    const locked=c.sending||f.status==='sent';
    return '<li class="q-file" data-file="'+esc(f.id)+'">'+
      '<span class="q-thumb" aria-hidden="true">'+(f.thumb?'<img src="'+esc(f.thumb)+'" alt="" data-thumb>':'')+'<span class="q-badge"'+(f.thumb?' hidden':'')+'>'+esc(label)+'</span></span>'+
      '<span class="q-file-body"><span class="q-file-name">'+esc(f.name)+'</span><span class="muted">'+esc(size(f.bytes))+'</span>'+state+
      '<label class="q-file-note"><span>Note <span class="q-optional">optional</span></span><input type="text" data-file-note maxlength="300" placeholder="Question number, your answer, or what is unclear" value="'+esc(f.note)+'"'+(locked?' disabled':'')+'></label></span>'+
      (locked?'':'<button type="button" class="q-remove" data-drop-file aria-label="Remove '+esc(f.name)+'">Remove</button>')+'</li>';
  }
  function composerHtml(c){
    const isNew=c.key==='new';
    return '<form class="q-composer" data-composer="'+esc(c.key)+'" novalidate>'+
      (isNew?'<label class="q-field"><span>Set name</span><input type="text" data-title maxlength="120" required autocomplete="off" placeholder="Practice Test 3 · Reading" value="'+esc(c.title)+'"'+(c.locked?' disabled':'')+'></label>'+
        '<label class="q-field"><span>Note <span class="q-optional">optional</span></span><textarea data-note maxlength="600" rows="2"'+(c.locked?' disabled':'')+'>'+esc(c.note)+'</textarea></label>':'')+
      '<div class="q-drop" data-drop><p class="q-drop-line"><strong>Paste a screenshot</strong>, drop files here, or</p>'+
      '<label class="button q-pick">Choose files<input type="file" data-pick multiple accept="'+ACCEPT+'"></label>'+
      '<p class="muted">PNG, JPG, WebP, HEIC or PDF · up to '+mb(S.limits.fileBytes)+' MB each · up to '+S.limits.filesPerSet+' files in a set</p></div>'+
      '<ul class="q-files" data-files></ul>'+
      '<div class="actions q-send-row"><button type="submit" data-send>Send</button>'+(isNew?'':'<button type="button" class="button-secondary" data-close-composer>Cancel</button>')+
      '<p class="q-msg" data-msg role="status" aria-live="polite"></p></div></form>';
  }
  function paintComposer(c){
    const form=app.querySelector('form[data-composer="'+c.key+'"]');if(!form)return;
    form.querySelector('[data-files]').innerHTML=c.files.map(f=>fileRow(c,f)).join('');
    form.querySelectorAll('img[data-thumb]').forEach(img=>{img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false;},{once:true});});
    const send=form.querySelector('[data-send]');send.disabled=c.sending;send.textContent=c.sending?'Sending…':'Send';
    form.querySelectorAll('[data-title],[data-note]').forEach(x=>{x.disabled=c.sending||c.locked;});
    form.querySelector('[data-pick]').disabled=c.sending;
    const msg=form.querySelector('[data-msg]');msg.textContent=c.message;msg.className='q-msg'+(c.tone?' '+c.tone:'');
  }
  function setHtml(s){
    const open=s.state!=='taught',c=S.composers[s.id];
    return '<article class="q-set" data-set="'+esc(s.id)+'"><header class="q-set-head"><h3>'+esc(s.title)+'</h3>'+
      '<p class="q-set-meta"><span class="q-state '+(open?'is-sent':'is-taught')+'">'+(open?'Sent':'Gone over in class')+'</span><span>'+esc(when(s.createdAt))+'</span><span>'+count(s.files.length)+'</span></p></header>'+
      (s.note?'<p class="q-set-note">'+esc(s.note)+'</p>':'')+
      (s.files.length?'<ul class="q-set-files">'+s.files.map(f=>'<li><span class="q-kind">'+(f.kind==='pdf'?'PDF':'Image')+'</span><span class="q-set-file-name">'+esc(f.name)+'</span>'+(f.note?'<span class="q-set-file-note">'+esc(f.note)+'</span>':'')+
        (open&&S.ready?'<button type="button" class="q-remove" data-remove-file="'+esc(f.id)+'" aria-label="Remove '+esc(f.name)+'">Remove</button>':'')+'</li>').join('')+'</ul>':'<p class="muted">No files in this set yet.</p>')+
      (open&&S.ready?(c?'':'<button type="button" class="button-secondary" data-add-to="'+esc(s.id)+'">Add files</button>')+'<div data-composer-host>'+(c?composerHtml(c):'')+'</div>':'')+
      '<p class="q-msg" data-set-msg role="status" aria-live="polite"></p></article>';
  }
  function render(){
    const fresh=composer('new');
    const sets=S.sets.length?S.sets.map(setHtml).join(''):'<p class="muted">Nothing sent yet.</p>';
    app.innerHTML=(S.ready?'<section class="panel q-new" aria-labelledby="q-new-title"><h2 id="q-new-title">New set</h2>'+composerHtml(fresh)+'</section>':
      '<p class="notice" role="status">Sending files here is not open yet. Send your questions on WeChat for now.</p>')+
      (S.ready||S.sets.length?'<section class="q-sent" aria-labelledby="q-sent-title"><h2 id="q-sent-title">Sent sets</h2>'+sets+'</section>':'');
    Object.keys(S.composers).forEach(k=>paintComposer(S.composers[k]));
  }
  function closeComposer(key){const c=S.composers[key];if(!c||c.sending)return;c.files.forEach(f=>{if(f.thumb)URL.revokeObjectURL(f.thumb);});delete S.composers[key];if(S.active===key)S.active='new';}

  const toBase64=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('read'));r.readAsDataURL(blob);});
  async function send(c){
    if(c.sending)return;
    const isNew=c.key==='new',pending=c.files.filter(f=>f.status!=='sent');
    if(isNew&&!c.title.trim()){c.message='Give this set a name first.';c.tone='error';paintComposer(c);const t=app.querySelector('form[data-composer="new"] [data-title]');if(t)t.focus();return;}
    if(!pending.length){c.message=isNew?'Add at least one file.':'Choose a file first.';c.tone='error';paintComposer(c);return;}
    c.sending=true;c.message='';c.tone='';paintComposer(c);
    let sent=0,stopped=false;
    try{
      if(isNew){
        if(!c.setId)c.setId=newId('qs');
        await EmilyAPI.call('questionCreateSet',{setId:c.setId,title:c.title.trim(),note:c.note.trim()});
        c.locked=true;
      }
      for(const f of pending){
        f.status='sending';f.message='';paintComposer(c);
        try{
          const data=await toBase64(f.blob);
          const r=await EmilyAPI.call('questionAddFile',{setId:c.setId,fileId:f.id,name:f.name,note:f.note.trim(),data},{timeout:180000});
          if(r.stored){f.status='sent';sent+=1;}
          else{f.status='error';f.message=r.message||'This file could not be sent.';f.refused=r.reason==='type'||r.reason==='size';if(!f.refused)stopped=true;}
        }catch(e){f.status='error';f.message=/sign in/i.test(e.message||'')?e.message:'Not sent. Check your connection and press Send again.';stopped=true;}
        paintComposer(c);if(stopped)break;
      }
    }catch(e){c.message=e.message||'Not sent. Please try again.';c.tone='error';}
    c.sending=false;
    const left=c.files.filter(f=>f.status!=='sent');
    if(!left.length&&sent){
      c.files.forEach(f=>{if(f.thumb)URL.revokeObjectURL(f.thumb);});
      if(isNew)S.composers.new={key:'new',setId:'',title:'',note:'',files:[],sending:false,locked:false,message:'Sent. You can add more files to this set below.',tone:'success'};
      else delete S.composers[c.key];
    }else if(!c.message){
      c.files=left.concat();c.tone='error';
      c.message=left.every(f=>f.refused)?(sent?sent+' sent. ':'')+'Remove the file'+(left.length===1?'':'s')+' marked below.':sent?sent+' of '+(sent+left.length)+' sent. Press Send again for the rest.':'Nothing was sent. Press Send again.';
    }
    await load(true);
  }
  async function removeSent(setId,fileId,button){
    const set=S.sets.find(s=>s.id===setId),file=set&&set.files.find(f=>f.id===fileId);if(!file)return;
    if(!window.confirm('Remove “'+file.name+'” from this set?'))return;
    button.disabled=true;
    try{await EmilyAPI.call('questionRemoveFile',{setId,fileId});await load(true);}
    catch(e){button.disabled=false;const m=button.closest('.q-set').querySelector('[data-set-msg]');if(m){m.textContent=e.message||'Not removed. Please try again.';m.className='q-msg error';}}
  }

  const composerOf=el=>{const f=el.closest('form[data-composer]');return f?S.composers[f.dataset.composer]:null;};
  app.addEventListener('submit',e=>{const c=composerOf(e.target);if(!c)return;e.preventDefault();send(c);});
  app.addEventListener('input',e=>{
    const c=composerOf(e.target);if(!c)return;
    if(e.target.matches('[data-title]'))c.title=e.target.value;
    else if(e.target.matches('[data-note]'))c.note=e.target.value;
    else if(e.target.matches('[data-file-note]')){const row=e.target.closest('[data-file]'),f=c.files.find(x=>x.id===row.dataset.file);if(f)f.note=e.target.value;}
  });
  app.addEventListener('change',e=>{if(!e.target.matches('[data-pick]'))return;const c=composerOf(e.target);if(!c)return;const files=Array.from(e.target.files||[]);e.target.value='';addFiles(c,files);});
  app.addEventListener('focusin',e=>{const c=composerOf(e.target);if(c)S.active=c.key;});
  app.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.retry){load();return;}
    if(t.dataset.addTo){composer(t.dataset.addTo);S.active=t.dataset.addTo;render();const pick=app.querySelector('form[data-composer="'+t.dataset.addTo+'"] [data-pick]');if(pick)pick.focus();return;}
    if(t.hasAttribute('data-close-composer')){const c=composerOf(t);if(c){closeComposer(c.key);render();}return;}
    if(t.hasAttribute('data-drop-file')){const c=composerOf(t),row=t.closest('[data-file]');if(!c||c.sending)return;const i=c.files.findIndex(f=>f.id===row.dataset.file);if(i>=0){if(c.files[i].thumb)URL.revokeObjectURL(c.files[i].thumb);c.files.splice(i,1);c.message='';c.tone='';paintComposer(c);}return;}
    if(t.dataset.removeFile){removeSent(t.closest('[data-set]').dataset.set,t.dataset.removeFile,t);}
  });
  // Drop: on a drop area, or anywhere on the page into the set last used. A file dropped beside the area never replaces the page.
  const hasFiles=e=>e.dataTransfer&&Array.from(e.dataTransfer.types||[]).indexOf('Files')>=0;
  window.addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();const zone=e.target.closest&&e.target.closest('[data-drop]');app.querySelectorAll('[data-drop].is-over').forEach(z=>{if(z!==zone)z.classList.remove('is-over');});if(zone)zone.classList.add('is-over');});
  window.addEventListener('dragleave',e=>{if(!e.relatedTarget)app.querySelectorAll('[data-drop].is-over').forEach(z=>z.classList.remove('is-over'));});
  window.addEventListener('drop',e=>{
    if(!hasFiles(e))return;e.preventDefault();app.querySelectorAll('[data-drop].is-over').forEach(z=>z.classList.remove('is-over'));
    if(!S.ready||!S.loaded)return;
    const zone=e.target.closest&&e.target.closest('[data-drop]'),c=zone?composerOf(zone):(S.composers[S.active]||S.composers.new);
    if(c)addFiles(c,e.dataTransfer.files);
  });
  document.addEventListener('paste',e=>{
    if(!S.ready||!S.loaded||!e.clipboardData)return;
    const files=Array.from(e.clipboardData.files||[]);if(!files.length)return;
    e.preventDefault();addFiles(S.composers[S.active]||composer('new'),files);
  });

  let loading=false;
  async function load(quiet){
    if(!window.EmilyAPI||!EmilyAPI.signedIn()){S.loaded=false;app.innerHTML='<p class="q-status" role="status">Sign in to send your questions.</p>';return;}
    if(loading)return;loading=true;if(!quiet||!S.loaded)app.innerHTML='<p class="q-status" role="status">Loading…</p>';
    try{
      const r=await EmilyAPI.call('questionSets');
      if(!EmilyAPI.signedIn())return;
      S.ready=!!r.ready;S.sets=r.sets||[];if(r.limits)S.limits=r.limits;S.loaded=true;
      Object.keys(S.composers).forEach(k=>{if(k!=='new'&&!S.sets.some(s=>s.id===k&&s.state!=='taught'))closeComposer(k);});
      render();
    }catch(e){
      if(quiet&&S.loaded){render();return;}
      app.innerHTML='<p class="q-status">'+esc(e.message||'This page could not be loaded.')+'</p><button type="button" class="button" data-retry="1">Try again</button>';
    }finally{loading=false;}
  }
  window.addEventListener('emily-login',()=>load());
  window.addEventListener('emily-logout',()=>{Object.keys(S.composers).forEach(k=>{S.composers[k].sending=false;closeComposer(k);});S.composers={};S.sets=[];S.loaded=false;app.innerHTML='<p class="q-status" role="status">Signed out.</p>';});
  load();
})();
