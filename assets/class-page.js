(() => {
  'use strict';
  // Loads a protected class page (registered in the private service) after sign-in and replaces this placeholder with it.
  const pageId=document.documentElement.dataset.page,status=document.getElementById('page-status');let loading=false;
  async function load(){
    if(loading||!window.EmilyAPI||!EmilyAPI.signedIn())return;loading=true;status.textContent='Loading…';
    try{const data=await EmilyAPI.call('classPage',{pageId});document.open();document.write(data.html);document.close();}
    catch(e){status.textContent=e.message;loading=false;}
  }
  window.addEventListener('emily-login',load);load();
})();
