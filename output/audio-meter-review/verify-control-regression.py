from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib, json, math, struct, wave

ROOT=Path('D:/编程/个人简历')
OUT=ROOT/'output/audio-meter-review/control-regression'
OUT.mkdir(parents=True,exist_ok=True)
URL='http://127.0.0.1:8765/'
errors=[]
result={}
with wave.open(str(ROOT/'assets/audio/ambient-test.wav'),'rb') as f:
    pcm=struct.unpack('<'+str(f.getnframes())+'h',f.readframes(f.getnframes()))
    rms=math.sqrt(sum(value*value for value in pcm)/len(pcm))/32768
    assert rms>.03
    result['testAudio']={'duration':len(pcm)/f.getframerate(),'rms':round(rms,4),'sampleRate':f.getframerate()}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1,reduced_motion='reduce')
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('''
      window.audioCreationStats={contexts:0,mediaSources:0,gains:0,analysers:0,connections:0,audioConstructors:0};
      window.audioEvidence=[];
      const NativeContext=window.AudioContext;
      window.AudioContext=new Proxy(NativeContext,{construct(target,args){window.audioCreationStats.contexts++;return Reflect.construct(target,args);}});
      const nativeSource=NativeContext.prototype.createMediaElementSource;
      NativeContext.prototype.createMediaElementSource=function(...args){window.audioCreationStats.mediaSources++;return nativeSource.apply(this,args);};
      const nativeAnalyser=BaseAudioContext.prototype.createAnalyser; BaseAudioContext.prototype.createAnalyser=function(...args){window.audioCreationStats.analysers++;return nativeAnalyser.apply(this,args);}; const nativeGain=BaseAudioContext.prototype.createGain;
      BaseAudioContext.prototype.createGain=function(...args){window.audioCreationStats.gains++;return nativeGain.apply(this,args);};
      const nativeConnect=AudioNode.prototype.connect;
      AudioNode.prototype.connect=function(...args){window.audioCreationStats.connections++;return nativeConnect.apply(this,args);};
      const NativeAudio=window.Audio;
      window.Audio=new Proxy(NativeAudio,{construct(target,args){window.audioCreationStats.audioConstructors++;return Reflect.construct(target,args);}});
    ''')
    page.goto(URL,wait_until='networkidle')
    page.wait_for_function('window.resumeAudioControl && window.portraitLighting && window.resumeChapterScene.snapshot().settled')
    page.wait_for_selector('#chapterSignature[data-ready="true"]')
    page.wait_for_timeout(250)
    def snapshot(): return page.evaluate('window.resumeAudioControl.snapshot()')
    def wait_state(name):
        page.wait_for_function('(s)=>window.resumeAudioControl.snapshot().state===s',arg=name,timeout=7000)
        return snapshot()
    def canvases(): return page.evaluate('''()=>Object.fromEntries(['signatureCanvas','portraitBase','starfieldCanvas'].map(id=>[id,document.getElementById(id).toDataURL()]))''')
    original_canvas=canvases()
    original_scene=page.evaluate('window.resumeChapterScene.snapshot().current')
    assert snapshot()['state']=='paused' and snapshot()['contextState'] is None
    assert page.locator('audio').count()==1 and page.locator('#audioToggle').get_attribute('aria-pressed')=='false'
    assert page.evaluate('window.audioCreationStats.contexts')==0
    page.screenshot(path=str(OUT/'paused.png'))
    page.locator('#audioToggle').click();playing=wait_state('playing')
    assert playing['actualPlaying'] and playing['contextState']=='running'
    assert page.locator('#audioToggle').get_attribute('aria-pressed')=='true'
    start=snapshot()['currentTime'];page.wait_for_timeout(350)
    assert snapshot()['currentTime']>start+.15
    page.evaluate('window.originalAudio=document.getElementById("siteAudio");window.originalGraph=window.resumeAudioControl.connection;')
    page.screenshot(path=str(OUT/'playing.png'))
    page.locator('#audioToggle').click();paused=wait_state('paused')
    stopped=paused['currentTime'];page.wait_for_timeout(200)
    assert abs(snapshot()['currentTime']-stopped)<.025
    # Repeated user actions reuse element, context, source, gain and the two initial graph connections.
    for _ in range(6):
        page.locator('#audioToggle').click();wait_state('playing')
        page.locator('#audioToggle').click();wait_state('paused')
    for count,expected in [(30,'paused'),(31,'playing')]:
        page.evaluate('(count)=>{for(let i=0;i<count;i++)document.getElementById("audioToggle").click();}',count)
        wait_state(expected)
        page.wait_for_function('!window.resumeAudioControl.snapshot().pending',timeout=7000)
    assert page.evaluate('window.originalAudio===window.resumeAudioControl.audio')
    assert page.evaluate('window.originalGraph.context===window.resumeAudioControl.connection.context && window.originalGraph.source===window.resumeAudioControl.connection.source && window.originalGraph.gain===window.resumeAudioControl.connection.gain')
    stats=page.evaluate('window.audioCreationStats')
    assert stats=={'contexts':1,'mediaSources':1,'gains':1,'analysers':1,'connections':3,'audioConstructors':0},stats
    assert page.locator('audio').count()==1
    result['repeatedClicks']={'regularCycles':6,'rapidClicks':61,'stats':stats,'sameElementAndGraph':True}
    # Native media pause must update the button even when the controller did not request it.
    page.evaluate('document.getElementById("siteAudio").pause()');wait_state('paused')
    assert page.locator('#audioToggle').get_attribute('aria-pressed')=='false'
    page.locator('#audioToggle').focus();page.keyboard.press('Space');wait_state('playing')
    page.keyboard.press('Enter');wait_state('paused')
    result['keyboardAndExternalPause']=True
    assert canvases()==original_canvas,'Audio altered a particle/star canvas'
    assert page.evaluate('window.resumeChapterScene.snapshot().current')==original_scene,'Audio altered chapter parameters'
    result['sceneUnchanged']=True
    # Read the existing analyser to verify nonzero output without constructing or connecting another node.
    page.locator('#audioToggle').click();wait_state('playing');page.wait_for_timeout(250)
    signal=page.evaluate('''async()=>{
      const {analyser}=window.resumeAudioControl.connection;
      await new Promise(r=>setTimeout(r,120));const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);
    }''')
    assert signal>.0001,signal
    result['liveOutputRms']=signal
    page.locator('#audioToggle').click();wait_state('paused')
    # A rejected play() is injected to exercise browser refusal, without reporting success prematurely.
    page.evaluate('()=>{window.resumeAudioControl.audio.play=()=>Promise.reject(new DOMException("Blocked for verification","NotAllowedError"));}')
    page.locator('#audioToggle').click();blocked=wait_state('error')
    assert blocked['failure']=='blocked' and not blocked['actualPlaying']
    assert page.locator('#audioStatus').is_visible() and page.locator('#audioToggle').get_attribute('aria-pressed')=='false'
    page.screenshot(path=str(OUT/'playback-blocked.png'))
    page.evaluate('delete window.resumeAudioControl.audio.play')
    page.locator('#audioToggle').click();wait_state('playing');page.locator('#audioToggle').click();wait_state('paused')
    result['playRejectionAndRetry']='NotAllowedError injected; recovered with the same graph'
    # Real network/source failure on the same HTMLMediaElement, followed by retry.
    source=str(ROOT/'assets/audio/ambient-test.wav')
    page.route('**/assets/audio/ambient-test.wav',lambda route:route.fulfill(status=404,content_type='text/plain',body='Missing audio for verification'))
    page.evaluate('window.resumeAudioControl.audio.load()')
    page.locator('#audioToggle').click();missing=wait_state('error')
    assert not missing['actualPlaying'] and page.locator('#audioStatus').is_visible()
    page.screenshot(path=str(OUT/'load-failed.png'))
    page.unroute('**/assets/audio/ambient-test.wav')
    page.locator('#audioToggle').click();wait_state('playing');page.locator('#audioToggle').click();wait_state('paused')
    assert page.evaluate('window.originalGraph.source===window.resumeAudioControl.connection.source')
    result['loadFailureAndRetry']={'failureState':missing['failure'],'recovered':True}
    # Pending playback can be canceled; a late load cannot restart an explicitly paused track.
    held=[]
    page.route('**/assets/audio/ambient-test.wav',lambda route:held.append(route))
    page.evaluate('window.resumeAudioControl.audio.load()')
    page.locator('#audioToggle').click()
    page.wait_for_timeout(100)
    loading=snapshot();assert loading['state'] in ['loading','buffering'] and not loading['actualPlaying'],loading
    assert page.locator('#audioToggle').get_attribute('aria-pressed')=='false'
    page.screenshot(path=str(OUT/'loading.png'))
    page.locator('#audioToggle').click();wait_state('paused')
    page.unroute('**/assets/audio/ambient-test.wav')
    for route in held:
        try: route.fulfill(status=200,content_type='audio/wav',body=Path(source).read_bytes())
        except Exception: route.fallback() # Release the test handler even if the browser canceled this request.
    page.wait_for_timeout(200)
    assert snapshot()['state']=='paused' and not snapshot()['actualPlaying']
    page.locator('#audioToggle').click();wait_state('playing')
    page.locator('#audioToggle').click();wait_state('paused')
    result['cancelPendingLoad']=True
    # Hold a real request beyond the configured timeout, then retry without replacing the graph.
    held=[]
    page.route('**/assets/audio/ambient-test.wav',lambda route:held.append(route))
    page.evaluate('()=>{window.RESUME_AUDIO_CONFIG.loadTimeoutMs=200;window.resumeAudioControl.audio.load();}')
    page.locator('#audioToggle').click();timed_out=wait_state('error')
    assert timed_out['failure']=='timeout' and not timed_out['actualPlaying']
    page.screenshot(path=str(OUT/'load-timeout.png'))
    page.unroute('**/assets/audio/ambient-test.wav')
    for route in held:
        try: route.fulfill(status=200,content_type='audio/wav',body=Path(source).read_bytes())
        except Exception: route.fallback()
    page.evaluate('window.RESUME_AUDIO_CONFIG.loadTimeoutMs=15000')
    page.locator('#audioToggle').click();wait_state('playing');page.locator('#audioToggle').click();wait_state('paused')
    result['loadTimeoutAndRetry']=True
    # Natural end updates state when looping is disabled for this verification.
    page.evaluate('()=>{window.resumeAudioControl.audio.loop=false;window.resumeAudioControl.audio.playbackRate=8;}')
    page.locator('#audioToggle').click();wait_state('playing')
    wait_state('paused')
    page.evaluate('window.resumeAudioControl.audio.playbackRate=1')
    assert page.locator('#audioToggle').get_attribute('aria-pressed')=='false'
    result['naturalEnd']=True
    # A pending output resume may time out; a new gesture must be able to resume the same context.
    page.evaluate('window.resumeAudioControl.connection.context.suspend()')
    page.evaluate('()=>{window.RESUME_AUDIO_CONFIG.loadTimeoutMs=200;window.resumeAudioControl.connection.context.resume=()=>new Promise(()=>{});}')
    page.locator('#audioToggle').click();assert wait_state('error')['failure']=='timeout'
    page.evaluate('()=>{delete window.resumeAudioControl.connection.context.resume;window.RESUME_AUDIO_CONFIG.loadTimeoutMs=15000;}')
    page.locator('#audioToggle').click();wait_state('playing')
    page.locator('#audioToggle').click();wait_state('paused')
    assert page.evaluate('window.originalGraph.context===window.resumeAudioControl.connection.context')
    result['outputResumeTimeoutRetry']=True
    # Localized labels and compact navigation remain usable.
    page.locator('#langToggle').click();page.wait_for_timeout(100)
    assert page.locator('#audioToggle').get_attribute('aria-label')=='Play audio'
    page.locator('#langToggle').click()
    for width in [390,320,900]:
        page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        box=page.locator('#audioToggle').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width,box
        hit=page.locator('#audioToggle').evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
        assert hit,(width,box)
        if width==390:page.screenshot(path=str(OUT/'mobile-controls.png'))
    result['responsiveAndLocalization']=True
    assert not errors,errors
    result['singleAudioElement']=page.locator('audio').count()
    result['browserScriptErrors']=errors
    browser.close()

(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
