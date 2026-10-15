/* 静态星空的全部构图参数。修改后刷新页面即可；没有自动飞行或指针响应。 */
window.RESUME_STARFIELD_CONFIG = {
  seed: 20261013, // 固定随机种子：刷新和调整窗口不会重新洗牌。
  camera: { focalLength: 900, nearDepth: 650 }, // 固定透视相机，单位为构图坐标。
  layerDistance: 700, // 相邻星层的 Z 距离；越大，远层的投影星点越小。
  depthSpread: .16, // 每层厚度，占 layerDistance 的比例。
  referenceArea: 1600 * 920,
  minDensityScale: .48, // 小屏幕适当减少数量，仍保留三层。
  maxPixelRatio: 2,
  layers: [
    // count：候选数量；size：空间半径范围；brightness：透明度范围（0–1）。
    { name: 'far', depth: 2, count: 240, size: [.75, 1.4], brightness: [.18, .4], glow: 0, color: '#aebbc9' },
    { name: 'middle', depth: 1, count: 85, size: [.8, 1.45], brightness: [.32, .62], glow: .6, color: '#e5ddd0' },
    { name: 'near', depth: 0, count: 22, size: [.75, 1.2], brightness: [.58, .86], glow: 5, color: '#f4dfc1' }
  ],
  composition: {
    textZoneEnd: .42, // 左侧约四成：降低星点密度和亮度。
    textDensity: .12,
    textBrightness: .2,
    textPadding: 24, // 正文实际矩形周围的完全无星点区域（CSS 像素）。
    visualZone: { x: .73, y: .5, radiusX: .23, radiusY: .29 },
    visualDensity: .3, // 右侧主视觉预留区，只保留少量背景星点。
    visualBrightness: .55,
    mobileBreakpoint: 760
  }
};
