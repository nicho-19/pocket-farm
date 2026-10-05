(function (root) {
  'use strict';

  const WIDTH = 12;
  const HEIGHT = 9;
  const ENERGY_MAX = 40;
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
    hoe: { name: '锄头', cost: 4 },
    seed: { name: '种子', cost: 2 },
    water: { name: '水壶', cost: 2 },
    scythe: { name: '镰刀', cost: 3 }
  };
  const DIRECTIONS = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
  };

  function makePlot() {
    return { tilled: false, watered: false, crop: null };
  }

  function cropCounts() {
    return Object.fromEntries(Object.keys(CROPS).map(key => [key, 0]));
  }

  function createGame() {
    return {
      version: 3,
      day: 1,
      weather: 'sunny',
      tomorrow: 'sunny',
      gold: 100,
      energy: ENERGY_MAX,
      farmer: { x: 5, y: 4, facing: 'down' },
      tool: 'hoe',
      selectedCrop: 'carrot',
      seeds: { ...cropCounts(), carrot: 3 },
      bag: cropCounts(),
      snacks: 0,
      upgrades: { hoe: false, water: false },
      orders: [],
      nextOrderId: 1,
      stats: { income: 0, harvested: 0, orders: 0, days: 0 },
      manualTool: false,
      plots: Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, makePlot))
    };
  }

  function migrateSave(saved) {
    if (!saved || ![1, 2, 3].includes(saved.version) ||
        !Array.isArray(saved.plots) || saved.plots.length !== HEIGHT ||
        !saved.plots.every(row => Array.isArray(row) && row.length === WIDTH) ||
        !saved.farmer || !inBounds(saved.farmer.x, saved.farmer.y) ||
        !DIRECTIONS[saved.farmer.facing] || !TOOLS[saved.tool] ||
        !CROPS[saved.selectedCrop] || !Number.isFinite(saved.day) ||
        !Number.isFinite(saved.gold) || !Number.isFinite(saved.energy)) return null;
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
    saved.upgrades = { hoe: !!saved.upgrades?.hoe, water: !!saved.upgrades?.water };
    saved.orders = Array.isArray(saved.orders) ? saved.orders.filter(order => CROPS[order.crop] && Number.isInteger(order.amount) && order.amount > 0 && Number.isInteger(order.deadline) && Number.isInteger(order.reward)) : [];
    saved.nextOrderId = Number.isInteger(saved.nextOrderId) ? saved.nextOrderId : 1;
    saved.stats = { income: 0, harvested: 0, orders: 0, days: 0, ...saved.stats };
    saved.manualTool = !!saved.manualTool;
    saved.version = 3;
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
    if (state.plots[y][x].crop) return result(false, '作物挡住了去路');
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
      else if (plot.crop && !plot.watered) tool = 'water';
      else if (plot.tilled && !plot.crop && state.seeds[state.selectedCrop] > 0) tool = 'seed';
      else if (!plot.tilled) tool = 'hoe';
    }
    const crop = state.selectedCrop;
    const cost = tool === 'hoe' && state.upgrades.hoe ? 2 : TOOLS[tool].cost;
    if (state.energy < cost) return result(false, '体力不足，回家睡一觉吧');

    let message;
    if (tool === 'hoe') {
      if (plot.tilled) return result(false, '这块地已经开垦过了');
      plot.tilled = true;
      message = '开垦了一块田地';
    } else if (tool === 'seed') {
      if (!plot.tilled) return result(false, '先用锄头开垦土地');
      if (plot.crop) return result(false, '这块地已经有作物了');
      if (state.seeds[crop] < 1) return result(false, `${CROPS[crop].name}种子不够，去商店购买`);
      state.seeds[crop]--;
      plot.crop = { type: crop, progress: 0 };
      plot.watered = state.weather === 'rain';
      message = `播下${CROPS[crop].name}种子`;
    } else if (tool === 'water') {
      if (!plot.crop) return result(false, '这里没有需要浇水的作物');
      if (plot.watered) return result(false, '这块地今天已经浇过水了');
      const cells = state.upgrades.water ? [-1, 0, 1] : [0];
      for (const offset of cells) {
        const side = ['up', 'down'].includes(state.farmer.facing) ? state.plots[y]?.[x + offset] : state.plots[y + offset]?.[x];
        if (side?.crop) side.watered = true;
      }
      message = `给${CROPS[plot.crop.type].name}浇了水`;
    } else if (tool === 'scythe') {
      if (!plot.crop) return result(false, '这里没有作物');
      const planted = plot.crop;
      if (planted.progress < CROPS[planted.type].days) return result(false, '作物还没有成熟');
      state.bag[planted.type]++;
      state.stats.harvested++;
      plot.crop = null;
      plot.watered = false;
      message = `收获了${CROPS[planted.type].name}，已放入背包`;
    }
    state.energy -= cost;
    return { ...result(true, message), tool };
  }

  function buySeed(state, crop, amount) {
    if (!CROPS[crop] || !Number.isInteger(amount) || amount < 1) return result(false, '购买数量无效');
    const price = CROPS[crop].seedPrice * amount;
    if (state.gold < price) return result(false, '金币不够');
    state.gold -= price;
    state.seeds[crop] += amount;
    return result(true, `购买了 ${amount} 包${CROPS[crop].name}种子`);
  }

  function sellAll(state) {
    let total = 0;
    let count = 0;
    for (const [key, crop] of Object.entries(CROPS)) {
      count += state.bag[key];
      total += state.bag[key] * crop.sellPrice;
      state.bag[key] = 0;
    }
    if (!count) return result(false, '背包里还没有可以卖的作物');
    state.gold += total;
    state.stats.income += total;
    return result(true, `卖出 ${count} 份收获，获得 ${total} 金币`);
  }

  function buyUpgrade(state, tool) {
    const price = { hoe: 400, water: 600 }[tool];
    if (!price) return result(false, '无效升级');
    if (state.upgrades[tool]) return result(false, '已经升级过了');
    if (state.gold < price) return result(false, '金币不够');
    state.gold -= price;
    state.upgrades[tool] = true;
    return result(true, `升级了${tool === 'hoe' ? '精钢锄' : '铁水壶'}`);
  }

  function buySnack(state) {
    if (state.gold < 20) return result(false, '金币不够');
    state.gold -= 20;
    state.snacks++;
    return result(true, '买了一个饭团');
  }

  function eatSnack(state) {
    if (!state.snacks) return result(false, '背包里没有饭团');
    if (state.energy >= ENERGY_MAX) return result(false, '体力已经满了');
    state.snacks--;
    state.energy = Math.min(ENERGY_MAX, state.energy + 15);
    return result(true, '吃饭团恢复了体力');
  }

  function generateOrders(state, random) {
    const roll = random || Math.random;
    const available = Object.keys(CROPS).filter(key => CROPS[key].seedPrice <= Math.max(30, state.gold + 20));
    const count = 1 + Math.floor(roll() * 3);
    state.orders = Array.from({ length: count }, () => {
      const crop = available[Math.floor(roll() * available.length)];
      const amount = 1; // 一块地的一茬收获一份。
      return { id: state.nextOrderId++, crop, amount, deadline: state.day + 2 + Math.floor(roll() * 3), reward: Math.round(CROPS[crop].sellPrice * amount * 1.5) + 5 + Math.floor(roll() * 11) };
    });
    return state.orders;
  }

  function deliverOrder(state, id) {
    const index = state.orders.findIndex(order => order.id === id);
    if (index < 0) return result(false, '订单已失效');
    const order = state.orders[index];
    if (state.day > order.deadline) return result(false, '订单已过期');
    if (state.bag[order.crop] < order.amount) return result(false, '背包里的作物不够');
    state.bag[order.crop] -= order.amount;
    state.gold += order.reward;
    state.stats.income += order.reward;
    state.stats.orders++;
    state.orders.splice(index, 1);
    return result(true, `交付${CROPS[order.crop].name}订单，获得 ${order.reward} G`);
  }

  function findPath(state, targetX, targetY) {
    if (!inBounds(targetX, targetY)) return null;
    const start = state.farmer;
    const queue = [{ x: start.x, y: start.y, path: [] }];
    const seen = new Set([`${start.x},${start.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      if (Math.abs(node.x - targetX) + Math.abs(node.y - targetY) === 1) return node.path;
      for (const [direction, [dx, dy]] of Object.entries(DIRECTIONS)) {
        const x = node.x + dx, y = node.y + dy, key = `${x},${y}`;
        if (inBounds(x, y) && !seen.has(key) && !state.plots[y][x].crop) {
          seen.add(key);
          queue.push({ x, y, path: [...node.path, direction] });
        }
      }
    }
    return null;
  }

  function sleep(state, random) {
    const events = [];
    for (const row of state.plots) {
      for (const plot of row) {
        if (plot.crop && plot.watered && plot.crop.progress < CROPS[plot.crop.type].days) {
          plot.crop.progress++;
          if (plot.crop.progress === CROPS[plot.crop.type].days) {
            events.push(`${CROPS[plot.crop.type].name}成熟了！`);
          }
        }
        plot.watered = false;
      }
    }
    state.day++;
    state.energy = ENERGY_MAX;
    const roll = random || Math.random;
    state.weather = state.tomorrow;
    state.tomorrow = roll() < RAIN_CHANCE[season(state)] ? 'rain' : 'sunny';
    if (state.weather === 'rain') {
      for (const row of state.plots) {
        for (const plot of row) if (plot.crop) plot.watered = true;
      }
      events.push('下雨了，今天不用浇水');
    } else {
      events.push('今天是晴天，记得给作物浇水');
    }
    if (seasonDay(state) === 1) events.push(`进入${season(state)}季`);
    state.stats.days++;
    const expired = state.orders.filter(order => state.day > order.deadline);
    if (expired.length) events.push(`${expired.length} 个订单过期失效`);
    generateOrders(state, roll);
    return result(true, `睡了一觉，来到第 ${state.day} 天`, events);
  }

  root.PocketFarm = {
    WIDTH, HEIGHT, ENERGY_MAX, RAIN_CHANCE, CROPS, TOOLS, DIRECTIONS,
    createGame, migrateSave, season, seasonDay, frontCell, move, selectTool, selectCrop,
    act, buySeed, sellAll, sleep, buyUpgrade, buySnack, eatSnack, generateOrders, deliverOrder, findPath
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
