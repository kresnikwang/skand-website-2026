# SKAND BRAWLER · 街机像素节奏乱斗（从 0 到 1 完整开发规范）

> 目标站：skandstudio.com/play
> 项目性质：从零构建（当前目录为空）的 Web 街机互动小游戏，兼具极致打击爽感与“千人千面”的动态战利品盲盒分享卡。
> 核心技术：React + TypeScript + Vite + Canvas 2D + [pixelfx](https://github.com/patch-gg/pixelfx)
这个网站是从这个官方主页点进来的，所以在游戏的开始画面和结算画面，还需要有一个返回主页的按钮。

---

## 第一部分：从 0 到 1 项目初始化指令（Agent 请按顺序执行）

当前工作目录为空，请严格按以下 4 步完成环境搭建，**严禁跳过第 2 步盲猜文件路径**：

1. **初始化前端工程**：
   - 在当前目录初始化 Vite + React + TypeScript 项目（或直接创建标准 `package.json`、`index.html`、`vite.config.ts` 并安装依赖）。
   - 引入 Google Fonts 像素字体 `Silkscreen`（OFL 开源字体，带等宽字体回退）。
2. **拉取并扫描 `pixelfx` 源码（关键！）**：
   - 执行 `git clone --depth 1 https://github.com/patch-gg/pixelfx.git ./tmp-pixelfx`，将其中的 `src/core` 与 `src/fx` 复制到本项目的 `src/vendor/pixelfx/` 下（或直接执行 `npm i github:patch-gg/pixelfx`）。
   - **必须先用文件查看工具列出 `pixelfx/src/fx/` 下各子目录的真实 `.js` 文件名**，挑选实际存在的特效模块映射到游戏逻辑中，**绝不允许凭空捏造 import 路径**。
3. **规划源码结构**：
   - `src/game/spec.ts`：色板、战斗数值、6 大圣物盲盒配置、波次时间轴。
   - `src/game/sprites.ts`：纯代码字符矩阵（ASCII Pixel Grid）绘制的主角姿态、敌人、城市剪影与 6 大圣物图标。
   - `src/game/fxManager.ts`：封装 `pixelfx` 的离屏双画布渲染器与对象池。
   - `src/game/engine.ts`：60fps 游戏主循环、双键节奏判定、顿帧（Hit-stop）、震屏、残骸击飞物理与流派统计。
   - `src/game/SoulCardExporter.ts`：生成 1200×630 / 1080×1350 的高清“街机灵魂战绩卡”供下载分享。
   - `src/App.tsx`：全屏游戏容器（含主菜单、战斗 HUD、终局盲盒锻造演出、结算图鉴抽屉）。

---

## 第二部分：Canvas 2D 与 `pixelfx` 双画布渲染铁律（防画面黑屏覆盖）

- **画面边界与色板**：全画幅沉浸式像素画布，**不要在画布外围画多余的白色边框与角标**。
  - 背景主色：深炭黑 `#0D0D11` / 暗夜钢蓝 `#141824`（必须用深色底，以彻底激活 `pixelfx` 的 `light` 发光缓冲区）。
  - 品牌高光色：珊瑚红 `#FF4D3D`、电光钢蓝 `#4A7CFF`、纯粹白 `#F4F6F8`、暴击金 `#FFD166`。
- **逻辑分辨率**：桌面横屏固定 `320 × 180`（通过 CSS `image-rendering: pixelated` 整数倍放大显示）；移动端竖屏自适应为 `270 × 480`。
- **双画布合成架构（极其重要）**：
  - `pixelfx` 的 `composite()` 配合 `ctx.putImageData()` 会直接覆写像素，不走 Alpha 混合。**严禁在主画布 `mainCtx` 上直接调用 `putImageData`！**
  - 必须创建与主画布同尺寸（320×180）的离屏画布 `fxCanvas` 及 `fxFrame = createFrame(320, 180)`：
    1. 每帧调用 `clearFrame(fxFrame)`，执行活跃特效的 `fx.update(dt)` 和 `fx.draw(fxFrame)`。
    2. 调用 `composite(fxFrame, fxImageData.data, null)`（**第 3 个参数必须传 `null` 以保持背景透明**）。
    3. 调用 `fxCtx.putImageData(fxImageData, 0, 0)`。
    4. 在主画布 `mainCtx` 上按图层顺序绘制：
       `深色视差城市背景` → `地面节奏判定圈` → `mainCtx.drawImage(fxBackCanvas, 0, 0)` → `主角与敌人精灵` → `mainCtx.drawImage(fxFrontCanvas, 0, 0)` → `顶部 HUD 与浮动暴击字`。

---

## 第三部分：核心玩法——横版推进式双键节奏乱斗

### 1. 镜头与“攻击即推进”机制
- 主角固定在画面偏左黄金位 `x = 115, y = 138`（地面线 `y = 140`）。
- 平时视差背景以 `60px/s` 慢速滚动；**玩家每次按右攻击（`→`），主角做出前冲挥砍姿态，同时触发 `140ms` 的 `450px/s` 高速背景卷动与冲刺残影**，营造一路向前杀穿整座城市的爽快推进感。

### 2. 极简“左右双键”操作与节奏判定圈（取消跳跃）
全屏仅分【左指令】与【右指令】（桌面端 `← / →` 或 `A / D` 或鼠标左右键；移动端点击左半屏 / 右半屏）：
- **右指令（`→` 突进斩击）**：攻击从右侧迎面冲来的地面路障与重装怪。
  - 右侧地面绘制半透明像素判定框（中心 `x = 155`，判定范围 `±20px`，中心 `±8px` 内触发 **`PERFECT` 完美暴击**）。
- **左指令（`←` 回身防反 / Parry）**：反击从左侧（身后）俯冲偷袭的敌人，或将空中无人机射来的预警激光**原路弹反**回去炸毁后排敌群。
  - 左侧地面绘制防反判定框（中心 `x = 75`，判定范围 `±20px`）。
- **容错机制**：每局拥有 **3 格能量护盾（Shields）**。漏怪受击不直接死亡，仅扣 1 格盾并重置当前连击倍率；3 格扣光或坚持满 75 秒均进入终局结算。

### 3. 敌人类型与节拍设计
1. **地面红黑路障（1-Beat）**：从右侧滚入，进入右判定圈按 1 下 `→` 劈成两半，爆出 3 枚蓝色菱形灵感碎片自动飞向主角。
2. **偷袭激光无人机（Parry-Beat）**：悬停并发出 0.6s 红色瞄准线预警，激光射达左判定圈瞬间按 `←` 触发完美弹反（`PARRY`），激光折射轰爆无人机。
3. **重装网格护盾怪（2-Beat 连打）**：需按节奏连续输入两次 `→ →`（第一下破盾震退，第二下斩杀爆裂）。
4. **终局巨型盲盒核心（70s–75s 狂暴搓招）**：最后 5 秒从天而降，屏幕提示 `FINISH IT! [ ← / → ]`，玩家左右交替狂按打出满屏 `999!` 暴击，将其轰碎并现场开出本局专属圣物。

### 4. 连击驱动的 `pixelfx` 武器实时进化 + 打击感三件套
- **连击进化（Combo ×1 ~ ×5）**：
  - `Combo ×1`（初始）：基础白刃弧光（`melee`）+ 受击火花（`impacts/hit-spark`）。
  - `Combo ×2`（6 连击）：钢蓝雷电附魔，挥刀触发链状闪电（`lightning`）自动跳跃劈碎后方第 2 个目标。
  - `Combo ×3`（15 连击）：珊瑚红烈焰斩（`fire`），被击飞的敌人沿途洒下火苗并在落地时触发爆炸（`explosions`）。
  - `Combo ×4`（25 连击）：赛博光刃（`sci-fi`），每次挥刀额外射出一道远程能量波（`projectiles`）贯穿全屏。
  - `Combo ×5`（40 连击 · `SKAND OVERDRIVE`）：背景闪烁霓虹网格，主角周身环绕奥术气场（`arcane`），刀刀必出暴击大字。
- **打击感三件套（必选实现）**：
  1. **顿帧（Hit-stop）**：`PERFECT` 或 `PARRY` 命中瞬间，游戏位移与刷怪暂停 `45ms`，唯独 `pixelfx` 特效继续播放。
  2. **震屏（Screen Shake）**：重击与爆炸时，视口随机偏移 `±3px` 持续 `90ms`。
  3. **残骸击飞（Knockback）**：被砍碎的路障与无人机赋予物理初速度 `{ vx: 220, vy: -120, rotSpeed: 10 }` 旋转飞出画布。

---

## 第四部分：终局惊喜——动态“街机灵魂卡”与 6 大发光圣物盲盒

游戏结尾**不推销任何商业作品**，而是根据玩家本局的真实操作统计（`rightHits`, `leftParries`, `perfectRate`, `maxCombo`, `hpLeft`），通过 `pixelfx` **现场锻造一件 120Hz 持续发光的动态像素圣物（Relic）**，并生成可下载的**街机灵魂鉴定卡**。

### 1. 六大战斗流派与圣物图鉴（持久化存入 `localStorage`）

| 编号与圣物 | 触发条件（按优先级判定） | 灵魂称号（中 / 英） | 趣味鉴定判词 | 绑定的 `pixelfx` 动态背景/前景特效 |
| :--- | :--- | :--- | :--- | :--- |
| **#01 烈焰推进滑板**<br>`Nitro Deck` | 右突进斩占比 > 75% 且击破 ≥ 30 | **死线粉碎机**<br>`DEADLINE CRUSHER` | “眼里没有防守，只有无情的向前平推。任何挡路的障碍都活不过 0.5 秒。” | `fire`（珊瑚红烈焰尾流）+ `moves`（高速气流） |
| **#02 电磁防反盾徽**<br>`Aegis Shield` | 完美弹反（`←` Parry）≥ 8 次 | **一稿过之神**<br>`THE PARRY GOD` | “从身后偷袭的突发状况？被你反手一刀全部原路弹回，片叶不沾身。” | `lightning`（钢蓝环绕电弧）+ `sci-fi`（全息护盾） |
| **#03 量子节拍器**<br>`Quantum Metronome` | Perfect 完美节拍率 ≥ 60% | **绝对音准暴君**<br>`RHYTHM TYRANT` | “每一拳都精准踩在像素判定线的正中央，强迫症看了都得起立鼓掌。” | `arcane`（几何律动法阵）+ `ui/crit-number` |
| **#04 浓缩冰美式圣杯**<br>`Overdrive Espresso` | 仅剩 1 格护盾残血撑完全场 | **咖啡因永动机**<br>`1% HP SURVIVOR` | “在崩溃边缘反复横跳，却硬生生用极限手速打出了最野的绝地反击。” | `shadow`（暗黑紫红气焰）+ `impacts/hit-spark` |
| **#05 黄金街机摇杆**<br>`Golden Stick` | 达成 Combo ×5 且满盾无伤通关 | **六边形街机魔王**<br>`UNTOUCHABLE ACE` | “进攻如狂风，防守如铁壁。这间工作室的像素地板已经被你擦出火星了。” | `holy`（纯金圣光喷泉）+ `pickups/collect-burst` |
| **#06 赛博故障魔方**<br>`Glitch Cube` | 默认/均衡流派（保底触发） | **野生灵感捕手**<br>`CHAOS VANGUARD` | “出招毫无章法，但拳拳充满想象力。毕竟好点子往往诞生于混乱之中。” | `transitions/pixel-dissolve` + `weather/fireflies` |

### 2. Seeded 种子唯一性与海报导出
- 将本局 `score * 31 + leftParries * 17 + maxCombo` 作为确定性 `seed` 传入圣物的 `createFx(effect, { seed, palette })`，并在卡片上印出唯一哈希（如 `SOUL SEED #8F3C`）。
- 结算页提供：
  - `PLAY AGAIN (UNLOCK NEXT RELIC) ↻`（显示当前图鉴收集进度 `COLLECTED: X/6`，点击已解锁槽位可预览对应圣物）。
  - `DOWNLOAD SOUL CARD ↓`：用离屏 Canvas 绘制 1200×630 高清卡片（包含称号、判词、战绩四维数据、以及截取 `t = 40` 帧高光状态的发光圣物），调用 `canvas.toBlob` 触发本地下载。