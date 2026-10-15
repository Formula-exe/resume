/* 只调近层星点的亮度；位置、数量、大小、色彩和相机均沿用原构图。 */
window.RESUME_AUDIO_STARS_CONFIG = {
  enabled: true,
  group: 'near',
  baseBrightness: 1,       // 原星点亮度的倍数；1 保留原来的静态亮度。
  gain: 8,                 // 实时 RMS 的增益；另叠加少量预分析能量与编排，再统一限幅。
  minimumBrightness: .85,
  maximumBrightness: 1.45, // 少量星点最多提高 45%，避免闪烁和大面积提亮。
  smoothingSpeed: 4,      // 每秒响应速度；越小越柔和，独立于帧率。
  pauseSmoothingSpeed: 3, // 暂停、缓冲或失败时，柔和回到基础亮度。
  maxDeltaTime: .05,      // 防止切回标签页后出现单帧跳变。
  settleEpsilon: .0005,
  readingGain: .12,
  sectionGain: {
    top: 1,
    highlights: .18,
    projects: .12,
    about: .25,
    experience: .12,
    skills: .10,
    education: .10,
    credentials: .08,
    contact: .05
  }
};
