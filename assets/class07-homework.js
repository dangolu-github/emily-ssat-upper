(() => {
  'use strict';
  // Teacher-only submission origin (submission-origin.js): sent with the final hand-in only and never shown on this page.
  const originForSubmit=async()=>{try{return window.PortalSubmissionOrigin?await window.PortalSubmissionOrigin.collect():null;}catch(_){return null;}};
  const warmOrigin=()=>{try{if(window.PortalSubmissionOrigin)window.PortalSubmissionOrigin.warm();}catch(_){}};
  const form=document.getElementById('homework'),count=document.getElementById('answer-count'),status=document.getElementById('save-status');
  const submit=document.getElementById('submit-homework'),result=document.getElementById('submission-result'),conflict=document.getElementById('draft-conflict');
  // Class 07 onward (2026-10-31, from class04-homework.js). Parts sit behind tabs; a reading part is two panes, passage left and questions right, each scrolling on its own
  // (phones: stacked, passage on top; print: one column). After submission the page shows the learner's answer, the correct answer and the score only: no explanations.
  const assignmentId=form.dataset.assignment,storageKey='emily-ssat-'+assignmentId.toLowerCase()+'-v1',fileTitle=form.dataset.title||assignmentId;let total=0;
  let revision=0,ready=false,submitted=false,saving=false,dirty=false,timer,pendingId='',version=0,conflictData=null,authEpoch=0,hasLocalDraft=false,receiptRender=0,rendered=false;
  const answers=()=>Object.fromEntries([...form.querySelectorAll('input:checked')].map(x=>[x.name,x.value])),say=text=>{status.textContent=text;};
  function restore(a){form.querySelectorAll('input').forEach(x=>{x.checked=a[x.name]===x.value;});updateCount();}
  function updateCount(){count.textContent=total?Object.keys(answers()).length+' of '+total+' answered':'';}
  function persist(){hasLocalDraft=true;try{localStorage.setItem(storageKey,JSON.stringify(answers()));}catch(_){say('Your choices could not be saved on this device. Download your answer sheet before leaving.');}}
  function freeze(value){form.querySelectorAll('input,button').forEach(x=>{x.disabled=value;});submit.disabled=value;}
  function clean(a){const x={};for(let n=1;n<=60;n++)if(/^[A-E]$/.test(a['q'+n]||''))x['q'+n]=a['q'+n];return x;}
  function same(a,b){return JSON.stringify(clean(a))===JSON.stringify(clean(b));}
  try{hasLocalDraft=localStorage.getItem(storageKey)!==null;restore(clean(JSON.parse(localStorage.getItem(storageKey)||'{}')));pendingId=localStorage.getItem(storageKey+'-submit-request')||'';}catch(_){say('A previous draft could not be loaded.');}
  function clearMarks(){receiptRender++;result.hidden=true;result.replaceChildren();form.querySelectorAll('.feedback').forEach(x=>x.remove());form.querySelectorAll('.chosen-right,.chosen-wrong,.key-right').forEach(x=>x.classList.remove('chosen-right','chosen-wrong','key-right'));}
  async function displayReceipt(receipt){
    submitted=true;ready=false;dirty=false;clearTimeout(timer);restore(receipt.answers);freeze(true);conflict.hidden=true;clearMarks();const render=receiptRender,generation=authEpoch;result.hidden=false;
    if(receipt.held||!receipt.grade){const wait=document.createElement('p');wait.textContent=receipt.heldMessage||'Submitted. Waiting for your teacher to review.';result.append(wait);say('Submitted. Your original answers are saved.');showFirstUnit();return;}
    const heading=document.createElement('h2');heading.textContent='Submitted · '+receipt.grade.score+' / '+receipt.grade.total;result.append(heading);
    const note=document.createElement('p');note.textContent=receipt.provenance.kind==='external_wechat'?'Your homework sent through WeChat has been recorded and marked.':'Your submission has been received and marked.';result.append(note);
    const review=document.createElement('a');review.href='../review/index.html';review.textContent='Open mistake logbook';result.append(review);say('Submitted. Your original answers are saved.');
    receipt.grade.items.forEach(item=>{const box=form.querySelector('[data-question="'+item.n+'"]'),p=document.createElement('p');p.className='feedback '+(item.correct?'correct':'incorrect');p.textContent=item.correct?'Correct':'Your answer: '+(item.choice||'Unanswered');box.append(p);markChoice(box,item.choice,item.correct?'chosen-right':'chosen-wrong');});
    showFirstUnit();
    try{const feedback=await EmilyAPI.call('feedback',{assignmentId,receiptId:receipt.receiptId});if(render!==receiptRender||generation!==authEpoch||!submitted||!EmilyAPI.signedIn())return;feedback.items.forEach(item=>{const box=form.querySelector('[data-question="'+item.n+'"]');markChoice(box,item.key,'key-right');const line=box.querySelector('p.feedback.incorrect');if(line)line.textContent+=' · Correct answer: '+item.key+(item.reason?' · '+item.reason:'');});}
    catch(e){if(render===receiptRender&&generation===authEpoch)say('Your submission is saved. '+e.message);}
  }
  function markChoice(box,letter,cls){if(!box||!letter)return;const input=box.querySelector('input[value="'+letter+'"]');if(input&&input.closest('li'))input.closest('li').classList.add(cls);}
  let unitOf={},tabs=[],units=[];
  function showUnit(id,scroll){units.forEach(u=>u.classList.toggle('active',u.dataset.unit===id));tabs.forEach(t=>{const on=t.dataset.unit===id;t.classList.toggle('active',on);t.setAttribute('aria-selected',String(on));});if(scroll){const nav=form.querySelector('.hw-tabs');if(nav)nav.scrollIntoView({block:'start',behavior:'instant'});}}
  function showFirstUnit(){if(units[0])showUnit(units[0].dataset.unit,false);}
  function renderQuestions(a){
    form.replaceChildren();total=a.items.length;unitOf={};tabs=[];units=[];
    const el=(tag,value)=>{const x=document.createElement(tag);x.textContent=value;return x;};
    const nav=document.createElement('div');nav.className='hw-tabs';nav.setAttribute('role','tablist');form.append(nav);
    const parts=[];a.items.forEach(item=>{if(!parts.includes(item.part))parts.push(item.part);});
    parts.forEach((part,i)=>{
      const p=a.passages[part],tab=el('button',p.title.split(' · ')[0]+(p.lines?'':' · '+p.title.split(' · ')[1]));tab.type='button';tab.dataset.unit=part;tab.setAttribute('role','tab');tab.addEventListener('click',()=>showUnit(part,true));nav.append(tab);tabs.push(tab);
      const unit=document.createElement('section');unit.className='hw-unit'+(p.lines?' hw-reading':'');unit.dataset.unit=part;form.append(unit);units.push(unit);
      let qs=unit;
      if(p.lines){
        const left=document.createElement('div');left.className='hw-pane hw-pane-passage';const right=document.createElement('div');right.className='hw-pane hw-pane-questions';
        const passage=document.createElement('div');passage.className='card reading-passage lined';passage.dataset.printLines='';passage.append(el('h2',p.title));
        let n=0;p.lines.forEach(line=>{if(line===''){passage.append(document.createElement('br'));return;}n++;const row=document.createElement('div');row.className='poem-line';const num=el('span',n%5===0?String(n):'');num.className='line-number';row.append(num,el('span',line));passage.append(row);});
        left.append(passage);unit.append(left,right);qs=right;
      }else unit.append(el('h2',p.title));
      a.items.filter(item=>item.part===part).forEach(item=>{unitOf[item.n]=part;renderItem(item,qs);});
      const next=parts[i+1];if(next){const go=el('button','Next: '+a.passages[next].title.split(' · ')[0]);go.type='button';go.className='small-button hw-next screen-only';go.addEventListener('click',()=>showUnit(next,true));qs.append(go);}
    });
    showFirstUnit();updateCount();
    function renderItem(item,into){
      const q=document.createElement('article');q.dataset.question=item.n;const field=document.createElement('fieldset');field.style.border='0';field.style.padding='0';field.append(el('legend','Question '+item.n+' · '+item.stem));const ol=document.createElement('ol');ol.className='options';
      item.options.forEach((option,i)=>{const li=document.createElement('li'),label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='q'+item.n;input.value='ABCDE'[i];label.append(input,document.createTextNode(input.value+'. '+option));li.append(label);ol.append(li);});field.append(ol);q.append(field);const clear=el('button','Clear answer');clear.type='button';clear.className='small-button';clear.dataset.clear='q'+item.n;q.append(clear);const line=document.createElement('div');line.className='answer-line';q.append(line);into.append(q);
    }
  }
  async function load(){
    if(!EmilyAPI.signedIn())return;ready=false;const when=version,generation=authEpoch;say('Loading your saved work…');
    try{
      if(!rendered){const payload=await EmilyAPI.call('assignment',{assignmentId});if(generation!==authEpoch||!EmilyAPI.signedIn())return;renderQuestions(payload.assignment);try{restore(clean(JSON.parse(localStorage.getItem(storageKey)||'{}')));}catch(_){}rendered=true;}
      const data=await EmilyAPI.call('state',{assignmentId});if(generation!==authEpoch||!EmilyAPI.signedIn())return;if(data.submitted){await displayReceipt(data.receipt);return;}
      revision=data.draft?.revision||0;const local=answers(),server=data.draft?.answers||{};
      if(data.draft&&!same(local,server)&&hasLocalDraft){conflictData={server,local};conflict.hidden=false;say('Choose which saved draft to use. Both copies will be kept.');return;}
      if(version===when&&data.draft)restore(server);ready=true;warmOrigin();say(data.draft?'Saved work loaded.':'Your choices are saved on this device.');
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
  form.addEventListener('click',event=>{const button=event.target.closest('[data-clear]');if(!button)return;form.querySelectorAll('input[name="'+button.dataset.clear+'"]').forEach(x=>{x.checked=false;});changed();});
  submit.addEventListener('click',async()=>{
    if(!EmilyAPI.signedIn()){say('Please enter your website password before submitting.');document.querySelector('#account-panel input').focus();return;}
    if(!ready){say('Load your saved work and resolve any draft choice before submitting.');return;}
    if(Object.keys(answers()).length!==total){say('Answer all '+total+' questions before submitting.');for(let n=1;n<=total;n++)if(!answers()['q'+n]){showUnit(unitOf[n],true);form.querySelector('input[name="q'+n+'"]').focus();break;}return;}
    if(!pendingId){pendingId=crypto.randomUUID();try{localStorage.setItem(storageKey+'-submit-request',pendingId);}catch(_){}}
    const snapshot=answers(),generation=authEpoch;freeze(true);clearTimeout(timer);say('Submitting… Please keep this page open.');
    try{const submissionOrigin=await originForSubmit();const data=await EmilyAPI.call('submit',{assignmentId,answers:snapshot,requestId:pendingId,submissionOrigin});if(generation!==authEpoch||!EmilyAPI.signedIn())return;await displayReceipt(data.receipt);}
    catch(e){if(generation===authEpoch){freeze(false);say(e.message+' Click Submit again to confirm receipt.');}}
  });
  document.getElementById('download-answers').addEventListener('click',()=>{
    const a=answers(),lines=['Emily | SSAT Upper | Homework',fileTitle,''];for(let n=1;n<=total;n++)lines.push(n+'. '+(a['q'+n]||'[unanswered]'));
    const url=URL.createObjectURL(new Blob([lines.join('\n')+'\n'],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='Emily-'+assignmentId+'-Answers.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('emily-login',()=>{authEpoch++;load();});window.addEventListener('emily-logout',()=>{authEpoch++;ready=false;submitted=false;dirty=false;clearTimeout(timer);clearMarks();freeze(false);conflict.hidden=true;try{restore(clean(JSON.parse(localStorage.getItem(storageKey)||'{}')));}catch(_){}form.replaceChildren();rendered=false;say('Signed out. Your local draft is preserved.');});
  // Print: a passage with numbered lines prints one source line per printed line (2026-10-24). Its widest line is measured in em
  // near the printed size (first at 12px, then at the size that width gives on A4); site.css shrinks that passage, never below 7pt.
  const lineFits=[];
  window.addEventListener('beforeprint',()=>{document.querySelectorAll('[data-print-lines]').forEach(block=>{const lines=Array.from(block.children).filter(n=>n.classList.contains('poem-line'));if(!lines.length)return;block.classList.add('print-lines-measure');
    const widestAt=px=>{block.style.setProperty('--print-measure-size',px+'px');return Math.max(...lines.map(line=>{const r=document.createRange();r.selectNodeContents(line);return r.getBoundingClientRect().width/px;}));};
    let em=widestAt(12);if(em>0)em=Math.max(em,widestAt(Math.min(13.6,685/em)));block.classList.remove('print-lines-measure');block.style.removeProperty('--print-measure-size');
    if(em>0&&em<=72){block.style.setProperty('--print-line-em',em.toFixed(2));block.classList.add('print-lines-fit');lineFits.push(block);}});});   // above 72em even 7pt overflows A4: it keeps wrapping
  window.addEventListener('afterprint',()=>{lineFits.splice(0).forEach(b=>{b.classList.remove('print-lines-fit');b.style.removeProperty('--print-line-em');});});
  window.addEventListener('online',sync);document.getElementById('refresh-work').addEventListener('click',load);updateCount();load();
})();
