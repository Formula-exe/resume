/* Source identity gates both cached features and hand-authored media-time cues. */
(() => {
  const config = window.RESUME_MUSIC_RESPONSE_CONFIG, control = window.resumeAudioControl;
  if (!config || !control || window.resumeMusicAnalysis) return;
  const audio = control.audio;
  let profile = null, sourceURL = '', sourceHash = '', status = 'idle', error = null;
  let generation = 0, promise = null, worker = null, workerReject = null, abort = null, calibrated = false;
  const notify = () => window.dispatchEvent(new Event('resume:musicanalysis'));
  const currentSource = () => audio.src;
  function clear() {
    generation++; abort?.abort(); worker?.terminate(); workerReject?.(new DOMException('Analysis cancelled','AbortError')); abort = worker = workerReject = null;
    profile = null; sourceHash = ''; calibrated = false; promise = null;
    status = 'idle'; error = null; sourceURL = currentSource(); notify();
  }
  function runWorker(samples, sampleRate, hash) {
    return new Promise((resolve, reject) => {
      const job = new Worker(config.worker); worker = job; workerReject = reject;
      const cleanup=()=>{job.terminate();if(worker===job){worker=null;workerReject=null;}};
      job.onmessage = ({ data }) => { cleanup(); data.error ? reject(new Error(data.error)) : resolve(data); };
      job.onerror = event => { cleanup(); reject(new Error(event.message || 'Analysis failed')); };
      job.postMessage({ samples, sampleRate, sourceHash: hash }, [samples.buffer]);
    });
  }
  async function ensure() {
    if(document.hidden || !window.resumeVisualRuntime.snapshot().active || window.resumeVisualRuntime.settings().mode==='static')return;
    if (sourceURL !== currentSource()) clear();
    if (profile || promise || !control.connection?.context) return promise;
    const revision = generation, url = sourceURL;
    const fetchAbort = new AbortController(); abort = fetchAbort;
    status = 'loading'; error = null; notify();
    const task = (async () => {
      try {
        const response = await fetch(url, { signal: fetchAbort.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error('Audio analysis source could not load');
        const bytes = await response.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
        if (revision !== generation) return;
        let result = null;
        if (hash === config.sourceHash) {
          try {
            const cachedResponse = await fetch(config.analysis, { signal: fetchAbort.signal });
            if (cachedResponse.ok) {
              const cached = await cachedResponse.json();
              if (cached.sourceHash === hash && cached.byteLength === bytes.byteLength && cached.features?.length && cached.step > 0) result = cached;
            }
          } catch (failure) { if (failure.name === 'AbortError') throw failure; }
        }
        if (!result) {
          status = 'analysing'; notify();
          // Reuse the real playback context solely for decoding; do not create or connect any source.
          const decoded = await control.connection.context.decodeAudioData(bytes);
          if (revision !== generation) return;
          const sampleRate = 11025, samples = new Float32Array(Math.floor(decoded.duration * sampleRate));
          const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
          const ratio = decoded.sampleRate / sampleRate;
          for (let i = 0; i < samples.length; i++) {
            const begin = Math.floor(i * ratio), end = Math.min(decoded.length, Math.floor((i + 1) * ratio));
            let sum = 0; for (let j = begin; j < end; j++) for (const channel of channels) sum += channel[j];
            samples[i] = sum / Math.max(1, (end - begin) * channels.length);
          }
          result = await runWorker(samples, sampleRate, hash);
          if (revision !== generation) return;
        }
        if (revision !== generation || url !== currentSource()) return;
        profile = result; sourceHash = hash;
        calibrated = hash === config.sourceHash && Math.abs(result.duration - config.duration) < .15;
        status = calibrated ? 'ready' : 'ready-uncalibrated'; notify();
      } catch (failure) {
        if (revision !== generation || failure.name === 'AbortError') return;
        profile = null; calibrated = false; status = 'error'; error = failure.message; notify();
      } finally { if (revision === generation) { promise = null; abort = null; } }
    })();
    promise = task; return task;
  }
  const lastAt = (list, time, getTime) => {
    let left = 0, right = list.length;
    while (left < right) { const middle = (left + right) >>> 1; if (getTime(list[middle]) <= time) left = middle + 1; else right = middle; }
    return left - 1;
  };
  function sample(time = audio.currentTime) {
    const empty = { available: false, time, energy: 0, register: .5, onset: 0, onsetIndex: -1,
      phase: null, arrangement: 0, meteors: [], calibrated: false };
    if (!profile || sourceURL !== currentSource()) return empty;
    const frame = Math.max(0, Math.min(profile.features.length - 1, (time - profile.startTime) / profile.step));
    const index = Math.floor(frame), mix = frame - index, a = profile.features[index], b = profile.features[Math.min(index + 1, profile.features.length - 1)];
    const onsetIndex = lastAt(profile.onsets, time, row => row[0]);
    const onset = profile.onsets[onsetIndex], age = onset ? time - onset[0] : Infinity;
    const phase = calibrated ? config.phases.find(row => time >= row.start && time < row.end) : null;
    const fraction = phase ? Math.min(1, Math.max(0, (time - phase.start) / (phase.end - phase.start))) : 0;
    const ramp = fraction * fraction * (3 - 2 * fraction);
    return { available: true, time, energy: a[0] + (b[0] - a[0]) * mix, register: a[1] + (b[1] - a[1]) * mix,
      onset: age < config.mapping.onsetWindow ? onset[1] * Math.exp(-age / config.mapping.onsetDecay) : 0, onsetIndex,
      phase: phase ? { label: phase.label, kind: phase.kind, start: phase.start, end: phase.end } : null,
      arrangement: phase ? phase.intensity[0] + (phase.intensity[1] - phase.intensity[0]) * ramp : 0,
      meteors: calibrated ? config.meteors.cues.filter(cue => time >= cue.time && time < cue.time + cue.duration) : [], calibrated };
  }
  audio.addEventListener('loadstart', clear);
  window.addEventListener('resume:audiostate', () => { if (control.snapshot().actualPlaying) ensure(); });
  window.addEventListener('pagehide', () => { if(promise)clear(); });
  const lifecycle=()=>{
    if(document.hidden || !window.resumeVisualRuntime.snapshot().active || window.resumeVisualRuntime.settings().mode==='static'){if(promise)clear();}
    else if(control.snapshot().actualPlaying)ensure();
  };
  document.addEventListener('visibilitychange',lifecycle);window.addEventListener('resume:qualitychange',lifecycle);
  window.resumeMusicAnalysis = { ensure, sample,
    snapshot: () => ({ status, sourceURL, sourceHash, calibrated, error, duration: profile?.duration ?? 0,
      featureFrames: profile?.features.length ?? 0, onsetCount: profile?.onsets.length ?? 0,
      registerMethod: profile?.registerMethod ?? null, manualCueCount: calibrated ? config.meteors.cues.length : 0 }) };
  sourceURL = currentSource();
  if(control.snapshot().actualPlaying)ensure();
})();
