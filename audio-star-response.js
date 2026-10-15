/* One visual update consumes live RMS, offline features and authored media-time cues. */
window.resumeVisualRuntime.register('music-visuals', (scope) => {
  const config = window.RESUME_AUDIO_STARS_CONFIG, music = window.RESUME_MUSIC_RESPONSE_CONFIG;
  const stars = {setBrightness:value=>window.resumeStarfield?.setBrightness(value),setAccent:(value,index)=>window.resumeStarfield?.setAccent(value,index)}, control = window.resumeAudioControl, meter = window.resumeAudioMeter;
  const analysis = window.resumeMusicAnalysis, effects = {render:(...args)=>window.resumeMusicEffects?.render(...args),clear:()=>window.resumeMusicEffects?.clear()};
  const button = document.getElementById('audioStarsToggle'), root = document.documentElement;
  if (!config || !stars || !control || !meter || !button || !analysis || !effects) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), printMedia = matchMedia('print');
  const query = new URLSearchParams(location.search).get('audioStars');
  let preference = null; try { preference = localStorage.getItem('resume-audio-stars'); } catch {}
  let requested = query === 'off' ? false : query === 'on' ? true : preference ? preference !== 'off' : config.enabled;
  const clamp = value => Math.min(config.maximumBrightness, Math.max(config.minimumBrightness, value));
  const base = () => clamp(config.baseBrightness), section = () => root.dataset.chapter || 'top';
  const sectionGain = id => config.sectionGain[id] ?? config.readingGain;
  const allowed = () => !scope.signal.aborted && window.resumeVisualRuntime.animationsAllowed() && requested && !reduced.matches && root.dataset.motion !== 'off';
  const neutral = () => ({ brightness: base(), energy: 0, accent: 0, arrangement: 0, height: .5, meteor: 0 });
  let current = neutral(), target = neutral(), inputRms = 0, feature = analysis.sample();
  let frame = 0, previousTime = null, lastDeltaTime = 0, updateCount = 0, lastMediaTime = null, lastPortraitTime = -Infinity;
  const statusNode = document.createElement('span'); statusNode.id = 'musicPhaseStatus'; statusNode.className = 'audio-meter-status';
  document.getElementById('musicPhaseStatus')?.remove(); button.after(statusNode); button.setAttribute('aria-controls', 'audioStarCanvas musicAccentCanvas portraitBase musicMeteorCanvas');
  function mapRms(rms, id = section()) { return clamp(base() + Math.max(0, rms) * config.gain * sectionGain(id)); }
  function approach(value, goal, deltaTime, paused = false, speed = config.smoothingSpeed) {
    const dt = Math.min(config.maxDeltaTime, Math.max(0, Number.isFinite(deltaTime) ? deltaTime : 0));
    const result = value + (goal - value) * -Math.expm1(-(paused ? config.pauseSmoothingSpeed : speed) * dt);
    return Math.abs(result - goal) < config.settleEpsilon ? goal : result;
  }
  function labels() {
    const en = root.lang.startsWith('en'), unavailable = reduced.matches || root.dataset.motion === 'off' || window.resumeVisualRuntime.settings().mode==='static';
    button.disabled = unavailable; button.setAttribute('aria-pressed', String(allowed()));
    button.textContent = unavailable ? (en ? 'Motion reduced · visuals off' : '减少动效 · 联动关闭') :
      en ? 'Music visuals: ' + (requested ? 'on' : 'off') : '音乐视觉：' + (requested ? '开' : '关');
    button.title = en ? 'Toggle music visuals; keep the same music playing' : '切换音乐视觉，保持当前音乐继续播放';
    meter.setVisualEnabled(allowed());
  }
  function phaseLabel() {
    const info = analysis.snapshot(), en = root.lang.startsWith('en');
    if(!allowed()){statusNode.textContent=en?'Static visuals · music stays available':'静态视觉 · 音乐仍可播放';return;}
    const phases = { intro: 'Opening', build: 'Rising', burst: 'Bloom', flow: 'Flow', rest: 'Rest', outro: 'Coda' };
    const value = info.status === 'ready' ? window.RESUME_AUDIO_CONFIG.title + ' · ' + (en ? phases[feature.phase?.kind] || 'Playing' : feature.phase?.label || '已就绪') :
      info.status === 'ready-uncalibrated' ? (en ? 'New track analysed · timeline needs calibration' : '新曲已分析 · 编排待校准') :
      info.status === 'error' ? (en ? 'Offline analysis unavailable · live response kept' : '预分析暂不可用 · 保留实时响应') :
      info.status === 'idle' ? (en ? 'Visuals ready on playback' : '播放后启用音乐视觉') : (en ? 'Preparing music visuals' : '正在准备音乐视觉');
    if (statusNode.textContent !== value) statusNode.textContent = value;
  }
  function paint(timestamp = performance.now(), force = false) {
    stars.setBrightness(current.brightness); stars.setAccent(current.accent, feature.onsetIndex);
    const portraitEnergy = Math.min(music.mapping.portraitMaximum, current.energy * .85 + current.arrangement * .2 + current.accent * .15);
    if (force || timestamp - lastPortraitTime >= 1000 / (window.resumeVisualRuntime.settings().portraitFps || 1)) {
      window.portraitLighting?.setAudioResponse?.(portraitEnergy, current.height); lastPortraitTime = timestamp;
    }
    effects.render(control.audio.currentTime, current.meteor, feature.meteors); phaseLabel();
  }
  function stop() { scope.cancelRaf(frame); frame = 0; previousTime = null; }
  function reset() {
    stop(); current = neutral(); target = neutral(); inputRms = 0; lastMediaTime = null;
    stars.setBrightness(base()); stars.setAccent(0, -1); effects.clear();
    window.portraitLighting?.setAudioResponse?.(0, .5); phaseLabel();
  }
  function unsettled() { return Object.keys(current).some(key => key !== 'height' && current[key] !== target[key]); }
  function update(timestamp) {
    frame = 0;
    if(previousTime!==null && timestamp-previousTime<1000/(window.resumeVisualRuntime.settings().visualFps||1)){frame=scope.raf(update);return;}
    if (document.hidden || printMedia.matches) { previousTime = null; return; }
    if (!allowed()) { reset(); return; }
    const playing = control.snapshot().actualPlaying, mediaTime = control.audio.currentTime;
    feature = analysis.sample(mediaTime);
    if (lastMediaTime !== null && Math.abs(mediaTime - lastMediaTime) > music.mapping.seekThreshold) {
      current = neutral(); current.height = .82 - feature.register * .66; previousTime = null;
    }
    lastMediaTime = mediaTime; inputRms = playing ? meter.snapshot().rms : 0;
    const gain = sectionGain(section()), energy = playing ? feature.energy : 0, accent = playing ? feature.onset : 0, arrangement = playing ? feature.arrangement : 0;
    target = {
      brightness: playing ? clamp(base() + gain * (inputRms * config.gain + energy * music.mapping.energyGain + accent * music.mapping.onsetGain + arrangement * music.mapping.arrangementGain)) : base(),
      energy: energy * gain, accent: accent * gain, arrangement: arrangement * gain,
      height: playing && feature.available ? .82 - feature.register * .66 : current.height,
      meteor: playing && feature.calibrated && gain >= music.meteors.minimumSectionGain ? 1 : 0
    };
    lastDeltaTime = previousTime === null ? 0 : Math.min(config.maxDeltaTime, Math.max(0, (timestamp - previousTime) / 1000)); previousTime = timestamp;
    for (const key of Object.keys(current)) current[key] = approach(current[key], target[key], lastDeltaTime, !playing,
      key === 'brightness' ? config.smoothingSpeed : key === 'height' ? music.mapping.heightSpeed : music.mapping.responseSpeed);
    updateCount++; paint(timestamp, !playing && !unsettled());
    if (playing || unsettled()) frame = scope.raf(update); else previousTime = null;
  }
  function schedule() {
    labels(); phaseLabel();
    if (!allowed() || printMedia.matches) { reset(); return; }
    if (!frame && !document.hidden && (control.snapshot().actualPlaying || current.brightness !== base() || current.energy || current.accent || current.arrangement || current.meteor)) frame = scope.raf(update);
  }
  function setEnabled(value) { requested = !!value; try { localStorage.setItem('resume-audio-stars', requested ? 'on' : 'off'); } catch {} schedule(); }
  scope.on(button, 'click', () => setEnabled(!requested));
  for (const event of ['resume:audiostate', 'resume:motionchange', 'resume:render', 'resume:musicanalysis']) scope.on(window, event, schedule);
  scope.on(window, 'resume:portraitready', () => { paint(performance.now(), true); schedule(); });
  scope.on(control.audio, 'seeking', () => { current = neutral(); previousTime = null; lastMediaTime = null; paint(performance.now(), true); });
  scope.on(document, 'visibilitychange', () => { if (document.hidden) stop(); else schedule(); });
  scope.on(window, 'pagehide', reset); scope.on(window, 'pageshow', schedule);
  scope.on(reduced, 'change', schedule); scope.on(printMedia, 'change', schedule);
  window.resumeAudioStars = { setEnabled, mapRms, approach,
    snapshot: () => ({ requested, enabled: allowed(), reducedMotion: reduced.matches, section: section(), sectionGain: sectionGain(section()), rms: inputRms,
      currentBrightness: current.brightness, targetBrightness: target.brightness, baseBrightness: base(), current: { ...current }, target: { ...target },
      features: { ...feature, meteors: feature.meteors.map(cue => ({ ...cue })) }, pendingFrames: frame ? 1 : 0, lastDeltaTime, updateCount }) };
  scope.on(window,'resume:qualitychange',schedule);scope.on(window,'resume:visualready',()=>{paint(performance.now(),true);schedule();});
  scope.cleanup(()=>{reset();meter.setVisualEnabled(false);statusNode.remove();if(window.resumeAudioStars?.setEnabled===setEnabled)delete window.resumeAudioStars;});
  reset(); schedule();
  return {pause:stop,resume:schedule,snapshot:()=>({pendingFrames:frame?1:0,updateCount})};
},{decorative:false,keys:[]});
