/* Fixed-camera, static star composition. HTML owns all text and input. */
window.resumeVisualRuntime.register('starfield', (scope, quality) => {
  const host = document.getElementById('pageParticles');
  const config = window.RESUME_STARFIELD_CONFIG;
  if (!host || !config) return;
  const canvas = document.createElement('canvas');
  canvas.id = 'starfieldCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const reactiveCanvas = document.createElement('canvas');
  reactiveCanvas.id = 'audioStarCanvas';
  reactiveCanvas.setAttribute('aria-hidden', 'true');
  const reactiveCtx = reactiveCanvas.getContext('2d');
  if (!ctx || !reactiveCtx) return;
  const accentCanvas = document.createElement('canvas'); accentCanvas.id = 'musicAccentCanvas'; accentCanvas.setAttribute('aria-hidden', 'true');
  const accentCtx = accentCanvas.getContext('2d');
  host.replaceChildren(canvas, reactiveCanvas, accentCanvas);
  const audioConfig = window.RESUME_AUDIO_STARS_CONFIG;
  const reactiveGroup = audioConfig?.group ?? 'near';
  const peakBrightness = Math.max(1, audioConfig?.maximumBrightness ?? 1);
  let brightness = audioConfig?.baseBrightness ?? 1, counts = {}, geometry = [], renderCount = 0;
  let resizeTimer;
  let accentStrength = 0, accentIndex = -1, accentCache = '', accentPoint = null;

  function setAccent(strength, index) {
    if(scope.signal.aborted)return;
    accentStrength = Math.max(0, Math.min(1, strength)); accentIndex = index;
    const candidates = geometry.filter(point => point.layer === reactiveGroup && point.x > canvas.width / Math.min(devicePixelRatio || 1, quality.pixelRatio) * .54 && point.y > 90);
    const point = candidates.length && index >= 0 ? candidates[index % candidates.length] : null;
    const key = point ? `${renderCount}:${index % candidates.length}` : 'none';
    if (accentCtx && key !== accentCache) {
      accentCache = key; accentPoint = point;
      const dpr = Math.min(devicePixelRatio || 1, quality.pixelRatio);
      accentCtx.setTransform(dpr, 0, 0, dpr, 0, 0); accentCtx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (point) {
        const radius = point.radius + point.glow;
        const gradient = accentCtx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0, point.color); gradient.addColorStop(1, 'transparent');
        accentCtx.fillStyle = gradient; accentCtx.globalAlpha = .45;
        accentCtx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
        accentCtx.globalAlpha = .5; accentCtx.fillStyle = point.color;
        accentCtx.beginPath(); accentCtx.arc(point.x, point.y, point.radius, 0, Math.PI * 2); accentCtx.fill(); accentCtx.globalAlpha = 1;
      }
    }
    accentCanvas.style.opacity = point ? String(accentStrength) : '0';
  }

  function setBrightness(value) {
    if(scope.signal.aborted)return;
    brightness = Math.max(0, Math.min(peakBrightness, value));
    // Both canvases are static cached bitmaps. Only this group's composite opacity changes.
    reactiveCanvas.style.opacity = String(brightness / peakBrightness);
  }

  function randomSource(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  const range = (bounds, random) => bounds[0] + random() * (bounds[1] - bounds[0]);

  function render() {
    if(scope.signal.aborted || document.hidden)return;
    const rect = host.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, quality.pixelRatio);
    for (const [layerCanvas, layerCtx] of [[canvas, ctx], [reactiveCanvas, reactiveCtx], [accentCanvas, accentCtx]]) {
      layerCanvas.width = Math.round(width * dpr); layerCanvas.height = Math.round(height * dpr);
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layerCtx.clearRect(0, 0, width, height);
    }
    const layout = config.composition;
    const mobile = width <= layout.mobileBreakpoint;
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    const reserved = document.querySelector('.hero-visual-space').getBoundingClientRect();
    const clean = { left: copy.left - rect.left - layout.textPadding, right: copy.right - rect.left + layout.textPadding,
      top: copy.top - rect.top - layout.textPadding, bottom: copy.bottom - rect.top + layout.textPadding };
    const density = Math.min(1, Math.max(config.minDensityScale, width * height / config.referenceArea));
    counts = {}; geometry = []; renderCount++;
    // Draw far to near. Each layer has world coordinates and a fixed Z distance.
    for (const layer of [...config.layers].sort((a, b) => b.depth - a.depth)) {
      const drawCtx = layer.name === reactiveGroup ? reactiveCtx : ctx;
      const brightnessFactor = layer.name === reactiveGroup ? peakBrightness : 1;
      const random = randomSource(config.seed + layer.depth * 7919);
      const count = Math.round(layer.count * density * quality.starCountScale);
      const planeDepth = config.camera.nearDepth + layer.depth * config.layerDistance;
      const planeScale = config.camera.focalLength / planeDepth;
      let drawn = 0;
      for (let i = 0; i < count; i++) {
        const u = random(), v = random();
        const z = planeDepth + (random() - .5) * config.layerDistance * config.depthSpread;
        const scale = config.camera.focalLength / z;
        const worldX = (u - .5) * width / planeScale;
        const worldY = (v - .5) * height / planeScale;
        const x = width * .5 + worldX * scale, y = height * .5 + worldY * scale;
        const radius = range(layer.size, random) * scale;
        let alpha = range(layer.brightness, random);
        const keep = random();
        if (x < 0 || x > width || y < 0 || y > height) continue;
        // No star core or halo enters the actual HTML text area.
        const margin = radius + layer.glow;
        if (x > clean.left - margin && x < clean.right + margin && y > clean.top - margin && y < clean.bottom + margin) continue;
        if (!mobile && x / width < layout.textZoneEnd) {
          if (keep > layout.textDensity) continue;
          alpha *= layout.textBrightness;
        }
        const zone = layout.visualZone;
        const centerX = mobile ? (reserved.left - rect.left + reserved.width * .5) / width : zone.x;
        const centerY = mobile ? (reserved.top - rect.top + reserved.height * .5) / height : zone.y;
        const ry = mobile ? reserved.height * .42 / height : zone.radiusY;
        const inReserved = Math.pow((x / width - centerX) / zone.radiusX, 2) + Math.pow((y / height - centerY) / ry, 2) < 1;
        if (inReserved) {
          if (keep > layout.visualDensity) continue;
          alpha *= layout.visualBrightness;
        }
        geometry.push({ layer: layer.name, x, y, radius, alpha, color: layer.color, glow: layer.glow });
        if (layer.glow) {
          const glowRadius = radius + layer.glow;
          const glow = drawCtx.createRadialGradient(x, y, 0, x, y, glowRadius);
          glow.addColorStop(0, layer.color); glow.addColorStop(1, 'transparent');
          drawCtx.globalAlpha = Math.min(1, alpha * brightnessFactor * .16); drawCtx.fillStyle = glow;
          drawCtx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
        }
        drawCtx.globalAlpha = Math.min(1, alpha * brightnessFactor); drawCtx.fillStyle = layer.color;
        drawCtx.beginPath(); drawCtx.arc(x, y, radius, 0, Math.PI * 2); drawCtx.fill();
        drawn++;
      }
      counts[layer.name] = drawn;
    }
    ctx.globalAlpha = reactiveCtx.globalAlpha = 1;
    setBrightness(brightness);
    accentCache = ''; setAccent(accentStrength, accentIndex);
    host.dataset.layers = JSON.stringify(counts);
    host.dataset.ready = 'true';
  }

  function formatTitle() {
    const title = document.getElementById('heroTitle');
    const text = title.textContent;
    const separator = text.includes('｜') ? '｜' : ' | ';
    const parts = text.split(separator);
    if (parts.length !== 2) return;
    const first = document.createElement('span'), second = document.createElement('span'), divider = document.createElement('span');
    first.className = second.className = 'hero-title-line'; divider.className = 'hero-title-divider';
    first.textContent = parts[0]; second.textContent = parts[1]; divider.textContent = separator;
    title.replaceChildren(first, divider, second);
  }

  // Resample only when layout/palette changes. Audio never redraws or moves stars.
  const scheduleRender = () => { scope.clearTimeout(resizeTimer); resizeTimer = scope.timeout(render, 100); };
  if ('ResizeObserver' in window) scope.observe(new ResizeObserver(scheduleRender)).observe(host);
  scope.on(window, 'resize', scheduleRender);
  scope.on(window, 'pageshow', scheduleRender);
  scope.on(window, 'resume:starfieldpalette', scheduleRender);
  scope.on(window, 'resume:render', () => { formatTitle(); scheduleRender(); });
  document.fonts?.ready.then(scheduleRender);
  window.resumeStarfield = {
    setBrightness, setAccent,
    snapshot: () => ({ reactiveGroup, brightness, peakBrightness, counts: { ...counts }, renderCount,
      accent: { strength: accentStrength, index: accentIndex, point: accentPoint ? { ...accentPoint } : null },
      geometry: geometry.map(point => ({ ...point })) })
  };
  scope.cleanup(()=>{[canvas,reactiveCanvas,accentCanvas].forEach(layer=>{layer.width=layer.height=1;layer.remove();});host.dataset.ready='false';geometry=[];delete window.resumeStarfield;});
  formatTitle(); render();
  return {pause:()=>{scope.clearTimeout(resizeTimer);},resume:render,snapshot:()=>({canvasCount:canvas.isConnected?3:0,renderCount,pixelRatio:quality.pixelRatio,counts:{...counts}})};
}, { keys: ['pixelRatio','starCountScale'] });
