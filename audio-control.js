/* Audio is independent of scene state. One media element, one reusable output graph. */
(() => {
  if(window.resumeAudioControl)return;
  const audio=document.getElementById('siteAudio'),button=document.getElementById('audioToggle'),status=document.getElementById('audioStatus');
  const config=window.RESUME_AUDIO_CONFIG;
  if(!audio || !button || !status || !config)return;
  const volume=Math.max(0,Math.min(1,config.volume));
  audio.preload='none';audio.loop=config.loop;audio.volume=volume;
  audio.src=config.source;
  let context=null,source=null,gain=null,analyser=null,sourceConnected=false,outputConnected=false,analysisConnected=false,resumePromise=null;
  let desiredPlaying=false,confirmedPlaying=false,hasPlayed=false,revision=0,pending=null,ownPauseEvents=0;
  let failure=null,slowLoad=false,state='paused';
  let publishedState='';

  const en=()=>document.documentElement.lang.startsWith('en');
  const text=(zh,english)=>en()?english:zh;
  const messages={
    blocked:['播放被浏览器阻止，请点击重试。','Playback was blocked. Click to retry.'],
    network:['音频加载失败，请检查网络后重试。','Audio could not load. Check your connection and retry.'],
    unsupported:['音频无法读取或格式不受支持，请重试。','The audio could not be read or its format is unsupported. Retry.'],
    decode:['音频解码失败，请重试。','The audio could not be decoded. Retry.'],
    timeout:['音频加载超时，点击重试。','Audio loading timed out. Click to retry.'],
    connection:['声音连接暂时不可用，点击重试。','The audio output is unavailable. Click to retry.'],
    playback:['音频播放失败，点击重试。','Audio playback failed. Click to retry.']
  };
  function classify(error){
    if(error?.name==='NotAllowedError')return 'blocked';
    if(error?.name==='TimeoutError')return 'timeout';
    if(error?.name==='NotSupportedError' || audio.error?.code===4)return 'unsupported';
    if(audio.error?.code===2)return 'network';
    if(audio.error?.code===3)return 'decode';
    if(error?.name==='InvalidStateError')return 'connection';
    return 'playback';
  }
  function outputRunning(){return !context || context.state==='running';}
  function render(){
    const playing=confirmedPlaying && !audio.paused && !audio.ended && !audio.error && outputRunning();
    state=failure?'error':playing?'playing':desiredPlaying?(hasPlayed?'buffering':'loading'):'paused';
    const busy=state==='loading' || state==='buffering';
    const label=state==='error'?text('重试播放音频','Retry audio playback'):state==='playing'?text('暂停音频','Pause audio'):busy?text('取消音频播放','Cancel audio playback'):text('播放音频','Play audio');
    button.dataset.state=state;button.setAttribute('aria-label',label);button.title=config.title?`${label} · ${config.title}`:label;
    button.setAttribute('aria-pressed',String(playing));button.setAttribute('aria-busy',String(busy));
    const speaker='<path d="M11 5 6 9H3v6h3l5 4Z"/>';
    const glyph=state==='error'?speaker+'<path d="m16 9 5 6m0-6-5 6"/>':playing?speaker+'<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>':busy?'<circle cx="12" cy="12" r="7" stroke-dasharray="4 3"/>':speaker+'<path d="m16 9 5 6m0-6-5 6"/>';
    const markup=`<svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg>`;
    if(!button.querySelector('.audio-button-glyph'))button.innerHTML='<span class="audio-button-glyph" aria-hidden="true"></span><span class="audio-band-bars" aria-hidden="true"><i data-audio-band="low"></i><i data-audio-band="middle"></i><i data-audio-band="high"></i></span>';
    const glyphSlot=button.querySelector('.audio-button-glyph');
    if(glyphSlot.innerHTML!==markup)glyphSlot.innerHTML=markup;
    const message=failure?text(...messages[failure]):busy?slowLoad?text('音频加载较慢，可再次点击取消。','Audio is loading slowly. Click again to cancel.'):text('正在加载音频，可再次点击取消。','Loading audio. Click again to cancel.'):playing?text('音频正在播放。','Audio is playing.'):text('音频已暂停。','Audio is paused.');
    if(status.textContent!==message)status.textContent=message;
    status.dataset.visible=String(!!failure || busy);
    const stateKey=`${state}:${playing}:${context?.state ?? 'none'}`;
    if(publishedState!==stateKey){
      publishedState=stateKey;
      window.dispatchEvent(new CustomEvent('resume:audiostate',{detail:{state,actualPlaying:playing}}));
    }
  }
  function pauseMedia(){
    if(!audio.paused)ownPauseEvents++;
    audio.pause();confirmedPlaying=false;
  }
  function fail(error){
    failure=classify(error);desiredPlaying=false;revision++;pauseMedia();
    if(context && context.state!=='running')resumePromise=null;
    render();
  }
  function connectOnce(){
    const Context=window.AudioContext || window.webkitAudioContext;
    if(!Context)return Promise.resolve(); // The same native audio element also works without Web Audio.
    if(!context){context=new Context();context.addEventListener('statechange',render);}
    if(context.state==='closed')throw new DOMException('Audio output is closed','InvalidStateError');
    if(!source)source=context.createMediaElementSource(audio);
    if(!gain){gain=context.createGain();gain.gain.value=volume;}
    if(!analyser){analyser=context.createAnalyser();analyser.fftSize=config.meter.fftSize;}
    if(!sourceConnected){source.connect(gain);sourceConnected=true;}
    if(!outputConnected){gain.connect(context.destination);outputConnected=true;}
    // A measurement-only branch: the original gain -> destination route is preserved.
    if(!analysisConnected){gain.connect(analyser);analysisConnected=true;}
    audio.volume=1; // Gain is the single volume control; no parallel native output is added.
    if(context.state==='running')return Promise.resolve();
    if(!resumePromise){
      const attempt=context.resume().finally(()=>{if(resumePromise===attempt)resumePromise=null;});
      resumePromise=attempt;
    }
    return resumePromise;
  }
  function start(){
    if(pending || !desiredPlaying)return;
    const requestRevision=revision;
    let timeout;
    const request=(async()=>{
      try{
        if(audio.error)audio.load();
        // Both calls begin inside the click handler; neither waits for the other to request playback.
        const outputReady=connectOnce();
        const playback=audio.play();
        await Promise.race([
          Promise.all([outputReady,playback]),
          new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new DOMException('Audio loading timed out','TimeoutError')),config.loadTimeoutMs);})
        ]);
        if(requestRevision!==revision || !desiredPlaying)return;
        confirmedPlaying=!audio.paused && !audio.ended && outputRunning();
        hasPlayed ||= confirmedPlaying;render();
      }catch(error){
        // A canceled/older attempt cannot overwrite a more recent click's state.
        if(requestRevision!==revision || !desiredPlaying)return;
        fail(error);
      }finally{clearTimeout(timeout);}
    })();
    pending=request;
    request.finally(()=>{
      if(pending===request)pending=null;
      if(desiredPlaying && requestRevision!==revision && !failure && audio.paused)start();
    }).catch(()=>{});
  }
  function toggle(){
    desiredPlaying=!desiredPlaying;revision++;slowLoad=false;
    if(!desiredPlaying){pauseMedia();render();return;}
    failure=null;render();start();
  }
  function pause(){desiredPlaying=false;revision++;pauseMedia();render();}
  button.addEventListener('click',toggle);
  audio.addEventListener('playing',()=>{
    if(audio.paused || audio.error)return;
    if(!desiredPlaying){pauseMedia();return;}
    confirmedPlaying=true;hasPlayed=true;slowLoad=false;render();
  });
  audio.addEventListener('pause',()=>{
    if(ownPauseEvents>0)ownPauseEvents--;
    else if(audio.paused){desiredPlaying=false;revision++;}
    if(audio.paused)confirmedPlaying=false;
    render();
  });
  audio.addEventListener('waiting',()=>{if(desiredPlaying){confirmedPlaying=false;render();}});
  audio.addEventListener('stalled',()=>{if(desiredPlaying){slowLoad=true;render();}});
  audio.addEventListener('loadstart',()=>{if(desiredPlaying){confirmedPlaying=false;render();}});
  audio.addEventListener('ended',()=>{if(audio.ended)pause();});
  audio.addEventListener('error',()=>{if(desiredPlaying || confirmedPlaying)fail(audio.error);});
  window.addEventListener('resume:render',render);
  window.addEventListener('pagehide',()=>{
    pause();
    if(context?.state==='running')context.suspend().catch(()=>{});
  });
  window.addEventListener('pageshow',render);
  window.resumeAudioControl={toggle,pause,
    get audio(){return audio;},
    get connection(){return context?{context,source,gain,analyser}:null;},
    snapshot:()=>({state,desiredPlaying,actualPlaying:confirmedPlaying && !audio.paused && !audio.ended && !audio.error && outputRunning(),
      paused:audio.paused,currentTime:audio.currentTime,readyState:audio.readyState,networkState:audio.networkState,
      pending:!!pending,failure,contextState:context?.state ?? null,sourceConnections:sourceConnected?1:0,outputConnections:outputConnected?1:0,
      analyserConnections:analysisConnected?1:0,analyserFftSize:analyser?.fftSize ?? 0})
  };
  render();
})();
