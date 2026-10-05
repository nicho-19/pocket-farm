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
const drawing = { fillRect() {}, fillText() {}, imageSmoothingEnabled: false };
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, style: {}, dataset: {}, hidden: true,
    classList: { toggle() {} },
    addEventListener(name, handler) { this[`on_${name}`] = handler; },
    setAttribute() {},
    getContext() { return drawing; },
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
  getElementById: element,
  querySelector: element,
  addEventListener(name, handler) { listeners[name] = handler; }
};
const callbacks = [];
const storage = new Map();
const context = vm.createContext({
  document,
  window: {},
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => 0 },
  requestAnimationFrame: callback => callbacks.push(callback),
  HTMLButtonElement: class {},
  confirm: () => true,
  console
});
for (const script of scripts) vm.runInContext(script, context, { filename: file });
assert.ok(context.PocketFarm);
assert.match(element('crop-options').innerHTML, /草莓/);
assert.match(element('crop-options').innerHTML, /玉米/);
assert.equal(callbacks.length, 1);
callbacks.shift()(16);
assert.equal(callbacks.length, 1);
listeners.keydown({ key: 'ArrowUp', preventDefault() {} });
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.y, 3);
element('codex').on_click();
assert.match(element('codex-list').innerHTML, /每 G 投入回收/);
assert.equal(element('codex-panel').hidden, false);
element('close-codex').on_click();
assert.equal(element('codex-panel').hidden, true);
element('mute').on_click();
assert.equal(storage.get('pocket-farm-muted'), 'true');
element('.dpad').on_pointerdown({ target: { closest: () => ({ dataset: { direction: 'left' } }) }, preventDefault() {} });
assert.equal(JSON.parse(storage.get('pocket-farm-save-v1')).farmer.x, 4);
console.log('单文件初始化通过：两段内联脚本、五种作物界面、Canvas 帧、键盘与虚拟方向键、图鉴和静音正常。');
