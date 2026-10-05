(function () {
  'use strict';

  const F = globalThis.PocketFarm;
  const SAVE_KEY = 'pocket-farm-save-v1';
  const TILE = 48;
  const RENDER_SCALE = 2;
  const SCENE_WIDTH = 768;
  const SCENE_HEIGHT = 576;
  const FIELD_X = 96;
  const FIELD_Y = 96;
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
    canvas.width = staticCanvas.width = width;
    canvas.height = staticCanvas.height = height;
    sceneContext.scale(width / SCENE_WIDTH, height / SCENE_HEIGHT);
    staticContext.scale(width / SCENE_WIDTH, height / SCENE_HEIGHT);
    sceneContext.imageSmoothingEnabled = true;
    staticContext.imageSmoothingEnabled = true;
    staticKey = '';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const palette = {
    '春': { grass: '#8eb76b', grassDark: '#75a05d', light: '#b9ce80', sky: '#d7e4b2' },
    '夏': { grass: '#74ad63', grassDark: '#5d9857', light: '#a8c66a', sky: '#c5dfad' },
    '秋': { grass: '#b2aa67', grassDark: '#969658', light: '#d1bf77', sky: '#e7d4aa' },
    '冬': { grass: '#aac1b8', grassDark: '#8aada8', light: '#d8dfd0', sky: '#dfe9e1' }
  };
  const cropColors = { carrot: '#ef9252', potato: '#d5b481', pumpkin: '#e5a44b', strawberry: '#df514f', corn: '#f4c851' };
  const icons = { hoe: '⚒', seed: '✿', water: '◆', scythe: '☷' };
  const UI_COLORS = { focus: '#a96d21', danger: '#a3372b' };
  const keys = ['hoe', 'seed', 'water', 'scythe'];
  let state = load() || F.createGame();
  let journal = ['欢迎来到口袋田园！先开垦一块地吧。'];
  let particles = [];
  let lastFrame = 0;
  let walkingUntil = 0;
  let swingUntil = 0;
  let sleepStart = 0;
  let sleepPending = false;
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
  let waterArc = null;
  let audio = null;
  let muted = false;
  let shake = null;
  let route = [];
  let routeNext = 0;
  let lowEnergyNotified = false;
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
    const previousEnergy = Number(document.getElementById('energy-item').dataset.energy || F.ENERGY_MAX);
    if (state.gold !== goldDisplay && !goldStart) { goldFrom = goldDisplay; goldStart = performance.now(); }
    document.getElementById('hint').textContent = outcome.message;
    document.getElementById('hint').classList.toggle('error', !outcome.ok);
    if (outcome.ok && changed) {
      for (const item of outcome.events.slice().reverse()) journal.unshift(item);
      journal = journal.slice(0, 8);
      if (state.tutorial < 3 && outcome.tool === ['hoe', 'seed', 'water'][state.tutorial]) {
        state.tutorial++;
        if (state.tutorial === 3) tutorialDoneUntil = performance.now() + 1600;
      }
      save();
    }
    if (!outcome.ok && /金币|体力|种子|未解锁|锁住/.test(outcome.message)) enqueueToast(outcome.message, 'alert');
    if (outcome.ok && /购买|升级|卖出|交付/.test(outcome.message)) enqueueToast(outcome.message, 'success');
    for (const item of outcome.events || []) if (item !== outcome.message && /订单|过期/.test(item)) enqueueToast(item, 'info');
    if (state.energy <= F.ENERGY_MAX / 4 && previousEnergy > F.ENERGY_MAX / 4 && !lowEnergyNotified) {
      enqueueToast('体力快用完了，吃点东西或睡觉吧', 'alert');
      lowEnergyNotified = true;
    }
    if (state.energy > F.ENERGY_MAX / 4) lowEnergyNotified = false;
    render();
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
    const steps = ['① 选中锄头，锄一块地', '② 种下任意种子', '③ 给它浇水'];
    bubble.hidden = state.tutorial >= 3 && now >= tutorialDoneUntil;
    bubble.textContent = state.tutorial >= 3 ? '祝丰收！' : steps[state.tutorial];
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
    if (kind === 'water') tone(700, 0.23, 'triangle', 0, 260);
    if (kind === 'scythe') { tone(440, 0.09, 'sine'); tone(660, 0.13, 'sine', 0.09); }
    if (kind === 'sell') { tone(740, 0.12, 'sine'); tone(1100, 0.2, 'sine', 0.11); }
    if (kind === 'error') tone(150, 0.19, 'sawtooth', 0, 110);
    if (kind === 'rain') tone(600, 0.18, 'triangle', 0, 340);
  }

  function addParticle(x, y, vx, vy, life, color, kind) {
    if (particles.length >= 300) particles.shift();
    particles.push({ x, y, vx, vy, life, age: 0, color, kind });
  }

  function action() {
    initAudio();
    const target = F.frontCell(state);
    const tool = state.tool;
    const harvested = state.plots[target.y]?.[target.x]?.crop?.type;
    const outcome = F.act(state, true);
    if (!outcome.ok && !outcome.message.includes('种子') && state.plots[target.y]?.[target.x]?.tilled && !state.plots[target.y]?.[target.x]?.crop && !state.seeds[state.selectedCrop]) enqueueToast('没有种子了，去商店购买', 'alert');
    if (!outcome.ok && outcome.message.includes('体力不足')) input.use = false;
    sound(outcome.ok ? outcome.tool : 'error');
    if (!outcome.ok && target.x >= 0 && target.x < F.WIDTH && target.y >= 0 && target.y < F.HEIGHT) shake = { x: target.x, y: target.y, until: performance.now() + 150 };
    if (outcome.ok) {
      swingUntil = performance.now() + 200;
      swingTool = outcome.tool;
      const x = FIELD_X + target.x * TILE + 24;
      const y = FIELD_Y + target.y * TILE + 20;
      if (outcome.tool === 'water') {
        waterArc = { x: FIELD_X + state.farmer.x * TILE + 24, y: FIELD_Y + state.farmer.y * TILE + 18, toX: x, toY: y, until: performance.now() + 200 };
      }
      if (outcome.tool === 'scythe') {
        addParticle(x, y, 0, -0.055, 600, '#fff5c2', 'text');
        addParticle(x, y, 0, 0, 530, cropColors[harvested] || '#e8c373', 'harvest');
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
    ctx.ellipse(Math.round(x + 3), Math.round(y + 3), rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#293c3655';
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
    const ground = ctx.createLinearGradient(0, 76, 0, SCENE_HEIGHT);
    ground.addColorStop(0, p.light);
    ground.addColorStop(0.4, p.grass);
    ground.addColorStop(1, p.grassDark);
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, 75);
    sky.addColorStop(0, '#f2f1d3');
    sky.addColorStop(1, p.sky);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, SCENE_WIDTH, 67);
    box(0, 67, 768, 9, p.light);
    box(0, 76, 768, 5, p.grassDark);
    label(`POCKET FARM  /  ${F.season(state)}之田`, 27, 38, '#53754f', 18);
    label(`DAY ${String(state.day).padStart(2, '0')}`, 654, 38, '#53754f', 16);
    for (let y = 82; y < 575; y += 6) {
      for (let x = 0; x < 768; x += 6) {
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
        for (let i = 0; i < 14; i++) {
          const gx = px + 3 + Math.floor(hash(x, y, 20 + i) * 42);
          const gy = py + 3 + Math.floor(hash(x, y, 30 + i) * 40);
          ctx.fillStyle = i % 2 ? '#ffffff26' : '#355f3d35';
          ctx.fillRect(gx + 0.5 * (i % 2), gy, 1, 1);
        }
        for (let i = 0; i < 4; i++) {
          const gx = px + 7 + Math.floor(hash(x, y, 40 + i) * 34);
          const gy = py + 12 + Math.floor(hash(x, y, 50 + i) * 30);
          pixelLine(gx, gy + 4, gx - 2.5, gy, p.grassDark);
          pixelLine(gx + 1.5, gy + 4, gx + 3.5, gy + 0.5, p.light);
        }
        if (hash(x, y, 61) > 0.75) { box(px + 35, py + 32, 4, 3, '#d2c5a0'); box(px + 35, py + 32, 2, 1, '#f1e9c5'); }
        if (hash(x, y, 62) > 0.82) box(px + 17, py + 12, 3, 2, '#f5b4bd');
        box(px, py, TILE, 1, '#ffffff0a');
        box(px, py, 1, TILE, '#ffffff0a');
      }
    }
    // 固定坐标的花丛和从家门到田边的石板路。
    for (let x = 75; x < 105; x += 15) for (let y = 223; y < 270; y += 17) {
      const w = 9 + Math.floor(hash(x, y, 4) * 5), h = 6 + Math.floor(hash(x, y, 5) * 3);
      box(x, y, w, h, '#aa9672'); box(x + 1, y, w - 2, h - 1, '#d5c5a1');
      box(x + w, y + h - 2, 2, 3, p.grassDark);
    }
    for (let i = 0; i < 18; i++) {
      const x = 8 + Math.floor(hash(i, 31, 8) * 750), y = 91 + Math.floor(hash(i, 19, 9) * 470);
      if (x > 95 && x < 673 && y > 95 && y < 528) continue;
      box(x, y, 3, 3, i % 2 ? '#f7d7a2' : '#f5a6ad');
      box(x + 2, y + 3, 2, 3, '#50824f');
    }
  }

  function drawAmbient(now) {
    const p = palette[F.season(state)];
    for (let y = 0; y < F.HEIGHT; y++) for (let x = 0; x < F.WIDTH; x++) {
      const px = FIELD_X + x * TILE + 7 + Math.floor(hash(x, y, 40) * 34);
      const py = FIELD_Y + y * TILE + 12 + Math.floor(hash(x, y, 50) * 30);
      const sway = Math.sin(now / 680 + x * 1.7 + y * 2.3) * 1.5;
      pixelLine(px, py + 4, px - 2 + sway, py, p.grassDark, 0.5);
    }
    const cloudX = ((now % 8000) / 8000) * 950 - 150;
    ctx.fillStyle = '#3d5b5540';
    ctx.beginPath(); ctx.ellipse(cloudX, 285, 105, 27, -0.15, 0, Math.PI * 2); ctx.fill();
  }

  function drawTreeTrunk(x, y) {
    shadow(x + 21, y + 55, 22, 6);
    box(x + 15, y + 20, 9, 38, '#795d45');
    box(x + 17, y + 28, 2, 20, '#9d7650'); box(x + 22, y + 38, 2, 15, '#634735');
    box(x + 8, y + 26, 24, 4, '#795d45');
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
      box(x + 4 + sway, y + 8, 32, 28, dark);
      box(x + 11 + sway, y, 19, 40, dark);
      box(x + 8 + sway, y + 5, 19, 12, color);
      box(x + 17 + sway, y + 18, 19, 12, color);
      box(x + 4 + sway, y + 22, 14, 10, color);
    }
  }

  function drawPondBase() {
    box(12, 464, 73, 76, '#73997c');
    const water = ctx.createLinearGradient(18, 469, 80, 534);
    water.addColorStop(0, '#9dd6d0');
    water.addColorStop(1, '#5ca4b3');
    ctx.fillStyle = water;
    ctx.fillRect(18, 469, 62, 65);
    box(18, 470, 52, 2, '#e4d9ae'); box(19, 527, 56, 2, '#bfd8b9');
    pixelLine(19, 470.5, 71, 470.5, '#fff2d2', 1);
    pixelLine(19, 529.5, 75, 529.5, '#d5ecdf', 1);
  }

  function drawPondRipples(now) {
    const offset = Math.floor(now / 500) % 2 ? 4 : 0;
    box(27 + offset, 488, 19, 2, '#d0e9d9');
    box(48 - offset, 511, 17, 2, '#d0e9d9');
    for (let i = 0; i < 2; i++) {
      const age = (now + i * 600) % 1200 / 1200;
      ctx.globalAlpha = 1 - age;
      ctx.beginPath(); ctx.ellipse(48, 500, 3 + age * 23, 2 + age * 10, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#e7f4e4'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawHouse() {
    // 左侧小屋、窗与烟囱均用矩形绘制。
    box(9, 154, 74, 75, '#735849');
    box(14, 162, 65, 62, '#e5c78a');
    for (let i = 0; i < 9; i++) box(5 + i * 9, 150 - Math.min(i, 8 - i) * 7, 12, 7, '#895c48');
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
      const tx = 13 + i * 9 + (row % 2 ? 4 : 0), ty = 128 + row * 8;
      if (ty > 150 - Math.min(i + 1, 7 - i) * 6) continue;
      box(tx, ty, 7, 1, '#bd8863'); box(tx + 7, ty, 1, 5, '#6e493b');
    }
    box(14, 119, 15, 24, '#b17e5b');
    box(29, 180, 18, 18, '#ffe3a0');
    box(31, 182, 14, 14, '#ebc878');
    box(37, 180, 2, 18, '#f9e0a1');
    box(29, 188, 18, 2, '#f9e0a1');
    box(55, 189, 17, 35, '#856348');
    box(58, 191, 2, 29, '#ab8259');
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
    shadow(20, 419, 15, 4);
    box(18, 385, 2, 25, '#a6845b');
    box(8, 363, 28, 25, '#537f4e');
    box(15, 353, 22, 25, '#679658');
    box(1, 384, 28, 16, '#5a8a50');
    box(719, 455, 10, 35, '#705e46');
    shadow(724, 489, 20, 5);
    box(722, 459, 2, 24, '#9c7a54');
    box(701, 435, 45, 32, '#5d8a51');
    box(710, 422, 29, 31, '#70a15a');
    for (let x = 85; x < 680; x += 48) {
      shadow(x + 5, 90, 6, 3); shadow(x + 5, 552, 6, 3);
      box(x, 73, 5, 16, '#806c4a');
      box(x, 536, 5, 16, '#806c4a');
      box(x + 1, 74, 1, 12, '#ad8860'); box(x + 1, 538, 1, 10, '#ad8860');
      if (x < 660) { box(x, 78, 45, 3, '#b89765'); box(x, 542, 45, 3, '#b89765'); }
      if (x < 660) { box(x + 4, 79, 37, 1, '#d2b07c'); box(x + 4, 543, 37, 1, '#d2b07c'); }
    }
    for (let y = 91; y < 535; y += 48) {
      box(87, y, 5, 16, '#806c4a');
      box(677, y, 5, 16, '#806c4a');
      box(88, y + 1, 1, 13, '#ad8860'); box(678, y + 1, 1, 13, '#ad8860');
      box(89, y + 5, 3, 43, '#b89765');
      box(678, y + 5, 3, 43, '#b89765');
    }
    pixelLine(15, 224.5, 77, 224.5, '#fff0c7');
    pixelLine(686, 278.5, 755, 278.5, '#dfb980');
  }

  function drawPlot(plot, x, y) {
    if (!plot.tilled) return;
    const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
    box(px + 2, py + 4, 44, 41, plot.watered ? '#604a40' : '#8a6249');
    box(px + 4, py + 5, 39, 3, plot.watered ? '#755849' : '#a17855');
    box(px + 7, py + 14, 34, 2, plot.watered ? '#4e3e38' : '#76533f');
    box(px + 5, py + 29, 36, 2, plot.watered ? '#4e3e38' : '#76533f');
    box(px + 8, py + 16, 30, 1, plot.watered ? '#856a53' : '#bb8e65');
    box(px + 6, py + 31, 34, 1, plot.watered ? '#856a53' : '#bb8e65');
    if (plot.watered) {
      box(px + 34, py + 20, 5, 3, '#789da1');
      box(px + 10, py + 37, 4, 2, '#789da1');
      box(px + 22, py + 24, 6, 2, '#9ec9c2');
      box(px + 35, py + 20, 2, 1, '#c6dfd2');
      box(px + 11, py + 37, 2, 1, '#c6dfd2');
    } else {
      box(px + 11, py + 23, 3, 2, '#b78b64');
      box(px + 35, py + 35, 4, 2, '#b78b64');
      for (let i = 0; i < 4; i++) {
        const dx = 8 + Math.floor(hash(x, y, 70 + i) * 31), dy = 9 + Math.floor(hash(x, y, 80 + i) * 30);
        box(px + dx, py + dy, 4, 2, '#af805c'); box(px + dx, py + dy, 2, 1, '#c99b70');
      }
    }
    if (F.season(state) === '冬') {
      box(px + 2, py + 3, 43, 2, '#f3f5e9');
      box(px + 2, py + 3, 2, 41, '#e8f0e9');
    }
    pixelLine(px + 4.5, py + 7.5, px + 42.5, py + 7.5, plot.watered ? '#af9b7d' : '#d1aa7c');
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
      if (state.tool === 'water') { box(tx - 3, y + 27, 9, 7, '#6babb8'); box(tx + 5, y + 29, 5, 2, '#8ac9d0'); }
      if (state.tool === 'scythe') pixelLine(tx - 4, y + 21, tx + 6, y + 17, '#d8dfd2', 2);
      if (state.tool === 'seed') box(tx - 3, y + 29, 8, 6, '#d4ad65');
    } else {
      const phase = Math.min(2, Math.floor((200 - (swingUntil - now)) / 67));
      const side = facing === 'left' ? -1 : 1;
      const tx = (facing === 'left' ? x - 5 : facing === 'right' ? x + 37 : x + 31) + (swingTool === 'scythe' ? [-6, 8, 1][phase] * side : 0);
      const ty = y + [2, 17, 9][phase] + (swingTool === 'hoe' ? [-6, 4, 0][phase] : 0);
      if (swingTool === 'water') {
        box(tx - 5, ty + 6, 12, 9, '#6babb8'); box(tx - 3, ty + 8, 7, 3, '#9bd4d7');
        pixelLine(tx - 3, ty + 6, tx + 4, ty + 2, '#b7d4ce', 2);
        box(tx + side * 7, ty + (phase === 1 ? 13 : 9), 7, 3, '#8ac9d0');
      } else {
        pixelLine(tx, ty, tx + side * (swingTool === 'hoe' ? 7 : 4), ty + 18, '#8a6040', 3);
        if (swingTool === 'hoe') box(tx - 6, ty - 2, 15, 4, '#b5c1bd');
        else { pixelLine(tx - side * 7, ty + 2, tx + side * 6, ty - 5, '#d8dfd2', 2); box(tx - side * 7, ty + 2, 3, 3, '#bdc9c3'); }
      }
    }
  }

  function drawScene(now) {
    const key = `${F.season(state)}:${state.day}:${state.weather}`;
    if (key !== staticKey) {
      ctx = staticContext;
      ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
      drawBackground();
      drawHouse();
      drawPondBase();
      drawTreeTrunk(37, 274);
      drawTreeTrunk(685, 111);
      drawTreeTrunk(694, 380);
      ctx = sceneContext;
      staticKey = key;
    }
    ctx.drawImage(staticCanvas, 0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    drawAmbient(now);
    drawPondRipples(now);
    drawTreeCanopy(37, 274, now);
    drawTreeCanopy(685, 111, now);
    drawTreeCanopy(694, 380, now);
    for (let y = 0; y < F.HEIGHT; y++) {
      for (let x = 0; x < F.WIDTH; x++) drawPlot(state.plots[y][x], x, y);
    }
    const front = F.frontCell(state);
    if (front.x >= 0 && front.y >= 0 && front.x < F.WIDTH && front.y < F.HEIGHT) {
      const px = FIELD_X + front.x * TILE, py = FIELD_Y + front.y * TILE;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 350);
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
    if (waterArc && now < waterArc.until) {
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = waterArc.x + (waterArc.toX - waterArc.x) * t;
        const y = waterArc.y + (waterArc.toY - waterArc.y) * t - 16 * Math.sin(t * Math.PI);
        box(x, y, 2, 3, '#89dcea');
      }
    }
    for (const particle of particles) {
      ctx.globalAlpha = particle.kind === 'smoke' || particle.kind === 'star' || particle.kind === 'splash' ? Math.max(0, 1 - particle.age / particle.life) : 1;
      if (particle.kind === 'text') label('+1', particle.x - 9, particle.y, particle.color, 15);
      else if (particle.kind === 'harvest') {
        const t = particle.age / particle.life;
        const x = t < 0.22 ? particle.x : particle.x + (700 - particle.x) * ((t - 0.22) / 0.78);
        const y = t < 0.22 ? particle.y - 11 * Math.sin(t / 0.22 * Math.PI) : particle.y + (25 - particle.y) * ((t - 0.22) / 0.78) - 17 * Math.sin((t - 0.22) / 0.78 * Math.PI);
        const size = Math.max(1, 7 * (1 - t));
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * Math.PI * 4); box(-size / 2, -size / 2, size, size, particle.color); ctx.restore();
      } else if (particle.kind === 'star') {
        box(particle.x - 3, particle.y, 7, 1, particle.color);
        box(particle.x, particle.y - 3, 1, 7, particle.color);
      } else if (particle.kind === 'rain') {
        pixelLine(particle.x, particle.y, particle.x - 3, particle.y + 10, particle.color);
      } else if (particle.kind === 'snow') box(particle.x, particle.y, 3, 3, particle.color);
      else if (particle.kind === 'splash') { box(particle.x - 2, particle.y, 2, 2, particle.color); box(particle.x + 2, particle.y, 2, 2, particle.color); }
      else box(particle.x, particle.y, particle.kind === 'smoke' ? 8 : particle.kind === 'drop' ? 3 : 4, particle.kind === 'smoke' ? 6 : particle.kind === 'drop' ? 5 : 4, particle.color);
    }
    ctx.globalAlpha = 1;
    if (sleepStart) {
      const elapsed = now - sleepStart;
      const alpha = elapsed < 500 ? elapsed / 500 : elapsed < 900 ? 1 : 1 - (elapsed - 900) / 500;
      ctx.fillStyle = `rgba(17, 30, 68, ${Math.max(0, Math.min(0.72, alpha * 0.72))})`;
      ctx.fillRect(0, 0, 768, 576);
      if (elapsed >= 500 && elapsed < 1300) {
        for (let i = 0; i < 20; i++) {
          ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 270 + i * 2.3));
          box(15 + hash(i, 3, 91) * 735, 8 + hash(i, 7, 92) * 450, 2, 2, '#fff4cf');
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function render() {
    document.getElementById('date').textContent = `${F.season(state)} · 第 ${F.seasonDay(state)} 天`;
    document.getElementById('season-dot').dataset.season = F.season(state);
    document.getElementById('weather').textContent = state.weather === 'rain' ? '☂ 雨天' : '☀ 晴天';
    document.getElementById('tomorrow').textContent = `明日 ${state.tomorrow === 'rain' ? '☂ 雨' : '☀ 晴'}`;
    document.getElementById('gold').textContent = `${Math.round(goldDisplay)} G`;
    document.getElementById('energy-text').textContent = `${state.energy} / ${F.ENERGY_MAX}`;
    document.getElementById('energy-fill').style.width = `${state.energy / F.ENERGY_MAX * 100}%`;
    const energyItem = document.getElementById('energy-item');
    energyItem.dataset.energy = state.energy;
    energyItem.classList.toggle('low-energy', state.energy <= F.ENERGY_MAX / 4);
    document.getElementById('tools').innerHTML = keys.map((key, i) =>
      `<button type="button" class="tool ${state.tool === key ? 'active' : ''} ${toolBounce === key && performance.now() < bounceUntil ? 'bump' : ''}" data-tool="${key}" aria-pressed="${state.tool === key}"><span class="tool-name">${state.upgrades[key] ? (key === 'hoe' ? '精钢锄' : '铁水壶') : F.TOOLS[key].name}</span><span class="tool-icon">${icons[key]}${state.upgrades[key] ? '✦' : ''}</span><span>${F.TOOLS[key].name}</span><small>${i + 1}</small>${(key === 'hoe' || key === 'water') && !state.upgrades[key] ? `<span class="tool-lock" data-unlock="${key}" aria-label="前往商店升级${F.TOOLS[key].name}"></span>` : ''}</button>`
    ).join('');
    document.getElementById('crop-options').innerHTML = '<span>播种：</span>' + Object.entries(F.CROPS).map(([key, crop]) =>
      `<button type="button" class="crop-choice ${state.selectedCrop === key ? 'active' : ''}" data-crop="${key}" aria-pressed="${state.selectedCrop === key}">${crop.name} × ${state.seeds[key]}</button>`
    ).join('');
    document.getElementById('bag').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="bag-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}</span><strong>× ${state.bag[key]}</strong></div>`
    ).join('') + `<div class="bag-row"><span>饭团</span><button type="button" data-eat="snack">吃掉 × ${state.snacks}</button></div>`;
    document.getElementById('shop').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="shop-row"><i class="crop-dot" style="background:${cropColors[key]}"></i><span class="row-copy"><strong>${crop.name}种子</strong><small>${crop.days} 天成熟 · 售 ${crop.sellPrice} G</small></span><span class="row-price ${state.gold < crop.seedPrice ? 'unaffordable' : ''}">${crop.seedPrice} G</span><button type="button" data-buy="${key}" class="${state.gold < crop.seedPrice ? 'cant-afford' : ''}" aria-disabled="${state.gold < crop.seedPrice}">购买</button></div>`
    ).join('') + [['hoe', '精钢锄', '锄地体力减半', 400], ['water', '铁水壶', '面前三格浇水', 600]].map(([key, name, desc, price]) => `<div class="shop-row" data-shop-row="${key}"><span class="row-icon" aria-hidden="true">${icons[key]}</span><span class="row-copy"><strong>${name}</strong><small>${desc}</small></span><span class="row-price ${state.gold < price && !state.upgrades[key] ? 'unaffordable' : ''}">${price} G</span><button type="button" data-upgrade="${key}" class="${state.gold < price && !state.upgrades[key] ? 'cant-afford' : ''}" aria-disabled="${state.gold < price}" ${state.upgrades[key] ? 'disabled' : ''}>${state.upgrades[key] ? '已购买' : '购买'}</button></div>`).join('') + `<div class="shop-row"><span class="row-icon" aria-hidden="true">▣</span><span class="row-copy"><strong>饭团</strong><small>恢复 15 体力</small></span><span class="row-price ${state.gold < 20 ? 'unaffordable' : ''}">20 G</span><button type="button" data-snack="buy" class="${state.gold < 20 ? 'cant-afford' : ''}" aria-disabled="${state.gold < 20}">购买</button></div>`;
    document.getElementById('log').innerHTML = journal.map(item => `<li>${item}</li>`).join('');
    document.getElementById('orders-list').innerHTML = state.orders.length ? state.orders.map(order => `<div class="order-row"><span>${F.CROPS[order.crop].name} × ${order.amount} · 第 ${order.deadline} 天前<br>奖励 ${order.reward} G · 背包 ${state.bag[order.crop]}</span><button type="button" data-deliver="${order.id}">交付</button></div>`).join('') : '<p>今日没有订单，睡觉后刷新。</p>';
    document.getElementById('stats-list').innerHTML = `<p>累计收入：${state.stats.income} G</p><p>累计收获：${state.stats.harvested}</p><p>完成订单：${state.stats.orders}</p><p>已玩天数：${state.stats.days}</p>`;
    drawScene(performance.now());
    updateOverlays(performance.now());
  }

  function frame(now) {
    const dt = Math.min(50, now - (lastFrame || now));
    lastFrame = now;
    tickInput(now);
    if (waterArc && now >= waterArc.until) {
      for (let i = 0; i < 5; i++) addParticle(waterArc.toX + (i - 2) * 5, waterArc.toY, (i - 2) * 0.055, -0.15 - i * 0.018, 300, '#75d8ed', 'drop');
      waterArc = null;
    }
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
      if (particle.kind === 'snow') particle.x += Math.sin(now / 240 + particle.y) * 0.4;
      if (particle.kind === 'rain' && particle.y > 540) { particle.age = particle.life; addParticle(particle.x, 541, 0, 0, 120, '#d8efec', 'splash'); }
      if (particle.kind === 'snow' && particle.y > 540) particle.age = particle.life;
    }
    particles = particles.filter(particle => particle.age < particle.life);
    if (now - lastSmoke > 350) {
      addParticle(19, 117, 0.025, -0.06, 850, '#f7f4e590', 'smoke');
      lastSmoke = now;
    }
    if ((state.weather === 'rain' || F.season(state) === '冬') && now - lastRain > 35) {
      const snow = F.season(state) === '冬';
      for (let i = 0; i < 2; i++) addParticle((now * 3 + i * 251) % 768, -10 - i * 120, snow ? 0 : -0.25, snow ? 0.14 : 0.85, snow ? 4500 : 850, snow ? '#f5f8edc9' : '#b7e5e8a0', snow ? 'snow' : 'rain');
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
      if (state.weather !== previousWeather) enqueueToast(state.weather === 'rain' ? '天气转雨，田地已自动浇水' : '雨停转晴，记得给作物浇水', 'info');
      if (state.weather === 'rain') sound('rain');
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
    const outcome = F.selectTool(state, key);
    if (outcome.ok) { toolBounce = key; bounceUntil = performance.now() + 800; }
    handle(outcome, true);
  }

  function openCodex() {
    panelCloseToken++;
    document.getElementById('codex-panel').classList.remove('closing');
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
    document.getElementById('close-codex').focus?.();
  }

  function closePanels() {
    const token = ++panelCloseToken;
    const panels = ['codex-panel', 'orders-panel'].map(id => document.getElementById(id)).filter(panel => !panel.hidden);
    const opener = panels[0]?.id === 'codex-panel' ? 'codex' : 'orders-button';
    for (const panel of panels) panel.classList.add('closing');
    setTimeout(() => {
      if (token !== panelCloseToken) return;
      for (const panel of panels) { panel.hidden = true; panel.classList.remove('closing'); }
      if (panels.length) document.getElementById(opener).focus?.();
    }, 160);
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
    if (event.key >= '1' && event.key <= '4') { selectTool(keys[Number(event.key) - 1]); return; }
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
    const unlock = event.target.closest('[data-unlock]');
    if (unlock) { const row = document.querySelector(`[data-shop-row="${unlock.dataset.unlock}"]`); row?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); row?.classList.add('shop-highlight'); setTimeout(() => row?.classList.remove('shop-highlight'), 1000); enqueueToast('工具尚未解锁，请在商店购买升级', 'info'); return; }
    const button = event.target.closest('[data-tool]');
    if (button) selectTool(button.dataset.tool);
  });
  document.getElementById('crop-options').addEventListener('click', event => {
    const button = event.target.closest('[data-crop]');
    if (button) { initAudio(); handle(F.selectCrop(state, button.dataset.crop), true); }
  });
  document.getElementById('shop').addEventListener('click', event => {
    const button = event.target.closest('[data-buy]');
    if (button) { initAudio(); const price = F.CROPS[button.dataset.buy].seedPrice; const outcome = F.buySeed(state, button.dataset.buy, 1); if (!outcome.ok) { outcome.message = `金币不足，还差 ${price - state.gold} G`; sound('error'); } handle(outcome, true); }
    const upgrade = event.target.closest('[data-upgrade]');
    if (upgrade) { const outcome = F.buyUpgrade(state, upgrade.dataset.upgrade); if (!outcome.ok) { outcome.message = `金币不足，还差 ${({ hoe: 400, water: 600 })[upgrade.dataset.upgrade] - state.gold} G`; sound('error'); } handle(outcome, true); }
    if (event.target.closest('[data-snack]')) { const outcome = F.buySnack(state); if (!outcome.ok) { outcome.message = `金币不足，还差 ${20 - state.gold} G`; sound('error'); } handle(outcome, true); }
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
  document.getElementById('orders-button').addEventListener('click', () => { initAudio(); panelCloseToken++; document.getElementById('orders-panel').classList.remove('closing'); document.getElementById('orders-panel').hidden = false; document.getElementById('codex-panel').hidden = true; document.body.classList.add('modal-open'); document.getElementById('close-orders').focus?.(); });
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
    seasonAfterSleep = false;
    particles = [];
    route = [];
    input.direction = null;
    input.use = false;
    state = F.createGame();
    goldDisplay = state.gold;
    goldStart = 0;
    journal = ['新的农场生活开始了！'];
    lowEnergyNotified = false;
    showSeasonBanner();
    handle({ ok: true, message: '新游戏已开始', events: [] }, true);
  });
  document.getElementById('hint').textContent = '用 WASD 或方向键移动；面向地块，按空格或回车使用当前工具。';
  updateMute();
  if (F.seasonDay(state) === 1) showSeasonBanner();
  render();
  requestAnimationFrame(frame);
})();
