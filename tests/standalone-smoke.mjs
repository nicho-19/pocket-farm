import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../pocket-farm-standalone.html');
const html = readFileSync(file, 'utf8');
assert.equal(/<link[^>]+style\.css|<script[^>]+src=/.test(html), false);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 2);

const elements = new Map();
const listeners = {};
const windowListeners = {};
let sceneWidth = 768;
let blits = 0;
let staticRebuilds = 0;
const drawing = { fillRect() {}, fillText() {}, scale() {}, clearRect() { staticRebuilds++; }, drawImage() { blits++; }, createLinearGradient() { return { addColorStop() {} }; }, moveTo() {}, lineTo() {}, beginPath() {}, ellipse() {}, fill() {}, stroke() {}, strokeRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, imageSmoothingEnabled: true };
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, style: { setProperty(name, value) { this[name] = value; } }, dataset: {}, hidden: true,
    classList: {
      values: new Set(),
      toggle(name, force) { if (force === undefined ? !this.values.has(name) : force) this.values.add(name); else this.values.delete(name); },
      add(name) { this.values.add(name); }, remove(name) { this.values.delete(name); },
      contains(name) { return this.values.has(name); }
    },
    addEventListener(name, handler) { this[`on_${name}`] = handler; },
    setAttribute() {},
    scrollIntoView() {},
    getContext() { return drawing; },
    getBoundingClientRect() { return { left: 0, top: 0, width: sceneWidth, height: sceneWidth * 0.75 }; },
    querySelectorAll(selector) {
      if (id !== 'codex-list' || selector !== 'canvas') return [];
      return ['carrot', 'potato', 'pumpkin', 'strawberry', 'corn'].map(type => ({
        dataset: { preview: type }, getContext: () => drawing
      }));
    }
  });
  return elements.get(id);
}
const document = {
  body: { classList: { add() {}, remove() {} } },
  createElement(tag) { assert.equal(tag, 'canvas'); return { getContext: () => drawing }; },
  getElementById: element,
  querySelector: element,
  addEventListener(name, handler) { listeners[name] = handler; }
};
const callbacks = [];
const storage = new Map();
let now = 0;
const context = vm.createContext({
  document,
  window: { devicePixelRatio: 2, addEventListener(name, handler) { windowListeners[name] = handler; } },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => now },
  requestAnimationFrame: callback => callbacks.push(callback),
  setTimeout: callback => { callback(); return 1; },
  HTMLButtonElement: class {},
  confirm: () => true,
  console
});
for (const script of scripts) vm.runInContext(script, context, { filename: file });
assert.equal(element('farm').width, 3072);
assert.equal(element('farm').height, 2304);
assert.ok(context.PocketFarm);
assert.equal(context.PocketFarm.createGame().tutorial, 0);
const oldSave = context.PocketFarm.createGame();
delete oldSave.tutorial;
assert.equal(context.PocketFarm.migrateSave(oldSave).tutorial, 2);
assert.equal(element('season-banner').hidden, false);
assert.match(element('season-banner').textContent, /春 · 第 1 天/);
assert.equal(element('tutorial').hidden, false);
assert.ok(element('toast-stack'));
assert.match(element('crop-options').innerHTML, /草莓/);
assert.match(element('crop-options').innerHTML, /玉米/);
assert.equal(callbacks.length, 1);
callbacks.shift()(16);
assert.equal(callbacks.length, 1);
listeners.keydown({ key: 'ArrowUp', preventDefault() {} });
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.y, 4);
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.facing, 'up');
now = 120;
callbacks.shift()(now);
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.y, 3);
listeners.keyup({ key: 'ArrowUp' });
element('codex').on_click();
assert.match(element('codex-list').innerHTML, /每 G 投入回收/);
assert.equal(element('codex-panel').hidden, false);
element('close-codex').on_click();
assert.equal(element('codex-panel').hidden, true);
element('mute').on_click();
assert.equal(storage.get('pocket-farm-muted'), 'true');
element('shop').on_click({ target: { closest: selector => selector === '[data-upgrade]' ? { dataset: { upgrade: 'hoe' } } : null } });
assert.match(element('toast-stack').innerHTML, /还差 300 G/);
element('.dpad').on_pointerdown({ pointerId: 1, target: { closest: () => ({ dataset: { direction: 'left' } }) }, preventDefault() {} });
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.x, 5);
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.facing, 'left');
now = 240;
callbacks.shift()(now);
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.x, 4);
element('.dpad').on_pointerup({ pointerId: 1 });
element('orders-button').on_click();
assert.equal(element('orders-panel').hidden, false);
element('close-orders').on_click();
const frameStart = performance.now();
for (let i = 0; i < 60; i++) {
  now += 1000 / 60;
  callbacks.shift()(now);
  assert.equal(callbacks.length, 1);
}
const frameCost = performance.now() - frameStart;
assert.ok(blits >= 60, '每帧贴静态离屏层');
assert.equal(staticRebuilds, 1, '同一季节与天气下静态层只绘制一次');
sceneWidth = 360;
windowListeners.resize();
assert.equal(element('farm').width, 1440);
assert.equal(element('farm').height, 1080);
callbacks.shift()(now + 16);
assert.equal(staticRebuilds, 2, '显示尺寸改变后静态层重绘');
sceneWidth = 768;
const planted = context.PocketFarm.createGame();
assert.equal(context.PocketFarm.act(planted).ok, true);
context.PocketFarm.selectTool(planted, 'seed');
assert.equal(context.PocketFarm.act(planted).ok, true);
storage.set('pocket-farm-save-v1', JSON.stringify(planted));
const plantedContext = vm.createContext({
  document, window: { devicePixelRatio: 2, addEventListener() {} },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => now }, requestAnimationFrame() {}, setTimeout: callback => { callback(); return 1; },
  HTMLButtonElement: class {}, confirm: () => true, console
});
for (const script of scripts) vm.runInContext(script, plantedContext, { filename: file });
listeners.keydown({ key: 'ArrowDown', preventDefault() {} });
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.y, 5);
listeners.keyup({ key: 'ArrowDown' });
const tired = context.PocketFarm.createGame();
tired.energy = 11;
storage.set('pocket-farm-save-v1', JSON.stringify(tired));
const lowContext = vm.createContext({
  document, window: { devicePixelRatio: 2, addEventListener() {} },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => now }, requestAnimationFrame() {}, setTimeout: callback => { callback(); return 1; },
  HTMLButtonElement: class {}, confirm: () => true, console
});
for (const script of scripts) vm.runInContext(script, lowContext, { filename: file });
element('touch-use').on_pointerdown({ preventDefault() {}, currentTarget: { setPointerCapture() {} }, pointerId: 2 });
assert.equal(element('energy-item').classList.contains('low-energy'), true);
assert.match(element('toast-stack').innerHTML, /体力快用完了/);
const refunded = context.PocketFarm.createGame();
refunded.version = 3;
refunded.upgrades.water = true;
refunded.tool = 'water';
refunded.plots[5][5].tilled = true;
refunded.plots[5][5].crop = { type: 'carrot', progress: 2 };
refunded.plots[5][5].watered = false;
storage.set('pocket-farm-save-v1', JSON.stringify(refunded));
const refundContext = vm.createContext({
  document, window: { devicePixelRatio: 2, addEventListener() {} },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => now }, requestAnimationFrame() {}, setTimeout: callback => { callback(); return 1; },
  HTMLButtonElement: class {}, confirm: () => true, console
});
for (const script of scripts) vm.runInContext(script, refundContext, { filename: file });
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).gold, 700);
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).plots[5][5].crop.progress, 2);
assert.match(element('log').innerHTML, /水壶已回收，返还 600G/);
assert.match(element('toast-stack').innerHTML, /水壶已回收，返还 600G/);
console.log('单文件初始化通过：两段内联脚本、五种作物界面、高清 Canvas、键盘和虚拟键转向优先、订单面板、图鉴和静音正常。');
console.log('新增 UI 断言通过：今晚预报、建造面板、回家寻路、toast、旧档退款提示、换季横幅与低体力警示。');
console.log('播种后移动冒烟通过；3072×2304 与窄屏 1440×1080 backstore、逐帧贴图和静态层按需重绘断言通过。');
console.log(`模拟 Canvas 连续 60 帧完成：总耗时 ${frameCost.toFixed(1)} ms，平均 ${(frameCost / 60).toFixed(2)} ms/帧。`);
