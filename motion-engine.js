if(window.resumeVisualRuntime.settings().mode==='static')window.ScrollTrigger?.disable(false);
window.resumeVisualRuntime.register('motion',(scope,quality)=>{
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.enable();
  const root = document.documentElement;
  root.dataset.gsap = 'ready';
  let media, refreshFrame=0;

  function setup() {
    if(scope.signal.aborted || document.hidden)return;
    media?.revert();
    media = gsap.matchMedia();
    media.add({ all: '(min-width: 0px)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
      const animate = quality.mode==='standard' && root.dataset.motion !== 'off' && !context.conditions.reduced;
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
      window.resumeGalleryMotion = context.galleryMotion;
      window.setActiveCertificate(window.activeCertificate ?? 2, false);
      ScrollTrigger.refresh();
      return () => {
        window.resumeGalleryMotion = undefined;
      };
    });
  }
  function schedule() {
    scope.cancelRaf(refreshFrame);
    if(document.hidden)return;
    refreshFrame = scope.raf(()=>{refreshFrame=0;setup();});
  }
  scope.on(window,'resume:render', schedule);
  scope.on(window,'resume:motionchange', schedule);
  scope.on(window,'resume:projectchange', () => ScrollTrigger.refresh());
  scope.on(window,'pageshow', schedule);
  scope.on(window,'pagehide', () => { media?.revert(); });
  const printMedia = matchMedia('print');
  scope.on(printMedia,'change', event => { if (event.matches) media?.revert(); else schedule(); });
  scope.cleanup(()=>{scope.cancelRaf(refreshFrame);refreshFrame=0;media?.revert();media=null;delete window.resumeGalleryMotion;ScrollTrigger.disable(false);gsap.ticker.sleep();});
  setup();
  return {pause:()=>{scope.cancelRaf(refreshFrame);refreshFrame=0;ScrollTrigger.disable(false);gsap.ticker.sleep();},resume:()=>{ScrollTrigger.enable();gsap.ticker.wake();schedule();},snapshot:()=>({pendingFrames:refreshFrame?1:0,scrollTriggers:ScrollTrigger.getAll().length})};
},{keys:['mode']});
