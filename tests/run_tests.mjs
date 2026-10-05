import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../farm-logic.js'), 'utf8'), context);
const F = context.PocketFarm;
let passed = 0;
function check(name, run) { run(); passed++; console.log(`✓ ${name}`); }
function plant(state, x = 5, y = 5, type = 'carrot', progress = 0) {
  state.plots[y][x] = { tilled: true, crop: { type, progress }, structure: null };
}
check('无 DOM 加载与初始状态', () => {
  const state = F.createGame();
  assert.equal(state.gold, 100); assert.equal(state.energy, 40); assert.equal(state.version, 4);
  assert.deepEqual(Object.keys(F.TOOLS).sort(), ['build', 'hoe', 'scythe', 'seed']);
});
check('锄地播种及按天生长', () => {
  const s = F.createGame(); assert.equal(F.act(s).ok, true); F.selectTool(s, 'seed'); assert.equal(F.act(s).ok, true);
  assert.equal(s.plots[5][5].crop.progress, 0); F.sleep(s, () => 0.99); assert.equal(s.plots[5][5].crop.progress, 1);
});
check('雨天额外生长一格', () => {
  const s = F.createGame(); plant(s); s.tomorrow = 'rain'; F.sleep(s, () => 0.99);
  assert.equal(s.weather, 'rain'); assert.equal(s.plots[5][5].crop.progress, 2);
});
check('成熟后镰刀收获并可再次播种', () => {
  const s = F.createGame(); plant(s, 5, 5, 'carrot', 3); F.selectTool(s, 'scythe');
  assert.equal(F.act(s).ok, true); assert.equal(s.bag.carrot, 1); assert.equal(s.plots[5][5].crop, null);
});
check('旧档迁移保住作物进度并忽略湿润字段', () => {
  const s = F.createGame(); s.version = 1; s.tool = 'water'; plant(s, 5, 5, 'potato', 2); s.plots[5][5].watered = false;
  F.migrateSave(s); assert.equal(s.plots[5][5].crop.progress, 2); assert.equal('watered' in s.plots[5][5], false);
  assert.equal(s.tool, 'hoe'); assert.equal(s.version, 4); F.sleep(s, () => 0.99); assert.equal(s.plots[5][5].crop.progress, 3);
});
check('v2 存档补全默认值并保留金币土地', () => {
  const s = F.createGame(); s.version = 2; s.gold = 37; s.plots[2][3].tilled = true;
  for (const key of ['tomorrow', 'snacks', 'upgrades', 'orders', 'nextOrderId', 'stats', 'manualTool']) delete s[key];
  F.migrateSave(s); assert.equal(s.version, 4); assert.equal(s.gold, 37);
  assert.equal(s.plots[2][3].tilled, true); assert.equal(s.stats.income, 0);
  assert.equal(s.nightRaid.level, 'calm');
});
check('旧铁水壶全额返还且不重复返还', () => {
  const s = F.createGame(); s.version = 3; s.gold = 12; s.upgrades.water = true;
  F.migrateSave(s); assert.equal(s.gold, 612); assert.match(s.migrationEvents[0], /返还 600G/);
  F.migrateSave(s); assert.equal(s.gold, 612); assert.equal('water' in s.upgrades, false);
});
check('五种作物均可成熟出售', () => {
  for (const [key, crop] of Object.entries(F.CROPS)) {
    const s = F.createGame(); plant(s, 5, 5, key);
    for (let i = 0; i < crop.days; i++) F.sleep(s, () => 0.99);
    F.selectTool(s, 'scythe'); assert.equal(F.act(s).ok, true); assert.equal(s.bag[key], 1);
    const before = s.gold; assert.equal(F.sellCrop(s, key, 1).ok, true); assert.equal(s.gold, before + crop.sellPrice);
  }
});
check('新手两夜保护、45% 入侵与第七夜大入侵', () => {
  assert.equal(F.planRaid(1, () => 0).level, 'calm'); assert.equal(F.planRaid(2, () => 0).level, 'calm');
  assert.equal(F.planRaid(3, () => 0.44).level, 'raid'); assert.equal(F.planRaid(3, () => 0.45).level, 'calm');
  assert.equal(F.planRaid(7, () => 0.99).level, 'large'); assert.equal(F.planRaid(7, () => 0.99).count, 2);
  assert.equal(F.planRaid(70, () => 0.99).count, 6);
});
check('今晚预报严格对应已存夜袭计划', () => {
  const s = F.createGame(); s.day = 2; F.sleep(s, () => 0); assert.equal(s.day, 3); assert.equal(s.nightRaid.level, 'raid');
  const plan = JSON.stringify(s.nightRaid); const outcome = F.sleep(s, () => 0.99);
  assert.equal(outcome.raid.events.length > 0, true); assert.equal(JSON.parse(plan).attackers.length, 1);
});
check('稻草人护住三乘三成熟作物', () => {
  const s = F.createGame(); plant(s, 5, 5, 'strawberry', 4); s.plots[4][4].structure = 'scarecrow';
  const result = F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['crow'] });
  assert.equal(result.lost, 0); assert.ok(s.plots[5][5].crop); assert.match(result.events.join(' '), /乌鸦/);
});
check('野猪被完整栅栏墙挡下并啃掉一段', () => {
  const s = F.createGame(); plant(s, 2, 4);
  for (let y = 0; y < F.HEIGHT; y++) s.plots[y][1].structure = 'fence';
  const r = F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['boar'] });
  assert.equal(r.lost, 0); assert.equal(r.fences, 1); assert.ok(s.plots[4][2].crop);
});
check('单晚损失最多三格作物', () => {
  const s = F.createGame(); for (let x = 2; x < 9; x++) plant(s, x, 4, 'carrot', 3);
  const r = F.resolveRaid(s, { level: 'large', count: 6, attackers: Array(6).fill('crow') });
  assert.equal(r.lost, 3); assert.equal(s.plots[4].filter(p => p.crop).length, 4);
});
check('野猪拱作物后回草地', () => {
  const s = F.createGame(); plant(s, 2, 4); F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['boar'] });
  assert.equal(s.plots[4][2].tilled, false); assert.equal(s.plots[4][2].crop, null);
});
check('放置和镰刀回收防御道具', () => {
  const s = F.createGame(); s.gold = 200; assert.equal(F.placeBuilding(s, 'scarecrow').ok, true);
  assert.equal(s.gold, 50); F.selectTool(s, 'scythe'); assert.equal(F.act(s).ok, true);
  assert.equal(s.plots[5][5].structure, null); assert.equal(s.gold, 50);
});
check('作物可穿行，栅栏不可通行', () => {
  const s = F.createGame(); plant(s); assert.equal(F.move(s, 'down').ok, true);
  s.plots[6][5].structure = 'fence'; assert.equal(F.move(s, 'down').ok, false);
});
check('回家 BFS 可到家门口', () => {
  const s = F.createGame(); const path = F.findPath(s, 0, 3); assert.ok(path?.length);
  for (const direction of path) assert.equal(F.move(s, direction).ok, true);
  assert.equal(Math.abs(s.farmer.x) + Math.abs(s.farmer.y - 3), 1);
});
check('批量购买按总价扣款并拒绝不足', () => {
  const s = F.createGame(); assert.equal(F.buySeed(s, 'carrot', 5).ok, true);
  assert.equal(s.gold, 50); assert.equal(s.seeds.carrot, 8); assert.equal(F.buySeed(s, 'pumpkin', 2).ok, false);
});
check('一键全卖保留当前订单需求', () => {
  const s = F.createGame(); s.bag.carrot = 5; s.bag.potato = 2;
  s.orders = [{ id: 1, crop: 'carrot', amount: 2, deadline: 4, reward: 50 }];
  assert.equal(F.salePreview(s).total, 3 * 25 + 2 * 48); assert.equal(F.sellAll(s).ok, true);
  assert.equal(s.bag.carrot, 2); assert.equal(s.bag.potato, 0);
});
check('手动卖出低于订单需求会标记提醒', () => {
  const s = F.createGame(); s.bag.carrot = 2; s.orders = [{ id: 1, crop: 'carrot', amount: 2, deadline: 4, reward: 50 }];
  assert.equal(F.sellCrop(s, 'carrot', 1).warning, true);
});
check('订单交付与过期刷新', () => {
  const s = F.createGame(); F.generateOrders(s, () => 0); const order = s.orders[0]; s.bag[order.crop] = 1;
  assert.equal(F.deliverOrder(s, order.id).ok, true); F.generateOrders(s, () => 0); s.orders[0].deadline = s.day;
  assert.match(F.sleep(s, () => 0.99).events.join(' '), /过期/);
});
check('精钢锄和饭团仍可用', () => {
  const s = F.createGame(); s.gold = 500; assert.equal(F.buyUpgrade(s, 'hoe').ok, true); assert.equal(F.act(s).ok, true);
  assert.equal(s.energy, 38); assert.equal(F.buySnack(s).ok, true); s.energy = 10; assert.equal(F.eatSnack(s).ok, true);
});
check('体力不足拒绝动作，睡觉恢复至 40', () => {
  const s = F.createGame(); s.energy = 3; const before = JSON.stringify(s.plots[5][5]);
  assert.equal(F.act(s).ok, false); assert.equal(JSON.stringify(s.plots[5][5]), before);
  F.sleep(s, () => 0.99); assert.equal(s.energy, 40);
});
check('金币不足拒绝购买，数量不变', () => {
  const s = F.createGame(); s.gold = 0; assert.equal(F.buySeed(s, 'pumpkin', 1).ok, false); assert.equal(s.seeds.pumpkin, 0);
});
check('移动改变朝向，边界拒绝越界', () => {
  const s = F.createGame(); assert.equal(F.move(s, 'left').ok, true); assert.equal(s.farmer.x, 4);
  assert.equal(F.frontCell(s).x, 3); s.farmer.x = 0; assert.equal(F.move(s, 'left').ok, false);
});
check('每 28 天换季且日期重置', () => {
  const s = F.createGame(); s.day = 29; assert.equal(F.season(s), '夏'); assert.equal(F.seasonDay(s), 1);
});
check('智能工具选锄头、种子与成熟镰刀，手选优先', () => {
  const s = F.createGame(); assert.equal(F.act(s, true).tool, 'hoe');
  assert.equal(F.act(s, true).tool, 'seed'); plant(s, 5, 5, 'carrot', 3);
  assert.equal(F.act(s, true).tool, 'scythe'); F.selectTool(s, 'hoe'); assert.equal(F.act(s, true).ok, false);
});
check('天气预报与次日一致，四季雨率可读', () => {
  const s = F.createGame(); s.tomorrow = 'rain'; F.sleep(s, () => 0.99);
  assert.equal(s.weather, 'rain'); assert.equal(s.tomorrow, 'sunny');
  assert.equal(F.RAIN_CHANCE['春'], 0.3); assert.equal(F.RAIN_CHANCE['夏'], 0.4);
});
check('BFS 穿过作物，越界目标拒绝', () => {
  const s = F.createGame(); for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) plant(s, 5 + dx, 4 + dy);
  assert.ok(F.findPath(s, 9, 8)?.length); assert.equal(F.findPath(s, -1, 8), null);
});
check('较长生长期的种子回报率更高', () => {
  const crops = Object.values(F.CROPS);
  for (const longer of crops) for (const shorter of crops) if (longer.days > shorter.days) {
    assert.ok(longer.sellPrice / longer.seedPrice > shorter.sellPrice / shorter.seedPrice);
  }
});
console.log(`全部通过：${passed} 项测试。`);
