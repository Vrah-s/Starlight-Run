# Starlight Run

A mobile-first, full-screen portrait endless runner inspired by the supplied reference: a blocky runner races along a fantasy trail, changes lanes, jumps or slides past hazards, and collects coins and glowing stars. The scene is drawn locally in Canvas with perspective; no external assets or network connection are needed to play after the first load.

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

This is a self-contained 2.5D canvas prototype with a three-lane endless course, jump/slide hazards, collectible coins and stars, three lives, score, best score, sound effects, pause, and persistent totals. It uses original procedural graphics rather than the reference image’s art or assets. A later production build can move the same game loop into a 3D engine and replace the vector scenery with original 3D models.

