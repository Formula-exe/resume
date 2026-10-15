const numeric=['x','y','scale','signatureOpacity','portraitOpacity','background'];
export function approach(currentValues,targetValues,deltaTime,settings=window.RESUME_CHAPTER_CONFIG.timing){
  const dt=Math.min(settings.maxDeltaTime,Math.max(0,Number.isFinite(deltaTime)?deltaTime:0));
  const factor=-Math.expm1(-settings.response*dt);
  const result={};
  for(const key of numeric){
    const value=currentValues[key]+(targetValues[key]-currentValues[key])*factor;
    result[key]=Math.abs(value-targetValues[key])<settings.epsilon?targetValues[key]:value;
  }
  return result;
}
window.resumeVisualRuntime.register('chapters',(scope)=>{
// One owner updates position, scale, both actor opacities and background intensity.
// Renderers produce static particle images; the compositor moves them without resampling.
const config=window.RESUME_CHAPTER_CONFIG;
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const printMedia=matchMedia('print');
let sections=[],current=null,target=null,activeId='',frame=0,previousTime=null,layoutDirty=true,snapPending=true;
let lastDeltaTime=0,lastRawDeltaTime=0,updateCount=0,navSection='';


function measure(){
  const scroll=scrollY;
  sections=config.sections.flatMap(state=>{const node=document.querySelector(state.selector);return node?[{state,top:node.getBoundingClientRect().top+scroll}]:[];});
  sections.sort((a,b)=>a.top-b.top);layoutDirty=false;
}
function resolve(){
  if(layoutDirty)measure();
  const navHeight=document.querySelector('.nav').offsetHeight;
  const line=scrollY+Math.max(navHeight+24,innerHeight*config.activationLine);
  let selected=sections[0];
  for(const section of sections)if(section.top<=line)selected=section;
  // The final anchor cannot always reach the activation line because scrolling stops at the page end.
  if(scrollY>0 && scrollY+innerHeight>=document.documentElement.scrollHeight-2)selected=sections.at(-1);
  const state=selected.state;
  const view=window.resumeVisualRuntime.settings().mobile?{...state,...state.mobile}:{...state};
  if(window.resumeVisualRuntime.settings().mobile){
    const mobileSettings=window.RESUME_VISUAL_CONFIG.mobile;
    const actorHeight=Math.min(mobileSettings.actorHeightMax,Math.max(mobileSettings.actorHeightMin,innerWidth*mobileSettings.actorHeightVw/100));
    const anchor=state.id==='top'?document.querySelector('.hero-grid>.hero-visual-space'):state.id==='about'?document.querySelector('.chapter-about-copy'):null;
    if(anchor){
      const rect=anchor.getBoundingClientRect();
      view.x=.5;view.scale=state.id==='top'?mobileSettings.signatureScale:mobileSettings.portraitScale;
      view.y=(state.id==='top'?rect.top+rect.height*.5:rect.bottom+mobileSettings.copyGap+actorHeight*view.scale*.5)/innerHeight;
    }
  }
  const signatureOpacity=state.actor==='signature'?view.opacity:0;
  const portraitOpacity=state.actor==='portrait'?view.opacity:0;
  activeId=state.id;root.dataset.chapter=activeId;
  target={x:view.x,y:view.y,scale:view.scale,signatureOpacity,portraitOpacity,background:view.background};
}
function apply(){
  root.style.setProperty('--chapter-x',`${current.x*100}vw`);
  root.style.setProperty('--chapter-y',`${current.y*100}vh`);
  root.style.setProperty('--chapter-scale',String(current.scale));
  root.style.setProperty('--chapter-signature-opacity',String(current.signatureOpacity));
  root.style.setProperty('--chapter-portrait-opacity',String(current.portraitOpacity));
  root.style.setProperty('--chapter-background',String(current.background));
  if(navSection!==activeId){
    document.querySelectorAll('.nav-links a,.mobile-menu a').forEach(link=>{
      if(link.hash==='#'+activeId)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
    navSection=activeId;
  }
}
const animationsAllowed=()=>window.resumeVisualRuntime.animationsAllowed() && !reduced.matches;
function update(timestamp){
  frame=0;
  if(document.hidden || printMedia.matches){previousTime=null;return;}
  resolve();
  const raw=previousTime===null?0:(timestamp-previousTime)/1000;
  previousTime=timestamp;lastRawDeltaTime=raw;lastDeltaTime=Math.min(config.timing.maxDeltaTime,Math.max(0,raw));
  if(!current || snapPending || !animationsAllowed()){current={...target};snapPending=false;}
  else current=approach(current,target,raw);
  updateCount++;apply();
  if(numeric.some(key=>current[key]!==target[key]))frame=scope.raf(update);
  else{previousTime=null;root.dataset.chapterSettled=activeId;}
}
function schedule({layout=false,snap=false}={}){
  layoutDirty=layoutDirty || layout;snapPending=snapPending || snap;
  delete root.dataset.chapterSettled;
  if(!frame && !document.hidden && !printMedia.matches)frame=scope.raf(update);
}
const scheduleLayout=()=>schedule({layout:true});
scope.on(window, 'scroll',()=>schedule(),{passive:true});
scope.on(window, 'resize',scheduleLayout,{passive:true});
scope.on(window, 'hashchange',()=>schedule());
scope.on(window, 'popstate',()=>schedule());
scope.on(window, 'pageshow',()=>schedule({layout:true,snap:true}));
scope.on(window, 'resume:render',scheduleLayout);
scope.on(window, 'resume:projectchange',scheduleLayout);
scope.on(window, 'resume:motionchange',()=>schedule({snap:true}));
scope.on(document, 'visibilitychange',()=>{
  if(document.hidden){scope.cancelRaf(frame);frame=0;previousTime=null;}
  else schedule({layout:true});
});
scope.on(window, 'pagehide',()=>{scope.cancelRaf(frame);frame=0;previousTime=null;});
scope.on(reduced, 'change',()=>schedule({snap:true}));
scope.on(printMedia, 'change',()=>{if(printMedia.matches){scope.cancelRaf(frame);frame=0;previousTime=null;}else schedule({layout:true,snap:true});});
scope.observe(new ResizeObserver(scheduleLayout)).observe(document.querySelector('main'));
document.fonts.ready.then(()=>schedule({layout:true,snap:!current}));

window.resumeChapterScene={
  snapshot:()=>({section:activeId,current:current?{...current}:null,target:target?{...target}:null,
    settled:current && numeric.every(key=>current[key]===target[key]),pendingFrames:frame?1:0,updateCount,
    lastDeltaTime,lastRawDeltaTime,maxDeltaTime:config.timing.maxDeltaTime,response:config.timing.response,
    motionEnabled:animationsAllowed(),sections:sections.map(({state,top})=>({id:state.id,top}))}),
  refresh:()=>schedule({layout:true}),approach
};
schedule({layout:true,snap:true});
  scope.on(window,'resume:qualitychange',()=>schedule({layout:true,snap:true}));
  scope.cleanup(()=>{scope.cancelRaf(frame);frame=0;previousTime=null;delete window.resumeChapterScene;});
  return {pause:()=>{scope.cancelRaf(frame);frame=0;previousTime=null;},resume:()=>schedule({layout:true,snap:true}),snapshot:()=>({section:activeId,pendingFrames:frame?1:0,updateCount})};
},{decorative:false,keys:[]});
