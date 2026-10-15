import * as THREE from './vendor/three.module.min.js';

window.resumeVisualRuntime.register('signature',async(scope,quality)=>{
const host = document.getElementById('chapterSignature') || document.querySelector('.hero-visual-space');
const config = window.RESUME_SIGNATURE_CONFIG;

if (host && config) {
  let renderer, camera, scene, group, resizeTimer, sampleKey, samples = [], bounds, publicAPI=null;
  const canvas = document.createElement('canvas');
  canvas.id = 'signatureCanvas'; canvas.setAttribute('aria-hidden', 'true');
  const mask = document.createElement('canvas');
  mask.id = 'signatureSamplingCanvas'; mask.hidden = true;
  host.append(canvas, mask);

  function randomSource(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function createTexture(halo) {
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const ctx = sprite.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(halo ? .08 : .6, 'rgba(255,255,255,1)');
    gradient.addColorStop(halo ? .25 : .82, halo ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(sprite);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  let disposed=false;
  scope.cleanup(()=>{
    disposed=true; scope.clearTimeout(resizeTimer); clearPoints();
    pointTexture.dispose();glowTexture.dispose();
    if(renderer){renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();}
    canvas.width=canvas.height=mask.width=mask.height=1;canvas.remove();mask.remove();host.dataset.ready='false';samples=[];
    if(window.resumeSignature===publicAPI)delete window.resumeSignature;
  });
  const pointTexture = createTexture(false), glowTexture = createTexture(true);

  function sampleText() {
    const nextKey = JSON.stringify([config.text, config.seed, config.sampling]);
    if (nextKey === sampleKey) return;
    const spec = config.sampling;
    mask.width = spec.width; mask.height = spec.height;
    const ink = mask.getContext('2d', { willReadFrequently: true });
    ink.translate(mask.width / 2, mask.height / 2);
    ink.rotate(spec.rotation);
    ink.fillStyle = '#fff'; ink.textAlign = 'center'; ink.textBaseline = 'middle';
    ink.font = `${spec.fontSize}px "${spec.fontFamily}", "KaiTi", cursive`;
    ink.fillText(config.text, 0, 0);
    if (spec.flourish) {
      const s = spec.fontSize;
      ink.strokeStyle = '#fff'; ink.lineWidth = s * .009; ink.lineCap = 'round';
      ink.beginPath(); ink.moveTo(-s * 1.38, s * .31);
      ink.bezierCurveTo(-s * 1.53, s * .61, -s * .54, s * .62, s * .2, s * .43); ink.stroke();
    }
    const pixels = ink.getImageData(0, 0, mask.width, mask.height).data;
    samples = [];
    let left = mask.width, top = mask.height, right = 0, bottom = 0;
    for (let y = 0; y < mask.height; y += spec.step) {
      for (let x = 0; x < mask.width; x += spec.step) {
        if (pixels[(y * mask.width + x) * 4 + 3] < spec.alphaThreshold) continue;
        samples.push({ x, y });
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    bounds = { width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    // A seeded shuffle samples all three characters at the same density and is stable on resize.
    const random = randomSource(config.seed);
    for (let i = samples.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [samples[i], samples[j]] = [samples[j], samples[i]];
    }
    samples.forEach(p => { p.x -= cx; p.y = cy - p.y; });
    sampleKey = nextKey;
  }

  function clearPoints() {
    if (!group) return;
    for (const object of [...group.children]) {
      object.geometry.dispose(); object.material.dispose(); group.remove(object);
    }
  }

  function addPoints(positions, colors, size, opacity, texture, halo = false) {
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      map: texture, color: halo ? config.glow.color : '#ffffff',
      vertexColors: !!colors, size, sizeAttenuation: false,
      transparent: true, opacity, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const points = new THREE.Points(geometry, material);
    points.name = halo ? 'signature-soft-highlights' : 'signature-ink-grains';
    group.add(points);
  }

  function render() {
    if (!renderer || scope.signal.aborted || document.hidden) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height || !samples.length) return;
    const mobile = innerWidth <= config.mobile.breakpoint;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.pixelRatio));
    renderer.setSize(width, height, false);
    // Orthographic camera stays fixed: the sampled writing retains its legible proportions.
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    const fit = Math.min(width * config.fit.width / bounds.width, height * config.fit.height / bounds.height) * config.scale;
    group.position.set((config.position.x - .5) * width, (.5 - config.position.y) * height, 0);
    group.scale.setScalar(fit);
    const count = Math.min(samples.length, Math.max(0, Math.floor(quality.signatureParticles)));
    const random = randomSource(config.seed + 19);
    const buckets = Array.from({ length: 3 }, () => ({ positions: [], colors: [] }));
    const highlights = [];
    const palette = config.colors.map(color => new THREE.Color(color));
    for (let i = 0; i < count; i++) {
      const point = samples[i];
      const x = point.x + (random() - .5) * config.sampling.jitter;
      const y = point.y + (random() - .5) * config.sampling.jitter;
      const bucket = buckets[Math.floor(random() * buckets.length)];
      const color = palette[Math.floor(random() * palette.length)].clone();
      color.multiplyScalar(.82 + random() * .18);
      bucket.positions.push(x, y, 0); bucket.colors.push(color.r, color.g, color.b);
      if (random() < config.glow.fraction) highlights.push(x, y, .01);
    }
    clearPoints();
    buckets.forEach((bucket, i) => {
      const size = (config.particleSize[0] + (config.particleSize[1] - config.particleSize[0]) * i / (buckets.length - 1)) * (mobile ? config.mobile.particleSizeScale : 1);
      addPoints(bucket.positions, bucket.colors, size, config.brightness, pointTexture);
    });
    addPoints(highlights, null, config.glow.coreSize * (mobile ? .78 : 1), config.brightness, pointTexture, true);
    addPoints(highlights, null, config.glow.size * (mobile ? .7 : 1), config.glow.brightness * config.brightness, glowTexture, true);
    renderer.render(scene, camera);
    host.dataset.particleCount = String(count);
    host.dataset.brightCount = String(highlights.length / 3);
    host.dataset.signature = config.text;
    host.dataset.ready = 'true';
  }

  const scheduleRender = () => { scope.clearTimeout(resizeTimer); resizeTimer = scope.timeout(render, 100); };
  async function rebuild() {
    try {
      await document.fonts.load(`${config.sampling.fontSize}px "${config.sampling.fontFamily}"`, config.text);
    } catch { /* A system Chinese font is still sampled if the local brush font is unavailable. */ }
    if(scope.signal.aborted)return;
    sampleText(); render();
  }

  async function init() {
    try {
      host.querySelector('.signature-fallback').textContent = config.text;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: quality.antialias, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene(); group = new THREE.Group(); scene.add(group);
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
      camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0);
      await rebuild();
      if(scope.signal.aborted)return;
      if ('ResizeObserver' in window) scope.observe(new ResizeObserver(scheduleRender)).observe(host);
      scope.on(window,'resize', scheduleRender);
      scope.on(window,'pageshow', scheduleRender);
      scope.on(window,'resume:signaturechange', rebuild);
      scope.on(canvas,'webglcontextlost',event=>{event.preventDefault();window.resumeVisualRuntime.fail('signature','WebGL context lost');});

      // Static construction only: no animation loop, clock, controls, or pointer events.
    } catch (error) {
      console.warn('Static particle signature unavailable:', error);
      throw error;
    }
  }
  await init();
  if(scope.signal.aborted)return;
  const snapshot=()=>({disposed,particleCount:Number(host.dataset.particleCount||0),pixelRatio:quality.pixelRatio,buffer:[canvas.width,canvas.height],canvasConnected:canvas.isConnected,
    memory:renderer?{...renderer.info.memory}:null,programs:renderer?.info.programs?.length||0,contextLost:renderer?.getContext().isContextLost()??true});
  publicAPI={snapshot};window.resumeSignature=publicAPI;
  return {pause:()=>scope.clearTimeout(resizeTimer),resume:render,snapshot};
}
},{keys:['pixelRatio','signatureParticles','antialias']});
