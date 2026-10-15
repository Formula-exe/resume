/* Sparse meteors are evaluated at media time, without another animation loop or camera. */
window.resumeVisualRuntime.register('meteors', (scope, quality) => {
  const host = document.getElementById('chapterVisuals'), config = window.RESUME_MUSIC_RESPONSE_CONFIG.meteors;
  if (!host) return;
  const canvas = document.createElement('canvas'); canvas.id = 'musicMeteorCanvas'; canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' }); host.append(canvas);
  const ctx = canvas.getContext('2d'); let width = 0, height = 0, active = [], opacity = 0, painted = false;
  function size() {
    const rect = host.getBoundingClientRect(), dpr = quality.pixelRatio;
    width = rect.width; height = rect.height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function render(time, gain, cues = []) {
    if(scope.signal.aborted || document.hidden)return;
    if (!width || width !== innerWidth || height !== innerHeight) size();
    if (painted) ctx.clearRect(0, 0, width, height);
    active = []; opacity = gain; painted = false;
    if (gain < .0005 || !cues.length) return;
    ctx.save(); ctx.beginPath(); ctx.rect(width * .54, 85, width * .46, Math.max(0, height - 85)); ctx.clip();
    for (const cue of cues) {
      const progress = (time - cue.time) / cue.duration;
      if (progress < 0 || progress >= 1) continue;
      const x = (cue.from[0] + (cue.to[0] - cue.from[0]) * progress) * width, y = (cue.from[1] + (cue.to[1] - cue.from[1]) * progress) * height;
      const dx = (cue.to[0] - cue.from[0]) * width, dy = (cue.to[1] - cue.from[1]) * height, length = Math.hypot(dx, dy);
      const trail = Math.min(110, width * .075, length * .45), tx = x - dx / length * trail, ty = y - dy / length * trail;
      const alpha = Math.sin(Math.PI * progress) ** 1.5 * gain * config.maximumOpacity;
      const gradient = ctx.createLinearGradient(tx, ty, x, y); gradient.addColorStop(0, 'transparent'); gradient.addColorStop(.7, '#94afd6'); gradient.addColorStop(1, '#f5dfc2');
      ctx.globalAlpha = alpha; ctx.strokeStyle = gradient; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 5); halo.addColorStop(0, '#ffe2bc'); halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#fff2dd'; ctx.beginPath(); ctx.arc(x, y, .9, 0, Math.PI * 2); ctx.fill();
      active.push({ time: cue.time, progress, x, y, alpha });
      painted = true;
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  window.resumeMusicEffects = { render, clear: () => render(0, 0), snapshot: () => ({ opacity, active: active.map(item => ({ ...item })), width, height, leftBoundary: .54 }) }; size();
  scope.cleanup(()=>{canvas.width=canvas.height=1;canvas.remove();delete window.resumeMusicEffects;});
  return {pause:()=>{},resume:()=>{},snapshot:()=>({canvasCount:canvas.isConnected?1:0,pixelRatio:quality.pixelRatio})};
}, { keys: ['pixelRatio','mode'] });
