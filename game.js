(function () {
  'use strict';

  const F = globalThis.PocketFarm;
  const SAVE_KEY = 'pocket-farm-save-v1';
  const TILE = 48;
  const FIELD_X = 96;
  const FIELD_Y = 96;
  const canvas = document.getElementById('farm');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(768 * dpr);
  canvas.height = Math.round(576 * dpr);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  const palette = {
    '春': { grass: '#8eb76b', grassDark: '#75a05d', light: '#b9ce80', sky: '#d7e4b2' },
    '夏': { grass: '#74ad63', grassDark: '#5d9857', light: '#a8c66a', sky: '#c5dfad' },
    '秋': { grass: '#b2aa67', grassDark: '#969658', light: '#d1bf77', sky: '#e7d4aa' },
    '冬': { grass: '#aac1b8', grassDark: '#8aada8', light: '#d8dfd0', sky: '#dfe9e1' }
  };
  const cropColors = { carrot: '#ef9252', potato: '#d5b481', pumpkin: '#e5a44b', strawberry: '#df514f', corn: '#f4c851' };
  const icons = { hoe: '⚒', seed: '✿', water: '◆', scythe: '☷' };
  const keys = ['hoe', 'seed', 'water', 'scythe'];
  let state = load() || F.createGame();
  let journal = ['欢迎来到口袋田园！先开垦一块地吧。'];
  let particles = [];
  let lastFrame = 0;
  let walkingUntil = 0;
  let swingUntil = 0;
  let sleepStart = 0;
  let sleepPending = false;
  let rainUntil = 0;
  let goldUntil = 0;
  let lastSmoke = 0;
  let lastRain = 0;
  let audio = null;
  let muted = false;
  let shake = null;
  let route = [];
  let routeNext = 0;
  const input = { direction: null, source: null, next: 0, turned: false, use: false, useNext: 0 };
  try { muted = localStorage.getItem('pocket-farm-muted') === 'true'; } catch (_) { /* 存储不可用 */ }

  function load() {
    try {
      const saved = F.migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY)));
      if (saved) return saved;
    } catch (_) { /* 无法读取时重新开始 */ }
    return null;
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (_) { /* 浏览器禁用存储时仍可玩当前游戏 */ }
  }

  function handle(outcome, changed) {
    document.getElementById('hint').textContent = outcome.message;
    document.getElementById('hint').classList.toggle('error', !outcome.ok);
    if (outcome.ok && changed) {
      for (const item of outcome.events.slice().reverse()) journal.unshift(item);
      journal = journal.slice(0, 8);
      save();
    }
    render();
  }

  function initAudio() {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audio = new AudioContext();
    }
    if (audio?.state === 'suspended') audio.resume();
  }

  function tone(frequency, duration, type, delay, endFrequency) {
    if (muted || !audio) return;
    const start = audio.currentTime + (delay || 0);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function sound(kind) {
    if (kind === 'hoe') tone(160, 0.13, 'triangle', 0, 70);
    if (kind === 'seed') tone(560, 0.08, 'sine');
    if (kind === 'water') tone(700, 0.23, 'triangle', 0, 260);
    if (kind === 'scythe') { tone(440, 0.09, 'sine'); tone(660, 0.13, 'sine', 0.09); }
    if (kind === 'sell') { tone(740, 0.12, 'sine'); tone(1100, 0.2, 'sine', 0.11); }
    if (kind === 'error') tone(150, 0.19, 'sawtooth', 0, 110);
    if (kind === 'rain') tone(600, 0.18, 'triangle', 0, 340);
  }

  function addParticle(x, y, vx, vy, life, color, kind) {
    particles.push({ x, y, vx, vy, life, age: 0, color, kind });
  }

  function action() {
    initAudio();
    const target = F.frontCell(state);
    const tool = state.tool;
    const harvested = state.plots[target.y]?.[target.x]?.crop?.type;
    const outcome = F.act(state, true);
    if (!outcome.ok && outcome.message.includes('体力不足')) input.use = false;
    sound(outcome.ok ? outcome.tool : 'error');
    if (!outcome.ok && target.x >= 0 && target.x < F.WIDTH && target.y >= 0 && target.y < F.HEIGHT) shake = { x: target.x, y: target.y, until: performance.now() + 150 };
    if (outcome.ok) {
      swingUntil = performance.now() + 150;
      const x = FIELD_X + target.x * TILE + 24;
      const y = FIELD_Y + target.y * TILE + 20;
      if (outcome.tool === 'water') for (let i = 0; i < 5; i++) addParticle(x + (i - 2) * 5, y, (i - 2) * 0.055, -0.15 - i * 0.018, 300, '#75d8ed', 'drop');
      if (outcome.tool === 'scythe') {
        addParticle(x, y, 0, -0.055, 600, '#fff5c2', 'text');
        for (let i = 0; i < 4; i++) addParticle(x, y, (680 - x) / 540 + (i - 2) * 0.03, (24 - y) / 540, 540, cropColors[harvested] || '#e8c373', 'spark');
      }
    }
    handle(outcome, true);
  }

  function move(direction) {
    initAudio();
    const outcome = F.move(state, direction);
    if (outcome.ok) walkingUntil = performance.now() + 190;
    handle(outcome, true);
  }

  function pressDirection(direction, source) {
    if (input.direction && input.source !== source) return;
    if (input.direction === direction) return;
    route = [];
    input.direction = direction;
    input.source = source;
    const now = performance.now();
    input.turned = state.farmer.facing !== direction;
    if (input.turned) {
      state.farmer.facing = direction;
      handle({ ok: true, message: '转向', events: [] }, true);
      input.next = now + 120;
    } else {
      move(direction);
      input.next = now + 140;
    }
  }

  function releaseDirection(source) {
    if (input.source === source) { input.direction = null; input.source = null; }
  }

  function pressUse() {
    if (input.use) return;
    route = [];
    input.use = true;
    action();
    input.useNext = performance.now() + 180;
  }

  function tickInput(now) {
    if (input.direction && now >= input.next) {
      move(input.direction);
      input.next = now + 140;
    }
    if (input.use && now >= input.useNext) {
      if (state.energy <= 0) {
        input.use = false;
        handle({ ok: false, message: '体力耗尽，回家睡一觉吧', events: [] }, false);
      } else action();
      input.useNext = now + 180;
    }
  }

  function hash(x, y, n) {
    let value = Math.sin(x * 127.1 + y * 311.7 + n * 73.9) * 43758.5453;
    return value - Math.floor(value);
  }

  function box(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function label(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px monospace`;
    ctx.fillText(text, Math.round(x), Math.round(y));
  }

  function shadow(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#293c3655';
    ctx.fill();
  }

  function drawBackground() {
    const p = palette[F.season(state)];
    box(0, 0, 768, 576, p.grass);
    box(0, 0, 768, 67, p.sky);
    box(0, 67, 768, 9, p.light);
    box(0, 76, 768, 5, p.grassDark);
    label(`POCKET FARM  /  ${F.season(state)}之田`, 27, 38, '#53754f', 18);
    label(`DAY ${String(state.day).padStart(2, '0')}`, 654, 38, '#53754f', 16);
    for (let y = 82; y < 575; y += 12) {
      for (let x = 0; x < 768; x += 12) {
        const h = hash(x, y, 1);
        if (h > 0.78) box(x + 3, y + 4, 3, 2, p.light);
        if (h < 0.065) {
          box(x + 5, y + 2, 2, 5, p.grassDark);
          box(x + 3, y + 2, 2, 2, p.grassDark);
          box(x + 7, y + 1, 2, 2, p.grassDark);
        }
      }
    }
    // 田地外框与小径
    box(87, 87, 594, 450, '#547b4f');
    box(92, 92, 584, 440, '#c4ad78');
    box(96, 96, 576, 432, p.grass);
    for (let y = 0; y < F.HEIGHT; y++) {
      for (let x = 0; x < F.WIDTH; x++) {
        const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
        if (hash(x, y, 2) > 0.58) box(px + 9, py + 34, 5, 2, p.light);
        if (hash(x, y, 3) > 0.7) box(px + 33, py + 12, 3, 3, p.grassDark);
        box(px, py, TILE, 1, '#ffffff0a');
        box(px, py, 1, TILE, '#ffffff0a');
      }
    }
    // 固定坐标的花丛和从家门到田边的石板路。
    for (let x = 75; x < 105; x += 15) for (let y = 223; y < 270; y += 17) box(x, y, 11, 7, '#d5c5a1');
    for (let i = 0; i < 18; i++) {
      const x = 8 + Math.floor(hash(i, 31, 8) * 750), y = 91 + Math.floor(hash(i, 19, 9) * 470);
      if (x > 95 && x < 673 && y > 95 && y < 528) continue;
      box(x, y, 3, 3, i % 2 ? '#f7d7a2' : '#f5a6ad');
      box(x + 2, y + 3, 2, 3, '#50824f');
    }
  }

  function drawTree(x, y) {
    const season = F.season(state);
    box(x + 15, y + 20, 9, 38, '#795d45');
    box(x + 8, y + 26, 24, 4, '#795d45');
    if (season === '冬') {
      box(x + 3, y + 24, 15, 3, '#eef5ec');
      box(x + 23, y + 20, 15, 3, '#eef5ec');
    } else {
      const color = { '春': '#e7a5b1', '夏': '#5e9d58', '秋': '#dfbd62' }[season];
      box(x + 4, y + 8, 32, 28, color);
      box(x + 11, y, 19, 40, color);
    }
  }

  function drawPond(now) {
    box(12, 464, 73, 76, '#73997c');
    box(18, 469, 62, 65, '#73b3bd');
    box(24, 475, 50, 53, '#85c5c7');
    const offset = Math.floor(now / 500) % 2 ? 4 : 0;
    box(27 + offset, 488, 19, 2, '#d0e9d9');
    box(48 - offset, 511, 17, 2, '#d0e9d9');
  }

  function drawHouse() {
    // 左侧小屋、窗与烟囱均用矩形绘制。
    box(9, 154, 74, 75, '#735849');
    box(14, 162, 65, 62, '#e5c78a');
    for (let i = 0; i < 9; i++) box(5 + i * 9, 150 - Math.min(i, 8 - i) * 7, 12, 7, '#895c48');
    box(14, 119, 15, 24, '#b17e5b');
    box(29, 180, 18, 18, '#6e9baa');
    box(37, 180, 2, 18, '#f9e0a1');
    box(29, 188, 18, 2, '#f9e0a1');
    box(55, 189, 17, 35, '#856348');
    box(66, 205, 3, 3, '#eecb72');
    box(14, 227, 64, 5, '#c1a36d');
    label('HOME', 21, 252, '#eff1cd', 13);

    box(689, 284, 64, 51, '#856747');
    box(685, 277, 72, 12, '#aa8556');
    box(694, 295, 54, 5, '#bc9a6a');
    box(694, 308, 54, 4, '#bc9a6a');
    box(712, 286, 20, 15, '#443d32');
    label('SHIP', 699, 357, '#f2eecf', 13);
    box(15, 379, 11, 42, '#715e47');
    box(8, 363, 28, 25, '#537f4e');
    box(15, 353, 22, 25, '#679658');
    box(1, 384, 28, 16, '#5a8a50');
    box(719, 455, 10, 35, '#705e46');
    box(701, 435, 45, 32, '#5d8a51');
    box(710, 422, 29, 31, '#70a15a');
    for (let x = 85; x < 680; x += 48) {
      box(x, 73, 5, 16, '#806c4a');
      box(x, 536, 5, 16, '#806c4a');
      if (x < 660) { box(x, 78, 45, 3, '#b89765'); box(x, 542, 45, 3, '#b89765'); }
    }
    for (let y = 91; y < 535; y += 48) {
      box(87, y, 5, 16, '#806c4a');
      box(677, y, 5, 16, '#806c4a');
      box(89, y + 5, 3, 43, '#b89765');
      box(678, y + 5, 3, 43, '#b89765');
    }
  }

  function drawPlot(plot, x, y) {
    if (!plot.tilled) return;
    const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
    box(px + 2, py + 4, 44, 41, plot.watered ? '#604a40' : '#8a6249');
    box(px + 4, py + 5, 39, 3, plot.watered ? '#755849' : '#a17855');
    box(px + 7, py + 14, 34, 2, plot.watered ? '#4e3e38' : '#76533f');
    box(px + 5, py + 29, 36, 2, plot.watered ? '#4e3e38' : '#76533f');
    if (plot.watered) {
      box(px + 34, py + 20, 5, 3, '#789da1');
      box(px + 10, py + 37, 4, 2, '#789da1');
    } else {
      box(px + 11, py + 23, 3, 2, '#b78b64');
      box(px + 35, py + 35, 4, 2, '#b78b64');
    }
    if (F.season(state) === '冬') {
      box(px + 2, py + 3, 43, 2, '#f3f5e9');
      box(px + 2, py + 3, 2, 41, '#e8f0e9');
    }
    if (plot.crop) {
      shadow(px + 24, py + 38, 13, 4);
      drawCrop(ctx, plot.crop, px, py, performance.now());
    }
  }

  function drawCrop(target, crop, px, py, now) {
    const progress = crop.progress;
    const mature = progress >= F.CROPS[crop.type].days;
    const offset = mature && Math.floor(now / 800) % 2 ? -1 : 0;
    py += offset;
    const center = px + 24;
    const paint = (x, y, w, h, color) => { target.fillStyle = color; target.fillRect(Math.round(x), Math.round(y), w, h); };
    if (progress === 0) {
      paint(center - 6, py + 27, 12, 6, '#a77b53');
      if (crop.type === 'carrot') paint(center - 2, py + 24, 4, 5, '#e7bd7b');
      if (crop.type === 'potato') paint(center - 4, py + 23, 8, 6, '#c8aa7c');
      if (crop.type === 'pumpkin') { paint(center - 3, py + 24, 6, 4, '#e0c184'); paint(center - 1, py + 21, 2, 4, '#74a153'); }
      if (crop.type === 'strawberry') { paint(center - 2, py + 24, 4, 4, '#ae6156'); paint(center + 2, py + 25, 2, 3, '#ebd7a0'); }
      if (crop.type === 'corn') { paint(center - 4, py + 24, 4, 6, '#f6d46b'); paint(center + 2, py + 26, 3, 4, '#f6d46b'); }
      return;
    }
    if (progress === 1) {
      paint(center - 2, py + 23, 4, 15, '#5b914c');
      if (crop.type === 'carrot') { paint(center - 8, py + 19, 7, 5, '#77b758'); paint(center + 2, py + 17, 7, 5, '#69a753'); }
      if (crop.type === 'potato') { paint(center - 12, py + 23, 11, 7, '#77b758'); paint(center + 2, py + 21, 11, 7, '#69a753'); }
      if (crop.type === 'pumpkin') { paint(center - 11, py + 25, 10, 5, '#77b758'); paint(center + 2, py + 25, 10, 5, '#69a753'); paint(center - 1, py + 19, 3, 6, '#8eb75c'); }
      if (crop.type === 'strawberry') { paint(center - 11, py + 24, 10, 5, '#77b758'); paint(center + 2, py + 22, 10, 5, '#69a753'); }
      if (crop.type === 'corn') { paint(center - 8, py + 20, 7, 4, '#77b758'); paint(center + 2, py + 17, 7, 4, '#69a753'); }
      return;
    }
    if (crop.type === 'carrot') {
      paint(center - 2, py + 13, 4, 25, '#4c853e');
      paint(center - 12, py + 17, 11, 6, '#66a94c');
      paint(center + 1, py + 14, 12, 7, '#80b951');
      paint(center - 8, py + 9, 6, 11, '#78b353');
      if (mature) {
        paint(center - 9, py + 26, 18, 10, '#dc6b3d');
        paint(center - 7, py + 36, 14, 5, '#ef8b47');
        paint(center - 4, py + 41, 8, 3, '#edb361');
      }
    } else if (crop.type === 'potato') {
      paint(center - 15, py + 24, 30, 12, '#4d8b47');
      paint(center - 11, py + 17, 13, 12, '#6fab55');
      paint(center + 1, py + 14, 14, 15, '#79b45f');
      paint(center - 4, py + 10, 8, 9, '#5c9d4c');
      if (mature) {
        paint(center - 16, py + 32, 13, 9, '#c9a376');
        paint(center + 3, py + 31, 14, 10, '#d8b684');
        paint(center - 11, py + 35, 2, 2, '#9a7758');
        paint(center + 9, py + 34, 2, 2, '#9a7758');
      }
    } else if (crop.type === 'pumpkin') {
      paint(center - 18, py + 30, 36, 5, '#4f8541');
      paint(center - 17, py + 23, 12, 11, '#6da449');
      paint(center + 6, py + 20, 12, 12, '#76ad4d');
      paint(center - 2, py + 15, 4, 17, '#5c8739');
      if (mature) {
        paint(center - 17, py + 23, 34, 18, '#cd7034');
        paint(center - 12, py + 19, 24, 23, '#e6973d');
        paint(center - 4, py + 21, 8, 20, '#f3ad4d');
        paint(center - 3, py + 16, 6, 6, '#598141');
      }
    } else if (crop.type === 'strawberry') {
      paint(center - 2, py + 18, 4, 20, '#568a45');
      paint(center - 16, py + 22, 14, 9, '#6aa852');
      paint(center + 2, py + 20, 15, 10, '#78b65a');
      paint(center - 10, py + 13, 9, 8, '#5e9c4b');
      if (mature) {
        for (const [dx, dy] of [[-11, 28], [4, 26], [-2, 33]]) {
          paint(center + dx, py + dy, 9, 8, '#d94848');
          paint(center + dx + 2, py + dy + 7, 5, 3, '#ee6561');
          paint(center + dx + 3, py + dy + 2, 2, 2, '#ffe6a2');
        }
      }
    } else if (crop.type === 'corn') {
      paint(center - 3, py + 9, 6, 30, '#5c9149');
      paint(center - 14, py + 19, 12, 5, '#78ae55');
      paint(center + 3, py + 23, 13, 5, '#72a74d');
      paint(center - 7, py + 7, 5, 10, '#8bb65b');
      if (mature) {
        paint(center + 4, py + 17, 10, 19, '#e9b942');
        paint(center + 6, py + 19, 6, 15, '#f8db65');
        paint(center + 3, py + 27, 3, 12, '#70a750');
      }
    }
    if (mature) paint(px + 38, py + 7, 4, 4, '#ffe7a0');
  }

  function drawFarmer(now) {
    const x = FIELD_X + state.farmer.x * TILE + 9;
    const walking = now < walkingUntil;
    const step = walking ? Math.floor(now / 95) % 2 : 0;
    const y = FIELD_Y + state.farmer.y * TILE + 5 + (walking ? -step * 2 : Math.floor(now / 900) % 2);
    shadow(x + 21, y + 39, 16, 5);
    box(x + 9, y + 31 + step, 8, 7, '#524c57');
    box(x + 24, y + 31 - step, 8, 7, '#524c57');
    box(x + 8, y + 20, 25, 13, '#557d8b');
    box(x + 5, y + 22, 5, 10, '#edb881');
    box(x + 32, y + 22, 5, 10, '#edb881');
    box(x + 12, y + 9, 18, 14, '#e8ae7a');
    box(x + 10, y + 7, 22, 6, '#704f42');
    box(x + (state.farmer.facing === 'left' ? 3 : state.farmer.facing === 'right' ? 9 : 6), y + 4, 30, 6, '#b48b56');
    box(x + 12, y, 18, 7, '#ccaa68');
    if (state.farmer.facing === 'up') box(x + 13, y + 13, 16, 9, '#9c6849');
    if (state.farmer.facing === 'left') box(x + 29, y + 21, 4, 10, '#315e6d');
    if (state.farmer.facing === 'right') box(x + 8, y + 21, 4, 10, '#315e6d');
    if (state.farmer.facing !== 'up') {
      if (state.farmer.facing === 'left') box(x + 13, y + 16, 3, 3, '#3c4540');
      else if (state.farmer.facing === 'right') box(x + 27, y + 16, 3, 3, '#3c4540');
      else {
        box(x + 16, y + 15, 3, 3, '#3c4540');
        box(x + 25, y + 15, 3, 3, '#3c4540');
      }
    }
    if (now < swingUntil) {
      const raised = now < swingUntil - 75;
      const facing = state.farmer.facing;
      const tx = facing === 'left' ? x - 8 : facing === 'right' ? x + 35 : x + 20;
      const ty = facing === 'up' ? y - (raised ? 17 : 6) : facing === 'down' ? y + (raised ? 22 : 31) : y + (raised ? 5 : 20);
      box(tx, ty, 3, 18, '#825e3d');
      box(tx - 5, ty - 2, 13, 4, '#b7bbb4');
    }
  }

  function drawScene(now) {
    drawBackground();
    drawHouse();
    drawPond(now);
    drawTree(37, 274);
    drawTree(685, 111);
    drawTree(694, 380);
    for (let y = 0; y < F.HEIGHT; y++) {
      for (let x = 0; x < F.WIDTH; x++) drawPlot(state.plots[y][x], x, y);
    }
    const front = F.frontCell(state);
    if (front.x >= 0 && front.y >= 0 && front.x < F.WIDTH && front.y < F.HEIGHT) {
      const px = FIELD_X + front.x * TILE, py = FIELD_Y + front.y * TILE;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 350);
      box(px + 3, py + 2, 42, 3, '#fff0aa');
      box(px + 3, py + 43, 42, 3, '#fff0aa');
      box(px + 2, py + 3, 3, 40, '#fff0aa');
      box(px + 43, py + 3, 3, 40, '#fff0aa');
      ctx.globalAlpha = 1;
    }
    if (shake && now < shake.until) {
      const px = FIELD_X + shake.x * TILE, py = FIELD_Y + shake.y * TILE;
      ctx.strokeStyle = '#d06b50';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + (Math.floor(now / 25) % 2 ? 2 : -2) + 3, py + 3, 42, 42);
    }
    drawFarmer(now);
    for (const particle of particles) {
      if (particle.kind === 'text') label('+1', particle.x - 9, particle.y, particle.color, 15);
      else box(particle.x, particle.y, particle.kind === 'rain' ? 2 : particle.kind === 'smoke' ? 8 : particle.kind === 'drop' ? 3 : 4, particle.kind === 'rain' ? 10 : particle.kind === 'smoke' ? 6 : particle.kind === 'drop' ? 5 : 4, particle.color);
    }
    if (sleepStart) {
      const elapsed = now - sleepStart;
      const alpha = elapsed < 500 ? elapsed / 500 : 1 - (elapsed - 500) / 500;
      ctx.fillStyle = `rgba(17, 30, 68, ${Math.max(0, Math.min(0.72, alpha * 0.72))})`;
      ctx.fillRect(0, 0, 768, 576);
    }
  }

  function render() {
    document.getElementById('date').textContent = `${F.season(state)} · 第 ${F.seasonDay(state)} 天`;
    document.getElementById('weather').textContent = state.weather === 'rain' ? '☂ 雨天' : '☀ 晴天';
    document.getElementById('tomorrow').textContent = `明日：${state.tomorrow === 'rain' ? '雨' : '晴'}`;
    document.getElementById('gold').textContent = `${state.gold} G`;
    document.getElementById('energy-text').textContent = `${state.energy} / ${F.ENERGY_MAX}`;
    document.getElementById('energy-fill').style.width = `${state.energy / F.ENERGY_MAX * 100}%`;
    document.getElementById('tools').innerHTML = keys.map((key, i) =>
      `<button type="button" class="tool ${state.tool === key ? 'active' : ''}" data-tool="${key}" aria-pressed="${state.tool === key}"><span class="tool-icon">${icons[key]}${state.upgrades[key] ? '✦' : ''}</span><span>${state.upgrades[key] ? (key === 'hoe' ? '精钢锄' : '铁水壶') : F.TOOLS[key].name}</span><small>${i + 1}</small></button>`
    ).join('');
    document.getElementById('crop-options').innerHTML = '<span>播种：</span>' + Object.entries(F.CROPS).map(([key, crop]) =>
      `<button type="button" class="crop-choice ${state.selectedCrop === key ? 'active' : ''}" data-crop="${key}" aria-pressed="${state.selectedCrop === key}">${crop.name} × ${state.seeds[key]}</button>`
    ).join('');
    document.getElementById('bag').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="bag-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}</span><strong>× ${state.bag[key]}</strong></div>`
    ).join('') + `<div class="bag-row"><span>饭团</span><button type="button" data-eat="snack">吃掉 × ${state.snacks}</button></div>`;
    document.getElementById('shop').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="shop-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}<small>${crop.days} 天 · 售 ${crop.sellPrice} G</small></span><button type="button" data-buy="${key}">买种子 ${crop.seedPrice} G</button></div>`
    ).join('') + `<div class="shop-row"><span>精钢锄<small>锄地体力减半</small></span><button type="button" data-upgrade="hoe" ${state.upgrades.hoe ? 'disabled' : ''}>${state.upgrades.hoe ? '已购买' : '400 G'}</button></div><div class="shop-row"><span>铁水壶<small>面前三格浇水</small></span><button type="button" data-upgrade="water" ${state.upgrades.water ? 'disabled' : ''}>${state.upgrades.water ? '已购买' : '600 G'}</button></div><div class="shop-row"><span>饭团<small>恢复 15 体力</small></span><button type="button" data-snack="buy">20 G</button></div>`;
    document.getElementById('log').innerHTML = journal.map(item => `<li>${item}</li>`).join('');
    document.getElementById('orders-list').innerHTML = state.orders.length ? state.orders.map(order => `<div class="order-row"><span>${F.CROPS[order.crop].name} × ${order.amount} · 第 ${order.deadline} 天前<br>奖励 ${order.reward} G · 背包 ${state.bag[order.crop]}</span><button type="button" data-deliver="${order.id}">交付</button></div>`).join('') : '<p>今日没有订单，睡觉后刷新。</p>';
    document.getElementById('stats-list').innerHTML = `<p>累计收入：${state.stats.income} G</p><p>累计收获：${state.stats.harvested}</p><p>完成订单：${state.stats.orders}</p><p>已玩天数：${state.stats.days}</p>`;
    drawScene(performance.now());
  }

  function frame(now) {
    const dt = Math.min(50, now - (lastFrame || now));
    lastFrame = now;
    tickInput(now);
    if (route.length && !input.direction && now >= routeNext) {
      move(route.shift());
      routeNext = now + 140;
      if (!route.length) handle({ ok: true, message: '已走到目标地块旁', events: [] }, false);
    }
    for (const particle of particles) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.kind === 'drop') particle.vy += 0.0018 * dt;
    }
    particles = particles.filter(particle => particle.age < particle.life);
    if (now - lastSmoke > 350) {
      addParticle(19, 117, 0.025, -0.06, 850, '#f7f4e590', 'smoke');
      lastSmoke = now;
    }
    if (now < rainUntil && now - lastRain > 35) {
      for (let i = 0; i < 3; i++) addParticle((now * 3 + i * 251) % 768, (now * 7 + i * 113) % 300, -0.05, 0.8, 350, '#b7e5e8a0', 'rain');
      lastRain = now;
    }
    if (sleepPending && now - sleepStart >= 500) {
      sleepPending = false;
      const outcome = F.sleep(state);
      if (state.weather === 'rain') { rainUntil = now + 1000; sound('rain'); }
      handle(outcome, true);
    }
    if (sleepStart && now - sleepStart >= 1000) sleepStart = 0;
    const gold = document.getElementById('gold');
    gold.style.transform = now < goldUntil ? `scale(${1 + 0.25 * Math.sin((goldUntil - now) / 500 * Math.PI)})` : '';
    drawScene(now);
    requestAnimationFrame(frame);
  }

  function openCodex() {
    const list = document.getElementById('codex-list');
    const sorted = Object.entries(F.CROPS).sort((a, b) => b[1].sellPrice / b[1].seedPrice - a[1].sellPrice / a[1].seedPrice);
    list.innerHTML = sorted.map(([key, crop]) => `<div class="codex-row"><canvas width="48" height="48" data-preview="${key}"></canvas><div><strong>${crop.name}</strong>${crop.days} 天 · 种子 ${crop.seedPrice} G · 售价 ${crop.sellPrice} G · 每 G 投入回收 ${(crop.sellPrice / crop.seedPrice).toFixed(2)} G</div></div>`).join('');
    for (const preview of list.querySelectorAll('canvas')) {
      const context = preview.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#8a6249';
      context.fillRect(0, 0, 48, 48);
      drawCrop(context, { type: preview.dataset.preview, progress: F.CROPS[preview.dataset.preview].days }, 0, 0, 0);
    }
    document.getElementById('codex-panel').hidden = false;
    document.getElementById('orders-panel').hidden = true;
    document.body.classList.add('modal-open');
  }

  function closePanels() {
    document.getElementById('codex-panel').hidden = true;
    document.getElementById('orders-panel').hidden = true;
    document.body.classList.remove('modal-open');
  }

  const directionKeys = { w: 'up', ArrowUp: 'up', s: 'down', ArrowDown: 'down', a: 'left', ArrowLeft: 'left', d: 'right', ArrowRight: 'right' };
  document.addEventListener('keydown', event => {
    if (!document.getElementById('codex-panel').hidden || !document.getElementById('orders-panel').hidden) {
      if (event.key === 'Escape') closePanels();
      return;
    }
    const direction = directionKeys[event.key];
    if (direction) { event.preventDefault(); pressDirection(direction, `key:${event.key}`); return; }
    if (event.key >= '1' && event.key <= '4') { initAudio(); handle(F.selectTool(state, keys[Number(event.key) - 1]), true); return; }
    if (event.key === ' ' || event.key === 'Enter') {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      pressUse();
    }
  });
  document.addEventListener('keyup', event => {
    if (directionKeys[event.key]) releaseDirection(`key:${event.key}`);
    if (event.key === ' ' || event.key === 'Enter') input.use = false;
  });
  window.addEventListener('blur', () => { input.direction = null; input.use = false; route = []; });
  document.getElementById('tools').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (button) { initAudio(); handle(F.selectTool(state, button.dataset.tool), true); }
  });
  document.getElementById('crop-options').addEventListener('click', event => {
    const button = event.target.closest('[data-crop]');
    if (button) { initAudio(); handle(F.selectCrop(state, button.dataset.crop), true); }
  });
  document.getElementById('shop').addEventListener('click', event => {
    const button = event.target.closest('[data-buy]');
    if (button) { initAudio(); const outcome = F.buySeed(state, button.dataset.buy, 1); if (!outcome.ok) sound('error'); handle(outcome, true); }
    const upgrade = event.target.closest('[data-upgrade]');
    if (upgrade) { const outcome = F.buyUpgrade(state, upgrade.dataset.upgrade); if (!outcome.ok) sound('error'); handle(outcome, true); }
    if (event.target.closest('[data-snack]')) { const outcome = F.buySnack(state); if (!outcome.ok) sound('error'); handle(outcome, true); }
  });
  document.getElementById('bag').addEventListener('click', event => {
    if (event.target.closest('[data-eat]')) { const outcome = F.eatSnack(state); if (!outcome.ok) sound('error'); handle(outcome, true); }
  });
  document.getElementById('sell-all').addEventListener('click', () => {
    initAudio();
    const outcome = F.sellAll(state);
    if (outcome.ok) { goldUntil = performance.now() + 500; sound('sell'); }
    else sound('error');
    handle(outcome, true);
  });
  document.getElementById('sleep').addEventListener('click', () => {
    initAudio();
    if (!sleepStart) { sleepStart = performance.now(); sleepPending = true; }
  });
  document.querySelector('.dpad').addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-direction]');
    if (button) { event.preventDefault(); button.setPointerCapture?.(event.pointerId); pressDirection(button.dataset.direction, `pointer:${event.pointerId}`); }
  });
  document.querySelector('.dpad').addEventListener('pointerup', event => releaseDirection(`pointer:${event.pointerId}`));
  document.querySelector('.dpad').addEventListener('pointercancel', event => releaseDirection(`pointer:${event.pointerId}`));
  document.getElementById('touch-use').addEventListener('pointerdown', event => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); pressUse(); });
  document.getElementById('touch-use').addEventListener('pointerup', () => { input.use = false; });
  document.getElementById('touch-use').addEventListener('pointercancel', () => { input.use = false; });
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width * 768 - FIELD_X) / TILE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height * 576 - FIELD_Y) / TILE);
    if (x < 0 || x >= F.WIDTH || y < 0 || y >= F.HEIGHT) return;
    input.direction = null;
    route = [];
    const distance = Math.abs(x - state.farmer.x) + Math.abs(y - state.farmer.y);
    if (distance === 1) {
      state.farmer.facing = Object.entries(F.DIRECTIONS).find(([, [dx, dy]]) => state.farmer.x + dx === x && state.farmer.y + dy === y)[0];
      action();
      return;
    }
    if (distance === 0) return;
    const path = F.findPath(state, x, y);
    if (!path) { sound('error'); handle({ ok: false, message: '没有通往目标地块旁的路', events: [] }, false); return; }
    route = path;
    routeNext = performance.now();
  });
  document.getElementById('farm').addEventListener('touchmove', event => event.preventDefault(), { passive: false });
  document.getElementById('mute').addEventListener('click', () => {
    initAudio();
    muted = !muted;
    try { localStorage.setItem('pocket-farm-muted', String(muted)); } catch (_) { /* 存储不可用 */ }
    updateMute();
  });
  function updateMute() {
    const button = document.getElementById('mute');
    button.textContent = muted ? '🔇 静音' : '🔊 音效';
    button.setAttribute('aria-pressed', String(muted));
  }
  document.getElementById('codex').addEventListener('click', () => { initAudio(); openCodex(); });
  document.getElementById('orders-button').addEventListener('click', () => { initAudio(); document.getElementById('orders-panel').hidden = false; document.getElementById('codex-panel').hidden = true; document.body.classList.add('modal-open'); });
  document.getElementById('orders-list').addEventListener('click', event => {
    const button = event.target.closest('[data-deliver]');
    if (button) { const outcome = F.deliverOrder(state, Number(button.dataset.deliver)); if (!outcome.ok) sound('error'); else sound('sell'); handle(outcome, true); }
  });
  document.getElementById('close-codex').addEventListener('click', closePanels);
  document.getElementById('close-orders').addEventListener('click', closePanels);
  document.getElementById('crop-tab').addEventListener('click', () => { document.getElementById('codex-list').hidden = false; document.getElementById('stats-list').hidden = true; });
  document.getElementById('stats-tab').addEventListener('click', () => { document.getElementById('codex-list').hidden = true; document.getElementById('stats-list').hidden = false; });
  document.getElementById('codex-panel').addEventListener('click', event => {
    if (event.target.id === 'codex-panel') closePanels();
  });
  document.getElementById('orders-panel').addEventListener('click', event => { if (event.target.id === 'orders-panel') closePanels(); });
  document.getElementById('new-game').addEventListener('click', () => {
    if (!confirm('开始新游戏？当前农场进度会被覆盖。')) return;
    sleepStart = 0;
    sleepPending = false;
    particles = [];
    route = [];
    input.direction = null;
    input.use = false;
    state = F.createGame();
    journal = ['新的农场生活开始了！'];
    handle({ ok: true, message: '新游戏已开始', events: [] }, true);
  });
  document.getElementById('hint').textContent = '用 WASD 或方向键移动；面向地块，按空格或回车使用当前工具。';
  updateMute();
  render();
  requestAnimationFrame(frame);
})();
