(function () {
  'use strict';

  const F = globalThis.PocketFarm;
  const SAVE_KEY = 'pocket-farm-save-v1';
  const BEST_KEY = 'pocket-farm-best-days';
  const TILE = 48;
  const FARMER_H = 62;
  const CHARACTER_SCALE = FARMER_H / 46;
  const RENDER_SCALE = 2;
  const STATIC_SCALE = 2;
  const SCENE_WIDTH = 768;
  const SCENE_HEIGHT = 576;
  const FIELD_X = 0;
  const FIELD_Y = 0;
  const WORLD_WIDTH = F.WIDTH * TILE;
  const WORLD_HEIGHT = F.HEIGHT * TILE;
  const SPRITES = {
    house: 'pilot-assets/game/house.png',
    'hut-blue': 'pilot-assets/game/hut-blue.png', 'hut-red': 'pilot-assets/game/hut-red.png', 'hut-green': 'pilot-assets/game/hut-green.png',
    'tree-broadleaf': 'pilot-assets/game/tree-broadleaf.png', 'tree-pine': 'pilot-assets/game/tree-pine.png',
    'node-stump': 'pilot-assets/game/node-stump.png', 'node-berry': 'pilot-assets/game/node-berry.png', 'node-rock': 'pilot-assets/game/node-rock.png',
    'prop-scarecrow': 'pilot-assets/game/prop-scarecrow.png', 'prop-fence': 'pilot-assets/game/prop-fence.png',
    'tex-grass': 'pilot-assets/game/tex-grass.png',
    ...Object.fromEntries(['down', 'up', 'left', 'right'].flatMap(direction =>
      [0, 1, 2].map(frame => [`char-farmer-${direction}-${frame}`, `pilot-assets/game/char-farmer-${direction}-${frame}.png`])
    )),
    ...Object.fromEntries(['carrot', 'potato', 'strawberry', 'pumpkin', 'corn'].flatMap(type =>
      [1, 2, 3, 4].map(stage => [`crop-${type}-${stage}`, `pilot-assets/game/crop-${type}-${stage}.png`]))
    )
  };
  const spriteImages = {};
  const canvas = document.getElementById('farm');
  let ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sceneContext = ctx;
  const staticCanvas = document.createElement('canvas');
  const staticContext = staticCanvas.getContext('2d');
  let staticKey = '';

  function preloadSprites() {
    if (typeof globalThis.Image !== 'function') return;
    for (const [name, path] of Object.entries(SPRITES)) {
      try {
        const image = new globalThis.Image();
        spriteImages[name] = { image, loaded: false };
        image.onload = () => { spriteImages[name].loaded = true; staticKey = ''; };
        image.onerror = () => { spriteImages[name].loaded = false; };
        image.src = globalThis.__SPRITE_DATA__?.[name] || path;
      } catch (_) { spriteImages[name] = { image: null, loaded: false }; }
    }
  }

  function spriteReady(name) {
    const sprite = spriteImages[name];
    return Boolean(sprite?.loaded && sprite.image && (sprite.image.naturalWidth || sprite.image.width) && (sprite.image.naturalHeight || sprite.image.height));
  }

  function drawSprite(name, cx, bottomY, targetW, target = ctx) {
    if (!spriteReady(name)) return false;
    const image = spriteImages[name].image;
    const sourceW = image.naturalWidth || image.width, sourceH = image.naturalHeight || image.height;
    const targetH = targetW * sourceH / sourceW;
    try {
      target.imageSmoothingEnabled = false;
      target.drawImage(image, Math.round(cx - targetW / 2), Math.round(bottomY - targetH), Math.round(targetW), Math.round(targetH));
      return true;
    } catch (_) { return false; }
  }

  function drawSpriteH(name, cx, bottomY, targetH, target = ctx) {
    if (!spriteReady(name)) return false;
    const image = spriteImages[name].image;
    const sourceW = image.naturalWidth || image.width, sourceH = image.naturalHeight || image.height;
    return drawSprite(name, cx, bottomY, targetH * sourceW / sourceH, target);
  }

  preloadSprites();

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.round((bounds.width || SCENE_WIDTH) * dpr * RENDER_SCALE);
    const height = Math.round((bounds.height || SCENE_HEIGHT) * dpr * RENDER_SCALE);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    sceneContext.scale(width / SCENE_WIDTH, height / SCENE_HEIGHT);
    sceneContext.imageSmoothingEnabled = false;
    staticContext.imageSmoothingEnabled = false;
    staticKey = '';
  }
  resizeCanvas();
  staticCanvas.width = Math.round(WORLD_WIDTH * STATIC_SCALE);
  staticCanvas.height = Math.round(WORLD_HEIGHT * STATIC_SCALE);
  staticContext.scale(STATIC_SCALE, STATIC_SCALE);
  staticContext.imageSmoothingEnabled = false;
  window.addEventListener('resize', resizeCanvas);

  const palette = {
    '春': { grass: '#8eb76b', grassDark: '#75a05d', grassDeep: '#4f7f4b', grassMid: '#a7c96e', light: '#b9ce80', sky: '#d7e4b2' },
    '夏': { grass: '#74ad63', grassDark: '#5d9857', grassDeep: '#315d47', grassMid: '#8ebd68', light: '#a8c66a', sky: '#c5dfad' },
    '秋': { grass: '#b2aa67', grassDark: '#969658', grassDeep: '#667b50', grassMid: '#c2ad62', light: '#d1bf77', sky: '#e7d4aa' },
    '冬': { grass: '#aac1b8', grassDark: '#8aada8', grassDeep: '#68777d', grassMid: '#c2d2c7', light: '#d8dfd0', sky: '#dfe9e1' }
  };
  const cropColors = { carrot: '#ef9252', potato: '#d5b481', pumpkin: '#e5a44b', strawberry: '#df514f', corn: '#f4c851' };
  const icons = { auto: '✦', hoe: '⚒', seed: '✿', scythe: '☷', gather: '🧺', rod: '🎣', build: '▥' };
  const UI_COLORS = { focus: '#a96d21', danger: '#a3372b' };
  const WORLD_COLORS = {
    water: '#67b6b8', waterLight: '#98d7cf', waterDeep: '#2f7088', waterMid: '#3e91a4', waterGlint: '#d7f0d9',
    sand: '#c7ad75', sandDark: '#9d8158', path: '#b9a276', pathLight: '#d3c09a', pathDark: '#8d7655', gravel: '#9e8968',
    soil: '#8a6249', soilPlanted: '#78543f', furrow: '#684733', furrowLight: '#bb8e65', soilSpeck: '#af805c',
    bark: '#795d45', barkLight: '#a47b54', barkDark: '#5c4030', rootSoil: '#816547',
    wood: '#806447', woodLight: '#d9ba7f', woodDark: '#654d39', woodGrain: '#9d754f',
    wall: '#dfbf86', wallShade: '#cba873', window: '#ffe0a1', windowGlow: '#fff0bd', door: '#785b45', metal: '#d5ddd5',
    roofHome: '#be6846', roofRidge: '#edae70', roofShade: '#713e34', roofMid: '#9d503c', roofLight: '#da8956', roofBlue: '#657f91', roofRed: '#a75d4f', roofMoss: '#667b50',
    plaza: '#c9af80', plazaLight: '#e9d5a9', plazaEdge: '#a98d67', shadow: '#293c3655',
    springFlower: '#f5c4cf', springFlowerLight: '#fff0e6', summerFlower: '#f0ce58', summerFlowerLight: '#fff4bd',
    autumnLeaf: '#d9783f', autumnLeafLight: '#edb34f', frost: '#edf5ed', frostShade: '#cedfd9',
    leafGreen: '#4f7f4b', leafLight: '#a7c96e', leafDeep: '#315d47', leafMid: '#74a75a', leafSun: '#d8dd8b', dust: '#b58a62', star: '#ffe58a',
    hutBlue: '#708baf', hutRed: '#bc745a', hutGreen: '#617c55', whiteFlash: '#fffdf5', cloudShadow: '#3d5b5528',
    springMid: '#d391a7', summerMid: '#4b8c50', autumnMid: '#c99d50',
    springTop: '#f2bdc5', summerTop: '#78b263', autumnTop: '#edce72', capeLight: '#503344', capeDark: '#422c3d',
    skin: '#e8ae7a', skinLight: '#edb881', ink: '#3c4540', hat: '#ccaa68', hatBrim: '#b48b56', hatBand: '#795a3d',
    denim: '#557f9a', denimDark: '#315c73', denimLight: '#739fb2', shirt: '#426f82', pants: '#775c4b', shoes: '#45423f',
    beard: '#ece1ba', scarf: '#836159', hunterHat: '#4b593a', bandit: '#713c49', banditMask: '#342b48', banditEdge: '#8793b1',
    stoneDark: '#68777d', stoneMid: '#89969a', stoneLight: '#aeb1a6', stump: '#8a6040', stumpLight: '#c79a62', berry: '#c94646', rainShade: '#243b4650'
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
  let fishing = null;
  const input = { direction: null, source: null, next: 0, turned: false, use: false, useNext: 0, useTarget: '' };
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
    document.getElementById('hint').textContent = outcome.message;
    document.getElementById('hint').classList.toggle('error', !outcome.ok);
    const achievements = F.checkAchievements(state);
    for (const achievement of achievements) { enqueueToast(`成就达成：${achievement.name}（+${achievement.reward}G）`, 'success'); sound('star'); }
    if (state.gold !== goldDisplay && !goldStart) { goldFrom = goldDisplay; goldStart = performance.now(); }
    if (outcome.ok && changed || achievements.length) {
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
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function sound(kind) {
    if (kind === 'hoe') tone(160, 0.13, 'triangle', 0, 70);
    if (kind === 'seed') tone(560, 0.08, 'sine');
    if (kind === 'scythe') { tone(440, 0.09, 'sine'); tone(660, 0.13, 'sine', 0.09); }
    if (kind === 'gather') tone(190, 0.1, 'triangle', 0, 110);
    if (kind === 'rod') { tone(420, 0.08, 'sine'); tone(760, 0.14, 'sine', 0.08); }
    if (kind === 'bite') { tone(880, 0.07, 'square'); tone(1320, 0.12, 'sine', 0.06); }
    if (kind === 'star') { tone(660, 0.08, 'sine'); tone(990, 0.16, 'sine', 0.07); }
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
    const node = F.resourceNodeAt(target.x, target.y);
    if (fishing) {
      const now = performance.now();
      if (fishing.phase !== 'bite' || now > fishing.deadline) {
        fishing = null; enqueueToast('收竿时机不对，鱼跑掉了', 'alert'); sound('error'); return;
      }
      const outcome = F.act(state, true, Math.random);
      fishing = null;
      sound(outcome.ok ? 'rod' : 'error');
      swingUntil = now + 200; swingTool = 'rod';
      if (outcome.ok) {
        for (let i = 0; i < 8; i++) addParticle(FIELD_X + target.x * TILE + 24, FIELD_Y + target.y * TILE + 20, (i - 4) * 0.018, -0.035 - i % 2 * 0.012, 420, WORLD_COLORS.waterGlint, 'splash');
        handle(outcome, true);
        if (state.resourceNodes[node.id].charges) castLine(node, now);
        else enqueueToast('这个钓点今天钓空了', 'info');
      } else handle(outcome, true);
      return;
    }
    if (node?.kind === 'fish' && (state.autoTool || state.tool === 'rod')) {
      if (!state.resourceNodes[node.id].charges) { handle(F.act(state, true, Math.random), false); sound('error'); return; }
      castLine(node, performance.now()); return;
    }
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

  function castLine(node, now) {
    state.farmer.facing = Object.entries(F.DIRECTIONS).find(([, [dx, dy]]) => state.farmer.x + dx === node.x && state.farmer.y + dy === node.y)?.[0] || state.farmer.facing;
    const rain = state.weather === 'rain';
    fishing = { nodeId: node.id, x: node.x, y: node.y, phase: 'waiting', biteAt: now + (rain ? 700 : 900) + Math.random() * (rain ? 1100 : 1500), deadline: 0 };
    swingUntil = now + 200; swingTool = 'rod';
    document.getElementById('hint').textContent = '抛竿了，等咬钩时再收竿';
  }

  function cancelFishing(message = '') {
    if (!fishing) return;
    fishing = null;
    if (message) enqueueToast(message, 'info');
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
    cancelFishing('移动取消了垂钓');
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
    const target = F.frontCell(state);
    input.useTarget = `${target.x},${target.y},${state.farmer.facing}`;
    input.useNext = performance.now() + 150;
  }

  function tickInput(now) {
    if (state.gameOver) return;
    if (input.direction && now >= input.next) {
      move(input.direction);
      input.next = now + 140;
    }
    if (fishing) {
      if (fishing.phase === 'waiting' && now >= fishing.biteAt) {
        fishing.phase = 'bite'; fishing.deadline = now + 900;
        enqueueToast('咬钩了！', 'success'); sound('bite');
        for (let i = 0; i < 6; i++) addParticle(fishing.x * TILE + 24, fishing.y * TILE + 18, (i - 2.5) * 0.02, -0.04, 360, WORLD_COLORS.waterGlint, 'splash');
      } else if (fishing.phase === 'bite' && now > fishing.deadline) {
        fishing = null; enqueueToast('收竿太慢，鱼跑掉了', 'alert');
      }
    }
    if (input.use && !fishing) {
      const target = F.frontCell(state);
      const key = `${target.x},${target.y},${state.farmer.facing}`;
      if (key !== input.useTarget && now >= input.useNext) {
        action(); input.useTarget = key; input.useNext = now + 150;
      }
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
    box(x - rx + 3, y - ry + 3, rx * 2, ry * 2, WORLD_COLORS.shadow);
    box(x - rx + 5, y - ry + 1, rx * 2 - 4, 2, WORLD_COLORS.shadow);
  }

  function pixelLine(x1, y1, x2, y2, color, size = 1) {
    const dx = x2 - x1, dy = y2 - y1;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const width = Math.max(1, Math.round(size));
    if (!steps) { box(x1, y1, width, width, color); return; }
    for (let i = 0; i <= steps; i++) box(x1 + dx * i / steps, y1 + dy * i / steps, width, width, color);
  }

  function drawGrassTile(px, py, x, y, terrain, p) {
    const base = terrain === 'residential' ? p.light : p.grass;
    if (spriteReady('tex-grass')) {
      const image = spriteImages['tex-grass'].image;
      const sourceX = (x % 2) * image.width / 2, sourceY = (y % 2) * image.height / 2;
      try { ctx.drawImage(image, sourceX, sourceY, image.width / 2, image.height / 2, px, py, TILE, TILE); }
      catch (_) { box(px, py, TILE, TILE, base); }
      const tintAlpha = { '春': 0, '夏': 0.10, '秋': 0.20, '冬': 0.28 }[F.season(state)];
      if (tintAlpha) { ctx.globalAlpha = tintAlpha; box(px, py, TILE, TILE, base); ctx.globalAlpha = 1; }
    } else box(px, py, TILE, TILE, base);
    const variant = Math.floor(hash(x, y, 18) * 3);
    const patches = [
      [[5, 7, 10, 4], [31, 30, 12, 5], [17, 39, 8, 3]],
      [[28, 6, 13, 5], [6, 25, 9, 6], [24, 40, 11, 3]],
      [[9, 10, 8, 5], [25, 21, 15, 6], [4, 39, 12, 3]]
    ][variant];
    patches.forEach((patch, i) => {
      const [dx, dy, width, height] = patch;
      box(px + dx, py + dy, width, height, i === 1 ? p.grassMid : p.grassDark);
      box(px + dx + 2, py + dy, Math.max(2, width - 5), 2, i ? base : p.light);
    });
    const clusterCount = 2 + Math.floor(hash(x, y, 140) * 3);
    for (let i = 0; i < clusterCount; i++) {
      const gx = px + 6 + Math.floor(hash(x, y, 141 + i) * 35);
      const gy = py + 13 + Math.floor(hash(x, y, 145 + i) * 27);
      pixelLine(gx, gy + 5, gx - 3, gy + variant % 2, p.grassDeep);
      pixelLine(gx + 1, gy + 5, gx + 1, gy - 2, p.grassDark);
      pixelLine(gx + 3, gy + 5, gx + 5, gy + 1, p.grassMid);
      if (i % 2) box(gx - 1, gy + 5, 5, 2, p.grassDeep);
    }
    if (hash(x, y, 153) > 0.66) {
      const sx = px + 8 + Math.floor(hash(x, y, 154) * 30);
      const sy = py + 9 + Math.floor(hash(x, y, 155) * 29);
      box(sx, sy + 2, 6, 3, WORLD_COLORS.plazaEdge);
      box(sx + 1, sy, 4, 3, WORLD_COLORS.plazaLight);
    }
    const season = F.season(state);
    if (hash(x, y, 150) > 0.6) {
      const fx = px + 7 + Math.floor(hash(x, y, 151) * 33), fy = py + 7 + Math.floor(hash(x, y, 152) * 32);
      const accents = season === '春' ? [WORLD_COLORS.springFlower, WORLD_COLORS.springFlowerLight] : season === '夏' ? [WORLD_COLORS.summerFlower, WORLD_COLORS.summerFlowerLight] : season === '秋' ? [WORLD_COLORS.autumnLeaf, WORLD_COLORS.autumnLeafLight] : [WORLD_COLORS.frost, WORLD_COLORS.frostShade];
      box(fx - 2, fy, 2, 2, accents[0]); box(fx + 2, fy + 1, 2, 2, accents[1]); box(fx, fy + 2, 2, 2, accents[0]);
    }
  }

  function drawPathTile(px, py, x, y) {
    box(px, py, TILE, TILE, WORLD_COLORS.path);
    const bite = 2 + Math.floor(hash(x, y, 116) * 4);
    for (let i = 0; i < 4; i++) {
      const offset = 4 + Math.floor(hash(x, y, 117 + i) * 35);
      box(px, py + offset, bite + i % 2, 3, i % 2 ? WORLD_COLORS.pathDark : WORLD_COLORS.gravel);
      box(px + TILE - bite - (i + 1) % 2, py + (offset + 17) % 42, bite + (i + 1) % 2, 3, i % 2 ? WORLD_COLORS.gravel : WORLD_COLORS.pathDark);
    }
    box(px + 9, py + 7 + Math.floor(hash(x, y, 121) * 7), 25 + Math.floor(hash(x, y, 122) * 6), 3, WORLD_COLORS.pathLight);
    box(px + 14, py + 31 + Math.floor(hash(x, y, 123) * 5), 20, 2, WORLD_COLORS.pathDark);
    for (let i = 0; i < 8; i++) {
      const gx = px + 7 + Math.floor(hash(x, y, 124 + i) * 34);
      const gy = py + 5 + Math.floor(hash(x, y, 134 + i) * 38);
      box(gx, gy, 1 + i % 3, i % 2 + 1, i % 3 ? WORLD_COLORS.gravel : WORLD_COLORS.pathLight);
    }
    if ((x + y) % 3 === 0) {
      const sx = px + 14 + Math.floor(hash(x, y, 146) * 10), sy = py + 18 + Math.floor(hash(x, y, 147) * 10);
      box(sx, sy + 2, 14, 6, WORLD_COLORS.plazaEdge);
      box(sx + 2, sy, 10, 5, WORLD_COLORS.plazaLight);
      box(sx + 3, sy + 1, 6, 2, WORLD_COLORS.wallShade);
    }
  }

  function drawPondTile(px, py, x, y, pond) {
    const edgeLeft = x === pond.left, edgeRight = x === pond.right;
    const edgeTop = y === pond.top, edgeBottom = y === pond.bottom;
    box(px, py, TILE, TILE, WORLD_COLORS.waterDeep);
    box(px + 3, py + 3, 42, 42, WORLD_COLORS.waterMid);
    if (edgeLeft) { box(px, py, 8, TILE, WORLD_COLORS.waterLight); box(px + 7, py + 2, 4, 44, WORLD_COLORS.water); }
    if (edgeRight) { box(px + 40, py, 8, TILE, WORLD_COLORS.waterLight); box(px + 37, py + 2, 4, 44, WORLD_COLORS.water); }
    if (edgeTop) { box(px, py, TILE, 8, WORLD_COLORS.waterLight); box(px + 2, py + 7, 44, 4, WORLD_COLORS.water); }
    if (edgeBottom) { box(px, py + 40, TILE, 8, WORLD_COLORS.waterLight); box(px + 2, py + 37, 44, 4, WORLD_COLORS.water); }
    for (let i = 0; i < 5; i++) {
      const wx = px + 5 + Math.floor(hash(x, y, 101 + i) * 34);
      const wy = py + 8 + Math.floor(hash(x, y, 111 + i) * 30);
      const width = 4 + i % 3 * 3;
      box(wx, wy, width, i % 2 + 1, i % 2 ? WORLD_COLORS.water : WORLD_COLORS.waterLight);
      if (i === 1 || i === 4) box(wx + 2, wy - 2, Math.max(2, width - 4), 1, WORLD_COLORS.waterGlint);
    }
    // 荷叶只占水面小部分，不改变或遮挡钓点交互语义。
    if (hash(x, y, 178) > 0.78 && !F.RESOURCE_NODES.some(node => node.kind === 'fish' && node.x === x && node.y === y)) {
      const lx = px + 10 + Math.floor(hash(x, y, 179) * 22), ly = py + 15 + Math.floor(hash(x, y, 180) * 17);
      box(lx + 2, ly, 10, 2, WORLD_COLORS.leafLight);
      box(lx, ly + 2, 14, 6, WORLD_COLORS.leafGreen);
      box(lx + 7, ly + 2, 3, 4, WORLD_COLORS.waterMid);
      if ((x + y) % 2) { box(lx + 4, ly - 3, 2, 3, WORLD_COLORS.springFlower); box(lx + 2, ly - 2, 6, 2, WORLD_COLORS.springFlowerLight); }
    }
  }

  function drawShoreTile(px, py, x, y, pond) {
    const west = x === pond.left - 1, east = x === pond.right + 1;
    const north = y === pond.top - 1, south = y === pond.bottom + 1;
    if (west) { box(px + 38, py + 3, 10, 42, WORLD_COLORS.sand); box(px + 43, py + 5, 5, 38, WORLD_COLORS.sandDark); }
    if (east) { box(px, py + 3, 10, 42, WORLD_COLORS.sand); box(px, py + 5, 5, 38, WORLD_COLORS.sandDark); }
    if (north) { box(px + 3, py + 38, 42, 10, WORLD_COLORS.sand); box(px + 5, py + 43, 38, 5, WORLD_COLORS.sandDark); }
    if (south) { box(px + 3, py, 42, 10, WORLD_COLORS.sand); box(px + 5, py, 38, 5, WORLD_COLORS.sandDark); }
    const horizontal = north || south;
    for (let i = 0; i < 2; i++) {
      const sx = px + (horizontal ? 9 + i * 21 : west ? 36 : 3);
      const sy = py + (horizontal ? north ? 35 : 5 : 10 + i * 22);
      box(sx, sy + 2, horizontal ? 10 : 7, horizontal ? 5 : 9, WORLD_COLORS.stoneDark);
      box(sx + 2, sy, horizontal ? 7 : 5, horizontal ? 4 : 6, WORLD_COLORS.stoneLight);
    }
    const reeds = 2 + Math.floor(hash(x, y, 160) * 2);
    for (let i = 0; i < reeds; i++) {
      const rx = horizontal ? px + 12 + i * 13 : px + (west ? 39 : 7);
      const ry = horizontal ? py + (north ? 42 : 8) : py + 17 + i * 8;
      pixelLine(rx, ry, rx + (i % 2 ? 2 : -2), ry - 12, WORLD_COLORS.leafGreen);
      box(rx + (i % 2 ? 1 : -3), ry - 15, 4, 5, WORLD_COLORS.autumnLeafLight);
    }
  }

  function drawBackground() {
    const p = palette[F.season(state)];
    const L = F.LAYOUT;
    box(0, 0, F.WIDTH * TILE, F.HEIGHT * TILE, p.grass);
    for (let y = 0; y < F.HEIGHT; y++) for (let x = 0; x < F.WIDTH; x++) {
      const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
      const terrain = F.terrainAt(x, y);
      if (terrain === 'pond') {
        drawPondTile(px, py, x, y, L.pond);
      } else if (terrain === 'path' || x === L.gate.x && y >= L.farm.bottom - 1) {
        drawPathTile(px, py, x, y);
      } else {
        drawGrassTile(px, py, x, y, terrain, p);
      }
      if (terrain === 'tree') drawTree(px + 4, py - 8, x, y);
      const shore = (x === L.pond.left - 1 || x === L.pond.right + 1) && y >= L.pond.top && y <= L.pond.bottom ||
        (y === L.pond.top - 1 || y === L.pond.bottom + 1) && x >= L.pond.left && x <= L.pond.right;
      if (shore) drawShoreTile(px, py, x, y, L.pond);
    }
    // 村口道路向画面南侧继续，村牌仅作装饰。
    box(L.gate.x * TILE + 5, L.gate.y * TILE, TILE - 10, TILE, WORLD_COLORS.path);
    box(L.gate.x * TILE + TILE - 7, L.gate.y * TILE - 27, 4, 35, WORLD_COLORS.wood);
    box(L.gate.x * TILE + TILE - 25, L.gate.y * TILE - 30, 28, 16, WORLD_COLORS.woodLight);
    pixelLine(L.gate.x * TILE + TILE - 22, L.gate.y * TILE - 26, L.gate.x * TILE + TILE - 1, L.gate.y * TILE - 26, WORLD_COLORS.woodGrain);
    pixelLine(L.gate.x * TILE + TILE - 20, L.gate.y * TILE - 18, L.gate.x * TILE + TILE - 1, L.gate.y * TILE - 18, WORLD_COLORS.woodGrain);
    label('村口', L.gate.x * TILE + TILE - 23, L.gate.y * TILE - 18, WORLD_COLORS.woodDark, 10);
  }

  function drawAmbient(now, visible) {
    const p = palette[F.season(state)];
    for (let y = visible.top; y <= visible.bottom; y++) for (let x = visible.left; x <= visible.right; x++) {
      const px = FIELD_X + x * TILE + 7 + Math.floor(hash(x, y, 40) * 34);
      const py = FIELD_Y + y * TILE + 12 + Math.floor(hash(x, y, 50) * 30);
      const sway = Math.sin(now / 680 + x * 1.7 + y * 2.3) * 1.5;
      pixelLine(px, py + 4, px - 2 + sway, py, p.grassDark, 0.5);
    }
    for (let cloud = 0; cloud < 3; cloud++) {
      const cloudX = (((now + cloud * 2700) % 10500) / 10500) * (WORLD_WIDTH + 280) - 190;
      const cloudY = 170 + cloud * 155;
      if (cloudX + 220 >= camera.x && cloudX - 90 <= camera.x + SCENE_WIDTH && cloudY + 30 >= camera.y && cloudY - 30 <= camera.y + SCENE_HEIGHT)
        for (let puff = 0; puff < 4; puff++) {
          const width = 110 - puff * 8, puffX = cloudX + puff * 38, puffY = cloudY + (puff % 2) * 8;
          box(puffX - width / 2 + 8, puffY - 16, width - 16, 32, WORLD_COLORS.cloudShadow);
          box(puffX - width / 2, puffY - 9, width, 18, WORLD_COLORS.cloudShadow);
        }
    }
    const season = F.season(state);
    if (season !== '冬') for (let i = 0; i < 2; i++) {
      const t = now / 850 + i * Math.PI;
      const x = F.LAYOUT.farm.left * TILE + 55 + (now / 18 + i * 260) % ((F.LAYOUT.farm.right - F.LAYOUT.farm.left) * TILE);
      const y = F.LAYOUT.farm.top * TILE + 45 + i * 92 + Math.sin(t) * 24;
      const color = season === '秋' ? (i ? WORLD_COLORS.autumnLeafLight : WORLD_COLORS.autumnLeaf) : (i ? WORLD_COLORS.springFlower : WORLD_COLORS.summerFlower);
      if (x < camera.x - TILE || x > camera.x + SCENE_WIDTH + TILE || y < camera.y - TILE || y > camera.y + SCENE_HEIGHT + TILE) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.7) * 0.6);
      if (season === '秋') { box(-4, -2, 8, 4, color); pixelLine(-3, 0, 4, 0, WORLD_COLORS.woodGrain); }
      else { box(-6, -2, 5, 4, color); box(2, -2, 5, 4, color); box(-1, 0, 2, 4, WORLD_COLORS.woodDark); }
      ctx.restore();
    }
  }

  function drawTreeTrunk(x, y, narrow = false) {
    shadow(x + 21, y + 55, 22, 6);
    box(x + 11, y + 52, 22, 7, WORLD_COLORS.rootSoil);
    box(x + (narrow ? 17 : 15), y + 20, narrow ? 7 : 10, 38, WORLD_COLORS.bark);
    box(x + 16, y + 27, 3, 25, WORLD_COLORS.barkLight); box(x + 23, y + 34, 3, 19, WORLD_COLORS.barkDark);
    if (!narrow) box(x + 8, y + 26, 24, 4, WORLD_COLORS.bark);
    for (let i = 0; i < 3; i++) box(x + 18 + i % 2 * 4, y + 31 + i * 8, 2, 5, i % 2 ? WORLD_COLORS.barkDark : WORLD_COLORS.barkLight);
    pixelLine(x + 14, y + 55, x + 8, y + 59, WORLD_COLORS.barkDark); pixelLine(x + 24, y + 54, x + 31, y + 59, WORLD_COLORS.barkDark);
  }

  function treeColors() {
    const season = F.season(state);
    if (season === '冬') return [WORLD_COLORS.stoneDark, WORLD_COLORS.frostShade, WORLD_COLORS.frost, WORLD_COLORS.whiteFlash];
    return {
      '春': [WORLD_COLORS.leafDeep, WORLD_COLORS.leafGreen, WORLD_COLORS.leafLight, WORLD_COLORS.springFlowerLight],
      '夏': [WORLD_COLORS.leafDeep, WORLD_COLORS.summerMid, WORLD_COLORS.summerTop, WORLD_COLORS.leafSun],
      '秋': [WORLD_COLORS.woodDark, WORLD_COLORS.autumnLeaf, WORLD_COLORS.autumnMid, WORLD_COLORS.autumnTop]
    }[season];
  }

  function drawTree(x, y, gridX, gridY) {
    const pine = hash(gridX, gridY, 165) < 0.35;
    const scale = 0.92 + hash(gridX, gridY, 166) * 0.16;
    if (drawSprite(pine ? 'tree-pine' : 'tree-broadleaf', x + 21, y + 59, TILE * 1.7 * scale)) return;
    const colors = treeColors();
    drawTreeTrunk(x, y, pine);
    if (pine) {
      for (let tier = 0; tier < 4; tier++) {
        const width = 17 + tier * 7, left = x + 21 - Math.floor(width / 2) + (tier % 2 ? 2 : -1), top = y - 3 + tier * 10;
        box(left + 5, top, width - 10, 6, colors[2]);
        box(left + 2, top + 5, width - 4, 7, colors[1]);
        box(left, top + 10, width, 5, colors[0]);
        box(left + 4, top + 9, 6, 2, colors[3]);
        box(left + width - 9, top + 12, 5, 2, colors[1]);
      }
      return;
    }
    const clusters = [[5, 10, 18, 16], [17, 1, 19, 18], [27, 12, 16, 18], [10, 23, 18, 14], [24, 26, 15, 11]];
    clusters.forEach((cluster, i) => {
      const [dx, dy, width, height] = cluster;
      box(x + dx, y + dy, width, height, colors[i % 2]);
      box(x + dx + 3, y + dy - 3, width - 7, 6, colors[2]);
      box(x + dx + width - 6, y + dy + 5, 5, height - 7, colors[0]);
      if (i < 3) box(x + dx + 4, y + dy + 2, 5, 3, colors[3]);
    });
    // 少量透光缺口打断圆球轮廓，位置由格坐标稳定决定。
    const gap = Math.floor(hash(gridX, gridY, 168) * 3);
    box(x + 13 + gap * 8, y + 20 + gap * 3, 4, 4, palette[F.season(state)].grass);
  }

  function drawPondRipples(now, visible) {
    const L = F.LAYOUT.pond;
    for (let i = 0; i < 3; i++) {
      const px = (L.left + 0.8 + i) * TILE;
      const py = (L.top + 1 + i % 2) * TILE;
      const age = (now + i * 400) % 1200 / 1200;
      ctx.globalAlpha = 1 - age;
      const width = 5 + Math.floor(age * 17), half = Math.floor(width / 2);
      pixelLine(px - half, py, px - 3, py, WORLD_COLORS.waterGlint);
      pixelLine(px + 3, py, px + half, py, WORLD_COLORS.waterGlint);
      if (width > 12) { pixelLine(px - half + 3, py - 2, px - 1, py - 2, WORLD_COLORS.waterLight); pixelLine(px + 1, py - 2, px + half - 3, py - 2, WORLD_COLORS.waterLight); }
    }
    for (let y = Math.max(L.top, visible.top); y <= Math.min(L.bottom, visible.bottom); y++) for (let x = Math.max(L.left, visible.left); x <= Math.min(L.right, visible.right); x++) if (hash(x, y, 170) > 0.28) {
      const phase = (Math.sin(now / 720 + hash(x, y, 171) * 8) + 1) / 2;
      ctx.globalAlpha = 0.2 + phase * 0.55;
      const py = y * TILE + 13 + hash(x, y, 172) * 24;
      pixelLine(x * TILE + 8 + phase * 8, py, x * TILE + 20 + phase * 8, py, WORLD_COLORS.waterGlint, 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawResourceNodes(now, visible) {
    for (const node of F.RESOURCE_NODES) {
      if (node.x < visible.left || node.x > visible.right || node.y < visible.top || node.y > visible.bottom) continue;
      const status = state.resourceNodes[node.id];
      const x = node.x * TILE, y = node.y * TILE;
      if (node.kind === 'tree') {
        if (status.charges && drawSprite('tree-broadleaf', x + TILE / 2, y + TILE, TILE * 1.3)) {
          // 素材树以格底中心为锚点；采空时改用树桩素材。
        } else if (!status.charges && drawSprite('node-stump', x + TILE / 2, y + TILE, TILE * 0.9)) {
          // 已绘制采空形态。
        } else if (status.charges) {
          box(x + 12, y + 37, 18, 5, WORLD_COLORS.stump); box(x + 18, y + 32, 18, 5, WORLD_COLORS.barkLight);
          box(x + 14, y + 36, 14, 2, WORLD_COLORS.woodLight); box(x + 28, y + 31, 7, 2, WORLD_COLORS.woodLight);
        } else { box(x + 14, y + 33, 21, 10, WORLD_COLORS.stump); box(x + 18, y + 32, 13, 3, WORLD_COLORS.stumpLight); box(x + 19, y + 34, 11, 2, WORLD_COLORS.woodGrain); box(x + 23, y + 36, 5, 2, WORLD_COLORS.barkDark); }
      } else if (node.kind === 'berry') {
        if (spriteReady('node-berry')) {
          ctx.save(); if (!status.charges) ctx.globalAlpha = 0.45;
          const drawn = drawSprite('node-berry', x + TILE / 2, y + TILE, TILE * 1.05);
          ctx.restore();
          if (drawn) continue;
        }
        pixelLine(x + 13, y + 40, x + 25, y + 18, WORLD_COLORS.woodDark, 3); pixelLine(x + 34, y + 40, x + 25, y + 18, WORLD_COLORS.woodDark, 3);
        if (status.charges) { box(x + 9, y + 20, 31, 21, WORLD_COLORS.leafDeep); box(x + 13, y + 16, 24, 22, WORLD_COLORS.leafGreen); box(x + 12, y + 16, 9, 8, WORLD_COLORS.leafLight); box(x + 28, y + 18, 9, 7, WORLD_COLORS.leafMid); }
        for (let i = 0; i < status.charges; i++) { box(x + 17 + i * 11, y + 22 + i * 5, 6, 6, WORLD_COLORS.berry); box(x + 18 + i * 11, y + 22 + i * 5, 3, 2, WORLD_COLORS.springFlowerLight); }
      } else if (node.kind === 'stone') {
        if (spriteReady('node-rock')) {
          ctx.save(); if (!status.charges) ctx.globalAlpha = 0.45;
          const drawn = drawSprite('node-rock', x + TILE / 2, y + TILE, TILE * 1.05);
          ctx.restore();
          if (drawn) continue;
        }
        if (status.charges) { box(x + 8, y + 25, 33, 16, WORLD_COLORS.stoneDark); box(x + 12, y + 20, 25, 16, WORLD_COLORS.stoneMid); box(x + 16, y + 18, 17, 8, WORLD_COLORS.stoneLight); box(x + 17, y + 19, 12, 3, WORLD_COLORS.whiteFlash); }
        else { box(x + 11, y + 37, 9, 4, WORLD_COLORS.stoneDark); box(x + 27, y + 34, 12, 6, WORLD_COLORS.stoneMid); box(x + 29, y + 34, 7, 2, WORLD_COLORS.stoneLight); }
      } else {
        const age = now % 1100 / 1100; ctx.globalAlpha = status.charges ? 0.85 : 0.2;
        const width = 6 + Math.floor(age * 16);
        pixelLine(x + 24 - width, y + 25, x + 20, y + 25, WORLD_COLORS.waterGlint);
        pixelLine(x + 28, y + 25, x + 24 + width, y + 25, WORLD_COLORS.waterGlint);
        if (status.charges) { box(x + 22, y + 18, 4, 8, WORLD_COLORS.springFlowerLight); box(x + 22, y + 17, 4, 4, WORLD_COLORS.berry); }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawHouseCell(cell, name, roof = WORLD_COLORS.roofHome, prop = 'flowers', spriteName = null, spriteWidth = TILE * 3) {
    const x = cell.x * TILE, y = cell.y * TILE;
    if (spriteName && drawSprite(spriteName, x + TILE / 2, y + TILE, spriteWidth)) return;
    const left = x - 5, top = y - 13;
    shadow(x + 27, y + 43, 29, 5);
    // 石基与灰泥立面均向上、左右的非交互住宅空地外扩，门前格保持完全可读。
    box(left + 5, y + 36, 53, 8, WORLD_COLORS.plazaEdge);
    for (let i = 0; i < 6; i++) {
      const sx = left + 6 + i * 8 + i % 2 * 2;
      box(sx, y + 37 + i % 2 * 3, 7, 4, i % 3 ? WORLD_COLORS.wallShade : WORLD_COLORS.plazaLight);
      box(sx + 1, y + 37 + i % 2 * 3, 5, 1, WORLD_COLORS.plazaLight);
    }
    box(left + 4, y + 9, 54, 29, WORLD_COLORS.wallShade);
    box(left + 7, y + 8, 48, 28, WORLD_COLORS.wall);
    box(left + 8, y + 10, 3, 25, WORLD_COLORS.wallShade);
    // 深木骨架与右下接触暗边强化3/4体积。
    box(left + 7, y + 9, 48, 3, WORLD_COLORS.woodDark);
    box(left + 9, y + 12, 3, 24, WORLD_COLORS.wood);
    box(left + 50, y + 12, 3, 24, WORLD_COLORS.barkDark);
    box(left + 11, y + 25, 39, 3, WORLD_COLORS.wood);
    // 阶梯坡顶与错缝小瓦，暖红主色在不同小屋中保留色相区分。
    box(left, top + 12, 62, 7, WORLD_COLORS.roofShade);
    box(left + 4, top + 7, 54, 9, WORLD_COLORS.roofMid);
    box(left + 9, top + 3, 44, 9, roof);
    box(left + 15, top, 32, 6, WORLD_COLORS.roofLight);
    box(left + 17, top - 2, 29, 3, WORLD_COLORS.roofRidge);
    for (let row = 0; row < 4; row++) for (let tile = 0; tile < 7; tile++) {
      const tx = left + 5 + tile * 8 + (row % 2) * 4;
      const ty = top + 5 + row * 3;
      if (tx > left + 56 - row * 2) continue;
      box(tx, ty, 5, 2, (tile + row) % 3 ? roof : WORLD_COLORS.roofLight);
      box(tx + 4, ty + 1, 2, 2, WORLD_COLORS.roofShade);
    }
    // 烟囱只保留像素石块，烟雾继续使用既有动态粒子队列。
    box(left + 45, top - 8, 7, 13, WORLD_COLORS.plazaEdge);
    box(left + 46, top - 7, 5, 4, WORLD_COLORS.wallShade);
    box(left + 44, top - 10, 9, 3, WORLD_COLORS.woodDark);
    // 门、暖窗、花箱与灯笼均在立面内，不占用门前操作格。
    box(left + 23, y + 18, 16, 20, WORLD_COLORS.woodDark);
    box(left + 26, y + 20, 11, 18, WORLD_COLORS.door);
    box(left + 34, y + 29, 2, 2, WORLD_COLORS.metal);
    box(left + 12, y + 17, 10, 11, WORLD_COLORS.woodDark);
    box(left + 14, y + 19, 6, 7, WORLD_COLORS.window);
    box(left + 16, y + 19, 2, 7, WORLD_COLORS.windowGlow);
    box(left + 14, y + 22, 6, 2, WORLD_COLORS.woodDark);
    box(left + 11, y + 28, 13, 4, WORLD_COLORS.wood);
    box(left + 13, y + 26, 2, 3, WORLD_COLORS.springFlower);
    box(left + 18, y + 25, 2, 4, WORLD_COLORS.summerFlower);
    box(left + 42, y + 19, 4, 8, WORLD_COLORS.woodDark);
    box(left + 43, y + 21, 3, 4, WORLD_COLORS.windowGlow);
    box(left + 21, y + 40, 22, 4, WORLD_COLORS.plazaEdge);
    box(left + 24, y + 39, 16, 2, WORLD_COLORS.plazaLight);
    if (prop === 'jar') { box(left + 48, y + 29, 8, 11, WORLD_COLORS.roofBlue); box(left + 49, y + 27, 6, 3, WORLD_COLORS.waterLight); box(left + 50, y + 32, 4, 2, WORLD_COLORS.roofRidge); }
    else if (prop === 'wood') { box(left + 45, y + 34, 12, 5, WORLD_COLORS.barkDark); box(left + 47, y + 30, 9, 5, WORLD_COLORS.barkLight); pixelLine(left + 47, y + 34, left + 55, y + 31, WORLD_COLORS.woodLight); }
    else if (prop === 'pot') { box(left + 48, y + 34, 8, 6, WORLD_COLORS.roofRed); box(left + 50, y + 29, 2, 6, WORLD_COLORS.leafGreen); box(left + 53, y + 28, 3, 4, WORLD_COLORS.springFlower); }
    else { box(left + 48, y + 35, 8, 5, WORLD_COLORS.wood); box(left + 49, y + 32, 2, 3, WORLD_COLORS.springFlower); box(left + 53, y + 31, 2, 4, WORLD_COLORS.summerFlower); }
    label(name, left + 24, y + 16, WORLD_COLORS.woodDark, 8);
  }

  function drawHouses() {
    drawHouseCell(F.LAYOUT.home, '家', WORLD_COLORS.roofHome, 'flowers', 'house', TILE * 4.2);
    const roofs = [WORLD_COLORS.roofBlue, WORLD_COLORS.roofRed, WORLD_COLORS.roofMoss];
    const props = ['jar', 'wood', 'pot'];
    F.LAYOUT.huts.forEach((hut, i) => drawHouseCell(hut, ['村长', '婆婆', '猎手'][i], roofs[i], props[i], ['hut-blue', 'hut-red', 'hut-green'][i], TILE * 3));
    const x = F.LAYOUT.square.x * TILE, y = F.LAYOUT.square.y * TILE;
    box(x - TILE, y - TILE, TILE * 3, TILE * 3, WORLD_COLORS.plaza);
    for (let py = -1; py < 2; py++) for (let px = -1; px < 2; px++) { box(x + px * 32 + 1, y + py * 25 + 2, 29, 22, (px + py) % 2 ? WORLD_COLORS.plazaLight : WORLD_COLORS.plaza); pixelLine(x + px * 32, y + py * 25, x + px * 32 + 30, y + py * 25, WORLD_COLORS.plazaEdge, 0.5); }
    box(x + 12, y + 13, 24, 20, WORLD_COLORS.plazaEdge);
    box(x + 18, y + 18, 12, 8, WORLD_COLORS.plazaLight);
    const farm = F.LAYOUT.farm;
    const fenceY = farm.top * TILE - 12;
    for (let px = farm.left; px <= farm.right; px += 3) {
      const fenceX = px * TILE + 21;
      box(fenceX + 3, fenceY + 12, 132, 4, WORLD_COLORS.shadow);
      box(fenceX, fenceY + 4, 132, 6, WORLD_COLORS.woodDark);
      box(fenceX + 1, fenceY + 2, 130, 5, WORLD_COLORS.wood);
      box(fenceX + 12, fenceY + 3, 20, 2, WORLD_COLORS.woodLight);
      box(fenceX, fenceY - 1, 7, 18, WORLD_COLORS.woodDark);
      box(fenceX + 1, fenceY - 3, 5, 18, WORLD_COLORS.wood);
      box(fenceX + 2, fenceY - 3, 3, 2, WORLD_COLORS.woodLight);
    }
  }

  function drawPlot(plot, x, y) {
    if (!plot.tilled && !plot.structure) return;
    const px = FIELD_X + x * TILE, py = FIELD_Y + y * TILE;
    if (plot.structure) {
      if (plot.structure === 'fence') {
        if (drawSprite('prop-fence', px + TILE / 2, py + TILE, TILE)) return;
        shadow(px + 25, py + 38, 20, 4);
        box(px + 5, py + 17, 38, 7, WORLD_COLORS.woodDark); box(px + 6, py + 14, 36, 6, WORLD_COLORS.wood);
        box(px + 6, py + 28, 36, 6, WORLD_COLORS.woodDark); box(px + 7, py + 26, 34, 5, WORLD_COLORS.wood);
        for (const post of [9, 32]) { box(px + post, py + 7, 7, 34, WORLD_COLORS.woodDark); box(px + post + 1, py + 5, 5, 34, WORLD_COLORS.wood); box(px + post + 2, py + 5, 3, 2, WORLD_COLORS.woodLight); }
        box(px + 20, py + 16, 7, 2, WORLD_COLORS.woodLight); box(px + 28, py + 28, 6, 2, WORLD_COLORS.woodGrain);
      }
      else {
        if (drawSprite('prop-scarecrow', px + TILE / 2, py + TILE, TILE * 0.95)) return;
        box(px + 22, py + 8, 4, 35, '#76533f'); box(px + 7, py + 15, 34, 5, '#a17855'); box(px + 14, py + 5, 20, 8, '#d1aa7c'); box(px + 18, py + 21, 12, 12, '#e8c373');
      }
      return;
    }
    box(px + 3, py + 4, 42, 41, plot.crop ? WORLD_COLORS.soilPlanted : WORLD_COLORS.soil);
    box(px + 5, py + 3, 36, 3, WORLD_COLORS.furrowLight);
    box(px + 2, py + 8, 3, 31, WORLD_COLORS.furrow);
    box(px + 43, py + 11, 3, 29, WORLD_COLORS.furrow);
    const rows = [13, 23, 33];
    rows.forEach((row, i) => {
      const stagger = Math.floor(hash(x, y, 66 + i) * 4) - 1;
      box(px + 6 + stagger, py + row, 36 - stagger, 3, WORLD_COLORS.furrow);
      box(px + 9 - stagger, py + row + 3, 29 + stagger, 2, WORLD_COLORS.furrowLight);
      box(px + 7 + (i % 2) * 5, py + row - 2, 8, 2, WORLD_COLORS.soilSpeck);
    });
    for (let i = 0; i < 10; i++) {
      const dx = 7 + Math.floor(hash(x, y, 70 + i) * 33), dy = 8 + Math.floor(hash(x, y, 84 + i) * 32);
      const color = i % 3 === 0 ? WORLD_COLORS.furrow : i % 3 === 1 ? WORLD_COLORS.soilSpeck : WORLD_COLORS.furrowLight;
      box(px + dx, py + dy, 2 + i % 3, 1 + (i + 1) % 2, color);
    }
    for (let i = 0; i < 2; i++) {
      const dx = 11 + Math.floor(hash(x, y, 98 + i) * 23), dy = 10 + Math.floor(hash(x, y, 102 + i) * 24);
      box(px + dx, py + dy, 6, 3, WORLD_COLORS.furrow);
      box(px + dx + 1, py + dy, 3, 1, WORLD_COLORS.soilSpeck);
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
    const gridX = Math.floor(px / TILE), gridY = Math.floor(py / TILE);
    const stableOffset = Math.floor(hash(gridX, gridY, 181) * 5) - 2;
    px += stableOffset + Math.round(Math.sin(now / 600 + hash(gridX, gridY, 180) * 7) * (mature ? 1 : 0.5));
    py += offset;
    const center = px + 24;
    const stage = progress === 0 ? 1 : progress === 1 ? 2 : mature ? 4 : 3;
    if (drawSprite(`crop-${crop.type}-${stage}`, center, py + 44, TILE * (mature ? 1.05 : 0.9), target)) return;
    const paint = (x, y, w, h, color) => { target.fillStyle = color; target.fillRect(Math.round(x), Math.round(y), w, h); };
    const line = (x1, y1, x2, y2, color) => {
      const dx = x2 - x1, dy = y2 - y1, steps = Math.max(Math.abs(dx), Math.abs(dy));
      target.fillStyle = color;
      if (!steps) { target.fillRect(Math.round(x1), Math.round(y1), 1, 1); return; }
      for (let i = 0; i <= steps; i++) target.fillRect(Math.round(x1 + dx * i / steps), Math.round(y1 + dy * i / steps), 1, 1);
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
    const x = FIELD_X + state.farmer.x * TILE + 3;
    const walking = now < walkingUntil;
    const frame = walking ? Math.floor(now / 65) % 4 : 0;
    const feet = [0, 2, 0, -2][frame];
    const y = FIELD_Y + state.farmer.y * TILE + 5 + (walking ? -(frame % 2) : Math.floor(now / 900) % 2);
    const facing = state.farmer.facing;
    shadow(x + 21, y + 39, 16, 5);
    const spriteFrame = walking ? [1, 0, 2, 0][frame] : 0;
    const spriteDrawn = drawSpriteH(`char-farmer-${facing}-${spriteFrame}`, FIELD_X + state.farmer.x * TILE + TILE / 2,
      FIELD_Y + state.farmer.y * TILE + 46 + (y - (FIELD_Y + state.farmer.y * TILE + 5)), FARMER_H);
    ctx.save(); ctx.translate(x + 21, y + 39); ctx.scale(CHARACTER_SCALE, CHARACTER_SCALE); ctx.translate(-(x + 21), -(y + 39));
    if (!spriteDrawn) {
      box(x + 10, y + 29, 8, 7 + feet, WORLD_COLORS.pants);
    box(x + 23, y + 29, 8, 7 - feet, WORLD_COLORS.pants);
    box(x + 9, y + 35 + feet, 10, 4, WORLD_COLORS.shoes);
    box(x + 22, y + 35 - feet, 10, 4, WORLD_COLORS.shoes);
    box(x + 8, y + 20, 25, 13, facing === 'up' ? WORLD_COLORS.shirt : WORLD_COLORS.denim);
    box(x + 8, y + 30, 25, 3, WORLD_COLORS.denimDark);
    box(x + 11, y + 22, 18, 2, WORLD_COLORS.denimLight);
    pixelLine(x + 12, y + 26.5, x + 16, y + 31, WORLD_COLORS.denimDark);
    pixelLine(x + 26, y + 24, x + 28, y + 30.5, WORLD_COLORS.waterLight);
    const arms = { up: [7, 30], down: [5, 32], left: [6, 31], right: [6, 31] }[facing];
    box(x + arms[0], y + 22 + feet, 5, 10, WORLD_COLORS.skinLight);
    if (facing === 'up' || facing === 'down') box(x + arms[1], y + 22 - feet, 5, 10, WORLD_COLORS.skinLight);
    box(x + 12, y + 9, 18, 14, WORLD_COLORS.skin);
    if (facing === 'up') {
      box(x + 12, y + 11, 18, 13, WORLD_COLORS.bark);
      pixelLine(x + 13, y + 22, x + 27, y + 31, WORLD_COLORS.denimLight, 2);
      pixelLine(x + 29, y + 22, x + 15, y + 31, WORLD_COLORS.denimLight, 2);
    } else if (facing === 'down') {
      box(x + 13, y + 21, 4, 10, WORLD_COLORS.denimLight); box(x + 26, y + 21, 4, 10, WORLD_COLORS.denimLight);
      box(x + 15, y + 29, 2, 2, WORLD_COLORS.hat); box(x + 26, y + 29, 2, 2, WORLD_COLORS.hat);
    } else pixelLine(x + (facing === 'left' ? 11 : 30), y + 23, x + (facing === 'left' ? 11 : 30), y + 33, WORLD_COLORS.denimDark);
    box(x + 10, y + 7, 22, 6, WORLD_COLORS.hatBand);
    box(x + (facing === 'left' ? 2 : facing === 'right' ? 10 : 6), y + 4, 30, 6, WORLD_COLORS.hatBrim);
    box(x + 12, y, 18, 7, WORLD_COLORS.hat);
    box(x + 16, y + 2, 11, 1, WORLD_COLORS.woodLight);
    for (let i = 0; i < 5; i++) pixelLine(x + 13 + i * 3, y + 2, x + 16 + i * 3, y + 6, WORLD_COLORS.roofRidge);
      if (facing !== 'up') {
      if (facing === 'left') box(x + 13, y + 16, 3, 3, WORLD_COLORS.ink);
      else if (facing === 'right') box(x + 27, y + 16, 3, 3, WORLD_COLORS.ink);
      else {
        box(x + 16, y + 15, 3, 3, WORLD_COLORS.ink);
        box(x + 25, y + 15, 3, 3, WORLD_COLORS.ink);
        box(x + 20, y + 20, 3, 1, WORLD_COLORS.roofRed);
      }
      const eyeX = facing === 'left' ? x + 13 : facing === 'right' ? x + 29 : x + 16;
      box(eyeX, y + 15, 1, 1, WORLD_COLORS.windowGlow);
      if (facing === 'down') box(x + 27, y + 15, 1, 1, WORLD_COLORS.windowGlow);
      }
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
    ctx.restore();
  }

  function drawVillager(id, person, now) {
    const x = FIELD_X + person.x * TILE, baseY = FIELD_Y + person.y * TILE;
    const y = baseY + Math.round(Math.sin(now / 760 + person.x * 0.8) * 1);
    const short = id === 'hunter' ? 3 : 0;
    shadow(x + 24, baseY + 40, 13, 4);
    ctx.save(); ctx.translate(x + 24, baseY + 40); ctx.scale(CHARACTER_SCALE, CHARACTER_SCALE); ctx.translate(-(x + 24), -(baseY + 40));
    box(x + 16, y + 19 + short, 16, 20 - short, { mayor: WORLD_COLORS.hutBlue, merchant: WORLD_COLORS.hutRed, hunter: WORLD_COLORS.hutGreen }[id]);
    box(x + 18, y + 21 + short, 4, 15 - short, WORLD_COLORS.shadow);
    box(x + 23, y + 20 + short, 7, 2, WORLD_COLORS.wall);
    box(x + 19, y + 9 + short, 11, 12, WORLD_COLORS.skin);
    box(x + 20, y + 11 + short, 3, 2, WORLD_COLORS.skinLight);
    if (id === 'mayor') {
      box(x + 16, y + 4, 17, 4, WORLD_COLORS.ink); box(x + 19, y, 11, 6, WORLD_COLORS.hutBlue);
      box(x + 18, y + 17, 13, 8, WORLD_COLORS.beard); box(x + 20, y + 23, 9, 4, WORLD_COLORS.beard);
    } else if (id === 'merchant') {
      box(x + 16, y + 6, 17, 7, WORLD_COLORS.scarf); box(x + 18, y + 3, 13, 5, WORLD_COLORS.hutRed);
      box(x + 19, y + 23, 11, 14, WORLD_COLORS.beard); pixelLine(x + 19, y + 25, x + 30, y + 25, WORLD_COLORS.hutRed);
    } else {
      box(x + 16, y + 7, 17, 5, WORLD_COLORS.hunterHat); box(x + 20, y + 3, 12, 6, WORLD_COLORS.hutGreen);
      pixelLine(x + 13, y + 15, x + 10, y + 35, WORLD_COLORS.woodDark, 2); pixelLine(x + 10, y + 15, x + 10, y + 35, WORLD_COLORS.hat, 1);
    }
    ctx.restore();
    const labelY = baseY - 25 + (y - baseY);
    box(x + 1, labelY, 46, 14, WORLD_COLORS.woodDark); label(F.VILLAGERS[id].name, x + 3, labelY + 11, WORLD_COLORS.windowGlow, 10);
    if (Math.abs(person.x - state.farmer.x) + Math.abs(person.y - state.farmer.y) <= 1) {
      box(x - 7, labelY - 16, 62, 14, WORLD_COLORS.windowGlow); label('空格交谈', x - 4, labelY - 5, WORLD_COLORS.woodDark, 10);
    }
  }

  function drawBandit(enemy, now) {
    const x = FIELD_X + enemy.x * TILE, y = FIELD_Y + enemy.y * TILE;
    const lean = enemy.retreating ? 5 : 0, cape = Math.floor(now / 120) % 2 ? 3 : -2;
    ctx.save(); ctx.translate(x + 24, y + 39); ctx.scale(CHARACTER_SCALE, CHARACTER_SCALE); ctx.translate(-(x + 24), -(y + 39));
    box(x + 13 + lean, y + 12, 23, 26, now < battleFlashUntil ? WORLD_COLORS.whiteFlash : enemy.retreating ? WORLD_COLORS.banditEdge : WORLD_COLORS.bandit);
    box(x + 10 + lean, y + 27, 8 + cape, 12, WORLD_COLORS.capeLight); box(x + 27 + lean, y + 27, 8 - cape, 12, WORLD_COLORS.capeDark);
    pixelLine(x + 11 + lean, y + 31, x + 34 + lean, y + 35, WORLD_COLORS.banditEdge);
    box(x + 9 + lean, y + 8, 30, 8, WORLD_COLORS.banditMask); box(x + 14 + lean, y + 16, 20, 8, WORLD_COLORS.banditMask);
    box(x + 17 + lean, y + 13, 3, 2, WORLD_COLORS.whiteFlash); box(x + 29 + lean, y + 13, 3, 2, WORLD_COLORS.whiteFlash);
    ctx.restore();
    label(`♥${Math.max(0, enemy.health)}`, x + 12 + lean, y - 4, WORLD_COLORS.windowGlow, 10);
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
    const visible = F.visibleCellRange(camera, SCENE_WIDTH, SCENE_HEIGHT, TILE, 1);
    const sx = Math.max(0, camera.x), sy = Math.max(0, camera.y);
    const sw = Math.min(WORLD_WIDTH, SCENE_WIDTH), sh = Math.min(WORLD_HEIGHT, SCENE_HEIGHT);
    ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    ctx.drawImage(staticCanvas, sx * STATIC_SCALE, sy * STATIC_SCALE, sw * STATIC_SCALE, sh * STATIC_SCALE,
      Math.max(0, -camera.x), Math.max(0, -camera.y), sw, sh);
    if (state.weather === 'rain') { ctx.fillStyle = WORLD_COLORS.rainShade; ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT); }
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawAmbient(now, visible);
    drawPondRipples(now, visible);
    drawResourceNodes(now, visible);
    if (fishing?.phase === 'bite') {
      const bx = fishing.x * TILE + 24, by = fishing.y * TILE - 4;
      box(bx - 12, by - 20, 24, 24, WORLD_COLORS.windowGlow);
      label('!', bx - 6, by, WORLD_COLORS.danger || WORLD_COLORS.roofRed, 24);
    }
    for (let y = visible.top; y <= visible.bottom; y++) {
      for (let x = visible.left; x <= visible.right; x++) drawPlot(state.plots[y][x], x, y);
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
      if (person.x < visible.left || person.x > visible.right || person.y < visible.top || person.y > visible.bottom) continue;
      drawVillager(id, person, now);
    }
    if (battle) {
      ctx.fillStyle = 'rgba(15, 30, 79, 0.48)';
      ctx.fillRect(camera.x, camera.y, SCENE_WIDTH, SCENE_HEIGHT);
      for (const enemy of battle.enemies) {
        if (enemy.x < visible.left || enemy.x > visible.right || enemy.y < visible.top || enemy.y > visible.bottom) continue;
        drawBandit(enemy, now);
      }
      label('守夜中 · 面向强盗按使用键挥砍', camera.x + 215, camera.y + 62, '#fff4cf', 15);
    }
    for (const particle of particles) {
      if (particle.x < camera.x - TILE || particle.x > camera.x + SCENE_WIDTH + TILE || particle.y < camera.y - TILE || particle.y > camera.y + SCENE_HEIGHT + TILE) continue;
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
      else if (particle.kind === 'dust') {
        const size = 2 + Math.floor(particle.age / particle.life * 3);
        box(particle.x - size, particle.y - Math.floor(size / 2), size * 2, size, particle.color);
        box(particle.x - Math.floor(size / 2), particle.y - size, size, size * 2, particle.color);
      }
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
    const weatherNames = { sunny: '☀ 晴', cloudy: '☁ 多云', rain: '☂ 雨' };
    document.getElementById('weather').textContent = weatherNames[state.weather];
    document.getElementById('tomorrow').textContent = '';
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
    document.getElementById('tools').innerHTML = `<button type="button" class="tool ${state.autoTool ? 'active' : ''}" data-auto-tool="true" aria-pressed="${state.autoTool}"><span class="tool-name">自动</span><span class="tool-icon">${icons.auto}</span><span>自动</span><small>0</small></button>` + keys.map((key, i) =>
      `<button type="button" class="tool ${state.tool === key ? 'active' : ''} ${toolBounce === key && performance.now() < bounceUntil ? 'bump' : ''}" data-tool="${key}" aria-pressed="${state.tool === key}"><span class="tool-name">${F.TOOLS[key].name}</span><span class="tool-icon">${icons[key]}</span><span>${F.TOOLS[key].name}</span><small>${i + 1}</small></button>`
    ).join('');
    document.getElementById('crop-options').innerHTML = '<span>播种：</span>' + Object.entries(F.CROPS).map(([key, crop]) =>
      `<button type="button" class="crop-choice ${state.selectedCrop === key ? 'active' : ''}" data-crop="${key}" aria-pressed="${state.selectedCrop === key}">${crop.name} × ${state.seeds[key]}${state.seeds[key] ? '' : '<span class="buy-badge">去买</span>'}</button>`
    ).join('');
    document.getElementById('bag').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="bag-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}</span><span>× ${state.bag[key]} · ${crop.sellPrice} G/份 · 小计 ${state.bag[key] * crop.sellPrice} G</span><button type="button" data-eat="${key}">吃 +${F.FOOD_HEAL[key]}</button><button type="button" data-sell-one="${key}">卖 1</button><button type="button" data-sell-crop="${key}">卖全部</button></div>`
    ).join('') + '<h3>野外资源</h3>' + Object.entries(F.RESOURCES).map(([key, resource]) => `<div class="bag-row"><span>${resource.name}</span><span>× ${state.resources[key]} · ${resource.sellPrice} G/份</span>${F.FOOD_HEAL[key] ? `<button type="button" data-eat="${key}">吃 +${F.FOOD_HEAL[key]}</button>` : ''}<button type="button" data-resource-one="${key}">卖 1</button><button type="button" data-resource-all="${key}">卖全部</button></div>`).join('') + `<div class="bag-row"><span>饭团 × ${state.snacks}</span><button type="button" data-eat="snack">吃 +20</button></div><div class="bag-row"><span>木栅栏库存 × ${state.fenceStock}</span></div><div class="bag-row"><span>稻草人库存 × ${state.scarecrowStock}</span></div>`;
    document.getElementById('shop').innerHTML = Object.entries(F.CROPS).map(([key, crop]) => {
      const total = F.seedPrice(state, key) * buyAmounts[key];
      return `<div class="shop-row" data-shop-row="${key}"><i class="crop-dot" style="background:${cropColors[key]}"></i><span class="row-copy"><strong>${crop.name}种子</strong><small>${crop.days} 天成熟 · 已有 ${state.seeds[key]}${state.villagers.merchant.hearts >= 3 ? ' · 婆婆友情价 9 折' : ''}</small></span><span class="quantity-control"><button type="button" data-buy-step="${key}" data-delta="-1">−</button><b>${buyAmounts[key]}</b><button type="button" data-buy-step="${key}" data-delta="1">+</button><button type="button" data-buy-five="${key}">×5</button></span><span class="row-price ${state.gold < total ? 'unaffordable' : ''}">${total} G</span><button type="button" data-buy="${key}" class="${state.gold < total ? 'cant-afford' : ''}" aria-disabled="${state.gold < total}">购买</button></div>`;
    }).join('') + `<div id="weapon-shop"><strong>武器 · 高档替换低档，旧武器不退款</strong><p>当前：${F.WEAPONS[state.weapon].name}</p>${Object.entries(F.WEAPONS).filter(([key]) => key !== 'none').map(([key, weapon]) => `<div class="shop-row"><span class="row-copy"><strong>${weapon.name}</strong><small>每击 ${weapon.damage} 点伤害</small></span><span class="row-price">${weapon.price} G</span><button type="button" data-weapon="${key}" ${weapon.damage <= F.WEAPONS[state.weapon].damage ? 'disabled' : ''}>购买</button></div>`).join('')}</div><div class="shop-row"><span class="row-icon" aria-hidden="true">▣</span><span class="row-copy"><strong>饭团</strong><small>恢复 20 生命</small></span><span class="row-price ${state.gold < 20 ? 'unaffordable' : ''}">20 G</span><button type="button" data-snack="buy" class="${state.gold < 20 ? 'cant-afford' : ''}" aria-disabled="${state.gold < 20}">购买</button></div>`;
    document.getElementById('bag-value').textContent = `背包总价值（作物+资源）：${Object.entries(F.CROPS).reduce((sum, [key, crop]) => sum + state.bag[key] * crop.sellPrice, 0) + Object.entries(F.RESOURCES).reduce((sum, [key, resource]) => sum + state.resources[key] * resource.sellPrice, 0)} G`;
    document.getElementById('log').innerHTML = journal.map(item => `<li>${item}</li>`).join('');
    document.getElementById('orders-list').innerHTML = state.orders.length ? state.orders.map(order => `<div class="order-row"><span>${F.CROPS[order.crop].name} × ${order.amount} · 第 ${order.deadline} 天前<br>奖励 ${order.reward} G · 背包 ${state.bag[order.crop]}</span><button type="button" ${order.accepted === false ? `data-accept="${order.id}">接单` : `data-deliver="${order.id}">交付`}</button></div>`).join('') : '<p>今日没有订单，睡觉后刷新。</p>';
    document.getElementById('stats-list').innerHTML = `<p>累计收入：${state.stats.income} G</p><p>累计收获：${state.stats.harvested}</p><p>累计采集：${state.stats.gathered}</p><p>累计钓鱼：${state.stats.fished}</p><p>累计制作：${state.stats.crafted}</p><p>完成订单：${state.stats.orders}</p><p>击退强盗：${state.stats.repelled}</p><p>已玩天数：${state.stats.days}</p>`;
    const unlocked = new Set(state.achievements);
    document.getElementById('achievements-list').innerHTML = `<h3>成就 ${unlocked.size}/${F.ACHIEVEMENTS.length}</h3>` + F.ACHIEVEMENTS.map(item => `<div class="achievement ${unlocked.has(item.id) ? 'unlocked' : 'locked'}"><strong>${unlocked.has(item.id) ? '✓ ' : ''}${item.name}</strong><span>${item.description} · +${item.reward}G</span></div>`).join('');
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
      const snow = state.weather !== 'rain' && F.season(state) === '冬';
      for (let i = 0; i < 2; i++) addParticle((now * 3 + i * 251) % WORLD_WIDTH, -10 - i * 120, snow ? 0 : -0.25, snow ? 0.14 : 0.85, snow ? 4500 : 850, snow ? '#f5f8edc9' : '#b7e5e8a0', snow ? 'snow' : 'rain');
      lastRain = now;
    }
    if (now - lastSpark >= 900) {
      const mature = [];
      const sparkleVisible = F.visibleCellRange(camera, SCENE_WIDTH, SCENE_HEIGHT, TILE, 1);
      for (let y = sparkleVisible.top; y <= sparkleVisible.bottom; y++) for (let x = sparkleVisible.left; x <= sparkleVisible.right; x++) {
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
      if (state.weather !== previousWeather) enqueueToast({ rain: '天气转雨，作物生长加速', cloudy: '明天多云，作物照常生长', sunny: '明天放晴，作物照常生长' }[state.weather], 'info');
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
    cancelFishing('切换工具取消了垂钓');
    initAudio();
    if (key !== 'build') buildChoice = null;
    const outcome = F.selectTool(state, key);
    if (outcome.ok) { toolBounce = key; bounceUntil = performance.now() + 800; }
    handle(outcome, true);
  }

  function selectAutoTool() {
    cancelFishing('切换工具取消了垂钓');
    buildChoice = null;
    handle(F.selectAutoTool(state), true);
  }

  function openCodex() {
    cancelFishing('打开面板取消了垂钓');
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
    const like = F.VILLAGERS[speakingTo].likes;
    const likeName = F.CROPS[like]?.name || F.RESOURCES[like]?.name;
    document.getElementById('villager-gifts').innerHTML = `<p>好感 ♥ ${person.hearts}/5${person.giftedDay === state.day ? ' · 今日已送礼' : ''}</p><p>喜好：${person.likeKnown ? likeName : '???'}</p>` + Object.entries(F.CROPS).filter(([key]) => state.bag[key] > 0).map(([key, crop]) => `<button type="button" data-gift="${key}" ${person.giftedDay === state.day ? 'disabled' : ''}>送${crop.name} ×1</button>`).join('') + ['fish', 'berry'].filter(key => state.resources[key] > 0).map(key => `<button type="button" data-gift="${key}" ${person.giftedDay === state.day ? 'disabled' : ''}>送${F.RESOURCES[key].name} ×1</button>`).join('');
  }

  function drawVillagerPortrait(id) {
    const portrait = document.getElementById('villager-portrait');
    const scale = Math.min(2, window.devicePixelRatio || 1);
    portrait.width = 48 * scale; portrait.height = 48 * scale;
    const portraitContext = portrait.getContext('2d'); portraitContext.scale(scale, scale); portraitContext.imageSmoothingEnabled = false;
    const paint = (x, y, width, height, color) => { portraitContext.fillStyle = color; portraitContext.fillRect(x, y, width, height); };
    paint(0, 0, 48, 48, WORLD_COLORS.windowGlow); paint(9, 25, 30, 23, { mayor: WORLD_COLORS.hutBlue, merchant: WORLD_COLORS.hutRed, hunter: WORLD_COLORS.hutGreen }[id]);
    paint(14, 10, 20, 22, WORLD_COLORS.skin);
    if (id === 'mayor') {
      paint(9, 5, 30, 5, WORLD_COLORS.ink); paint(14, 1, 20, 7, WORLD_COLORS.hutBlue);
      paint(11, 25, 26, 13, WORLD_COLORS.beard); paint(16, 36, 16, 8, WORLD_COLORS.beard);
    } else if (id === 'merchant') {
      paint(10, 6, 28, 8, WORLD_COLORS.scarf); paint(14, 2, 20, 7, WORLD_COLORS.hutRed);
      paint(14, 29, 20, 19, WORLD_COLORS.beard); paint(18, 31, 12, 3, WORLD_COLORS.hutRed);
    } else {
      paint(9, 7, 30, 6, WORLD_COLORS.hunterHat); paint(16, 2, 20, 7, WORLD_COLORS.hutGreen);
      portraitContext.strokeStyle = WORLD_COLORS.woodDark; portraitContext.lineWidth = 3; portraitContext.beginPath(); portraitContext.arc(8, 28, 10, -1.2, 1.2); portraitContext.stroke();
    }
    paint(18, 18, 3, 3, WORLD_COLORS.ink); paint(28, 18, 3, 3, WORLD_COLORS.ink);
  }

  function openVillager(id) {
    cancelFishing('交谈取消了垂钓');
    input.use = false; input.direction = null;
    speakingTo = id;
    panelCloseToken++;
    const panel = document.getElementById('villager-panel');
    panel.hidden = false; panel.classList.remove('closing');
    document.getElementById('codex-panel').hidden = true;
    document.getElementById('orders-panel').hidden = true;
    document.getElementById('villager-title').textContent = `${F.VILLAGERS[id].name} · ${id === 'mayor' ? '看看今日订单' : id === 'merchant' ? '来挑点东西' : '今晚要当心'}`;
    document.getElementById('villager-line').textContent = F.villagerLine(state, id, talkTurns[id]++);
    drawVillagerPortrait(id);
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
    if (event.key === '0') { selectAutoTool(); return; }
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
    if (event.target.closest('[data-auto-tool]')) { selectAutoTool(); return; }
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
    if (button) { initAudio(); const price = F.seedPrice(state, button.dataset.buy) * buyAmounts[button.dataset.buy]; const outcome = F.buySeed(state, button.dataset.buy, buyAmounts[button.dataset.buy]); if (!outcome.ok) { outcome.message = `金币不足，还差 ${price - state.gold} G`; sound('error'); } handle(outcome, true); }
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
  document.getElementById('orders-button').addEventListener('click', () => { initAudio(); cancelFishing('打开面板取消了垂钓'); panelCloseToken++; document.getElementById('orders-panel').classList.remove('closing'); document.getElementById('orders-panel').hidden = false; document.getElementById('codex-panel').hidden = true; document.body.classList.add('modal-open'); document.getElementById('close-orders').focus?.(); });
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
  function showCodexSection(id) { for (const section of ['codex-list', 'stats-list', 'achievements-list']) document.getElementById(section).hidden = section !== id; }
  document.getElementById('crop-tab').addEventListener('click', () => showCodexSection('codex-list'));
  document.getElementById('stats-tab').addEventListener('click', () => showCodexSection('stats-list'));
  document.getElementById('achievements-tab').addEventListener('click', () => showCodexSection('achievements-list'));
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
