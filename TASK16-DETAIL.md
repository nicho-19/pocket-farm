# 《口袋田园》第十六遍规格：主角奶蛙精灵图接入（TASK16-DETAIL）

目标：只把第十五遍未动的主角农夫换成生图奶蛙素材。村民、强盗和村民对话头像继续使用程序绘制，不接入人物单图。定稿素材来自 `pilot-assets/preview16f/`，12 帧复制到 `pilot-assets/game/`；预览及各 `raw` 目录保留为草稿。

## 一、不可动摇的边界

1. `farm-logic.js` 一行不动；玩法、数值、存档 v8 全部不变；63 项逻辑测试必须全绿。
2. 农夫当前帧素材未就绪或环境无 `Image` 时，完整回退到第十五遍的程序绘制，不允许半身素材半身像素。
3. 农夫影子、手持工具与挥动动画全部保留且行为不变；工具程序绘制在素材身体之后执行。
4. `drawVillager`、`drawBandit`、`drawVillagerPortrait` 一律不动。
5. `style.css` 变量定义区之外硬编码颜色为 0。

## 二、新增素材（12 项）

`char-farmer-{down,up,left,right}-{0,1,2}.png` 为浅奶黄梨形奶蛙、草帽、大白肚的四方向三帧素材；每方向 `0=站立`、`1=走路 A`、`2=走路 B`，同高并底部对齐。

`SPRITES` 清单在第十五遍 32 项基础上只新增这 12 项，总数为 **44**。`pilot-assets/game/` 不保留 `char-mayor.png`、`char-merchant.png`、`char-hunter.png`、`char-bandit.png`，避免构建清单加载未使用文件。

## 三、农夫接入（drawFarmer）

1. 当前方向所需帧 `spriteReady` 时绘制素材，否则整身走原程序回退。
2. 素材使用底部中心锚点：水平中心为格 `x+24`，底部为格 `y+46`，目标高度 **46px**；宽度按素材宽高比自动计算。允许在 ±2px 内微调，最终实值记入 NOTES。
3. 站立使用帧 0，并保留现有 idle 呼吸浮动；走路沿用 65ms 四相位，素材帧映射为 **`[1, 0, 2, 0]`**。
4. 影子先于身体绘制，现有调用位置与形状不变。
5. 工具与挥动动画的程序绘制代码原样保留，在素材身体之后继续执行；包括 `facing='up'` 时的现有次序。

## 六、绘制辅助

新增 `drawSpriteH(name, cx, bottomY, targetH)`，按素材宽高比换算宽度后复用 `drawSprite` 的就绪判断与异常保护。第十五遍已有 `drawSprite` 调用点不改。

## 七、构建与验收

1. `build-standalone.mjs` 内嵌清单必须为 **44** 项，并显式断言数量；单文件体积记入 NOTES，不做有损压缩。
2. 冒烟测试断言内嵌素材数为 **44**；无 `Image` 环境下显式覆盖农夫四方向回退并断言不抛错。村民、强盗仍由既有程序路径覆盖。
3. 验收全套：`node --check farm-logic.js`、`node --check game.js`、63 项测试、构建、独立版冒烟、实测台端到端、CSS 硬编码自查，且 `git diff HEAD -- farm-logic.js` 为空。
4. README 与 NOTES 补记：奶蛙素材来源与定稿过程、锚点实值、目标高度、帧映射、回退验证、单文件体积和未验证项。
5. 提交信息：`round 16: farmer naiwa sprites`。
