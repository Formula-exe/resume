/* Idempotent owners for decorative resources. HTML and audio output are independent. */
(() => {
  if (window.resumeVisualRuntime) { window.resumeVisualRuntime.init(); return; }
  const config = window.RESUME_VISUAL_CONFIG, root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), mobile = matchMedia(`(max-width:${config.mobileBreakpoint}px), (pointer:coarse) and (max-width:${config.mobileLandscapeBreakpoint}px)`);
  const entries = new Map(), scopes = new Set();
  let active = false, listeners = null, failure = null, settings = null, mounts = 0, unmounts = 0;
  let selected = config.defaultMode, postRequested = config.defaultPostProcessing;
  try { selected = localStorage.getItem('resume-visual-quality') || selected; postRequested = localStorage.getItem('resume-visual-post') === 'on'; } catch {}
  const query = new URLSearchParams(location.search);
  if (['auto','standard','low','static'].includes(query.get('quality'))) selected = query.get('quality');
  if (!['auto','standard','low','static'].includes(selected)) selected = 'auto';
  function createScope(name) {
    const abort = new AbortController(), cleanups = [], timers = new Set(), frames = new Set(), observers = new Set();
    const scope = { name, signal: abort.signal,
      on(target, event, callback, options = {}) { target.addEventListener(event, callback, { ...options, signal: abort.signal }); },
      cleanup(callback) { if(abort.signal.aborted)callback();else cleanups.push(callback); },
      timeout(callback, delay) { if(abort.signal.aborted)return 0; const id = setTimeout(() => { timers.delete(id); if (!abort.signal.aborted) callback(); }, delay); timers.add(id); return id; },
      clearTimeout(id) { clearTimeout(id); timers.delete(id); },
      raf(callback) { if(abort.signal.aborted)return 0; const id = requestAnimationFrame(time => { frames.delete(id); if (!abort.signal.aborted) callback(time); }); frames.add(id); return id; },
      cancelRaf(id) { cancelAnimationFrame(id); frames.delete(id); },
      observe(observer) { observers.add(observer); return observer; },
      dispose() {
        if (abort.signal.aborted) return; abort.abort();
        timers.forEach(clearTimeout); frames.forEach(cancelAnimationFrame); observers.forEach(observer => observer.disconnect());
        timers.clear(); frames.clear(); observers.clear();
        for (const cleanup of cleanups.reverse()) { try { cleanup(); } catch (error) { console.warn(name + ' cleanup:', error); } }
        cleanups.length = 0; scopes.delete(scope);
      },
      snapshot: () => ({ name, timers: timers.size, frames: frames.size, observers: observers.size, disposed: abort.signal.aborted })
    }; scopes.add(scope); return scope;
  }
  function resolve() {
    const saveData = navigator.connection?.saveData === true;
    let mode = selected === 'auto' ? (mobile.matches || saveData ? 'low' : 'standard') : selected;
    const reason = !active ? 'disposed' : reduced.matches ? 'reduced-motion' : failure ? 'graphics-unavailable' : null;
    if (reason) mode = 'static';
    const profile = config.profiles[mode];
    return { ...profile, mode, selected, mobile: mobile.matches, reason, reducedMotion: reduced.matches,
      pixelRatio: Math.min(devicePixelRatio || 1, profile.pixelRatio), postProcessing: profile.postProcessingAllowed && postRequested };
  }
  function key(entry) {
    return JSON.stringify(entry.options.keys?.map(name => settings[name]) || [settings.mode, settings.pixelRatio, settings.postProcessing]);
  }
  function unmount(entry) {
    entry.generation++; entry.scope?.dispose(); entry.scope = null;
    try { entry.instance?.dispose?.(); } catch (error) { console.warn(entry.name + ' dispose:', error); }
    if(entry.instance?.snapshot)entry.lastDisposed=entry.instance.snapshot();
    if (entry.instance || entry.pending) unmounts++;
    entry.instance = null; entry.pending = false; entry.key = null;
  }
  function mount(entry) {
    if (!active || (entry.options.decorative !== false && settings.mode === 'static')) return;
    const nextKey = key(entry);
    if ((entry.instance || entry.pending) && entry.key === nextKey) return;
    unmount(entry); const generation = ++entry.generation, scope = createScope(entry.name);
    entry.scope = scope; entry.key = nextKey; entry.pending = true; mounts++;
    const parameters={...settings};
    Promise.resolve().then(() => {
      // A quality change can cancel the queued mount before its factory starts.
      if(scope.signal.aborted || generation!==entry.generation || !active)return;
      return entry.factory(scope,parameters);
    }).then(instance => {
      if (scope.signal.aborted || generation !== entry.generation || !active) { instance?.dispose?.(); return; }
      entry.instance = instance || {}; entry.pending = false;
      if(!document.hidden)entry.instance.resume?.(); window.dispatchEvent(new Event('resume:visualready'));
    }).catch(error => {
      if (scope.signal.aborted || error.name === 'AbortError') return;
      unmount(entry); fail(entry.name, error.message);
    });
  }
  function sync() {
    settings = resolve(); root.dataset.visualQuality = settings.mode;
    if(!root.dataset.lightingMode)root.dataset.lightingMode='off';
    root.dataset.visualState = active ? 'active' : 'disposed'; root.dataset.visualMotion = settings.mode === 'static' ? 'off' : 'on';
    root.style.setProperty('--visual-mobile-inset', `${config.mobile.actorInset}px`);
    root.style.setProperty('--visual-mobile-height', `clamp(${config.mobile.actorHeightMin}px,${config.mobile.actorHeightVw}vw,${config.mobile.actorHeightMax}px)`);
    for (const entry of entries.values()) {
      if (!active || (settings.mode === 'static' && entry.options.decorative !== false)) unmount(entry);
      else mount(entry);
    }
    controls(); window.dispatchEvent(new CustomEvent('resume:qualitychange', { detail: { ...settings } }));
  }
  function fail(name, message) { if (failure) return; failure = { name, message }; sync(); }
  function controls() {
    if (!document.getElementById('visualSettingsDialog')) {
      const dialog = document.createElement('dialog'); dialog.id = 'visualSettingsDialog';
      dialog.setAttribute('aria-labelledby', 'visualSettingsTitle');
      dialog.innerHTML = '<form method="dialog"><div class="visual-settings-heading"><h2 id="visualSettingsTitle">画面设置</h2><button class="visual-settings-close" aria-label="关闭画面设置">×</button></div><label for="visualQualitySelect">渲染模式</label><select id="visualQualitySelect"><option value="auto">自动</option><option value="standard">标准</option><option value="low">低负载</option><option value="static">静态背景</option></select><label class="visual-post-label"><input id="visualPostToggle" type="checkbox">轻量 Bloom 后期</label><p id="visualQualityStatus" role="status"></p><button id="visualRetry" type="button" hidden>重试图形</button></form>';
      document.body.append(dialog);
      const trigger = document.createElement('button'); trigger.type = 'button'; trigger.id = 'visualSettingsTrigger';
      trigger.className = 'icon-btn visual-settings-trigger'; trigger.textContent = '⚙'; trigger.setAttribute('aria-label','画面设置'); trigger.setAttribute('aria-controls',dialog.id);
      document.querySelector('.nav-actions')?.append(trigger);
      const footer = document.createElement('button'); footer.type = 'button'; footer.id = 'visualSettingsFooter'; footer.className = 'visual-settings-footer'; footer.textContent = '画面设置'; footer.setAttribute('aria-controls',dialog.id); document.querySelector('footer')?.append(footer);
    }
    const menu = document.getElementById('mobileNav');
    if (menu && !document.getElementById('visualSettingsMobile')) {
      const button = document.createElement('button'); button.type = 'button'; button.id = 'visualSettingsMobile'; button.textContent = '画面设置'; button.setAttribute('aria-controls','visualSettingsDialog'); menu.append(button);
    }
    const select = document.getElementById('visualQualitySelect'); select.value = selected;
    const checkbox = document.getElementById('visualPostToggle'); checkbox.checked = settings.postProcessing; checkbox.disabled = !settings.postProcessingAllowed;
    const label = { standard: '标准', low: '低负载', static: '静态背景' }[settings.mode];
    document.getElementById('visualQualityStatus').textContent = settings.reason === 'reduced-motion' ? '已按系统减少动效设置使用静态背景。音乐仍可主动播放。' : settings.reason === 'graphics-unavailable' ? '图形暂不可用，已切换静态背景。正文与链接继续可用。' : settings.reason === 'disposed' ? '动态图形已释放，正文与链接继续可用。' : `${selected === 'auto' ? '自动：' : ''}${label} · 像素比上限 ${settings.pixelRatio}${settings.mode === 'low' ? ' · 已关闭后期' : ''}`;
    document.getElementById('visualRetry').hidden = !failure;
  }
  function bind() {
    listeners = new AbortController(); const options = { signal: listeners.signal };
    let returnFocus=null;
    document.addEventListener('close',event=>{if(event.target.id==='visualSettingsDialog')returnFocus?.focus({preventScroll:true});},{...options,capture:true});
    document.addEventListener('click', event => {
      if (event.target.closest('#visualSettingsTrigger,#visualSettingsFooter,#visualSettingsMobile')) {
        const trigger=event.target.closest('#visualSettingsTrigger,#visualSettingsFooter,#visualSettingsMobile');
        returnFocus=trigger.id==='visualSettingsMobile'?document.getElementById('menuToggle'):trigger;
        const dialog = document.getElementById('visualSettingsDialog'); if (!dialog.open) dialog.showModal();
      }
      if (event.target.closest('#visualRetry')) { failure = null; sync(); }
    }, options);
    document.addEventListener('change', event => {
      if (event.target.id === 'visualQualitySelect') setMode(event.target.value);
      if (event.target.id === 'visualPostToggle') setPostProcessing(event.target.checked);
    }, options);
    reduced.addEventListener('change', sync, options); mobile.addEventListener('change', sync, options);
    window.addEventListener('resize', () => { if (settings.pixelRatio !== resolve().pixelRatio) sync(); }, options);
    window.addEventListener('resume:render', controls, options);
    document.addEventListener('DOMContentLoaded',controls,options);
    document.addEventListener('visibilitychange', () => {
      for (const entry of entries.values()) entry.instance?.[document.hidden ? 'pause' : 'resume']?.();
    }, options);
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); else for (const entry of entries.values()) entry.instance?.pause?.(); }, options);
    window.addEventListener('pageshow', () => { if (!active) init(); else for (const entry of entries.values()) entry.instance?.resume?.(); }, options);
  }
  function init() { if (active) return; active = true; bind(); sync(); }
  function dispose() {
    if (!active) return; active = false; listeners?.abort(); listeners = null;
    for (const entry of entries.values()) unmount(entry);
    document.getElementById('visualSettingsDialog')?.close(); settings = resolve();
    root.dataset.visualQuality = 'static'; root.dataset.visualState = 'disposed'; root.dataset.visualMotion = 'off';
    controls(); window.dispatchEvent(new Event('resume:qualitychange'));
  }
  function setMode(mode) { if (!['auto','standard','low','static'].includes(mode)) return; selected = mode; try { localStorage.setItem('resume-visual-quality',mode); } catch {} sync(); }
  function setPostProcessing(enabled) { postRequested = !!enabled; try { localStorage.setItem('resume-visual-post',enabled?'on':'off'); } catch {} sync(); }
  window.resumeVisualRuntime = { init, dispose, setMode, setPostProcessing, fail, createScope,
    settings: () => ({ ...settings }), animationsAllowed: () => active && settings.mode !== 'static' && !document.hidden && root.dataset.motion !== 'off',
    register(name, factory, options = {}) { if (entries.has(name)) return; const entry = { name, factory, options, instance: null, pending: false, generation: 0, scope: null, key: null }; entries.set(name,entry); mount(entry); },
    snapshot: () => ({ active, settings: { ...settings }, failure, mounts, unmounts,
      components: [...entries.values()].map(entry => ({ name: entry.name, mounted: !!entry.instance, pending: entry.pending, resources: entry.instance?.snapshot?.() ?? null, lastDisposed: entry.lastDisposed ?? null })),
      scopes: [...scopes].map(scope => scope.snapshot()) })
  }; init();
})();
