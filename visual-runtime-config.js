/* 手机构图与渲染预算统一在这里调整；auto 在手机或节省流量时选择 low。 */
window.RESUME_VISUAL_CONFIG = {
  mobileBreakpoint: 760,
  mobileLandscapeBreakpoint: 1024,
  defaultMode: 'auto',
  defaultPostProcessing: false,
  profiles: {
    standard: { pixelRatio: 1.5, signatureParticles: 14000, portraitParticles: 36000, portraitHighlights: 33,
      starCountScale: 1, postProcessingAllowed: true, portraitFps: 18, visualFps: 60, meterFps: 30, antialias: true },
    low: { pixelRatio: 1, signatureParticles: 4500, portraitParticles: 9000, portraitHighlights: 10,
      starCountScale: .45, postProcessingAllowed: false, portraitFps: 10, visualFps: 24, meterFps: 15, antialias: false },
    static: { pixelRatio: 1, signatureParticles: 0, portraitParticles: 0, portraitHighlights: 0,
      starCountScale: 0, postProcessingAllowed: false, portraitFps: 0, visualFps: 0, meterFps: 10, antialias: false }
  },
  mobile: { actorInset: 24, actorHeightMin: 200, actorHeightMax: 300, actorHeightVw: 62,
    signatureScale: .98, portraitScale: 1.15, copyGap: 24 },
  fallback: { signature: 'assets/visual-fallback/signature.png', portrait: 'assets/visual-fallback/portrait.png', sky: 'assets/visual-fallback/sky.svg' }
};
