(function () {
  'use strict';

  const F = globalThis.PocketFarm;
  const SAVE_KEY = 'pocket-farm-save-v1';
  const BEST_KEY = 'pocket-farm-best-days';
  const TILE = 48;
  const RENDER_SCALE = 2;
  const STATIC_SCALE = 1.5;
  const SCENE_WIDTH = 768;
  const SCENE_HEIGHT = 576;
  const FIELD_X = 0;
  const FIELD_Y = 0;
  const WORLD_WIDTH = F.WIDTH * TILE;
  const WORLD_HEIGHT = F.HEIGHT * TILE;
  const canvas = document.getElementById('farm');
  let ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sceneContext = ctx;
  const staticCanvas = document.createElement('canvas');
  const staticContext = staticCanvas.getContext('2d');
  let staticKey = '';

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.round((bounds.width || SCENE_WIDTH) * dpr * RENDER_SCALE);
    const height = Math.round((bounds.height || SCENE_HEIGHT) * dpr * RENDER_SCALE);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    sceneContext.scale(width / SCENE_WIDTH, height / SCENE_HEIGHT);
    sceneContext.imageSmoothingEnabled = true;
    staticContext.imageSmoothingEnabled = true;
    staticKey = '';
  }
  resizeCanvas();
  staticCanvas.width = Math.round(WORLD_WIDTH * STATIC_SCALE);
  staticCanvas.height = Math.round(WORLD_HEIGHT * STATIC_SCALE);
  staticContext.scale(STATIC_SCALE, STATIC_SCALE);
  window.addEventListener('resize', resizeCanvas);

  const palette = {
    '春': { grass: '#8eb76b', grassDark: '#75a05d', light: '#b9ce80', sky: '#d7e4b2' },
    '夏': { grass: '#74ad63', grassDark: '#5d9857', light: '#a8c66a', sky: '#c5dfad' },
    '秋': { grass: '#b2aa67', grassDark: '#969658', light: '#d1bf77', sky: '#e7d4aa' },
    '冬': { grass: '#aac1b8', grassDark: '#8aada8', light: '#d8dfd0', sky: '#dfe9e1' }
  };
  const cropColors = { carrot: '#ef9252', potato: '#d5b481', pumpkin: '#e5a44b', strawberry: '#df514f', corn: '#f4c851' };
  const icons = { hoe: '⚒', seed: '✿', scythe: '☷', gather: '🧺', rod: '🎣', build: '▥' };
  const UI_COLORS = { focus: '#a96d21', danger: '#a3372b' };
  const WORLD_COLORS = {
    water: '#6aaeb7', waterLight: '#a8d6c9', waterDeep: '#4c8fa4', waterGlint: '#d5f0df',
    sand: '#c7ad75', sandDark: '#9d8158', path: '#b9a276', pathLight: '#d3c09a', pathDark: '#8d7655', gravel: '#9e8968',
    soil: '#8a6249', soilPlanted: '#78543f', furrow: '#684733', furrowLight: '#bb8e65', soilSpeck: '#af805c',
    bark: '#795d45', barkLight: '#a47b54', barkDark: '#5c4030', rootSoil: '#816547',
    wood: '#806447', woodLight: '#d9ba7f', woodDark: '#654d39', woodGrain: '#9d754f',
    wall: '#dfbf86', wallShade: '#cba873', window: '#ffe0a1', windowGlow: '#fff0bd', door: '#785b45', metal: '#d5ddd5',
    roofHome: '#a26d4c', roofRidge: '#d18b5d', roofBlue: '#657f91', roofRed: '#a75d4f', roofMoss: '#667b50',
    plaza: '#c9af80', plazaLight: '#e9d5a9', plazaEdge: '#a98d67', shadow: '#293c3655',
    springFlower: '#f5c4cf', springFlowerLight: '#fff0e6', summerFlower: '#f0ce58', summerFlowerLight: '#fff4bd',
    autumnLeaf: '#d9783f', autumnLeafLight: '#edb34f', frost: '#edf5ed', frostShade: '#cedfd9',
    leafGreen: '#699a50', leafLight: '#a6c66d', dust: '#b58a62', star: '#ffe58a',
    hutBlue: '#708baf', hutRed: '#bc745a', hutGreen: '#617c55', whiteFlash: '#fffdf5', cloudShadow: '#3d5b5528',
    springMid: '#d391a7', summerMid: '#4b8c50', autumnMid: '#c99d50',
    springTop: '#f2bdc5', summerTop: '#78b263', autumnTop: '#edce72', capeLight: '#503344', capeDark: '#422c3d'
  };
  const keys = ['hoe', 'seed', 'scythe', 'gather', 'rod', 'build'];
  let state = load() || F.createGame();
  let camera = F.cameraTarget(state.farmer, SCENE_WIDTH, SCENE_HEIGHT, TILE);
  let cameraTime = 0;
  let journal = [...(state.migrationEvents || []), '欢迎来到口袋田园！先开垦一块地吧。'];
  const migrationMessages = state.migrationEvents || [];
  delete state.migrationEvents;
  let particles = [];
  let lastFrame = 0;
  let walkingUntil = 0;
  let swingUntil = 0;
  let sleepStart = 0;
  let sleepPending = false;
  let battle = null;
  const villagers = Object.fromEntries(Object.entries(F.VILLAGERS).map(([id, info]) => [id, { x: info.points[0][0], y: info.points[0][1], next: 0, goal: 0 }]));
  let speakingTo = null;
  const talkTurns = { mayor: 0, merchant: 0, hunter: 0 };
  let goldUntil = 0;
  let lastSmoke = 0;
  let lastRain = 0;
  let lastSpark = 0;
  let goldDisplay = state.gold;
  let goldFrom = state.gold;
  let goldStart = 0;
  let toolBounce = '';
  let bounceUntil = 0;
  let swingTool = 'hoe';
  let audio = null;
  let muted = false;
  let shake = null;
  let battleFlashUntil = 0;
  let buildChoice = null;
  let homeRoute = false;
  let orderWarningShown = false;
  const buyAmounts = Object.fromEntries(Object.keys(F.CROPS).map(key => [key, 1]));
  let route = [];
  let routeNext = 0;
  let lowHealthNotified = false;
  let bannerUntil = 0;
  let seasonAfterSleep = false;
  let tutorialDoneUntil = 0;
  let toastQueue = [];
  let visibleToasts = [];
  let toastMarkup = '';
  let panelCloseToken = 0;
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
    const previousHealth = Number(document.getElementById('health-item').dataset.health || F.HEALTH_MAX);
    if (state.gold !== goldDisplay && !goldStart) { goldFrom = goldDisplay; goldStart = performance.now(); }
    document.getElementById('hint').textContent = outcome.message;
    document.getElementById('hint').classList.toggle('error', !outcome.ok);
    if (outcome.ok && changed) {
      for (const item of outcome.events.slice().reverse()) journal.unshift(item);
      journal = journal.slice(0, 8);
      if (state.tutorial < 2 && outcome.tool === ['hoe', 'seed'][state.tutorial]) {
        state.tutorial++;
        if (state.tutorial === 2) tutorialDoneUntil = performance.now() + 1600;
      }
      save();
    }
    if (!outcome.ok && /金币|生命|种子|未解锁|锁住/.test(outcome.message)) enqueueToast(outcome.message, 'alert');
    if (outcome.ok && /购买|升级|卖出|交付/.test(outcome.message)) enqueueToast(outcome.message, 'success');
    for (const item of outcome.events || []) if (item !== outcome.message && /订单|过期/.test(item)) enqueueToast(item, 'info');
    if (state.health <= 30 && previousHealth > 30 && !lowHealthNotified) {
      enqueueToast('生命危险，吃点东西回血吧', 'alert');
      lowHealthNotified = true;
    }
    if (state.health > 30) lowHealthNotified = false;
    if (state.health <= 0) state.gameOver = true;
    render();
    if (state.gameOver) showGameOver();
  }

  function showGameOver() {
    battle = null;
    input.direction = null; input.use = false; route = [];
    document.body.classList.remove('watch-mode');
    let best = state.day - 1;
    try { best = Math.max(best, Number(localStorage.getItem(BEST_KEY)) || 0); localStorage.setItem(BEST_KEY, String(best)); } catch (_) { /* 存储不可用 */ }
    document.getElementById('game-over-stats').textContent = `存活 ${state.day - 1} 天 · 击退强盗 ${state.stats.repelled} 人 · 历史最佳 ${best} 天`;
    document.getElementById('game-over').hidden = false;
    save();
  }

  function enqueueToast(message, type = 'info') { toastQueue.push({ message, type }); updateToasts(performance.now()); }

  function updateToasts(now) {
    visibleToasts = visibleToasts.filter(item => now < item.until);
    while (visibleToasts.length < 2 && toastQueue.length) visibleToasts.push({ ...toastQueue.shift(), until: now + 2200 });
    const markup = visibleToasts.map(item =>
      `<div class="toast ${item.type} ${item.until - now < 240 ? 'leaving' : ''}"><span class="toast-icon" aria-hidden="true">${item.type === 'alert' ? '!' : item.type === 'success' ? '✓' : 'i'}</span><span>${item.message}</span></div>`
    ).join('');
    if (markup !== toastMarkup) { document.getElementById('toast-stack').innerHTML = markup; toastMarkup = markup; }
  }

  function showSeasonBanner() {
    const banner = document.getElementById('season-banner');
    banner.textContent = `${F.season(state)} · 第 1 天`;
    banner.dataset.season = F.season(state);
    banner.hidden = false;
    bannerUntil = performance.now() + 1920;
  }

  function updateOverlays(now) {
    const banner = document.getElementById('season-banner');
    if (bannerUntil && now >= bannerUntil) { banner.hidden = true; bannerUntil = 0; }
    const bubble = document.getElementById('tutorial');
    const steps = ['① 选中锄头，锄一块地', '② 种下任意种子'];
    bubble.hidden = state.tutorial >= 2 && now >= tutorialDoneUntil;
    bubble.textContent = state.tutorial >= 2 ? '祝丰收！' : steps[state.tutorial];
    const use = document.getElementById('touch-use');
    use.style.setProperty('--use-progress', input.use ? `${Math.min(100, Math.max(0, (now - (input.useNext - 180)) / 180 * 100))}%` : '0%');
    use.classList.toggle('is-pressed', input.use);
    updateToasts(now);
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
    if (kind === 'scythe') { tone(440, 0.09, 'sine'); tone(660, 0.13, 'sine', 0.09); }
    if (kind === 'gather') tone(190, 0.1, 'triangle', 0, 110);
    if (kind === 'rod') { tone(420, 0.08, 'sine'); tone(760, 0.14, 'sine', 0.08); }
    if (kind === 'sell') { tone(740, 0.12, 'sine'); tone(1100, 0.2, 'sine', 0.11); }
    if (kind === 'error') tone(150, 0.19, 'sawtooth', 0, 110);
    if (kind === 'rain') tone(600, 0.18, 'triangle', 0, 340);
  }

  function addParticle(x, y, vx, vy, life, color, kind) {
    if (particles.length >= 300) particles.shift();
    particles.push({ x, y, vx, vy, life, age: 0, color, kind });
  }

  function action() {
    if (state.gameOver) return;
    initAudio();
    if (battle) { const outcome = F.watchStrike(state, battle, performance.now()); if (outcome.ok) battleFlashUntil = performance.now() + 90; handle(outcome, true); return; }
    const nearby = Object.entries(villagers).find(([, person]) => Math.abs(person.x - state.farmer.x) + Math.abs(person.y - state.farmer.y) <= 1);
    if (nearby) { openVillager(nearby[0]); return; }
    const target = F.frontCell(state);
    const tool = state.tool;
    const harvested = state.plots[target.y]?.[target.x]?.crop?.type;
    const outcome = state.tool === 'build' && buildChoice ? F.placeBuilding(state, buildChoice) : F.act(state, true, Math.random);
    if (!outcome.ok && !outcome.message.includes('种子') && state.plots[target.y]?.[target.x]?.tilled && !state.plots[target.y]?.[target.x]?.crop && !state.seeds[state.selectedCrop]) enqueueToast('没有种子了，去商店购买', 'alert');
    sound(outcome.ok ? (outcome.tool || 'seed') : 'error');
    if (!outcome.ok && target.x >= 0 && target.x < F.WIDTH && target.y >= 0 && target.y < F.HEIGHT) shake = { x: target.x, y: target.y, until: performance.now() + 150 };
    if (outcome.ok) {
      swingUntil = performance.now() + 200;
      swingTool = outcome.tool || 'seed';
      const x = FIELD_X + target.x * TILE + 24;
      const y = FIELD_Y + target.y * TILE + 20;
      if (outcome.tool === 'scythe') {
        addParticle(x, y, 0, -0.055, 600, '#fff5c2', 'text');
        addParticle(x, y, 0, 0, 530, cropColors[harvested] || '#e8c373', 'harvest');
      }
      if (outcome.tool === 'gather') for (let i = 0; i < 4; i++) addParticle(x, y, (i - 1.5) * 0.025, -0.025 - i % 2 * 0.012, 430, i % 2 ? WORLD_COLORS.leafGreen : WORLD_COLORS.dust, 'leaf');
      if (outcome.resource === 'fish') for (let i = 0; i < 8; i++) addParticle(x, y, (i - 4) * 0.018, -0.035 - i % 2 * 0.012, 420, WORLD_COLORS.waterGlint, 'splash');
      if (outcome.tool === 'build') for (let i = 0; i < 10; i++) {
        const angle = i / 10 * Math.PI * 2;
        addParticle(x, y + 15, Math.cos(angle) * 0.035, Math.sin(angle) * 0.018 - 0.015, 480, WORLD_COLORS.dust, 'dust');
      }
    }
    handle(outcome, true);
  }

  function move(direction) {
    if (state.gameOver) return;
    initAudio();
    const outcome = F.move(state, direction);
    if (outcome.ok) walkingUntil = performance.now() + 190;
    handle(outcome, true);
  }

  function pressDirection(direction, source) {
    if (state.gameOver) return;
    if (input.direction && input.source !== source) return;
    if (input.direction === direction) return;
    route = [];
    homeRoute = false;
    document.getElementById('home-confirm').hidden = true;
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
    if (state.gameOver) return;
    if (input.use) return;
    route = [];
    homeRoute = false;
    input.use = true;
    action();
    input.useNext = performance.now() + 180;
  }

  function tickInput(now) {
    if (state.gameOver) return;
    if (input.direction && now >= input.next) {
      move(input.direction);
      input.next = now + 140;
    }
    if (input.use && now >= input.useNext) {
      action();
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
    ctx.ellipse(Math.round(x + 3), Math.round(y + 3), rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = WORLD_COLORS.shadow;
    ctx.fill();
  }

  function pixelLine(x1, y1, x2, y2, color, size = 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = size / RENDER_SCALE;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawBackground() {
    const p = palette[F.season(state)];
    const L = F.LAYOUT;
    box(0, 0, F.WIDTH * TILE, F.HEIGHT * TILE, p.grass);
    for (let y = 0; y < F.HEIGHT; y++) for (let x = 0; x < F.WIDTH; x++) {
      const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
      const terrain = F.terrainAt(x, y);
      if (terrain === 'pond') {
        box(px, py, TILE, TILE, WORLD_COLORS.water);
        for (let i = 0; i < 5; i++) {
          const wx = px + 3 + Math.floor(hash(x, y, 101 + i) * 38);
          const wy = py + 5 + Math.floor(hash(x, y, 111 + i) * 34);
          box(wx, wy, 5 + i % 3 * 3, 2, i % 2 ? WORLD_COLORS.waterDeep : WORLD_COLORS.waterLight);
        }
      } else if (terrain === 'path' || x === L.gate.x && y >= L.farm.bottom - 1) {
        box(px, py, TILE, TILE, WORLD_COLORS.path);
        box(px + 4, py + 8, TILE - 8, 2, WORLD_COLORS.pathLight);
        pixelLine(px + 1, py + 1, px + 1, py + 47, WORLD_COLORS.pathDark);
        pixelLine(px + 46, py + 1, px + 46, py + 47, WORLD_COLORS.pathDark);
        for (let i = 0; i < 7; i++) box(px + 5 + Math.floor(hash(x, y, 120 + i) * 36), py + 5 + Math.floor(hash(x, y, 130 + i) * 38), 2 + i % 2, 2, i % 3 ? WORLD_COLORS.gravel : WORLD_COLORS.pathLight);
      } else {
        box(px, py, TILE, TILE, terrain === 'residential' ? p.light : p.grass);
        for (let i = 0; i < 50; i++) {
          const gx = px + 4 + Math.floor(hash(x, y, 20 + i) * 39);
          const gy = py + 5 + Math.floor(hash(x, y, 30 + i) * 38);
          const dotColor = i % 5 ? p.grassDark : p.grass;
          if (i % 2) box(gx, gy, i % 3 ? 2 : 1, 2 + i % 2, dotColor);
          else { ctx.beginPath(); ctx.arc(gx, gy, i % 4 ? 0.8 : 1.2, 0, Math.PI * 2); ctx.fillStyle = dotColor; ctx.fill(); }
        }
        const clusters = Math.floor(hash(x, y, 140) * 3);
        for (let i = 0; i < clusters; i++) {
          const gx = px + 7 + Math.floor(hash(x, y, 141 + i) * 32);
          const gy = py + 13 + Math.floor(hash(x, y, 145 + i) * 25);
          pixelLine(gx, gy + 5, gx - 3, gy, p.grassDark, 0.7);
          pixelLine(gx + 1, gy + 5, gx + 1, gy - 2, p.grassDark, 0.7);
          pixelLine(gx + 2, gy + 5, gx + 5, gy + 1, p.light, 0.7);
        }
        const season = F.season(state);
        if (hash(x, y, 150) > 0.58) {
          const fx = px + 7 + Math.floor(hash(x, y, 151) * 33), fy = py + 7 + Math.floor(hash(x, y, 152) * 32);
          const accents = season === '春' ? [WORLD_COLORS.springFlower, WORLD_COLORS.springFlowerLight] : season === '夏' ? [WORLD_COLORS.summerFlower, WORLD_COLORS.summerFlowerLight] : season === '秋' ? [WORLD_COLORS.autumnLeaf, WORLD_COLORS.autumnLeafLight] : [WORLD_COLORS.frost, WORLD_COLORS.frostShade];
          box(fx - 2, fy, 2, 2, accents[0]); box(fx + 2, fy + 1, 2, 2, accents[1]); box(fx, fy + 2, 2, 2, accents[0]);
        }
      }
      if (terrain === 'tree') { drawTreeTrunk(px + 4, py - 8); drawTreeCanopy(px + 4, py - 8, hash(x, y, 165) * 900); }
      const shore = (x === L.pond.left - 1 || x === L.pond.right + 1) && y >= L.pond.top && y <= L.pond.bottom ||
        (y === L.pond.top - 1 || y === L.pond.bottom + 1) && x >= L.pond.left && x <= L.pond.right;
      if (shore) {
        box(px + 28, py + 7, 15, 34, WORLD_COLORS.sand);
        box(px + 40, py + 7, 3, 34, WORLD_COLORS.sandDark);
        const reeds = 3 + Math.floor(hash(x, y, 160) * 3);
        for (let i = 0; i < reeds; i++) {
          const rx = px + 25 + i * 4;
          pixelLine(rx, py + 40, rx + (i % 2 ? 2 : -2), py + 15 + i % 3 * 3, WORLD_COLORS.leafGreen, 1.2);
          box(rx - 2 + (i % 2 ? 2 : -2), py + 12 + i % 3 * 3, 4, 6, WORLD_COLORS.autumnLeafLight);
        }
      }
    }
    // 村口道路向画面南侧继续，村牌仅作装饰。
    box(L.gate.x * TILE + 5, L.gate.y * TILE, TILE - 10, TILE, WORLD_COLORS.path);
    box(L.gate.x * TILE + TILE - 7, L.gate.y * TILE - 27, 4, 35, WORLD_COLORS.wood);
    box(L.gate.x * TILE + TILE - 25, L.gate.y * TILE - 30, 28, 16, WORLD_COLORS.woodLight);
    pixelLine(L.gate.x * TILE + TILE - 22, L.gate.y * TILE - 26, L.gate.x * TILE + TILE - 1, L.gate.y * TILE - 26, WORLD_COLORS.woodGrain);
    pixelLine(L.gate.x * TILE + TILE - 20, L.gate.y * TILE - 18, L.gate.x * TILE + TILE - 1, L.gate.y * TILE - 18, WORLD_COLORS.woodGrain);
    label('村口', L.gate.x * TILE + TILE - 23, L.gate.y * TILE - 18, WORLD_COLORS.woodDark, 10);
  }

  function drawAmbient(now) {
    const p = palette[F.season(state)];
    for (let y = 0; y < F.HEIGHT; y++) for (let x = 0; x < F.WIDTH; x++) {
      const px = FIELD_X + x * TILE + 7 + Math.floor(hash(x, y, 40) * 34);
      const py = FIELD_Y + y * TILE + 12 + Math.floor(hash(x, y, 50) * 30);
      const sway = Math.sin(now / 680 + x * 1.7 + y * 2.3) * 1.5;
      pixelLine(px, py + 4, px - 2 + sway, py, p.grassDark, 0.5);
    }
    for (let cloud = 0; cloud < 3; cloud++) {
      const cloudX = (((now + cloud * 2700) % 10500) / 10500) * (WORLD_WIDTH + 280) - 190;
      const cloudY = 170 + cloud * 155;
      ctx.fillStyle = WORLD_COLORS.cloudShadow;
      for (let puff = 0; puff < 4; puff++) { ctx.beginPath(); ctx.ellipse(cloudX + puff * 38, cloudY + (puff % 2) * 8, 74 - puff * 5, 19, -0.12, 0, Math.PI * 2); ctx.fill(); }
    }
    const season = F.season(state);
    if (season !== '冬') for (let i = 0; i < 2; i++) {
      const t = now / 850 + i * Math.PI;
      const x = F.LAYOUT.farm.left * TILE + 55 + (now / 18 + i * 260) % ((F.LAYOUT.farm.right - F.LAYOUT.farm.left) * TILE);
      const y = F.LAYOUT.farm.top * TILE + 45 + i * 92 + Math.sin(t) * 24;
      const color = season === '秋' ? (i ? WORLD_COLORS.autumnLeafLight : WORLD_COLORS.autumnLeaf) : (i ? WORLD_COLORS.springFlower : WORLD_COLORS.summerFlower);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.7) * 0.6);
      if (season === '秋') { box(-4, -2, 8, 4, color); pixelLine(-3, 0, 4, 0, WORLD_COLORS.woodGrain); }
      else { box(-6, -2, 5, 4, color); box(2, -2, 5, 4, color); box(-1, 0, 2, 4, WORLD_COLORS.woodDark); }
      ctx.restore();
    }
  }

  function drawTreeTrunk(x, y) {
    shadow(x + 21, y + 55, 22, 6);
    box(x + 11, y + 52, 22, 7, WORLD_COLORS.rootSoil);
    box(x + 15, y + 20, 9, 38, WORLD_COLORS.bark);
    box(x + 16, y + 27, 3, 25, WORLD_COLORS.barkLight); box(x + 22, y + 34, 3, 19, WORLD_COLORS.barkDark);
    box(x + 8, y + 26, 24, 4, WORLD_COLORS.bark);
    pixelLine(x + 14, y + 55, x + 8, y + 59, WORLD_COLORS.barkDark); pixelLine(x + 24, y + 54, x + 31, y + 59, WORLD_COLORS.barkDark);
  }

  function drawTreeCanopy(x, y, now) {
    const season = F.season(state);
    const sway = Math.round(Math.sin(now / 840 + x * 0.21) * 1);
    if (season === '冬') {
      box(x + 3 + sway, y + 24, 15, 3, '#eef5ec');
      box(x + 23 + sway, y + 20, 15, 3, '#eef5ec');
    } else {
      const color = { '春': '#e7a5b1', '夏': '#5e9d58', '秋': '#dfbd62' }[season];
      const dark = { '春': '#b98099', '夏': '#397749', '秋': '#aa8748' }[season];
      const mid = { '春': WORLD_COLORS.springMid, '夏': WORLD_COLORS.summerMid, '秋': WORLD_COLORS.autumnMid }[season];
      const light = { '春': WORLD_COLORS.springTop, '夏': WORLD_COLORS.summerTop, '秋': WORLD_COLORS.autumnTop }[season];
      box(x + 4 + sway, y + 8, 32, 28, dark);
      box(x + 11 + sway, y, 19, 40, dark);
      box(x + 7 + sway, y + 5, 22, 15, mid);
      box(x + 17 + sway, y + 18, 19, 12, color);
      box(x + 4 + sway, y + 22, 14, 10, color);
      box(x + 11 + sway, y + 4, 8, 5, light); box(x + 24 + sway, y + 15, 8, 5, light);
    }
  }

  function drawPondRipples(now) {
    const L = F.LAYOUT.pond;
    for (let i = 0; i < 3; i++) {
      const px = (L.left + 0.8 + i) * TILE;
      const py = (L.top + 1 + i % 2) * TILE;
      const age = (now + i * 400) % 1200 / 1200;
      ctx.globalAlpha = 1 - age;
      ctx.beginPath(); ctx.ellipse(px, py, 3 + age * 16, 2 + age * 7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#e7f4e4'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (let y = L.top; y <= L.bottom; y++) for (let x = L.left; x <= L.right; x++) if (hash(x, y, 170) > 0.28) {
      const phase = (Math.sin(now / 720 + hash(x, y, 171) * 8) + 1) / 2;
      ctx.globalAlpha = 0.2 + phase * 0.55;
      const py = y * TILE + 13 + hash(x, y, 172) * 24;
      pixelLine(x * TILE + 8 + phase * 8, py, x * TILE + 20 + phase * 8, py, WORLD_COLORS.waterGlint, 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawResourceNodes(now) {
    for (const node of F.RESOURCE_NODES) {
      const status = state.resourceNodes[node.id];
      const x = node.x * TILE, y = node.y * TILE;
      if (node.kind === 'tree') {
        if (status.charges) {
          box(x + 12, y + 37, 18, 5, '#8a6040'); box(x + 18, y + 32, 18, 5, '#a5794f');
        } else { box(x + 14, y + 33, 21, 10, '#8a6040'); box(x + 18, y + 32, 13, 3, '#c79a62'); ctx.beginPath(); ctx.ellipse(x + 24, y + 35, 5, 2, 0, 0, Math.PI * 2); ctx.strokeStyle = WORLD_COLORS.woodGrain; ctx.stroke(); }
      } else if (node.kind === 'berry') {
        pixelLine(x + 13, y + 40, x + 25, y + 18, '#654b35', 3); pixelLine(x + 34, y + 40, x + 25, y + 18, '#654b35', 3);
        if (status.charges) { box(x + 9, y + 19, 31, 22, '#4f874f'); box(x + 15, y + 13, 21, 27, '#6aa45d'); box(x + 12, y + 16, 9, 8, WORLD_COLORS.leafLight); box(x + 28, y + 18, 9, 7, WORLD_COLORS.leafGreen); }
        for (let i = 0; i < status.charges; i++) { ctx.fillStyle = '#c94646'; ctx.beginPath(); ctx.arc(x + 19 + i * 11, y + 24 + i * 5, 3, 0, Math.PI * 2); ctx.fill(); }
      } else if (node.kind === 'stone') {
        if (status.charges) { box(x + 8, y + 24, 33, 17, '#7f8985'); box(x + 14, y + 18, 21, 8, '#aab1aa'); box(x + 16, y + 20, 13, 3, WORLD_COLORS.whiteFlash); }
        else { box(x + 11, y + 37, 9, 4, '#838b86'); box(x + 27, y + 34, 12, 6, '#9aa19c'); }
      } else {
        const age = now % 1100 / 1100; ctx.globalAlpha = status.charges ? 0.85 : 0.2;
        ctx.beginPath(); ctx.ellipse(x + 24, y + 25, 5 + age * 16, 2 + age * 7, 0, 0, Math.PI * 2); ctx.strokeStyle = '#e7f4e4'; ctx.stroke();
        if (status.charges) { box(x + 22, y + 18, 4, 8, '#f4eee2'); box(x + 22, y + 17, 4, 4, '#d94e49'); }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawHouseCell(cell, name, roof = WORLD_COLORS.roofHome, prop = 'flowers') {
    const x = cell.x * TILE, y = cell.y * TILE;
    shadow(x + 24, y + 43, 23, 5);
    box(x + 4, y + 15, 40, 29, WORLD_COLORS.wall);
    for (let i = 0; i < 5; i++) pixelLine(x + 7 + i * 8, y + 17, x + 7 + i * 8, y + 42, WORLD_COLORS.wallShade, 0.5);
    box(x + 1, y + 10, 46, 10, WORLD_COLORS.barkDark);
    box(x + 7, y + 5, 34, 9, roof);
    for (let i = 0; i < 4; i++) pixelLine(x + 8, y + 7 + i * 2, x + 40, y + 7 + i * 2, i % 2 ? WORLD_COLORS.roofRidge : WORLD_COLORS.barkDark, 0.5);
    box(x + 8, y + 4, 32, 2, WORLD_COLORS.roofRidge);
    box(x + 17, y + 27, 14, 17, WORLD_COLORS.door); box(x + 28, y + 34, 2, 2, WORLD_COLORS.metal);
    box(x + 6, y + 24, 10, 10, WORLD_COLORS.woodDark); box(x + 8, y + 26, 6, 6, WORLD_COLORS.window); box(x + 9, y + 27, 2, 2, WORLD_COLORS.windowGlow);
    box(x + 14, y + 43, 21, 4, WORLD_COLORS.plazaEdge);
    if (prop === 'jar') { box(x + 35, y + 34, 8, 10, WORLD_COLORS.roofBlue); box(x + 36, y + 32, 6, 3, WORLD_COLORS.waterLight); }
    else if (prop === 'wood') { box(x + 34, y + 37, 11, 4, WORLD_COLORS.barkDark); box(x + 36, y + 33, 9, 4, WORLD_COLORS.barkLight); }
    else if (prop === 'pot') { box(x + 36, y + 38, 8, 6, WORLD_COLORS.roofRed); box(x + 38, y + 33, 2, 6, WORLD_COLORS.leafGreen); box(x + 41, y + 32, 3, 4, WORLD_COLORS.springFlower); }
    else { box(x + 36, y + 39, 3, 3, WORLD_COLORS.springFlower); box(x + 41, y + 37, 3, 3, WORLD_COLORS.summerFlower); }
    label(name, x + 5, y + 3, WORLD_COLORS.woodDark, 10);
  }

  function drawHouses() {
    drawHouseCell(F.LAYOUT.home, '家');
    const roofs = [WORLD_COLORS.roofBlue, WORLD_COLORS.roofRed, WORLD_COLORS.roofMoss];
    const props = ['jar', 'wood', 'pot'];
    F.LAYOUT.huts.forEach((hut, i) => drawHouseCell(hut, ['村长', '婆婆', '猎手'][i], roofs[i], props[i]));
    const x = F.LAYOUT.square.x * TILE, y = F.LAYOUT.square.y * TILE;
    box(x - TILE, y - TILE, TILE * 3, TILE * 3, WORLD_COLORS.plaza);
    for (let py = -1; py < 2; py++) for (let px = -1; px < 2; px++) { box(x + px * 32 + 1, y + py * 25 + 2, 29, 22, (px + py) % 2 ? WORLD_COLORS.plazaLight : WORLD_COLORS.plaza); pixelLine(x + px * 32, y + py * 25, x + px * 32 + 30, y + py * 25, WORLD_COLORS.plazaEdge, 0.5); }
    box(x + 12, y + 13, 24, 20, WORLD_COLORS.plazaEdge);
    box(x + 18, y + 18, 12, 8, WORLD_COLORS.plazaLight);
    const farm = F.LAYOUT.farm;
    for (let px = farm.left; px <= farm.right; px += 3) { box(px * TILE + 21, farm.top * TILE - 9, 5, 14, WORLD_COLORS.wood); box(px * TILE + 22, farm.top * TILE - 8, 2, 11, WORLD_COLORS.woodLight); }
  }

  function drawPlot(plot, x, y) {
    if (!plot.tilled && !plot.structure) return;
    const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
    if (plot.structure) {
      if (plot.structure === 'fence') { box(px + 5, py + 16, 38, 8, '#8a6040'); box(px + 9, py + 7, 6, 34, '#c99b70'); box(px + 32, py + 7, 6, 34, '#c99b70'); }
      else { box(px + 22, py + 8, 4, 35, '#76533f'); box(px + 7, py + 15, 34, 5, '#a17855'); box(px + 14, py + 5, 20, 8, '#d1aa7c'); box(px + 18, py + 21, 12, 12, '#e8c373'); }
      return;
    }
    box(px + 2, py + 4, 44, 41, plot.crop ? WORLD_COLORS.soilPlanted : WORLD_COLORS.soil);
    box(px + 4, py + 5, 39, 3, WORLD_COLORS.furrowLight);
    for (const row of [14, 23, 32]) {
      pixelLine(px + 6, py + row, px + 42, py + row, WORLD_COLORS.furrow, 1.2);
      pixelLine(px + 8, py + row + 2, px + 39, py + row + 2, WORLD_COLORS.furrowLight, 0.7);
    }
    for (let i = 0; i < 4; i++) {
      const dx = 8 + Math.floor(hash(x, y, 70 + i) * 31), dy = 9 + Math.floor(hash(x, y, 80 + i) * 30);
      box(px + dx, py + dy, 4, 2, WORLD_COLORS.soilSpeck);
    }
    if (F.season(state) === '冬') {
      box(px + 2, py + 3, 43, 2, '#f3f5e9');
      box(px + 2, py + 3, 2, 41, '#e8f0e9');
    }
    pixelLine(px + 4.5, py + 7.5, px + 42.5, py + 7.5, '#d1aa7c');
    pixelLine(px + 8, py + 16.5, px + 38, py + 16.5, '#d2ad795c');
    if (plot.crop) {
      shadow(px + 24, py + 38, 13, 4);
      drawCrop(ctx, plot.crop, px, py, performance.now());
    }
  }

  function drawCrop(target, crop, px, py, now) {
    const progress = crop.progress;
    const mature = progress >= F.CROPS[crop.type].days;
    const offset = mature && Math.floor(now / 800) % 2 ? -1 : 0;
    px += Math.sin(now / 600 + hash(px / TILE, py / TILE, 180) * 7) * (mature ? 2 : 1);
    py += offset;
    const center = px + 24;
    const paint = (x, y, w, h, color) => { target.fillStyle = color; target.fillRect(Math.round(x), Math.round(y), w, h); };
    const line = (x1, y1, x2, y2, color) => {
      target.beginPath(); target.moveTo(x1, y1); target.lineTo(x2, y2);
      target.strokeStyle = color; target.lineWidth = 0.5; target.lineCap = 'round'; target.stroke();
    };
    if (progress === 0) {
      paint(center - 6, py + 27, 12, 6, '#a77b53');
      if (crop.type === 'carrot') paint(center - 2, py + 24, 4, 5, '#e7bd7b');
      if (crop.type === 'potato') paint(center - 4, py + 23, 8, 6, '#c8aa7c');
      if (crop.type === 'pumpkin') { paint(center - 3, py + 24, 6, 4, '#e0c184'); paint(center - 1, py + 21, 2, 4, '#74a153'); }
      if (crop.type === 'strawberry') { paint(center - 2, py + 24, 4, 4, '#ae6156'); paint(center + 2, py + 25, 2, 3, '#ebd7a0'); }
      if (crop.type === 'corn') { paint(center - 4, py + 24, 4, 6, '#f6d46b'); paint(center + 2, py + 26, 3, 4, '#f6d46b'); }
      paint(center - 4, py + 27, 2, 1, '#f3d3a0');
      line(center - 4, py + 30.5, center + 4, py + 30.5, '#f5dba7');
      return;
    }
    if (progress === 1) {
      paint(center - 2, py + 23, 4, 15, '#5b914c');
      if (crop.type === 'carrot') { paint(center - 8, py + 19, 7, 5, '#77b758'); paint(center + 2, py + 17, 7, 5, '#69a753'); }
      if (crop.type === 'potato') { paint(center - 12, py + 23, 11, 7, '#77b758'); paint(center + 2, py + 21, 11, 7, '#69a753'); }
      if (crop.type === 'pumpkin') { paint(center - 11, py + 25, 10, 5, '#77b758'); paint(center + 2, py + 25, 10, 5, '#69a753'); paint(center - 1, py + 19, 3, 6, '#8eb75c'); }
      if (crop.type === 'strawberry') { paint(center - 11, py + 24, 10, 5, '#77b758'); paint(center + 2, py + 22, 10, 5, '#69a753'); }
      if (crop.type === 'corn') { paint(center - 8, py + 20, 7, 4, '#77b758'); paint(center + 2, py + 17, 7, 4, '#69a753'); }
      if (crop.type === 'carrot') { line(center - 7, py + 20, center - 2, py + 21, '#b5db78'); line(center + 3, py + 19, center + 8, py + 18, '#b5db78'); }
      if (crop.type === 'potato') { line(center - 8, py + 28, center + 7, py + 24, '#3c7440'); paint(center + 5, py + 22, 2, 2, '#a6cb72'); }
      if (crop.type === 'pumpkin') line(center - 10, py + 28, center + 11, py + 27, '#426e38');
      if (crop.type === 'strawberry') { paint(center - 7, py + 22, 3, 2, '#a0cb69'); paint(center + 5, py + 20, 3, 2, '#a0cb69'); }
      if (crop.type === 'corn') { paint(center - 1, py + 21, 2, 8, '#a1c66a'); line(center + 4, py + 19, center + 8, py + 17, '#b6d57a'); }
      line(center - 7, py + 23.5, center - 2, py + 25, '#dbec9b');
      line(center + 3, py + 22, center + 8, py + 20.5, '#dbec9b');
      return;
    }
    if (crop.type === 'carrot') {
      paint(center - 2, py + 13, 4, 25, '#4c853e');
      paint(center - 12, py + 17, 11, 6, '#66a94c');
      paint(center + 1, py + 14, 12, 7, '#80b951');
      paint(center - 8, py + 9, 6, 11, '#78b353');
      line(center - 8, py + 19, center - 1, py + 21, '#b4d971');
      line(center + 2, py + 17, center + 10, py + 16, '#b4d971');
      line(center - 5, py + 12, center - 4, py + 18, '#b4d971');
      if (mature) {
        paint(center - 9, py + 26, 18, 10, '#dc6b3d');
        paint(center - 7, py + 36, 14, 4, '#ed8150');
        paint(center - 4, py + 40, 8, 3, '#f1ddd0');
        paint(center - 2, py + 43, 4, 2, '#fff2db');
        paint(center - 7, py + 28, 5, 2, '#f3a06a');
      }
    } else if (crop.type === 'potato') {
      paint(center - 15, py + 24, 30, 12, '#4d8b47');
      paint(center - 11, py + 17, 13, 12, '#6fab55');
      paint(center + 1, py + 14, 14, 15, '#79b45f');
      paint(center - 4, py + 10, 8, 9, '#5c9d4c');
      line(center - 13, py + 32, center - 4, py + 24, '#3d7140');
      line(center - 4, py + 24, center + 8, py + 29, '#3d7140');
      if (mature) {
        paint(center - 16, py + 32, 13, 9, '#c9a376');
        paint(center + 3, py + 31, 14, 10, '#d8b684');
        paint(center - 11, py + 35, 2, 2, '#9a7758');
        paint(center + 9, py + 34, 2, 2, '#9a7758');
        paint(center - 6, py + 15, 4, 3, '#f7f2de'); paint(center + 7, py + 18, 4, 3, '#fff9e8');
        line(center - 12, py + 38, center - 8, py + 35, '#8c6b4f');
        line(center + 2, py + 39, center + 6, py + 37, '#8c6b4f');
      }
    } else if (crop.type === 'pumpkin') {
      paint(center - 18, py + 30, 36, 5, '#4f8541');
      paint(center - 17, py + 23, 12, 11, '#6da449');
      paint(center + 6, py + 20, 12, 12, '#76ad4d');
      paint(center - 2, py + 15, 4, 17, '#5c8739');
      line(center - 17, py + 34, center + 13, py + 31, '#426f36');
      line(center + 12, py + 29, center + 17, py + 25, '#5b8a41');
      line(center + 17, py + 25, center + 14, py + 22, '#5b8a41');
      if (mature) {
        paint(center - 17, py + 23, 34, 18, '#cd7034');
        paint(center - 12, py + 19, 24, 23, '#e6973d');
        paint(center - 4, py + 21, 8, 20, '#f3ad4d');
        paint(center - 3, py + 16, 6, 6, '#598141');
        line(center - 10, py + 23, center - 11, py + 38, '#bd6931');
        line(center + 9, py + 23, center + 10, py + 38, '#bd6931');
        paint(center + 3, py + 23, 5, 2, '#ffd07b');
      }
    } else if (crop.type === 'strawberry') {
      paint(center - 2, py + 18, 4, 20, '#568a45');
      paint(center - 16, py + 22, 14, 9, '#6aa852');
      paint(center + 2, py + 20, 15, 10, '#78b65a');
      paint(center - 10, py + 13, 9, 8, '#5e9c4b');
      paint(center - 13, py + 21, 4, 4, '#83bb5c');
      paint(center + 10, py + 20, 4, 4, '#91c569');
      paint(center - 5, py + 14, 3, 3, '#91c569');
      paint(center - 13, py + 18, 4, 3, '#83bb5c'); paint(center - 9, py + 20, 4, 3, '#83bb5c');
      paint(center + 6, py + 17, 4, 3, '#91c569'); paint(center + 10, py + 19, 4, 3, '#91c569');
      paint(center - 2, py + 11, 4, 3, '#91c569'); paint(center + 2, py + 13, 4, 3, '#91c569');
      if (mature) {
        for (const [dx, dy, color] of [[-11, 28, '#c73740'], [4, 26, '#e95151'], [-2, 33, '#d94148']]) {
          paint(center + dx, py + dy, 9, 8, color);
          paint(center + dx + 2, py + dy + 7, 5, 3, '#ee6561');
          paint(center + dx + 1, py + dy + 2, 2, 2, '#fff0bb');
          paint(center + dx + 5, py + dy + 4, 1, 2, '#ffe2a0');
          paint(center + dx + 3, py + dy + 6, 1, 1, '#ffe2a0');
        }
      }
    } else if (crop.type === 'corn') {
      paint(center - 3, py + 9, 6, 30, '#5c9149');
      paint(center - 14, py + 19, 12, 5, '#78ae55');
      paint(center + 3, py + 23, 13, 5, '#72a74d');
      paint(center - 7, py + 7, 5, 10, '#8bb65b');
      paint(center + 1, py + 10, 2, 25, '#a6c66c');
      line(center - 12, py + 22, center - 2, py + 32, '#a5ca69');
      if (mature) {
        paint(center + 4, py + 17, 10, 19, '#e9b942');
        paint(center + 6, py + 19, 6, 15, '#f8db65');
        paint(center + 3, py + 27, 3, 12, '#70a750');
        paint(center + 12, py + 25, 4, 13, '#6e9c4d');
        line(center + 2, py + 36, center + 7, py + 23, '#92bd5b');
        line(center + 16, py + 36, center + 12, py + 22, '#9fc566');
        for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) paint(center + 6 + col * 3, py + 20 + row * 3, 2, 2, '#ffe47d');
        line(center + 8, py + 16, center + 4, py + 7, '#b38855');
        line(center + 9, py + 16, center + 13, py + 8, '#b38855');
      }
    }
    line(center - 10, py + 21.5, center - 3, py + 23, '#d1e89a');
    line(center + 3, py + 18.5, center + 10, py + 17, '#d1e89a');
    paint(center - 7, py + 18, 1, 1, '#f1f7c3');
    paint(center + 8, py + 16, 1, 1, '#f1f7c3');
  }

  function drawFarmer(now) {
    const x = FIELD_X + state.farmer.x * TILE + 9;
    const walking = now < walkingUntil;
    const frame = walking ? Math.floor(now / 65) % 4 : 0;
    const feet = [0, 2, 0, -2][frame];
    const y = FIELD_Y + state.farmer.y * TILE + 5 + (walking ? -(frame % 2) : Math.floor(now / 900) % 2);
    const facing = state.farmer.facing;
    shadow(x + 21, y + 39, 16, 5);
    box(x + 10, y + 29, 8, 7 + feet, '#775c4b');
    box(x + 23, y + 29, 8, 7 - feet, '#775c4b');
    box(x + 9, y + 35 + feet, 10, 4, '#45423f');
    box(x + 22, y + 35 - feet, 10, 4, '#45423f');
    box(x + 8, y + 20, 25, 13, facing === 'up' ? '#426f82' : '#557f9a');
    box(x + 11, y + 22, 18, 2, '#739fb2');
    pixelLine(x + 12, y + 26.5, x + 16, y + 31, '#315c73');
    pixelLine(x + 26, y + 24, x + 28, y + 30.5, '#9bc2c6');
    box(x + 5, y + 22 + feet, 5, 10, '#edb881');
    box(x + 32, y + 22 - feet, 5, 10, '#edb881');
    box(x + 12, y + 9, 18, 14, '#e8ae7a');
    if (facing === 'up') box(x + 12, y + 11, 18, 13, '#795b45');
    box(x + 10, y + 7, 22, 6, '#795a3d');
    box(x + (facing === 'left' ? 2 : facing === 'right' ? 10 : 6), y + 4, 30, 6, '#b48b56');
    box(x + 12, y, 18, 7, '#ccaa68');
    box(x + 16, y + 2, 11, 1, '#e4c989');
    for (let i = 0; i < 5; i++) pixelLine(x + 13 + i * 3, y + 1.5, x + 16 + i * 3, y + 5.5, '#efd79a', 0.5);
    if (facing !== 'up') {
      if (facing === 'left') box(x + 13, y + 16, 3, 3, '#3c4540');
      else if (facing === 'right') box(x + 27, y + 16, 3, 3, '#3c4540');
      else {
        box(x + 16, y + 15, 3, 3, '#3c4540');
        box(x + 25, y + 15, 3, 3, '#3c4540');
        box(x + 20, y + 20, 3, 1, '#b97761');
      }
      const eyeX = facing === 'left' ? x + 13.5 : facing === 'right' ? x + 27.5 : x + 16.5;
      ctx.fillStyle = '#fff7de'; ctx.fillRect(eyeX, y + 15.5, 0.5, 0.5);
      if (facing === 'down') ctx.fillRect(x + 25.5, y + 15.5, 0.5, 0.5);
    }
    if (now >= swingUntil) {
      const tx = facing === 'left' ? x + 1 : x + 37;
      box(tx, y + 22, 2, 14, '#8a6040');
      if (state.tool === 'hoe') box(tx - 4, y + 20, 10, 3, '#b5c1bd');
      if (state.tool === 'scythe') pixelLine(tx - 4, y + 21, tx + 6, y + 17, '#d8dfd2', 2);
      if (state.tool === 'seed') box(tx - 3, y + 29, 8, 6, '#d4ad65');
      if (state.tool === 'gather') { box(tx - 5, y + 27, 11, 9, WORLD_COLORS.woodLight); pixelLine(tx - 4, y + 28, tx + 5, y + 28, WORLD_COLORS.woodDark); }
      if (state.tool === 'rod') { pixelLine(tx, y + 22, tx + 7, y + 3, WORLD_COLORS.woodDark, 2); pixelLine(tx + 7, y + 3, tx + 10, y + 25, WORLD_COLORS.metal, 0.7); }
      if (state.tool === 'build') { pixelLine(tx, y + 22, tx + 3, y + 8, WORLD_COLORS.woodDark, 2); box(tx - 2, y + 6, 11, 5, WORLD_COLORS.metal); }
    } else {
      const phase = Math.min(2, Math.floor((200 - (swingUntil - now)) / 67));
      const side = facing === 'left' ? -1 : 1;
      const tx = (facing === 'left' ? x - 5 : facing === 'right' ? x + 37 : x + 31) + (swingTool === 'scythe' ? [-6, 8, 1][phase] * side : 0);
      const ty = y + [2, 17, 9][phase] + (swingTool === 'hoe' ? [-6, 4, 0][phase] : 0);
      pixelLine(tx, ty, tx + side * (swingTool === 'hoe' ? 7 : 4), ty + 18, '#8a6040', 3);
      if (swingTool === 'hoe') { box(tx - 6, ty - 2, 15, 4, '#b5c1bd'); pixelLine(tx - 4, ty - 1, tx + 6, ty - 1, WORLD_COLORS.whiteFlash); }
      else if (swingTool === 'scythe') { pixelLine(tx - side * 7, ty + 2, tx + side * 6, ty - 5, '#d8dfd2', 2); pixelLine(tx - side * 5, ty + 1, tx + side * 5, ty - 4, WORLD_COLORS.whiteFlash); }
      else if (swingTool === 'seed') { box(tx - 3, ty + 12, 8, 6, '#d4ad65'); box(tx + side * 7, ty + 17, 2, 2, WORLD_COLORS.summerFlower); }
      else if (swingTool === 'gather') { const wobble = phase === 1 ? 2 : -1; box(tx - 6, ty + 11 + wobble, 12, 9, WORLD_COLORS.woodLight); pixelLine(tx - 5, ty + 12 + wobble, tx + 5, ty + 12 + wobble, WORLD_COLORS.woodDark); }
      else if (swingTool === 'rod') {
        pixelLine(tx, ty, tx + side * 12, ty - 16, WORLD_COLORS.woodDark, 2);
        for (let i = 0; i < 5; i++) pixelLine(tx + side * (12 + i * 4), ty - 16 + i * i, tx + side * (16 + i * 4), ty - 15 + (i + 1) * (i + 1), WORLD_COLORS.metal, 0.7);
      } else if (swingTool === 'build') { pixelLine(tx, ty, tx + side * 5, ty + 15, WORLD_COLORS.woodDark, 3); box(tx - 5 + (phase % 2) * side * 3, ty - 3, 13, 5, WORLD_COLORS.metal); }
    }
  }

  function drawScene(now) {
    const key = F.season(state);
    if (key !== staticKey) {
      ctx = staticContext;
      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      drawBackground();
      drawHouses();
      ctx = sceneContext;
      staticKey = key;
    }
    const target = F.cameraTarget(state.farmer, SCENE_WIDTH, SCENE_HEIGHT, TILE);
    camera = F.cameraStep(camera, target, cameraTime ? now - cameraTime : 0);
    cameraTime = now;
    const sx = Math.max(0, camera.x), sy = Math.max(0, camera.y);
    const sw = Math.min(WORLD_WIDTH, SCENE_WIDTH), sh = Math.min(WORLD_HEIGHT, SCENE_HEIGHT);
    ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    ctx.drawImage(staticCanvas, sx * STATIC_SCALE, sy * STATIC_SCALE, sw * STATIC_SCALE, sh * STATIC_SCALE,
      Math.max(0, -camera.x), Math.max(0, -camera.y), sw, sh);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawAmbient(now);
    drawPondRipples(now);
    drawResourceNodes(now);
    for (let y = 0; y < F.HEIGHT; y++) {
      for (let x = 0; x < F.WIDTH; x++) drawPlot(state.plots[y][x], x, y);
    }
    const front = F.frontCell(state);
    if (front.x >= 0 && front.y >= 0 && front.x < F.WIDTH && front.y < F.HEIGHT) {
      const px = FIELD_X + front.x * TILE, py = FIELD_Y + front.y * TILE;
      ctx.globalAlpha = state.tool === 'build' && buildChoice ? 0.9 : 0.55 + 0.35 * Math.sin(now / 350);
      box(px + 3, py + 2, 42, 3, UI_COLORS.focus);
      box(px + 3, py + 43, 42, 3, UI_COLORS.focus);
      box(px + 2, py + 3, 3, 40, UI_COLORS.focus);
      box(px + 43, py + 3, 3, 40, UI_COLORS.focus);
      ctx.globalAlpha = 1;
    }
    if (shake && now < shake.until) {
      const px = FIELD_X + shake.x * TILE, py = FIELD_Y + shake.y * TILE;
      ctx.strokeStyle = UI_COLORS.danger;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + (Math.floor(now / 25) % 2 ? 2 : -2) + 3, py + 3, 42, 42);
    }
    drawFarmer(now);
    if (!battle) for (const [id, person] of Object.entries(villagers)) {
      const x = FIELD_X + person.x * TILE, baseY = FIELD_Y + person.y * TILE;
      const y = baseY + Math.round(Math.sin(now / 760 + person.x * 0.8) * 1);
      shadow(x + 24, baseY + 40, 13, 4);
      box(x + 16, y + 19, 16, 20, { mayor: '#708baf', merchant: '#bc745a', hunter: '#617c55' }[id]);
      box(x + 19, y + 9, 11, 12, '#e8ba8f');
      box(x + 17, y + 6, 15, 6, { mayor: '#ece1ba', merchant: '#836159', hunter: '#4b593a' }[id]);
      box(x + 1, y - 8, 46, 14, '#604e40');
      label(F.VILLAGERS[id].name, x + 3, y + 3, '#fff9dd', 10);
      if (Math.abs(person.x - state.farmer.x) + Math.abs(person.y - state.farmer.y) <= 1) {
        box(x - 7, y - 24, 62, 14, '#fff9dd');
        label('空格交谈', x - 4, y - 13, '#604e40', 10);
      }
    }
    if (battle) {
      ctx.fillStyle = 'rgba(15, 30, 79, 0.48)';
      ctx.fillRect(camera.x, camera.y, SCENE_WIDTH, SCENE_HEIGHT);
      for (const enemy of battle.enemies) {
        if (enemy.x < 0 || enemy.x >= F.WIDTH) continue;
        const x = FIELD_X + enemy.x * TILE, y = FIELD_Y + enemy.y * TILE;
        const lean = enemy.retreating ? 5 : 0;
        const cape = Math.floor(now / 120) % 2 ? 3 : -2;
        box(x + 13 + lean, y + 12, 23, 26, now < battleFlashUntil ? WORLD_COLORS.whiteFlash : enemy.retreating ? '#8793b1' : '#713c49');
        box(x + 10 + lean, y + 27, 8 + cape, 12, WORLD_COLORS.capeLight); box(x + 27 + lean, y + 27, 8 - cape, 12, WORLD_COLORS.capeDark);
        box(x + 9, y + 8, 30, 8, '#342b48');
        label(`♥${Math.max(0, enemy.health)}`, x + 12, y + 8, '#fff4cf', 10);
      }
      label('守夜中 · 面向强盗按使用键挥砍', camera.x + 215, camera.y + 62, '#fff4cf', 15);
    }
    for (const particle of particles) {
      ctx.globalAlpha = ['smoke', 'star', 'splash', 'leaf', 'dust'].includes(particle.kind) ? Math.max(0, 1 - particle.age / particle.life) : 1;
      if (particle.kind === 'text') label('+1', particle.x - 9, particle.y, particle.color, 15);
      else if (particle.kind === 'harvest') {
        const t = particle.age / particle.life;
        const x = t < 0.22 ? particle.x : particle.x + (state.farmer.x * TILE + TILE / 2 - particle.x) * ((t - 0.22) / 0.78);
        const y = t < 0.22 ? particle.y - 11 * Math.sin(t / 0.22 * Math.PI) : particle.y + (state.farmer.y * TILE - particle.y) * ((t - 0.22) / 0.78) - 17 * Math.sin((t - 0.22) / 0.78 * Math.PI);
        const size = Math.max(1, 7 * (1 - t));
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * Math.PI * 4); box(-size / 2, -size / 2, size, size, particle.color); ctx.restore();
      } else if (particle.kind === 'star') {
        box(particle.x - 3, particle.y, 7, 1, particle.color);
        box(particle.x, particle.y - 3, 1, 7, particle.color);
      } else if (particle.kind === 'rain') {
        pixelLine(particle.x, particle.y, particle.x - 3, particle.y + 10, particle.color);
      } else if (particle.kind === 'snow') box(particle.x, particle.y, 3, 3, particle.color);
      else if (particle.kind === 'splash') { box(particle.x - 2, particle.y, 2, 2, particle.color); box(particle.x + 2, particle.y, 2, 2, particle.color); }
      else if (particle.kind === 'leaf') { ctx.save(); ctx.translate(particle.x, particle.y); ctx.rotate(particle.age / 80); box(-3, -1, 6, 3, particle.color); ctx.restore(); }
      else if (particle.kind === 'dust') { ctx.beginPath(); ctx.arc(particle.x, particle.y, 2 + particle.age / particle.life * 3, 0, Math.PI * 2); ctx.fillStyle = particle.color; ctx.fill(); }
      else box(particle.x, particle.y, particle.kind === 'smoke' ? 8 : 4, particle.kind === 'smoke' ? 6 : 4, particle.color);
    }
    ctx.globalAlpha = 1;
    if (sleepStart) {
      const elapsed = now - sleepStart;
      const alpha = elapsed < 500 ? elapsed / 500 : elapsed < 900 ? 1 : 1 - (elapsed - 900) / 500;
      ctx.fillStyle = `rgba(17, 30, 68, ${Math.max(0, Math.min(0.72, alpha * 0.72))})`;
      ctx.fillRect(camera.x, camera.y, SCENE_WIDTH, SCENE_HEIGHT);
      if (elapsed >= 500 && elapsed < 1300) {
        for (let i = 0; i < 20; i++) {
          ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 270 + i * 2.3));
          box(camera.x + 15 + hash(i, 3, 91) * 735, camera.y + 8 + hash(i, 7, 92) * 450, 2, 2, '#fff4cf');
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function render() {
    document.getElementById('date').textContent = `${F.season(state)} · 第 ${F.seasonDay(state)} 天`;
    document.getElementById('season-dot').dataset.season = F.season(state);
    document.getElementById('weather').textContent = state.weather === 'rain' ? '☂ 雨天' : '☀ 晴天';
    document.getElementById('tomorrow').textContent = `明日 ${state.tomorrow === 'rain' ? '☂ 雨' : '☀ 晴'}`;
    const raidForecast = document.getElementById('raid-forecast');
    raidForecast.textContent = `今晚 ${state.nightRaid.level === 'large' ? '大入侵' : state.nightRaid.level === 'raid' ? '有动静' : '平静'}`;
    raidForecast.classList.toggle('danger', state.nightRaid.level === 'large');
    document.getElementById('build-panel').hidden = state.tool !== 'build';
    document.querySelector('[data-build="fence"]').textContent = state.fenceStock ? `木栅栏 · 库存 ${state.fenceStock}` : '木栅栏 · 40 G';
    document.querySelector('[data-build="scarecrow"]').textContent = state.scarecrowStock ? `稻草人 · 库存 ${state.scarecrowStock}` : '稻草人 · 150 G';
    document.getElementById('crafts').innerHTML = Object.entries(F.CRAFTS).map(([key, recipe]) => `<button type="button" data-craft="${key}">制作${recipe.name} · ${Object.entries(recipe.costs).map(([r, n]) => `${F.RESOURCES[r].name}×${n}`).join(' + ')} · 库存 ${state[recipe.stock]}</button>`).join('');
    const hasBandits = !!state.nightRaid.attackers?.includes('bandit');
    document.getElementById('watch').disabled = !hasBandits || !!battle;
    document.getElementById('home-watch').disabled = !hasBandits || !!battle;
    document.getElementById('go-home').classList.toggle('home-alert', state.health <= 30);
    document.getElementById('gold').textContent = `${Math.round(goldDisplay)} G`;
    document.getElementById('weapon-hud').textContent = `⚔ ${F.WEAPONS[state.weapon].name}`;
    document.getElementById('health-text').textContent = `${state.health} / ${F.HEALTH_MAX}`;
    document.getElementById('health-fill').style.width = `${state.health / F.HEALTH_MAX * 100}%`;
    const healthItem = document.getElementById('health-item');
    healthItem.dataset.health = state.health;
    healthItem.classList.toggle('low-health', state.health <= 30);
    document.getElementById('tools').innerHTML = keys.map((key, i) =>
      `<button type="button" class="tool ${state.tool === key ? 'active' : ''} ${toolBounce === key && performance.now() < bounceUntil ? 'bump' : ''}" data-tool="${key}" aria-pressed="${state.tool === key}"><span class="tool-name">${F.TOOLS[key].name}</span><span class="tool-icon">${icons[key]}</span><span>${F.TOOLS[key].name}</span><small>${i + 1}</small></button>`
    ).join('');
    document.getElementById('crop-options').innerHTML = '<span>播种：</span>' + Object.entries(F.CROPS).map(([key, crop]) =>
      `<button type="button" class="crop-choice ${state.selectedCrop === key ? 'active' : ''}" data-crop="${key}" aria-pressed="${state.selectedCrop === key}">${crop.name} × ${state.seeds[key]}${state.seeds[key] ? '' : '<span class="buy-badge">去买</span>'}</button>`
    ).join('');
    document.getElementById('bag').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="bag-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}</span><span>× ${state.bag[key]} · ${crop.sellPrice} G/份 · 小计 ${state.bag[key] * crop.sellPrice} G</span><button type="button" data-eat="${key}">吃 +${F.FOOD_HEAL[key]}</button><button type="button" data-sell-one="${key}">卖 1</button><button type="button" data-sell-crop="${key}">卖全部</button></div>`
    ).join('') + '<h3>野外资源</h3>' + Object.entries(F.RESOURCES).map(([key, resource]) => `<div class="bag-row"><span>${resource.name}</span><span>× ${state.resources[key]} · ${resource.sellPrice} G/份</span>${F.FOOD_HEAL[key] ? `<button type="button" data-eat="${key}">吃 +${F.FOOD_HEAL[key]}</button>` : ''}<button type="button" data-resource-one="${key}">卖 1</button><button type="button" data-resource-all="${key}">卖全部</button></div>`).join('') + `<div class="bag-row"><span>饭团 × ${state.snacks}</span><button type="button" data-eat="snack">吃 +20</button></div><div class="bag-row"><span>木栅栏库存 × ${state.fenceStock}</span></div><div class="bag-row"><span>稻草人库存 × ${state.scarecrowStock}</span></div>`;
    document.getElementById('shop').innerHTML = Object.entries(F.CROPS).map(([key, crop]) => {
      const total = crop.seedPrice * buyAmounts[key];
      return `<div class="shop-row" data-shop-row="${key}"><i class="crop-dot" style="background:${cropColors[key]}"></i><span class="row-copy"><strong>${crop.name}种子</strong><small>${crop.days} 天成熟 · 已有 ${state.seeds[key]}</small></span><span class="quantity-control"><button type="button" data-buy-step="${key}" data-delta="-1">−</button><b>${buyAmounts[key]}</b><button type="button" data-buy-step="${key}" data-delta="1">+</button><button type="button" data-buy-five="${key}">×5</button></span><span class="row-price ${state.gold < total ? 'unaffordable' : ''}">${total} G</span><button type="button" data-buy="${key}" class="${state.gold < total ? 'cant-afford' : ''}" aria-disabled="${state.gold < total}">购买</button></div>`;
    }).join('') + `<div id="weapon-shop"><strong>武器 · 高档替换低档，旧武器不退款</strong><p>当前：${F.WEAPONS[state.weapon].name}</p>${Object.entries(F.WEAPONS).filter(([key]) => key !== 'none').map(([key, weapon]) => `<div class="shop-row"><span class="row-copy"><strong>${weapon.name}</strong><small>每击 ${weapon.damage} 点伤害</small></span><span class="row-price">${weapon.price} G</span><button type="button" data-weapon="${key}" ${weapon.damage <= F.WEAPONS[state.weapon].damage ? 'disabled' : ''}>购买</button></div>`).join('')}</div><div class="shop-row"><span class="row-icon" aria-hidden="true">▣</span><span class="row-copy"><strong>饭团</strong><small>恢复 20 生命</small></span><span class="row-price ${state.gold < 20 ? 'unaffordable' : ''}">20 G</span><button type="button" data-snack="buy" class="${state.gold < 20 ? 'cant-afford' : ''}" aria-disabled="${state.gold < 20}">购买</button></div>`;
    document.getElementById('bag-value').textContent = `背包总价值（作物+资源）：${Object.entries(F.CROPS).reduce((sum, [key, crop]) => sum + state.bag[key] * crop.sellPrice, 0) + Object.entries(F.RESOURCES).reduce((sum, [key, resource]) => sum + state.resources[key] * resource.sellPrice, 0)} G`;
    document.getElementById('log').innerHTML = journal.map(item => `<li>${item}</li>`).join('');
    document.getElementById('orders-list').innerHTML = state.orders.length ? state.orders.map(order => `<div class="order-row"><span>${F.CROPS[order.crop].name} × ${order.amount} · 第 ${order.deadline} 天前<br>奖励 ${order.reward} G · 背包 ${state.bag[order.crop]}</span><button type="button" ${order.accepted === false ? `data-accept="${order.id}">接单` : `data-deliver="${order.id}">交付`}</button></div>`).join('') : '<p>今日没有订单，睡觉后刷新。</p>';
    document.getElementById('stats-list').innerHTML = `<p>累计收入：${state.stats.income} G</p><p>累计收获：${state.stats.harvested}</p><p>累计采集：${state.stats.gathered}</p><p>累计钓鱼：${state.stats.fished}</p><p>累计制作：${state.stats.crafted}</p><p>完成订单：${state.stats.orders}</p><p>击退强盗：${state.stats.repelled}</p><p>已玩天数：${state.stats.days}</p>`;
    if (speakingTo) refreshVillager();
    drawScene(performance.now());
    updateOverlays(performance.now());
  }

  function frame(now) {
    const dt = Math.min(50, now - (lastFrame || now));
    lastFrame = now;
    tickInput(now);
    if (!battle && !state.gameOver) for (const [id, person] of Object.entries(villagers)) {
      if (now < person.next) continue;
      const points = F.VILLAGERS[id].points;
      if (person.x === points[person.goal][0] && person.y === points[person.goal][1]) person.goal = Math.floor(Math.random() * points.length);
      const path = F.findPath(state, points[person.goal][0], points[person.goal][1], person, false);
      if (path?.length) { person.x += F.DIRECTIONS[path[0]][0]; person.y += F.DIRECTIONS[path[0]][1]; }
      person.next = now + 900 + Math.random() * 900;
    }
    if (battle) {
      const before = state.health;
      const outcome = F.watchTick(state, battle, now);
      if (state.health !== before) handle(outcome, true);
      if (state.gameOver) showGameOver();
      if (battle?.success) {
        battle = null;
        document.body.classList.remove('watch-mode');
        const result = F.sleep(state, Math.random, true);
        handle(result, true);
        enqueueToast('守夜成功，今晚零损失', 'success');
      }
    }
    if (route.length && !input.direction && now >= routeNext) {
      move(route.shift());
      routeNext = now + 140;
      if (!route.length) {
        if (homeRoute) { homeRoute = false; document.getElementById('home-confirm').hidden = false; handle({ ok: true, message: '已到家门口，今晚睡觉吗？', events: [] }, false); }
        else handle({ ok: true, message: '已走到目标地块旁', events: [] }, false);
      }
    }
    for (const particle of particles) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.kind === 'snow') particle.x += Math.sin(now / 240 + particle.y) * 0.4;
      if (particle.kind === 'rain' && particle.y > WORLD_HEIGHT - 24) { particle.age = particle.life; addParticle(particle.x, WORLD_HEIGHT - 23, 0, 0, 120, '#d8efec', 'splash'); }
      if (particle.kind === 'snow' && particle.y > WORLD_HEIGHT - 24) particle.age = particle.life;
    }
    particles = particles.filter(particle => particle.age < particle.life);
    if (now - lastSmoke > 350) {
      addParticle(F.LAYOUT.home.x * TILE + 12, F.LAYOUT.home.y * TILE + 8, 0.025, -0.06, 850, '#f7f4e590', 'smoke');
      lastSmoke = now;
    }
    if ((state.weather === 'rain' || F.season(state) === '冬') && now - lastRain > 35) {
      const snow = F.season(state) === '冬';
      for (let i = 0; i < 2; i++) addParticle((now * 3 + i * 251) % WORLD_WIDTH, -10 - i * 120, snow ? 0 : -0.25, snow ? 0.14 : 0.85, snow ? 4500 : 850, snow ? '#f5f8edc9' : '#b7e5e8a0', snow ? 'snow' : 'rain');
      lastRain = now;
    }
    if (now - lastSpark >= 900) {
      const mature = [];
      for (let y = 0; y < F.HEIGHT; y++) for (let x = 0; x < F.WIDTH; x++) {
        const crop = state.plots[y][x].crop;
        if (crop && crop.progress >= F.CROPS[crop.type].days) mature.push([x, y]);
      }
      if (mature.length) {
        const [x, y] = mature[Math.floor(hash(now, mature.length, 96) * mature.length)];
        addParticle(FIELD_X + x * TILE + 13 + hash(now, x, 97) * 22, FIELD_Y + y * TILE + 8, 0, -0.012, 420, '#fff1ad', 'star');
      }
      lastSpark = now;
    }
    if (sleepPending && now - sleepStart >= 500) {
      sleepPending = false;
      const previousWeather = state.weather;
      const outcome = F.sleep(state);
      seasonAfterSleep = F.seasonDay(state) === 1;
      if (state.weather !== previousWeather) enqueueToast(state.weather === 'rain' ? '天气转雨，作物生长加速' : '雨停转晴，作物照常生长', 'info');
      if (state.weather === 'rain') sound('rain');
      enqueueToast(`昨夜损失 ${outcome.raid.lost} 格作物、${outcome.raid.items} 份食物、${outcome.raid.gold} G；反击 ${outcome.raid.repelled} 次`, outcome.raid.lost || outcome.raid.items || outcome.raid.gold ? 'alert' : 'info');
      handle(outcome, true);
    }
    if (sleepStart && now - sleepStart >= 1400) { sleepStart = 0; if (seasonAfterSleep) { showSeasonBanner(); seasonAfterSleep = false; } }
    if (goldStart) {
      const t = Math.min(1, (now - goldStart) / 300);
      goldDisplay = Math.round(goldFrom + (state.gold - goldFrom) * (1 - Math.pow(1 - t, 3)));
      document.getElementById('gold').textContent = `${goldDisplay} G`;
      if (t === 1) goldStart = 0;
    }
    const gold = document.getElementById('gold');
    gold.style.transform = now < goldUntil ? `scale(${1 + 0.25 * Math.sin((goldUntil - now) / 500 * Math.PI)})` : '';
    drawScene(now);
    updateOverlays(now);
    if (!document.hidden) requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { lastFrame = 0; requestAnimationFrame(frame); }
  });

  function selectTool(key) {
    initAudio();
    if (key !== 'build') buildChoice = null;
    const outcome = F.selectTool(state, key);
    if (outcome.ok) { toolBounce = key; bounceUntil = performance.now() + 800; }
    handle(outcome, true);
  }

  function openCodex() {
    panelCloseToken++;
    document.getElementById('codex-panel').classList.remove('closing');
    const list = document.getElementById('codex-list');
    const sorted = Object.entries(F.CROPS).sort((a, b) => b[1].sellPrice / b[1].seedPrice - a[1].sellPrice / a[1].seedPrice);
    list.innerHTML = sorted.map(([key, crop]) => `<div class="codex-row"><canvas width="48" height="48" data-preview="${key}"></canvas><div><strong>${crop.name}</strong>${crop.days} 天（雨天加速） · 种子 ${crop.seedPrice} G · 售价 ${crop.sellPrice} G · 每 G 投入回收 ${(crop.sellPrice / crop.seedPrice).toFixed(2)} G</div></div>`).join('');
    list.innerHTML += '<h3>武器与守夜</h3><p>木棍每击 1 点、石斧 2 点、铁剑 3 点。高档武器直接替换低档，不退款；睡觉时还会自动反击强盗。乌鸦偷成熟作物，稻草人能防；强盗先抢背包、再抢钱、最后毁作物，稻草人对强盗无效。</p>';
    for (const preview of list.querySelectorAll('canvas')) {
      const context = preview.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#8a6249';
      context.fillRect(0, 0, 48, 48);
      drawCrop(context, { type: preview.dataset.preview, progress: F.CROPS[preview.dataset.preview].days }, 0, 0, 0);
    }
    document.getElementById('codex-panel').hidden = false;
    document.getElementById('orders-panel').hidden = true;
    document.getElementById('villager-panel').hidden = true; speakingTo = null;
    document.body.classList.add('modal-open');
    document.getElementById('close-codex').focus?.();
  }

  function refreshVillager() {
    if (!speakingTo) return;
    const id = speakingTo;
    const content = document.getElementById('villager-content');
    content.innerHTML = id === 'mayor' ? document.getElementById('orders-list').innerHTML : id === 'hunter' ? document.getElementById('weapon-shop')?.outerHTML || '' : document.getElementById('shop').innerHTML;
    const person = state.villagers[id];
    document.getElementById('villager-gifts').innerHTML = `<p>好感 ♥ ${person.hearts}/5${person.giftedDay === state.day ? ' · 今日已送礼' : ''}</p>` + Object.entries(F.CROPS).filter(([key]) => state.bag[key] > 0).map(([key, crop]) => `<button type="button" data-gift="${key}" ${person.giftedDay === state.day ? 'disabled' : ''}>送${crop.name} ×1</button>`).join('') + ['fish', 'berry'].filter(key => state.resources[key] > 0).map(key => `<button type="button" data-gift="${key}" ${person.giftedDay === state.day ? 'disabled' : ''}>送${F.RESOURCES[key].name} ×1</button>`).join('');
  }

  function openVillager(id) {
    input.use = false; input.direction = null;
    speakingTo = id;
    panelCloseToken++;
    const panel = document.getElementById('villager-panel');
    panel.hidden = false; panel.classList.remove('closing');
    document.getElementById('codex-panel').hidden = true;
    document.getElementById('orders-panel').hidden = true;
    document.getElementById('villager-title').textContent = `${F.VILLAGERS[id].name} · ${id === 'mayor' ? '看看今日订单' : id === 'merchant' ? '来挑点东西' : '今晚要当心'}`;
    document.getElementById('villager-line').textContent = F.villagerLine(state, id, talkTurns[id]++);
    document.body.classList.add('modal-open');
    refreshVillager();
  }

  function closePanels() {
    const token = ++panelCloseToken;
    const panels = ['codex-panel', 'orders-panel', 'villager-panel'].map(id => document.getElementById(id)).filter(panel => !panel.hidden);
    const opener = panels[0]?.id === 'codex-panel' ? 'codex' : 'orders-button';
    for (const panel of panels) panel.classList.add('closing');
    setTimeout(() => {
      if (token !== panelCloseToken) return;
      for (const panel of panels) { panel.hidden = true; panel.classList.remove('closing'); }
      speakingTo = null;
      if (panels.length) document.getElementById(opener).focus?.();
    }, 160);
    document.body.classList.remove('modal-open');
  }

  const directionKeys = { w: 'up', ArrowUp: 'up', s: 'down', ArrowDown: 'down', a: 'left', ArrowLeft: 'left', d: 'right', ArrowRight: 'right' };
  function eat(food) { if (state.gameOver) return; const outcome = food ? F.eatFood(state, food) : F.quickEat(state); if (!outcome.ok) sound('error'); handle(outcome, true); enqueueToast(outcome.message, outcome.ok ? 'success' : 'alert'); }
  document.addEventListener('keydown', event => {
    if (state.gameOver) return;
    if (!document.getElementById('codex-panel').hidden || !document.getElementById('orders-panel').hidden || !document.getElementById('villager-panel').hidden) {
      if (event.key === 'Escape') closePanels();
      return;
    }
    const direction = directionKeys[event.key];
    if (direction) { event.preventDefault(); pressDirection(direction, `key:${event.key}`); return; }
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); goHome(); return; }
    if (event.key.toLowerCase() === 'q') { event.preventDefault(); eat(); return; }
    if (event.key >= '1' && event.key <= '6') { selectTool(keys[Number(event.key) - 1]); return; }
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
  window.addEventListener('blur', () => { input.direction = null; input.use = false; route = []; homeRoute = false; });
  document.getElementById('tools').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (button) selectTool(button.dataset.tool);
  });
  document.getElementById('build-panel').addEventListener('click', event => {
    const craft = event.target.closest('[data-craft]');
    if (craft) {
      const outcome = F.craft(state, craft.dataset.craft);
      if (outcome.ok) addParticle(state.farmer.x * TILE + 24, state.farmer.y * TILE + 3, 0, -0.025, 520, WORLD_COLORS.star, 'star');
      handle(outcome, true); return;
    }
    const button = event.target.closest('[data-build]');
    if (button) { buildChoice = button.dataset.build; handle({ ok: true, message: `准备放置${F.BUILDINGS[buildChoice].name}`, events: [] }, false); }
  });
  document.getElementById('crop-options').addEventListener('click', event => {
    const button = event.target.closest('[data-crop]');
    if (button) { initAudio(); handle(F.selectCrop(state, button.dataset.crop), true); if (!state.seeds[button.dataset.crop]) { const row = document.querySelector(`[data-shop-row="${button.dataset.crop}"]`); row?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); row?.classList.add('shop-highlight'); enqueueToast('种子用完了，去商店补货', 'info'); } }
  });
  document.getElementById('shop').addEventListener('click', event => {
    const step = event.target.closest('[data-buy-step]');
    if (step) { buyAmounts[step.dataset.buyStep] = Math.max(1, buyAmounts[step.dataset.buyStep] + Number(step.dataset.delta)); render(); return; }
    const five = event.target.closest('[data-buy-five]');
    if (five) { buyAmounts[five.dataset.buyFive] += 5; render(); return; }
    const button = event.target.closest('[data-buy]');
    if (button) { initAudio(); const price = F.CROPS[button.dataset.buy].seedPrice * buyAmounts[button.dataset.buy]; const outcome = F.buySeed(state, button.dataset.buy, buyAmounts[button.dataset.buy]); if (!outcome.ok) { outcome.message = `金币不足，还差 ${price - state.gold} G`; sound('error'); } handle(outcome, true); }
    const weapon = event.target.closest('[data-weapon]');
    if (weapon) { const outcome = F.buyWeapon(state, weapon.dataset.weapon); if (!outcome.ok) sound('error'); handle(outcome, true); }
    if (event.target.closest('[data-snack]')) { const outcome = F.buySnack(state); if (!outcome.ok) { outcome.message = `金币不足，还差 ${20 - state.gold} G`; sound('error'); } handle(outcome, true); }
  });
  document.getElementById('bag').addEventListener('click', event => {
    const resourceOne = event.target.closest('[data-resource-one]');
    const resourceAll = event.target.closest('[data-resource-all]');
    if (resourceOne || resourceAll) {
      const button = resourceOne || resourceAll; const key = resourceOne ? button.dataset.resourceOne : button.dataset.resourceAll;
      handle(F.sellResource(state, key, resourceOne ? 1 : state.resources[key]), true); return;
    }
    const one = event.target.closest('[data-sell-one]');
    const all = event.target.closest('[data-sell-crop]');
    if (one || all) {
      const key = (one || all).dataset[one ? 'sellOne' : 'sellCrop'];
      const outcome = F.sellCrop(state, key, one ? 1 : state.bag[key]);
      if (outcome.warning && !orderWarningShown) { enqueueToast('卖出后不足当前订单所需数量', 'alert'); orderWarningShown = true; }
      handle(outcome, true); return;
    }
    const food = event.target.closest('[data-eat]');
    if (food) eat(food.dataset.eat);
  });
  document.getElementById('quick-eat').addEventListener('click', () => eat());
  document.getElementById('sell-all').addEventListener('click', () => {
    const preview = F.salePreview(state);
    if (!preview.count) { enqueueToast('背包里没有可卖的富余作物', 'alert'); return; }
    document.getElementById('sell-confirm-text').textContent = `一键卖出 ${preview.count} 份，共 ${preview.total} G；默认保留当前订单所需数量。`;
    document.getElementById('sell-confirm').hidden = false;
  });
  document.getElementById('sell-confirm-yes').addEventListener('click', () => {
    const outcome = F.sellAll(state);
    document.getElementById('sell-confirm').hidden = true;
    if (outcome.ok) { goldUntil = performance.now() + 500; sound('sell'); }
    handle(outcome, true);
  });
  document.getElementById('sell-confirm-no').addEventListener('click', () => { document.getElementById('sell-confirm').hidden = true; });
  function goHome() {
    if (homeRoute) { route = []; homeRoute = false; enqueueToast('已取消回家', 'info'); return; }
    input.direction = null;
    input.use = false;
    document.getElementById('home-confirm').hidden = true;
    const path = F.findPath(state, F.LAYOUT.home.x, F.LAYOUT.home.y);
    if (!path) { enqueueToast('家门口暂时无法到达', 'alert'); return; }
    if (!path.length) { document.getElementById('home-confirm').hidden = false; return; }
    route = path;
    homeRoute = true;
    routeNext = performance.now();
    enqueueToast('正在回家，按方向键可取消', 'info');
  }
  document.getElementById('go-home').addEventListener('click', goHome);
  document.getElementById('home-sleep').addEventListener('click', () => { document.getElementById('home-confirm').hidden = true; if (!sleepStart) { sleepStart = performance.now(); sleepPending = true; } });
  function beginWatch() {
    if (battle || sleepStart || state.gameOver) return;
    battle = F.startWatch(state, performance.now());
    if (!battle) { enqueueToast('今晚平静，去睡吧', 'info'); return; }
    document.getElementById('home-confirm').hidden = true;
    route = []; homeRoute = false;
    document.body.classList.add('watch-mode');
    enqueueToast('守夜开始，面对强盗按使用键攻击', 'info');
    render();
  }
  document.getElementById('watch').addEventListener('click', beginWatch);
  document.getElementById('home-watch').addEventListener('click', beginWatch);
  document.getElementById('home-cancel').addEventListener('click', () => { document.getElementById('home-confirm').hidden = true; });
  document.getElementById('sleep').addEventListener('click', () => {
    initAudio();
    if (battle || state.gameOver) return;
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
    const { x, y } = F.screenToCell(event.clientX, event.clientY, rect, camera, SCENE_WIDTH, SCENE_HEIGHT, TILE);
    if (x < 0 || x >= F.WIDTH || y < 0 || y >= F.HEIGHT) return;
    input.direction = null;
    route = [];
    homeRoute = false;
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
  document.getElementById('orders-button').addEventListener('click', () => { initAudio(); panelCloseToken++; document.getElementById('orders-panel').classList.remove('closing'); document.getElementById('orders-panel').hidden = false; document.getElementById('codex-panel').hidden = true; document.body.classList.add('modal-open'); document.getElementById('close-orders').focus?.(); });
  document.getElementById('orders-list').addEventListener('click', event => {
    const accept = event.target.closest('[data-accept]');
    if (accept) { handle(F.acceptOrder(state, Number(accept.dataset.accept)), true); return; }
    const button = event.target.closest('[data-deliver]');
    if (button) { const outcome = F.deliverOrder(state, Number(button.dataset.deliver)); if (!outcome.ok) sound('error'); else sound('sell'); handle(outcome, true); }
  });
  document.getElementById('close-codex').addEventListener('click', closePanels);
  document.getElementById('close-orders').addEventListener('click', closePanels);
  document.getElementById('close-villager').addEventListener('click', closePanels);
  document.getElementById('villager-panel').addEventListener('click', event => { if (event.target.id === 'villager-panel') closePanels(); });
  document.getElementById('villager-gifts').addEventListener('click', event => {
    const gift = event.target.closest('[data-gift]');
    if (!gift || !speakingTo) return;
    const outcome = F.giftVillager(state, speakingTo, gift.dataset.gift);
    handle(outcome, true);
    if (outcome.ok) enqueueToast(outcome.events.at(-1), 'success');
  });
  document.getElementById('villager-content').addEventListener('click', event => {
    const accept = event.target.closest('[data-accept]');
    if (accept) { handle(F.acceptOrder(state, Number(accept.dataset.accept)), true); return; }
    const deliver = event.target.closest('[data-deliver]');
    if (deliver) { handle(F.deliverOrder(state, Number(deliver.dataset.deliver)), true); return; }
    const weapon = event.target.closest('[data-weapon]');
    if (weapon) { handle(F.buyWeapon(state, weapon.dataset.weapon), true); return; }
    const step = event.target.closest('[data-buy-step]');
    if (step) { buyAmounts[step.dataset.buyStep] = Math.max(1, buyAmounts[step.dataset.buyStep] + Number(step.dataset.delta)); render(); return; }
    const five = event.target.closest('[data-buy-five]');
    if (five) { buyAmounts[five.dataset.buyFive] += 5; render(); return; }
    const seed = event.target.closest('[data-buy]');
    if (seed) { handle(F.buySeed(state, seed.dataset.buy, buyAmounts[seed.dataset.buy]), true); return; }
    if (event.target.closest('[data-snack]')) handle(F.buySnack(state), true);
  });
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
    seasonAfterSleep = false;
    particles = [];
    route = [];
    homeRoute = false;
    input.direction = null;
    input.use = false;
    state = F.createGame();
    document.getElementById('game-over').hidden = true;
    goldDisplay = state.gold;
    goldStart = 0;
    journal = ['新的农场生活开始了！'];
    orderWarningShown = false;
    lowHealthNotified = false;
    showSeasonBanner();
    handle({ ok: true, message: '新游戏已开始', events: [] }, true);
  });
  document.getElementById('restart').addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* 存储不可用 */ }
    state = F.createGame(); battle = null; sleepStart = 0; sleepPending = false;
    goldDisplay = state.gold; goldStart = 0; journal = ['新的农场生活开始了！'];
    document.getElementById('game-over').hidden = true;
    handle({ ok: true, message: '重新开始', events: [] }, true);
  });
  document.getElementById('hint').textContent = '用 WASD 或方向键移动；面向地块，按空格或回车使用当前工具。';
  updateMute();
  for (const message of migrationMessages) enqueueToast(message, 'info');
  if (migrationMessages.length) save();
  if (F.seasonDay(state) === 1) showSeasonBanner();
  render();
  if (state.gameOver) showGameOver();
  requestAnimationFrame(frame);
})();
