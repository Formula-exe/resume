# 透明人物素材：最终选用版本的生成记录

方式：内置 imagegen，`transparent_background: true`。

输入：用户提供的网页参考图，保存为 `reference.jpg`。
选用结果：`portrait-source-v1.png`，实际尺寸 1254 × 1254，RGBA PNG。

最终选用版本的完整提示词：

```text
Use case: background-extraction.
Input image 1: EDIT TARGET. Extract ONLY the existing particle human figure on the right side of this website screenshot, faithfully preserving its shape, pose, colors and texture.
Asset type: one RGBA PNG cutout, square 1024x1024 canvas, truly transparent background.
Subject: the LEFT-FACING side-profile male-presenting human head, flowing short wavy hair, neck and upper shoulders made entirely from fine warm amber, warm ivory, and cool silver-white star particles in the supplied image.
Constraints: preserve the reference person's forehead slope, distinct protruding nose tip pointing LEFT, lip notch, rounded chin, slender neck curve, top/back hair mass, and shoulder contour extending to the lower right. Preserve the sparse granular/starry texture and warm orange front contour contrasted with cooler white/silver particles in the hair and back shoulder. Keep the dark interior gaps as transparent holes, NOT opaque black fill. Preserve the source's particle depiction; do NOT invent a new face, front-facing portrait, solid skin, clothing, smooth statue, or photorealistic bust.
Remove completely: near-black website background, unrelated background stars, every text element and navigation item, every logo, all orbital curves (especially the red orbit on the right and bottom), all constellation linework and UI marks.
Framing: crop/recenter the extracted subject on its own 1024x1024 canvas; same left-facing pose and silhouette proportions, entire hair, forehead, nose, chin, neck and both upper shoulder edges present with about 7% clear margin. The lower torso particles should naturally dissolve into transparency like the source. Avoid cutting off the nose, hair top, back of head or shoulder.
Transparency: all space surrounding and between the person's individual particle specks is truly transparent alpha. No opaque background, no rendered checkerboard, no black matte, no glow rectangle. Retain only the small colored particles and their existing very restrained local luminous edges.
Output ONLY the transparent extracted figure. No labels, annotations, text, border, background, orbit, or second panel.
```
