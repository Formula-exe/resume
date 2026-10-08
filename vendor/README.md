# Locally served browser assets

Unmodified engine and slim browser bundles, pinned to **4.4.0**.
Source: https://github.com/tsparticles/tsparticles
License: MIT, included in `LICENSE-tsparticles`.

Downloaded from:

- https://cdn.jsdelivr.net/npm/@tsparticles/engine@4.4.0/tsparticles.engine.min.js
- https://cdn.jsdelivr.net/npm/@tsparticles/slim@4.4.0/tsparticles.slim.bundle.min.js

These assets are served with the website to avoid runtime CDN dependencies.

## GSAP and ScrollTrigger

Unmodified browser bundles, pinned to **3.15.0**.
Source: https://github.com/greensock/GSAP
License: GSAP Standard License, https://gsap.com/standard-license/.
The original copyright and license headers are retained in both bundles.

- https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js
- https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js

Equivalent npm dependency: `npm install gsap@3.15.0`.
This native HTML project uses the browser bundles directly; no framework or build step is required.

## Phosphor icons

Unmodified regular SVG icons from **@phosphor-icons/core 2.1.1**.
Source: https://github.com/phosphor-icons/core
License: MIT, included in `icons/LICENSE`.
Downloaded from `https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/`.
Icons are CSS masks that follow the text color in both themes.
