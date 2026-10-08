(() => {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const root = document.documentElement;
  root.dataset.gsap = 'ready';
  let media, refreshFrame;

  function setup() {
    media?.revert();
    media = gsap.matchMedia();
    media.add({ all: '(min-width: 0px)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
      const animate = root.dataset.motion !== 'off' && !context.conditions.reduced;
      // Progress and state feedback never hijack native scrolling.
      gsap.fromTo('.reading-progress', { scaleX: 0 }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: root, start: 0, end: 'max', scrub: true, invalidateOnRefresh: true }
      });
      const timeline = document.querySelector('.timeline');
      if (timeline && animate) gsap.fromTo(timeline, { '--timeline-progress': 0 }, {
        '--timeline-progress': 1, ease: 'none',
        scrollTrigger: { trigger: timeline, start: 'top 78%', end: 'bottom 78%', scrub: true, invalidateOnRefresh: true }
      });
      ScrollTrigger.create({ start: 480, end: 'max', onUpdate: self => document.getElementById('toTop').classList.toggle('show', self.scroll() > 480) });

      if (animate) {
        document.querySelectorAll('.skill-card .bar>i').forEach(bar => {
          gsap.fromTo(bar, { scaleX: 0 }, {
            scaleX: 1, duration: .65, ease: 'power2.out', immediateRender: false,
            scrollTrigger: { trigger: bar, start: 'top 90%', once: true }, clearProps: 'transform'
          });
        });
      }
      context.add('galleryMotion', (card, distance, shouldAnimate) => {
        const vars = {
          xPercent: -50, x: distance * 176, y: Math.abs(distance) * 14, z: -Math.abs(distance) * 55,
          rotationY: -distance * 8, scale: distance === 0 ? 1 : .88,
          autoAlpha: Math.abs(distance) > 3 ? .18 : 1 - Math.abs(distance) * .18,
          overwrite: 'auto', ease: 'power2.out', duration: animate && shouldAnimate ? .42 : 0
        };
        gsap.to(card, vars);
      });
      context.add('tabMotion', () => {
        if (animate) gsap.fromTo('#projectPanels [role="tabpanel"]:not([hidden]) .project', { y: 6, autoAlpha: .7 }, { y: 0, autoAlpha: 1, duration: .28, stagger: .035, overwrite: 'auto', ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
        ScrollTrigger.refresh();
      });
      window.resumeGalleryMotion = context.galleryMotion;
      window.addEventListener('resume:tab', context.tabMotion);
      window.setActiveCertificate(window.activeCertificate ?? 2, false);
      ScrollTrigger.refresh();
      return () => {
        window.removeEventListener('resume:tab', context.tabMotion);
        window.resumeGalleryMotion = undefined;
      };
    });
  }
  function schedule() {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(setup);
  }
  window.addEventListener('resume:render', schedule);
  window.addEventListener('resume:motionchange', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('pagehide', () => { media?.revert(); });
  const printMedia = matchMedia('print');
  printMedia.addEventListener('change', event => { if (event.matches) media?.revert(); else schedule(); });
  setup();
})();
