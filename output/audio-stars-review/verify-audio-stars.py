from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageDraw, ImageFont
import hashlib, json, math, re, time

ROOT = Path('D:/编程/个人简历')
OUT = ROOT / 'output/audio-stars-review'
OUT.mkdir(parents=True, exist_ok=True)
MUSIC = (ROOT / 'assets/audio/moonlight-scott-buckley.mp3').read_bytes()
results = {}; errors = []; failed = []

# Python's existing SimpleHTTP server has no byte-range support. Supply Range for the
# identical local MP3 in this test browser only, so both takes can seek to the same excerpt.
def range_audio(route):
    match = re.match(r'bytes=(\d+)-(\d*)', route.request.headers.get('range', ''))
    headers = {'Accept-Ranges': 'bytes', 'Content-Type': 'audio/mpeg'}
    if match:
        start = int(match[1]); end = min(int(match[2]) if match[2] else len(MUSIC)-1, len(MUSIC)-1)
        headers['Content-Range'] = f'bytes {start}-{end}/{len(MUSIC)}'
        route.fulfill(status=206, headers=headers, body=MUSIC[start:end+1])
    else:
        route.fulfill(status=200, headers=headers, body=MUSIC)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless=True, args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':1600,'height':1000}, device_scale_factor=1, reduced_motion='no-preference', permissions=['clipboard-read','clipboard-write'])
    page = context.new_page()
    page.route('**/assets/audio/moonlight-scott-buckley.mp3', range_audio)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failed.append([response.status,response.url]) if response.status>=400 else None)
    page.add_init_script('''
      window.graphStats={contexts:0,sources:0,gains:0,analysers:0,connections:0};
      const Context=window.AudioContext;
      window.AudioContext=new Proxy(Context,{construct(target,args){graphStats.contexts++;return Reflect.construct(target,args);}});
      for(const [name,key,prototype] of [['createMediaElementSource','sources',Context.prototype],['createGain','gains',BaseAudioContext.prototype],['createAnalyser','analysers',BaseAudioContext.prototype]]) {
        const original=prototype[name];prototype[name]=function(...args){graphStats[key]++;return original.apply(this,args);};
      }
      const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){graphStats.connections++;return connect.apply(this,args);};
    ''')
    page.goto('http://127.0.0.1:8765/?audioStars=on', wait_until='networkidle')
    page.wait_for_function('window.resumeAudioStars && resumeChapterScene.snapshot().settled && window.portraitLighting')
    page.wait_for_selector('#chapterSignature[data-ready="true"]'); page.wait_for_timeout(1200)
    def state(): return page.evaluate('resumeAudioStars.snapshot()')
    def wait_play(): page.wait_for_function('resumeAudioControl.snapshot().actualPlaying && resumeAudioMeter.snapshot().rms>.0001')
    def hashes():
        data = page.evaluate('()=>Object.fromEntries(["signatureCanvas","portraitBase","starfieldCanvas","audioStarCanvas"].map(id=>[id,document.getElementById(id).toDataURL()]))')
        return {key:hashlib.sha256(value.encode()).hexdigest() for key,value in data.items()}
    original_hashes = hashes()
    original_geometry = page.evaluate('resumeStarfield.snapshot()')
    original_scene = page.evaluate('resumeChapterScene.snapshot().current')
    assert state()['currentBrightness']==1 and state()['pendingFrames']==0
    assert page.evaluate('graphStats.contexts')==0
    page.locator('#audioToggle').click(); wait_play()
    page.evaluate('window.originalGraph=resumeAudioControl.connection;window.originalWaveform=resumeAudioMeter.waveform;window.originalAudio=resumeAudioControl.audio;')
    page.wait_for_function('siteAudio.seekable.length>0 && siteAudio.seekable.end(0)>50')
    print('Actual music playing; seekable excerpt ready.', flush=True)

    # Same track, same element and graph, replay the exact same musical interval twice.
    comparison = {}
    for enabled,label in [(False,'off'),(True,'on')]:
        page.evaluate('(enabled)=>resumeAudioStars.setEnabled(enabled)', enabled)
        page.evaluate('siteAudio.currentTime=42')
        page.wait_for_function('siteAudio.currentTime>=42 && siteAudio.currentTime<43 && resumeAudioControl.snapshot().actualPlaying')
        take=[]
        page.evaluate('''()=>{window.excerptSamples=[];window.excerptTimer=setInterval(()=>excerptSamples.push({mediaTime:siteAudio.currentTime,...resumeAudioStars.snapshot(),meterRms:resumeAudioMeter.snapshot().rms}),40);}''')
        page.wait_for_function('siteAudio.currentTime>=45.75', polling='raf')
        comparison[label] = page.evaluate('({time:siteAudio.currentTime,stars:resumeAudioStars.snapshot(),meter:resumeAudioMeter.snapshot()})')
        page.screenshot(path=str(OUT/f'{label}.png'))
        for i in range(12):
            page.screenshot(path=str(OUT/f'{label}-frame-{i:02d}.png'))
            page.wait_for_timeout(80)
        page.evaluate('clearInterval(excerptTimer)')
        comparison[label]['samples'] = page.evaluate('excerptSamples')
        print(label, comparison[label]['time'], comparison[label]['stars']['currentBrightness'], flush=True)
    assert abs(comparison['off']['time']-comparison['on']['time']) < .06, comparison
    assert comparison['off']['stars']['currentBrightness']==1
    assert comparison['on']['stars']['currentBrightness']>1.10
    on_values=[sample['currentBrightness'] for sample in comparison['on']['samples']]
    on_rms=[sample['rms'] for sample in comparison['on']['samples']]
    assert max(on_values)-min(on_values)>.02
    assert max(on_rms)-min(on_rms)>.004
    assert all(.85<=value<=1.45 for value in on_values)
    assert all(sample['currentBrightness']==1 for sample in comparison['off']['samples'])
    assert all(sample['lastDeltaTime']<=.05 for sample in comparison['on']['samples'])
    assert all(abs(sample['rms']-sample['meterRms'])<1e-12 for sample in comparison['on']['samples'])
    assert hashes()==original_hashes, 'Audio must not redraw or alter any cached scene bitmap'
    assert page.evaluate('resumeStarfield.snapshot().geometry')==original_geometry['geometry']
    assert page.evaluate('resumeStarfield.snapshot().renderCount')==original_geometry['renderCount']
    assert page.evaluate('resumeChapterScene.snapshot().current')==original_scene
    assert page.locator('audio').count()==1
    results['comparison']=comparison
    results['staticComposition']={'counts':original_geometry['counts'],'reactiveGroup':original_geometry['reactiveGroup'],'nearPoints':[point for point in original_geometry['geometry'] if point['layer']=='near'],'cachedPixelsUnchanged':True,'positionsSizesColorsCountsUnchanged':True,'chapterParametersUnchanged':True,'renderCount':original_geometry['renderCount'],'canvasHashes':original_hashes}

    # Pixel-level proof: differences may occur only in near-star footprints or the temporary meter.
    off=Image.open(OUT/'off.png').convert('RGB'); on=Image.open(OUT/'on.png').convert('RGB')
    mask=Image.new('L',off.size,0);draw=ImageDraw.Draw(mask)
    points=[point for point in original_geometry['geometry'] if point['layer']=='near']
    for point in points:
        radius=point['radius']+point['glow']+3
        draw.ellipse([point['x']-radius,point['y']-radius,point['x']+radius,point['y']+radius],fill=255)
    meter=page.locator('#audioMeter').bounding_box()
    draw.rectangle([meter['x']-30,meter['y']-30,meter['x']+meter['width']+30,meter['y']+meter['height']+30],fill=255)
    difference=ImageChops.difference(off,on)
    outside=ImageChops.multiply(difference,Image.merge('RGB',[ImageChops.invert(mask)]*3))
    assert outside.getbbox() is None, f'Pixels outside the chosen star group changed: {outside.getbbox()}'
    box=page.locator('.hero-copy').bounding_box()
    copy_rect=(round(box['x']),round(box['y']),round(box['x']+box['width']),round(box['y']+box['height']))
    assert ImageChops.difference(off.crop(copy_rect),on.crop(copy_rect)).getbbox() is None
    results['pixelScope']={'noChangesOutsideNearStarsAndDiagnosticPanel':True,'heroCopyPixelsIdentical':True,'heroCopyRectangle':copy_rect}

    # Turn only visual linking off/on without restarting, pausing or reconnecting music.
    before=page.evaluate('resumeAudioControl.snapshot().currentTime')
    page.locator('#audioStarsToggle').focus(); page.keyboard.press('Enter')
    assert not state()['enabled'] and state()['currentBrightness']==1
    page.wait_for_timeout(160)
    assert page.evaluate('resumeAudioControl.snapshot().actualPlaying && siteAudio.currentTime>'+str(before))
    page.keyboard.press('Enter'); page.wait_for_function('resumeAudioStars.snapshot().currentBrightness>1.03')
    assert page.locator('#audioStarsToggle').get_attribute('aria-pressed')=='true'
    results['keyboardLinkToggle']={'musicContinues':True,'sameElement':True,'offIsStatic':True}

    # No volume/playback change in reading chapters; only visual gain is attenuated.
    reading=[]
    for chapter in ['projects','about','experience','skills','education','credentials','contact','top']:
        page.evaluate('(id)=>{document.getElementById(id).scrollIntoView({behavior:"instant"});}',chapter)
        page.wait_for_function('(id)=>resumeChapterScene.snapshot().section===id && resumeChapterScene.snapshot().settled',arg=chapter)
        page.wait_for_timeout(600)
        info=page.evaluate('({stars:resumeAudioStars.snapshot(),audio:resumeAudioControl.snapshot(),background:resumeChapterScene.snapshot().current.background,modelAtRms02:resumeAudioStars.mapRms(.02)})')
        assert info['audio']['actualPlaying']
        if chapter!='top': assert info['stars']['sectionGain']<=.25 and info['modelAtRms02']<=1.09
        else: assert math.isclose(info['modelAtRms02'],1.36,abs_tol=1e-12)
        reading.append({'chapter':chapter,**info})
        if chapter=='projects':
            buttons=page.locator('#projectList button')
            buttons.nth(0).focus(); page.keyboard.press('Enter')
            first=page.locator('#projectDetailTitle').text_content()
            page.keyboard.press('ArrowDown'); second=page.locator('#projectDetailTitle').text_content()
            assert first!=second and page.locator('#projectDetail').is_visible()
            page.keyboard.press('Escape'); assert page.locator('#projectDetail').is_hidden()
            assert page.evaluate('document.activeElement.id')==buttons.nth(1).get_attribute('id')
            page.screenshot(path=str(OUT/'projects.png'))
    results['readingChapters']=reading
    results['projectKeyboardSwitchAndClose']=True
    page.wait_for_function('resumeAudioStars.snapshot().currentBrightness>1.06')

    # Pause releases smoothly to the original brightness, then its RAF stops.
    before=state(); page.locator('#audioToggle').click(); start=state(); page.wait_for_timeout(150); middle=state()
    assert 1<middle['currentBrightness']<start['currentBrightness']<=before['currentBrightness']+.03,(before,start,middle)
    page.wait_for_function('resumeAudioStars.snapshot().currentBrightness===1 && resumeAudioStars.snapshot().pendingFrames===0',timeout=8000)
    end=state(); count=end['updateCount']; page.wait_for_timeout(200)
    assert state()['updateCount']==count
    results['pauseRelease']={'before':before,'start':start,'middle':middle,'settled':end,'rafStops':True}
    page.locator('#audioToggle').click(); wait_play()

    # System reduced motion: active music survives, stars snap to static, and audio can be restarted manually.
    time_before=page.evaluate('siteAudio.currentTime')
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('!resumeAudioStars.snapshot().enabled && resumeAudioStars.snapshot().currentBrightness===1')
    assert page.locator('#audioStarsToggle').is_disabled() and not page.locator('#audioToggle').is_disabled()
    page.wait_for_timeout(200)
    assert page.evaluate('resumeAudioControl.snapshot().actualPlaying && siteAudio.currentTime>'+str(time_before))
    count=state()['updateCount']; page.wait_for_timeout(160); assert state()['updateCount']==count
    page.locator('#audioToggle').click(); page.locator('#audioToggle').click(); wait_play()
    assert state()['currentBrightness']==1 and state()['pendingFrames']==0
    page.screenshot(path=str(OUT/'reduced-motion.png'))
    results['reducedMotion']={'state':state(),'activePlaybackPreserved':True,'manualPlaybackWorks':True,'audioButtonEnabled':True,'visualRafStops':True}
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_function('resumeAudioStars.snapshot().currentBrightness>1.03')
    page.locator('#motionToggle').click()
    page.wait_for_function('document.documentElement.dataset.motion==="off" && resumeAudioStars.snapshot().currentBrightness===1')
    assert page.evaluate('resumeAudioControl.snapshot().actualPlaying')
    results['siteMotionOffPreservesMusic']=True
    page.locator('#motionToggle').click()
    page.wait_for_function('resumeAudioStars.snapshot().enabled')

    # A failed playback uses zero effective energy and returns to static without creating another graph.
    page.locator('#audioToggle').click()
    page.evaluate('()=>{siteAudio.play=()=>Promise.reject(new DOMException("Verification refusal","NotAllowedError"));}')
    page.locator('#audioToggle').click()
    page.wait_for_function('resumeAudioControl.snapshot().state==="error" && resumeAudioStars.snapshot().currentBrightness===1',timeout=8000)
    assert state()['pendingFrames']==0
    page.evaluate('delete siteAudio.play')
    page.locator('#audioToggle').click(); wait_play()
    same=page.evaluate('''()=>{const graph=resumeAudioControl.connection;return graph.context===originalGraph.context && graph.source===originalGraph.source && graph.gain===originalGraph.gain && graph.analyser===originalGraph.analyser && resumeAudioMeter.analyser===graph.analyser && resumeAudioMeter.waveform===originalWaveform && resumeAudioControl.audio===originalAudio;}''')
    stats=page.evaluate('graphStats')
    assert same and stats=={'contexts':1,'sources':1,'gains':1,'analysers':1,'connections':3},stats
    results['audioReuse']={'sameObjects':same,'stats':stats,'singleAudioElement':page.locator('audio').count(),'waveformAllocations':page.evaluate('resumeAudioMeter.snapshot().bufferAllocations'),'failureAndRetry':True}
    # Smooth approach is frame-rate independent; long frames are limited to 50 ms.
    fps=page.evaluate('''()=>{const values={};for(const hz of [30,60,120]){let value=1;for(let i=0;i<hz;i++)value=resumeAudioStars.approach(value,1.4,1/hz);values[hz]=value;}return {values,longFrame:resumeAudioStars.approach(1,1.4,5),capped:resumeAudioStars.approach(1,1.4,.05)};}''')
    assert max(fps['values'].values())-min(fps['values'].values())<1e-12
    assert fps['longFrame']==fps['capped']
    results['timing']=fps
    page.locator('#audioToggle').click()
    page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(600)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#audioStarsToggle').focus(); page.keyboard.press('Enter'); page.keyboard.press('Enter')
    assert page.locator('#audioStarsToggle').is_enabled()
    page.screenshot(path=str(OUT/'mobile.png'))
    results['mobile']={'noHorizontalOverflow':True,'toggleKeyboardWorks':True}
    assert not errors and not failed,(errors,failed)
    results['browserErrors']=errors; results['failedResources']=failed
    browser.close()

(OUT/'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in results.items() if key not in ['comparison','staticComposition','readingChapters','pauseRelease']},ensure_ascii=False,indent=2),flush=True)

# Full composition plus unchanged-position magnifications of genuine screenshot pixels.
font_path='C:/Windows/Fonts/msyh.ttc'
font=ImageFont.truetype(font_path,24); small=ImageFont.truetype(font_path,17)
board=Image.new('RGB',(1640,1170),'#080c12'); draw=ImageDraw.Draw(board)
for i,(label,name) in enumerate([('无联动 · 基础亮度','off'),('有联动 · 仅近层亮度','on')]):
    x=20+i*810
    draw.text((x,18),label,font=font,fill='#eeeae2')
    draw.text((x,55),'Moonlight · 同一音轨 45.75 秒 · 相机与构图相同',font=small,fill='#aebfd6')
    board.paste(Image.open(OUT/f'{name}.png').resize((800,500),Image.Resampling.LANCZOS),(x,92))
draw.text((20,622),'局部 6× 放大：同一组近层星点，位置、大小和色彩保持相同',font=font,fill='#eeeae2')
selected=sorted([point for point in points if point['x']>640 and 120<point['y']<880],key=lambda point:-point['alpha'])[:4]
for index,point in enumerate(selected):
    x=30+index*400
    draw.text((x,672),f'星点 {index+1}',font=small,fill='#aebfd6')
    rect=(round(point['x'])-15,round(point['y'])-15,round(point['x'])+15,round(point['y'])+15)
    for mode,img in [('off',off),('on',on)]:
        dx=x+(0 if mode=='off' else 190)
        board.paste(img.crop(rect).resize((180,180),Image.Resampling.NEAREST),(dx,707))
        draw.text((dx,895),'无联动' if mode=='off' else '有联动',font=small,fill='#aebfd6')
draw.text((20,960),'正文像素完全一致；作品/正文的视觉增益降为首屏的 8–25%。',font=font,fill='#e7d2b6')
draw.text((20,1005),'暂停时柔和回落；减少动效时关闭联动，音乐仍可主动播放。',font=font,fill='#e7d2b6')
draw.text((20,1070),'实际播放 RMS 驱动，无新增音频元素、AudioContext 或 AnalyserNode。',font=small,fill='#aebfd6')
board.save(OUT/'comparison.png')

frames=[]
for frame_index in range(12):
    frame_image=Image.new('RGB',(1520,265),'#080c12'); labels=ImageDraw.Draw(frame_image)
    for index,point in enumerate(selected):
        x=10+index*380
        rect=(round(point['x'])-15,round(point['y'])-15,round(point['x'])+15,round(point['y'])+15)
        for mode in ['off','on']:
            dx=x+(0 if mode=='off' else 185)
            crop=Image.open(OUT/f'{mode}-frame-{frame_index:02d}.png').crop(rect)
            frame_image.paste(crop.resize((180,180),Image.Resampling.NEAREST),(dx,45))
            labels.text((dx,12),'无联动' if mode=='off' else '有联动',font=small,fill='#c6d5e9')
    labels.text((10,235),'Moonlight · 相同旋律片段的实际播放截图 · 仅放大星点局部',font=small,fill='#aebfd6')
    frames.append(frame_image)
frames[0].save(OUT/'star-detail.gif',save_all=True,append_images=frames[1:],duration=180,loop=0,disposal=2)
for mode in ['off','on']:
    for frame_index in range(12):
        (OUT/f'{mode}-frame-{frame_index:02d}.png').unlink()
