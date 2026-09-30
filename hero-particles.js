(() => {
  const target = document.getElementById('heroParticles');
  if (!target) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const printMedia = matchMedia('print');
  const smallScreen = matchMedia('(max-width: 760px)');
  let container, libraries, loading = false, inView = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      const timer = setTimeout(() => reject(new Error('Particle library load timed out')), 10000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Particle library unavailable')); };
      document.head.append(script);
    });
  }

  function syncPlayback() {
    if (!container) return;
    if (inView && !document.hidden && !motion.matches && !printMedia.matches) container.play();
    else container.pause();
  }

  async function initHeroParticles() {
    if (container || loading || motion.matches || navigator.connection?.saveData) return;
    loading = true;
    try {
      libraries ??= (async () => {
        await loadScript('https://cdn.jsdelivr.net/npm/@tsparticles/engine@4.4.0/tsparticles.engine.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@tsparticles/slim@4.4.0/tsparticles.slim.bundle.min.js');
        await window.loadSlim(window.tsParticles);
      })();
      await libraries;
      if (motion.matches) return;
      const mobile = smallScreen.matches;
      const instance = await window.tsParticles.load({
        id: target.id,
        options: {
          autoPlay: false, fullScreen: { enable: false },
          fpsLimit: mobile || navigator.hardwareConcurrency <= 4 ? 30 : 40,
          detectRetina: false, pauseOnBlur: true, pauseOnOutsideViewport: true,
          resize: { enable: true }, background: { color: 'transparent' },
          particles: {
            color: { value: '#6ee7f2' },
            number: { value: mobile ? 24 : 52, density: { enable: !mobile, width: 1120, height: 580 }, limit: { value: 64 } },
            links: { enable: true, color: '#35c9d8', distance: mobile ? 96 : 128, opacity: .22, width: 1 },
            move: { enable: true, speed: .55, outModes: { default: 'out' } },
            opacity: { value: { min: .18, max: .5 } },
            shape: { type: 'circle' }, size: { value: { min: 1, max: 2.6 } }
          },
          interactivity: {
            detectsOn: 'window',
            events: { onHover: { enable: matchMedia('(hover: hover) and (pointer: fine)').matches, mode: 'repulse' }, onClick: { enable: false } },
            modes: { repulse: { distance: 76, duration: .35, speed: .35, factor: 12, maxSpeed: 2 } }
          }
        }
      });
      if (motion.matches || mobile !== smallScreen.matches) { instance?.destroy(); return; }
      container = instance;
      syncPlayback();
    } catch {
      container?.destroy();
      container = undefined;
      target.replaceChildren();
      libraries = undefined;
    } finally {
      loading = false;
      // A preference can change again while a previous initialization is pending.
      if (!motion.matches && libraries && !container) initHeroParticles();
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: .05 }).observe(target);
  } else inView = true;
  document.addEventListener('visibilitychange', syncPlayback);
  printMedia.addEventListener('change', syncPlayback);
  smallScreen.addEventListener('change', () => {
    container?.destroy(); container = undefined;
    initHeroParticles();
  });
  window.addEventListener('pagehide', () => container?.pause());
  window.addEventListener('pageshow', syncPlayback);
  motion.addEventListener('change', () => {
    if (motion.matches) { container?.destroy(); container = undefined; target.replaceChildren(); }
    else initHeroParticles();
  });
  // The resume renders independently even when the optional CDN is unavailable.
  initHeroParticles();
})();
