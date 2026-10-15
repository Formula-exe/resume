from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib,json

ROOT=Path('D:/编程/个人简历')
OUT=ROOT/'output/audio-meter-review'
result={};errors=[];failed=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1,reduced_motion='reduce')
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('response',lambda response:failed.append([response.status,response.url]) if response.status>=400 else None)
    page.add_init_script('''
      window.graphStats={contexts:0,sources:0,gains:0,analysers:0,connections:0};
      const Context=window.AudioContext;
      window.AudioContext=new Proxy(Context,{construct(target,args){graphStats.contexts++;return Reflect.construct(target,args);}});
      const methods=[['createMediaElementSource','sources',Context.prototype],['createGain','gains',BaseAudioContext.prototype],['createAnalyser','analysers',BaseAudioContext.prototype]];
      for(const [name,key,prototype] of methods){const original=prototype[name];prototype[name]=function(...args){graphStats[key]++;return original.apply(this,args);};}
      const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){graphStats.connections++;return connect.apply(this,args);};
    ''')
    page.goto('http://127.0.0.1:8765/',wait_until='networkidle')
    page.wait_for_function('window.resumeAudioMeter && window.resumeChapterScene.snapshot().settled && window.portraitLighting')
    page.wait_for_selector('#chapterSignature[data-ready="true"]');page.wait_for_timeout(250)
    def meter():return page.evaluate('window.resumeAudioMeter.snapshot()')
    def wait_play():
        page.wait_for_function('window.resumeAudioControl.snapshot().actualPlaying && window.resumeAudioMeter.snapshot().rms>.0001')
    def wait_zero():
        page.wait_for_function('window.resumeAudioMeter.snapshot().rms===0 && window.resumeAudioMeter.snapshot().level===0 && window.resumeAudioMeter.snapshot().pendingFrames===0',timeout=7000)
    def visual_hashes():
        images=page.evaluate('''()=>Object.fromEntries(['signatureCanvas','portraitBase','starfieldCanvas'].map(id=>[id,document.getElementById(id).toDataURL()]))''')
        return {key:hashlib.sha256(value.encode()).hexdigest() for key,value in images.items()}
    original_hashes=visual_hashes()
    original_scene=page.evaluate('window.resumeChapterScene.snapshot().current')
    assert meter()['rms']==meter()['level']==0 and not meter()['available']
    assert page.evaluate('window.graphStats.contexts')==0
    page.screenshot(path=str(OUT/'initial.png'))
    page.locator('#audioToggle').click();wait_play()
    page.evaluate('''()=>{window.originalGraph=resumeAudioControl.connection;window.originalWaveform=resumeAudioMeter.waveform;window.originalAudio=resumeAudioControl.audio;}''')
    values=page.evaluate('''async()=>{const samples=[];for(let i=0;i<60;i++){samples.push({...resumeAudioMeter.snapshot(),mediaTime:resumeAudioControl.audio.currentTime});await new Promise(resolve=>setTimeout(resolve,20));}return samples;}''')
    active_rms=[sample['rms'] for sample in values]
    assert max(active_rms)>.01 and max(active_rms)-min(active_rms)>.002,active_rms
    assert len({round(value,5) for value in active_rms})>10
    assert values[-1]['mediaTime']>values[0]['mediaTime']+.5
    # Compare the meter's actual reused sample buffer with the RMS calculation in the same JS task.
    evidence=page.evaluate('''()=>{
      const array=resumeAudioMeter.waveform;let sum=0,min=Infinity,max=-Infinity;
      for(const value of array){sum+=value*value;min=Math.min(min,value);max=Math.max(max,value);}
      return {count:array.length,manualRms:Math.sqrt(sum/array.length),reported:resumeAudioMeter.snapshot().waveformRms,min,max};
    }''')
    assert evidence['count']==2048 and abs(evidence['manualRms']-evidence['reported'])<1e-12
    assert evidence['min']<0<evidence['max']
    page.screenshot(path=str(OUT/'playing.png'));page.locator('#audioMeter').screenshot(path=str(OUT/'meter-playing.png'))
    result['playing']={'rmsMin':min(active_rms),'rmsMax':max(active_rms),'distinctSamples':len({round(value,5) for value in active_rms}),'waveform':evidence}
    result['samples']=values
    # The bar must follow waveform energy rather than merely the playing flag.
    page.evaluate('window.resumeAudioControl.connection.gain.gain.value=0')
    page.wait_for_timeout(120)
    assert page.evaluate('window.resumeAudioControl.snapshot().actualPlaying')
    assert meter()['rms']<1e-6,meter()
    result['silentWhilePlaying']=meter()
    page.evaluate('window.resumeAudioControl.connection.gain.gain.value=.18');wait_play();page.wait_for_timeout(150)
    assert page.evaluate('window.resumeAudioMeter.waveform===window.originalWaveform')
    # Pause: raw input becomes zero, the displayed bar releases smoothly, then the RAF stops.
    before_pause=meter();page.locator('#audioToggle').click()
    assert meter()['rms']==0,'Paused input must become zero immediately'
    page.wait_for_function('window.resumeAudioMeter.snapshot().rms===0')
    pause_start=meter();page.wait_for_timeout(150);pause_middle=meter()
    assert 0<pause_middle['level']<pause_start['level']<=before_pause['level']+.05,(before_pause,pause_start,pause_middle)
    page.locator('#audioMeter').screenshot(path=str(OUT/'meter-falling.png'))
    wait_zero();paused=meter();page.wait_for_timeout(150)
    assert meter()['sampleCount']==paused['sampleCount']
    assert page.locator('#audioRmsValue').text_content()=='0.0000'
    page.screenshot(path=str(OUT/'paused.png'));page.locator('#audioMeter').screenshot(path=str(OUT/'meter-paused.png'))
    result['pause']={'before':before_pause,'start':pause_start,'middle':pause_middle,'settled':paused}
    # Ordinary toggles and dense clicking neither rebuild the analyser nor allocate another waveform buffer.
    for _ in range(4):
        page.locator('#audioToggle').click();wait_play();page.locator('#audioToggle').click()
    page.evaluate('()=>{for(let i=0;i<31;i++)document.getElementById("audioToggle").click();}')
    wait_play()
    same=page.evaluate('''()=>{const graph=resumeAudioControl.connection;return graph.context===originalGraph.context && graph.source===originalGraph.source && graph.gain===originalGraph.gain && graph.analyser===originalGraph.analyser && resumeAudioMeter.analyser===graph.analyser && resumeAudioMeter.waveform===originalWaveform && resumeAudioControl.audio===originalAudio;}''')
    assert same
    stats=page.evaluate('window.graphStats')
    assert stats=={'contexts':1,'sources':1,'gains':1,'analysers':1,'connections':3},stats
    assert meter()['bufferAllocations']==1
    result['reuse']={'stats':stats,'sameObjects':same,'bufferAllocations':meter()['bufferAllocations'],'rapidClicks':31}
    # An unavailable output produces zero effective RMS, and resumes through the same context/analyser.
    page.evaluate('window.resumeAudioControl.connection.context.suspend()')
    page.wait_for_function('window.resumeAudioMeter.snapshot().rms===0')
    assert not page.evaluate('window.resumeAudioControl.snapshot().actualPlaying')
    page.evaluate('window.resumeAudioControl.connection.context.resume()');wait_play()
    assert page.evaluate('window.resumeAudioMeter.analyser===window.originalGraph.analyser')
    result['contextSuspendResume']=True
    page.locator('#audioToggle').click();wait_zero()
    assert visual_hashes()==original_hashes,'Audio analysis changed scene canvas pixels'
    assert page.evaluate('window.resumeChapterScene.snapshot().current')==original_scene
    result['sceneUnchanged']={'canvasHashes':original_hashes,'chapterParametersEqual':True}
    # Paused, loading and failed playback do not fabricate a nonzero reading.
    page.evaluate('()=>{window.resumeAudioControl.audio.play=()=>Promise.reject(new DOMException("Verification refusal","NotAllowedError"));}')
    page.locator('#audioToggle').click();page.wait_for_function('window.resumeAudioControl.snapshot().state==="error"');wait_zero()
    assert meter()['rms']==0
    page.evaluate('delete window.resumeAudioControl.audio.play')
    page.locator('#audioToggle').click();wait_play();page.locator('#audioToggle').click();wait_zero()
    result['failureAndRetry']=True
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    box=page.locator('#audioMeter').bounding_box();assert box['x']>=0 and box['x']+box['width']<=390
    page.screenshot(path=str(OUT/'mobile.png'))
    assert not errors and not failed,(errors,failed)
    result['singleAudioElement']=page.locator('audio').count();assert result['singleAudioElement']==1
    result['browserErrors']=errors;result['failedResources']=failed
    browser.close()
(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in result.items() if key not in ['samples','pause','sceneUnchanged']},ensure_ascii=False,indent=2))
