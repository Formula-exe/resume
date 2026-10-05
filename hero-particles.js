(() => {
  const target = document.getElementById('pageParticles');
  if (!target) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const printMedia = matchMedia('print');
  let container, libraries, loading = false;
  const root = document.documentElement;
  function canAnimate() { return !motion.matches && root.dataset.motion !== 'off'; }
  function palette() { return root.dataset.theme === 'dark' ? '#65dce7' : '#08768b'; }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      const timer = setTimeout(() => { script.remove(); reject(new Error('Particle library load timed out')); }, 10000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Particle library unavailable')); };
      document.head.append(script);
    });
  }

  function syncPlayback() {
    if (!container) return;
    if (!document.hidden && canAnimate() && !printMedia.matches && document.getElementById('imageModal').hidden) container.play();
    else container.pause();
  }

  async function initHeroParticles() {
    if (container || loading || !canAnimate() || navigator.connection?.saveData) return;
    loading = true;
    try {
      libraries ??= (async () => {
        await loadScript('vendor/tsparticles.engine.min.js');
        await loadScript('vendor/tsparticles.slim.bundle.min.js');
        await window.loadSlim(window.tsParticles);
      })();
      await libraries;
      if (!canAnimate()) return;
      const color = palette();
      const instance = await window.tsParticles.load({
        id: target.id,
        options: {
          autoPlay: false, fullScreen: { enable: false },
          fpsLimit: 40,
          detectRetina: false, pauseOnBlur: true, pauseOnOutsideViewport: true,
          resize: { enable: true }, background: { color: 'transparent' },
          particles: {
            paint: { color: { value: color }, fill: { enable: true, color: { value: color } } },
            number: { value: 58, density: { enable: false }, limit: { value: 58 } },
            links: { enable: true, color, distance: 128, opacity: .18, width: 1 },
            move: { enable: true, speed: .55, outModes: { default: 'out' } },
            opacity: { value: { min: .18, max: .5 } },
            shape: { type: 'circle' }, size: { value: { min: 1, max: 2.6 } }
          },
          interactivity: {
            detectsOn: 'window',
            events: { onHover: { enable: true, mode: 'repulse' }, onClick: { enable: true, mode: 'repulse' } },
            modes: { repulse: { distance: 76, duration: .35, speed: .35, factor: 12, maxSpeed: 2 } }
          }
        }
      });
      if (!canAnimate() || color !== palette()) { instance?.destroy(); return; }
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
      if (canAnimate() && libraries && !container) initHeroParticles();
    }
  }

  document.addEventListener('visibilitychange', syncPlayback);
  printMedia.addEventListener('change', syncPlayback);
  window.addEventListener('pagehide', () => container?.pause());
  window.addEventListener('pageshow', syncPlayback);
  function restart() {
    container?.destroy(); container = undefined; target.replaceChildren();
    initHeroParticles();
  }
  window.addEventListener('resume:motionchange', restart);
  new MutationObserver(restart).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(syncPlayback).observe(document.getElementById('imageModal'), { attributes: true, attributeFilter: ['hidden'] });
  // The resume renders independently even when the optional particle library is unavailable.
  initHeroParticles();
})();
