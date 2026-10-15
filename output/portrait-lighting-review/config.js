/* 本轮只调颜色与光：几何、粒子大小、数量及人物相机来自冻结文件。 */
window.PORTRAIT_LIGHTING_CONFIG = {
  initialMode: 'off',
  palette: {
    background: '#060a12',
    text: '#edf3fc',
    paragraph: '#c8d2e3',
    cool: '#c6dcfa',
    warm: '#ffb767',
    warmFraction: .016,
    regionBrightness: { face: 1.06, hair: .92, shoulders: .61, body: .48 },
    stars: [
      { color: '#8294b8', brightness: [.14, .30] },
      { color: '#afc8ee', brightness: [.22, .42] },
      { color: '#d5e7ff', brightness: [.45, .64] }
    ],
    softHighlightOpacity: .12
  },
  bloom: { resolutionScale: .5, threshold: .46, knee: .08, radius: 1.2, strength: .70, maxOpacity: .14 }
};
