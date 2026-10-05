(function (root) {
  'use strict';

  const WIDTH = 12;
  const HEIGHT = 9;
  const ENERGY_MAX = 40;
  const RAIN_CHANCE = 0.25;
  const SEASONS = ['春', '夏', '秋', '冬'];
  const CROPS = {
    carrot: { name: '萝卜', days: 3, seedPrice: 10, sellPrice: 28 },
    potato: { name: '土豆', days: 4, seedPrice: 18, sellPrice: 48 },
    pumpkin: { name: '南瓜', days: 5, seedPrice: 30, sellPrice: 85 }
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

  function createGame() {
    return {
      version: 1,
      day: 1,
      weather: 'sunny',
      gold: 100,
      energy: ENERGY_MAX,
      farmer: { x: 5, y: 4, facing: 'down' },
      tool: 'hoe',
      selectedCrop: 'carrot',
      seeds: { carrot: 3, potato: 0, pumpkin: 0 },
      bag: { carrot: 0, potato: 0, pumpkin: 0 },
      plots: Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, makePlot))
    };
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
    state.farmer.x = x;
    state.farmer.y = y;
    return result(true, '移动', []);
  }

  function selectTool(state, tool) {
    if (!TOOLS[tool]) return result(false, '无效工具');
    state.tool = tool;
    return result(true, `已选择${TOOLS[tool].name}`, []);
  }

  function selectCrop(state, crop) {
    if (!CROPS[crop]) return result(false, '无效作物');
    state.selectedCrop = crop;
    return result(true, `已选择${CROPS[crop].name}种子`, []);
  }

  function act(state) {
    const { x, y } = frontCell(state);
    if (!inBounds(x, y)) return result(false, '前方没有地块');
    const plot = state.plots[y][x];
    const tool = state.tool;
    const crop = state.selectedCrop;
    if (state.energy < TOOLS[tool].cost) return result(false, '体力不足，回家睡一觉吧');

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
      plot.watered = true;
      message = `给${CROPS[plot.crop.type].name}浇了水`;
    } else if (tool === 'scythe') {
      if (!plot.crop) return result(false, '这里没有作物');
      const planted = plot.crop;
      if (planted.progress < CROPS[planted.type].days) return result(false, '作物还没有成熟');
      state.bag[planted.type]++;
      plot.crop = null;
      plot.watered = false;
      message = `收获了${CROPS[planted.type].name}，已放入背包`;
    }
    state.energy -= TOOLS[tool].cost;
    return result(true, message);
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
    return result(true, `卖出 ${count} 份收获，获得 ${total} 金币`);
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
    const roll = (random || Math.random)();
    state.weather = roll < RAIN_CHANCE ? 'rain' : 'sunny';
    if (state.weather === 'rain') {
      for (const row of state.plots) {
        for (const plot of row) if (plot.crop) plot.watered = true;
      }
      events.push('下雨了，今天不用浇水');
    } else {
      events.push('今天是晴天，记得给作物浇水');
    }
    if (seasonDay(state) === 1) events.push(`进入${season(state)}季`);
    return result(true, `睡了一觉，来到第 ${state.day} 天`, events);
  }

  root.PocketFarm = {
    WIDTH, HEIGHT, ENERGY_MAX, RAIN_CHANCE, CROPS, TOOLS,
    createGame, season, seasonDay, frontCell, move, selectTool, selectCrop,
    act, buySeed, sellAll, sleep
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
