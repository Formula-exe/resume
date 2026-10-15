/* 当前曲目的专属编排。换曲或文件校验不一致时，不使用以下时间点。 */
window.RESUME_MUSIC_RESPONSE_CONFIG = {
  analysis: 'assets/audio/moonlight-analysis.json',
  worker: 'music-analysis-worker.js',
  sourceHash: '7feb8c703983dbdfc97018f004cfebad8f03b86f2382c58c0ad24e375d4c17f5',
  duration: 254.3337,
  bands: { low: [40, 250], middle: [250, 2000], high: [2000, 12000], floorDb: -96, ceilingDb: -24, attack: 14, release: 7 },
  mapping: { energyGain: .16, onsetGain: .10, arrangementGain: .08, portraitMaximum: .55,
    portraitGain: .85, portraitBandWidth: .13, onsetDecay: .18, onsetWindow: .65,
    responseSpeed: 6, heightSpeed: 3, seekThreshold: .5, portraitFps: 18 },
  phases: [
    { start: 0, end: 18, label: '序章', kind: 'intro', intensity: [.03, .12] },
    { start: 18, end: 40, label: '蓄势', kind: 'build', intensity: [.12, .55] },
    { start: 40, end: 57, label: '展开', kind: 'burst', intensity: [.75, .55] },
    { start: 57, end: 90, label: '回旋', kind: 'flow', intensity: [.35, .25] },
    { start: 90, end: 104, label: '蓄势', kind: 'build', intensity: [.30, .75] },
    { start: 104, end: 150, label: '星潮', kind: 'burst', intensity: [.85, .70] },
    { start: 150, end: 178, label: '静息', kind: 'rest', intensity: [.12, .07] },
    { start: 178, end: 203, label: '回响', kind: 'build', intensity: [.18, .48] },
    { start: 203, end: 220, label: '余韵', kind: 'flow', intensity: [.35, .12] },
    { start: 220, end: 254.334, label: '尾声', kind: 'outro', intensity: [.10, 0] }
  ],
  meteors: {
    maximumOpacity: .65, minimumSectionGain: .5,
    cues: [
      { time: 45.2, duration: 1.45, from: [.94, .19], to: [.72, .39] },
      { time: 105.1, duration: 1.60, from: [.91, .15], to: [.68, .40] },
      { time: 119.5, duration: 1.35, from: [.97, .32], to: [.79, .50] },
      { time: 143.5, duration: 1.55, from: [.88, .17], to: [.66, .42] },
      { time: 193.3, duration: 1.45, from: [.96, .23], to: [.75, .45] },
      { time: 214.0, duration: 1.50, from: [.90, .19], to: [.70, .40] }
    ]
  }
};
