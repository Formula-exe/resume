(() => {
  const root = document.documentElement;
  const mobile = matchMedia('(max-width: 760px)');
  const icon = name => {
    const span = document.createElement('span');
    span.className = 'ui-icon';
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--icon-url', `url("vendor/icons/${name}.svg")`);
    return span;
  };
  const replaceIcon = (target, name) => { if (target) target.replaceChildren(icon(name)); };
  const menuButton = document.getElementById('menuToggle') || document.createElement('button');
  menuButton.id = 'menuToggle';
  menuButton.type = 'button';
  menuButton.className = 'icon-btn menu-toggle';
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-controls', 'mobileNav');
  document.querySelector('.nav-actions').append(menuButton);
  const menu = document.createElement('div');
  menu.id = 'mobileNav';
  menu.className = 'mobile-menu';
  menu.hidden = true;
  document.querySelectorAll('.nav-links a').forEach(link => menu.append(link.cloneNode(true)));
  const mobilePrint = document.createElement('button');
  mobilePrint.className = 'mobile-print';
  mobilePrint.type = 'button';
  menu.append(mobilePrint);
  document.querySelector('.nav').append(menu);

  function toggleMenu(open, restoreFocus = false) {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    replaceIcon(menuButton, open ? 'x' : 'list');
    menuButton.setAttribute('aria-label', root.lang === 'en' ? (open ? 'Close navigation' : 'Open navigation') : (open ? '收起导航' : '展开导航'));
    if (restoreFocus) menuButton.focus({ preventScroll: true });
  }
  menuButton.addEventListener('click', () => toggleMenu(menu.hidden));
  menu.addEventListener('click', event => { if (event.target.closest('a')) toggleMenu(false); });
  mobilePrint.addEventListener('click', () => { toggleMenu(false); document.getElementById('printBtn').click(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) toggleMenu(false, true);
    if (event.key === 'Tab' && !document.getElementById('imageModal').hidden) {
      event.preventDefault(); document.getElementById('modalClose').focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !event.target.closest('.nav')) toggleMenu(false);
  }, { passive: true });
  mobile.addEventListener('change', () => toggleMenu(false));

  function decorate() {
    const en = root.lang === 'en';
    replaceIcon(document.getElementById('themeToggle'), root.dataset.theme === 'dark' ? 'sun' : 'moon');
    const themeLabel = en ? (root.dataset.theme === 'dark' ? 'Use light theme' : 'Use dark theme') : (root.dataset.theme === 'dark' ? '切换浅色主题' : '切换深色主题');
    document.getElementById('themeToggle').setAttribute('aria-label', themeLabel);
    document.getElementById('themeToggle').title = themeLabel;
    replaceIcon(document.getElementById('motionToggle'), root.dataset.motion === 'off' ? 'play' : 'pause');
    replaceIcon(document.querySelector('#printBtn > span:first-child'), 'printer');
    replaceIcon(document.querySelector('#phoneBtn > span:first-child'), 'phone');
    replaceIcon(document.querySelector('#copyEmail > span:first-child'), 'envelope');
    replaceIcon(document.getElementById('toTop'), 'arrow-up');
    replaceIcon(document.getElementById('modalClose'), 'x');
    replaceIcon(document.querySelector('[data-gallery="prev"] > span'), 'caret-left');
    replaceIcon(document.querySelector('[data-gallery="next"] > span'), 'caret-right');
    document.querySelector('.print-label').textContent = en ? 'Print resume' : '打印简历';
    mobilePrint.replaceChildren(icon('printer'), document.createTextNode(en ? 'Print resume' : '打印简历'));
    document.getElementById('langToggle').setAttribute('aria-label', en ? '中 — Switch to Chinese' : 'EN — Switch to English');
    document.getElementById('modalClose').setAttribute('aria-label', en ? 'Close certificate preview' : '关闭证书预览');
    document.getElementById('toTop').setAttribute('aria-label', en ? 'Back to top' : '返回顶部');
    let note = document.getElementById('skillAssessmentNote');
    if (!note) { note = document.createElement('p'); note.id = 'skillAssessmentNote'; document.getElementById('skillsTitle').after(note); }
    note.textContent = en ? 'Proficiency levels are a personal self-assessment.' : '熟悉度为个人自评。';
    document.querySelectorAll('.gallery-card img').forEach(image => { image.width = 900; image.height = 600; image.decoding = 'async'; });
    document.querySelectorAll('.metric.clickable').forEach(metric => {
      metric.setAttribute('aria-label', metric.textContent + (en ? '. View related certificates' : '，查看对应证书'));
    });
    toggleMenu(!menu.hidden);
  }
  window.addEventListener('resume:render', decorate);
  window.addEventListener('resume:motionchange', decorate);
  new MutationObserver(decorate).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  if ('IntersectionObserver' in window) {
    const sections = document.querySelectorAll('main>section[id]');
    // A single observer watches all section anchors.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        document.querySelectorAll('.nav-links a,.mobile-menu a').forEach(link => {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-15% 0px -60% 0px' });
    sections.forEach(section => observer.observe(section));
  }
  decorate();
})();
