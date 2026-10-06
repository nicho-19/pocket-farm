(function (root) {
  'use strict';

  const WIDTH = 40;
  const HEIGHT = 28;
  const HEALTH_MAX = 100;
  const WEATHERS = { sunny: { name: '晴', chance: 0.5 }, cloudy: { name: '多云', chance: 0.3 }, rain: { name: '雨', chance: 0.2 } };
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
    gather: { name: '采集' },
    rod: { name: '鱼竿' },
    build: { name: '建造' }
  };
  const DIRECTIONS = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
  };
  const BUILDINGS = { scarecrow: { name: '稻草人', price: 150 }, fence: { name: '木栅栏', price: 40 } };
  const RESOURCES = {
    wood: { name: '木材', sellPrice: 6 }, stone: { name: '石头', sellPrice: 8 },
    fish: { name: '池鱼', sellPrice: 35 }, berry: { name: '野果', sellPrice: 12 }
  };
  const FOOD_HEAL = { carrot: 6, potato: 8, corn: 8, strawberry: 10, pumpkin: 14, snack: 20, fish: 12, berry: 5 };
  const CRAFTS = {
    fence: { name: '木栅栏', costs: { wood: 2 }, stock: 'fenceStock' },
    scarecrow: { name: '稻草人', costs: { wood: 5, stone: 2 }, stock: 'scarecrowStock' },
    snack: { name: '野果饭团', costs: { berry: 2 }, stock: 'snacks' }
  };
  const WEAPONS = { none: { name: '徒手', price: 0, damage: 0, counter: 0 }, club: { name: '木棍', price: 100, damage: 1, counter: 0.30 }, axe: { name: '石斧', price: 300, damage: 2, counter: 0.55 }, sword: { name: '铁剑', price: 800, damage: 3, counter: 0.80 } };
  const LAYOUT = {
    v7Anchor: { x: 10, y: 7 }, oldWorld: { left: 10, top: 7, right: 29, bottom: 20 },
    home: { x: 11, y: 8 }, homeDoor: { x: 11, y: 9 },
    huts: [{ x: 13, y: 8 }, { x: 15, y: 8 }, { x: 16, y: 8 }],
    square: { x: 13, y: 10 },
    farm: { left: 14, top: 11, right: 34, bottom: 25 },
    farmAreas: [
      { left: 14, top: 11, right: 25, bottom: 19 },
      { left: 27, top: 11, right: 34, bottom: 15 },
      { left: 14, top: 21, right: 25, bottom: 25 }
    ],
    oldPlots: { x: 14, y: 11, width: 12, height: 9 },
    oldWoods: { left: 18, top: 7, right: 29, bottom: 9, pathX: 23 },
    woods: { left: 6, top: 1, right: 35, bottom: 9, pathX: 23, paths: [13, 23] },
    pond: { left: 26, top: 16, right: 32, bottom: 20 },
    meadow: { left: 32, top: 7, right: 38, bottom: 15 },
    gate: { x: 20, y: 27 },
    raidSpawns: [{ x: 9, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 10 }]
  };
  const VILLAGERS = { mayor: { name: '村长', points: [[12, 9], [12, 10], [13, 10]], gift: '100G', likes: 'fish' }, merchant: { name: '商人婆婆', points: [[14, 9], [14, 10], [13, 10]], gift: '饭团×2', likes: 'berry' }, hunter: { name: '小猎手', points: [[16, 9], [16, 10], [15, 10]], gift: '木栅栏×2', likes: 'corn' } };
  const ACHIEVEMENTS = [
    { id: 'harvest-10', name: '初尝丰收', description: '累计收获 10 份作物', reward: 20, check: s => s.stats.harvested >= 10 },
    { id: 'harvest-50', name: '田园熟手', description: '累计收获 50 份作物', reward: 80, check: s => s.stats.harvested >= 50 },
    { id: 'harvest-150', name: '丰收之星', description: '累计收获 150 份作物', reward: 250, check: s => s.stats.harvested >= 150 },
    { id: 'fish-20', name: '池边钓客', description: '累计钓鱼 20 次', reward: 80, check: s => s.stats.fished >= 20 },
    { id: 'gather-30', name: '林地行家', description: '累计采集 30 次', reward: 80, check: s => s.stats.gathered >= 30 },
    { id: 'craft-10', name: '手作达人', description: '累计制作 10 次', reward: 100, check: s => s.stats.crafted >= 10 },
    { id: 'orders-10', name: '靠谱农夫', description: '完成 10 份订单', reward: 120, check: s => s.stats.orders >= 10 },
    { id: 'repel-3', name: '守田人', description: '击退 3 名强盗', reward: 100, check: s => s.stats.repelled >= 3 },
    { id: 'income-5000', name: '买卖兴隆', description: '累计收入 5000 G', reward: 300, check: s => s.stats.income >= 5000 },
    { id: 'gold-1000', name: '千金在手', description: '持有 1000 G', reward: 150, check: s => s.gold >= 1000 },
    { id: 'days-14', name: '半月田园', description: '游玩 14 天', reward: 120, check: s => s.stats.days >= 14 },
    { id: 'friends-all', name: '全村好友', description: '三位村民好感全满', reward: 500, check: s => Object.values(s.villagers).every(v => v.hearts >= 5) }
  ];
  const RESOURCE_NODES = [
    ...[[18, 9], [20, 9], [22, 9], [25, 9], [27, 9], [29, 9], [7, 6], [10, 6], [16, 6], [30, 6], [31, 6], [35, 6]].map(([x, y], i) => ({ id: `tree-${i + 1}`, kind: 'tree', x, y, maxCharges: 2 })),
    ...[[19, 9], [26, 9], [8, 6], [17, 6], [32, 6]].map(([x, y], i) => ({ id: `berry-${i + 1}`, kind: 'berry', x, y, maxCharges: 2 })),
    ...[[21, 9], [28, 9], [11, 6], [33, 6], [34, 6]].map(([x, y], i) => ({ id: `stone-${i + 1}`, kind: 'stone', x, y, maxCharges: 2 })),
    ...[[26, 17], [26, 19], [29, 16], [32, 18]].map(([x, y], i) => ({ id: `fish-${i + 1}`, kind: 'fish', x, y, maxCharges: 2 }))
  ];
  function resourceNodeAt(x, y) { return RESOURCE_NODES.find(node => node.x === x && node.y === y) || null; }
  function freshResourceNodes() { return Object.fromEntries(RESOURCE_NODES.map(node => [node.id, { charges: node.maxCharges, respawnDay: 0 }])); }
  function inArea(x, y, area) { return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom; }
  function terrainAt(x, y) {
    if (!inBounds(x, y)) return 'outside';
    if (x === LAYOUT.home.x && y === LAYOUT.home.y || LAYOUT.huts.some(hut => hut.x === x && hut.y === y)) return 'house';
    if (inArea(x, y, LAYOUT.pond)) return 'pond';
    const wooded = inArea(x, y, LAYOUT.oldWoods) ||
      x >= LAYOUT.woods.left && x <= LAYOUT.woods.right && y >= LAYOUT.woods.top && y <= 6;
    if (wooded && !LAYOUT.woods.paths.includes(x)) return 'tree';
    if (wooded) return 'path';
    if (LAYOUT.farmAreas.some(area => inArea(x, y, area))) return 'farm';
    if (inArea(x, y, LAYOUT.meadow)) return 'meadow';
    if (x >= 10 && x <= 16 && y >= 7 && y <= 11) return 'residential';
    return 'grass';
  }
  function canWalk(state, x, y) { return inBounds(x, y) && !['house', 'pond', 'tree'].includes(terrainAt(x, y)) && state.plots[y][x].structure !== 'fence'; }
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
      version: 9,
      day: 1,
      weather: 'sunny',
      tomorrow: 'sunny',
      gold: 100,
      health: HEALTH_MAX,
      weapon: 'none',
      gameOver: false,
      villagers: Object.fromEntries(Object.keys(VILLAGERS).map(id => [id, { hearts: 0, giftedDay: 0, rewarded: false, likeKnown: false }])),
      fenceStock: 0,
      scarecrowStock: 0,
      farmer: { x: 15, y: 10, facing: 'down' },
      tool: 'hoe',
      selectedCrop: 'carrot',
      seeds: { ...cropCounts(), carrot: 3 },
      bag: cropCounts(),
      resources: { wood: 0, stone: 0, fish: 0, berry: 0 },
      resourceNodes: freshResourceNodes(),
      snacks: 0,
      nightRaid: { level: 'calm', count: 0 },
      orders: [],
      nextOrderId: 1,
      stats: { income: 0, harvested: 0, orders: 0, days: 0, repelled: 0, gathered: 0, fished: 0, crafted: 0 },
      manualTool: false,
      autoTool: true,
      achievements: [],
      tutorial: 0,
      plots: Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, makePlot))
    };
  }

  function migrateSave(saved) {
    const originalVersion = saved?.version;
    const shape = (width, height) => Array.isArray(saved?.plots) && saved.plots.length === height &&
      saved.plots.every(row => Array.isArray(row) && row.length === width);
    const legacy = originalVersion <= 5 && shape(12, 9);
    const v7Shape = originalVersion <= 7 && shape(20, 14);
    const v8Shape = (originalVersion === 8 || originalVersion === 9) && shape(WIDTH, HEIGHT);
    const farmerInShape = saved?.farmer && (legacy ? saved.farmer.x >= 0 && saved.farmer.x < 12 && saved.farmer.y >= 0 && saved.farmer.y < 9 :
      v7Shape ? saved.farmer.x >= 0 && saved.farmer.x < 20 && saved.farmer.y >= 0 && saved.farmer.y < 14 :
      v8Shape && inBounds(saved.farmer.x, saved.farmer.y));
    if (!saved || ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(originalVersion) ||
        !(legacy || v7Shape || v8Shape) || !farmerInShape ||
        !DIRECTIONS[saved.farmer.facing] || !(TOOLS[saved.tool] || saved.tool === 'water') ||
        !CROPS[saved.selectedCrop] || !Number.isFinite(saved.day) ||
        !Number.isFinite(saved.gold)) return null;
    if (legacy) {
      const plots = Array.from({ length: 14 }, () => Array.from({ length: 20 }, makePlot));
      for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) plots[4 + y][4 + x] = saved.plots[y][x];
      saved.plots = plots;
    }
    if (originalVersion <= 7) {
      const plots = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, makePlot));
      for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++)
        plots[LAYOUT.v7Anchor.y + y][LAYOUT.v7Anchor.x + x] = saved.plots[y][x];
      saved.plots = plots;
      saved.farmer = { ...LAYOUT.homeDoor, facing: saved.farmer.facing };
    }
    delete saved.energy;
    saved.health = Number.isFinite(saved.health) ? Math.max(0, Math.min(HEALTH_MAX, saved.health)) : HEALTH_MAX;
    saved.weapon = WEAPONS[saved.weapon] ? saved.weapon : 'none';
    saved.gameOver = !!saved.gameOver || saved.health <= 0;
    saved.villagers = Object.fromEntries(Object.keys(VILLAGERS).map(id => {
      const old = saved.villagers?.[id] || {};
      return [id, { hearts: Math.max(0, Math.min(5, Number.isInteger(old.hearts) ? old.hearts : 0)), giftedDay: Number.isInteger(old.giftedDay) ? old.giftedDay : 0, rewarded: !!old.rewarded, likeKnown: !!old.likeKnown }];
    }));
    saved.fenceStock = Number.isInteger(saved.fenceStock) && saved.fenceStock >= 0 ? saved.fenceStock : 0;
    saved.scarecrowStock = Number.isInteger(saved.scarecrowStock) && saved.scarecrowStock >= 0 ? saved.scarecrowStock : 0;
    saved.resources = Object.fromEntries(Object.keys(RESOURCES).map(key => [key, Number.isInteger(saved.resources?.[key]) && saved.resources[key] >= 0 ? saved.resources[key] : 0]));
    saved.resourceNodes = Object.fromEntries(RESOURCE_NODES.map(node => {
      const old = saved.resourceNodes?.[node.id];
      return [node.id, {
        charges: Number.isInteger(old?.charges) ? Math.max(0, Math.min(node.maxCharges, old.charges)) : node.maxCharges,
        respawnDay: Number.isInteger(old?.respawnDay) && old.respawnDay >= 0 ? old.respawnDay : 0
      }];
    }));
    saved.seeds = { ...cropCounts(), ...saved.seeds };
    saved.bag = { ...cropCounts(), ...saved.bag };
    for (const row of saved.plots) {
      for (const plot of row) {
        if (!plot || typeof plot !== 'object' ||
            (plot.crop && !CROPS[plot.crop.type])) return null;
      }
    }
    saved.tomorrow = WEATHERS[saved.tomorrow] ? saved.tomorrow : 'sunny';
    saved.snacks = Number.isInteger(saved.snacks) && saved.snacks >= 0 ? saved.snacks : 0;
    const refund = !!saved.upgrades?.water;
    const hoeRefund = originalVersion <= 4 && !!saved.upgrades?.hoe;
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
    saved.stats = { income: 0, harvested: 0, orders: 0, days: 0, repelled: 0, gathered: 0, fished: 0, crafted: 0, ...saved.stats };
    saved.manualTool = !!saved.manualTool;
    saved.autoTool = typeof saved.autoTool === 'boolean' ? saved.autoTool : true;
    saved.achievements = [...new Set(Array.isArray(saved.achievements) ? saved.achievements.filter(id => ACHIEVEMENTS.some(item => item.id === id)) : [])];
    saved.weather = WEATHERS[saved.weather] ? saved.weather : 'sunny';
    saved.tutorial = Number.isInteger(saved.tutorial) && saved.tutorial >= 0 && saved.tutorial <= 2 ? saved.tutorial : 2;
    saved.version = 9;
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
  function cameraTarget(farmer, viewportWidth, viewportHeight, tile = 48) {
    const axis = (position, count, view) => count * tile <= view ? (count * tile - view) / 2 :
      Math.max(0, Math.min(count * tile - view, (position + 0.5) * tile - view / 2));
    return { x: axis(farmer.x, WIDTH, viewportWidth), y: axis(farmer.y, HEIGHT, viewportHeight) };
  }
  function cameraStep(current, target, elapsed) {
    const alpha = 1 - Math.exp(-Math.max(0, elapsed) / 120);
    return { x: current.x + (target.x - current.x) * alpha, y: current.y + (target.y - current.y) * alpha };
  }
  function screenToCell(clientX, clientY, rect, camera, viewportWidth, viewportHeight, tile = 48) {
    return { x: Math.floor(((clientX - rect.left) / rect.width * viewportWidth + camera.x) / tile),
      y: Math.floor(((clientY - rect.top) / rect.height * viewportHeight + camera.y) / tile) };
  }
  function visibleCellRange(camera, viewportWidth, viewportHeight, tile = 48, margin = 1) {
    return {
      left: Math.max(0, Math.floor(camera.x / tile) - margin),
      top: Math.max(0, Math.floor(camera.y / tile) - margin),
      right: Math.min(WIDTH - 1, Math.floor((camera.x + viewportWidth - 1) / tile) + margin),
      bottom: Math.min(HEIGHT - 1, Math.floor((camera.y + viewportHeight - 1) / tile) + margin)
    };
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
    if (!canWalk(state, x, y) && state.plots[y][x].structure !== 'fence') return result(false, '地物挡住了路');
    if (state.plots[y][x].structure === 'fence') return result(false, '木栅栏挡住了路');
    state.farmer.x = x;
    state.farmer.y = y;
    return result(true, '移动', []);
  }

  function selectTool(state, tool) {
    if (!TOOLS[tool]) return result(false, '无效工具');
    state.tool = tool;
    state.manualTool = true;
    state.autoTool = false;
    return result(true, `已选择${TOOLS[tool].name}`, []);
  }

  function selectAutoTool(state) {
    state.autoTool = true;
    state.manualTool = false;
    return result(true, '已开启自动工具', []);
  }

  function selectCrop(state, crop) {
    if (!CROPS[crop]) return result(false, '无效作物');
    state.selectedCrop = crop;
    return result(true, `已选择${CROPS[crop].name}种子`, []);
  }

  function gatherNode(state, node, random = Math.random) {
    const status = state.resourceNodes[node.id];
    if (!status.charges) return result(false, `该${node.kind === 'fish' ? '钓点' : '节点'}已采空，明天或刷新日恢复`);
    if (node.kind === 'fish') {
      state.resources.fish++; status.charges--; state.stats.fished++;
      if (!status.charges) status.respawnDay = state.day + 1;
      return { ...result(true, '钓到了1条池鱼'), tool: 'rod', resource: 'fish' };
    }
    const key = node.kind === 'tree' ? 'wood' : node.kind;
    state.resources[key]++; status.charges--; state.stats.gathered++;
    if (!status.charges) status.respawnDay = state.day + (node.kind === 'stone' ? 3 : 2);
    return { ...result(true, `采集到了1份${RESOURCES[key].name}`), tool: 'gather', resource: key };
  }

  function act(state, smart, random = Math.random) {
    const { x, y } = frontCell(state);
    if (!inBounds(x, y)) return result(false, '前方没有地块');
    const plot = state.plots[y][x];
    let tool = state.tool;
    const node = resourceNodeAt(x, y);
    if (node) {
      const required = node.kind === 'fish' ? 'rod' : 'gather';
      if (smart && state.autoTool) tool = required;
      if (tool !== required) return result(false, node.kind === 'fish' ? '请改用鱼竿钓鱼' : '请改用采集工具');
      return gatherNode(state, node, random);
    }
    let crop = state.selectedCrop;
    let seedSwap = '';
    if (smart && state.autoTool) {
      if (plot.crop && plot.crop.progress >= CROPS[plot.crop.type].days) tool = 'scythe';
      else if (plot.tilled && !plot.crop) {
        tool = 'seed';
        if (state.seeds[crop] < 1) {
          const fallback = Object.keys(CROPS).find(key => state.seeds[key] > 0);
          if (fallback) { seedSwap = `${CROPS[crop].name}种子没了，改播${CROPS[fallback].name}。`; crop = fallback; state.selectedCrop = fallback; }
        }
      }
      else if (!plot.tilled) tool = 'hoe';
    }

    let message;
    if (tool === 'hoe') {
      if (terrainAt(x, y) !== 'farm') return result(false, '这里只能在农田区开垦');
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
      message = `${seedSwap}播下${CROPS[crop].name}种子`;
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
    const price = seedPrice(state, crop) * amount;
    if (state.gold < price) return result(false, '金币不够');
    state.gold -= price;
    state.seeds[crop] += amount;
    return result(true, `购买了 ${amount} 包${CROPS[crop].name}种子，花费 ${price} G，余额 ${state.gold} G`);
  }
  function seedPrice(state, crop) { return Math.ceil(CROPS[crop].seedPrice * (state.villagers?.merchant?.hearts >= 3 ? 0.9 : 1)); }
  function placeBuilding(state, kind) {
    if (!BUILDINGS[kind]) return result(false, '无效建造道具');
    const { x, y } = frontCell(state);
    if (!inBounds(x, y)) return result(false, '前方没有地块');
    const plot = state.plots[y][x];
    if (!['farm', 'residential'].includes(terrainAt(x, y))) return result(false, '这里只能在农田或住宅空地建造');
    if (plot.tilled || plot.crop || plot.structure) return result(false, '只能放在空草地上');
    const price = BUILDINGS[kind].price;
    const stock = kind === 'fence' ? 'fenceStock' : 'scarecrowStock';
    const free = state[stock] > 0;
    if (free) state[stock]--;
    else {
      if (state.gold < price) return result(false, `金币不足，还差 ${price - state.gold} G`);
      state.gold -= price;
    }
    plot.structure = kind;
    return result(true, `放置了${BUILDINGS[kind].name}${free ? '，使用库存' : `，花费 ${price} G`}`);
  }

  function giftVillager(state, id, item) {
    const resource = item === 'fish' || item === 'berry';
    if (!VILLAGERS[id] || (!CROPS[item] && !resource)) return result(false, '送礼目标或礼物无效');
    const villager = state.villagers[id];
    if (villager.giftedDay === state.day) return result(false, '今天已经送过这位村民了');
    if ((resource ? state.resources[item] : state.bag[item]) < 1) return result(false, '背包里没有这份礼物');
    if (resource) state.resources[item]--; else state.bag[item]--;
    villager.giftedDay = state.day;
    const liked = VILLAGERS[id].likes === item;
    villager.hearts = Math.min(5, villager.hearts + (liked ? 2 : 1));
    if (liked) villager.likeKnown = true;
    const events = [`送给${VILLAGERS[id].name}一份${resource ? RESOURCES[item].name : CROPS[item].name}，好感 ${villager.hearts}/5${liked ? `，正合${VILLAGERS[id].name}的胃口！` : ''}`];
    if (villager.hearts === 5 && !villager.rewarded) {
      villager.rewarded = true;
      if (id === 'mayor') state.gold += 100;
      if (id === 'merchant') state.snacks += 2;
      if (id === 'hunter') state.fenceStock += 2;
      events.push(`${VILLAGERS[id].name}回礼：${VILLAGERS[id].gift}`);
    }
    return { ...result(true, events[0], events), rewarded: villager.rewarded };
  }

  function checkAchievements(state) {
    const unlocked = new Set(state.achievements || []), fresh = [];
    for (const achievement of ACHIEVEMENTS) if (!unlocked.has(achievement.id) && achievement.check(state)) {
      unlocked.add(achievement.id); fresh.push(achievement); state.gold += achievement.reward;
    }
    state.achievements = [...unlocked];
    return fresh;
  }

  function rollWeather(random = Math.random) {
    const value = random();
    return value < 0.5 ? 'sunny' : value < 0.8 ? 'cloudy' : 'rain';
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
  function sellResource(state, key, amount) {
    if (!RESOURCES[key] || !Number.isInteger(amount) || amount < 1 || state.resources[key] < amount) return result(false, '卖出数量无效');
    const total = amount * RESOURCES[key].sellPrice;
    state.resources[key] -= amount; state.gold += total; state.stats.income += total;
    return result(true, `卖出 ${amount} 份${RESOURCES[key].name}，获得 ${total} G`);
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
    const resource = food === 'fish' || food === 'berry';
    if (!(food === 'snack' ? state.snacks : resource ? state.resources[food] : state.bag[food])) return result(false, '背包里没有这种食物');
    if (state.health >= HEALTH_MAX) return result(false, '生命已满，别浪费粮食');
    if (food === 'snack') state.snacks--;
    else if (resource) state.resources[food]--;
    else state.bag[food]--;
    const restored = Math.min(FOOD_HEAL[food], HEALTH_MAX - state.health);
    state.health += restored;
    return result(true, `吃${food === 'snack' ? '饭团' : resource ? RESOURCES[food].name : CROPS[food].name}恢复了 ${restored} 点生命`);
  }
  function quickEat(state) {
    const food = Object.keys(FOOD_HEAL).filter(key => key === 'snack' ? state.snacks : RESOURCES[key] ? state.resources[key] : state.bag[key]).sort((a, b) => FOOD_HEAL[b] - FOOD_HEAL[a])[0];
    return food ? eatFood(state, food) : result(false, '背包里没有食物');
  }

  function craft(state, key) {
    const recipe = CRAFTS[key];
    if (!recipe) return result(false, '无效制作配方');
    if (Object.entries(recipe.costs).some(([resource, amount]) => state.resources[resource] < amount)) return result(false, '制作资源不足');
    for (const [resource, amount] of Object.entries(recipe.costs)) state.resources[resource] -= amount;
    state[recipe.stock]++; state.stats.crafted++;
    return result(true, `制作了${recipe.name}`);
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
        if (canWalk(state, x, y) && !seen.has(key)) {
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
      if (canWalk(state, x, y)) { enemy.x = x; enemy.y = y; }
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
      const edges = LAYOUT.raidSpawns;
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
    state.farmer = { ...LAYOUT.raidSpawns[0], facing: 'down' };
    const path = findPath(state, targetX, targetY);
    state.farmer = origin;
    return path ? path.length : Infinity;
  }

  function resolveRaid(state, raid, random = Math.random) {
    if (raid.level === 'calm') return { events: ['昨夜平静'], lost: 0, fences: 0, gold: 0, items: 0, repelled: 0 };
    const events = raid.attackers.includes('bandit') ? ['强盗从北侧林地南缘来袭'] : [];
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
    const roll = random || Math.random;
    const nextWeather = rollWeather(roll);
    for (const row of state.plots) {
      for (const plot of row) {
        if (plot.crop && plot.crop.progress < CROPS[plot.crop.type].days) {
          plot.crop.progress = Math.min(CROPS[plot.crop.type].days, plot.crop.progress + 1 + (nextWeather === 'rain' ? 1 : 0));
          if (plot.crop.progress === CROPS[plot.crop.type].days) {
            events.push(`${CROPS[plot.crop.type].name}成熟了！`);
          }
        }
      }
    }
    state.day++;
    let refreshed = false;
    for (const node of RESOURCE_NODES) {
      const status = state.resourceNodes[node.id];
      if (status.charges < node.maxCharges && status.respawnDay > 0 && state.day >= status.respawnDay) {
        status.charges = node.maxCharges; status.respawnDay = 0; refreshed = true;
      }
    }
    if (refreshed) events.push('野外资源刷新了');
    state.weather = nextWeather;
    state.tomorrow = roll() < RAIN_CHANCE[season(state)] ? 'rain' : 'sunny';
    state.nightRaid = planRaid(state.day, roll);
    events.push(state.weather === 'rain' ? '雨天使作物额外生长 1 格' : '作物每天自动生长 1 格');
    events.push(`明天天气：${WEATHERS[state.weather].name}`);
    if (seasonDay(state) === 1) events.push(`进入${season(state)}季`);
    state.stats.days++;
    const expired = state.orders.filter(order => state.day > order.deadline);
    if (expired.length) events.push(`${expired.length} 个订单过期失效`);
    generateOrders(state, roll);
    return { ...result(true, `${guarded ? '守夜成功' : '睡了一觉'}，来到第 ${state.day} 天`, events), raid };
  }

  root.PocketFarm = {
    WIDTH, HEIGHT, LAYOUT, terrainAt, canWalk, cameraTarget, cameraStep, screenToCell, visibleCellRange, HEALTH_MAX, RAIN_CHANCE, WEATHERS, CROPS, RESOURCES, CRAFTS, RESOURCE_NODES, resourceNodeAt, TOOLS, DIRECTIONS, BUILDINGS, FOOD_HEAL, WEAPONS, VILLAGERS, ACHIEVEMENTS, planRaid, resolveRaid,
    createGame, migrateSave, season, seasonDay, frontCell, move, selectTool, selectAutoTool, selectCrop,
    act, gatherNode, buySeed, seedPrice, sellAll, sellCrop, sellResource, salePreview, orderReserve, sleep, rollWeather, buyWeapon, buySnack, eatFood, quickEat, craft, generateOrders, acceptOrder, deliverOrder, findPath, placeBuilding, pathBetween, startWatch, watchStrike, watchTick, giftVillager, villagerLine, checkAchievements
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
