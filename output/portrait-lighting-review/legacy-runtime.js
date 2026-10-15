/* Preserve the earlier standalone lighting comparison with the shared lifecycle owner. */
(() => {
  let choice=new URLSearchParams(location.search).get('mode')||'off';
  if(!['before','off','on'].includes(choice))choice='off';
  window.resumeVisualRuntime.setPostProcessing(choice==='on');
  window.addEventListener('resume:portraitready',()=>window.portraitLighting?.setMode(choice));
  document.querySelectorAll('[data-lighting-choice]').forEach(button=>button.addEventListener('click',()=>{
    choice=button.dataset.lightingChoice;
    window.resumeVisualRuntime.setPostProcessing(choice==='on');
    window.portraitLighting?.setMode(choice);
  }));
})();
