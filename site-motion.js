(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true, frame = 0, skillObserver;
  try { enabled = localStorage.getItem('resume-motion') !== 'off'; } catch {}
  const motionButton = document.createElement('button');
  motionButton.type = 'button';
  motionButton.id = 'motionToggle';
  motionButton.className = 'icon-btn';
  document.querySelector('.nav-actions').insertBefore(motionButton, document.getElementById('printBtn'));

  function labels() {
    const en = root.lang === 'en';
    const active = enabled && !reduced.matches;
    motionButton.textContent = active ? '≈' : 'Ⅱ';
    motionButton.setAttribute('aria-pressed', String(active));
    const label = reduced.matches ? (en ? 'Motion disabled by system preference' : '系统已设置减少动态效果') : active ? (en ? 'Pause animations' : '暂停动效') : (en ? 'Enable animations' : '开启动效');
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    motionButton.disabled = reduced.matches;
    document.querySelector('.skip-link').textContent = en ? 'Skip to resume' : '跳至简历内容';
    const controls = document.querySelector('.gallery-controls');
    if (controls) {
      controls.querySelector('[data-gallery="prev"]').setAttribute('aria-label', en ? 'Previous certificate' : '上一张证书');
      controls.querySelector('[data-gallery="next"]').setAttribute('aria-label', en ? 'Next certificate' : '下一张证书');
      controls.querySelector('.gallery-preview').textContent = en ? 'View certificate' : '查看大图';
    }
    document.querySelector('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#071b30' : '#edf5fa';
  }

  function updateMotion() {
    root.dataset.motion = enabled && !reduced.matches ? 'on' : 'off';
    labels();
    initSkills();
    scheduleScroll();
    window.dispatchEvent(new Event('resume:motionchange'));
  }
  motionButton.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem('resume-motion', enabled ? 'on' : 'off'); } catch {}
    updateMotion();
  });
  reduced.addEventListener('change', updateMotion);

  function initSkills() {
    skillObserver?.disconnect();
    const cards = document.querySelectorAll('.skill-card');
    if (root.dataset.motion === 'off' || !('IntersectionObserver' in window)) {
      cards.forEach(card => card.classList.add('is-visible'));
      return;
    }
    skillObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          skillObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .15 });
    cards.forEach(card => skillObserver.observe(card));
  }

  function updateScroll() {
    frame = 0;
    const height = root.scrollHeight - window.innerHeight;
    const progress = height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 1;
    const timeline = document.querySelector('.timeline');
    const rect = timeline?.getBoundingClientRect();
    const line = rect ? Math.min(1, Math.max(0, (innerHeight * .78 - rect.top) / rect.height)) : 0;
    root.style.setProperty('--reading-progress', progress.toFixed(4));
    timeline?.style.setProperty('--timeline-progress', line.toFixed(4));
  }
  function scheduleScroll() {
    if (!frame) frame = requestAnimationFrame(updateScroll);
  }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', scheduleScroll, { passive: true });

  const controls = document.createElement('div');
  controls.className = 'gallery-controls';
  controls.innerHTML = '<button type="button" data-gallery="prev"><span aria-hidden="true">‹</span></button><span class="gallery-position" role="status" aria-live="polite"></span><button type="button" data-gallery="next"><span aria-hidden="true">›</span></button><button type="button" class="gallery-preview"></button>';
  document.getElementById('gallery').after(controls);
  function updateCertificate() {
    const count = document.querySelectorAll('.gallery-card').length;
    controls.querySelector('.gallery-position').textContent = `${(window.activeCertificate ?? 0) + 1} / ${count}`;
    controls.querySelector('.gallery-preview').disabled = count === 0;
  }
  controls.addEventListener('click', event => {
    const direction = event.target.closest('[data-gallery]')?.dataset.gallery;
    if (direction) window.setActiveCertificate((window.activeCertificate ?? 0) + (direction === 'next' ? 1 : -1));
    if (event.target.closest('.gallery-preview')) {
      const image = document.querySelector('.gallery-card.active img');
      if (image) window.openModal(image.src, image.alt);
    }
  });
  const gallery = document.getElementById('gallery');
  let touchStart;
  gallery.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') touchStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  gallery.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
    touchStart = undefined;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      window.setActiveCertificate((window.activeCertificate ?? 0) + (dx < 0 ? 1 : -1));
      // Suppress the click produced by this swipe, not normal certificate taps.
      const suppressClick = e => { e.preventDefault(); e.stopImmediatePropagation(); };
      gallery.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => gallery.removeEventListener('click', suppressClick, true), 350);
    }
  }, { passive: true });
  gallery.addEventListener('pointercancel', () => { touchStart = undefined; });
  gallery.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    window.setActiveCertificate((window.activeCertificate ?? 0) + (event.key === 'ArrowRight' ? 1 : -1));
    gallery.querySelector('.gallery-card.active')?.focus({ preventScroll: true });
  });

  const main = document.querySelector('main');
  let glowFrame = 0, glowCard, glowPoint;
  function glow(event) {
    if (root.dataset.motion === 'off') return;
    const card = event.target.closest('.card');
    if (!card) return;
    if (glowCard !== card) { glowCard?.classList.remove('is-interacting'); glowCard = card; }
    glowPoint = { x: event.clientX, y: event.clientY };
    if (!glowFrame) glowFrame = requestAnimationFrame(() => {
      glowFrame = 0;
      if (!glowCard?.isConnected || root.dataset.motion === 'off') return;
      const rect = glowCard.getBoundingClientRect();
      glowCard.style.setProperty('--glow-x', `${glowPoint.x - rect.left}px`);
      glowCard.style.setProperty('--glow-y', `${glowPoint.y - rect.top}px`);
      glowCard.classList.add('is-interacting');
    });
  }
  main.addEventListener('pointermove', glow, { passive: true });
  main.addEventListener('pointerdown', glow, { passive: true });
  main.addEventListener('pointerout', event => {
    if (glowCard && !glowCard.contains(event.relatedTarget)) glowCard.classList.remove('is-interacting');
  });
  main.addEventListener('pointerup', event => {
    if (event.pointerType !== 'mouse') setTimeout(() => glowCard?.classList.remove('is-interacting'), 250);
  }, { passive: true });
  window.addEventListener('resume:render', () => { labels(); initSkills(); updateCertificate(); scheduleScroll(); });
  window.addEventListener('resume:certificate', updateCertificate);
  new MutationObserver(labels).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  updateMotion();
  updateCertificate();
})();
