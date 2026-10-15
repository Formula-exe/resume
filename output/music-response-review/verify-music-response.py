from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageDraw,ImageFont
import hashlib,json,math

ROOT=Path('D:/编程/个人简历');OUT=ROOT/'output/music-response-review'
result={};errors=[];failed=[]
STATS='''window.graphStats={contexts:0,sources:0,gains:0,analysers:0,connections:0};const Context=window.AudioContext;
window.AudioContext=new Proxy(Context,{construct(target,args){graphStats.contexts++;return Reflect.construct(target,args);}});
for(const [name,key,prototype] of [['createMediaElementSource','sources',Context.prototype],['createGain','gains',BaseAudioContext.prototype],['createAnalyser','analysers',BaseAudioContext.prototype]]){const fn=prototype[name];prototype[name]=function(...args){graphStats[key]++;return fn.apply(this,args);};}
const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){graphStats.connections++;return connect.apply(this,args);};'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1,reduced_motion='no-preference',permissions=['clipboard-read','clipboard-write'])
    page=context.new_page();page.add_init_script(STATS)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append([r.status,r.url]) if r.status>=400 else None)
    page.goto('http://127.0.0.1:8765/?audioStars=on',wait_until='networkidle')
    page.wait_for_function('window.portraitLighting && window.resumeAudioStars && resumeChapterScene.snapshot().settled')
    page.wait_for_timeout(600)
    def state():return page.evaluate('resumeAudioStars.snapshot()')
    def play():
        page.locator('#audioToggle').click()
        page.wait_for_function('resumeAudioControl.snapshot().actualPlaying && resumeAudioMeter.snapshot().rms>0')
    def seek(time):
        page.evaluate('(time)=>{siteAudio.currentTime=time}',time)
        page.wait_for_function('(time)=>!siteAudio.seeking && siteAudio.currentTime>=time && siteAudio.currentTime<time+.3',arg=time)
    def chapter(name):
        page.evaluate('(name)=>document.getElementById(name).scrollIntoView({behavior:"instant"})',name)
        page.wait_for_function('(name)=>resumeChapterScene.snapshot().section===name && resumeChapterScene.snapshot().settled',arg=name)
    def data():return page.evaluate('({mediaTime:siteAudio.currentTime,visual:resumeAudioStars.snapshot(),meter:resumeAudioMeter.snapshot(),portrait:portraitLighting.snapshot().audio,meteors:resumeMusicEffects.snapshot()})')
    original_geometry=page.evaluate('resumeStarfield.snapshot().geometry')
    original_camera=page.evaluate('portraitLighting.snapshot().camera')
    fingerprints=page.evaluate('portraitLighting.fingerprints()')
    frozen=page.evaluate('({signature:signatureCanvas.toDataURL(),stars:starfieldCanvas.toDataURL(),near:audioStarCanvas.toDataURL()})')
    original_copy=page.locator('.hero-copy').inner_text()
    assert page.evaluate('graphStats.contexts')==0 and page.locator('audio').count()==1
    play();page.wait_for_function('resumeMusicAnalysis.snapshot().status==="ready"')
    page.evaluate('window.originalConnection=resumeAudioControl.connection;window.originalWaveform=resumeAudioMeter.waveform;window.originalFrequency=resumeAudioMeter.frequency;window.originalAudio=siteAudio;')
    profile=page.evaluate('resumeMusicAnalysis.snapshot()')
    assert profile['sourceHash']==hashlib.sha256((ROOT/'assets/audio/moonlight-scott-buckley.mp3').read_bytes()).hexdigest()
    assert profile['calibrated'] and profile['manualCueCount']==6 and profile['onsetCount']>100
    result['analysis']=profile
    print('Analysis ready; source identity verified.',flush=True)

    # Same music excerpt twice, with no media element or graph replacement.
    captures={}
    for enabled,name in [(False,'off'),(True,'on')]:
        page.evaluate('(value)=>resumeAudioStars.setEnabled(value)',enabled);seek(103.6)
        page.wait_for_function('siteAudio.currentTime>=105.8',polling='raf')
        captures[name]=data();page.screenshot(path=str(OUT/f'hero-{name}.png'))
    assert abs(captures['on']['mediaTime']-captures['off']['mediaTime'])<.08
    assert captures['off']['visual']['currentBrightness']==1
    assert captures['on']['visual']['currentBrightness']>1.15
    assert captures['on']['meteors']['active'] and len(captures['on']['meteors']['active'])==1
    assert captures['on']['meteors']['active'][0]['x']>1600*.54
    result['heroComparison']=captures
    off=Image.open(OUT/'hero-off.png').convert('RGB');on=Image.open(OUT/'hero-on.png').convert('RGB')
    box=page.locator('.hero-copy').bounding_box();rect=tuple(round(v) for v in [box['x'],box['y'],box['x']+box['width'],box['y']+box['height']])
    assert ImageChops.difference(off.crop(rect),on.crop(rect)).getbbox() is None
    result['heroCopyPixelsIdentical']=True
    live=page.evaluate('''async()=>{const rows=[];for(let i=0;i<70;i++){rows.push({time:siteAudio.currentTime,...resumeAudioMeter.snapshot(),visual:resumeAudioStars.snapshot().current});await new Promise(r=>setTimeout(r,20));}return rows;}''')
    for band in ['low','middle','high']:
        values=[row['bands'][band] for row in live]
        assert max(values)>.02 and max(values)-min(values)>.008,(band,min(values),max(values))
    assert max(row['visual']['accent'] for row in live)>.015
    result['liveBands']={name:{'min':min(row['bands'][name] for row in live),'max':max(row['bands'][name] for row in live)} for name in ['low','middle','high']}
    result['liveSamples']=live
    assert page.locator('[data-audio-band]').count()==3
    print('Three live bands, onset accent, meteor and unchanged hero copy verified.',flush=True)

    # Media-time synchronisation and backward seek, rather than elapsed wall-clock cues.
    time_checks=[]
    for position in [30,120,165,245,45.8,5]:
        seek(position);page.wait_for_timeout(120);sample=data()
        assert abs(sample['mediaTime']-sample['visual']['features']['time'])<.04
        if position in [30,165,245,5]:assert not sample['meteors']['active']
        time_checks.append(sample)
    result['mediaTimeAndBackwardSeek']=time_checks

    chapter('about')
    portrait_captures={}
    for enabled,name in [(False,'off'),(True,'on')]:
        page.evaluate('(value)=>resumeAudioStars.setEnabled(value)',enabled);seek(69.1)
        page.wait_for_function('siteAudio.currentTime>=70.4',polling='raf')
        portrait_captures[name]=data();page.screenshot(path=str(OUT/f'portrait-{name}.png'))
    assert abs(portrait_captures['on']['mediaTime']-portrait_captures['off']['mediaTime'])<.1
    assert portrait_captures['on']['portrait']['drawnEnergy']>.03
    assert portrait_captures['off']['portrait']['energy']==0
    assert portrait_captures['on']['visual']['sectionGain']==.25
    assert not portrait_captures['on']['meteors']['active']
    about_box=page.locator('.chapter-about-copy').bounding_box()
    about_rect=tuple(round(v) for v in [about_box['x'],about_box['y'],about_box['x']+about_box['width'],about_box['y']+about_box['height']])
    a=Image.open(OUT/'portrait-off.png').convert('RGB');b=Image.open(OUT/'portrait-on.png').convert('RGB')
    assert ImageChops.difference(a.crop(about_rect),b.crop(about_rect)).getbbox() is None
    assert ImageChops.difference(a.crop((850,130,1530,890)),b.crop((850,130,1530,890))).getbbox() is not None
    result['portraitComparison']=portrait_captures;result['aboutCopyPixelsIdentical']=True
    heights=[]
    for position,name in [(14,'low'),(72,'high')]:
        seek(position);page.wait_for_timeout(800);row=data();heights.append(row)
        page.screenshot(path=str(OUT/f'register-{name}.png'))
    assert abs(heights[0]['portrait']['height']-heights[1]['portrait']['height'])>.1
    result['registerHeight']=heights
    assert page.evaluate('portraitLighting.fingerprints()')==fingerprints
    assert page.evaluate('portraitLighting.snapshot().camera')==original_camera
    assert page.evaluate('portraitLighting.snapshot().particleCount')==36000
    result['frozenPortrait']={'fingerprints':fingerprints,'cameraUnchanged':True,'particleCount':36000,'contourParticles':page.evaluate('portraitLighting.snapshot().audio.contourParticles')}
    print('Portrait contour band changes height; geometry, camera and reading pixels stay fixed.',flush=True)

    chapter('projects');seek(104.8);page.wait_for_timeout(900)
    assert state()['sectionGain']==.12 and state()['currentBrightness']<1.09
    assert not page.evaluate('resumeMusicEffects.snapshot().active')
    buttons=page.locator('#projectList button');buttons.nth(0).focus();page.keyboard.press('Enter')
    first=page.locator('#projectDetailTitle').inner_text();page.keyboard.press('ArrowDown');second=page.locator('#projectDetailTitle').inner_text()
    assert first!=second;page.keyboard.press('Escape');assert page.locator('#projectDetail').is_hidden()
    page.screenshot(path=str(OUT/'projects-reading.png'))
    result['projectsReading']={'gain':state()['sectionGain'],'brightness':state()['currentBrightness'],'noMeteors':True,'keyboardSwitchAndClose':True}

    chapter('top');seek(104.9);page.wait_for_function('siteAudio.currentTime>105.6')
    before=data();page.locator('#audioToggle').click();start=data();page.wait_for_timeout(180);middle=data()
    assert 1<middle['visual']['currentBrightness']<start['visual']['currentBrightness']
    assert middle['visual']['current']['energy']<start['visual']['current']['energy']
    page.wait_for_function('resumeAudioStars.snapshot().currentBrightness===1 && resumeAudioStars.snapshot().pendingFrames===0',timeout=9000)
    settled=data();assert settled['portrait']['energy']==0 and not settled['meteors']['active']
    assert all(settled['visual']['current'][key]==0 for key in ['energy','accent','arrangement','meteor'])
    result['pauseRelease']={'start':start,'middle':middle,'settled':settled}
    play();page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('!resumeAudioStars.snapshot().enabled && resumeAudioStars.snapshot().currentBrightness===1')
    bars=page.locator('[data-audio-band]').evaluate_all('(nodes)=>nodes.map(node=>node.style.transform)')
    time_before=page.evaluate('siteAudio.currentTime');page.wait_for_timeout(250)
    assert page.evaluate('resumeAudioControl.snapshot().actualPlaying && siteAudio.currentTime>'+str(time_before))
    assert page.locator('[data-audio-band]').evaluate_all('(nodes)=>nodes.map(node=>node.style.transform)')==bars
    assert not page.evaluate('resumeMusicEffects.snapshot().active') and page.evaluate('portraitLighting.snapshot().audio.energy')==0
    page.locator('#audioToggle').click();play()
    assert state()['pendingFrames']==0 and not page.locator('#audioToggle').is_disabled()
    page.screenshot(path=str(OUT/'reduced-motion.png'))
    result['reducedMotion']={'visualsStatic':True,'frequencyBarsStatic':True,'manualPlaybackWorks':True,'sameMusicKeepsAdvancing':True}
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_function('resumeAudioStars.snapshot().enabled')

    # Change to another real file on the exact same element/graph. No Moonlight cue survives.
    page.evaluate('resumeAudioControl.pause();siteAudio.src=new URL("assets/audio/ambient-test.wav",location.href).href;siteAudio.load();')
    play();page.wait_for_function('resumeMusicAnalysis.snapshot().status==="ready-uncalibrated"',timeout=15000)
    changed=page.evaluate('({analysis:resumeMusicAnalysis.snapshot(),sample:resumeMusicAnalysis.sample(105.8),visual:resumeAudioStars.snapshot()})')
    assert changed['analysis']['sourceHash']!=profile['sourceHash']
    assert not changed['analysis']['calibrated'] and changed['analysis']['manualCueCount']==0
    assert changed['sample']['phase'] is None and changed['sample']['meteors']==[]
    assert changed['sample']['available'] and changed['analysis']['featureFrames']>0
    assert not page.evaluate('resumeMusicEffects.snapshot().active')
    result['newTrackReanalysis']=changed
    page.evaluate('resumeAudioControl.pause();siteAudio.src=new URL(RESUME_AUDIO_CONFIG.source,location.href).href;siteAudio.load();')
    play();page.wait_for_function('resumeMusicAnalysis.snapshot().status==="ready"')
    # Dense playback toggles must not rebuild any node, analyser or FFT buffer.
    page.evaluate('()=>{for(let i=0;i<20;i++)document.getElementById("audioToggle").click();}')
    page.wait_for_function('resumeAudioControl.snapshot().actualPlaying')
    same=page.evaluate('''()=>{const graph=resumeAudioControl.connection;return graph.context===originalConnection.context && graph.source===originalConnection.source && graph.gain===originalConnection.gain && graph.analyser===originalConnection.analyser && resumeAudioMeter.waveform===originalWaveform && resumeAudioMeter.frequency===originalFrequency && siteAudio===originalAudio;}''')
    stats=page.evaluate('graphStats')
    assert same and stats=={'contexts':1,'sources':1,'gains':1,'analysers':1,'connections':3},stats
    assert page.evaluate('resumeAudioMeter.snapshot().bufferAllocations===1 && resumeAudioMeter.snapshot().frequencyAllocations===1')
    assert page.locator('audio').count()==1
    result['reuse']={'sameObjects':same,'stats':stats,'waveformAndFrequencyAllocations':1,'singleAudioElement':True}
    assert page.evaluate('resumeStarfield.snapshot().geometry')==original_geometry
    current_frozen=page.evaluate('({signature:signatureCanvas.toDataURL(),stars:starfieldCanvas.toDataURL(),near:audioStarCanvas.toDataURL()})')
    assert frozen==current_frozen
    assert page.locator('.hero-copy').inner_text()==original_copy
    result['existingContentAndStaticLayersUnchanged']=True

    page.locator('#audioToggle').click();page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(450)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#audioToggle').is_visible() and page.locator('#audioStarsToggle').is_visible()
    page.screenshot(path=str(OUT/'mobile.png'))
    result['mobile']={'noHorizontalOverflow':True,'audioAndVisualButtonsVisible':True}
    assert not errors and not failed,(errors,failed)
    result['browserErrors']=errors;result['failedResources']=failed
    browser.close()

(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in result.items() if key not in ['liveSamples','heroComparison','portraitComparison','pauseRelease','registerHeight','mediaTimeAndBackwardSeek','newTrackReanalysis']},ensure_ascii=False,indent=2),flush=True)

# Same-view captures, genuine screenshot pixels only.
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
board=Image.new('RGB',(1640,1250),'#080c12');draw=ImageDraw.Draw(board)
draw.text((20,16),'同一首 Moonlight · 三层音乐响应',font=font,fill='#eeeae2')
for row,(prefix,label) in enumerate([('hero','首屏：105.8 秒 · 三频段 / 星光 / 编排流星'),('portrait','关于：70.4 秒 · 人物轮廓随音区变化')]):
    y=65+row*580;draw.text((20,y),label,font=small,fill='#b4c6df')
    for column,(mode,title) in enumerate([('off','关闭音乐视觉'),('on','开启音乐视觉')]):
        x=20+column*810;draw.text((x,y+33),title,font=small,fill='#e7c19b')
        image=Image.open(OUT/f'{prefix}-{mode}.png').convert('RGB').resize((800,500),Image.Resampling.LANCZOS)
        board.paste(image,(x,y+66))
board.save(OUT/'comparison.png')
