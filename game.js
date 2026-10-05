(function () {
  'use strict';

  const F = globalThis.PocketFarm;
  const SAVE_KEY = 'pocket-farm-save-v1';
  const TILE = 48;
  const FIELD_X = 96;
  const FIELD_Y = 96;
  const canvas = document.getElementById('farm');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const palette = {
    '春': { grass: '#8eb76b', grassDark: '#75a05d', light: '#b9ce80', sky: '#d7e4b2' },
    '夏': { grass: '#74ad63', grassDark: '#5d9857', light: '#a8c66a', sky: '#c5dfad' },
    '秋': { grass: '#b2aa67', grassDark: '#969658', light: '#d1bf77', sky: '#e7d4aa' },
    '冬': { grass: '#aac1b8', grassDark: '#8aada8', light: '#d8dfd0', sky: '#dfe9e1' }
  };
  const cropColors = { carrot: '#ef9252', potato: '#d5b481', pumpkin: '#e5a44b' };
  const icons = { hoe: '⚒', seed: '✿', water: '◆', scythe: '☷' };
  const keys = ['hoe', 'seed', 'water', 'scythe'];
  let state = load() || F.createGame();
  let journal = ['欢迎来到口袋田园！先开垦一块地吧。'];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (saved && saved.version === 1 && saved.plots?.length === F.HEIGHT &&
          saved.plots.every(row => Array.isArray(row) && row.length === F.WIDTH) &&
          saved.farmer && F.TOOLS[saved.tool] && F.CROPS[saved.selectedCrop]) return saved;
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
    ctx.fillText(text, x, y);
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
    if (plot.crop) drawCrop(plot.crop, px, py);
  }

  function drawCrop(crop, px, py) {
    const progress = crop.progress;
    const mature = progress >= F.CROPS[crop.type].days;
    const center = px + 24;
    if (progress === 0) {
      box(center - 6, py + 27, 12, 6, '#a77b53');
      box(center - 2, py + 24, 4, 5, '#e6d3a4');
      return;
    }
    if (progress === 1) {
      box(center - 2, py + 23, 4, 15, '#5b914c');
      box(center - 10, py + 21, 9, 6, '#77b758');
      box(center + 1, py + 19, 9, 6, '#69a753');
      return;
    }
    if (crop.type === 'carrot') {
      box(center - 2, py + 13, 4, 25, '#4c853e');
      box(center - 12, py + 17, 11, 6, '#66a94c');
      box(center + 1, py + 14, 12, 7, '#80b951');
      box(center - 8, py + 9, 6, 11, '#78b353');
      if (mature) {
        box(center - 9, py + 26, 18, 10, '#dc6b3d');
        box(center - 7, py + 36, 14, 5, '#ef8b47');
        box(center - 4, py + 41, 8, 3, '#edb361');
      }
    } else if (crop.type === 'potato') {
      box(center - 15, py + 24, 30, 12, '#4d8b47');
      box(center - 11, py + 17, 13, 12, '#6fab55');
      box(center + 1, py + 14, 14, 15, '#79b45f');
      box(center - 4, py + 10, 8, 9, '#5c9d4c');
      if (mature) {
        box(center - 16, py + 32, 13, 9, '#c9a376');
        box(center + 3, py + 31, 14, 10, '#d8b684');
        box(center - 11, py + 35, 2, 2, '#9a7758');
        box(center + 9, py + 34, 2, 2, '#9a7758');
      }
    } else {
      box(center - 18, py + 30, 36, 5, '#4f8541');
      box(center - 17, py + 23, 12, 11, '#6da449');
      box(center + 6, py + 20, 12, 12, '#76ad4d');
      box(center - 2, py + 15, 4, 17, '#5c8739');
      if (mature) {
        box(center - 17, py + 23, 34, 18, '#cd7034');
        box(center - 12, py + 19, 24, 23, '#e6973d');
        box(center - 4, py + 21, 8, 20, '#f3ad4d');
        box(center - 3, py + 16, 6, 6, '#598141');
      }
    }
    if (mature) box(px + 38, py + 7, 4, 4, '#ffe7a0');
  }

  function drawFarmer() {
    const x = FIELD_X + state.farmer.x * TILE + 9;
    const y = FIELD_Y + state.farmer.y * TILE + 5;
    box(x + 5, y + 36, 28, 5, '#4d60405c');
    box(x + 9, y + 31, 8, 7, '#524c57');
    box(x + 24, y + 31, 8, 7, '#524c57');
    box(x + 8, y + 20, 25, 13, '#557d8b');
    box(x + 5, y + 22, 5, 10, '#edb881');
    box(x + 32, y + 22, 5, 10, '#edb881');
    box(x + 12, y + 9, 18, 14, '#e8ae7a');
    box(x + 10, y + 7, 22, 6, '#704f42');
    box(x + 6, y + 4, 30, 6, '#b48b56');
    box(x + 12, y, 18, 7, '#ccaa68');
    if (state.farmer.facing !== 'up') {
      if (state.farmer.facing === 'left') box(x + 13, y + 16, 3, 3, '#3c4540');
      else if (state.farmer.facing === 'right') box(x + 27, y + 16, 3, 3, '#3c4540');
      else {
        box(x + 16, y + 15, 3, 3, '#3c4540');
        box(x + 25, y + 15, 3, 3, '#3c4540');
      }
    }
  }

  function drawScene() {
    drawBackground();
    drawHouse();
    for (let y = 0; y < F.HEIGHT; y++) {
      for (let x = 0; x < F.WIDTH; x++) drawPlot(state.plots[y][x], x, y);
    }
    const front = F.frontCell(state);
    if (front.x >= 0 && front.y >= 0 && front.x < F.WIDTH && front.y < F.HEIGHT) {
      const px = FIELD_X + front.x * TILE, py = FIELD_Y + front.y * TILE;
      box(px + 3, py + 2, 42, 3, '#fff0aa');
      box(px + 3, py + 43, 42, 3, '#fff0aa');
      box(px + 2, py + 3, 3, 40, '#fff0aa');
      box(px + 43, py + 3, 3, 40, '#fff0aa');
    }
    drawFarmer();
  }

  function render() {
    document.getElementById('date').textContent = `${F.season(state)} · 第 ${F.seasonDay(state)} 天`;
    document.getElementById('weather').textContent = state.weather === 'rain' ? '☂ 雨天' : '☀ 晴天';
    document.getElementById('gold').textContent = `${state.gold} G`;
    document.getElementById('energy-text').textContent = `${state.energy} / ${F.ENERGY_MAX}`;
    document.getElementById('energy-fill').style.width = `${state.energy / F.ENERGY_MAX * 100}%`;
    document.getElementById('tools').innerHTML = keys.map((key, i) =>
      `<button type="button" class="tool ${state.tool === key ? 'active' : ''}" data-tool="${key}" aria-pressed="${state.tool === key}"><span class="tool-icon">${icons[key]}</span><span>${F.TOOLS[key].name}</span><small>${i + 1}</small></button>`
    ).join('');
    document.getElementById('crop-options').innerHTML = '<span>播种：</span>' + Object.entries(F.CROPS).map(([key, crop]) =>
      `<button type="button" class="crop-choice ${state.selectedCrop === key ? 'active' : ''}" data-crop="${key}" aria-pressed="${state.selectedCrop === key}">${crop.name} × ${state.seeds[key]}</button>`
    ).join('');
    document.getElementById('bag').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="bag-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}</span><strong>× ${state.bag[key]}</strong></div>`
    ).join('');
    document.getElementById('shop').innerHTML = Object.entries(F.CROPS).map(([key, crop]) =>
      `<div class="shop-row"><span><i class="crop-dot" style="background:${cropColors[key]}"></i>${crop.name}<small>${crop.days} 天 · 售 ${crop.sellPrice} G</small></span><button type="button" data-buy="${key}">买种子 ${crop.seedPrice} G</button></div>`
    ).join('');
    document.getElementById('log').innerHTML = journal.map(item => `<li>${item}</li>`).join('');
    drawScene();
  }

  document.addEventListener('keydown', event => {
    const direction = { w: 'up', ArrowUp: 'up', s: 'down', ArrowDown: 'down', a: 'left', ArrowLeft: 'left', d: 'right', ArrowRight: 'right' }[event.key];
    if (direction) { event.preventDefault(); handle(F.move(state, direction), true); return; }
    if (event.key >= '1' && event.key <= '4') { handle(F.selectTool(state, keys[Number(event.key) - 1]), true); return; }
    if (event.key === ' ' || event.key === 'Enter') {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      handle(F.act(state), true);
    }
  });
  document.getElementById('tools').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (button) handle(F.selectTool(state, button.dataset.tool), true);
  });
  document.getElementById('crop-options').addEventListener('click', event => {
    const button = event.target.closest('[data-crop]');
    if (button) handle(F.selectCrop(state, button.dataset.crop), true);
  });
  document.getElementById('shop').addEventListener('click', event => {
    const button = event.target.closest('[data-buy]');
    if (button) handle(F.buySeed(state, button.dataset.buy, 1), true);
  });
  document.getElementById('sell-all').addEventListener('click', () => handle(F.sellAll(state), true));
  document.getElementById('sleep').addEventListener('click', () => handle(F.sleep(state), true));
  document.getElementById('new-game').addEventListener('click', () => {
    if (!confirm('开始新游戏？当前农场进度会被覆盖。')) return;
    state = F.createGame();
    journal = ['新的农场生活开始了！'];
    handle({ ok: true, message: '新游戏已开始', events: [] }, true);
  });
  document.getElementById('hint').textContent = '用 WASD 或方向键移动；面向地块，按空格或回车使用当前工具。';
  render();
})();
