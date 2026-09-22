(() => {
  'use strict';
  const root=document.getElementById('practice-catalog'),status=document.getElementById('practice-status');let epoch=0;
  const el=(tag,text)=>{const x=document.createElement(tag);x.textContent=text;return x;};
  async function load(){
    const generation=++epoch;if(!EmilyAPI.signedIn())return;
    status.textContent='Loading your practice…';
    try{const data=await EmilyAPI.call('practiceCatalog');if(generation!==epoch||!EmilyAPI.signedIn())return;root.replaceChildren();
      data.sets.forEach(set=>{const card=el('section','');card.className='mock-set';card.append(el('p',set.levelLabel),el('h2',set.title));const sections=el('div','');sections.className='mock-sections';
        set.sections.forEach(s=>{const box=el('section','');box.className='mock-section';box.append(el('h3',s.section));box.append(el('p',s.kind==='mock_writing'?'Written response · teacher review':s.availability!=='ready'?'Reading and verbal practice':s.itemCount+(s.sourceItemCount>s.itemCount?' of '+s.sourceItemCount+' questions available':' questions')));
          if(s.availability==='ready'){const a=el('a',s.state==='submitted'?'Open submitted work':s.state==='draft'?'Continue section':'Start section');a.className='button';a.href='mock.html?assignment='+encodeURIComponent(s.assignmentId);box.append(a);}
          else box.append(el('p',s.availability==='missing_source'?'Not included in this set.':'Not available yet.'));sections.append(box);});card.append(sections);root.append(card);});
      status.textContent=data.sets.length?'Choose a section below.':'No mock sections are available yet.';
    }catch(e){if(generation===epoch)status.textContent=e.message;}
  }
  window.addEventListener('emily-login',load);window.addEventListener('emily-logout',()=>{epoch++;root.replaceChildren();status.textContent='Sign in to open your practice.';});document.getElementById('refresh-practice').onclick=load;load();
})();
