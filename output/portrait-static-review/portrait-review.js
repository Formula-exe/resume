import * as THREE from '../../vendor/three.module.min.js';

const config = window.PORTRAIT_REVIEW_CONFIG;
const source = document.getElementById('sourceCanvas');
const target = document.getElementById('portraitCanvas');
const preview = document.getElementById('comparisonCanvas');
const status = document.getElementById('status');

function randomSource(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function inRegion(x,y,region) { return x >= region.x[0] && x <= region.x[1] && y >= region.y[0] && y <= region.y[1]; }
function sprite() {
  const image = document.createElement('canvas'); image.width = image.height = 64;
  const ctx = image.getContext('2d');
  const gradient = ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)'); gradient.addColorStop(.12,'rgba(255,255,255,.55)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,64,64);
  const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

async function init() {
  const image = new Image(); image.src = config.source; await image.decode();
  const width = image.naturalWidth, height = image.naturalHeight;
  source.width = target.width = width; source.height = target.height = height;
  const ink = source.getContext('2d',{willReadFrequently:true}); ink.drawImage(image,0,0);
  const rgba = ink.getImageData(0,0,width,height).data;
  const random = randomSource(config.seed);
  const candidates = [];
  for (let y = 0; y < height; y += config.sampling.step) {
    for (let x = 0; x < width; x += config.sampling.step) {
      const index = (y*width+x)*4;
      const r = rgba[index]/255, g = rgba[index+1]/255, b = rgba[index+2]/255, alpha = rgba[index+3]/255;
      if (alpha < config.sampling.alphaThreshold) continue;
      const luminance = .2126*r + .7152*g + .0722*b;
      const signal = (.65*Math.max(r,g,b)+.35*luminance)*alpha;
      if (signal < config.sampling.lightThreshold) continue;
      const u = x/width, v = y/height;
      let region = 'body', weight = 1;
      for (const name of ['face','hair','shoulders']) {
        if (inRegion(u,v,config.priority[name])) { region=name; weight=config.priority[name].weight; break; }
      }
      // Weighted reservoir order prioritizes face and hair without duplicating source pixels.
      const rank = -Math.log(Math.max(1e-8,random()))/weight;
      candidates.push({x,y,r,g,b,alpha,luminance,signal,region,rank});
    }
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const samples = candidates.slice(0,config.particleCount);
  const positions=[],colors=[],sizes=[],highlights=[],highlightColors=[];
  const counts={face:0,hair:0,shoulders:0,body:0};
  let minZ=Infinity,maxZ=-Infinity,warm=0,cool=0;
  const color = new THREE.Color();
  for (const point of samples) {
    counts[point.region]++;
    const head = point.region==='face' || point.region==='hair';
    // A shallow 2.5D estimate only. Front-facing projection keeps the original silhouette.
    const z = config.depth.range*(point.luminance-.45+(head ? .12 : 0))+(random()-.5)*config.depth.jitter;
    minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z);
    positions.push(point.x+.5-width/2,height/2-point.y-.5,z);
    color.setRGB(point.r,point.g,point.b,THREE.SRGBColorSpace);
    colors.push(color.r,color.g,color.b,point.alpha*config.brightness);
    sizes.push(config.particleSize[0]+random()*(config.particleSize[1]-config.particleSize[0]));
    if (point.r-point.b>.10) warm++;
    if (Math.abs(point.r-point.b)<.08 || point.b>point.r) cool++;
    if (point.signal>.75 && random()<config.glow.fraction) {
      highlights.push(point.x+.5-width/2,height/2-point.y-.5,z+.01);
      highlightColors.push(color.r,color.g,color.b);
    }
  }

  const renderer = new THREE.WebGLRenderer({canvas:target,alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1); renderer.setSize(width,height,false); renderer.setClearColor(0x000000,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const fov=2*Math.atan(height/(2*config.depth.cameraDistance))*180/Math.PI;
  const camera=new THREE.PerspectiveCamera(fov,width/height,1,8000); camera.position.set(0,0,config.depth.cameraDistance); camera.lookAt(0,0,0);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('rgba',new THREE.Float32BufferAttribute(colors,4));
  geometry.setAttribute('pointSize',new THREE.Float32BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({
    uniforms:{cameraDistance:{value:config.depth.cameraDistance}},
    vertexShader:`attribute vec4 rgba; attribute float pointSize; uniform float cameraDistance; varying vec4 vRgba;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vRgba=rgba;gl_PointSize=pointSize*cameraDistance/max(1.0,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec4 vRgba; void main(){float radius=length(gl_PointCoord-vec2(.5));float coverage=1.0-smoothstep(.35,.5,radius);if(coverage<.01)discard;gl_FragColor=vec4(vRgba.rgb,vRgba.a*coverage);
      #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false
  });
  scene.add(new THREE.Points(geometry,material));
  const glowGeometry=new THREE.BufferGeometry(); glowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(highlights,3)); glowGeometry.setAttribute('color',new THREE.Float32BufferAttribute(highlightColors,3));
  const glowMaterial=new THREE.PointsMaterial({map:sprite(),vertexColors:true,size:config.glow.size,sizeAttenuation:false,transparent:true,opacity:config.glow.opacity,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false});
  scene.add(new THREE.Points(glowGeometry,glowMaterial)); renderer.render(scene,camera);

  // Both panels retain the same pixel dimensions, transform, framing, and dark review background.
  const labelHeight=64,gap=28;
  preview.width=width*2+gap; preview.height=height+labelHeight;
  const panel=preview.getContext('2d'); panel.fillStyle='#07090c'; panel.fillRect(0,0,preview.width,preview.height);
  panel.fillStyle='#eee7da'; panel.font='26px "Microsoft YaHei",sans-serif';
  panel.fillText('源图 · 透明人物素材',20,41); panel.fillText('彩色星点 · 静态成形',width+gap+20,41);
  panel.drawImage(source,0,labelHeight); panel.drawImage(target,width+gap,labelHeight);
  const checkpoints={};
  for (const [name,landmark] of Object.entries(config.landmarks)) {
    const [x,y,w,h]=landmark.box;
    const matches=samples.filter(point=>point.x/width>=x && point.x/width<=x+w && point.y/height>=y && point.y/height<=y+h);
    checkpoints[name]={label:landmark.label,samples:matches.length};
  }
  const summary={width,height,candidates:candidates.length,particles:samples.length,regions:counts,headFraction:(counts.face+counts.hair)/samples.length,
    zRange:[minZ,maxZ],depthToHeight:(maxZ-minZ)/height,warmColorSamples:warm,coolWhiteSamples:cool,softHighlights:highlights.length/3,checkpoints,
    fixedCamera:true,animation:false,pointerResponse:false};
  window.portraitReview={summary,positions,colors,sizes,highlights,highlightColors,
    camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,
      aspect:camera.aspect,near:camera.near,far:camera.far,projection:camera.projectionMatrix.toArray()}};
  document.getElementById('dimensions').textContent=`两张图均为 ${width} × ${height} 像素；同位置、同裁切，固定相机。`;
  status.textContent=`${samples.length.toLocaleString()} 个彩色星点，脸与头发占 ${Math.round(summary.headFraction*100)}%。仅确认静态形状。`;
  document.body.dataset.ready='true';
}
init().catch(error=>{status.textContent='素材预览未完成，请检查本地浏览器的 WebGL 支持。';console.error(error);});
