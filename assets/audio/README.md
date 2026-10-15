# 网站背景音乐与测试素材

网站当前配乐为 Scott Buckley 的 **Moonlight**，舒缓的钢琴与弦乐器乐曲。

- 作者与作品页面：https://www.scottbuckley.com.au/library/moonlight/
- 官网原文件：https://www.scottbuckley.com.au/library/wp-content/uploads/2022/07/Moonlight.mp3
- 许可：Creative Commons Attribution 4.0（CC BY 4.0）。
- 使用说明：https://www.scottbuckley.com.au/library/using-this-music/
- 许可证：https://creativecommons.org/licenses/by/4.0/
- 本地文件：`moonlight-scott-buckley.mp3`，完整原文件，没有剪辑或转码。
- 网站页脚保留作品、作者、来源链接及许可证链接；播放音量由原 GainNode 调整为 0.14。
- Attribution: 'Moonlight' by Scott Buckley — released under CC-BY 4.0. www.scottbuckley.com.au

播放仍由用户点击后开始，沿用单个音频元素、AudioContext、媒体源与 AnalyserNode。当前增加实时三频段、音频预分析与曲目时间编排；场景联动有亮度上限、阅读衰减和减少动效开关，不改变音频输出链路。

`moonlight-analysis.json` 是当前 MP3 的能量、起音与估计音区特征，绑定原音频的 SHA-256。手工段落与流星时间点在根目录 `music-response-config.js`；换曲时重新分析，未校准的新曲不使用旧时间点。实现与检查见 `output/music-response-review/REVIEW.md`。

## 保留的控制验证素材

`ambient-test.wav` 是本项目合成的轻柔测试音：8 秒，22050 Hz，单声道，16-bit PCM。使用 146.832、219.993、293.665 Hz 的正弦叠加，首尾有柔和渐入渐出，不引用外部音乐素材。

该文件作为此前声音控制检查的测试素材保留。当前网页不使用这条测试音；实际配乐路径、音量、循环和加载超时配置集中在根目录 `audio-config.js`。
