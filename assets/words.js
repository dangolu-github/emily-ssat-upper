(() => {
  'use strict';
  // Vocabulary page. Lists come from the private service after sign-in (EmilyAPI from portal-api.js).
  // Views: by class (newest first), class words by unit, class words by theme, and the SSAT Upper word bank by unit.
  // `?class=NN` shows one class's words; `?list=u01` shows one word-bank unit. "I know this" ticks are saved on the server by
  // headword, so the same word is ticked everywhere. Copy and Download give the unticked words as Quizlet cards (word TAB meaning).
  const app=document.querySelector('[data-words-app]'),intro=document.querySelector('[data-words-intro]');
  const viewKey='emily-words-view';
  const params=new URLSearchParams(location.search);
  const S={units:[],themes:[],lists:[],known:new Set(),view:'class',query:'',unchecked:false,classNo:params.get('class')||'',listKey:(params.get('list')||'').toUpperCase(),open:new Set(),loaded:false};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const shortDate=d=>d?d.slice(5).replace('-','/'):'';
  const unitById=id=>S.units.find(u=>u.id===id)||{id,kind:'theme',title:id};
  const unitLabel=u=>(u.kind==='type'?'Question type · ':'Unit '+u.id.replace(/^U/,'')+' · ')+u.title;
  const classLists=()=>S.lists.filter(l=>l.kind==='class');
  const bankLists=()=>S.lists.filter(l=>l.kind==='bank');
  const classTitle=l=>(l.classNo===0?'Trial class':'Class '+pad(l.classNo))+(l.date?' · '+shortDate(l.date):'')+' · '+l.title;
  const oneClass=()=>S.classNo?classLists().find(l=>String(l.classNo)===String(Number(S.classNo))):null;
  const oneList=()=>S.listKey?bankLists().find(l=>l.unit===S.listKey):null;

  // Groups for the current view. Unit and theme views show each headword once and name every class it came from.
  function groups(){
    if(S.classNo){const l=oneClass();return l?[classGroup(l)]:[];}
    if(S.listKey){const l=oneList();return l?[bankGroup(l)]:[];}
    if(S.view==='class')return classLists().slice().sort((a,b)=>b.date<a.date?-1:1).map(classGroup);
    if(S.view==='bank')return bankLists().map(bankGroup);
    const keyOf=S.view==='unit'?w=>w.unit:w=>w.theme;
    const order=S.view==='unit'?S.units.map(u=>u.id):S.themes.slice();
    const byKey={},seen={};
    classLists().slice().sort((a,b)=>a.date<b.date?-1:1).forEach(l=>{l.words.forEach(w=>{
      const k=keyOf(w),g=byKey[k]||(byKey[k]={});let item=seen[k+'|'+w.id];
      if(!item){item=seen[k+'|'+w.id]={w,classes:[]};g[w.id]=item;}
      if(!item.classes.some(c=>c.classNo===l.classNo))item.classes.push({classNo:l.classNo,date:l.date});
    });});
    Object.keys(byKey).forEach(k=>{if(order.indexOf(k)<0)order.push(k);});
    return order.filter(k=>byKey[k]).map(k=>({key:S.view+':'+k,title:S.view==='unit'?unitLabel(unitById(k)):k,note:'',items:Object.keys(byKey[k]).map(id=>byKey[k][id]),kind:'class'}));
  }
  const classGroup=l=>({key:'class:'+l.id,title:classTitle(l),note:'',items:l.words.map(w=>({w,classes:[]})),kind:'class'});
  const bankGroup=l=>({key:'bank:'+l.id,title:unitLabel(unitById(l.unit)),note:l.note||'',items:l.words.map(w=>({w,classes:[]})),kind:'bank'});
  function matches(item){const w=item.w;if(S.unchecked&&S.known.has(w.id))return false;return !S.query||[w.word,w.en,w.example].join(' ').toLowerCase().indexOf(S.query)>=0;}

  function row(item,g){
    const w=item.w,known=S.known.has(w.id);
    const tags=g.kind==='bank'?'<span class="word-tag">'+esc(w.theme)+'</span>':(S.view==='class'||S.classNo)?'<span class="word-tag">'+esc(unitById(w.unit).title)+'</span>':item.classes.map(c=>'<span class="word-tag">'+(c.classNo===0?'Trial':'Class '+pad(c.classNo))+(c.date?' · '+shortDate(c.date):'')+'</span>').join('');
    return '<li class="word-row'+(known?' is-known':'')+'"><label class="word-check"><input type="checkbox" data-known="'+esc(w.id)+'"'+(known?' checked':'')+' aria-label="I know this: '+esc(w.word)+'"><span>I know this</span></label>'+
      '<div class="word-body"><p class="word-head"><strong>'+esc(w.word)+'</strong>'+(w.pos?' <span class="word-pos">'+esc(w.pos)+'</span>':'')+'</p>'+
      (w.en?'<p class="word-en">'+esc(w.en)+'</p>':'')+(w.example?'<p class="word-example">'+esc(w.example)+'</p>':'')+'<p class="word-tags">'+tags+'</p></div></li>';
  }
  function groupHtml(g){
    const visible=g.items.filter(matches),checked=g.items.filter(i=>S.known.has(i.w.id)).length;
    if((S.query||S.unchecked)&&!visible.length)return '';
    const open=S.classNo||S.listKey||S.query||S.open.has(g.key)?' open':'';
    return '<details class="word-group" data-group="'+esc(g.key)+'"'+open+'><summary><span class="word-group-title">'+esc(g.title)+'</span><small>'+g.items.length+' word'+(g.items.length===1?'':'s')+(checked?' · '+checked+' known':'')+'</small></summary>'+
      '<div class="word-group-body">'+(g.note?'<p class="word-group-note">'+esc(g.note)+'</p>':'')+'<div class="word-actions">'+
      '<button class="button button-secondary" type="button" data-checkall="'+esc(g.key)+'"'+(checked===g.items.length?' disabled':'')+'>Check all<small>tick every word here</small></button>'+
      '<button class="button button-secondary" type="button" data-uncheckall="'+esc(g.key)+'"'+(checked?'':' disabled')+'>Uncheck all<small>clear the ticks here</small></button>'+
      '<button class="button" type="button" data-copy="'+esc(g.key)+'">Copy for Quizlet<small>unticked words, one card per line</small></button>'+
      '<button class="button button-secondary" type="button" data-download="'+esc(g.key)+'">Download .txt<small>the same cards as a file</small></button></div>'+
      '<p class="word-msg" data-msg="'+esc(g.key)+'" role="status" aria-live="polite"></p>'+
      (visible.length?'<ul class="word-list">'+visible.map(i=>row(i,g)).join('')+'</ul>':'<p class="empty-state">Every word here is ticked.</p>')+'</div></details>';
  }
  function listsHtml(){
    const all=groups(),html=all.map(groupHtml).join('');
    if(S.classNo&&!all.length)return '<p class="empty-state">This class has no word list yet.</p>';
    if(S.listKey&&!all.length)return '<p class="empty-state">This word list is not available.</p>';
    return html||'<p class="empty-state">'+(S.query?'No word matches your search.':'Every word is ticked. Untick the filter to see them all.')+'</p>';
  }
  function meter(){
    const ids={};const one=oneClass()||oneList();(one?[one]:S.lists).forEach(l=>l.words.forEach(w=>{ids[w.id]=true;}));
    const total=Object.keys(ids).length,known=Object.keys(ids).filter(id=>S.known.has(id)).length;
    return total+' words · '+known+' ticked as known';
  }
  function render(){
    const one=oneClass(),list=oneList();
    if(one)intro.innerHTML='<p class="eyebrow">'+(one.classNo===0?'Trial class':'Class '+pad(one.classNo))+(one.date?' · '+esc(one.date):'')+'</p><h1>Class Words</h1><p class="lead">'+esc(one.title)+'</p><p><a href="../'+esc(one.page)+'/index.html">← Back to the class page</a> · <a href="./index.html">All vocabulary →</a></p>';
    else if(list)intro.innerHTML='<p class="eyebrow">SSAT Upper word bank</p><h1>'+esc(unitLabel(unitById(list.unit)))+'</h1><p><a href="./index.html">← All vocabulary</a></p>';
    const tabs=(S.classNo||S.listKey)?'':'<div class="word-tabs" role="group" aria-label="View">'+[['class','By class'],['unit','Class words by unit'],['theme','Class words by theme'],['bank','SSAT Upper word bank']].map(t=>'<button type="button" class="word-tab" data-view="'+t[0]+'" aria-pressed="'+(S.view===t[0])+'">'+t[1]+'</button>').join('')+'</div>';
    app.innerHTML=tabs+'<div class="word-tools"><label class="word-search">Search<input type="search" data-search placeholder="Search words, meanings, examples" value="'+esc(S.query)+'"></label>'+
      '<label class="word-filter"><input type="checkbox" data-unchecked'+(S.unchecked?' checked':'')+'> Only words I have not ticked</label><p class="word-meter" data-meter>'+meter()+'</p></div>'+
      '<div data-lists>'+listsHtml()+'</div>';
  }
  function redraw(){const box=app.querySelector('[data-lists]');if(box)box.innerHTML=listsHtml();const m=app.querySelector('[data-meter]');if(m)m.textContent=meter();}
  function say(key,text,kind){const m=app.querySelector('[data-msg="'+key+'"]');if(m){m.textContent=text;m.className='word-msg'+(kind?' '+kind:'');}}
  const groupByKey=key=>groups().find(g=>g.key===key);
  // Quizlet import: one card per line, a tab between term and definition.
  function cards(g){const out=[],seen={};g.items.forEach(i=>{const w=i.w;if(!S.known.has(w.id)&&!seen[w.id]){seen[w.id]=true;out.push(w.word+'\t'+(w.pos?w.pos+' ':'')+w.en);}});return out;}
  function copiedNote(g,n){const skipped=g.items.filter(i=>S.known.has(i.w.id)).length;return 'Copied '+n+' card'+(n===1?'':'s')+' for Quizlet'+(skipped?' (skipped '+skipped+' ticked as known)':'')+'. In Quizlet, create a set and choose Import, then paste.';}

  // Updates the page at once, then saves; puts the old ticks back if saving fails.
  function setKnown(ids,known,key){
    const before=new Set(S.known);
    ids.forEach(id=>{if(known)S.known.add(id);else S.known.delete(id);});
    redraw();
    return EmilyAPI.call('wordsSetKnown',{words:ids,known}).then(r=>{S.known=new Set(r.known);redraw();}).catch(e=>{S.known=before;redraw();say(key,'Not saved: '+(e.message||'check your connection and try again.'),'error');});
  }

  app.addEventListener('input',e=>{if(!e.target.matches('[data-search]'))return;S.query=e.target.value.trim().toLowerCase();redraw();});
  app.addEventListener('toggle',e=>{const d=e.target.closest&&e.target.closest('details[data-group]');if(!d||S.query||S.classNo||S.listKey)return;if(d.open)S.open.add(d.dataset.group);else S.open.delete(d.dataset.group);},true);
  app.addEventListener('change',e=>{
    if(e.target.matches('[data-unchecked]')){S.unchecked=e.target.checked;redraw();return;}
    const box=e.target.closest('[data-known]');
    if(box)setKnown([box.dataset.known],box.checked,box.closest('[data-group]').dataset.group);
  });
  app.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.view){S.view=t.dataset.view;try{localStorage.setItem(viewKey,S.view);}catch(_){}render();return;}
    if(t.dataset.retry){load();return;}
    const key=t.dataset.checkall||t.dataset.uncheckall||t.dataset.copy||t.dataset.download;if(!key)return;
    const g=groupByKey(key);if(!g)return;
    if(t.dataset.checkall||t.dataset.uncheckall){
      const on=Boolean(t.dataset.checkall),ids=[];
      g.items.forEach(i=>{if(S.known.has(i.w.id)!==on&&ids.indexOf(i.w.id)<0)ids.push(i.w.id);});
      if(ids.length)setKnown(ids,on,key);
      return;
    }
    const lines=cards(g);
    if(!lines.length){say(key,'Nothing to copy: every word here is ticked as known.');return;}
    if(t.dataset.copy){
      navigator.clipboard.writeText(lines.join('\n')).then(()=>say(key,copiedNote(g,lines.length),'success')).catch(()=>say(key,'Copying is blocked in this browser. Use Download .txt instead.','error'));
    }else{
      const link=document.createElement('a');
      link.href=URL.createObjectURL(new Blob([lines.join('\n')+'\n'],{type:'text/plain;charset=utf-8'}));
      link.download='emily-words-'+key.replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()+'.txt';
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(link.href),2000);
      say(key,'Downloaded '+lines.length+' card'+(lines.length===1?'':'s')+'. Import the file into a Quizlet set.','success');
    }
  });
  window.addEventListener('beforeprint',()=>{app.querySelectorAll('details.word-group').forEach(d=>{d.open=true;});});

  let loading=false;
  async function load(){
    if(!window.EmilyAPI||!EmilyAPI.signedIn()){S.loaded=false;app.innerHTML='<p class="words-status" role="status">Sign in to see your words.</p>';return;}
    if(loading)return;loading=true;app.innerHTML='<p class="words-status" role="status">Loading your words…</p>';
    try{
      try{const v=localStorage.getItem(viewKey);if(['class','unit','theme','bank'].indexOf(v)>=0)S.view=v;}catch(_){}
      const r=await EmilyAPI.call('wordsList');
      if(!EmilyAPI.signedIn())return;
      S.units=r.units;S.themes=r.themes;S.lists=r.lists;S.known=new Set(r.known);S.loaded=true;
      if(S.classNo)document.title=(Number(S.classNo)===0?'Trial class':'Class '+pad(S.classNo))+' Words · Emily SSAT Upper';
      render();
    }catch(e){app.innerHTML='<p class="empty-state">'+esc(e.message||'Your words could not be loaded.')+'</p><button type="button" class="button word-retry" data-retry="1">Try again</button>';}
    finally{loading=false;}
  }
  window.addEventListener('emily-login',load);
  window.addEventListener('emily-logout',()=>{S.lists=[];S.known=new Set();S.loaded=false;app.innerHTML='<p class="words-status" role="status">Signed out.</p>';});
  load();
})();
