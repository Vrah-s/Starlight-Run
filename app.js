const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const SAVE_KEY = 'starlight-run-save-v1';
const CONTACT_Z = .88;
const laneNames = [-1, 0, 1];
let save = readSave();
let phase = 'ready';
let score = 0;
let runCoins = 0;
let lives = 3;
let targetLane = 0;
let lanePosition = 0;
let jumpTimer = 0;
let slideTimer = 0;
let invulnerableTimer = 0;
let spawnTimer = 0;
let elapsed = 0;
let worldDistance = 0;
let lastTime = 0;
let soundOn = true;
let audioContext;
let swipeStart = null;
let hudCache = {};
let w = window.innerWidth, h = window.innerHeight, pixelRatio = 1;
let stars = [];
let objects = [];

function readSave() {
  try { return { best: 0, totalCoins: 0, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
  catch { return { best: 0, totalCoins: 0 }; }
}
function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
function resize() {
  w = window.innerWidth; h = window.innerHeight; pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * pixelRatio); canvas.height = Math.round(h * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  seedStars();
}
function seedStars() {
  let seed = 18371;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  stars = Array.from({ length: Math.round(w / 7) }, () => ({ x: random() * w, y: random() * h * .35, r: .5 + random() * 1.5, phase: random() * 6.28 }));
}
function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, h * .55);
  sky.addColorStop(0, '#111538'); sky.addColorStop(.44, '#333674'); sky.addColorStop(.79, '#995da9'); sky.addColorStop(1, '#f29bbe');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const haze = ctx.createRadialGradient(w * .59, h * .29, 0, w * .59, h * .29, w * .52);
  haze.addColorStop(0, '#79d5eb65'); haze.addColorStop(.35, '#a34edb35'); haze.addColorStop(1, '#38236500');
  ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h * .58);
  for (const star of stars) {
    const alpha = .4 + .55 * Math.abs(Math.sin(elapsed * .8 + star.phase));
    ctx.fillStyle = `rgba(230,244,255,${alpha})`; ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
  }
  // Crescent-lit moon
  ctx.save(); ctx.shadowColor = '#dcf6ff'; ctx.shadowBlur = 23; ctx.fillStyle = '#d7ebf5';
  ctx.beginPath(); ctx.arc(w * .25, h * .18, Math.min(w, h) * .043, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#5b5a96'; ctx.beginPath(); ctx.arc(w * .27, h * .165, Math.min(w, h) * .039, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  drawMountains();
}
function drawMountains() {
  const horizon = h * .365;
  const layers = [
    { color: '#6e709f', points: [[0,.30],[.11,.21],[.19,.34],[.31,.19],[.43,.35],[.55,.26],[.69,.37],[.81,.20],[.94,.33],[1,.25]] },
    { color: '#454d7f', points: [[0,.39],[.12,.29],[.22,.4],[.34,.27],[.48,.42],[.59,.32],[.73,.43],[.86,.29],[1,.4]] },
    { color: '#29375e', points: [[0,.45],[.13,.37],[.25,.46],[.4,.35],[.55,.47],[.67,.39],[.82,.47],[.92,.36],[1,.46]] }
  ];
  layers.forEach(layer => {
    ctx.beginPath(); ctx.moveTo(0, horizon);
    layer.points.forEach(([x,y]) => ctx.lineTo(x*w, y*h));
    ctx.lineTo(w, horizon + 3); ctx.closePath(); ctx.fillStyle = layer.color; ctx.fill();
  });
  // Pine silhouettes at the mountain foot
  for (let i = 0; i < 24; i++) {
    const x = i * w / 23, size = h * (.035 + (i % 3) * .007), base = horizon + h * .065 + (i % 4) * 2;
    drawPine(x, base, size, i % 2 ? '#203b4f' : '#294653');
  }
}
function roadHalfAtT(t) { return w * (.075 + .405 * Math.max(0, Math.min(1, t))); }
function roadY(z) { return h * .36 + (h * .64) * Math.max(0, Math.min(1, z)); }
function roadX(lane, z) { const t = Math.max(0, Math.min(1, z)); return w * .5 + lane * roadHalfAtT(t) * .64; }
function drawPine(x, base, size, color) {
  ctx.fillStyle = '#59473e'; ctx.fillRect(x - size * .075, base - size * .28, size * .15, size * .3);
  ctx.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    const top = base - size * (.4 + k * .23), width = size * (.72 - k * .13);
    ctx.beginPath(); ctx.moveTo(x, top - size * .2); ctx.lineTo(x - width / 2, top + size * .33); ctx.lineTo(x + width / 2, top + size * .33); ctx.closePath(); ctx.fill();
  }
}
function drawForestSides() {
  const horizon = h * .36;
  const parallax = (worldDistance * .013) % 1;
  for (let side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      let t = ((i / 12 + parallax) % 1);
      const y = horizon + t * h * .63, scale = .35 + t * 1.9;
      const roadHalf = roadHalfAtT(t);
      const x = w * .5 + side * (roadHalf + w * (.045 + .08 * t) + (i % 3) * w * .015);
      drawPine(x, y, Math.max(12, h * .055 * scale), i % 2 ? '#244a43' : '#315a4d');
    }
  }
}
function drawPath() {
  const horizon = h * .36;
  ctx.fillStyle = '#294b3e'; ctx.fillRect(0, horizon, w, h - horizon);
  const edge = ctx.createLinearGradient(0, horizon, 0, h);
  edge.addColorStop(0, '#738258'); edge.addColorStop(.35, '#597145'); edge.addColorStop(1, '#33583d');
  ctx.fillStyle = edge;
  ctx.beginPath(); ctx.moveTo(w * .5 - w * .13, horizon); ctx.lineTo(w * .5 + w * .13, horizon); ctx.lineTo(w * 1.05, h); ctx.lineTo(-w * .05, h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * .5 - w * .095, horizon); ctx.lineTo(w * .5 + w * .095, horizon); ctx.lineTo(w * .965, h); ctx.lineTo(w * .035, h); ctx.closePath();
  const dirt = ctx.createLinearGradient(0, horizon, 0, h); dirt.addColorStop(0, '#9c7a68'); dirt.addColorStop(.32, '#ad8058'); dirt.addColorStop(1, '#c3905b'); ctx.fillStyle = dirt; ctx.fill();
  // broken stone path edges
  ctx.strokeStyle = '#e8ca8a88'; ctx.lineWidth = Math.max(1, w * .008);
  ctx.beginPath(); ctx.moveTo(w * .405, horizon); ctx.lineTo(w * .045, h); ctx.moveTo(w * .595, horizon); ctx.lineTo(w * .955, h); ctx.stroke();
  // lane marks drift toward the player
  const shift = (worldDistance * .18) % .16;
  for (let laneSep of [-.32, .32]) {
    for (let i = 0; i < 9; i++) {
      const z = (i / 9 + shift) % 1;
      const y = roadY(z), x = w * .5 + roadHalfAtT(z) * laneSep;
      const dashH = 2 + z * h * .027, dashW = 1 + z * w * .008;
      ctx.fillStyle = `rgba(242,220,174,${.16 + z * .43})`; ctx.fillRect(x - dashW / 2, y, dashW, dashH);
    }
  }
  drawGroundPlants();
}
function drawGroundPlants() {
  const horizon = h * .36;
  for (let side of [-1,1]) {
    for (let i=0;i<9;i++) {
      const z = ((i/9 + (worldDistance*.08)%1)%1), y = horizon + z*h*.64;
      const x = w*.5 + side*(roadHalfAtT(z)+w*(.025+z*.11));
      const size = 2+z*w*.025;
      ctx.fillStyle = i%2 ? '#78945d' : '#9cab62';
      ctx.beginPath(); ctx.ellipse(x,y,size*1.4,size*.55,0,0,Math.PI*2); ctx.fill();
      if (i%3===0) { ctx.fillStyle='#d99db2';ctx.beginPath();ctx.arc(x+size,y-size*.45,size*.45,0,Math.PI*2);ctx.fill(); }
    }
  }
}
function project(z, lane) { const t = Math.max(0, Math.min(1, z)); return { x: roadX(lane, t), y: roadY(t), scale: .23 + t * 1.05 }; }
function drawCoin(x,y,scale,star=false) {
  const radius = (star ? 11 : 9) * scale;
  ctx.save(); ctx.translate(x,y); ctx.shadowColor=star?'#6ffff0':'#ffd755';ctx.shadowBlur=15*scale;
  if (star) { ctx.fillStyle='#60ffd1';ctx.beginPath(); for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?radius*.48:radius;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.strokeStyle='#d2fff3';ctx.lineWidth=1.5*scale;ctx.stroke(); }
  else { ctx.fillStyle='#f4ad31';ctx.beginPath();ctx.ellipse(0,0,radius*.72,radius,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#ffed83';ctx.lineWidth=2*scale;ctx.stroke();ctx.fillStyle='#fff4ab';ctx.fillRect(-1.5*scale,-radius*.55,2*scale,radius*1.1); }
  ctx.restore();
}
function drawHazard(obj) {
  const p = project(obj.z,obj.lane), s = p.scale, base = p.y;
  if (obj.type === 'rock') {
    ctx.fillStyle='#4d4854';ctx.beginPath();ctx.moveTo(p.x-26*s,base);ctx.lineTo(p.x-20*s,base-25*s);ctx.lineTo(p.x-5*s,base-40*s);ctx.lineTo(p.x+20*s,base-33*s);ctx.lineTo(p.x+31*s,base-10*s);ctx.lineTo(p.x+29*s,base);ctx.closePath();ctx.fill();
    ctx.fillStyle='#777080';ctx.beginPath();ctx.moveTo(p.x-20*s,base-25*s);ctx.lineTo(p.x-5*s,base-40*s);ctx.lineTo(p.x+2*s,base-19*s);ctx.lineTo(p.x-12*s,base-8*s);ctx.closePath();ctx.fill();
  } else if (obj.type === 'log') {
    ctx.save();ctx.translate(p.x,base-15*s);ctx.rotate(-.08);ctx.fillStyle='#684532';ctx.fillRect(-39*s,-10*s,78*s,20*s);ctx.fillStyle='#ad7650';ctx.beginPath();ctx.ellipse(-38*s,0,7*s,10*s,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#724a36';ctx.lineWidth=2*s;ctx.beginPath();ctx.ellipse(-38*s,0,4*s,7*s,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  } else if (obj.type === 'branch') {
    ctx.fillStyle='#503e43';ctx.fillRect(p.x-39*s,base-53*s,78*s,13*s);ctx.fillStyle='#80564b';ctx.fillRect(p.x-34*s,base-50*s,68*s,6*s);ctx.fillStyle='#2c493e';ctx.fillRect(p.x-29*s,base-65*s,13*s,22*s);ctx.fillRect(p.x+20*s,base-65*s,12*s,22*s);
  }
}
function drawObjects() {
  const sorted = [...objects].sort((a,b)=>a.z-b.z);
  for (const obj of sorted) {
    if (obj.z < 0 || obj.z > 1.1) continue;
    const p = project(obj.z,obj.lane);
    if (obj.kind === 'coin' || obj.kind === 'star') drawCoin(p.x,p.y-(obj.kind==='star'?14*p.scale:10*p.scale),p.scale,obj.kind==='star');
    else drawHazard(obj);
  }
}
function laneScreenX(lane) { return roadX(lanePosition, .87); }
function drawRunner() {
  const x = laneScreenX(0), floorY = roadY(.89);
  const jumpProgress = jumpTimer > 0 ? 1-jumpTimer/.72 : 0;
  const jumpLift = jumpTimer > 0 ? Math.sin(jumpProgress*Math.PI)*h*.13 : 0;
  const sliding = slideTimer > 0;
  const blink = invulnerableTimer > 0 && Math.floor(elapsed*14)%2===0;
  if (blink) return;
  const unit = Math.max(1.5,Math.min(w*.0065,h*.0038));
  const bodyY = floorY - jumpLift;
  ctx.save();ctx.translate(x,bodyY);
  ctx.fillStyle='#261a2c66';ctx.beginPath();ctx.ellipse(0,4*unit,16*unit,5*unit,0,0,Math.PI*2);ctx.fill();
  if (sliding) {
    ctx.fillStyle='#33253d';ctx.fillRect(-11*unit,-20*unit,22*unit,15*unit);
    ctx.fillStyle='#294e93';ctx.fillRect(-23*unit,-27*unit,39*unit,14*unit);
    ctx.fillStyle='#dda679';ctx.fillRect(13*unit,-27*unit,11*unit,8*unit);
    ctx.fillStyle='#62412f';ctx.fillRect(-25*unit,-16*unit,12*unit,7*unit);ctx.fillRect(8*unit,-16*unit,15*unit,7*unit);
    ctx.fillStyle='#583d32';ctx.fillRect(-12*unit,-38*unit,21*unit,16*unit);ctx.fillStyle='#dda679';ctx.fillRect(-8*unit,-36*unit,15*unit,11*unit);ctx.fillStyle='#3b2a2c';ctx.fillRect(-12*unit,-42*unit,21*unit,8*unit);
  } else {
    const run = Math.sin(elapsed*17)*3*unit;
    ctx.fillStyle='#5c402f';ctx.fillRect(-10*unit,-22*unit,9*unit,21*unit+run);ctx.fillRect(2*unit,-22*unit,9*unit,21*unit-run);
    ctx.fillStyle='#342333';ctx.fillRect(-12*unit,-3*unit,13*unit,5*unit);ctx.fillRect(1*unit,-3*unit,14*unit,5*unit);
    ctx.fillStyle='#28549a';ctx.fillRect(-13*unit,-47*unit,27*unit,28*unit);
    ctx.fillStyle='#dda679';ctx.fillRect(-21*unit,-45*unit,8*unit,24*unit+run);ctx.fillRect(14*unit,-45*unit,8*unit,24*unit-run);
    ctx.fillStyle='#583d32';ctx.fillRect(-9*unit,-68*unit,19*unit,21*unit);
    ctx.fillStyle='#dda679';ctx.fillRect(-7*unit,-66*unit,15*unit,15*unit);
    ctx.fillStyle='#38262b';ctx.fillRect(-10*unit,-72*unit,21*unit,10*unit);ctx.fillRect(-6*unit,-76*unit,15*unit,5*unit);
    ctx.fillStyle='#fff3d5';ctx.fillRect(2*unit,-60*unit,2*unit,2*unit);
  }
  ctx.restore();
}
function drawWorld() {
  drawSky();drawPath();drawForestSides();drawObjects();drawRunner();
  const vignette=ctx.createRadialGradient(w*.5,h*.52,h*.22,w*.5,h*.52,h*.83);vignette.addColorStop(.65,'#11133800');vignette.addColorStop(1,'#11133855');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
}
function spawnPattern() {
  const blocked = Math.floor(Math.random()*3);
  const hazardTypes = ['rock','log','branch'];
  const difficulty = score;
  const type = hazardTypes[Math.floor(Math.random()*Math.min(3,1+Math.floor(difficulty/850)))];
  objects.push({kind:'hazard',type,lane:laneNames[blocked],z:-.02,hit:false});
  const safeLanes = laneNames.filter(lane=>lane!==blocked);
  const coinLane = safeLanes[Math.floor(Math.random()*safeLanes.length)];
  for(let i=0;i<4;i++) objects.push({kind:'coin',lane:coinLane,z:-.08-i*.105,collected:false});
  if(Math.random()<.14) objects.push({kind:'star',lane:safeLanes.find(lane=>lane!==coinLane) ?? safeLanes[0],z:-.32,collected:false});
}
function update(delta) {
  elapsed+=delta;
  if(phase!=='running') return;
  const speed=Math.min(.92,.42+score/5600);
  score+=delta*(14+speed*18);worldDistance+=speed*delta;
  lanePosition+=(targetLane-lanePosition)*Math.min(1,delta*14);
  if(jumpTimer>0)jumpTimer=Math.max(0,jumpTimer-delta);
  if(slideTimer>0)slideTimer=Math.max(0,slideTimer-delta);
  if(invulnerableTimer>0)invulnerableTimer=Math.max(0,invulnerableTimer-delta);
  spawnTimer-=delta;
  const interval=Math.max(.77,1.48-score/7200);
  if(spawnTimer<=0){spawnPattern();spawnTimer=interval;}
  for(const obj of objects){
    const previous=obj.z;obj.z+=speed*delta;
    if(obj.kind==='hazard'&&!obj.hit&&previous<CONTACT_Z&&obj.z>=CONTACT_Z){
      obj.hit=true;
      if(Math.abs(lanePosition-obj.lane)<.43&&invulnerableTimer<=0){
        const safe=(obj.type==='rock'||obj.type==='log')?jumpTimer>0:slideTimer>0;
        if(!safe){lives--;invulnerableTimer=1.35;playSound('hit');updateHud();if(lives<=0)endRun();}
      }
    }
    if((obj.kind==='coin'||obj.kind==='star')&&!obj.collected&&obj.z>=.82&&obj.z<=.96&&Math.abs(lanePosition-obj.lane)<.43){
      obj.collected=true;const amount=obj.kind==='star'?10:1;runCoins+=amount;save.totalCoins+=amount;persist();playSound(obj.kind==='star'?'star':'coin');updateHud();
    }
  }
  objects=objects.filter(obj=>obj.z<1.08&&!(obj.collected));
  updateHud();
}
function setLane(direction){if(phase!=='running')return;targetLane=Math.max(-1,Math.min(1,targetLane+direction));playSound('move');}
function jump(){if(phase!=='running')return;if(jumpTimer<=0&&slideTimer<=0){jumpTimer=.72;playSound('jump');}}
function slide(){if(phase!=='running')return;if(slideTimer<=0&&jumpTimer<=0){slideTimer=.62;playSound('move');}}
function onSwipe(dx,dy){
  if(phase!=='running')return;
  if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>24)setLane(dx>0?1:-1);
  else if(Math.abs(dy)>25)dy<0?jump():slide();
  else jump();
}
function updateHud(){
  const values={score:String(Math.floor(score)),coins:String(runCoins),lives:'♥ '.repeat(Math.max(0,lives)).trim(),milestone:`STAR PATH · ${Math.floor(score/10)} M`,fill:`${Math.floor(score%1000)/10}%`};
  for(const [key,value] of Object.entries(values)){
    if(hudCache[key]===value)continue;hudCache[key]=value;
    if(key==='fill')$('distance-fill').style.width=value;
    else if(key==='lives'){$('lives').textContent=value;$('lives').setAttribute('aria-label',`${lives} lives left`);}
    else $(key).textContent=value;
  }
}
function startRun(){
  requestFullscreen();phase='running';score=0;runCoins=0;lives=3;targetLane=0;lanePosition=0;jumpTimer=0;slideTimer=0;invulnerableTimer=0;spawnTimer=.75;elapsed=0;worldDistance=0;objects=[];hudCache={};
  $('start-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('result-screen').classList.add('hidden');$('pause-button').classList.remove('hidden');$('swipe-hint').classList.remove('hidden');
  setTimeout(()=>{if(phase==='running')$('swipe-hint').classList.add('hidden');},4200);updateHud();playSound('start');
}
function pauseRun(){if(phase!=='running')return;phase='paused';$('pause-screen').classList.remove('hidden');$('pause-button').classList.add('hidden');}
function resumeRun(){if(phase!=='paused')return;phase='running';$('pause-screen').classList.add('hidden');$('pause-button').classList.remove('hidden');}
function endRun(){
  phase='gameover';save.best=Math.max(save.best,Math.floor(score));persist();
  $('pause-button').classList.add('hidden');$('final-score').textContent=Math.floor(score);$('best-score').textContent=save.best;$('final-coins').textContent=runCoins;$('result-screen').classList.remove('hidden');
}
function requestFullscreen(){
  const root=document.documentElement;
  try{if(root.requestFullscreen)root.requestFullscreen().catch(()=>{});else if(root.webkitRequestFullscreen)root.webkitRequestFullscreen();}catch{/* Installed iOS web apps already open without browser chrome. */}
}
function playSound(kind){
  if(!soundOn)return;
  const tones={move:[280,.045],jump:[460,.11],coin:[760,.07],star:[920,.15],hit:[130,.2],start:[560,.12]};
  try{audioContext ||= new(window.AudioContext||window.webkitAudioContext)();const[f,d]=tones[kind]||tones.move;const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(.045,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+d);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+d);}catch{/* Browser sound can be unavailable. */}
}
function frame(time){const delta=Math.min(.05,Math.max(0,(time-lastTime)/1000||0));lastTime=time;update(delta);drawWorld();requestAnimationFrame(frame);}

canvas.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;swipeStart={x:event.clientX,y:event.clientY,time:performance.now()};});
canvas.addEventListener('pointerup',event=>{if(!swipeStart)return;const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;swipeStart=null;onSwipe(dx,dy);});
canvas.addEventListener('pointercancel',()=>swipeStart=null);
$('start-button').addEventListener('click',startRun);$('restart-button').addEventListener('click',startRun);$('pause-restart').addEventListener('click',startRun);
$('pause-button').addEventListener('click',pauseRun);$('resume-button').addEventListener('click',resumeRun);
$('sound-button').addEventListener('click',()=>{soundOn=!soundOn;$('sound-button').textContent=soundOn?'◖))':'◖';$('sound-button').setAttribute('aria-label',soundOn?'Sound on':'Sound off');if(soundOn)playSound('coin');});
window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='running')pauseRun();});
resize();updateHud();requestAnimationFrame(frame);
if('serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
