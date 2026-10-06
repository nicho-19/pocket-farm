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
function plant(state, x = 15, y = 11, type = 'carrot', progress = 0) {
  state.plots[y][x] = { tilled: true, crop: { type, progress }, structure: null };
}
function legacySave(version) {
  const state = F.createGame(); state.version = version;
  state.plots = Array.from({ length: 9 }, () => Array.from({ length: 12 }, () => ({ tilled: false, crop: null, structure: null })));
  state.farmer = { x: 3, y: 3, facing: 'down' };
  return state;
}
check('无 DOM 加载与初始状态', () => {
  const state = F.createGame();
  assert.equal(state.gold, 100); assert.equal(state.health, 100); assert.equal(state.version, 9);
  assert.deepEqual(Object.keys(F.TOOLS).sort(), ['build', 'gather', 'hoe', 'rod', 'scythe', 'seed']);
});
check('锄地播种及按天生长', () => {
  const s = F.createGame(); assert.equal(F.act(s).ok, true); F.selectTool(s, 'seed'); assert.equal(F.act(s).ok, true);
  assert.equal(s.plots[11][15].crop.progress, 0); F.sleep(s, () => 0.49); assert.equal(s.plots[11][15].crop.progress, 1);
});
check('雨天额外生长一格', () => {
  const s = F.createGame(); plant(s); s.tomorrow = 'rain'; F.sleep(s, () => 0.99);
  assert.equal(s.weather, 'rain'); assert.equal(s.plots[11][15].crop.progress, 2);
});
check('成熟后镰刀收获并可再次播种', () => {
  const s = F.createGame(); plant(s, 15, 11, 'carrot', 3); F.selectTool(s, 'scythe');
  assert.equal(F.act(s).ok, true); assert.equal(s.bag.carrot, 1); assert.equal(s.plots[11][15].crop, null);
});
check('旧档迁移保住作物进度并忽略湿润字段', () => {
  const s = legacySave(1); s.tool = 'water'; s.plots[1][1] = { tilled: true, crop: { type: 'potato', progress: 2 }, structure: null, watered: false };
  F.migrateSave(s); assert.equal(s.plots[12][15].crop.progress, 2); assert.equal('watered' in s.plots[12][15], false);
  assert.equal(s.tool, 'hoe'); assert.equal(s.version, 9); F.sleep(s, () => 0.49); assert.equal(s.plots[12][15].crop.progress, 3);
});
check('v2 存档补全默认值并保留金币土地', () => {
  const s = legacySave(2); s.gold = 37; s.plots[2][3].tilled = true;
  for (const key of ['tomorrow', 'snacks', 'upgrades', 'orders', 'nextOrderId', 'stats', 'manualTool']) delete s[key];
  F.migrateSave(s); assert.equal(s.version, 9); assert.equal(s.gold, 37);
  assert.equal(s.plots[13][17].tilled, true); assert.equal(s.stats.income, 0);
  assert.equal(s.nightRaid.level, 'calm');
});
check('v4 夜袭旧档转强盗并补生命武器村民默认值', () => {
  const s = legacySave(4); delete s.health; delete s.weapon; delete s.villagers;
  s.nightRaid = { level: 'raid', count: 1, attackers: ['boar'] };
  assert.ok(F.migrateSave(s)); assert.equal(s.health, 100); assert.equal(s.weapon, 'none');
  assert.equal(s.nightRaid.attackers[0], 'bandit'); assert.equal(s.villagers.hunter.hearts, 0);
});
check('旧铁水壶全额返还且不重复返还', () => {
  const s = legacySave(3); s.gold = 12; s.upgrades = { water: true };
  F.migrateSave(s); assert.equal(s.gold, 612); assert.match(s.migrationEvents[0], /返还 600G/);
  F.migrateSave(s); assert.equal(s.gold, 612); assert.equal('upgrades' in s, false);
});
check('五种作物均可成熟出售', () => {
  for (const [key, crop] of Object.entries(F.CROPS)) {
    const s = F.createGame(); plant(s, 15, 11, key);
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
check('强盗被完整栅栏墙挡下并啃掉一段', () => {
  const s = F.createGame(); plant(s);
  for (let y = 0; y < F.HEIGHT; y++) s.plots[y][13].structure = 'fence';
  const r = F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] });
  assert.equal(r.lost, 0); assert.equal(r.fences, 1); assert.ok(s.plots[11][15].crop);
});
check('单晚损失最多三格作物', () => {
  const s = F.createGame(); for (let x = 2; x < 9; x++) plant(s, x, 4, 'carrot', 3);
  const r = F.resolveRaid(s, { level: 'large', count: 6, attackers: Array(6).fill('crow') });
  assert.equal(r.lost, 3); assert.equal(s.plots[4].filter(p => p.crop).length, 4);
});
check('强盗优先抢包再抢钱再毁作物', () => {
  const s = F.createGame(); s.bag.carrot = 1; plant(s, 2, 4);
  F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0.99);
  assert.equal(s.bag.carrot, 0); assert.equal(s.gold, 100);
  F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0.99);
  assert.ok(s.gold < 100); s.gold = 0;
  F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0.99);
  assert.equal(s.plots[4][2].crop, null); assert.equal(s.plots[4][2].tilled, false);
});
check('强盗金币和背包单晚封顶', () => {
  const s = F.createGame(); s.gold = 10000; s.bag.carrot = 50;
  const raid = { level: 'large', count: 6, attackers: Array(6).fill('bandit') };
  const r = F.resolveRaid(s, raid, () => 0.99);
  assert.ok(r.items <= 5); assert.ok(r.gold <= 200);
});
check('强盗可抢饭团并记入背包损失', () => {
  const s = F.createGame(); s.snacks = 2;
  const r = F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0.99);
  assert.equal(s.snacks, 0); assert.equal(r.items, 2); assert.match(r.events.join(' '), /饭团/);
});
check('自动反击按武器概率，成功无抢掠和受伤', () => {
  const s = F.createGame(); s.weapon = 'sword'; s.bag.carrot = 2;
  const r = F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0);
  assert.equal(r.repelled, 1); assert.equal(s.bag.carrot, 2); assert.equal(s.health, 100);
});
check('强盗得手后受伤8至15点且概率可注入', () => {
  const s = F.createGame(); s.bag.carrot = 1;
  F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0);
  assert.equal(s.health, 92);
  const t = F.createGame(); t.bag.carrot = 1;
  F.resolveRaid(t, { level: 'raid', count: 1, attackers: ['bandit'] }, () => 0.99);
  assert.equal(t.health, 100);
});
check('放置和镰刀回收防御道具', () => {
  const s = F.createGame(); s.gold = 200; assert.equal(F.placeBuilding(s, 'scarecrow').ok, true);
  assert.equal(s.gold, 50); F.selectTool(s, 'scythe'); assert.equal(F.act(s).ok, true);
  assert.equal(s.plots[11][15].structure, null); assert.equal(s.gold, 50);
});
check('作物可穿行，栅栏不可通行', () => {
  const s = F.createGame(); plant(s); assert.equal(F.move(s, 'down').ok, true);
  s.plots[12][15].structure = 'fence'; assert.equal(F.move(s, 'down').ok, false);
});
check('回家 BFS 可到家门口', () => {
  const s = F.createGame(); const { x, y } = F.LAYOUT.home; const path = F.findPath(s, x, y); assert.ok(path?.length);
  for (const direction of path) assert.equal(F.move(s, direction).ok, true);
  assert.equal(Math.abs(s.farmer.x - x) + Math.abs(s.farmer.y - y), 1);
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
  assert.equal(F.deliverOrder(s, order.id).ok, false); assert.equal(F.acceptOrder(s, order.id).ok, true);
  assert.equal(F.deliverOrder(s, order.id).ok, true); F.generateOrders(s, () => 0); s.orders[0].deadline = s.day;
  assert.match(F.sleep(s, () => 0.99).events.join(' '), /过期/);
});
check('农事不耗生命，旧体力字段可缺席且精钢锄退款', () => {
  const s = legacySave(4); s.energy = 1; s.upgrades = { hoe: true };
  delete s.health; assert.ok(F.migrateSave(s)); assert.equal(s.health, 100);
  assert.equal('energy' in s, false); assert.equal(s.gold, 500);
  s.farmer = { x: 15, y: 10, facing: 'down' };
  assert.equal(F.act(s).ok, true); assert.equal(s.health, 100);
  F.selectTool(s, 'seed'); assert.equal(F.act(s).ok, true); assert.equal(s.health, 100);
});
check('作物与饭团按表回血，满血拦截且不耗食物', () => {
  const s = F.createGame(); s.bag.carrot = 1; s.bag.pumpkin = 1; s.snacks = 1;
  assert.equal(F.eatFood(s, 'carrot').ok, false); assert.equal(s.bag.carrot, 1);
  s.health = 95; assert.match(F.eatFood(s, 'pumpkin').message, /5 点生命/); assert.equal(s.health, 100);
  s.health = 40; assert.equal(F.eatFood(s, 'carrot').ok, true); assert.equal(s.health, 46);
  assert.equal(F.eatFood(s, 'snack').ok, true); assert.equal(s.health, 66);
});
check('快捷吃最高回血食物，空背包提示', () => {
  const s = F.createGame(); s.health = 20; s.bag.potato = 1; s.bag.pumpkin = 1;
  assert.match(F.quickEat(s).message, /南瓜/); assert.equal(s.health, 34);
  assert.match(F.quickEat(s).message, /土豆/); assert.match(F.quickEat(s).message, /没有食物/);
});
check('武器价格、伤害与高档替换', () => {
  const s = F.createGame(); assert.equal(s.weapon, 'none');
  assert.equal(F.buyWeapon(s, 'club').ok, true); assert.equal(s.gold, 0);
  assert.equal(F.buyWeapon(s, 'axe').ok, false); s.gold = 1100;
  assert.equal(F.buyWeapon(s, 'axe').ok, true); assert.equal(F.buyWeapon(s, 'club').ok, false);
  assert.equal(F.buyWeapon(s, 'sword').ok, true); assert.equal(s.gold, 0);
  assert.equal(F.WEAPONS[s.weapon].damage, 3);
});
check('守夜挥砍按武器伤害并打退强盗', () => {
  for (const [weapon, damage] of [['club', 1], ['axe', 2], ['sword', 3]]) {
    const s = F.createGame(); s.weapon = weapon; s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] };
    const b = F.startWatch(s); b.spawned = 1; b.enemies.push({ x: 15, y: 11, health: 3 });
    F.watchStrike(s, b, 1); assert.equal(b.enemies[0].health, 3 - damage);
    if (damage === 3) { assert.equal(b.enemies[0].retreating, true); assert.equal(s.stats.repelled, 1); }
  }
});
check('徒手可推开强盗，强盗每秒攻击扣4点', () => {
  const s = F.createGame(); s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] };
  const b = F.startWatch(s); b.spawned = 1; b.enemies.push({ x: 15, y: 11, health: 3 });
  F.watchStrike(s, b, 1); assert.equal(b.enemies[0].y, 12);
  b.enemies[0].y = 11; F.watchTick(s, b, 1000); assert.equal(s.health, 96);
  F.watchTick(s, b, 1200); assert.equal(s.health, 96);
});
check('守夜成功零损失且作物照常生长', () => {
  const s = F.createGame(); plant(s); s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] };
  const b = F.startWatch(s); b.spawned = 1; b.enemies.push({ x: 15, y: 11, health: 3 }); s.weapon = 'sword';
  F.watchStrike(s, b, 1);
  for (let now = 1; now < 4000 && !b.success; now += 120) F.watchTick(s, b, now);
  assert.equal(b.success, true);
  const result = F.sleep(s, () => 0.49, true); assert.equal(result.raid.lost, 0);
  assert.equal(s.plots[11][15].crop.progress, 1);
});
check('睡觉恢复10生命，守夜不恢复', () => {
  const s = F.createGame(); s.health = 70; F.sleep(s, () => 0.99); assert.equal(s.health, 80);
  s.health = 70; F.sleep(s, () => 0.99, true); assert.equal(s.health, 70);
});
check('夜袭致死锁定终局，迁移旧档不会复活', () => {
  const s = F.createGame(); s.health = 1; s.gold = 0;
  s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] }; s.bag.carrot = 1;
  F.sleep(s, () => 0); assert.equal(s.gameOver, true); assert.equal(s.health, 0);
  assert.equal(F.sleep(s, () => 0.99).ok, false);
  assert.equal(F.migrateSave(s).gameOver, true);
});
check('村民送礼每日一次、满心回礼一次', () => {
  for (const [id, expected] of [['mayor', 'gold'], ['merchant', 'snacks'], ['hunter', 'fenceStock']]) {
    const s = F.createGame(); s.bag.carrot = 6; const before = s[expected];
    for (let day = 1; day <= 5; day++) {
      s.day = day; assert.equal(F.giftVillager(s, id, 'carrot').ok, true);
      assert.equal(F.giftVillager(s, id, 'carrot').ok, false);
    }
    assert.equal(s.villagers[id].hearts, 5);
    assert.equal(s[expected] - before, id === 'mayor' ? 100 : 2);
    s.day++; F.giftVillager(s, id, 'carrot'); assert.equal(s[expected] - before, id === 'mayor' ? 100 : 2);
  }
});
check('猎手回礼的栅栏优先使用库存', () => {
  const s = F.createGame(); s.gold = 0; s.fenceStock = 2;
  assert.equal(F.placeBuilding(s, 'fence').ok, true); assert.equal(s.fenceStock, 1); assert.equal(s.gold, 0);
});
check('村民对话有夜袭、天气和四句轮换文案', () => {
  const s = F.createGame(); s.nightRaid = { level: 'large', count: 2, attackers: ['bandit', 'crow'] };
  for (const id of Object.keys(F.VILLAGERS)) {
    const lines = Array.from({ length: 6 }, (_, i) => F.villagerLine(s, id, i));
    assert.equal(new Set(lines).size, 6); assert.match(lines[0], /大入侵/); assert.match(lines[1], /春季/);
  }
});
check('金币不足拒绝购买，数量不变', () => {
  const s = F.createGame(); s.gold = 0; assert.equal(F.buySeed(s, 'pumpkin', 1).ok, false); assert.equal(s.seeds.pumpkin, 0);
});
check('移动改变朝向，边界拒绝越界', () => {
  const s = F.createGame(); assert.equal(F.move(s, 'left').ok, true); assert.equal(s.farmer.x, 14);
  assert.equal(F.frontCell(s).x, 13); s.farmer.x = 0; assert.equal(F.move(s, 'left').ok, false);
});
check('每 28 天换季且日期重置', () => {
  const s = F.createGame(); s.day = 29; assert.equal(F.season(s), '夏'); assert.equal(F.seasonDay(s), 1);
});
check('智能工具选锄头、种子与成熟镰刀，手选优先', () => {
  const s = F.createGame(); assert.equal(F.act(s, true).tool, 'hoe');
  assert.equal(F.act(s, true).tool, 'seed'); plant(s, 15, 11, 'carrot', 3);
  assert.equal(F.act(s, true).tool, 'scythe'); F.selectTool(s, 'hoe'); assert.equal(s.autoTool, false); assert.equal(F.act(s, true).ok, false);
  plant(s, 15, 11, 'carrot', 3); F.selectAutoTool(s); assert.equal(s.autoTool, true); assert.equal(F.act(s, true).tool, 'scythe');
});
check('自动播种在当前种子用完时按作物顺序换种', () => {
  const s = F.createGame(); s.plots[11][15].tilled = true; s.seeds.carrot = 0; s.seeds.pumpkin = 2;
  const outcome = F.act(s, true);
  assert.equal(outcome.ok, true); assert.equal(s.plots[11][15].crop.type, 'pumpkin');
  assert.match(outcome.message, /萝卜种子没了，改播南瓜/);
});
check('自动播种无库存保留原错误，手动播种不换种', () => {
  const automatic = F.createGame(); automatic.plots[11][15].tilled = true; automatic.seeds.carrot = 0;
  assert.match(F.act(automatic, true).message, /萝卜种子不够/);
  const manual = F.createGame(); manual.plots[11][15].tilled = true; manual.seeds.carrot = 0; manual.seeds.potato = 1;
  F.selectTool(manual, 'seed'); assert.match(F.act(manual, true).message, /萝卜种子不够/); assert.equal(manual.seeds.potato, 1);
});
check('旧档缺少自动工具字段时默认开启', () => {
  const s = legacySave(5); delete s.autoTool; F.migrateSave(s); assert.equal(s.autoTool, true);
});
check('天气预报与次日一致，四季雨率可读', () => {
  const s = F.createGame(); s.tomorrow = 'rain'; F.sleep(s, () => 0.99);
  assert.equal(s.weather, 'rain'); assert.equal(s.tomorrow, 'sunny');
  assert.equal(F.RAIN_CHANCE['春'], 0.3); assert.equal(F.RAIN_CHANCE['夏'], 0.4);
});
check('BFS 穿过作物，越界目标拒绝', () => {
  const s = F.createGame(); for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) plant(s, 15 + dx, 11 + dy);
  assert.ok(F.findPath(s, 34, 19)?.length); assert.equal(F.findPath(s, -1, 8), null);
});
check('较长生长期的种子回报率更高', () => {
  const crops = Object.values(F.CROPS);
  for (const longer of crops) for (const shorter of crops) if (longer.days > shorter.days) {
    assert.ok(longer.sellPrice / longer.seedPrice > shorter.sellPrice / shorter.seedPrice);
  }
});
check('住宅林地池塘禁耕，住宅空地可建造', () => {
  const s = F.createGame();
  for (const cell of [F.LAYOUT.homeDoor, { x: 9, y: 5 }, { x: 28, y: 18 }]) {
    s.farmer = { x: cell.x, y: cell.y - 1, facing: 'down' };
    assert.equal(F.act(s).ok, false);
  }
  s.farmer = { x: 12, y: 9, facing: 'down' };
  s.gold = 200; assert.equal(F.placeBuilding(s, 'scarecrow').ok, true);
  s.farmer = { x: 28, y: 15, facing: 'down' };
  assert.equal(F.placeBuilding(s, 'fence').ok, false);
});
check('林地单格小路可穿行，密树挡路', () => {
  const s = F.createGame(); const x = F.LAYOUT.woods.pathX;
  assert.equal(F.terrainAt(x, 1), 'path');
  assert.equal(F.canWalk(s, x - 1, 1), false);
  assert.ok(F.pathBetween(s, { x, y: 3 }, { x, y: 0 })?.length);
});
check('相机在四角钳制且小世界轴居中', () => {
  assert.equal(F.cameraTarget({ x: 0, y: 0 }, 768, 576).x, 0);
  assert.equal(F.cameraTarget({ x: 0, y: 0 }, 768, 576).y, 0);
  assert.equal(F.cameraTarget({ x: 39, y: 27 }, 768, 576).x, 1152);
  assert.equal(F.cameraTarget({ x: 39, y: 27 }, 768, 576).y, 768);
  assert.equal(F.cameraTarget({ x: 39, y: 27 }, 2000, 1500).x, -40);
  assert.equal(F.cameraTarget({ x: 39, y: 27 }, 2000, 1500).y, -78);
  const next = F.cameraStep({ x: 0, y: 0 }, { x: 1152, y: 768 }, 120);
  assert.ok(next.x > 0 && next.x < 1152 && next.y > 0 && next.y < 768);
});
check('屏幕坐标经相机偏移换算为世界格', () => {
  const rect = { left: 10, top: 20, width: 384, height: 288 };
  const cell = F.screenToCell(10 + 120, 20 + 96, rect, { x: 96, y: 48 }, 768, 576);
  assert.equal(cell.x, 7); assert.equal(cell.y, 5);
});
check('可见格裁剪四周外扩一格', () => {
  const range = F.visibleCellRange({ x: 480, y: 336 }, 768, 576);
  assert.deepEqual(Object.values(range), [9, 6, 26, 19]);
  assert.equal((range.right - range.left + 1) * (range.bottom - range.top + 1), 252);
  assert.deepEqual(Object.values(F.visibleCellRange({ x: 0, y: 0 }, 768, 576)), [0, 0, 16, 12]);
});
check('v7 整图嵌入 v9 且逐项保留', () => {
  const s = F.createGame(); s.version = 7;
  s.plots = Array.from({ length: 14 }, () => Array.from({ length: 20 }, () => ({ tilled: false, crop: null, structure: null })));
  s.plots[4][5] = { tilled: true, crop: { type: 'potato', progress: 2 }, structure: null };
  s.plots[6][7].structure = 'scarecrow'; s.plots[8][9].structure = 'fence';
  s.gold = 347; s.health = 62; s.weapon = 'axe'; s.snacks = 3;
  s.seeds.carrot = 8; s.bag.pumpkin = 4; s.resources = { wood: 5, stone: 4, fish: 3, berry: 2 };
  s.villagers.mayor = { hearts: 3, giftedDay: 6, rewarded: true };
  s.orders = [{ id: 4, crop: 'carrot', amount: 2, deadline: 9, reward: 75, accepted: true }];
  s.day = 8; s.weather = 'rain'; s.tomorrow = 'sunny'; s.stats.repelled = 9;
  s.resourceNodes['tree-1'] = { charges: 0, respawnDay: 10 };
  s.farmer = { x: 5, y: 3, facing: 'left' };
  const next = F.migrateSave(s); const a = F.LAYOUT.v7Anchor;
  assert.equal(next.version, 9);
  assert.equal(next.plots[a.y + 4][a.x + 5].crop.progress, 2);
  assert.equal(next.plots[a.y + 6][a.x + 7].structure, 'scarecrow');
  assert.equal(next.plots[a.y + 8][a.x + 9].structure, 'fence');
  assert.deepEqual([next.gold, next.health, next.weapon, next.snacks], [347, 62, 'axe', 3]);
  assert.deepEqual([next.seeds.carrot, next.bag.pumpkin], [8, 4]);
  assert.equal(next.resources.wood, 5); assert.equal(next.villagers.mayor.hearts, 3);
  assert.equal(next.orders[0].id, 4); assert.equal(next.stats.repelled, 9);
  assert.equal(JSON.stringify(next.resourceNodes['tree-1']), JSON.stringify({ charges: 0, respawnDay: 10 }));
  assert.equal(JSON.stringify(next.farmer), JSON.stringify({ ...F.LAYOUT.homeDoor, facing: 'left' }));
  const snapshot = JSON.stringify(next); F.migrateSave(next); assert.equal(JSON.stringify(next), snapshot);
});
check('v1/v3/v5 旧档走全链条到 v9', () => {
  for (const version of [1, 3, 5]) {
    const s = F.createGame(); s.version = version;
    s.plots = Array.from({ length: 9 }, () => Array.from({ length: 12 }, () => ({ tilled: false, crop: null, structure: null })));
    s.plots[8][11] = { tilled: true, crop: { type: 'corn', progress: 1 }, structure: 'fence' };
    s.farmer = { x: 3, y: 3, facing: 'up' };
    const next = F.migrateSave(s);
    assert.equal(next.version, 9); assert.equal(next.plots[19][25].crop.progress, 1);
    assert.equal(next.plots[19][25].structure, 'fence');
  }
});
check('v9 初始资源、节点、双库存与统计', () => {
  const s = F.createGame(); assert.deepEqual(Object.values(s.resources), [0, 0, 0, 0]);
  assert.equal(Object.keys(s.resourceNodes).length, 26); assert.ok(F.RESOURCE_NODES.every(n => s.resourceNodes[n.id].charges === 2));
  assert.equal(s.fenceStock, 0); assert.equal(s.scarecrowStock, 0); assert.deepEqual([s.stats.gathered, s.stats.fished, s.stats.crafted], [0, 0, 0]);
});
check('三种采集节点、工具判定与智能操作', () => {
  for (const [kind, key, x] of [['tree', 'wood', 18], ['berry', 'berry', 19], ['stone', 'stone', 21]]) {
    const s = F.createGame(); s.farmer = { x, y: 10, facing: 'up' }; const before = JSON.stringify(s.resourceNodes);
    assert.equal(F.act(s, true).ok, true); assert.equal(s.resources[key], 1); assert.equal(s.stats.gathered, 1);
    F.selectTool(s, 'hoe'); assert.equal(F.act(s, true).ok, false); assert.equal(s.resources[key], 1); assert.notEqual(JSON.stringify(s.resourceNodes), before);
  }
});
check('钓鱼调用即成功且采空不调随机数', () => {
  const s = F.createGame(); s.farmer = { x: 25, y: 17, facing: 'right' }; F.selectTool(s, 'rod');
  let calls = 0;
  assert.equal(F.act(s, true, () => { calls++; return 0.99; }).ok, true); assert.equal(s.resources.fish, 1);
  assert.equal(F.act(s, true, () => { calls++; return 0.99; }).ok, true); assert.equal(s.resourceNodes['fish-1'].charges, 0);
  assert.equal(F.act(s, true, () => { calls++; return 0; }).ok, false); assert.equal(calls, 0);
});
check('节点按钓点1天、木果2天、石3天刷新', () => {
  const s = F.createGame(); for (const id of ['fish-1', 'tree-1', 'berry-1', 'stone-1']) { s.resourceNodes[id].charges = 0; s.resourceNodes[id].respawnDay = s.day + ({ 'fish-1': 1, 'tree-1': 2, 'berry-1': 2, 'stone-1': 3 }[id]); }
  assert.match(F.sleep(s, () => 0.99).events.join(' '), /资源刷新/); assert.equal(s.resourceNodes['fish-1'].charges, 2); assert.equal(s.resourceNodes['tree-1'].charges, 0);
  F.sleep(s, () => 0.99); assert.equal(s.resourceNodes['tree-1'].charges, 2); assert.equal(s.resourceNodes['berry-1'].charges, 2); assert.equal(s.resourceNodes['stone-1'].charges, 0);
  F.sleep(s, () => 0.99); assert.equal(s.resourceNodes['stone-1'].charges, 2);
});
check('四资源出售与作物一键全卖隔离', () => {
  const s = F.createGame(); for (const [key, item] of Object.entries(F.RESOURCES)) { s.resources[key] = 2; const gold = s.gold; assert.equal(F.sellResource(s, key, 1).ok, true); assert.equal(s.gold, gold + item.sellPrice); }
  const snapshot = JSON.stringify(s.resources); assert.equal(F.sellResource(s, 'wood', 2).ok, false); s.bag.carrot = 1; F.sellAll(s); assert.equal(JSON.stringify(s.resources), snapshot);
});
check('池鱼野果食用与快捷吃', () => {
  const s = F.createGame(); s.resources.fish = 1; s.resources.berry = 2; s.health = 80; F.eatFood(s, 'fish'); assert.equal(s.health, 92); F.eatFood(s, 'berry'); assert.equal(s.health, 97);
  assert.match(F.quickEat(s).message, /野果/); assert.equal(s.health, 100); assert.equal(F.eatFood(s, 'berry').ok, false);
});
check('三配方制作、原子性失败与免费放置', () => {
  const s = F.createGame(); s.resources = { wood: 9, stone: 2, fish: 0, berry: 2 }; const gold = s.gold;
  for (const key of ['fence', 'scarecrow', 'snack']) assert.equal(F.craft(s, key).ok, true); assert.equal(s.stats.crafted, 3);
  assert.deepEqual([s.fenceStock, s.scarecrowStock, s.snacks], [1, 1, 1]); const before = JSON.stringify(s.resources); assert.equal(F.craft(s, 'scarecrow').ok, false); assert.equal(JSON.stringify(s.resources), before);
  assert.equal(F.placeBuilding(s, 'scarecrow').ok, true); assert.equal(s.gold, gold); s.farmer.x = 16; assert.equal(F.placeBuilding(s, 'fence').ok, true); assert.equal(s.gold, gold);
});
check('资源送礼与每日一次限制', () => {
  const s = F.createGame(); s.resources = { wood: 1, stone: 0, fish: 1, berry: 1 };
  assert.equal(F.giftVillager(s, 'mayor', 'fish').ok, true); assert.equal(s.villagers.mayor.hearts, 2); assert.equal(F.giftVillager(s, 'mayor', 'berry').ok, false);
  s.day++; assert.equal(F.giftVillager(s, 'mayor', 'berry').ok, true); s.day++; assert.equal(F.giftVillager(s, 'mayor', 'wood').ok, false);
});
check('v6/v7 迁移清洗且幂等', () => {
  const s = F.createGame(); s.version = 6; s.plots = s.plots.slice(0, 14).map(row => row.slice(0, 20)); s.farmer = { x: 5, y: 3, facing: 'down' }; s.gold = 321; s.weapon = 'axe'; s.villagers.mayor.hearts = 3; delete s.resources; delete s.resourceNodes; delete s.scarecrowStock;
  const next = F.migrateSave(s); assert.equal(next.version, 9); assert.equal(next.gold, 321); assert.equal(next.weapon, 'axe'); assert.equal(next.villagers.mayor.hearts, 3);
  next.resources = { wood: -1, fish: 2.5, berry: 3, bogus: 9 }; next.resourceNodes['tree-1'] = { charges: 99, respawnDay: -2 }; const once = F.migrateSave(next); assert.equal(JSON.stringify(once.resources), JSON.stringify({ wood: 0, stone: 0, fish: 0, berry: 3 })); assert.equal(JSON.stringify(once.resourceNodes['tree-1']), JSON.stringify({ charges: 2, respawnDay: 0 }));
  const snapshot = JSON.stringify(once); F.migrateSave(once); assert.equal(JSON.stringify(once), snapshot);
});
check('节点地形不可走且邻格可达', () => {
  const s = F.createGame(); for (const node of F.RESOURCE_NODES) assert.equal(F.canWalk(s, node.x, node.y), false);
  assert.ok(F.findPath(s, 18, 9)?.length); assert.ok(F.findPath(s, 26, 17)?.length); assert.ok(F.pathBetween(s, { x: 23, y: 10 }, { x: 23, y: 0 })?.length);
});
check('家门到农田、节点、钓点、村口、草甸与刷怪点全部可达', () => {
  const s = F.createGame(), start = F.LAYOUT.homeDoor;
  for (const area of F.LAYOUT.farmAreas) for (let y = area.top; y <= area.bottom; y++) for (let x = area.left; x <= area.right; x++)
    assert.ok(F.pathBetween(s, start, { x, y }), `农田 ${x},${y} 不可达`);
  for (const node of F.RESOURCE_NODES) {
    const reachableSide = Object.values(F.DIRECTIONS).some(([dx, dy]) => F.canWalk(s, node.x + dx, node.y + dy) && F.pathBetween(s, start, { x: node.x + dx, y: node.y + dy }));
    assert.equal(reachableSide, true, `节点 ${node.id} 无可达操作位`);
  }
  assert.ok(F.pathBetween(s, start, F.LAYOUT.gate));
  assert.ok(F.pathBetween(s, start, { x: F.LAYOUT.meadow.left, y: F.LAYOUT.meadow.bottom }));
  for (const spawn of F.LAYOUT.raidSpawns) assert.ok(F.findPath(s, 14, 11, spawn, false), `刷怪点 ${spawn.x},${spawn.y} 不通农田`);
});
check('村民喜好加二心并永久揭示，普通礼物加一心', () => {
  const s = F.createGame(); s.resources.fish = 1; s.resources.berry = 1; s.bag.carrot = 1;
  const liked = F.giftVillager(s, 'mayor', 'fish'); assert.equal(s.villagers.mayor.hearts, 2); assert.equal(s.villagers.mayor.likeKnown, true); assert.match(liked.events.join(' '), /正合村长的胃口/);
  s.day++; F.giftVillager(s, 'mayor', 'berry'); assert.equal(s.villagers.mayor.hearts, 3);
  assert.ok(Object.values(F.VILLAGERS).every(v => F.CROPS[v.likes] || ['fish', 'berry'].includes(v.likes)));
});
check('婆婆三心后种子九折且向上取整', () => {
  const normal = F.createGame(); normal.gold = 100; F.buySeed(normal, 'potato', 1); assert.equal(normal.gold, 82);
  const friend = F.createGame(); friend.gold = 100; friend.villagers.merchant.hearts = 3; const out = F.buySeed(friend, 'potato', 1);
  assert.equal(friend.gold, 83); assert.match(out.message, /17 G/);
});
check('成就逐条达标、奖励正确且重复检查幂等', () => {
  assert.ok(F.ACHIEVEMENTS.length >= 12);
  for (const achievement of F.ACHIEVEMENTS) {
    const s = F.createGame(); s.gold = 0;
    const thresholds = { 'harvest-10': ['harvested', 10], 'harvest-50': ['harvested', 50], 'harvest-150': ['harvested', 150], 'fish-20': ['fished', 20], 'gather-30': ['gathered', 30], 'craft-10': ['crafted', 10], 'orders-10': ['orders', 10], 'repel-3': ['repelled', 3], 'income-5000': ['income', 5000], 'days-14': ['days', 14] };
    if (thresholds[achievement.id]) s.stats[thresholds[achievement.id][0]] = thresholds[achievement.id][1];
    if (achievement.id === 'harvest-50') s.achievements = ['harvest-10'];
    if (achievement.id === 'harvest-150') s.achievements = ['harvest-10', 'harvest-50'];
    if (achievement.id === 'gold-1000') s.gold = 1000;
    if (achievement.id === 'friends-all') for (const id of Object.keys(s.villagers)) s.villagers[id].hearts = 5;
    const before = s.gold; const unlocked = F.checkAchievements(s);
    assert.equal(unlocked.length, 1); assert.equal(unlocked[0].id, achievement.id); assert.equal(s.gold, before + achievement.reward);
    assert.equal(F.checkAchievements(s).length, 0); assert.equal(s.gold, before + achievement.reward);
  }
  const empty = F.createGame(); assert.equal(F.checkAchievements(empty).length, 0);
});
check('天气概率边界与雨天额外生长封顶', () => {
  assert.equal(F.rollWeather(() => 0.4999), 'sunny'); assert.equal(F.rollWeather(() => 0.5), 'cloudy');
  assert.equal(F.rollWeather(() => 0.7999), 'cloudy'); assert.equal(F.rollWeather(() => 0.8), 'rain');
  const s = F.createGame(); plant(s, 15, 11, 'carrot', 2); const out = F.sleep(s, () => 0.8);
  assert.equal(s.weather, 'rain'); assert.equal(s.plots[11][15].crop.progress, 3); assert.match(out.events.join(' '), /明天天气：雨/);
});
check('v8 迁移到 v9 补齐新字段且幂等', () => {
  const s = F.createGame(); s.version = 8; delete s.achievements; delete s.autoTool; s.weather = 'bogus';
  for (const villager of Object.values(s.villagers)) delete villager.likeKnown;
  const next = F.migrateSave(s); assert.equal(next.version, 9); assert.equal(next.autoTool, true); assert.equal(next.achievements.length, 0); assert.equal(next.weather, 'sunny'); assert.ok(Object.values(next.villagers).every(v => v.likeKnown === false));
  const snapshot = JSON.stringify(next); F.migrateSave(next); assert.equal(JSON.stringify(next), snapshot);
  next.weather = 'cloudy'; next.tomorrow = 'cloudy'; next.achievements = ['fish-20', 'fish-20', 'bogus']; next.villagers.mayor.likeKnown = true;
  F.migrateSave(next); assert.equal(next.weather, 'cloudy'); assert.equal(next.tomorrow, 'cloudy'); assert.equal(next.achievements.join(','), 'fish-20'); assert.equal(next.villagers.mayor.likeKnown, true);
});
console.log(`全部通过：${passed} 项测试。`);
