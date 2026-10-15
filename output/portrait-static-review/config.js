/* 仅用于静态形状确认；正式网站首屏不引用这一页。 */
window.PORTRAIT_REVIEW_CONFIG = {
  source: '../../assets/portrait-profile/portrait-source-v1.png',
  seed: 20261014,
  particleCount: 36000,
  particleSize: [1.9, 3.25],
  brightness: 1,
  sampling: { step: 2, alphaThreshold: .1, lightThreshold: .21 },
  priority: {
    face: { x: [.24,.50], y: [.13,.53], weight: 4.5 },
    hair: { x: [.30,.77], y: [.015,.52], weight: 3.2 },
    shoulders: { x: [.10,.98], y: [.52,.97], weight: 1.15 }
  },
  depth: { range: 22, jitter: 3, cameraDistance: 2200 },
  glow: { fraction: .003, size: 10, opacity: .16 },
  landmarks: {
    forehead: { label: '额头', box: [.275,.18,.10,.11] },
    nose: { label: '鼻子', box: [.25,.285,.10,.105] },
    chin: { label: '下巴', box: [.315,.37,.115,.13] },
    shoulder: { label: '肩膀', box: [.61,.52,.32,.27] }
  }
};
