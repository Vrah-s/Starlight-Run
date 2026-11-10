# Starlight Run

A mobile-first, full-screen portrait 3D endless runner inspired by the supplied reference: a stylized adventurer races along a moonlit fantasy trail, changes lanes, jumps or slides past hazards, and collects coins and glowing stars. It uses a locally bundled Three.js WebGL 3D renderer and original procedural scenery, so the engine and game assets can be cached together for offline play.

## Touch controls

- Swipe left/right to change lanes.
- Swipe up to jump over rocks and fallen logs.
- Swipe down to slide under low branches.
- Tap the screen to jump.
- Use the pause button to take a break. The run pauses when the app is backgrounded.

The portrait app opens full-screen when installed. Press **Start Run** to request full-screen mode in browsers that support it. On iPhone, add the hosted page to the Home Screen from Safari and launch it from its icon.

## Local preview

From this folder, run `python3 -m http.server 8000` and open `http://localhost:8000`. This is only a development preview; the intended controls and layout are for touch phones in portrait orientation.

## Publish

Upload the contents of this folder to a public GitHub repository and enable GitHub Pages, or manually deploy the folder with Netlify Drop. Open the published HTTPS link once while online to cache the game for offline use. When updating, increment `CACHE_NAME` in `sw.js` so installed copies refresh the cache.

## Current prototype

This prototype has a three-lane 3D course, an animated runner, moving forest scenery, jump/slide hazards, collectible coins and stars, three lives, score, best score, sound effects, pause, and persistent totals. Its models and scenery are original procedural shapes rather than the reference image’s art or assets. The 3D runtime is included locally as `vendor-three.module.js` and cached by the service worker.

