"""Build the current track's features using the same decoder and worker as the website."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib,json

ROOT=Path('D:/编程/个人简历')
source=ROOT/'assets/audio/moonlight-scott-buckley.mp3'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--enable-unsafe-swiftshader'])
    page=browser.new_page()
    page.goto('http://127.0.0.1:8765/',wait_until='networkidle')
    page.locator('#audioToggle').click()
    page.wait_for_function('resumeAudioControl.snapshot().actualPlaying')
    profile=page.evaluate('''async()=>{
      const data=await (await fetch(RESUME_AUDIO_CONFIG.source)).arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
      const decoded=await resumeAudioControl.connection.context.decodeAudioData(data);
      const rate=11025,length=Math.floor(decoded.duration*rate),samples=new Float32Array(length);
      const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),ratio=decoded.sampleRate/rate;
      for(let i=0;i<length;i++){const begin=Math.floor(i*ratio),end=Math.min(decoded.length,Math.floor((i+1)*ratio));let sum=0;for(let j=begin;j<end;j++)for(const channel of channels)sum+=channel[j];samples[i]=sum/Math.max(1,(end-begin)*channels.length);}
      return await new Promise((resolve,reject)=>{const worker=new Worker('music-analysis-worker.js');worker.onmessage=event=>{worker.terminate();event.data.error?reject(new Error(event.data.error)):resolve(event.data);};worker.onerror=reject;worker.postMessage({samples,sampleRate:rate,sourceHash:hash},[samples.buffer]);});
    }''')
    browser.close()
assert profile['sourceHash']==hashlib.sha256(source.read_bytes()).hexdigest()
profile.update({'version':1,'source':'assets/audio/moonlight-scott-buckley.mp3','title':'Moonlight','artist':'Scott Buckley','byteLength':source.stat().st_size})
(ROOT/'assets/audio/moonlight-analysis.json').write_text(json.dumps(profile,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
summary=[]
for sec in range(0,int(profile['duration']),10):
    rows=[row for i,row in enumerate(profile['features']) if sec<=profile['startTime']+i*profile['step']<sec+10]
    summary.append({'start':sec,'energy':round(sum(r[0] for r in rows)/len(rows),3),'register':round(sum(r[1] for r in rows)/len(rows),3)})
print(json.dumps({'duration':profile['duration'],'frames':len(profile['features']),'onsets':len(profile['onsets']),'hash':profile['sourceHash'],'tenSecondSummary':summary},indent=2))
(ROOT/'output/music-response-review/analysis-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
