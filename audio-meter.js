/* Temporary waveform/RMS inspection. This module only reads the existing output graph. */
(() => {
  if(window.resumeAudioMeter)return;
  const control=window.resumeAudioControl,config=window.RESUME_AUDIO_CONFIG?.meter;
  const panel=document.getElementById('audioMeter'),bar=document.getElementById('audioRmsBar');
  const fill=document.getElementById('audioRmsFill'),value=document.getElementById('audioRmsValue'),status=document.getElementById('audioMeterStatus');
  if(!control || !config || !panel || !bar || !fill || !value || !status)return;
  let analyser=null,waveform=null,frequency=null,bufferAllocations=0,frequencyAllocations=0,frame=0,previousTime=null;
  let visualEnabled=true;
  const spectrumConfig=window.RESUME_MUSIC_RESPONSE_CONFIG.bands;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const bands={low:0,middle:0,high:0},rawBands={low:0,middle:0,high:0};
  let rms=0,waveformRms=0,level=0,sampleCount=0,lastUiTime=-Infinity,lastDeltaTime=0;
  const en=()=>document.documentElement.lang.startsWith('en');
  const text=(zh,english)=>en()?english:zh;

  function calculateRms(samples){
    let energy=0;for(let i=0;i<samples.length;i++)energy+=samples[i]*samples[i];
    return samples.length?Math.sqrt(energy/samples.length):0;
  }
  function labels(){
    panel.setAttribute('aria-label',text('音频数据检查','Audio data inspection'));
    document.getElementById('audioMeterTitle').textContent=text('音频强度 · 临时检查','Audio level · temporary check');
    bar.setAttribute('aria-label',text('声音强度','Audio level'));
  }
  function display(timestamp,force=false){
    const state=control.snapshot();
    const animate=visualEnabled && !reduced.matches && document.documentElement.dataset.motion!=='off';
    fill.style.transform=`scaleX(${animate ? level : state.actualPlaying ? .35 : 0})`;
    document.querySelectorAll('[data-audio-band]').forEach((node,index)=>{
      node.style.transform=`scaleY(${animate?bands[node.dataset.audioBand]:state.actualPlaying?[.35,.65,.45][index]:0})`;
    });
    // Numeric and accessibility feedback is limited to 10 Hz, without a live-region announcement loop.
    if(force || timestamp-lastUiTime>=100){
      value.textContent=rms.toFixed(4);
      bar.setAttribute('aria-valuenow',level.toFixed(3));bar.setAttribute('aria-valuetext',`RMS ${rms.toFixed(4)}`);
      lastUiTime=timestamp;
    }
    const label=state.actualPlaying?analyser?text('播放中 · 波形采样','Playing · waveform samples'):text('分析入口不可用','Analysis unavailable'):
      state.state==='error'?text('播放失败','Playback failed'):state.desiredPlaying?text('等待实际播放','Waiting for playback'):
      level>0?text('已暂停 · 强度回落','Paused · level falling'):text('已暂停','Paused');
    if(status.textContent!==label)status.textContent=label;
    panel.dataset.state=state.state;
  }
  function update(timestamp){
    frame=0;
    if(document.hidden || document.documentElement.dataset.visualState==='disposed'){previousTime=null;return;}
    const maxFps=window.resumeVisualRuntime.settings().meterFps;
    if(previousTime!==null && timestamp-previousTime<1000/maxFps){frame=requestAnimationFrame(update);return;}
    const connection=control.connection,state=control.snapshot();
    if(connection?.analyser && analyser!==connection.analyser){
      analyser=connection.analyser;waveform=new Float32Array(analyser.fftSize);bufferAllocations++;
      frequency=new Float32Array(analyser.frequencyBinCount);frequencyAllocations++;
    }
    waveformRms=0;
    if(analyser && connection.context.state==='running'){
      analyser.getFloatTimeDomainData(waveform);waveformRms=calculateRms(waveform);sampleCount++;
    }
    // Ignore retained analyser history when output is paused, blocked or buffering.
    rms=state.actualPlaying?waveformRms:0;
    if(analyser && state.actualPlaying){
      analyser.getFloatFrequencyData(frequency);
      const hzPerBin=connection.context.sampleRate/analyser.fftSize;
      for(const name of Object.keys(bands)){
        const [low,high]=spectrumConfig[name];let power=0;
        for(let bin=Math.max(1,Math.ceil(low/hzPerBin));bin<Math.min(frequency.length,Math.ceil(high/hzPerBin));bin++)power+=10**(frequency[bin]/10);
        const db=10*Math.log10(Math.max(1e-12,power));
        rawBands[name]=Math.max(0,Math.min(1,(db-spectrumConfig.floorDb)/(spectrumConfig.ceilingDb-spectrumConfig.floorDb)));
      }
    }else for(const name of Object.keys(bands))rawBands[name]=0;
    const target=Math.min(1,rms/config.referenceRms);
    const dt=previousTime===null?0:Math.min(config.maxDeltaTime,Math.max(0,(timestamp-previousTime)/1000));
    previousTime=timestamp;lastDeltaTime=dt;
    const rate=target>level?config.attack:config.release;
    level+=(target-level)*-Math.expm1(-rate*dt);
    for(const name of Object.keys(bands)){
      const speed=rawBands[name]>bands[name]?spectrumConfig.attack:spectrumConfig.release;
      bands[name]+=(rawBands[name]-bands[name])*-Math.expm1(-speed*dt);
      if(!state.actualPlaying && bands[name]<config.zeroThreshold)bands[name]=0;
    }
    if(!state.actualPlaying && level<config.zeroThreshold)level=0;
    display(timestamp,level===0 && !state.actualPlaying);
    if((state.actualPlaying && analyser) || level>0 || Object.values(bands).some(value=>value>0))frame=requestAnimationFrame(update);
    else previousTime=null;
  }
  function schedule(){
    if(!frame && !document.hidden && document.documentElement.dataset.visualState!=='disposed')frame=requestAnimationFrame(update);
  }
  window.addEventListener('resume:audiostate',()=>{
    if(!control.snapshot().actualPlaying)rms=0;
    schedule();
  });
  window.addEventListener('resume:render',()=>{labels();schedule();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;previousTime=null;}
    else schedule();
  });
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(frame);frame=0;previousTime=null;rms=waveformRms=level=0;
    for(const name of Object.keys(bands))bands[name]=rawBands[name]=0;display(performance.now(),true);
  });
  window.addEventListener('pageshow',schedule);
  window.addEventListener('resume:qualitychange',()=>{
    cancelAnimationFrame(frame);frame=0;previousTime=null;schedule();
  });
  window.resumeAudioMeter={
    calculateRms,
    get analyser(){return analyser;},
    get waveform(){return waveform;},
    get frequency(){return frequency;},
    setVisualEnabled(enabled){visualEnabled=!!enabled;display(performance.now(),true);},
    snapshot:()=>({rms,waveformRms,level,referenceRms:config.referenceRms,fftSize:analyser?.fftSize ?? 0,
      sampleCount,bufferAllocations,frequencyAllocations,bands:{...bands},rawBands:{...rawBands},pendingFrames:frame?1:0,lastDeltaTime,available:!!analyser})
  };
  labels();display(performance.now(),true);schedule();
})();
