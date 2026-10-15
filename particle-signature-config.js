/* 静态粒子签名参数。修改后刷新，或派发 resume:signaturechange 事件重绘。 */
window.RESUME_SIGNATURE_CONFIG = {
  text: '张名宇',
  seed: 74345,
  position: { x: .53, y: .49 }, // 在右侧主视觉区域内的位置，0–1。
  scale: .97, // 整体缩放：1 为默认适配大小。
  particleSize: [1.35, 2.55], // 普通颗粒直径范围，CSS 像素。
  particleCount: 14000, // 采样颗粒数量上限。
  brightness: .95, // 透明材质整体亮度，0–1。
  colors: ['#fff0d5', '#f0d5ab', '#dcab74'],
  glow: { fraction: .004, size: 18, coreSize: 3.3, brightness: .32, color: '#ffddb0' },
  sampling: {
    width: 1400, height: 720,
    fontFamily: 'Signature Brush', fontSize: 360,
    rotation: -.1, // 仅二维采样图的书写倾斜角；相机固定。
    step: 2, alphaThreshold: 80, jitter: .9,
    flourish: true // 笔迹下方细收笔线。
  },
  fit: { width: .9, height: .62 },
  mobile: { breakpoint: 760, particleCount: 4500, particleSizeScale: .78 },
  maxPixelRatio: 1.75
};
