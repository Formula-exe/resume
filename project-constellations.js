import * as THREE from './vendor/three.module.min.js';

window.resumeVisualRuntime.register('projects',(scope,quality)=>{
const host = document.getElementById('projectConstellation');
const explorer = document.getElementById('projectExplorer');
const config = window.RESUME_PROJECT_CONSTELLATIONS;
if (host && explorer && config) {
  const canvas = document.createElement('canvas'); canvas.id = 'projectConstellationCanvas';
  canvas.setAttribute('aria-hidden', 'true'); host.append(canvas);
  let renderer, camera, scene, nodes, edges, resizeTimer;
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
  const ink = sprite.getContext('2d'); ink.fillStyle = '#fff';
  ink.beginPath(); ink.arc(16,16,12,0,Math.PI*2); ink.fill();
  const texture = new THREE.CanvasTexture(sprite); texture.colorSpace = THREE.SRGBColorSpace;
  const nodeMaterial = new THREE.PointsMaterial({ color: config.nodeColor, map: texture, size: config.nodeSize,
    sizeAttenuation: false, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color: config.lineColor, transparent: true,
    opacity: config.lineOpacity, depthWrite: false, toneMapped: false });

  function clearGeometry() {
    if (nodes) { scene.remove(nodes); nodes.geometry.dispose(); nodes = undefined; }
    if (edges) { scene.remove(edges); edges.geometry.dispose(); edges = undefined; }
  }
  function fallback(diagram) {
    const ns = 'http://www.w3.org/2000/svg';
    host.querySelector('svg')?.remove();
    if (!diagram) return;
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 500 300'); svg.setAttribute('aria-hidden', 'true');
    const position = point => [250+point[0]*200,150-point[1]*200];
    for (const [a,b] of diagram.edges) {
      const [x1,y1] = position(diagram.nodes[a]), [x2,y2] = position(diagram.nodes[b]);
      const line = document.createElementNS(ns, 'line');
      for (const [name,value] of Object.entries({x1,y1,x2,y2,stroke:config.lineColor,'stroke-opacity':config.lineOpacity})) line.setAttribute(name,String(value));
      svg.append(line);
    }
    diagram.nodes.forEach(point => {
      const [cx,cy] = position(point), dot = document.createElementNS(ns, 'circle');
      for (const [name,value] of Object.entries({cx,cy,r:3,fill:config.nodeColor})) dot.setAttribute(name,String(value));
      svg.append(dot);
    });
    host.append(svg);
  }
  function render() {
    if(scope.signal.aborted || document.hidden)return;
    const id = explorer.dataset.activeProject, diagram = config.diagrams[id];
    host.dataset.projectId = id ?? '';
    host.dataset.nodeCount = String(diagram?.nodes.length ?? 0);
    host.dataset.edgeCount = String(diagram?.edges.length ?? 0);
    if (!renderer) { fallback(diagram); host.dataset.ready = 'true'; return; }
    clearGeometry();
    if (!diagram) { renderer.clear(); host.dataset.ready = 'true'; return; }
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.pixelRatio)); renderer.setSize(width,height,false);
    const halfHeight = .73, halfWidth = Math.max(1.2, halfHeight * width / height);
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    const positions = diagram.nodes.flatMap(([x,y]) => [x,y,0]);
    const nodeGeometry = new THREE.BufferGeometry(); nodeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    nodes = new THREE.Points(nodeGeometry,nodeMaterial);
    const linePositions = diagram.edges.flatMap(([a,b]) => [...diagram.nodes[a],0,...diagram.nodes[b],0]);
    const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));
    edges = new THREE.LineSegments(lineGeometry,lineMaterial);
    scene.add(edges,nodes); renderer.render(scene,camera); host.dataset.ready = 'true';
  }
  let disposed=false;
  scope.cleanup(()=>{disposed=true;scope.clearTimeout(resizeTimer);clearGeometry();nodeMaterial.dispose();lineMaterial.dispose();texture.dispose();if(renderer){renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();}canvas.width=canvas.height=1;canvas.remove();host.querySelector('svg')?.remove();host.dataset.ready='false';});
  try {
    if(quality.mode==='static')throw new Error('Static constellation');
    renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:quality.antialias, preserveDrawingBuffer:true });
    renderer.setClearColor(0x000000,0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-1.2,1.2,.73,-.73,.1,10);
    camera.position.set(0,0,4); camera.lookAt(0,0,0);
  } catch { canvas.hidden = true; if(quality.mode!=='static')scope.timeout(()=>window.resumeVisualRuntime.fail('projects','WebGL unavailable'),0); }
  const schedule = () => { scope.clearTimeout(resizeTimer); resizeTimer = scope.timeout(render,100); };
  scope.on(window,'resume:projectchange',render);
  if ('ResizeObserver' in window) scope.observe(new ResizeObserver(schedule)).observe(host);
  scope.on(window,'resize',schedule);
  scope.on(canvas,'webglcontextlost',event=>{event.preventDefault();window.resumeVisualRuntime.fail('projects','WebGL context lost');});
  render();
  return {pause:()=>scope.clearTimeout(resizeTimer),resume:render,snapshot:()=>({disposed,renderer:!!renderer,pixelRatio:quality.pixelRatio,canvasConnected:canvas.isConnected,buffer:[canvas.width,canvas.height],
    memory:renderer?{...renderer.info.memory}:null,programs:renderer?.info.programs?.length||0,contextLost:renderer?.getContext().isContextLost()??true})};
}
},{decorative:false,keys:['mode','pixelRatio','antialias']});
