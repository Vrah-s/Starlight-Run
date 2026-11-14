import * as THREE from './vendor-three.module.js';
import { GLTFLoader } from './GLTFLoader.js';

const canvas = document.getElementById('game-canvas');
const $ = id => document.getElementById(id);
const SAVE_KEY = 'starlight-run-save-v1';
const LANES = [-2.25, 0, 2.25];
const CONTACT_Z = 0.1;
const freshSave = { best: 0, totalCoins: 0 };
let save = readSave();
let phase = 'ready';
let score = 0, runCoins = 0, lives = 3;
let lane = 1, targetLane = 1;
let jumpTimer = 0, slideTimer = 0, invulnerableTimer = 0;
let spawnTimer = 0, elapsed = 0, worldDistance = 0, lastFrame = 0;
let soundOn = true, audioContext, swipeStart = null, hudCache = {};
let gameWidth = innerWidth, gameHeight = innerHeight;
const moving = [];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
renderer.setSize(gameWidth, gameHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9d91c6, 37, 112);
const camera = new THREE.PerspectiveCamera(59, gameWidth / gameHeight, 0.1, 140);
camera.position.set(0, 6.1, 8.7);
camera.lookAt(0, 1.3, -17);

const mats = {};
function material(name, color, roughness = .88, extra = {}) {
  mats[name] = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  return mats[name];
}
material('soil', 0x9e714e); material('soilLight', 0xb28258); material('grass', 0x446849);
material('grassLight', 0x668258); material('stone', 0x525464); material('stoneLight', 0x858392);
material('bark', 0x60432f); material('barkLight', 0x916242); material('pineA', 0x1e4c43);
material('pineB', 0x2f6652); material('pineC', 0x438061); material('blue', 0x2c56a0);
material('blueLight', 0x467ac0); material('skin', 0xe5ad82); material('hair', 0x4b3029);
material('pants', 0x313a68); material('shoe', 0x4c342b); material('cream', 0xf4dfb3);
material('crystal', 0x37cbe8, .24, { emissive: 0x057baf, emissiveIntensity: .45 });
material('coin', 0xffc53d, .28, { metalness: .45, emissive: 0x9a5c00, emissiveIntensity: .25 });
material('coinBright', 0xffe47d, .25, { metalness: .38 });
material('star', 0x52ffd0, .24, { emissive: 0x08ad86, emissiveIntensity: .55 });
material('rock', 0x676775); material('rockLit', 0x93909b); material('leaf', 0x345f42);
material('fern', 0x497e4e); material('fernLight', 0x78a75a); material('flower', 0xe2a9dc);

scene.add(new THREE.HemisphereLight(0xc9dcff, 0x675040, 2.0));
const sun = new THREE.DirectionalLight(0xffe5c2, 3.1); sun.position.set(-8, 15, 7); scene.add(sun);
const moonLight = new THREE.DirectionalLight(0x879dff, 1.2); moonLight.position.set(8, 10, -20); scene.add(moonLight);

function box(width, height, depth, mat, parent, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(...position); parent.add(mesh); return mesh;
}
function makeSky() {
  const geometry = new THREE.SphereGeometry(110, 32, 20);
  // Paint a seamless procedural nebula texture for a richer illustrated skybox.
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 1536; skyCanvas.height = 768;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 768);
  skyGrad.addColorStop(0, '#11163f'); skyGrad.addColorStop(.42, '#343577'); skyGrad.addColorStop(.76, '#9a69a7'); skyGrad.addColorStop(1, '#f1a7c4');
  skyCtx.fillStyle = skyGrad; skyCtx.fillRect(0, 0, 1536, 768);
  const glow = (x, y, rx, ry, color) => { const g = skyCtx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); skyCtx.save(); skyCtx.scale(1, ry / rx); skyCtx.fillStyle = g; skyCtx.fillRect(x - rx, y / (ry / rx) - rx, rx * 2, rx * 2); skyCtx.restore(); };
  glow(850, 305, 420, 165, 'rgba(224,75,208,.54)'); glow(965, 325, 300, 120, 'rgba(63,219,241,.48)'); glow(700, 360, 235, 100, 'rgba(117,101,245,.46)'); glow(490, 265, 225, 95, 'rgba(169,72,196,.35)');
  for (let i = 0; i < 1100; i++) { const x = Math.random() * 1536, y = Math.random() * 520, r = Math.random() < .08 ? 1.8 : .45 + Math.random() * .8; skyCtx.fillStyle = `rgba(225,239,255,${.25 + Math.random() * .7})`; skyCtx.beginPath(); skyCtx.arc(x, y, r, 0, Math.PI * 2); skyCtx.fill(); }
  const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false }));
  dome.position.y = 5; scene.add(dome);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.65, 24, 18), new THREE.MeshBasicMaterial({ color: 0xd9f2ff }));
  moon.position.set(-10, 14, -48); scene.add(moon);
  const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14), new THREE.MeshBasicMaterial({ color: 0x99dfff, transparent: true, opacity: .13, depthWrite: false }));
  moonGlow.position.copy(moon.position); scene.add(moonGlow);
  // Twinkling stars above the valley.
  const starPositions = [];
  for (let i = 0; i < 360; i++) starPositions.push((Math.random() - .5) * 100, 7 + Math.random() * 34, -12 - Math.random() * 83);
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starPoints = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xe5f8ff, size: .19, sizeAttenuation: true, transparent: true, opacity: .82 })); scene.add(starPoints);
  // Soft nebula color bands, built from transparent low-poly ellipsoids.
  for (const [x, y, z, color, scale] of [[0, 14, -53, 0x8f46c8, [8, 2.8, 1]], [5, 16, -57, 0x39b9d3, [7, 2.1, 1]], [-6, 12, -49, 0xd45bb1, [5, 1.7, 1]]]) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, depthWrite: false }));
    cloud.position.set(x, y, z); cloud.scale.set(...scale); scene.add(cloud);
  }
}
function makeGround() {
  // Procedural soil grain keeps the trail from reading as a flat brown strip.
  const texCanvas = document.createElement('canvas'); texCanvas.width = texCanvas.height = 256;
  const ctx = texCanvas.getContext('2d'); ctx.fillStyle = '#94704f'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) { const v = 70 + Math.random() * 90; ctx.fillStyle = `rgba(${v + 30},${v},${v - 25},${Math.random() * .24})`; ctx.beginPath(); ctx.ellipse(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 4, .7 + Math.random() * 2.4, Math.random() * 3, 0, Math.PI * 2); ctx.fill(); }
  const soilTexture = new THREE.CanvasTexture(texCanvas); soilTexture.colorSpace = THREE.SRGBColorSpace; soilTexture.wrapS = soilTexture.wrapT = THREE.RepeatWrapping; soilTexture.repeat.set(2, 18);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 150), new THREE.MeshStandardMaterial({ color: 0x395b43, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.18, -50); scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 125), new THREE.MeshStandardMaterial({ map: soilTexture, roughness: 1, color: 0xc9a47e }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -.08, -52); scene.add(road);
  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x76614f, roughness: 1 });
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 125), shoulderMat);
    shoulder.rotation.x = -Math.PI / 2; shoulder.position.set(side * 4.75, -.11, -52); scene.add(shoulder);
  }
  // Small, irregular stones and leaf litter make the path feel like a trail.
  for (let i = 0; i < 54; i++) {
    const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(.11 + Math.random() * .2, 1), i % 3 ? mats.stone : mats.soilLight);
    pebble.position.set((Math.random() - .5) * 7.8, .015, -Math.random() * 112); pebble.scale.set(1.25, .48, .85); scene.add(pebble);
    moving.push({ kind: 'pebble', mesh: pebble, z: pebble.position.z });
  }
}
function makeTree(x, z, scale = 1, broadleaf = false) {
  const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(scale); scene.add(tree);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15, .27, 2.0, 6), mats.bark); trunk.position.y = .95; tree.add(trunk);
  if (broadleaf) {
    const crownMat = [mats.pineB, mats.pineC, mats.leaf][Math.floor(Math.random() * 3)];
    for (let i = 0; i < 6; i++) {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.74 + Math.random() * .48, 12, 10), i % 3 ? crownMat : mats.pineC);
      crown.position.set((Math.random() - .5) * 1.9, 2.15 + Math.random() * .95, (Math.random() - .5) * 1.4); crown.scale.set(1.1, .78 + Math.random() * .3, .92); tree.add(crown);
    }
  } else {
    const foliage = [mats.pineA, mats.pineB, mats.pineC][Math.floor(Math.random() * 3)];
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.05 - i * .12, 1.7, 12, 1), foliage);
      cone.position.y = 1.6 + i * .68; tree.add(cone);
    }
  }
  return tree;
}
function makeMountain(x, z, height, width, color) {
  const mountain = new THREE.Group(); mountain.position.set(x, 0, z); scene.add(mountain);
  const rings = 18, segments = 36, verts = [], colors = [], indices = [];
  const peakColor = new THREE.Color(0xc6cfe5), baseColor = new THREE.Color(color);
  for (let r = 0; r <= rings; r++) {
    const t = r / rings, taper = Math.sin(Math.PI * t) ** .68, y = t * height;
    for (let s = 0; s <= segments; s++) {
      const angle = s / segments * Math.PI * 2, wobble = 1 + .085 * Math.sin(angle * 5 + x) + .04 * Math.sin(angle * 9 + z);
      const radius = width * taper * wobble;
      verts.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const snowMix = THREE.MathUtils.smoothstep(t, .77 + .035 * Math.sin(angle * 4), .94);
      const c = baseColor.clone().lerp(peakColor, snowMix); colors.push(c.r, c.g, c.b);
      if (r < rings && s < segments) { const a = r * (segments + 1) + s, b = a + segments + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const base = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })); base.position.y = -.4; mountain.add(base);
  return mountain;
}
function makeLandmarks() {
  const ridgeColors = [0x777aa5, 0x535e88, 0x344a6f];
  for (let row = 0; row < 3; row++) {
    for (let i = -2; i <= 2; i++) {
      const x = i * 12 + (row % 2) * 5;
      makeMountain(x, -63 - row * 8, 14 + Math.random() * 13, 7 + Math.random() * 5, ridgeColors[row]);
    }
  }
  // Ancient trail gate beyond the first bend.
  const ruin = new THREE.Group(); ruin.position.set(-7.2, 0, -28); ruin.scale.setScalar(1.18); scene.add(ruin);
  const stone = new THREE.MeshStandardMaterial({ color: 0x777384, roughness: .96, flatShading: true });
  box(.55, 3.1, .65, stone, ruin, [-1.5, 1.55, 0]); box(.55, 3.1, .65, stone, ruin, [1.5, 1.55, 0]);
  box(3.5, .65, .7, stone, ruin, [0, 3.2, 0]); box(4.2, .3, .9, mats.stoneLight, ruin, [0, 3.62, 0]);
  const waterfallGroup = new THREE.Group(); waterfallGroup.position.set(8.4, 0, -38); scene.add(waterfallGroup);
  const cliff = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 2), mats.stone); cliff.position.set(0, 2.2, -1); cliff.scale.set(1.25, 1.1, .9); waterfallGroup.add(cliff);
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x82e9ff, transparent: true, opacity: .72, side: THREE.DoubleSide, depthWrite: false });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8, 1, 12), waterMat); fall.position.set(0, 3.2, 2.7); waterfallGroup.add(fall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0x49c9ec, transparent: true, opacity: .42, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, .06, 3.5); waterfallGroup.add(pool);
}
const scenery = [];
function makeScenery() {
  for (let side of [-1, 1]) {
    for (let i = 0; i < 19; i++) {
      const scale = .8 + Math.random() * 1.2;
      const x = side * (5.4 + Math.random() * 8.5);
      const z = -i * 3.0 - Math.random() * 2.5;
      const tree = makeTree(x, z, scale, Math.random() < .2);
      scenery.push(tree);
    }
  }
  // Layer low shrubs, grasses, flowers, and stones along both sides of the path.
  for (let i = 0; i < 74; i++) {
    const side = Math.random() < .5 ? -1 : 1;
    const x = side * (4.8 + Math.random() * 8.6), z = -Math.random() * 92;
    const plant = new THREE.Group(); plant.position.set(x, 0, z); scene.add(plant);
    const tuftCount = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < tuftCount; j++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(.22 + Math.random() * .18, 10, 8), j % 2 ? mats.fern : mats.fernLight);
      leaf.scale.set(.65, 1.5, .62); leaf.position.set((Math.random() - .5) * .55, .36, (Math.random() - .5) * .48); leaf.rotation.z = (Math.random() - .5) * .75; plant.add(leaf);
    }
    if (i % 4 === 0) { const bloom = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), i % 8 ? mats.flower : mats.coinBright); bloom.position.set(0, .45, 0); plant.add(bloom); }
    if (i % 3 === 0) { const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(.2 + Math.random() * .3, 1), mats.stone); stone.position.set((Math.random() - .5) * .8, .12, .25); stone.scale.y = .6; plant.add(stone); }
    scenery.push(plant);
  }
  for (let i = 0; i < 12; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.38 + Math.random() * .4, 0), mats.crystal);
    crystal.position.set((Math.random() < .5 ? -1 : 1) * (4.9 + Math.random() * 3), .5 + Math.random() * .5, -i * 8 - 8);
    crystal.scale.y = 1.8; crystal.rotation.y = Math.random() * Math.PI; scene.add(crystal);
    moving.push({ kind: 'crystal', mesh: crystal, z: crystal.position.z, baseY: crystal.position.y });
  }
}
function makeHero() {
  const root = new THREE.Group(); scene.add(root); root.position.set(0, 0, .5);
  const fallback = new THREE.Group(); root.add(fallback);
  const torso = new THREE.Group(); torso.position.y = 1.4; fallback.add(torso);
  const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(.49, .68, 5, 16), mats.blue); jacket.position.y = .05; torso.add(jacket);
  const packMaterial = new THREE.MeshStandardMaterial({ color: 0x986544, roughness: .93 });
  const backpack = new THREE.Mesh(new THREE.SphereGeometry(.46, 18, 14), packMaterial); backpack.scale.set(.88, 1.05, .78); backpack.position.set(0, .1, .42); torso.add(backpack);
  const packTop = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb98250, roughness: .9 }));
  packTop.scale.set(1.2, .45, .8); packTop.position.set(0, .52, .44); torso.add(packTop);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0xd8b27c, roughness: .86 });
  for (const side of [-1, 1]) { const strap = new THREE.Mesh(new THREE.CapsuleGeometry(.052, .65, 3, 8), strapMat); strap.position.set(side * .33, -.02, -.28); strap.rotation.z = side * -.12; torso.add(strap); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.17, .2, .27, 14), mats.skin); neck.position.y = .78; torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.09, -.025); torso.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.405, 24, 18), mats.skin); face.scale.set(.94, 1.08, .95); head.add(face);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.41, 20, 16), mats.hair); hair.scale.set(1.02, .57, 1.03); hair.position.set(0, .33, .04); head.add(hair);
  const nape = new THREE.Mesh(new THREE.SphereGeometry(.29, 16, 12), mats.hair); nape.scale.set(1.15, .7, .8); nape.position.set(0, .04, .28); head.add(nape);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x342c38, roughness: .55 });
  for (const side of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), eyeMaterial); eye.position.set(side * .14, -.035, -.365); head.add(eye); }
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * .48, .45, 0); torso.add(pivot);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .52, 4, 12), mats.blueLight); sleeve.position.y = -.34; pivot.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CapsuleGeometry(.145, .13, 3, 10), mats.skin); cuff.position.y = -.78; pivot.add(cuff);
    arms.push(pivot);
  }
  const legs = [];
  const knees = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * .235, 1.02, 0); fallback.add(pivot);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .43, 4, 12), mats.pants); thigh.position.y = -.28; pivot.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -.54; pivot.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .48, 4, 12), mats.pants); shin.position.y = -.29; knee.add(shin);
    const boot = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), mats.shoe); boot.scale.set(1.05, .63, 1.5); boot.position.set(0, -.57, -.09); knee.add(boot);
    legs.push(pivot); knees.push(knee);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.88, 20), new THREE.MeshBasicMaterial({ color: 0x171b2e, transparent: true, opacity: .32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; root.add(shadow);
  return { root, fallback, torso, head, arms, legs, knees, shadow, mixer: null, actions: null, currentAction: null };
}
function loadHumanHero() {
  const loader = new GLTFLoader();
  loader.load('./assets/athletic-runner.glb', gltf => {
    const avatar = new THREE.Group();
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 3.5 / Math.max(size.y, .01);
    model.scale.setScalar(scale);
    model.position.set(-(bounds.min.x + bounds.max.x) * .5 * scale, -bounds.min.y * scale, 0);
    model.rotation.y = Math.PI;
    avatar.add(model);
    hero.root.add(avatar);
    hero.fallback.visible = false;
    hero.character = avatar;
    hero.mixer = new THREE.AnimationMixer(model);
    hero.actions = new Map();
    for (const clip of gltf.animations) {
      const action = hero.mixer.clipAction(clip);
      hero.actions.set(clip.name.toLowerCase(), action);
    }
    hero.currentAction = null;
    setHeroAction('idle', true);
  }, undefined, error => console.warn('Human model unavailable; using built-in runner.', error));
}
function setHeroAction(kind, loop = true) {
  if (!hero.actions) return;
  const aliases = { run: ['run'], idle: ['idle'], jump: ['running jump', 'jump', 'jump start'], slide: ['crouch idle'] };
  const action = (aliases[kind] || [kind]).map(name => hero.actions.get(name)).find(Boolean);
  if (!action || action === hero.currentAction) return;
  const previous = hero.currentAction;
  action.reset(); action.enabled = true; action.clampWhenFinished = !loop;
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.fadeIn(.12).play();
  if (previous) previous.fadeOut(.12);
  hero.currentAction = action;
}
function addEntity(mesh, kind, laneIndex, z, extra = {}) {
  mesh.position.x = LANES[laneIndex]; mesh.position.z = z; scene.add(mesh);
  const entity = { mesh, kind, laneIndex, hit: false, collected: false, ...extra }; moving.push(entity); return entity;
}
function makeRock() {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.83, 0), mats.rock); rock.position.y = .7; rock.scale.set(1.22, .9, 1); group.add(rock);
  const face = new THREE.Mesh(new THREE.DodecahedronGeometry(.44, 0), mats.rockLit); face.position.set(-.34, 1.03, -.32); face.scale.set(.75, .55, .3); group.add(face);
  return group;
}
function makeLog() {
  const group = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(.37, .43, 2.5, 7), mats.barkLight); log.rotation.z = Math.PI / 2; log.position.y = .48; group.add(log);
  const end = new THREE.Mesh(new THREE.CircleGeometry(.34, 7), mats.bark); end.rotation.y = Math.PI / 2; end.position.set(-1.27, .48, 0); group.add(end);
  return group;
}
function makeBranch() {
  const group = new THREE.Group();
  box(.23, 2.3, .24, mats.bark, group, [-1.08, 1.1, 0]); box(.23, 2.3, .24, mats.bark, group, [1.08, 1.1, 0]);
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(.2, .27, 2.65, 7), mats.barkLight); branch.rotation.z = Math.PI / 2; branch.position.y = 2.15; group.add(branch);
  const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(.72, 0), mats.pineB); leaves.position.set(0, 2.48, 0); leaves.scale.set(1.9, .7, .85); group.add(leaves);
  return group;
}
function makeCoin(star = false) {
  const group = new THREE.Group();
  if (star) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.62, 0), mats.star); gem.scale.y = 1.25; group.add(gem);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(.85, 10, 8), new THREE.MeshBasicMaterial({ color: 0x70ffe2, transparent: true, opacity: .12, depthWrite: false })); group.add(aura);
  } else {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .12, 16), mats.coin); coin.rotation.x = Math.PI / 2; group.add(coin);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .13, 12), mats.coinBright); center.rotation.x = Math.PI / 2; center.position.z = -.01; group.add(center);
  }
  group.position.y = 1.15; return group;
}
function removeEntity(entity) {
  scene.remove(entity.mesh);
  entity.mesh.traverse(child => { if (child.isMesh && child.geometry) child.geometry.dispose(); });
}

makeSky(); makeGround(); makeLandmarks(); makeScenery();
const hero = makeHero();
loadHumanHero();
const dynamicEntities = [];
function spawnPattern() {
  const blocked = Math.floor(Math.random() * 3);
  const choices = ['rock', 'log', 'branch'].slice(0, Math.min(3, 1 + Math.floor(score / 900)));
  const type = choices[Math.floor(Math.random() * choices.length)];
  const hazard = type === 'rock' ? makeRock() : type === 'log' ? makeLog() : makeBranch();
  addEntity(hazard, 'hazard', blocked, -78, { hazardType: type }); dynamicEntities.push(moving[moving.length - 1]);
  const safe = [0, 1, 2].filter(index => index !== blocked);
  const coinLane = safe[Math.floor(Math.random() * safe.length)];
  for (let i = 0; i < 4; i++) {
    const coin = makeCoin(); coin.position.y = 1.1;
    addEntity(coin, 'coin', coinLane, -70 + i * 4); dynamicEntities.push(moving[moving.length - 1]);
  }
  if (Math.random() < .18) {
    const starLane = safe.find(index => index !== coinLane) ?? safe[0];
    const star = makeCoin(true); star.position.y = 1.5;
    addEntity(star, 'star', starLane, -54); dynamicEntities.push(moving[moving.length - 1]);
  }
}
function resize() {
  gameWidth = innerWidth; gameHeight = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35)); renderer.setSize(gameWidth, gameHeight, false);
  camera.aspect = gameWidth / gameHeight; camera.updateProjectionMatrix();
}
function startRun() {
  requestFullscreen(); phase = 'running'; score = 0; runCoins = 0; lives = 3; lane = 1; targetLane = 1;
  jumpTimer = 0; slideTimer = 0; invulnerableTimer = 0; spawnTimer = .9; elapsed = 0; worldDistance = 0; hudCache = {};
  for (const entity of [...dynamicEntities]) removeEntity(entity);
  moving.splice(0, moving.length, ...moving.filter(entity => !dynamicEntities.includes(entity)));
  dynamicEntities.length = 0; hero.root.position.set(0, 0, .5); hero.root.scale.set(1, 1, 1); if (hero.actions) setHeroAction('run', true);
  $('start-screen').classList.add('hidden'); $('pause-screen').classList.add('hidden'); $('result-screen').classList.add('hidden');
  $('pause-button').classList.remove('hidden'); $('swipe-hint').classList.remove('hidden'); updateHud(); playSound('start');
  setTimeout(() => { if (phase === 'running') $('swipe-hint').classList.add('hidden'); }, 4300);
}
function pauseRun() { if (phase !== 'running') return; phase = 'paused'; $('pause-screen').classList.remove('hidden'); $('pause-button').classList.add('hidden'); }
function resumeRun() { if (phase !== 'paused') return; phase = 'running'; lastFrame = performance.now(); $('pause-screen').classList.add('hidden'); $('pause-button').classList.remove('hidden'); }
function endRun() {
  phase = 'gameover'; save.best = Math.max(save.best, Math.floor(score)); persist();
  $('pause-button').classList.add('hidden'); $('final-score').textContent = Math.floor(score); $('best-score').textContent = save.best; $('final-coins').textContent = runCoins; $('result-screen').classList.remove('hidden');
}
function doSwipe(dx, dy) {
  if (phase !== 'running') return;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) targetLane = THREE.MathUtils.clamp(targetLane + (dx > 0 ? 1 : -1), 0, 2);
  else if (Math.abs(dy) > 28) { if (dy < 0) jump(); else slide(); }
  else jump();
}
function jump() { if (phase === 'running' && jumpTimer <= 0 && slideTimer <= 0) { jumpTimer = .78; playSound('jump'); } }
function slide() { if (phase === 'running' && slideTimer <= 0 && jumpTimer <= 0) { slideTimer = .66; playSound('move'); } }
function update(delta) {
  elapsed += delta;
  if (hero.mixer) hero.mixer.update(delta);
  const movingNow = phase === 'running';
  if (!movingNow) { animateHero(0); return; }
  const speed = Math.min(27, 16 + score / 155);
  score += delta * (12 + speed * .62); worldDistance += speed * delta;
  lane += (targetLane - lane) * Math.min(1, delta * 11);
  hero.root.position.x += (LANES[targetLane] - hero.root.position.x) * Math.min(1, delta * 8);
  if (jumpTimer > 0) jumpTimer = Math.max(0, jumpTimer - delta);
  if (slideTimer > 0) slideTimer = Math.max(0, slideTimer - delta);
  if (invulnerableTimer > 0) invulnerableTimer = Math.max(0, invulnerableTimer - delta);
  spawnTimer -= delta;
  if (spawnTimer <= 0) { spawnPattern(); spawnTimer = Math.max(.88, 1.58 - score / 6000); }
  const remove = [];
  for (const entity of moving) {
    if (entity.kind === 'dash' || entity.kind === 'pebble') {
      entity.mesh.position.z += speed * delta;
      if (entity.mesh.position.z > 8) entity.mesh.position.z -= entity.kind === 'dash' ? 83.2 : 112;
    } else if (entity.kind === 'crystal') {
      entity.mesh.position.z += speed * delta; entity.mesh.rotation.y += delta * .35;
      entity.mesh.position.y = entity.baseY + Math.sin(elapsed * 1.4 + entity.z) * .16;
      if (entity.mesh.position.z > 8) entity.mesh.position.z -= 96;
    } else if (entity.kind === 'hazard' || entity.kind === 'coin' || entity.kind === 'star') {
      entity.mesh.position.z += speed * delta;
      if (entity.kind === 'coin') entity.mesh.rotation.y += delta * 3.5;
      if (entity.kind === 'star') { entity.mesh.rotation.y += delta * 1.5; entity.mesh.position.y = 1.45 + Math.sin(elapsed * 3 + entity.mesh.position.z) * .18; }
      if (entity.kind === 'hazard' && !entity.hit && entity.mesh.position.z >= CONTACT_Z) {
        entity.hit = true;
        if (Math.abs(hero.root.position.x - LANES[entity.laneIndex]) < .9 && invulnerableTimer <= 0) {
          const safe = entity.hazardType === 'branch' ? slideTimer > .12 : jumpTimer > .12;
          if (!safe) { lives--; invulnerableTimer = 1.3; playSound('hit'); updateHud(); if (lives <= 0) endRun(); }
        }
      }
      if ((entity.kind === 'coin' || entity.kind === 'star') && !entity.collected && entity.mesh.position.z > -.3 && entity.mesh.position.z < 1.25 && Math.abs(hero.root.position.x - LANES[entity.laneIndex]) < .88) {
        entity.collected = true; const amount = entity.kind === 'star' ? 10 : 1; runCoins += amount; save.totalCoins += amount; persist(); playSound(entity.kind); updateHud(); remove.push(entity);
      }
      if (entity.mesh.position.z > 8) remove.push(entity);
    }
  }
  for (const entity of remove) { removeEntity(entity); dynamicEntities.splice(dynamicEntities.indexOf(entity), 1); moving.splice(moving.indexOf(entity), 1); }
  for (const tree of scenery) {
    tree.position.z += speed * delta * .42;
    tree.rotation.z = Math.sin(elapsed * .8 + tree.position.x * .7) * .018;
    if (tree.position.z > 14) tree.position.z -= 83;
  }
  animateHero(speed);
  camera.position.x += (hero.root.position.x * .13 - camera.position.x) * Math.min(1, delta * 2.4);
  camera.position.y = 6.1 + (jumpTimer > 0 ? Math.sin((1 - jumpTimer / .78) * Math.PI) * .18 : 0) + Math.sin(elapsed * 10) * .018;
  camera.lookAt(hero.root.position.x * .12, 1.15, -16.5);
  updateHud();
}
function animateHero(speed) {
  const run = phase === 'running';
  if (hero.mixer) {
    const jumping = run && jumpTimer > 0;
    const sliding = run && slideTimer > 0;
    setHeroAction(jumping ? 'jump' : sliding ? 'slide' : run ? 'run' : 'idle', !(jumping || sliding));
    const beat = elapsed * (10 + Math.min(6, speed * .25));
    const jumpHeight = jumping ? Math.sin((1 - jumpTimer / .78) * Math.PI) * 1.35 : 0;
    hero.root.position.y += ((jumpHeight + (run && !jumping && !sliding ? Math.abs(Math.sin(beat)) * .035 : 0)) - hero.root.position.y) * .42;
    hero.root.scale.y = THREE.MathUtils.lerp(hero.root.scale.y, sliding ? .72 : 1, .22);
    return;
  }
  const beat = elapsed * (10 + Math.min(6, speed * .25));
  const jumping = run && jumpTimer > 0;
  const sliding = run && slideTimer > 0;
  const jumpHeight = jumping ? Math.sin((1 - jumpTimer / .78) * Math.PI) * 2.1 : 0;
  hero.root.position.y += ((jumpHeight + (run && !jumping && !sliding ? Math.abs(Math.sin(beat)) * .07 : 0)) - hero.root.position.y) * .45;
  hero.root.scale.y = THREE.MathUtils.lerp(hero.root.scale.y, sliding ? .55 : 1, .23);
  hero.legs[0].rotation.x = run && !sliding ? Math.sin(beat) * .58 : 0;
  hero.legs[1].rotation.x = run && !sliding ? Math.sin(beat + Math.PI) * .58 : 0;
  hero.knees[0].rotation.x = run && !sliding ? Math.max(0, Math.sin(beat + Math.PI / 2)) * .55 : 0;
  hero.knees[1].rotation.x = run && !sliding ? Math.max(0, Math.sin(beat - Math.PI / 2)) * .55 : 0;
  hero.arms[0].rotation.x = run && !sliding ? Math.sin(beat + Math.PI) * .6 : 0;
  hero.arms[1].rotation.x = run && !sliding ? Math.sin(beat) * .6 : 0;
  hero.torso.rotation.z = run && !sliding ? Math.sin(beat * .5) * .035 : 0;
  hero.head.rotation.y = Math.sin(elapsed * .8) * .035;
}
function updateHud() {
  const data = { score: String(Math.floor(score)), coins: String(runCoins), lives: '♥ '.repeat(Math.max(0, lives)).trim(), milestone: `STAR PATH · ${Math.floor(score / 10)} M`, fill: `${Math.floor(score % 1000) / 10}%` };
  for (const [key, value] of Object.entries(data)) {
    if (hudCache[key] === value) continue; hudCache[key] = value;
    if (key === 'fill') $('distance-fill').style.width = value;
    else if (key === 'lives') { $('lives').textContent = value; $('lives').setAttribute('aria-label', `${lives} lives left`); }
    else $(key).textContent = value;
  }
}
function requestFullscreen() {
  const root = document.documentElement;
  try { if (root.requestFullscreen) root.requestFullscreen().catch(() => {}); else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen(); } catch { /* Installed mobile web apps may already be full-screen. */ }
}
function playSound(kind) {
  if (!soundOn) return;
  const tones = { move: [275, .045], jump: [480, .11], coin: [770, .07], star: [970, .16], hit: [125, .22], start: [560, .12] };
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const [frequency, duration] = tones[kind] || tones.move;
    const osc = audioContext.createOscillator(), gain = audioContext.createGain(); osc.type = 'sine'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(.04, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
  } catch { /* Sound may be unavailable in some mobile browsers. */ }
}
// Mobile browsers do not all synthesize a click consistently for full-screen
// PWAs. Activate on primary pointer release, then ignore its follow-up click.
function bindTap(id, action) {
  const button = $(id); let lastPointerActivation = -Infinity;
  button.addEventListener('pointerup', event => {
    if (!event.isPrimary || event.button !== 0) return;
    lastPointerActivation = performance.now(); action();
  });
  button.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() - lastPointerActivation < 700) { event.preventDefault(); return; }
    action();
  });
}
function frame(now) {
  const delta = Math.min(.05, Math.max(0, (now - lastFrame) / 1000 || 0)); lastFrame = now;
  update(delta); renderer.render(scene, camera); requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', event => { if (event.target.closest('button')) return; swipeStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', event => { if (!swipeStart) return; const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y; swipeStart = null; doSwipe(dx, dy); });
canvas.addEventListener('pointercancel', () => swipeStart = null);
bindTap('start-button', startRun); bindTap('restart-button', startRun); bindTap('pause-restart', startRun);
$('pause-button').addEventListener('click', pauseRun); $('resume-button').addEventListener('click', resumeRun);
$('sound-button').addEventListener('click', () => { soundOn = !soundOn; $('sound-button').textContent = soundOn ? '◖))' : '◖'; $('sound-button').setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off'); if (soundOn) playSound('coin'); });
window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'running') pauseRun(); });
function readSave() { try { return { ...freshSave, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return { ...freshSave }; } }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* A full local store does not stop a run. */ } }
resize(); updateHud(); requestAnimationFrame(frame);
window.__starlightReady = true;
if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
