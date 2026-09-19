(() => {
  'use strict';
  const form=document.getElementById('homework'),count=document.getElementById('answer-count'),status=document.getElementById('save-status');
  const submit=document.getElementById('submit-homework'),result=document.getElementById('submission-result'),conflict=document.getElementById('draft-conflict');
  const storageKey='emily-ssat-c00-hw01-v1',assignmentId='EMI-C00-HW01';
  let revision=0,ready=false,submitted=false,saving=false,dirty=false,timer,pendingId='',version=0,conflictData=null,authEpoch=0,hasLocalDraft=false,receiptRender=0;
  const answers=()=>Object.fromEntries([...form.querySelectorAll('input:checked')].map(x=>[x.name,x.value])),say=text=>{status.textContent=text;};
  function restore(a){form.querySelectorAll('input').forEach(x=>{x.checked=a[x.name]===x.value;});updateCount();}
  function updateCount(){count.textContent=Object.keys(answers()).length+' of 20 answered';}
  function persist(){hasLocalDraft=true;try{localStorage.setItem(storageKey,JSON.stringify(answers()));}catch(_){say('Your choices could not be saved on this device. Download your answer sheet before leaving.');}}
  function freeze(value){form.querySelectorAll('input,button').forEach(x=>{x.disabled=value;});submit.disabled=value;}
  function clean(a){const x={};for(let n=1;n<=20;n++)if(/^[A-E]$/.test(a['q'+n]||''))x['q'+n]=a['q'+n];return x;}
  function same(a,b){return JSON.stringify(clean(a))===JSON.stringify(clean(b));}
  try{hasLocalDraft=localStorage.getItem(storageKey)!==null;restore(clean(JSON.parse(localStorage.getItem(storageKey)||'{}')));pendingId=localStorage.getItem(storageKey+'-submit-request')||'';}catch(_){say('A previous draft could not be loaded.');}
  function clearMarks(){receiptRender++;result.hidden=true;result.replaceChildren();form.querySelectorAll('.feedback').forEach(x=>x.remove());}
  async function displayReceipt(receipt){
    submitted=true;ready=false;dirty=false;clearTimeout(timer);restore(receipt.answers);freeze(true);conflict.hidden=true;clearMarks();const render=receiptRender,generation=authEpoch;result.hidden=false;
    const heading=document.createElement('h2');heading.textContent='Submitted · '+receipt.grade.score+' / '+receipt.grade.total;result.append(heading);
    const note=document.createElement('p');note.textContent=receipt.provenance.kind==='external_wechat'?'Your homework sent through WeChat has been recorded and marked.':'Your submission has been received and marked.';result.append(note);
    const review=document.createElement('a');review.href='../review/index.html';review.textContent='Open mistake logbook';result.append(review);say('Submitted. Your original answers are saved.');
    receipt.grade.items.forEach(item=>{const p=document.createElement('p');p.className='feedback '+(item.correct?'correct':'incorrect');p.textContent=item.correct?'Correct':'Your answer: '+(item.choice||'Unanswered')+' · Review this question';form.querySelector('[data-question="'+item.n+'"]').append(p);});
    try{const feedback=await EmilyAPI.call('feedback',{assignmentId,receiptId:receipt.receiptId});if(render!==receiptRender||generation!==authEpoch||!submitted||!EmilyAPI.signedIn())return;feedback.items.forEach(item=>{const details=document.createElement('details');details.className='feedback';const title=document.createElement('summary');title.textContent='Show answer and explanation';const p=document.createElement('p');p.textContent=item.key+'. '+item.reason;details.append(title,p);form.querySelector('[data-question="'+item.n+'"]').append(details);});}
    catch(e){if(render===receiptRender&&generation===authEpoch)say('Your submission is saved. '+e.message);}
  }
  async function load(){
    if(!EmilyAPI.signedIn())return;ready=false;const when=version,generation=authEpoch;say('Loading your saved work…');
    try{const data=await EmilyAPI.call('state',{assignmentId});if(generation!==authEpoch||!EmilyAPI.signedIn())return;if(data.submitted){await displayReceipt(data.receipt);return;}
      revision=data.draft?.revision||0;const local=answers(),server=data.draft?.answers||{};
      if(data.draft&&!same(local,server)&&hasLocalDraft){conflictData={server,local};conflict.hidden=false;say('Choose which saved draft to use. Both copies will be kept.');return;}
      if(version===when&&data.draft)restore(server);ready=true;say(data.draft?'Saved work loaded.':'Your choices are saved on this device.');
      if(!data.draft&&Object.keys(answers()).length){dirty=true;await sync();}
    }catch(e){say(e.message);}
  }
  conflict.querySelectorAll('button').forEach(button=>button.addEventListener('click',async()=>{
    if(!conflictData)return;try{localStorage.setItem(storageKey+'-conflict-backup',JSON.stringify({local:conflictData.local,server:conflictData.server,at:new Date().toISOString()}));}catch(_){say('Unable to preserve both drafts. Download your answer sheet before choosing.');return;}
    if(button.dataset.draft==='server')restore(conflictData.server);persist();conflict.hidden=true;conflictData=null;ready=true;dirty=true;await sync();
  }));
  async function sync(){
    if(!ready||submitted||saving||!dirty||!EmilyAPI.signedIn())return;saving=true;dirty=false;const snapshot=answers(),generation=authEpoch;say('Saving…');
    try{const data=await EmilyAPI.call('saveDraft',{assignmentId,answers:snapshot,baseRevision:revision});if(generation!==authEpoch||!EmilyAPI.signedIn())return;if(data.submitted){await displayReceipt(data.receipt);return;}revision=data.draft.revision;say('Saved.');}
    catch(e){dirty=true;say('Saved on this device. '+e.message);if(/another page/.test(e.message)){ready=false;await load();}}
    finally{saving=false;if(dirty&&ready&&!submitted)timer=setTimeout(sync,5000);}
  }
  function changed(){version++;updateCount();persist();dirty=true;say('Saved on this device.');clearTimeout(timer);timer=setTimeout(sync,500);}
  form.addEventListener('change',changed);form.addEventListener('submit',e=>e.preventDefault());
  form.querySelectorAll('[data-clear]').forEach(button=>button.addEventListener('click',()=>{form.querySelectorAll('input[name="'+button.dataset.clear+'"]').forEach(x=>{x.checked=false;});changed();}));
  submit.addEventListener('click',async()=>{
    if(!EmilyAPI.signedIn()){say('Please enter your website password before submitting.');document.querySelector('#account-panel input').focus();return;}
    if(!ready){say('Load your saved work and resolve any draft choice before submitting.');return;}
    if(Object.keys(answers()).length!==20){say('Answer all 20 questions before submitting.');for(let n=1;n<=20;n++)if(!answers()['q'+n]){form.querySelector('input[name="q'+n+'"]').focus();break;}return;}
    if(!pendingId){pendingId=crypto.randomUUID();try{localStorage.setItem(storageKey+'-submit-request',pendingId);}catch(_){}}
    const snapshot=answers(),generation=authEpoch;freeze(true);clearTimeout(timer);say('Submitting… Please keep this page open.');
    try{const data=await EmilyAPI.call('submit',{assignmentId,answers:snapshot,requestId:pendingId});if(generation!==authEpoch||!EmilyAPI.signedIn())return;await displayReceipt(data.receipt);}
    catch(e){if(generation===authEpoch){freeze(false);say(e.message+' Click Submit again to confirm receipt.');}}
  });
  document.getElementById('download-answers').addEventListener('click',()=>{
    const a=answers(),lines=['Emily | SSAT Upper | Trial homework','How Believable Is It?',''];for(let n=1;n<=20;n++)lines.push(n+'. '+(a['q'+n]||'[unanswered]'));
    const url=URL.createObjectURL(new Blob([lines.join('\n')+'\n'],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='Emily-Trial-Homework-Answers.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('emily-login',()=>{authEpoch++;load();});window.addEventListener('emily-logout',()=>{authEpoch++;ready=false;submitted=false;dirty=false;clearTimeout(timer);clearMarks();freeze(false);conflict.hidden=true;try{restore(clean(JSON.parse(localStorage.getItem(storageKey)||'{}')));}catch(_){}say('Signed out. Your local draft is preserved.');});
  window.addEventListener('online',sync);document.getElementById('refresh-work').addEventListener('click',load);updateCount();load();
})();
