import * as THREE from '../../vendor/three.module.min.js';

const config = window.PORTRAIT_LIGHTING_CONFIG;
const slot = document.getElementById('chapterPortrait') || document.querySelector('.hero-visual-space');
const buttons = [...document.querySelectorAll('[data-lighting-choice]')];
const originalStars = window.RESUME_STARFIELD_CONFIG.layers.map(({color,brightness})=>({color,brightness:[...brightness]}));
const asset = path => new URL(path, import.meta.url);
const srgb = value => value <= .0031308 ? value * 12.92 : 1.055 * Math.pow(value,1/2.4) - .055;
const inside = (u,v,x,y) => u>=x[0] && u<=x[1] && v>=y[0] && v<=y[1];

function sprite() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)'); gradient.addColorStop(.12,'rgba(255,255,255,.55)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

// Real GPU Bloom: brightness extraction, half-resolution separable blur and a transparent glow layer.
// Only the portrait canvas is sampled. HTML, navigation and background stars never enter this pass.
function createBloom(source,width,height,scope) {
  const canvas = document.createElement('canvas');canvas.className='portrait-layer bloom-layer';canvas.id='portraitBloom';canvas.hidden=true;slot.append(canvas);
  let renderer;
  try{renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,preserveDrawingBuffer:true});}
  catch(error){canvas.remove();throw error;}
  const onLost=event=>{event.preventDefault();window.resumeVisualRuntime.fail('bloom','WebGL context lost');};
  scope.on(canvas,'webglcontextlost',onLost);
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const w=Math.round(width*config.bloom.resolutionScale),h=Math.round(height*config.bloom.resolutionScale);
  const options={depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};
  const a=new THREE.WebGLRenderTarget(w,h,options),b=new THREE.WebGLRenderTarget(w,h,options);
  const texture=new THREE.CanvasTexture(source);texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=false;
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const vertex=`varying vec2 uvOut;void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}`;
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:'void main(){gl_FragColor=vec4(0.);}',
    uniforms:{image:{value:texture},threshold:{value:config.bloom.threshold},knee:{value:config.bloom.knee},
      direction:{value:new THREE.Vector2()},strength:{value:config.bloom.strength},maxOpacity:{value:config.bloom.maxOpacity}},
    depthTest:false,depthWrite:false,toneMapped:false});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(quad);
  function pass(target,fragment,uniforms) {
    material.fragmentShader=fragment;
    for(const [name,uniform] of Object.entries(uniforms))material.uniforms[name].value=uniform.value;
    material.needsUpdate=true;material.uniformsNeedUpdate=true;
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
  }
  const extract=`varying vec2 uvOut;uniform sampler2D image;uniform float threshold;uniform float knee;
    void main(){vec4 pixel=texture2D(image,uvOut);vec3 visible=pixel.rgb*pixel.a;
    float value=dot(visible,vec3(.2126,.7152,.0722));float mask=smoothstep(threshold-knee,threshold+knee,value);
    gl_FragColor=vec4(visible*mask,mask*pixel.a);}`;
  const blur=`varying vec2 uvOut;uniform sampler2D image;uniform vec2 direction;
    void main(){vec4 sum=texture2D(image,uvOut)*.227027;
      sum+=(texture2D(image,uvOut+direction*1.384615)+texture2D(image,uvOut-direction*1.384615))*.316216;
      sum+=(texture2D(image,uvOut+direction*3.230769)+texture2D(image,uvOut-direction*3.230769))*.070270;
      gl_FragColor=sum;}`;
  const composite=`varying vec2 uvOut;uniform sampler2D image;uniform float strength;uniform float maxOpacity;
    void main(){vec3 glow=texture2D(image,uvOut).rgb;float value=max(glow.r,max(glow.g,glow.b));
      float alpha=min(maxOpacity,value*strength);gl_FragColor=vec4(glow/max(value,.00001)*alpha,alpha);}`;
  return {
    canvas,resolution:[w,h],
    render(){
      texture.needsUpdate=true;
      pass(a,extract,{image:{value:texture},threshold:{value:config.bloom.threshold},knee:{value:config.bloom.knee}});
      pass(b,blur,{image:{value:a.texture},direction:{value:new THREE.Vector2(config.bloom.radius/w,0)}});
      pass(a,blur,{image:{value:b.texture},direction:{value:new THREE.Vector2(0,config.bloom.radius/h)}});
      pass(null,composite,{image:{value:a.texture},strength:{value:config.bloom.strength},maxOpacity:{value:config.bloom.maxOpacity}});
    },
    dispose(){canvas.removeEventListener('webglcontextlost',onLost);a.dispose();b.dispose();texture.dispose();quad.geometry.dispose();material.dispose();renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.width=canvas.height=1;canvas.remove();}
  };
}

async function init(scope,quality) {
  const [metaResponse,geometryResponse]=await Promise.all([fetch(asset('geometry.json'),{signal:scope.signal}),fetch(asset('geometry.bin'),{signal:scope.signal})]);
  if(!metaResponse.ok || !geometryResponse.ok)throw new Error('Frozen portrait geometry is unavailable');
  let meta=await metaResponse.json();const buffer=await geometryResponse.arrayBuffer();
  if(scope.signal.aborted)return;
  let arrays=Object.fromEntries(Object.entries(meta.sections).map(([name,section])=>[name,new Float32Array(buffer,section.offset,section.length)]));
  if(arrays.positions.length/3!==meta.particleCount || arrays.highlights.length/3!==meta.highlightCount)throw new Error('Frozen geometry count mismatch');
  const sourceCount=meta.particleCount;
  const budget=Math.min(sourceCount,quality.portraitParticles),highlightBudget=Math.min(meta.highlightCount,quality.portraitHighlights);
  // Keep a stable subset of the source geometry. Face and hair receive priority on small screens.
  if(budget<sourceCount){
    const ranked=Array.from({length:sourceCount},(_,i)=>{
      const u=(arrays.positions[i*3]+meta.width/2-.5)/meta.width,v=(meta.height/2-arrays.positions[i*3+1]-.5)/meta.height;
      const weight=inside(u,v,[.24,.50],[.13,.53])?4:inside(u,v,[.30,.77],[.015,.52])?3:1;
      let hash=(i+1)^0x9e3779b9;hash=Math.imul(hash^(hash>>>16),0x21f0aaad);hash=Math.imul(hash^(hash>>>15),0x735a2d97);hash=(hash^(hash>>>15))>>>0;
      return {i,rank:(hash/4294967296)/weight};
    }).sort((a,b)=>a.rank-b.rank||a.i-b.i).slice(0,budget).map(p=>p.i).sort((a,b)=>a-b);
    for(const [name,stride] of [['positions',3],['colors',4],['sizes',1]]){
      const values=new Float32Array(budget*stride);
      ranked.forEach((index,i)=>values.set(arrays[name].subarray(index*stride,index*stride+stride),i*stride));arrays[name]=values;
    }
  }
  arrays.highlights=arrays.highlights.slice(0,highlightBudget*3);arrays.highlightColors=arrays.highlightColors.slice(0,highlightBudget*3);
  meta={...meta,particleCount:budget,highlightCount:highlightBudget};
  const width=meta.width,height=meta.height;
  const canvas=document.createElement('canvas');canvas.className='portrait-layer';canvas.id='portraitBase';slot.append(canvas);
  let renderer,geometry,material,highlightGeometry,highlightMaterial,bloom=null,disposed=false,resizeTimer;
  scope.cleanup(()=>{
    disposed=true;scope.clearTimeout(resizeTimer);bloom?.dispose();bloom=null;
    geometry?.dispose();material?.dispose();highlightGeometry?.dispose();highlightMaterial?.map?.dispose();highlightMaterial?.dispose();
    if(renderer){renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();}
    canvas.width=canvas.height=1;canvas.remove();slot.dataset.ready='false';delete document.body.dataset.lightingReady;
    if(window.portraitLighting?.setAudioResponse===setAudioResponse)delete window.portraitLighting;
  });
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:quality.antialias,preserveDrawingBuffer:true});
  scope.on(canvas,'webglcontextlost',event=>{event.preventDefault();window.resumeVisualRuntime.fail('portrait','WebGL context lost');});
  renderer.setPixelRatio(quality.pixelRatio);renderer.setSize(1,1,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.PerspectiveCamera(meta.camera.fov,meta.camera.aspect,meta.camera.near,meta.camera.far);
  camera.position.fromArray(meta.camera.position);camera.quaternion.fromArray(meta.camera.quaternion);camera.updateMatrixWorld();
  const scene=new THREE.Scene();geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(arrays.positions,3));
  geometry.setAttribute('rgba',new THREE.BufferAttribute(arrays.colors.slice(),4));
  geometry.setAttribute('pointSize',new THREE.BufferAttribute(arrays.sizes,1));
  // Select a thin band along the existing silhouette; no particle or position is added.
  const rows=Array.from({length:128},()=>[]),heights=new Float32Array(meta.particleCount),contours=new Float32Array(meta.particleCount);
  for(let i=0;i<meta.particleCount;i++){
    const v=Math.max(0,Math.min(1,(height/2-arrays.positions[i*3+1]-.5)/height));
    heights[i]=v;rows[Math.min(127,Math.floor(v*128))].push((arrays.positions[i*3]+width/2-.5)/width);
  }
  const edges=rows.map(row=>{row.sort((a,b)=>a-b);return row.length?[row[Math.floor((row.length-1)*.04)],row[Math.floor((row.length-1)*.96)]]:[0,1];});
  for(let i=0;i<meta.particleCount;i++){
    const u=(arrays.positions[i*3]+width/2-.5)/width,[left,right]=edges[Math.min(127,Math.floor(heights[i]*128))];
    const distance=Math.min(Math.abs(u-left),Math.abs(u-right));contours[i]=Math.exp(-.5*(distance/.024)**2);
  }
  geometry.setAttribute('contour',new THREE.BufferAttribute(contours,1));geometry.setAttribute('portraitHeight',new THREE.BufferAttribute(heights,1));
  material=new THREE.ShaderMaterial({
    uniforms:{renderScale:{value:1},cameraDistance:{value:meta.camera.position[2]},audioEnergy:{value:0},audioHeight:{value:.5},
      audioGain:{value:window.RESUME_MUSIC_RESPONSE_CONFIG?.mapping.portraitGain ?? .85},audioBandWidth:{value:window.RESUME_MUSIC_RESPONSE_CONFIG?.mapping.portraitBandWidth ?? .13}},
    vertexShader:`attribute vec4 rgba;attribute float pointSize;attribute float contour;attribute float portraitHeight;uniform float renderScale;uniform float cameraDistance;varying vec4 vRgba;varying float vContour;varying float vHeight;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vRgba=rgba;vContour=contour;vHeight=portraitHeight;gl_PointSize=pointSize*renderScale*cameraDistance/max(1.0,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec4 vRgba;varying float vContour;varying float vHeight;uniform float audioEnergy;uniform float audioHeight;uniform float audioGain;uniform float audioBandWidth;
      void main(){float radius=length(gl_PointCoord-vec2(.5));float coverage=1.0-smoothstep(.35,.5,radius);if(coverage<.01)discard;
      float band=exp(-.5*pow((vHeight-audioHeight)/audioBandWidth,2.0));
      gl_FragColor=vec4(vRgba.rgb*(1.0+audioEnergy*audioGain*vContour*band),vRgba.a*coverage);
      #include <colorspace_fragment>
    }`,transparent:true,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false
  });
  const points=new THREE.Points(geometry,material);scene.add(points);
  highlightGeometry=new THREE.BufferGeometry();highlightGeometry.setAttribute('position',new THREE.BufferAttribute(arrays.highlights,3));
  highlightGeometry.setAttribute('color',new THREE.BufferAttribute(arrays.highlightColors.slice(),3));
  highlightMaterial=new THREE.PointsMaterial({map:sprite(),vertexColors:true,size:10,sizeAttenuation:false,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false});
  scene.add(new THREE.Points(highlightGeometry,highlightMaterial));

  // Select existing bright facial samples. No random draw or extra particle changes the frozen silhouette.
  const focusCandidates=[];
  for(let i=0;i<meta.particleCount;i++){
    const u=(arrays.positions[i*3]+width/2-.5)/width,v=(height/2-arrays.positions[i*3+1]-.5)/height;
    const r=srgb(arrays.colors[i*4]),g=srgb(arrays.colors[i*4+1]),b=srgb(arrays.colors[i*4+2]),alpha=arrays.colors[i*4+3];
    if(inside(u,v,[.25,.43],[.18,.48]) && r>b+.07)focusCandidates.push({i,score:(.2126*r+.7152*g+.0722*b)*alpha});
  }
  focusCandidates.sort((a,b)=>b.score-a.score || a.i-b.i);
  const warmIndices=new Set(focusCandidates.slice(0,Math.round(meta.particleCount*config.palette.warmFraction)).map(point=>point.i));
  const warmCoordinates=new Set([...warmIndices].map(i=>`${arrays.positions[i*3]},${arrays.positions[i*3+1]}`));
  const cool=new THREE.Color(config.palette.cool),warm=new THREE.Color(config.palette.warm);
  const graded=arrays.colors.slice();const regionCounts={face:0,hair:0,shoulders:0,body:0};
  for(let i=0;i<meta.particleCount;i++){
    const u=(arrays.positions[i*3]+width/2-.5)/width,v=(height/2-arrays.positions[i*3+1]-.5)/height;
    let region='body';
    if(inside(u,v,[.24,.50],[.13,.53]))region='face';
    else if(inside(u,v,[.30,.77],[.015,.52]))region='hair';
    else if(inside(u,v,[.10,.98],[.52,.97]))region='shoulders';
    regionCounts[region]++;
    const lum=.2126*srgb(arrays.colors[i*4])+.7152*srgb(arrays.colors[i*4+1])+.0722*srgb(arrays.colors[i*4+2]);
    const color=warmIndices.has(i)?warm:cool;
    const intensity=(.28+.72*lum)*config.palette.regionBrightness[region]*(warmIndices.has(i)?1.1:1);
    for(let c=0;c<3;c++)graded[i*4+c]=Math.min(1,color.toArray()[c]*intensity);
  }
  const gradedHighlights=arrays.highlightColors.slice();
  for(let i=0;i<meta.highlightCount;i++){
    const key=`${arrays.highlights[i*3]},${arrays.highlights[i*3+1]}`;
    const u=(arrays.highlights[i*3]+width/2-.5)/width,v=(height/2-arrays.highlights[i*3+1]-.5)/height;
    const color=warmCoordinates.has(key) || inside(u,v,[.25,.43],[.18,.48])?warm:cool;
    gradedHighlights.set(color.toArray(),i*3);
  }
  let renderCount=0;
  function draw(){
    if(scope.signal.aborted || document.hidden)return;
    renderer.render(scene,camera);renderCount++;
    if(currentMode==='on'){
      if(!bloom)bloom=createBloom(canvas,canvas.width,canvas.height,scope);
      bloom.canvas.hidden=false;bloom.render();
    }
  }
  function resize(){
    if(scope.signal.aborted || document.hidden)return;
    const edge=Math.max(1,Math.min(width,slot.clientWidth,slot.clientHeight));
    renderer.setSize(edge,edge,false);
    material.uniforms.renderScale.value=edge*quality.pixelRatio/height*Math.sqrt(sourceCount/budget);
    highlightMaterial.size=10*edge/height;
    if(bloom){bloom.dispose();bloom=null;}draw();
  }
  let currentMode=null,gradedBase=false;
  let audioRenderCount=0,audioDirty=false,audioDrawnEnergy=0;
  function setAudioResponse(energy,bandHeight){
    energy=Math.max(0,Math.min(.55,energy));bandHeight=Math.max(0,Math.min(1,bandHeight));
    const uniforms=material.uniforms;
    audioDirty ||= Math.abs(energy-uniforms.audioEnergy.value)>.0001 || Math.abs(bandHeight-uniforms.audioHeight.value)>.0001;
    uniforms.audioEnergy.value=energy;uniforms.audioHeight.value=bandHeight;
    if(!scope.signal.aborted && !document.hidden && audioDirty && Number(getComputedStyle(slot).opacity)>.02){
      draw();audioRenderCount++;audioDrawnEnergy=energy;audioDirty=false;
    }
  }
  function setMode(mode) {
    if(!['before','off','on'].includes(mode))throw new Error('Unknown lighting mode');
    if(scope.signal.aborted)return;
    if(mode==='on' && !quality.postProcessing)mode='off';
    const isGraded=mode!=='before';
    if(currentMode===null || isGraded!==gradedBase){
      geometry.getAttribute('rgba').array.set(isGraded?graded:arrays.colors);geometry.getAttribute('rgba').needsUpdate=true;
      highlightGeometry.getAttribute('color').array.set(isGraded?gradedHighlights:arrays.highlightColors);highlightGeometry.getAttribute('color').needsUpdate=true;
      highlightMaterial.opacity=isGraded?config.palette.softHighlightOpacity:.16;
      gradedBase=isGraded;
    }
    currentMode=mode;
    if(mode!=='on' && bloom){bloom.dispose();bloom=null;}
    draw();
    const stars=isGraded?config.palette.stars:originalStars;
    window.RESUME_STARFIELD_CONFIG.layers.forEach((layer,i)=>{layer.color=stars[i].color;layer.brightness=[...stars[i].brightness];});
    window.dispatchEvent(new Event('resume:starfieldpalette'));
    document.documentElement.dataset.lightingMode=mode;
    for(const [name,value] of Object.entries({background:config.palette.background,text:config.palette.text,paragraph:config.palette.paragraph}))document.documentElement.style.setProperty(`--lighting-${name}`,value);
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lightingChoice===mode)));
    currentMode=mode;
  }
  const snapshot=()=>({mode:currentMode,particleCount:geometry.getAttribute('position').count,softHighlights:highlightGeometry.getAttribute('position').count,
    warmParticles:currentMode==='before'?null:warmIndices.size,regionCounts,
    camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,projection:camera.projectionMatrix.toArray()},
    geometryHash:meta.sections.positions.sha256,sizeHash:meta.sections.sizes.sha256,geometryFileHash:meta.sha256,
    bloom:{enabled:currentMode==='on',created:!!bloom,resolution:bloom?.resolution??null,...config.bloom},
    audio:{energy:material.uniforms.audioEnergy.value,height:material.uniforms.audioHeight.value,drawnEnergy:audioDrawnEnergy,renderCount:audioRenderCount,
      contourParticles:contours.reduce((sum,value)=>sum+(value>.35?1:0),0)},
    animation:material.uniforms.audioEnergy.value>0,pointerResponse:false,
    disposed,pixelRatio:quality.pixelRatio,buffer:[canvas.width,canvas.height],canvasConnected:canvas.isConnected,renderCount,
    sourceParticleCount:sourceCount,memory:{...renderer.info.memory},programs:renderer.info.programs?.length||0,contextLost:renderer.getContext().isContextLost()});
  async function fingerprints(){
    const attributes={positions:geometry.getAttribute('position').array,sizes:geometry.getAttribute('pointSize').array,highlights:highlightGeometry.getAttribute('position').array};
    return Object.fromEntries(await Promise.all(Object.entries(attributes).map(async([name,array])=>{
      const bytes=array.buffer.slice(array.byteOffset,array.byteOffset+array.byteLength);
      const hash=await crypto.subtle.digest('SHA-256',bytes);
      return [name,[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')];
    })));
  }
  window.portraitLighting={setMode,setAudioResponse,snapshot,fingerprints,camera};
  buttons.forEach(button=>scope.on(button,'click',()=>setMode(button.dataset.lightingChoice)));
  resize();setMode(quality.postProcessing?'on':'off');
  scope.observe(new ResizeObserver(()=>{scope.clearTimeout(resizeTimer);resizeTimer=scope.timeout(resize,100);})).observe(slot);
  if(new URLSearchParams(location.search).has('capture') && document.querySelector('.lighting-controls'))document.querySelector('.lighting-controls').hidden=true;
  slot.dataset.ready='true';document.body.dataset.lightingReady='true';
  window.dispatchEvent(new Event('resume:portraitready'));
  return {pause:()=>scope.clearTimeout(resizeTimer),resume:resize,snapshot};
}
window.resumeVisualRuntime.register('portrait',init,{keys:['pixelRatio','portraitParticles','portraitHighlights','postProcessing','antialias']});
