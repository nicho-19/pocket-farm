import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../farm-logic.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'farm-logic.js' });
const F = context.PocketFarm;
let passed = 0;

function check(name, run) {
  run();
  passed++;
  console.log(`✓ ${name}`);
}

function plantedGame() {
  const game = F.createGame();
  assert.equal(F.act(game).ok, true); // 初始面向 (5,5)，先锄地
  F.selectTool(game, 'seed');
  assert.equal(F.act(game).ok, true);
  return game;
}

check('逻辑可在无 DOM 的 Node 环境加载', () => {
  assert.equal(F.WIDTH, 12);
  assert.equal(F.HEIGHT, 9);
});

check('初始状态：100 金币、40 体力、3 包萝卜种子', () => {
  const game = F.createGame();
  assert.equal(game.gold, 100);
  assert.equal(game.energy, 40);
  assert.equal(game.seeds.carrot, 3);
});

const game = plantedGame();
const plot = game.plots[5][5];
check('锄地与播种消耗体力和种子', () => {
  assert.equal(plot.tilled, true);
  assert.equal(plot.crop.type, 'carrot');
  assert.equal(game.energy, 34);
  assert.equal(game.seeds.carrot, 2);
});

check('未浇水过夜不生长', () => {
  F.sleep(game, () => 0.99);
  assert.equal(plot.crop.progress, 0);
});

check('浇水后过夜增长一格，并重置湿润状态', () => {
  F.selectTool(game, 'water');
  assert.equal(F.act(game).ok, true);
  F.sleep(game, () => 0.99);
  assert.equal(plot.crop.progress, 1);
  assert.equal(plot.watered, false);
});

check('雨天自动浇水，未手动浇水也能在夜里生长', () => {
  F.sleep(game, () => 0); // 第 4 天是雨天，自动浇水
  assert.equal(game.weather, 'rain');
  assert.equal(plot.crop.progress, 1);
  assert.equal(plot.watered, true);
  F.sleep(game, () => 0.99);
  assert.equal(plot.crop.progress, 2);
});

check('再浇水并过夜，萝卜第 3 次生长后成熟', () => {
  F.selectTool(game, 'water');
  assert.equal(F.act(game).ok, true);
  const outcome = F.sleep(game, () => 0.99);
  assert.equal(plot.crop.progress, F.CROPS.carrot.days);
  assert.ok(outcome.events.some(item => item.includes('萝卜成熟了')));
});

check('镰刀收获后背包增加，地块可再次播种', () => {
  F.selectTool(game, 'scythe');
  assert.equal(F.act(game).ok, true);
  assert.equal(game.bag.carrot, 1);
  assert.equal(plot.crop, null);
  assert.equal(plot.tilled, true);
});

check('卖出按真实售价增加金币并清空背包', () => {
  const before = game.gold;
  assert.equal(F.sellAll(game).ok, true);
  assert.equal(game.gold, before + F.CROPS.carrot.sellPrice);
  assert.equal(game.bag.carrot, 0);
});

check('卖钱后能继续购买种子，完成经济闭环', () => {
  const before = game.gold;
  assert.equal(F.buySeed(game, 'pumpkin', 1).ok, true);
  assert.equal(game.gold, before - F.CROPS.pumpkin.seedPrice);
  assert.equal(game.seeds.pumpkin, 1);
});

check('体力不足拒绝动作，状态不变；睡觉回满', () => {
  const tired = F.createGame();
  tired.energy = 3;
  const before = JSON.stringify(tired.plots[5][5]);
  const outcome = F.act(tired);
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /体力不足/);
  assert.equal(JSON.stringify(tired.plots[5][5]), before);
  assert.equal(tired.energy, 3);
  F.sleep(tired, () => 0.99);
  assert.equal(tired.energy, F.ENERGY_MAX);
});

check('金币不足无法买种子', () => {
  const poor = F.createGame();
  poor.gold = 0;
  assert.equal(F.buySeed(poor, 'pumpkin', 1).ok, false);
  assert.equal(poor.seeds.pumpkin, 0);
});

check('农夫逐格移动并面向前方地块', () => {
  const walker = F.createGame();
  assert.equal(F.move(walker, 'left').ok, true);
  assert.equal(walker.farmer.x, 4);
  assert.equal(walker.farmer.facing, 'left');
  assert.equal(F.frontCell(walker).x, 3);
});

check('每 28 天换季并重置季节内日期', () => {
  const calendar = F.createGame();
  calendar.day = 29;
  assert.equal(F.season(calendar), '夏');
  assert.equal(F.seasonDay(calendar), 1);
});

console.log(`全部通过：${passed} 项测试。`);
