# 第十五遍规格：生图素材接入（场景与作物换素材，人物保持程序绘制）

## 背景与素材
第十四遍后用户拍板走生图素材路线：先试点（房子/树/作物拼图效果成立）再全换。素材已由助手生成并处理完毕，位于 `pilot-assets/game/`（共 32 个文件，约 4.8MB），清单：
- 房屋：`house.png`（玩家大屋）、`hut-blue.png`、`hut-red.png`、`hut-green.png`（三户村民小屋，主题色与第十三遍小屋配色对应：村长蓝灰→hut-blue、婆婆砖红→hut-red、猎手苔绿→hut-green）
- 树木：`tree-broadleaf.png`、`tree-pine.png`
- 作物四阶段（1 种子/嫩芽、2 幼苗、3 成株、4 成熟）：`crop-carrot-1..4`、`crop-potato-1..4`、`crop-strawberry-1..4`、`crop-pumpkin-1..4`、`crop-corn-1..4`
- 道具/节点：`node-stump.png`（树桩）、`node-berry.png`（野果灌木）、`node-rock.png`（石堆）、`prop-scarecrow.png`（稻草人）、`prop-fence.png`（栅栏）
- 地面：`tex-grass.png`（512×512 草地纹理，2×2 拼接实测无可见接缝，图案规律感偏强、只作底纹）

## 红线
- 只改表现层与构建：`farm-logic.js` 一行不动；玩法、数值、存档 v8、63 项逻辑测试全过不变。
- 素材加载失败或运行环境无 `Image`（含 Node 冒烟环境）时，必须完整回退到第十四遍的程序绘制，游戏可玩、冒烟可过——素材是增强，不是依赖。
- 静态层缓存与可见区裁剪纪律不回退；素材绘制同样受可见区裁剪约束。
- style.css 变量区外硬编码颜色仍为 0；人物（农夫/村民/强盗）与池塘水面保持程序绘制不变。

## 接入设计
1. **资源管理**：在 game.js 顶部建 `SPRITES` 清单（名字→相对路径 `pilot-assets/game/<name>.png`）；启动时预加载，逐个记录 loaded 状态；绘制函数用 `spriteReady(name)` 判断，未就绪走原程序绘制分支。提供一个绘制辅助 `drawSprite(name, cx, bottomY, targetW)`：等比缩放、底部中心锚点、`imageSmoothingEnabled=false` 下 drawImage。
2. **房屋**：玩家房子在 home 格以底部中心锚点绘制 `house`，显示宽约 4.2 格、高按比例（可向左右/上方外扩到住宅背景，遵守第十四遍外扩边界，不压路径与操作格）；三户小屋同理宽约 3 格，按 hut 顺序对应 hut-blue/red/green。原 `drawHouseCell` 的程序小屋保留为未加载回退。
3. **树木**：林地 tree 格按坐标哈希在 broadleaf/pine 间稳定二选一，底部锚点、宽约 1.7 格、向上外扩；相邻树可轻微缩放差（0.92–1.08，哈希决定）。注意树冠遮挡与裁剪：只画可见区内的树。
4. **资源节点**：tree 节点画 `tree-broadleaf`（略小于野生树，宽约 1.3 格），采空（charges=0）改画 `node-stump`；berry 节点画 `node-berry`，采空时同图 `globalAlpha=0.45`；stone 节点画 `node-rock`，采空 alpha 同理；fish 节点维持程序涟漪与浮漂。节点剩余次数的原有标记（如有）保留。
5. **建筑结构**：plots 的 scarecrow 结构改画 `prop-scarecrow`（宽约 0.95 格、底部锚点），fence 结构改画 `prop-fence`（宽约 1 格）；稻草人库存/放置/保护逻辑不动。
6. **作物**：`drawCrop` 按现有阶段判定（种子/嫩芽/成株/成熟 → 1/2/3/4）画对应 `crop-<type>-<n>`，底部锚点、宽约 0.9–1.05 格（成熟略大），轻摆改为整图 ±1px 横移；未加载时回退原程序作物。种子阶段（stage 0 未播种）不画。
7. **地面**：静态层草地（grass/residential/meadow 底色格）改用 `tex-grass` 以 96px 平铺填充（createPattern 或按格贴图，选实现简单且不闪烁者），其上保留第十四遍的草簇/花点等静态装饰以打破规律感；季节处理：春用原纹理，夏/秋/冬在纹理上叠一层 palette 对应色 `globalAlpha` 0.10/0.20/0.28 的平涂（具体值可在 NOTES 中按观感微调并记录）；土路、耕地、水面维持第十四遍程序绘制。
8. **单文件构建**：扩展 `build-standalone.mjs`：把 `pilot-assets/game/*.png` 以 base64 data URI 内嵌，运行时优先用内嵌数据（构建时生成一个 `window.__SPRITE_DATA__` 映射或等价机制，多文件版则走相对路径）；最终单文件体积在 NOTES 记录（预估 7–9MB），若超 12MB 先做 PNG 量化/再压缩并记录。

## 验收
- `node --check` 两文件；`node tests/run_tests.mjs` 63/63；`node build-standalone.mjs`；`node tests/standalone-smoke.mjs` 全过（冒烟环境无 Image，必须走回退路径且断言不回退；如为素材路径新增断言，须在无图环境下同样成立）。
- `node ~/workspace/harness-pocket-farm.mjs` 端到端通过。
- CSS 硬编码自查 = 0。
- README 追加第十五遍小节（素材来源：AI 生成 + 抠图处理、清单、回退机制、单文件体积）；NOTES 记录：每类素材的锚点与尺寸参数、季节叠色值、草地纹理的规律感取舍、未能在本机验证的视觉项（真实浏览器观感、file:// 直开多文件版的图片加载情况）。
- 提交信息：`round 15: generated sprite assets`。最终简体中文汇报：接入清单、回退验证结果、单文件体积、测试结果、未达项明说。
