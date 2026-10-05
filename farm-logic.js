(function (root) {
  'use strict';

  const WIDTH = 12;
  const HEIGHT = 9;
  const HEALTH_MAX = 100;
  const RAIN_CHANCE = { '春': 0.30, '夏': 0.40, '秋': 0.25, '冬': 0.20 };
  const SEASONS = ['春', '夏', '秋', '冬'];
  const CROPS = {
    carrot: { name: '萝卜', days: 3, seedPrice: 10, sellPrice: 25 },
    potato: { name: '土豆', days: 4, seedPrice: 18, sellPrice: 48 },
    pumpkin: { name: '南瓜', days: 5, seedPrice: 30, sellPrice: 85 },
    strawberry: { name: '草莓', days: 4, seedPrice: 30, sellPrice: 81 },
    corn: { name: '玉米', days: 3, seedPrice: 15, sellPrice: 38 }
  };
  const TOOLS = {
    hoe: { name: '锄头' },
    seed: { name: '种子' },
    scythe: { name: '镰刀' },
    build: { name: '建造' }
  };
  const DIRECTIONS = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
  };
  const BUILDINGS = { scarecrow: { name: '稻草人', price: 150 }, fence: { name: '木栅栏', price: 40 } };
  const FOOD_HEAL = { carrot: 6, potato: 8, corn: 8, strawberry: 10, pumpkin: 14, snack: 20 };
  const WEAPONS = { none: { name: '徒手', price: 0, damage: 0, counter: 0 }, club: { name: '木棍', price: 100, damage: 1, counter: 0.30 }, axe: { name: '石斧', price: 300, damage: 2, counter: 0.55 }, sword: { name: '铁剑', price: 800, damage: 3, counter: 0.80 } };
  const VILLAGERS = { mayor: { name: '村长', points: [[1, 1], [2, 1], [1, 2]], gift: '100G' }, merchant: { name: '商人婆婆', points: [[3, 1], [4, 1], [3, 2]], gift: '饭团×2' }, hunter: { name: '小猎手', points: [[6, 1], [7, 1], [6, 2]], gift: '木栅栏×2' } };
  function validRaid(raid) {
    return raid && ['calm', 'raid', 'large'].includes(raid.level) &&
      Number.isInteger(raid.count) && raid.count >= 0 && raid.count <= 6 &&
      (raid.level === 'calm' || (Array.isArray(raid.attackers) && raid.attackers.length === raid.count && raid.attackers.every(kind => kind === 'crow' || kind === 'bandit' || kind === 'boar')));
  }
  function planRaid(day, random) {
    if (day <= 2) return { level: 'calm', count: 0 };
    const large = day % 7 === 0;
    if (!large && random() >= 0.45) return { level: 'calm', count: 0 };
    const count = Math.min((1 + Math.floor(day / 10)) * (large ? 2 : 1), large ? 6 : 4);
    return { level: large ? 'large' : 'raid', count, attackers: Array.from({ length: count }, () => random() < 0.5 ? 'crow' : 'bandit') };
  }

  function makePlot() {
    return { tilled: false, crop: null, structure: null };
  }

  function cropCounts() {
    return Object.fromEntries(Object.keys(CROPS).map(key => [key, 0]));
  }

  function createGame() {
    return {
      version: 5,
      day: 1,
      weather: 'sunny',
      tomorrow: 'sunny',
      gold: 100,
      health: HEALTH_MAX,
      weapon: 'none',
      gameOver: false,
      villagers: Object.fromEntries(Object.keys(VILLAGERS).map(id => [id, { hearts: 0, giftedDay: 0, rewarded: false }])),
      fenceStock: 0,
      farmer: { x: 5, y: 4, facing: 'down' },
      tool: 'hoe',
      selectedCrop: 'carrot',
      seeds: { ...cropCounts(), carrot: 3 },
      bag: cropCounts(),
      snacks: 0,
      nightRaid: { level: 'calm', count: 0 },
      orders: [],
      nextOrderId: 1,
      stats: { income: 0, harvested: 0, orders: 0, days: 0, repelled: 0 },
      manualTool: false,
      tutorial: 0,
      plots: Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, makePlot))
    };
  }

  function migrateSave(saved) {
    if (!saved || ![1, 2, 3, 4, 5].includes(saved.version) ||
        !Array.isArray(saved.plots) || saved.plots.length !== HEIGHT ||
        !saved.plots.every(row => Array.isArray(row) && row.length === WIDTH) ||
        !saved.farmer || !inBounds(saved.farmer.x, saved.farmer.y) ||
        !DIRECTIONS[saved.farmer.facing] || !(TOOLS[saved.tool] || saved.tool === 'water') ||
        !CROPS[saved.selectedCrop] || !Number.isFinite(saved.day) ||
        !Number.isFinite(saved.gold)) return null;
    delete saved.energy;
    saved.health = Number.isFinite(saved.health) ? Math.max(0, Math.min(HEALTH_MAX, saved.health)) : HEALTH_MAX;
    saved.weapon = WEAPONS[saved.weapon] ? saved.weapon : 'none';
    saved.gameOver = !!saved.gameOver || saved.health <= 0;
    saved.villagers = Object.fromEntries(Object.keys(VILLAGERS).map(id => {
      const old = saved.villagers?.[id] || {};
      return [id, { hearts: Math.max(0, Math.min(5, Number.isInteger(old.hearts) ? old.hearts : 0)), giftedDay: Number.isInteger(old.giftedDay) ? old.giftedDay : 0, rewarded: !!old.rewarded }];
    }));
    saved.fenceStock = Number.isInteger(saved.fenceStock) && saved.fenceStock >= 0 ? saved.fenceStock : 0;
    saved.seeds = { ...cropCounts(), ...saved.seeds };
    saved.bag = { ...cropCounts(), ...saved.bag };
    for (const row of saved.plots) {
      for (const plot of row) {
        if (!plot || typeof plot !== 'object' ||
            (plot.crop && !CROPS[plot.crop.type])) return null;
      }
    }
    saved.tomorrow = saved.tomorrow === 'rain' ? 'rain' : 'sunny';
    saved.snacks = Number.isInteger(saved.snacks) && saved.snacks >= 0 ? saved.snacks : 0;
    const refund = !!saved.upgrades?.water;
    const hoeRefund = saved.version <= 4 && !!saved.upgrades?.hoe;
    delete saved.upgrades;
    if (refund) {
      saved.gold += 600;
      saved.migrationEvents = [...(Array.isArray(saved.migrationEvents) ? saved.migrationEvents : []), '水壶已回收，返还 600G'];
    }
    if (hoeRefund) {
      saved.gold += 400;
      saved.migrationEvents = [...(Array.isArray(saved.migrationEvents) ? saved.migrationEvents : []), '精钢锄已回收，返还 400G'];
    }
    if (saved.tool === 'water') saved.tool = 'hoe';
    for (const row of saved.plots) for (const plot of row) {
      delete plot.watered;
      if (plot.structure !== 'scarecrow' && plot.structure !== 'fence') plot.structure = null;
    }
    saved.nightRaid = validRaid(saved.nightRaid) ? saved.nightRaid : { level: 'calm', count: 0 };
    if (saved.nightRaid.attackers) saved.nightRaid.attackers = saved.nightRaid.attackers.map(kind => kind === 'boar' ? 'bandit' : kind);
    saved.orders = Array.isArray(saved.orders) ? saved.orders.filter(order => CROPS[order.crop] && Number.isInteger(order.amount) && order.amount > 0 && Number.isInteger(order.deadline) && Number.isInteger(order.reward)).map(order => ({ ...order, accepted: order.accepted !== false })) : [];
    saved.nextOrderId = Number.isInteger(saved.nextOrderId) ? saved.nextOrderId : 1;
    saved.stats = { income: 0, harvested: 0, orders: 0, days: 0, repelled: 0, ...saved.stats };
    saved.manualTool = !!saved.manualTool;
    saved.tutorial = Number.isInteger(saved.tutorial) && saved.tutorial >= 0 && saved.tutorial <= 2 ? saved.tutorial : 2;
    saved.version = 5;
    return saved;
  }

  function season(state) {
    return SEASONS[Math.floor((state.day - 1) / 28) % SEASONS.length];
  }

  function seasonDay(state) {
    return ((state.day - 1) % 28) + 1;
  }

  function frontCell(state) {
    const offset = DIRECTIONS[state.farmer.facing];
    return { x: state.farmer.x + offset[0], y: state.farmer.y + offset[1] };
  }

  function inBounds(x, y) {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
  }

  function result(ok, message, events) {
    return { ok, message, events: events || (ok ? [message] : []) };
  }

  function move(state, direction) {
    if (!DIRECTIONS[direction]) return result(false, '无效方向');
    state.farmer.facing = direction;
    const [dx, dy] = DIRECTIONS[direction];
    const x = state.farmer.x + dx;
    const y = state.farmer.y + dy;
    if (!inBounds(x, y)) return result(false, '农场边界，不能再往前走了');
    if (state.plots[y][x].structure === 'fence') return result(false, '木栅栏挡住了路');
    state.farmer.x = x;
    state.farmer.y = y;
    return result(true, '移动', []);
  }

  function selectTool(state, tool) {
    if (!TOOLS[tool]) return result(false, '无效工具');
    state.tool = tool;
    state.manualTool = true;
    return result(true, `已选择${TOOLS[tool].name}`, []);
  }

  function selectCrop(state, crop) {
    if (!CROPS[crop]) return result(false, '无效作物');
    state.selectedCrop = crop;
    return result(true, `已选择${CROPS[crop].name}种子`, []);
  }

  function act(state, smart) {
    const { x, y } = frontCell(state);
    if (!inBounds(x, y)) return result(false, '前方没有地块');
    const plot = state.plots[y][x];
    let tool = state.tool;
    if (smart && !state.manualTool) {
      if (plot.crop && plot.crop.progress >= CROPS[plot.crop.type].days) tool = 'scythe';
      else if (plot.tilled && !plot.crop && state.seeds[state.selectedCrop] > 0) tool = 'seed';
      else if (!plot.tilled) tool = 'hoe';
    }
    const crop = state.selectedCrop;

    let message;
    if (tool === 'hoe') {
      if (plot.structure) return result(false, '这里有防御道具');
      if (plot.tilled) return result(false, '这块地已经开垦过了');
      plot.tilled = true;
      message = '开垦了一块田地';
    } else if (tool === 'seed') {
      if (plot.structure) return result(false, '这里有防御道具');
      if (!plot.tilled) return result(false, '先用锄头开垦土地');
      if (plot.crop) return result(false, '这块地已经有作物了');
      if (state.seeds[crop] < 1) return result(false, `${CROPS[crop].name}种子不够，去商店购买`);
      state.seeds[crop]--;
      plot.crop = { type: crop, progress: 0 };
      message = `播下${CROPS[crop].name}种子`;
    } else if (tool === 'scythe') {
      if (plot.structure) {
        const name = plot.structure === 'fence' ? '木栅栏' : '稻草人';
        plot.structure = null;
        return { ...result(true, `回收了${name}（不返金币）`), tool };
      }
      if (!plot.crop) return result(false, '这里没有作物');
      const planted = plot.crop;
      if (planted.progress < CROPS[planted.type].days) return result(false, '作物还没有成熟');
      state.bag[planted.type]++;
      state.stats.harvested++;
      plot.crop = null;
      message = `收获了${CROPS[planted.type].name}，已放入背包`;
    } else if (tool === 'build') {
      return result(false, '请先在建造面板选择道具');
    }
    return { ...result(true, message), tool };
  }

  function buySeed(state, crop, amount) {
    if (!CROPS[crop] || !Number.isInteger(amount) || amount < 1) return result(false, '购买数量无效');
    const price = CROPS[crop].seedPrice * amount;
    if (state.gold < price) return result(false, '金币不够');
    state.gold -= price;
    state.seeds[crop] += amount;
    return result(true, `购买了 ${amount} 包${CROPS[crop].name}种子，花费 ${price} G，余额 ${state.gold} G`);
  }
  function placeBuilding(state, kind) {
    if (!BUILDINGS[kind]) return result(false, '无效建造道具');
    const { x, y } = frontCell(state);
    if (!inBounds(x, y)) return result(false, '前方没有地块');
    const plot = state.plots[y][x];
    if (plot.tilled || plot.crop || plot.structure) return result(false, '只能放在空草地上');
    const price = BUILDINGS[kind].price;
    const free = kind === 'fence' && state.fenceStock > 0;
    if (free) state.fenceStock--;
    else {
      if (state.gold < price) return result(false, `金币不足，还差 ${price - state.gold} G`);
      state.gold -= price;
    }
    plot.structure = kind;
    return result(true, `放置了${BUILDINGS[kind].name}${free ? '，使用库存' : `，花费 ${price} G`}`);
  }

  function giftVillager(state, id, crop) {
    if (!VILLAGERS[id] || !CROPS[crop]) return result(false, '送礼目标无效');
    const villager = state.villagers[id];
    if (villager.giftedDay === state.day) return result(false, '今天已经送过这位村民了');
    if (state.bag[crop] < 1) return result(false, '背包里没有这份作物');
    state.bag[crop]--; villager.giftedDay = state.day;
    villager.hearts = Math.min(5, villager.hearts + 1);
    const events = [`送给${VILLAGERS[id].name}一份${CROPS[crop].name}，好感 ${villager.hearts}/5`];
    if (villager.hearts === 5 && !villager.rewarded) {
      villager.rewarded = true;
      if (id === 'mayor') state.gold += 100;
      if (id === 'merchant') state.snacks += 2;
      if (id === 'hunter') state.fenceStock += 2;
      events.push(`${VILLAGERS[id].name}回礼：${VILLAGERS[id].gift}`);
    }
    return { ...result(true, events[0], events), rewarded: villager.rewarded };
  }

  function villagerLine(state, id, turn = 0) {
    const common = {
      mayor: ['庄稼长得不错。', '订单板上有新活。', '雨天别忘了看看作物。', '村里人都盼着丰收。', '慢慢来，地会给你回报。', '昨夜的战报我看过了。'],
      merchant: ['新鲜种子在这边。', '富余的收成可以卖给我。', '饭团能救急。', '好武器能护住粮仓。', '四季都有好生意。', '昨夜可把我吓坏了。'],
      hunter: ['今晚我会留意林边。', '木棍也比徒手强。', '强盗怕有准备的人。', '栅栏能替你挡一回。', '别让血量见底。', '昨晚的脚印还在呢。']
    };
    if (turn % 6 === 0) return state.nightRaid.level === 'large' ? '今晚大入侵将至，务必当心！' : `今晚${state.nightRaid.attackers?.filter(kind => kind === 'bandit').length || 0}名强盗可能来。`;
    if (turn % 6 === 1) return `${season(state)}季${state.weather === 'rain' ? '下雨' : '晴朗'}，田里的节奏变了。`;
    return common[id][turn % 6];
  }

  function orderReserve(state, crop) {
    return state.orders.filter(order => order.crop === crop && order.accepted !== false).reduce((sum, order) => sum + order.amount, 0);
  }
  function salePreview(state) {
    let total = 0, count = 0;
    for (const [key, crop] of Object.entries(CROPS)) {
      const amount = Math.max(0, state.bag[key] - orderReserve(state, key));
      count += amount;
      total += amount * crop.sellPrice;
    }
    return { total, count };
  }
  function sellCrop(state, crop, amount) {
    if (!CROPS[crop] || !Number.isInteger(amount) || amount < 1 || state.bag[crop] < amount) return result(false, '卖出数量无效');
    const warning = state.bag[crop] - amount < orderReserve(state, crop);
    const total = amount * CROPS[crop].sellPrice;
    state.bag[crop] -= amount;
    state.gold += total;
    state.stats.income += total;
    return { ...result(true, `卖出 ${amount} 份${CROPS[crop].name}，获得 ${total} G`), warning };
  }
  function sellAll(state) {
    const { total, count } = salePreview(state);
    if (!count) return result(false, '背包里没有可卖的富余作物');
    for (const key of Object.keys(CROPS)) state.bag[key] = Math.min(state.bag[key], orderReserve(state, key));
    state.gold += total;
    state.stats.income += total;
    return result(true, `卖出 ${count} 份收获，获得 ${total} G，已保留订单所需作物`);
  }

  function buySnack(state) {
    if (state.gold < 20) return result(false, '金币不够');
    state.gold -= 20;
    state.snacks++;
    return result(true, '买了一个饭团');
  }

  function buyWeapon(state, weapon) {
    if (!WEAPONS[weapon] || weapon === 'none') return result(false, '无效武器');
    if (WEAPONS[weapon].damage <= WEAPONS[state.weapon].damage) return result(false, '已持有同级或更强武器');
    const price = WEAPONS[weapon].price;
    if (state.gold < price) return result(false, `金币不足，还差 ${price - state.gold} G`);
    state.gold -= price;
    state.weapon = weapon;
    return result(true, `购买${WEAPONS[weapon].name}，花费 ${price} G；旧武器未退款`);
  }

  function eatFood(state, food) {
    if (!FOOD_HEAL[food]) return result(false, '无效食物');
    if (!(food === 'snack' ? state.snacks : state.bag[food])) return result(false, '背包里没有这种食物');
    if (state.health >= HEALTH_MAX) return result(false, '生命已满，别浪费粮食');
    if (food === 'snack') state.snacks--;
    else state.bag[food]--;
    const restored = Math.min(FOOD_HEAL[food], HEALTH_MAX - state.health);
    state.health += restored;
    return result(true, `吃${food === 'snack' ? '饭团' : CROPS[food].name}恢复了 ${restored} 点生命`);
  }
  function quickEat(state) {
    const food = Object.keys(FOOD_HEAL).filter(key => key === 'snack' ? state.snacks : state.bag[key]).sort((a, b) => FOOD_HEAL[b] - FOOD_HEAL[a])[0];
    return food ? eatFood(state, food) : result(false, '背包里没有食物');
  }

  function generateOrders(state, random) {
    const roll = random || Math.random;
    const available = Object.keys(CROPS).filter(key => CROPS[key].seedPrice <= Math.max(30, state.gold + 20));
    const count = 1 + Math.floor(roll() * 3);
    state.orders = Array.from({ length: count }, () => {
      const crop = available[Math.floor(roll() * available.length)];
      const amount = 1; // 一块地的一茬收获一份。
      return { id: state.nextOrderId++, crop, amount, deadline: state.day + 2 + Math.floor(roll() * 3), reward: Math.round(CROPS[crop].sellPrice * amount * 1.5) + 5 + Math.floor(roll() * 11), accepted: false };
    });
    return state.orders;
  }

  function acceptOrder(state, id) {
    const order = state.orders.find(item => item.id === id);
    if (!order || state.day > order.deadline) return result(false, '订单已失效');
    if (order.accepted) return result(false, '已经接过这份订单');
    order.accepted = true;
    return result(true, `接下${CROPS[order.crop].name}订单`);
  }

  function deliverOrder(state, id) {
    const index = state.orders.findIndex(order => order.id === id);
    if (index < 0) return result(false, '订单已失效');
    const order = state.orders[index];
    if (order.accepted === false) return result(false, '请先接下订单');
    if (state.day > order.deadline) return result(false, '订单已过期');
    if (state.bag[order.crop] < order.amount) return result(false, '背包里的作物不够');
    state.bag[order.crop] -= order.amount;
    state.gold += order.reward;
    state.stats.income += order.reward;
    state.stats.orders++;
    state.orders.splice(index, 1);
    return result(true, `交付${CROPS[order.crop].name}订单，获得 ${order.reward} G`);
  }

  function findPath(state, targetX, targetY, from = state.farmer, adjacent = true) {
    if (!inBounds(targetX, targetY)) return null;
    const queue = [{ x: from.x, y: from.y, path: [] }];
    const seen = new Set([`${from.x},${from.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      if (adjacent ? Math.abs(node.x - targetX) + Math.abs(node.y - targetY) === 1 : node.x === targetX && node.y === targetY) return node.path;
      for (const [direction, [dx, dy]] of Object.entries(DIRECTIONS)) {
        const x = node.x + dx, y = node.y + dy, key = `${x},${y}`;
        if (inBounds(x, y) && state.plots[y][x].structure !== 'fence' && !seen.has(key)) {
          seen.add(key);
          queue.push({ x, y, path: [...node.path, direction] });
        }
      }
    }
    return null;
  }

  function pathBetween(state, from, to) {
    return findPath(state, to.x, to.y, from, false);
  }

  function startWatch(state, now = 0) {
    const count = state.nightRaid.attackers?.filter(kind => kind === 'bandit').length || 0;
    if (!count) return null;
    return { count, spawned: 0, defeated: 0, enemies: [], started: now, lastMove: now, lastAttack: -Infinity, invulnerableUntil: 0, success: false };
  }

  function watchStrike(state, battle, now = 0) {
    const cell = frontCell(state);
    const enemy = battle.enemies.find(item => !item.retreating && item.x === cell.x && item.y === cell.y);
    if (!enemy) return result(false, '前方没有强盗');
    const damage = WEAPONS[state.weapon].damage;
    if (!damage) {
      const [dx, dy] = DIRECTIONS[state.farmer.facing];
      const x = enemy.x + dx, y = enemy.y + dy;
      if (inBounds(x, y) && state.plots[y][x].structure !== 'fence') { enemy.x = x; enemy.y = y; }
      return result(true, '徒手推开强盗一格');
    }
    enemy.health -= damage;
    if (enemy.health <= 0) {
      enemy.retreating = true; enemy.retreatNext = now; battle.defeated++; state.stats.repelled++;
      return result(true, `击退强盗！剩余 ${battle.count - battle.defeated} 人`);
    }
    return result(true, `击中强盗，造成 ${damage} 点伤害`);
  }

  function watchTick(state, battle, now) {
    if (battle.spawned < battle.count && now - battle.started >= battle.spawned * 2000) {
      const edges = [{ x: 0, y: 0 }, { x: WIDTH - 1, y: 0 }, { x: 0, y: HEIGHT - 1 }, { x: WIDTH - 1, y: HEIGHT - 1 }];
      const edge = edges.slice(battle.spawned % 4).concat(edges.slice(0, battle.spawned % 4)).find(cell => state.plots[cell.y][cell.x].structure !== 'fence') || edges[battle.spawned % 4];
      battle.enemies.push({ ...edge, health: 3, retreating: false }); battle.spawned++;
    }
    for (const enemy of battle.enemies) if (enemy.retreating && now >= enemy.retreatNext) {
      enemy.x += enemy.x < WIDTH / 2 ? -1 : 1;
      enemy.retreatNext = now + 120;
    }
    battle.enemies = battle.enemies.filter(enemy => !enemy.retreating || (enemy.x >= 0 && enemy.x < WIDTH));
    if (battle.defeated === battle.count && battle.spawned === battle.count && !battle.enemies.length) battle.success = true;
    if (now - battle.lastMove >= 500) {
      for (const enemy of battle.enemies) {
        if (enemy.retreating) continue;
        const targets = [state.farmer];
        if (!state.plots[enemy.y]?.[enemy.x]?.crop) for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (state.plots[y][x].crop) targets.push({ x, y });
        const paths = targets.map(target => pathBetween(state, enemy, target)).filter(path => path?.length).sort((a, b) => a.length - b.length);
        const step = paths[0]?.[0];
        if (step && Math.abs(enemy.x - state.farmer.x) + Math.abs(enemy.y - state.farmer.y) > 1) {
          enemy.x += DIRECTIONS[step][0]; enemy.y += DIRECTIONS[step][1];
        } else if (!step) {
          for (const [dx, dy] of Object.values(DIRECTIONS)) {
            const x = enemy.x + dx, y = enemy.y + dy;
            if (inBounds(x, y) && state.plots[y][x].structure === 'fence') { state.plots[y][x].structure = null; break; }
          }
        }
      }
      battle.lastMove = now;
    }
    if (now - battle.lastAttack >= 1000 && now >= battle.invulnerableUntil && battle.enemies.some(enemy => !enemy.retreating && Math.abs(enemy.x - state.farmer.x) + Math.abs(enemy.y - state.farmer.y) <= 1)) {
      state.health = Math.max(0, state.health - 4);
      battle.lastAttack = now; battle.invulnerableUntil = now + 500;
      return result(true, '强盗近身，农夫失去 4 HP');
    }
    return result(true, '', []);
  }

  function protectedByScarecrow(state, x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (state.plots[y + dy]?.[x + dx]?.structure === 'scarecrow') return true;
    }
    return false;
  }

  function raidDistance(state, targetX, targetY) {
    const origin = state.farmer;
    state.farmer = { x: 0, y: 0, facing: 'down' };
    const path = findPath(state, targetX, targetY);
    state.farmer = origin;
    return path ? path.length : Infinity;
  }

  function resolveRaid(state, raid, random = Math.random) {
    if (raid.level === 'calm') return { events: ['昨夜平静'], lost: 0, fences: 0, gold: 0, items: 0, repelled: 0 };
    const events = [];
    let lost = 0, fences = 0, gold = 0, items = 0, repelled = 0;
    for (const kind of raid.attackers) {
      if (kind === 'crow') {
        if (lost >= 3) { events.push('乌鸦无功而返'); continue; }
        const target = [];
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
          const crop = state.plots[y][x].crop;
          if (crop && crop.progress >= CROPS[crop.type].days && !protectedByScarecrow(state, x, y)) target.push({ x, y, type: crop.type });
        }
        if (target.length) {
          const { x, y, type } = target[0]; state.plots[y][x].crop = null; lost++;
          events.push(`乌鸦偷走了1棵${CROPS[type].name}`);
        } else events.push('稻草人或无目标吓退了乌鸦');
        continue;
      }
      const reachable = Number.isFinite(raidDistance(state, state.farmer.x, state.farmer.y));
      if (!reachable) {
        const barriers = [];
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
          if (state.plots[y][x].structure === 'fence') {
            const distance = raidDistance(state, x, y);
            if (Number.isFinite(distance)) barriers.push({ x, y, distance });
          }
        }
        barriers.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
        if (barriers.length) {
          const { x, y } = barriers[0]; state.plots[y][x].structure = null; fences++;
          events.push('强盗啃坏一段栅栏，本次未得手');
        } else events.push('强盗被栅栏挡退');
        continue;
      }
      const bagKeys = Object.keys(CROPS).filter(key => state.bag[key] > 0);
      if (state.snacks > 0) bagKeys.push('snack');
      const cropTargets = [];
      if (lost < 3) for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const crop = state.plots[y][x].crop;
        if (crop && Number.isFinite(raidDistance(state, x, y))) cropTargets.push({ x, y, type: crop.type });
      }
      if ((!bagKeys.length || items >= 5) && (!state.gold || gold >= 200) && !cropTargets.length) {
        events.push('强盗无功而返'); continue;
      }
      if (random() < WEAPONS[state.weapon].counter) {
        state.stats.repelled++;
        repelled++;
        events.push(`农夫用${WEAPONS[state.weapon].name}反击成功，打退强盗`);
        continue;
      }
      events.push('农夫反击未成');
      if (bagKeys.length && items < 5) {
        const key = bagKeys[Math.floor(random() * bagKeys.length)];
        const available = key === 'snack' ? state.snacks : state.bag[key];
        const count = Math.min(available, 5 - items, 1 + Math.floor(random() * 3));
        if (key === 'snack') state.snacks -= count;
        else state.bag[key] -= count;
        items += count;
        events.push(`强盗抢走 ${count} 份${key === 'snack' ? '饭团' : CROPS[key].name}`);
      } else if (state.gold > 0 && gold < 200) {
        const count = Math.min(state.gold, 200 - gold, 80, Math.max(1, Math.floor(state.gold * (0.05 + random() * 0.10))));
        state.gold -= count; gold += count;
        events.push(`强盗抢走 ${count} G`);
      } else if (cropTargets.length) {
        const { x, y, type } = cropTargets[0];
        state.plots[y][x].crop = null; state.plots[y][x].tilled = false; lost++;
        events.push(`强盗毁掉1格${CROPS[type].name}`);
      }
      if (random() < 0.5) {
        const damage = 8 + Math.floor(random() * 8);
        state.health = Math.max(0, state.health - damage);
        events.push(`农夫受伤 ${damage} HP`);
      }
      if (state.health <= 0) break;
    }
    return { events, lost, fences, gold, items, repelled };
  }

  function sleep(state, random, guarded = false) {
    if (state.gameOver) return result(false, '游戏已经结束');
    const events = [];
    const raid = guarded ? { events: ['守夜成功，今晚零损失'], lost: 0, fences: 0, gold: 0, items: 0, repelled: 0 } : resolveRaid(state, state.nightRaid || { level: 'calm' }, random || Math.random);
    events.push(...raid.events);
    if (!guarded && state.health > 0) state.health = Math.min(HEALTH_MAX, state.health + 10);
    if (state.health <= 0) {
      state.gameOver = true;
      return { ...result(true, '农夫倒下了，游戏结束', events), raid };
    }
    for (const row of state.plots) {
      for (const plot of row) {
        if (plot.crop && plot.crop.progress < CROPS[plot.crop.type].days) {
          plot.crop.progress = Math.min(CROPS[plot.crop.type].days, plot.crop.progress + 1 + (state.tomorrow === 'rain' ? 1 : 0));
          if (plot.crop.progress === CROPS[plot.crop.type].days) {
            events.push(`${CROPS[plot.crop.type].name}成熟了！`);
          }
        }
      }
    }
    state.day++;
    const roll = random || Math.random;
    state.weather = state.tomorrow;
    state.tomorrow = roll() < RAIN_CHANCE[season(state)] ? 'rain' : 'sunny';
    state.nightRaid = planRaid(state.day, roll);
    events.push(state.weather === 'rain' ? '雨天使作物额外生长 1 格' : '作物每天自动生长 1 格');
    if (seasonDay(state) === 1) events.push(`进入${season(state)}季`);
    state.stats.days++;
    const expired = state.orders.filter(order => state.day > order.deadline);
    if (expired.length) events.push(`${expired.length} 个订单过期失效`);
    generateOrders(state, roll);
    return { ...result(true, `${guarded ? '守夜成功' : '睡了一觉'}，来到第 ${state.day} 天`, events), raid };
  }

  root.PocketFarm = {
    WIDTH, HEIGHT, HEALTH_MAX, RAIN_CHANCE, CROPS, TOOLS, DIRECTIONS, BUILDINGS, FOOD_HEAL, WEAPONS, VILLAGERS, planRaid, resolveRaid,
    createGame, migrateSave, season, seasonDay, frontCell, move, selectTool, selectCrop,
    act, buySeed, sellAll, sellCrop, salePreview, orderReserve, sleep, buyWeapon, buySnack, eatFood, quickEat, generateOrders, acceptOrder, deliverOrder, findPath, placeBuilding, pathBetween, startWatch, watchStrike, watchTick, giftVillager, villagerLine
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
