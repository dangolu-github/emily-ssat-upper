(() => {
  'use strict';
  const $=id=>document.getElementById(id),form=$('mock-form'),status=$('mock-status'),submit=$('submit-mock'),result=$('mock-result'),conflict=$('mock-conflict');
  const assignmentId=new URLSearchParams(location.search).get('assignment')||'';
  let a=null,storage='',revision=0,epoch=0,ready=false,submitted=false,saving=false,dirty=false,timer=null,pending='',versions=null,confirmedData=null;
  const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
  const say=text=>{status.textContent=text;};
  const writing=()=>a?.kind==='mock_writing';
  function clean(raw){if(writing())return {text:typeof raw?.text==='string'?raw.text:''};const answers={};a.items.forEach(x=>{const v=raw?.answers?.['q'+x.n];if(/^[A-E]$/.test(v||''))answers['q'+x.n]=v;});return {answers};}
  function snapshot(){return writing()?{text:$('writing-response')?.value||''}:{answers:Object.fromEntries([...form.querySelectorAll('input:checked')].map(x=>[x.name,x.value]))};}
  function count(){if(!a)return;$('mock-count').textContent=writing()?(snapshot().text.trim().match(/\S+/g)||[]).length+' words':Object.keys(snapshot().answers).length+' of '+a.items.length+' answered';}
  function restore(raw){const data=clean(raw);if(writing())$('writing-response').value=data.text;else form.querySelectorAll('input').forEach(x=>x.checked=data.answers[x.name]===x.value);count();}
  function freeze(value){form.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=value);submit.disabled=value||!ready||submitted;}
  function persist(){try{localStorage.setItem(storage,JSON.stringify(snapshot()));return true;}catch(_){say('Your device could not save this draft. Keep this page open until it is saved online.');return false;}}
  function passage(p){const box=el('section');box.className='practice-passage';if(p.title)box.append(el('h2',p.title));p.paragraphs.forEach(t=>box.append(el('p',t)));return box;}
  function render(){
    form.replaceChildren();$('mock-title').textContent=a.title;$('mock-level').textContent=a.levelLabel||'English practice';document.title=a.title+' · Emily SSAT';
    $('mock-instructions').textContent=writing()?'Write your response, then submit it for teacher review. Your writing will not receive an automatic score.':'Choose an answer for each question. Submit this section to see your result and the correct answers.'+(a.sourceItemCount>a.items.length?' This section contains '+a.items.length+' selected questions and keeps the original question numbers.':'');
    submit.textContent=writing()?'Submit writing':'Submit section';
    if(writing()){form.append(passage({title:'Writing prompt',paragraphs:[a.prompt]}));const label=el('label','Your response');label.htmlFor='writing-response';const text=el('textarea');text.id='writing-response';text.name='response';text.spellcheck=true;form.append(label,text);}
    else {let part=null;a.items.forEach(item=>{if(item.part!==part){part=item.part;if(a.passages[part])form.append(passage(a.passages[part]));}
      const q=el('article');q.className='practice-question';q.dataset.question=item.n;const field=el('fieldset');field.append(el('legend','Question '+item.n+' · '+item.stem));const ol=el('ol');ol.className='options';
      item.options.forEach((text,i)=>{const li=el('li'),label=el('label'),input=el('input');input.type='radio';input.name='q'+item.n;input.value='ABCDE'[i];label.append(input,document.createTextNode(input.value+'. '+text));li.append(label);ol.append(li);});field.append(ol);q.append(field);const clear=el('button','Clear answer');clear.type='button';clear.dataset.clear='q'+item.n;q.append(clear);form.append(q);});}
    count();
  }
  async function display(receipt,generation){
    if(generation!==epoch||!EmilyAPI.signedIn())return;submitted=true;ready=false;dirty=false;clearTimeout(timer);restore(receipt);freeze(true);conflict.hidden=true;result.replaceChildren();result.hidden=false;
    if(writing()){result.append(el('h2','Writing submitted'),el('p','Your response has been received and is waiting for teacher review.'));say('Submitted. Your original writing is saved.');return;}
    result.append(el('h2',receipt.grade.score+' / '+receipt.grade.total),el('p',receipt.grade.correct+' correct · '+receipt.grade.incorrect+' incorrect · '+receipt.grade.omitted+' unanswered'));
    form.querySelectorAll('.mock-feedback').forEach(x=>x.remove());
    receipt.grade.items.forEach(item=>{const mark=el('div',item.correct?'Correct':item.choice?'Incorrect · Your answer: '+item.choice:'Unanswered');mark.className='mock-feedback '+(item.correct?'correct':'incorrect');mark.dataset.feedback=item.n;form.querySelector('[data-question="'+item.n+'"]').append(mark);});
    say('Submitted. Your original answers are saved.');
    try{const feedback=await EmilyAPI.call('feedback',{assignmentId,receiptId:receipt.receiptId});if(generation!==epoch||!submitted||!EmilyAPI.signedIn())return;feedback.items.forEach(x=>{const box=form.querySelector('[data-feedback="'+x.n+'"]');box.append(el('p','Correct answer: '+x.key+'. '+x.answer));if(x.reason)box.append(el('p',x.reason));});}
    catch(e){if(generation===epoch)say('Your submission is saved. '+e.message+' Reload saved work to load the answers.');}
  }
  async function load(){
    if(!EmilyAPI.signedIn())return;const generation=++epoch;ready=false;submitted=false;dirty=false;clearTimeout(timer);freeze(true);conflict.hidden=true;result.hidden=true;$('mock-submit-confirm').hidden=true;confirmedData=null;say('Loading saved work…');
    try{const data=await EmilyAPI.call('assignment',{assignmentId});if(generation!==epoch||!EmilyAPI.signedIn())return;a=data.assignment;storage='emily-mock-'+data.storageScope;render();freeze(true);
      const state=await EmilyAPI.call('state',{assignmentId});if(generation!==epoch||!EmilyAPI.signedIn())return;revision=state.draft?.revision||0;
      if(state.submitted){await display(state.receipt,generation);return;}
      let local=null;try{const raw=localStorage.getItem(storage);if(raw!==null)local=clean(JSON.parse(raw));pending=localStorage.getItem(storage+'-submit')||'';}catch(_){say('A device draft could not be loaded.');}
      const server=state.draft?clean(state.draft):null;
      if(local&&server&&JSON.stringify(local)!==JSON.stringify(server)){versions={local,server};restore(local);conflict.hidden=false;say('Choose which saved draft to continue with.');return;}
      restore(server||local||{});ready=true;freeze(false);say(state.draft?'Saved work loaded.':'Ready. Your work will be saved as you go.');
      if(local&&!server){dirty=true;await sync();}
    }catch(e){if(generation===epoch)say(e.message);}
  }
  async function sync(){
    if(!ready||submitted||saving||!dirty||!EmilyAPI.signedIn())return;saving=true;dirty=false;const generation=epoch,data=snapshot();say('Saving…');
    try{const saved=await EmilyAPI.call('saveDraft',{assignmentId,...data,baseRevision:revision});if(generation!==epoch||!EmilyAPI.signedIn())return;if(saved.submitted){await display(saved.receipt,generation);return;}revision=saved.draft.revision;say('Saved.');}
    catch(e){if(generation===epoch){dirty=true;say('Your draft is kept on this device. '+e.message);if(/another page/.test(e.message)){ready=false;await load();}}}
    finally{saving=false;if(dirty&&ready&&!submitted)timer=setTimeout(sync,5000);}
  }
  function changed(){if(!ready||submitted)return;count();persist();dirty=true;clearTimeout(timer);timer=setTimeout(sync,650);}
  form.addEventListener('change',changed);form.addEventListener('input',e=>{if(e.target.tagName==='TEXTAREA')changed();});form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('click',e=>{const b=e.target.closest('[data-clear]');if(!b)return;form.querySelectorAll('input[name="'+b.dataset.clear+'"]').forEach(x=>x.checked=false);changed();});
  conflict.querySelectorAll('[data-draft]').forEach(b=>b.onclick=async()=>{if(!versions)return;try{localStorage.setItem(storage+'-conflict-backup',JSON.stringify({...versions,at:new Date().toISOString()}));}catch(_){say('Both drafts could not be preserved. Keep this page open and try again.');return;}restore(versions[b.dataset.draft]);versions=null;conflict.hidden=true;ready=true;freeze(false);persist();dirty=true;await sync();});
  submit.onclick=async()=>{
    if(!ready||submitted||!EmilyAPI.signedIn())return;const data=snapshot(),omitted=writing()?0:a.items.length-Object.keys(data.answers).length;
    if(writing()&&!data.text.trim()){say('Write your response before submitting.');$('writing-response').focus();return;}
    if(writing()&&new TextEncoder().encode(data.text).length>6500){say('Please shorten your response to about 1,000 English words before submitting. Your draft is still on this device.');return;}
    confirmedData=data;freeze(true);$('mock-submit-message').textContent=omitted?'You have '+omitted+' unanswered question'+(omitted===1?'':'s')+'. Confirm to submit with these questions unanswered.':'Your original response will be kept after submission.';
    $('mock-submit-confirm').hidden=false;$('confirm-submit-mock').focus();
  };
  $('cancel-submit-mock').onclick=()=>{confirmedData=null;$('mock-submit-confirm').hidden=true;if(ready&&!submitted)freeze(false);};
  $('confirm-submit-mock').onclick=async()=>{
    if(!confirmedData||!ready||submitted||!EmilyAPI.signedIn())return;const data=confirmedData;confirmedData=null;$('mock-submit-confirm').hidden=true;
    const omitted=writing()?0:a.items.length-Object.keys(data.answers).length;
    if(!pending)pending=crypto.randomUUID();try{localStorage.setItem(storage+'-submit',pending);}catch(_){}
    const generation=epoch;freeze(true);clearTimeout(timer);say('Submitting… Please keep this page open.');
    try{const data2=await EmilyAPI.call('submit',{assignmentId,...data,requestId:pending,confirmOmissions:omitted>0});await display(data2.receipt,generation);}
    catch(e){if(generation===epoch){freeze(false);say(e.message+' Press Submit again to confirm receipt.');}}
  };
  $('refresh-mock').onclick=load;window.addEventListener('online',sync);window.addEventListener('emily-login',load);
  window.addEventListener('emily-logout',()=>{epoch++;ready=false;submitted=false;dirty=false;clearTimeout(timer);a=null;confirmedData=null;$('mock-submit-confirm').hidden=true;form.replaceChildren();result.hidden=true;result.replaceChildren();conflict.hidden=true;submit.disabled=true;$('mock-count').textContent='';say('Signed out. Your device draft is preserved.');});
  if(!/^EMI-MOCK-(UPW|UPP)-\d{2}-(REA|VER|WRI)$/.test(assignmentId)){say('Choose a section from Practice Space.');return;}load();
})();
