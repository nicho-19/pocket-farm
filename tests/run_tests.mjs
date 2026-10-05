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
function plant(state, x = 5, y = 4, type = 'carrot', progress = 0) {
  state.plots[y][x] = { tilled: true, crop: { type, progress }, structure: null };
}
check('无 DOM 加载与初始状态', () => {
  const state = F.createGame();
  assert.equal(state.gold, 100); assert.equal(state.health, 100); assert.equal(state.version, 6);
  assert.deepEqual(Object.keys(F.TOOLS).sort(), ['build', 'hoe', 'scythe', 'seed']);
});
check('锄地播种及按天生长', () => {
  const s = F.createGame(); assert.equal(F.act(s).ok, true); F.selectTool(s, 'seed'); assert.equal(F.act(s).ok, true);
  assert.equal(s.plots[4][5].crop.progress, 0); F.sleep(s, () => 0.99); assert.equal(s.plots[4][5].crop.progress, 1);
});
check('雨天额外生长一格', () => {
  const s = F.createGame(); plant(s); s.tomorrow = 'rain'; F.sleep(s, () => 0.99);
  assert.equal(s.weather, 'rain'); assert.equal(s.plots[4][5].crop.progress, 2);
});
check('成熟后镰刀收获并可再次播种', () => {
  const s = F.createGame(); plant(s, 5, 4, 'carrot', 3); F.selectTool(s, 'scythe');
  assert.equal(F.act(s).ok, true); assert.equal(s.bag.carrot, 1); assert.equal(s.plots[4][5].crop, null);
});
check('旧档迁移保住作物进度并忽略湿润字段', () => {
  const s = F.createGame(); s.version = 1; s.tool = 'water'; plant(s, 5, 5, 'potato', 2); s.plots[5][5].watered = false;
  F.migrateSave(s); assert.equal(s.plots[5][5].crop.progress, 2); assert.equal('watered' in s.plots[5][5], false);
  assert.equal(s.tool, 'hoe'); assert.equal(s.version, 6); F.sleep(s, () => 0.99); assert.equal(s.plots[5][5].crop.progress, 3);
});
check('v2 存档补全默认值并保留金币土地', () => {
  const s = F.createGame(); s.version = 2; s.gold = 37; s.plots[2][3].tilled = true;
  for (const key of ['tomorrow', 'snacks', 'upgrades', 'orders', 'nextOrderId', 'stats', 'manualTool']) delete s[key];
  F.migrateSave(s); assert.equal(s.version, 6); assert.equal(s.gold, 37);
  assert.equal(s.plots[2][3].tilled, true); assert.equal(s.stats.income, 0);
  assert.equal(s.nightRaid.level, 'calm');
});
check('v4 夜袭旧档转强盗并补生命武器村民默认值', () => {
  const s = F.createGame(); s.version = 4; delete s.health; delete s.weapon; delete s.villagers;
  s.nightRaid = { level: 'raid', count: 1, attackers: ['boar'] };
  assert.ok(F.migrateSave(s)); assert.equal(s.health, 100); assert.equal(s.weapon, 'none');
  assert.equal(s.nightRaid.attackers[0], 'bandit'); assert.equal(s.villagers.hunter.hearts, 0);
});
check('旧铁水壶全额返还且不重复返还', () => {
  const s = F.createGame(); s.version = 3; s.gold = 12; s.upgrades = { water: true };
  F.migrateSave(s); assert.equal(s.gold, 612); assert.match(s.migrationEvents[0], /返还 600G/);
  F.migrateSave(s); assert.equal(s.gold, 612); assert.equal('upgrades' in s, false);
});
check('五种作物均可成熟出售', () => {
  for (const [key, crop] of Object.entries(F.CROPS)) {
    const s = F.createGame(); plant(s, 5, 4, key);
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
  const s = F.createGame(); plant(s, 2, 4);
  for (let y = F.LAYOUT.woods.bottom + 1; y < F.HEIGHT; y++) s.plots[y][8].structure = 'fence';
  const r = F.resolveRaid(s, { level: 'raid', count: 1, attackers: ['bandit'] });
  assert.equal(r.lost, 0); assert.equal(r.fences, 1); assert.ok(s.plots[4][2].crop);
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
  assert.equal(s.plots[4][5].structure, null); assert.equal(s.gold, 50);
});
check('作物可穿行，栅栏不可通行', () => {
  const s = F.createGame(); plant(s); assert.equal(F.move(s, 'down').ok, true);
  s.plots[5][5].structure = 'fence'; assert.equal(F.move(s, 'down').ok, false);
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
  const s = F.createGame(); s.version = 4; s.energy = 1; s.upgrades = { hoe: true };
  delete s.health; assert.ok(F.migrateSave(s)); assert.equal(s.health, 100);
  assert.equal('energy' in s, false); assert.equal(s.gold, 500);
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
    const b = F.startWatch(s); b.spawned = 1; b.enemies.push({ x: 5, y: 4, health: 3 });
    F.watchStrike(s, b, 1); assert.equal(b.enemies[0].health, 3 - damage);
    if (damage === 3) { assert.equal(b.enemies[0].retreating, true); assert.equal(s.stats.repelled, 1); }
  }
});
check('徒手可推开强盗，强盗每秒攻击扣4点', () => {
  const s = F.createGame(); s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] };
  const b = F.startWatch(s); b.spawned = 1; b.enemies.push({ x: 5, y: 4, health: 3 });
  F.watchStrike(s, b, 1); assert.equal(b.enemies[0].y, 5);
  b.enemies[0].y = 4; F.watchTick(s, b, 1000); assert.equal(s.health, 96);
  F.watchTick(s, b, 1200); assert.equal(s.health, 96);
});
check('守夜成功零损失且作物照常生长', () => {
  const s = F.createGame(); plant(s); s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] };
  const b = F.startWatch(s); b.spawned = 1; b.enemies.push({ x: 5, y: 4, health: 3 }); s.weapon = 'sword';
  F.watchStrike(s, b, 1);
  for (let now = 1; now < 1000 && !b.success; now += 120) F.watchTick(s, b, now);
  assert.equal(b.success, true);
  const result = F.sleep(s, () => 0.99, true); assert.equal(result.raid.lost, 0);
  assert.equal(s.plots[4][5].crop.progress, 1);
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
  const s = F.createGame(); assert.equal(F.move(s, 'left').ok, true); assert.equal(s.farmer.x, 4);
  assert.equal(F.frontCell(s).x, 3); s.farmer.x = 0; assert.equal(F.move(s, 'left').ok, false);
});
check('每 28 天换季且日期重置', () => {
  const s = F.createGame(); s.day = 29; assert.equal(F.season(s), '夏'); assert.equal(F.seasonDay(s), 1);
});
check('智能工具选锄头、种子与成熟镰刀，手选优先', () => {
  const s = F.createGame(); assert.equal(F.act(s, true).tool, 'hoe');
  assert.equal(F.act(s, true).tool, 'seed'); plant(s, 5, 4, 'carrot', 3);
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
check('住宅林地池塘禁耕，住宅空地可建造', () => {
  const s = F.createGame();
  for (const cell of [F.LAYOUT.homeDoor, { x: 9, y: 1 }, { x: 17, y: 10 }]) {
    s.farmer = { x: cell.x, y: cell.y - 1, facing: 'down' };
    assert.equal(F.act(s).ok, false);
  }
  s.farmer = { x: 2, y: 2, facing: 'down' };
  s.gold = 200; assert.equal(F.placeBuilding(s, 'scarecrow').ok, true);
  s.farmer = { x: 16, y: 8, facing: 'down' };
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
  assert.equal(F.cameraTarget({ x: 19, y: 13 }, 768, 576).x, 192);
  assert.equal(F.cameraTarget({ x: 19, y: 13 }, 768, 576).y, 96);
  assert.equal(F.cameraTarget({ x: 19, y: 13 }, 1200, 800).x, -120);
  assert.equal(F.cameraTarget({ x: 19, y: 13 }, 1200, 800).y, -64);
  const next = F.cameraStep({ x: 0, y: 0 }, { x: 192, y: 96 }, 120);
  assert.ok(next.x > 0 && next.x < 192 && next.y > 0 && next.y < 96);
});
check('屏幕坐标经相机偏移换算为世界格', () => {
  const rect = { left: 10, top: 20, width: 384, height: 288 };
  const cell = F.screenToCell(10 + 120, 20 + 96, rect, { x: 96, y: 48 }, 768, 576);
  assert.equal(cell.x, 7); assert.equal(cell.y, 5);
});
check('v5 旧图逐格嵌入农田，作物道具与标量完整保留', () => {
  const s = F.createGame();
  s.version = 5; s.plots = s.plots.slice(0, 9).map(row => row.slice(0, 12));
  s.plots[2][3] = { tilled: true, crop: { type: 'potato', progress: 2 }, structure: null };
  s.plots[4][4].structure = 'scarecrow'; s.weapon = 'axe'; s.villagers.mayor.hearts = 2;
  s.gold = 347; s.health = 62; s.farmer = { x: 11, y: 8, facing: 'left' };
  const migrated = F.migrateSave(s); const anchor = F.LAYOUT.oldPlots;
  assert.equal(migrated.version, 6);
  assert.equal(migrated.plots[anchor.y + 2][anchor.x + 3].crop.progress, 2);
  assert.equal(migrated.plots[anchor.y + 4][anchor.x + 4].structure, 'scarecrow');
  assert.equal(migrated.weapon, 'axe'); assert.equal(migrated.villagers.mayor.hearts, 2);
  assert.equal(migrated.gold, 347); assert.equal(migrated.health, 62);
  assert.equal(migrated.farmer.x, F.LAYOUT.homeDoor.x);
  assert.equal(migrated.farmer.y, F.LAYOUT.homeDoor.y);
  assert.equal(F.canWalk(migrated, migrated.farmer.x, migrated.farmer.y), true);
});
check('v1 至 v5 的 12×9 旧档均可迁移到 v6', () => {
  for (let version = 1; version <= 5; version++) {
    const s = F.createGame(); s.version = version;
    s.plots = s.plots.slice(0, F.LAYOUT.oldPlots.height).map(row => row.slice(0, F.LAYOUT.oldPlots.width));
    s.plots[8][11].tilled = true; s.orders = [{ id: 4, crop: 'carrot', amount: 2, deadline: 9, reward: 75 }];
    s.nightRaid = { level: 'raid', count: 1, attackers: ['bandit'] };
    const next = F.migrateSave(s);
    assert.equal(next.version, 6); assert.equal(next.plots[12][15].tilled, true);
    assert.equal(next.orders[0].id, 4); assert.equal(next.nightRaid.attackers[0], 'bandit');
    assert.equal(F.migrateSave(next).plots[12][15].tilled, true);
  }
});
console.log(`全部通过：${passed} 项测试。`);
