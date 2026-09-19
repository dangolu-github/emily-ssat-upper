(() => {
  'use strict';
  const list=document.getElementById('mistake-list'),status=document.getElementById('review-status'),progress=document.getElementById('redo-progress');
  const type=document.getElementById('type-filter'),view=document.getElementById('list-filter'),start=document.getElementById('redo-page'),check=document.getElementById('check-page'),exit=document.getElementById('exit-redo'),refresh=document.getElementById('refresh-list');
  let items=[],attempt=null,busy=false,epoch=0;
  const target=x=>({assignmentId:x.assignmentId,receiptId:x.receiptId,itemId:x.itemId});
  const itemKey=x=>x.receiptId+'_'+x.itemId;
  function text(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
  function visible(){return items.filter(x=>(!type.value||x.questionType===type.value)&&x.removed===(view.value==='removed'));}
  function controls(){const active=!!attempt;type.disabled=view.disabled=refresh.disabled=active||busy;start.hidden=active;start.disabled=busy||!visible().length;check.hidden=exit.hidden=!active;check.disabled=busy||!!attempt?.result;exit.disabled=busy;}
  function render(){
    list.replaceChildren();const shown=attempt?attempt.scope:visible();
    status.textContent=shown.length+' question'+(shown.length===1?'':'s')+(attempt?' in this redo.':' in this view.');
    progress.textContent=attempt?(attempt.result?'Page result: '+attempt.result.score+' / '+attempt.result.total:Object.keys(attempt.choices).length+' / '+shown.length+' answered'):'';
    shown.forEach((item,index)=>{
      const article=document.createElement('article');article.dataset.item=itemKey(item);
      const details=document.createElement('details');details.open=!!attempt;
      const summary=text('summary','Question '+item.n+' · '+item.questionType);details.append(summary,text('p',item.title,'muted'),text('h3',item.stem));
      if(item.passage){const passage=document.createElement('details');passage.append(text('summary',item.passage.title));item.passage.paragraphs.forEach(p=>passage.append(text('p',p)));details.append(passage);}
      const choices=document.createElement('div');choices.className='choice-list';
      item.options.forEach((option,i)=>{
        const letter='ABCDE'[i],label=document.createElement('label');
        if(attempt){const input=document.createElement('input');input.type='radio';input.name='redo-'+index;input.value=letter;input.checked=attempt.choices[itemKey(item)]===letter;input.disabled=busy||!!attempt.result;input.addEventListener('change',()=>{attempt.choices[itemKey(item)]=letter;progress.textContent=Object.keys(attempt.choices).length+' / '+attempt.scope.length+' answered';});label.append(input,document.createTextNode(' '+letter+'. '+option));}
        else label.textContent=letter+'. '+option;
        choices.append(label);
      });details.append(choices);
      if(attempt?.result){const mark=attempt.result.items.find(x=>x.itemId===item.itemId&&x.receiptId===item.receiptId);details.append(text('p',mark.correct?'Correct':'Try this relationship again.',mark.correct?'correct':'incorrect'));}
      if(!attempt){
        details.append(text('p','Original answer: '+(item.choice||'Unanswered'),'muted'));
        const answer=text('div','','review-answer');answer.hidden=true;
        const reveal=text('button','Show answer');reveal.type='button';
        reveal.addEventListener('click',async()=>{
          if(!answer.hidden){answer.hidden=true;answer.replaceChildren();reveal.textContent='Show answer';return;}
          reveal.disabled=true;const generation=epoch;
          try{const data=await EmilyAPI.call('mistakeAnswer',target(item));if(generation!==epoch||attempt||!EmilyAPI.signedIn())return;answer.replaceChildren(text('p',data.key+'. '+data.reason),text('p',data.choiceReason));answer.hidden=false;reveal.textContent='Hide answer';}
          catch(e){status.textContent=e.message;}finally{reveal.disabled=false;}
        });
        const remove=text('button',item.removed?'Restore to list':'Remove from list');remove.type='button';
        remove.addEventListener('click',async()=>{busy=true;controls();remove.disabled=true;try{await EmilyAPI.call('setRemoved',{...target(item),removed:!item.removed});item.removed=!item.removed;epoch++;render();}catch(e){status.textContent=e.message;remove.disabled=false;}finally{busy=false;controls();}});
        const actions=document.createElement('div');actions.className='actions';actions.append(reveal,remove);details.append(actions,answer);
      }
      article.append(details);list.append(article);
    });controls();
  }
  async function load(){if(!EmilyAPI.signedIn()){items=[];render();status.textContent='Sign in to view your submitted work.';return;}busy=true;controls();status.textContent='Loading your submitted work…';const generation=++epoch;
    try{const result=await EmilyAPI.call('mistakes');if(generation!==epoch||!EmilyAPI.signedIn())return;items=result.items;const prior=type.value;type.replaceChildren(new Option('All question types',''),...[...new Set(items.map(x=>x.questionType))].map(x=>new Option(x,x)));type.value=prior;render();}catch(e){status.textContent=e.message;}finally{busy=false;controls();}}
  [type,view].forEach(x=>x.addEventListener('change',()=>{epoch++;render();}));refresh.addEventListener('click',load);
  start.addEventListener('click',()=>{const scope=visible().map(x=>({...x}));if(!scope.length)return;epoch++;attempt={id:crypto.randomUUID(),scope,choices:{},result:null};render();list.querySelector('input')?.focus();});
  exit.addEventListener('click',()=>{attempt=null;epoch++;render();});
  check.addEventListener('click',async()=>{
    if(!attempt||busy)return;const missing=attempt.scope.find(x=>!attempt.choices[itemKey(x)]);
    if(missing){status.textContent='Answer every question on this page before checking.';const card=[...list.querySelectorAll('article')].find(x=>x.dataset.item===itemKey(missing));card.querySelector('details').open=true;card.querySelector('input').focus();return;}
    busy=true;render();status.textContent='Checking this page…';
    try{const data=await EmilyAPI.call('redo',{requestId:attempt.id,items:attempt.scope.map(x=>({...target(x),choice:attempt.choices[itemKey(x)]}))});attempt.result=data.result;render();}
    catch(e){status.textContent=e.message+' Your redo choices are preserved.';}finally{busy=false;controls();list.querySelectorAll('input').forEach(x=>{x.disabled=!!attempt?.result;});}
  });
  window.addEventListener('emily-login',load);window.addEventListener('emily-logout',()=>{epoch++;attempt=null;items=[];render();status.textContent='Signed out.';});load();
})();
