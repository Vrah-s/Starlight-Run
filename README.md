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

This prototype has a three-lane 3D course, an animated runner, moving forest scenery, jump/slide hazards, collectible coins and stars, three lives, score, best score, sound effects, pause, and persistent totals. The runner uses a realistic rigged human adventurer with idle, run, and jump animations. The main menu includes a character roster, missions, player log, settings, and a free in-game shop. The four selectable looks recolor this model; one is available immediately, and the others unlock through earned coins, XP, or playtime. One earned character grants an extra starting life. Profile and run history save locally on the device. No real-money purchases or ads are connected yet. The exported model is included locally with the game and cached for offline play. Its 44,920-triangle mesh and embedded textures make the initial download about 9 MB. The trail now has layered ground texture, uneven forest banks, scattered gravel and leaf litter, and more naturally varied trees. The character was generated with [Ara 3D Gen](https://ara3dgen.com/) and is released under CC0; Three.js and its loader utilities are MIT licensed. The 3D runtime and all model-loading code are bundled locally, so gameplay does not rely on a CDN.

