"""Windows Edge browser simulations; no physical phone is connected by this script."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw,ImageFont
import json,time

ROOT=Path('D:/编程/个人简历');OUT=Path(__file__).parent
URL='http://127.0.0.1:8765/'
results={'method':'Windows Edge/Chromium headless; SwiftShader; browser viewport/DPR/touch/reduced-motion emulation','physicalPhone':'Not tested; no physical device connected','cases':{}}
errors=[]
STATS='''window.graphStats={contexts:0,sources:0,gains:0,analysers:0,connections:0};const Context=window.AudioContext;
window.AudioContext=new Proxy(Context,{construct(target,args){graphStats.contexts++;return Reflect.construct(target,args);}});
for(const [name,key,prototype] of [['createMediaElementSource','sources',Context.prototype],['createGain','gains',BaseAudioContext.prototype],['createAnalyser','analysers',BaseAudioContext.prototype]]){const fn=prototype[name];prototype[name]=function(...args){graphStats[key]++;return fn.apply(this,args);};}
const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){graphStats.connections++;return connect.apply(this,args);};'''
READY='window.resumeVisualRuntime && resumeVisualRuntime.snapshot().components.length===8 && resumeVisualRuntime.snapshot().components.every(c=>!c.pending) && window.resumeChapterScene && resumeChapterScene.snapshot().settled'

def ready(page):
    page.wait_for_function(READY,timeout=15000);page.wait_for_timeout(350)
def state(page):return page.evaluate('resumeVisualRuntime.snapshot()')
def component(s,name):return next(c for c in s['components'] if c['name']==name)
def chapter(page,name):
    page.evaluate('(id)=>document.getElementById(id).scrollIntoView({behavior:"instant"})',name)
    page.wait_for_function('(id)=>resumeChapterScene.snapshot().section===id && resumeChapterScene.snapshot().settled',arg=name);page.wait_for_timeout(160)
def project_check(page):
    chapter(page,'projects');buttons=page.locator('#projectList button');titles=[]
    for index in [0,1]:
        buttons.nth(index).focus();page.keyboard.press('Enter');page.wait_for_timeout(150)
        assert page.locator('#projectDetail').is_visible()
        assert page.locator('#projectConstellation').get_attribute('data-project-id')==buttons.nth(index).get_attribute('data-project-id')
        assert page.locator('#projectDetailLinks a').count()>0
        assert page.locator('#projectDetailLinks a').first.get_attribute('href')
        titles.append(page.locator('#projectDetailTitle').inner_text())
    page.keyboard.press('Escape');assert page.locator('#projectDetail').is_hidden()
    assert page.evaluate('document.activeElement===document.querySelectorAll("#projectList button")[1]')
    return titles
def text_and_links(page):
    assert page.locator('#phoneBtn').get_attribute('href')=='tel:13469606367'
    assert '江苏科技大学' in page.locator('#heroSummary').inner_text()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#heroSummary').evaluate('(el)=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r)}')
    assert '江苏科技大学' in page.evaluate('getSelection().toString()')
    page.evaluate('getSelection().removeAllRanges()')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--enable-unsafe-swiftshader'])
    def open_page(width,height,dpr=1,reduced='no-preference',script=None,url=URL):
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,is_mobile=width<=1024,has_touch=width<=1024,reduced_motion=reduced,permissions=['clipboard-read','clipboard-write'])
        page=context.new_page();page.add_init_script(STATS)
        if script:page.add_init_script(script)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url,wait_until='networkidle');ready(page)
        return context,page

    # Mobile composition uses the same real HTML, with the actor below the copy.
    for name,w,h,dpr in [('320',320,568,2),('390',390,844,3),('430',430,932,3),('landscape',844,390,2)]:
        context,page=open_page(w,h,dpr);s=state(page);text_and_links(page)
        assert s['settings']['mode']=='low'
        assert s['settings']['pixelRatio']==1 and not s['settings']['postProcessing']
        assert component(s,'signature')['resources']['particleCount']==4500
        assert component(s,'portrait')['resources']['particleCount']==9000
        assert page.locator('#portraitBloom').count()==0
        if w<=760:
            bounds=page.evaluate('(()=>{const copy=document.querySelector(".hero-copy").getBoundingClientRect(),actor=chapterSignature.getBoundingClientRect();return {copyBottom:copy.bottom,actorTop:actor.top}})()')
            assert bounds['actorTop']>=bounds['copyBottom']-1,bounds
        page.screenshot(path=str(OUT/f'mobile-{name}-hero.png'),scale='css')
        chapter(page,'about')
        if w<=760:
            bounds=page.evaluate('(()=>{const copy=document.querySelector(".chapter-about-copy").getBoundingClientRect(),actor=chapterPortrait.getBoundingClientRect();return {copyBottom:copy.bottom,actorTop:actor.top}})()')
            assert bounds['actorTop']>=bounds['copyBottom']+15,bounds
        page.screenshot(path=str(OUT/f'mobile-{name}-about.png'),scale='css')
        cases={'settings':s['settings'],'signature':component(s,'signature')['resources'],'portrait':component(s,'portrait')['resources'],'noHorizontalOverflow':True,'projects':project_check(page)}
        if name=='390':
            chapter(page,'top');page.locator('#menuToggle').click();page.locator('#visualSettingsMobile').click()
            assert page.locator('#visualSettingsDialog').is_visible()
            page.locator('#visualQualitySelect').select_option('static');ready(page)
            assert state(page)['settings']['mode']=='static' and page.locator('#visualPostToggle').is_disabled()
            page.keyboard.press('Escape');assert not page.locator('#visualSettingsDialog').is_visible()
            page.wait_for_function('document.activeElement.id==="menuToggle"')
            page.locator('#menuToggle').click() if page.locator('#menuToggle').get_attribute('aria-expanded')=='true' else None
            page.screenshot(path=str(OUT/'mobile-static-hero.png'),scale='css')
            chapter(page,'about');page.screenshot(path=str(OUT/'mobile-static-about.png'),scale='css')
            assert page.locator('canvas').count()==1 # only an unused project canvas, without a GL context
            assert page.evaluate('[...document.querySelectorAll(".visual-static-image")].every(i=>i.complete&&i.naturalWidth>0)')
            cases['staticProjects']=project_check(page);cases['settingsKeyboard']=True
        results['cases'][name]=cases;context.close()
        print('Composition:',name,flush=True)

    # Desktop density and real GPU resource disposal. Audio remains the same single graph.
    context,page=open_page(1600,1000,2)
    standard=state(page);assert component(standard,'portrait')['resources']['particleCount']==36000
    assert standard['settings']['pixelRatio']==1.5
    portrait=component(standard,'portrait')['resources'];assert portrait['buffer'][0]<=round(690*1.5)
    assert not portrait['bloom']['created']
    results['standard']=standard
    page.screenshot(path=str(OUT/'desktop-standard.png'),scale='css')
    page.locator('#audioToggle').click();page.wait_for_function('resumeAudioControl.snapshot().actualPlaying && resumeAudioMeter.snapshot().rms>0')
    page.evaluate('window.savedConnection=resumeAudioControl.connection;window.savedAudio=siteAudio;window.savedWaveform=resumeAudioMeter.waveform;window.savedFrequency=resumeAudioMeter.frequency')
    page.wait_for_function('resumeMusicAnalysis.snapshot().status==="ready"')
    page.evaluate('siteAudio.currentTime=105;resumeAudioStars.setEnabled(false)')
    assert page.evaluate('resumeAudioStars.snapshot().currentBrightness')==1
    page.evaluate('resumeAudioStars.setEnabled(true)')
    page.wait_for_function('resumeAudioStars.snapshot().currentBrightness>1.05')
    results['musicVisualRegression']={'enabledBrightness':page.evaluate('resumeAudioStars.snapshot().currentBrightness'),'sameAudioStillPlaying':page.evaluate('resumeAudioControl.snapshot().actualPlaying')}
    chapter(page,'about')
    page.evaluate('resumeVisualRuntime.setPostProcessing(true)');ready(page)
    bloom=state(page);assert component(bloom,'portrait')['resources']['bloom']['created']
    assert page.locator('#portraitBloom').count()==1
    page.screenshot(path=str(OUT/'desktop-bloom.png'),scale='css')
    page.evaluate('resumeVisualRuntime.setPostProcessing(false)');ready(page)
    assert page.locator('#portraitBloom').count()==0
    assert component(state(page),'portrait')['lastDisposed']['memory']=={'geometries':0,'textures':0}
    results['bloom']={'enabled':component(bloom,'portrait')['resources']['bloom'],'disposedAfterDisable':component(state(page),'portrait')['lastDisposed']}
    page.evaluate('resumeVisualRuntime.setMode("low")');ready(page)
    low=state(page);assert component(low,'portrait')['resources']['particleCount']==9000
    assert component(low,'signature')['resources']['particleCount']==4500
    assert low['settings']['pixelRatio']==1 and not low['settings']['postProcessing']
    results['desktopLow']=low
    page.screenshot(path=str(OUT/'desktop-low-about.png'),scale='css')
    assert page.evaluate('Object.keys(savedConnection).every(key=>savedConnection[key]===resumeAudioControl.connection[key]) && savedAudio===siteAudio && savedWaveform===resumeAudioMeter.waveform && savedFrequency===resumeAudioMeter.frequency')

    before=state(page)
    page.evaluate('for(let i=0;i<25;i++)resumeVisualRuntime.init()');ready(page)
    assert state(page)['mounts']==before['mounts']
    page.evaluate('''async()=>{for(const path of ['particle-signature.js','project-constellations.js','chapter-scene.js','output/portrait-lighting-review/portrait-lighting.js'])await import('/'+path+'?duplicate=1');}''');ready(page)
    page.evaluate('''async()=>{for(const path of ['site-motion.js','site-enhancements.js','project-explorer.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+path+'?duplicate=1';script.onload=resolve;script.onerror=reject;document.body.append(script);});}''')
    assert page.locator('#mobileNav').count()==1 and page.locator('.gallery-controls').count()==1
    assert state(page)['mounts']==before['mounts']
    assert page.locator('#signatureCanvas').count()==1 and page.locator('#portraitBase').count()==1
    for mode in ['standard','low','static','standard','static','low']:
        page.evaluate('(m)=>resumeVisualRuntime.setMode(m)',mode);ready(page)
    # Abort while async font/geometry creation is still pending.
    page.evaluate('for(let i=0;i<10;i++){resumeVisualRuntime.setMode("standard");resumeVisualRuntime.setMode("static");}resumeVisualRuntime.setMode("low")');ready(page)
    assert page.locator('#signatureCanvas').count()==1 and page.locator('#portraitBase').count()==1
    assert page.locator('#musicPhaseStatus').count()==1 and page.locator('#visualSettingsDialog').count()==1
    results['idempotence']={'initCalls':25,'duplicateModuleImports':4,'duplicateCoreScriptLoads':3,'qualitySwitches':27,'canvases':page.locator('canvas').count(),'runtime':state(page)}
    print('Modes, Bloom, duplicate initialization and pending-init abort verified.',flush=True)

    # Headless tabs do not provide real OS tab visibility; inject the visibility signal explicitly.
    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"))')
    page.wait_for_timeout(250);hidden=state(page)
    assert all(s['frames']==0 and s['timers']==0 for s in hidden['scopes']),hidden['scopes']
    sample_count=page.evaluate('resumeAudioMeter.snapshot().sampleCount');render_count=component(hidden,'portrait')['resources']['renderCount']
    page.wait_for_timeout(400)
    assert page.evaluate('resumeAudioMeter.snapshot().sampleCount')==sample_count
    assert component(state(page),'portrait')['resources']['renderCount']==render_count
    assert page.evaluate('resumeAudioMeter.snapshot().pendingFrames')==0
    page.evaluate('delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event("visibilitychange"))')
    page.wait_for_function('(n)=>resumeAudioMeter.snapshot().sampleCount>n',arg=sample_count)
    assert page.evaluate('resumeAudioStars.snapshot().lastDeltaTime<=.05 && resumeChapterScene.snapshot().lastDeltaTime<=.05')
    results['visibilitySignalSimulation']={'method':'Synthetic document.hidden/visibilityState plus visibilitychange; NOT a physical phone background test','hidden':hidden,'restored':state(page)}
    # The browser itself suspends and resumes timers/RAF in the frozen lifecycle state.
    cdp=context.new_cdp_session(page)
    cdp.send('Page.setWebLifecycleState',{'state':'frozen'});time.sleep(.5);cdp.send('Page.setWebLifecycleState',{'state':'active'})
    page.wait_for_timeout(300)
    assert page.evaluate('resumeAudioStars.snapshot().lastDeltaTime<=.05')
    results['browserLifecycleFreeze']={'method':'Chromium DevTools Page.setWebLifecycleState frozen/active, 500 ms','restored':True,'singleAudio':page.locator('audio').count()==1,'maxDeltaTime':page.evaluate('resumeAudioStars.snapshot().lastDeltaTime')}
    page.emulate_media(reduced_motion='reduce');ready(page)
    reduced=state(page);assert reduced['settings']['mode']=='static' and reduced['settings']['reason']=='reduced-motion'
    assert page.locator('#signatureCanvas,#portraitBase,#portraitBloom').count()==0
    assert page.evaluate('resumeAudioControl.snapshot().actualPlaying && !resumeAudioStars.snapshot().enabled')
    page.locator('#audioToggle').click();page.wait_for_function('!resumeAudioControl.snapshot().actualPlaying')
    page.locator('#audioToggle').click();page.wait_for_function('resumeAudioControl.snapshot().actualPlaying')
    results['reducedMotion']={'runtime':reduced,'activePlayPause':True,'graph':page.evaluate('graphStats')}
    page.emulate_media(reduced_motion='no-preference');ready(page)
    assert state(page)['settings']['mode']=='low'
    page.evaluate('resumeAudioControl.pause()');page.wait_for_function('!resumeAudioControl.snapshot().actualPlaying')
    results['projectsAfterRestore']=project_check(page)

    # Keep actual HTML and the audio connection when explicitly releasing visual resources.
    page.evaluate('resumeVisualRuntime.dispose()');page.wait_for_timeout(350)
    disposed=state(page);assert not disposed['active'] and not disposed['scopes']
    assert page.locator('canvas').count()==0
    assert page.evaluate('ScrollTrigger.getAll().length')==0
    assert page.evaluate('resumeAudioMeter.snapshot().pendingFrames')==0
    for name in ['signature','portrait','projects']:
        resources=component(disposed,name)['lastDisposed']
        assert resources['memory']=={'geometries':0,'textures':0},(name,resources)
        assert resources['programs']==0 and not resources['canvasConnected'],(name,resources)
    text_and_links(page)
    page.locator('#audioToggle').click();page.wait_for_function('resumeAudioControl.snapshot().actualPlaying')
    assert page.evaluate('resumeAudioMeter.snapshot().pendingFrames')==0
    page.evaluate('resumeVisualRuntime.init()');ready(page)
    assert page.locator('#signatureCanvas').count()==1 and page.locator('#portraitBase').count()==1
    assert page.evaluate('Object.keys(savedConnection).every(key=>savedConnection[key]===resumeAudioControl.connection[key]) && savedAudio===siteAudio && savedWaveform===resumeAudioMeter.waveform && savedFrequency===resumeAudioMeter.frequency')
    assert page.evaluate('graphStats')=={'contexts':1,'sources':1,'gains':1,'analysers':1,'connections':3}
    results['release']={'disposed':disposed,'reinitialized':state(page),'sameAudioGraph':page.evaluate('graphStats')}
    page.evaluate('resumeAudioControl.pause()')
    # Real GPU context loss on this emulated browser; recovery uses static assets then explicit retry.
    page.evaluate('signatureCanvas.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
    page.wait_for_function('resumeVisualRuntime.settings().reason==="graphics-unavailable"');ready(page)
    assert state(page)['settings']['mode']=='static'
    results['contextLoss']={'fallback':state(page),'projects':project_check(page)}
    page.evaluate('document.getElementById("visualRetry").click()');ready(page)
    assert not state(page)['failure'] and state(page)['settings']['mode']=='low'
    results['contextLoss']['retryRecovered']=True
    context.close();print('Visibility, reduced motion, graph reuse, disposal and context-loss recovery verified.',flush=True)

    no_gl='''const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl/.test(kind)?null:original.call(this,kind,...args)};'''
    context,page=open_page(390,844,3,script=no_gl)
    assert state(page)['settings']['mode']=='static' and state(page)['failure']
    text_and_links(page);results['noWebGL']={'state':state(page),'projects':project_check(page)}
    chapter(page,'top');page.screenshot(path=str(OUT/'mobile-no-webgl.png'),scale='css')
    context.close()
    # Direct middle-chapter load and reload, with native hash navigation back to the top.
    context,page=open_page(390,844,3,url=URL+'#about')
    page.wait_for_function('resumeChapterScene.snapshot().section==="about" && resumeChapterScene.snapshot().settled')
    page.reload(wait_until='networkidle');ready(page)
    assert page.evaluate('resumeChapterScene.snapshot().section')=='about'
    page.locator('#menuToggle').click();page.locator('#mobileNav a[href="#top"]').click() if page.locator('#mobileNav a[href="#top"]').count() else page.locator('.brand').click()
    page.wait_for_function('resumeChapterScene.snapshot().section==="top" && resumeChapterScene.snapshot().settled')
    results['middleRefreshAndUpNavigation']=True;context.close();browser.close()

assert not errors,errors
results['pageErrors']=errors;results['passed']=True
(OUT/'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
# Same-size CSS screenshots, clearly labelled as simulated phone viewports.
images=[Image.open(OUT/name).convert('RGB') for name in ['mobile-390-hero.png','mobile-390-about.png','mobile-static-about.png']]
sheet=Image.new('RGB',(390*3+24*4,844+100),(8,12,20));draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
for index,(img,label) in enumerate(zip(images,['390px · 手机低负载 / 首屏','390px · 手机低负载 / 关于','390px · 静态背景 / 关于'])):
    x=24+index*414;draw.text((x,18),label,font=font,fill=(232,220,202));sheet.paste(img,(x,58))
draw.text((24,910),'Windows Edge 浏览器模拟 · 未使用手机真机',font=font,fill=(160,179,205));sheet.save(OUT/'mobile-comparison.png')
print('PASS — browser simulations only; physical phone NOT tested.',flush=True)
