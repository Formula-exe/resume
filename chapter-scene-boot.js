/* Construct decorative layers before the existing, static Three.js modules initialize. */
(() => {
  if(!window.RESUME_CHAPTER_CONFIG)return;
  if(document.getElementById('chapterVisuals'))return;
  const root=document.documentElement;
  root.dataset.chapterScene='ready';
  const scene=document.createElement('div');scene.id='chapterVisuals';scene.setAttribute('aria-hidden','true');
  const stars=document.getElementById('pageParticles');scene.append(stars);
  const actors=document.createElement('div');actors.id='chapterActors';
  const signature=document.createElement('div');signature.id='chapterSignature';signature.className='chapter-actor hero-visual-space';
  signature.innerHTML='<span class="signature-fallback">张名宇</span><img class="visual-static-image" src="assets/visual-fallback/signature.png" alt="">';
  signature.querySelector('img').addEventListener('load',()=>signature.dataset.fallbackReady='true');
  const portrait=document.createElement('div');portrait.id='chapterPortrait';portrait.className='chapter-actor hero-visual-space';
  const fallback=document.createElement('img');fallback.className='portrait-fallback visual-static-image';fallback.src='assets/visual-fallback/portrait.png';fallback.alt='';portrait.append(fallback);
  actors.append(signature,portrait);scene.append(actors);document.body.prepend(scene);
  root.style.setProperty('--chapter-signature-opacity','0');root.style.setProperty('--chapter-portrait-opacity','0');
  // Expose only real resume details already rendered by the page.
  function renderExtraContent(){
    const en=root.lang==='en';
    document.getElementById('aboutTitle').textContent=en?'About me':'关于我';
    document.getElementById('aboutSummary').textContent=document.getElementById('heroSummary').textContent;
    document.getElementById('aboutExperienceLink').textContent=en?'Learning and practice':'学习与实践';
    document.getElementById('contactTitle').textContent=en?'Contact':'联系';
    document.getElementById('contactPhone').href=document.getElementById('phoneBtn').href;
    document.getElementById('contactPhone').textContent=document.getElementById('phoneText').textContent;
    document.getElementById('contactEmail').textContent=document.getElementById('emailAction').textContent;
    document.querySelectorAll('[data-chapter-nav="about"]').forEach(link=>link.textContent=en?'About':'关于');
    document.querySelectorAll('[data-chapter-nav="contact"]').forEach(link=>link.textContent=en?'Contact':'联系');
  }
  document.getElementById('contactEmail').addEventListener('click',()=>document.getElementById('copyEmail').click());
  window.addEventListener('resume:render',renderExtraContent);renderExtraContent();
})();
