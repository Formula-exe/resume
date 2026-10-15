from pathlib import Path
from playwright.sync_api import sync_playwright
import json

OUT=Path('D:/编程/个人简历/output/music-response-review');result={};errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000},reduced_motion='no-preference')
    page.on('pageerror',lambda error:errors.append(str(error)))
    def block_analysis(route):
        if route.request.resource_type=='fetch':route.abort('failed')
        else:route.continue_()
    page.route('**/assets/audio/moonlight-scott-buckley.mp3',block_analysis)
    page.goto('http://127.0.0.1:8765/?audioStars=on',wait_until='networkidle')
    page.wait_for_function('window.resumeAudioStars && window.portraitLighting')
    page.locator('#audioToggle').click()
    page.wait_for_function('resumeAudioControl.snapshot().actualPlaying && resumeMusicAnalysis.snapshot().status==="error"')
    page.evaluate('siteAudio.currentTime=44');page.wait_for_timeout(700)
    assert page.evaluate('resumeAudioControl.snapshot().actualPlaying && resumeAudioMeter.snapshot().rms>0 && resumeMusicAnalysis.sample().meteors.length===0')
    assert page.evaluate('resumeAudioStars.snapshot().currentBrightness>1 && resumeAudioStars.snapshot().current.energy===0')
    page.evaluate('window.savedGraph=resumeAudioControl.connection')
    page.unroute('**/assets/audio/moonlight-scott-buckley.mp3',block_analysis)
    page.locator('#audioToggle').click();page.locator('#audioToggle').click()
    page.wait_for_function('resumeMusicAnalysis.snapshot().status==="ready" && resumeAudioControl.snapshot().actualPlaying')
    assert page.evaluate('resumeAudioControl.connection.source===savedGraph.source && resumeAudioControl.connection.context===savedGraph.context')
    page.locator('#audioToggle').click()
    page.evaluate('()=>{siteAudio.play=()=>Promise.reject(new DOMException("Verification refusal","NotAllowedError"));}')
    page.locator('#audioToggle').click()
    page.wait_for_function('resumeAudioControl.snapshot().state==="error" && resumeAudioStars.snapshot().currentBrightness===1 && resumeAudioStars.snapshot().pendingFrames===0',timeout=10000)
    assert page.evaluate('resumeAudioMeter.snapshot().rms===0')
    page.evaluate('delete siteAudio.play');page.locator('#audioToggle').click()
    page.wait_for_function('resumeAudioControl.snapshot().actualPlaying')
    result['analysisFailureFallbackAndRetry']=True;result['playbackFailureAndRetry']=True
    page.close()
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='no-preference')
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:8765/output/music-response-review/',wait_until='networkidle')
    page.wait_for_function('!document.getElementById("previewPlay").disabled')
    page.get_by_role('button',name='播放：星潮段').click()
    page.wait_for_function('document.getElementById("demoFrame").contentWindow.resumeAudioControl.snapshot().actualPlaying && document.getElementById("demoFrame").contentWindow.resumeAudioControl.audio.currentTime>104')
    assert page.locator('audio').count()==0
    frame=page.frames[1];assert frame.locator('audio').count()==1
    frame.wait_for_function('resumeMusicAnalysis.snapshot().calibrated')
    page.locator('#visualToggle').click()
    frame.wait_for_function('!resumeAudioStars.snapshot().enabled && resumeAudioStars.snapshot().currentBrightness===1')
    assert frame.evaluate('resumeAudioControl.snapshot().actualPlaying')
    page.locator('#visualToggle').click()
    page.get_by_role('button',name='播放：人物轮廓').click()
    frame.wait_for_function('resumeChapterScene.snapshot().section==="about" && resumeChapterScene.snapshot().settled')
    assert frame.evaluate('siteAudio.currentTime>=69 && portraitLighting.snapshot().audio.energy>0')
    page.locator('#previewPlay').click();frame.wait_for_function('!resumeAudioControl.snapshot().actualPlaying')
    page.wait_for_function('document.getElementById("previewPlay").textContent==="播放音乐"')
    page.get_by_role('button',name='人物原尺寸',exact=True).click()
    assert page.locator('#comparison').get_attribute('src')=='portrait-on.png'
    page.get_by_role('button',name='并排对照',exact=True).click()
    page.screenshot(path=str(OUT/'review-browser.png'),full_page=True)
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('document.getElementById("visualToggle").disabled')
    assert not page.locator('#previewPlay').is_disabled()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    result['review']={'singleEmbeddedAudio':True,'realPlaybackFromParentButtons':True,'seekToScenes':True,'visualTogglePreservesMusic':True,'imageModes':True,'reducedMotionPreservesPlayButton':True,'mobileNoOverflow':True}
    assert not errors,errors
    result['browserErrors']=errors;browser.close()
(OUT/'additional-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
