# 项目文件说明

本文基于 `git ls-files` 的当前结果整理，覆盖 Git 已跟踪的可维护文本、配置与测试文件。说明聚焦“文件负责什么、何时修改、改动风险”，不展开复制源码。

## 快速修改索引

| 常见需求 | 主要文件 |
| --- | --- |
| 修改应用入口、页面导航 | `src/App.tsx`、`src/app/navigation.ts`、`src/main.tsx` |
| 修改牌桌整体布局 | `src/components/game/GameScreen.tsx`、`src/components/game/MahjongTable.tsx`、`src/styles.css` |
| 修改麻将牌图片、发光或悬停样式 | `src/components/Tile.tsx`、`src/game/tileAssets.ts`、`src/styles.css` |
| 修改比赛设置与默认规则 | `src/components/MatchSettings.tsx`、`src/game/match/matchRules.ts`、`src/game/match/types.ts`、`src/game/score/rules/RuleConfig.ts` |
| 修改摸打、鸣牌、杠或和牌流程 | `src/game/engine.ts`、`src/game/callChecker.ts`、`src/game/chiChecker.ts`、`src/game/kanChecker.ts`、`src/game/winChecker.ts` |
| 修改 AI | `src/game/ai.ts`、`src/game/recommendDiscards.ts`（当前实现实际位于 `src/game/shanten.ts` 的导出中） |
| 修改役种 | `src/game/score/yakuChecker.ts`、`src/game/score/yaku/*/index.ts`、`src/game/score/yaku/types.ts` |
| 修改符数和点数 | `src/game/score/fu/*`、`src/game/score/pointCalculator.ts`、`src/game/scoreCalculator.ts` |
| 修改振听、向听数或有效牌 | `src/game/furiten.ts`、`src/game/shanten.ts`、`src/game/tileCounts.ts` |
| 修改牌谱保存 | `src/game/persistence/*`、`src/App.tsx`、`SAVE_FORMAT.md` |
| 修改回放 | `src/game/replay/*`、`src/components/Replay*.tsx`、`REPLAY_FORMAT.md` |
| 修改规则说明 | `src/components/rulesGuide/*`、`src/game/rulesGuide/*`、`src/game/rules/ruleDescriptions.ts` |
| 修改或新增测试 | 与被测文件同目录的 `*.test.ts` / `*.test.tsx`、`TESTING.md`、`vite.config.ts` |

## 根目录文件

### `.gitignore`

- 作用：定义 Git 忽略的依赖、构建产物、缓存和本地临时文件。
- 主要职责：避免 `node_modules`、`dist`、覆盖率和机器相关文件进入版本库。
- 通常在什么情况下修改：新增生成目录、工具缓存或本地环境文件时。
- 修改风险：低。

### `.npmrc`

- 作用：保存本项目 npm 客户端行为设置。
- 主要职责：约束依赖安装时使用的 npm 配置。
- 通常在什么情况下修改：安装源、缓存或依赖安装策略发生变化时。
- 修改风险：中；可能影响所有开发者的安装结果。

### `AGENTS.md`

- 作用：给自动化维护工具规定项目语言、修改边界和验证要求。
- 主要职责：保护核心规则、计分、AI和存档格式，约束任务范围。
- 通常在什么情况下修改：团队维护规范明确变化时；普通功能任务不要修改。
- 修改风险：高；会改变后续自动化工作的行为边界。

### `README.md`

- 作用：项目概览、功能摘要、运行与测试入口。
- 主要职责：帮助新维护者快速了解技术栈和主要能力。
- 通常在什么情况下修改：安装方式、主要功能或基线验证结果变化时。
- 修改风险：低。

### `MATCH_RULES.md`

- 作用：记录整场比赛的局数推进、连庄、终局、马点和头跳等规则。
- 主要职责：作为比赛引擎与设置界面的维护说明。
- 通常在什么情况下修改：`src/game/match` 行为或比赛规则字段变化时。
- 修改风险：中；文档必须与引擎保持一致。

### `REPLAY_FORMAT.md`

- 作用：说明牌谱事件日志、版本、序列化和回放约束。
- 主要职责：维护 Replay / MatchLog 数据格式兼容性。
- 通常在什么情况下修改：回放事件、版本号或校验规则变化时。
- 修改风险：高；错误会误导兼容与迁移工作。

### `SAVE_FORMAT.md`

- 作用：说明当前对局存档键、版本、序列化范围和迁移策略。
- 主要职责：维护 SavedMatch 数据格式契约。
- 通常在什么情况下修改：存档结构、版本或 localStorage 键变化时。
- 修改风险：高；关系已有存档兼容性。

### `SCORING_AUDIT.md`

- 作用：记录番、符、点数及役种实现的审查结果。
- 主要职责：辅助核对计分引擎覆盖范围和已知边界。
- 通常在什么情况下修改：计分规则经过审查或实现状态变化时。
- 修改风险：中。

### `TESTING.md`

- 作用：记录测试命令、测试组织和验证基线。
- 主要职责：为功能修改选择合适的测试范围。
- 通常在什么情况下修改：测试工具、命令或测试约定变化时。
- 修改风险：低。

### `PROJECT_FILE_GUIDE.md`

- 作用：即本文，提供项目可维护文本文件的查找索引。
- 主要职责：把常见改动映射到源码、测试、配置和文档。
- 通常在什么情况下修改：新增、移动、删除文件或文件职责明显变化时。
- 修改风险：低。

### `index.html`

- 作用：Vite 应用的 HTML 外壳和 React 挂载节点。
- 主要职责：提供浏览器页面入口及基础元信息。
- 通常在什么情况下修改：页面标题、图标、全局 meta 或挂载节点变化时。
- 修改风险：低。

### `package.json`

- 作用：定义项目元数据、依赖和 `dev`、`test`、`build`、`preview` 命令。
- 主要职责：管理 React、Vite、TypeScript、Vitest 工具链。
- 通常在什么情况下修改：增加依赖、调整脚本或升级工具时。
- 修改风险：中。

### `package-lock.json`

- 作用：锁定 npm 依赖树及完整性信息。
- 主要职责：保证不同机器安装结果可复现。
- 通常在什么情况下修改：运行 npm 安装、升级或移除依赖时自动更新。
- 修改风险：中；不应手工局部编辑。

### `tsconfig.json`

- 作用：应用源码的 TypeScript 编译配置。
- 主要职责：定义类型检查、JSX、模块解析和包含范围。
- 通常在什么情况下修改：编译目标、严格度、路径或源码范围变化时。
- 修改风险：中。

### `tsconfig.node.json`

- 作用：面向 Vite 等 Node 侧配置文件的 TypeScript 设置。
- 主要职责：将工具配置与浏览器应用编译环境分开。
- 通常在什么情况下修改：构建工具或 Node 目标发生变化时。
- 修改风险：中。

### `vite.config.ts`

- 作用：配置 Vite、React 插件和 Vitest 运行环境。
- 主要导出：Vite `defineConfig` 配置。
- 通常在什么情况下修改：构建、开发服务器、测试匹配或测试环境变化时。
- 修改风险：中。

### `scripts` 目录

当前 `git ls-files` 中没有 `scripts/` 下的已跟踪脚本；以后新增脚本时应在此按文件补充用途、入口和风险。

## `src/components`

以下风险按“只改该文件通常影响多大范围”评估。

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/components/ActionPrompt.tsx` | 导出 `ActionPrompt`，提供鸣牌、立直、和牌等操作候选的统一提示容器。 | 调整操作栏标题、可访问名称或候选布局。 | 中 |
| `src/components/AdvancedRuleSettings.tsx` | 导出 `AdvancedRuleSettings`，编辑传入的高级规则配置。 | 增删高级规则控件或字段映射。 | 中 |
| `src/components/AnalysisPanel.tsx` | 导出 `AnalysisPanel`，根据 `GameState` 生成牌理、计分和候选分析。 | 调整牌局分析内容或展示。 | 中 |
| `src/components/BackButton.tsx` | 导出复用的 `BackButton`。 | 修改统一返回按钮文字或样式挂点。 | 低 |
| `src/components/Board.tsx` | 导出 `Board`，连接牌局状态、牌桌、操作候选、听牌提示、悬停状态和用户动作。 | 调整游戏交互编排或操作区；避免在此重写规则。 | 高 |
| `src/components/ContinueMatchDialog.tsx` | 导出继续存档对话框，显示有效存档或加载错误。 | 修改继续、放弃存档入口。 | 中 |
| `src/components/DoraIndicator.tsx` | 导出宝牌指示牌列表，并接入同牌悬停共享状态。 | 修改简版宝牌指示显示。 | 低 |
| `src/components/ExitGameDialog.tsx` | 导出退出对局弹窗，承载保存中、失败、超时、重试和直接退出状态。 | 修改退出保存流程的用户界面。 | 高 |
| `src/components/GameTypeMenu.tsx` | 导出东风/南风类型选择菜单。 | 修改比赛长度选择入口。 | 低 |
| `src/components/Hand.tsx` | 导出基础手牌组件，处理本家/对手、可弃牌及点击。 | 修改旧版或通用手牌渲染。 | 中 |
| `src/components/LocalModeMenu.tsx` | 导出本地模式菜单。 | 增加本地玩法入口或提示。 | 低 |
| `src/components/MainMenu.tsx` | 导出主菜单，显示继续对局、本地、联机占位和牌谱学习入口。 | 修改首页导航。 | 中 |
| `src/components/MatchHeader.tsx` | 导出比赛标题信息。 | 修改整场比赛摘要。 | 低 |
| `src/components/MatchResultDialog.tsx` | 导出终局排名弹窗，展示原始点数、顺位、马点、头跳等结算。 | 修改整场结果展示。 | 中 |
| `src/components/MatchSettings.tsx` | 导出 `MatchSettings`、`normalizeMatchSettingsConfig`、`buildUma`，管理赛前规则与辅助显示。 | 增删设置项、默认归一化或马点输入。 | 高 |
| `src/components/MeldDisplay.tsx` | 导出副露只读显示，处理横置来源牌、杠形、宝牌与同牌悬停。 | 修改吃碰杠牌的排列和视觉。 | 中 |
| `src/components/PlayerMelds.tsx` | 导出玩家全部副露列表，将 `CallSet` 适配为 `MeldDisplay`。 | 修改副露组间布局或传递视觉状态。 | 中 |
| `src/components/ReplayControls.tsx` | 导出回放播放、暂停、步进、跳转和倍速控件。 | 修改回放控制器界面。 | 低 |
| `src/components/ReplayBottomBar.tsx` | 组合局数切换、播放控制、倍速和可拖动步骤进度条。 | 修改全屏回放底栏。 | 低 |
| `src/components/ReplayEventList.tsx` | 导出可选择的回放事件列表。 | 修改事件导航或当前事件高亮。 | 低 |
| `src/components/ReplayInfoPanel.tsx` | 导出回放时的局面信息面板，支持调试信息。 | 修改回放状态摘要。 | 低 |
| `src/components/ReplayLibrary.tsx` | 导出牌谱列表、空状态及打开、重命名、删除、导出操作。 | 修改本地牌谱管理界面。 | 中 |
| `src/components/ReplayDetail.tsx` | 将已加载牌谱直接接入全屏逐步回放播放器。 | 修改牌谱回放入口。 | 中 |
| `src/components/ReplayScreen.tsx` | 导出全屏逐步回放页面，组合顶栏、牌桌视口、底栏、牌山抽屉和自动播放。 | 修改回放页面布局与控制编排。 | 中 |
| `src/components/ReplayTopBar.tsx` | 展示返回、当前局/步骤/动作、视角切换、牌山入口与全牌公开标识。 | 修改全屏回放顶栏。 | 低 |
| `src/components/ReplayWallDrawer.tsx` | 将现有牌山内容放入可关闭、内部独立滚动的右侧抽屉。 | 修改牌山抽屉交互。 | 低 |
| `src/components/ReplayWallPanel.tsx` | 复用牌图展示牌山、王牌、岭上、宝牌/里宝牌位置及权限边界，作为抽屉内容。 | 修改回放牌山内容。 | 中 |
| `src/components/ResultDialog.tsx` | 导出局结果弹窗，渲染和牌、流局、途中流局、役种、点数和牌图。 | 修改单局结果展示；不要在此改计分。 | 高 |
| `src/components/RiichiModeMenu.tsx` | 导出立直麻将人数选择及规则说明入口。 | 修改立直麻将菜单入口。 | 低 |
| `src/components/River.tsx` | 导出基础牌河组件。 | 修改旧版或通用弃牌显示。 | 低 |
| `src/components/RoundInfo.tsx` | 导出当前局、场风、本场等信息。 | 修改局况摘要。 | 低 |
| `src/components/RuleHelpTooltip.tsx` | 导出规则字段帮助提示。 | 调整设置说明的交互方式。 | 低 |
| `src/components/RulePresetSelector.tsx` | 导出规则预设选择控件。 | 修改预设选择入口。 | 低 |
| `src/components/SaveStatusIndicator.tsx` | 导出保存状态指示器，展示保存中、已保存与错误。 | 修改自动保存反馈。 | 低 |
| `src/components/ScoreHistory.tsx` | 导出整场分数变化历史。 | 修改分数流水展示。 | 低 |
| `src/components/ScorePanel.tsx` | 导出四家分数、阶段和比赛信息面板。 | 修改计分面板布局。 | 中 |
| `src/components/Tile.tsx` | 导出核心 `Tile` 牌图组件，处理正面、牌背、占位、方向、宝牌光效与同牌悬停。 | 修改所有牌图的 DOM、交互或视觉类名。 | 高 |
| `src/components/TileCounter.tsx` | 导出 34 种牌的可见数量统计。 | 修改牌数统计界面。 | 低 |

### `src/components/game`

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/components/game/AnalysisDrawer.tsx` | 导出牌理分析抽屉，按开关显示 `AnalysisPanel`。 | 修改游戏内分析面板容器。 | 低 |
| `src/components/game/AnalysisToggle.tsx` | 导出分析面板开关按钮。 | 修改分析入口。 | 低 |
| `src/components/game/DiscardRiver.tsx` | 导出桌面牌河，处理立直横牌、被鸣牌留空、宝牌和共享悬停。 | 修改弃牌排列和可见历史。 | 高 |
| `src/components/game/DoraIndicatorStack.tsx` | 导出五槽宝牌指示区及局数、本场、供托摘要。 | 修改桌面左上宝牌区。 | 中 |
| `src/components/game/GameScreen.tsx` | 导出游戏页总布局，组合顶部栏、牌桌、本家区、操作栏、弹窗与规则说明。 | 调整游戏页面结构或入口。 | 高 |
| `src/components/game/GameTopBar.tsx` | 导出顶部状态栏和规则说明、牌局分析、返回菜单按钮。 | 修改顶部工具栏。 | 低 |
| `src/components/game/HandTrack.tsx` | 导出四家手牌轨道，控制对手牌背和座位旋转。 | 修改对手手牌位置与方向。 | 中 |
| `src/components/game/LocalHandArea.tsx` | 导出本家头像、手牌、副露与摸切标记区域，并提交弃牌。 | 修改本家底部区域或弃牌触发。 | 高 |
| `src/components/game/MahjongTable.tsx` | 导出麻将桌主体，定位四家手牌、头像、副露、牌河、立直棒和中央信息。 | 修改牌桌九宫格和各座位布局。 | 高 |
| `src/components/game/PlayerZone.tsx` | 导出 `PlayerZone` 与 `PlayerPosition`，显示对手身份、手牌、副露和摸切标记。 | 修改各对手头像框或手牌定位。 | 中 |
| `src/components/game/RiichiStick.tsx` | 导出横向/纵向立直棒 SVG。 | 修改立直棒尺寸和样式。 | 低 |
| `src/components/game/TableCenter.tsx` | 导出中央四家点数、场风、局数、本场与余牌面板。 | 修改牌桌中央信息。 | 中 |

### `src/components/rulesGuide`

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/components/rulesGuide/RulesGuideScreen.tsx` | 导出规则说明页面和 `RulesTab`，组织主页、分组役种、符数/点数选项卡。 | 修改规则页导航、卡片或说明布局。 | 中 |
| `src/components/rulesGuide/YakuExample.tsx` | 导出只读役种牌例，复用牌图和副露横置/暗杠适配。 | 修改牌例呈现方式。 | 中 |

## `src/game`

### 基础牌局与规则流程

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/game/abortiveDraw.ts` | 导出九种九牌声明、四风连打等途中流局检查及结果构造。 | 修改途中流局成立条件。 | 高 |
| `src/game/ai.ts` | 导出 AI 身份判断、可见牌统计、弃牌选择和自动行动推进。 | 修改电脑玩家策略或动作优先级。 | 高（AI 核心） |
| `src/game/callChecker.ts` | 导出碰候选、碰执行和跳过鸣牌，维护被鸣弃牌与一发状态。 | 修改碰或鸣牌窗口流程。 | 高 |
| `src/game/chiChecker.ts` | 导出吃候选、吃执行及 AI 可用吃法筛选。 | 修改吃牌合法性或吃后状态。 | 高 |
| `src/game/engine.ts` | 导出初始局面、摸牌、弃牌、荣和、自摸等主要状态推进。 | 任何回合流程或 GameState 生命周期修改。 | 高（游戏状态推进核心） |
| `src/game/exhaustiveDraw.ts` | 导出荒牌流局听牌判断、罚符分配和结算。 | 修改流局听牌或 3000 点罚符。 | 高 |
| `src/game/furiten.ts` | 导出舍牌振听、临时振听、立直后振听和荣和许可计算。 | 修改振听显示或规则时。 | 高（振听核心） |
| `src/game/interaction.ts` | 导出摸牌后可用动作、立直暗杠等待保持等交互派生状态。 | 修改动作按钮出现条件。 | 高 |
| `src/game/kanChecker.ts` | 导出暗杠、大明杠、加杠候选与执行，以及抢杠窗口。 | 修改杠、岭上牌、开宝牌流程。 | 高 |
| `src/game/meldDisplayAdapter.ts` | 导出 `CallSet` 到展示模型的转换，计算来源方向和横置位置。 | 修改副露展示顺序，不改规则判定。 | 中 |
| `src/game/shanten.ts` | 导出标准形、七对子、国士向听数，以及有效牌和弃牌推荐。 | 修改牌理算法、听牌或推荐。 | 高（向听数/有效牌核心） |
| `src/game/tileAssets.ts` | 导出牌图键、图片、替代文本、赤五和牌背/占位映射。 | 增换牌图资源或命名映射。 | 中 |
| `src/game/tileCounts.ts` | 导出 34 牌计数、标准化、可见剩余量等基础函数。 | 修改牌计数数据表示。 | 高 |
| `src/game/tileUtils.ts` | 导出牌 ID、花色、点数、创建、排序和中文名工具。 | 修改牌编码或通用牌工具。 | 高 |
| `src/game/types.ts` | 定义 `Tile`、`PlayerState`、`GameState`、鸣牌、立直、振听和局结果等核心类型。 | 增删牌局状态字段或数据契约。 | 高 |
| `src/game/visibility.ts` | 导出从本家手牌、牌河、公开副露和宝牌指示牌生成可见牌计数。 | 修改听牌剩余量的可见信息口径。 | 高 |
| `src/game/wall.ts` | 导出 136 张牌墙构造、洗牌、王牌拆分和初始宝牌指示。 | 修改牌山生成与随机化。 | 高 |
| `src/game/winChecker.ts` | 导出荣和/自摸可否判定、结果构造和点数增减。 | 修改和牌入口、多家荣和或支付结算。 | 高 |

### `src/game/match`

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/game/match/finalRanking.ts` | 导出最终顺位、同分排序、马点、头跳和供托结算。 | 修改整场排名或换算分。 | 高 |
| `src/game/match/matchEngine.ts` | 导出比赛初始化、开局、应用局结果、终局选择和下一局推进。 | 修改东风/半庄整场生命周期。 | 高 |
| `src/game/match/matchRules.ts` | 导出比赛规则预设、默认值、兼容迁移和校验。 | 修改赛前默认规则或预设。 | 高 |
| `src/game/match/roundTransition.ts` | 导出局名、座风、庄家轮换、连庄和下一局计算。 | 修改局数/场风推进。 | 高 |
| `src/game/match/testUtils.ts` | 导出比赛测试用局结果和状态构造器。 | 新增比赛引擎测试夹具。 | 低 |
| `src/game/match/types.ts` | 定义 `MatchRuleConfig`、`FullRuleConfig`、`MatchState`、最终结果等类型。 | 修改比赛配置或整场状态结构。 | 高 |

### `src/game/persistence`

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/game/persistence/migration.ts` | 导出 `migrateSavedMatch`，按版本迁移或拒绝不兼容存档。 | 存档版本升级时。 | 高（存档兼容） |
| `src/game/persistence/replayRecord.ts` | 构造并兼容归一化本地 `ReplayRecord` 牌谱记录。 | 修改牌谱列表元数据或旧裸日志兼容时。 | 高 |
| `src/game/persistence/saveManager.ts` | 导出 `LocalStorageAdapter`、`SaveManager` 和保存状态，逐条管理当前对局与牌谱。 | 修改保存、加载、重命名、删除、导出和错误隔离。 | 高 |
| `src/game/persistence/saveTestUtils.ts` | 导出内存 Storage 和样例存档。 | 编写存档测试。 | 低 |
| `src/game/persistence/storageTypes.ts` | 定义存档版本、键名、`SavedMatch`、回放元数据和存储接口。 | 修改存档格式或存储键。 | 高（存档格式） |
| `src/game/persistence/storageValidation.ts` | 导出 `validateSavedMatch`，校验加载数据结构。 | 增加存档字段或强化校验。 | 高 |

### `src/game/replay`

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/game/replay/eventRecorder.ts` | 导出牌快照、事件工厂、局初始化、状态迁移记录和终局日志。 | 记录新的牌局事件。 | 高 |
| `src/game/replay/eventReducer.ts` | 导出初始回放状态和确定性事件归约器。 | 修改事件如何重建公开局面。 | 高 |
| `src/game/replay/replayEngine.ts` | 导出创建、前后步进、跳转、播放状态和倍速控制。 | 修改回放控制行为。 | 中 |
| `src/game/replay/replayPlayback.ts` | 导出自动播放节拍、局末停止和键盘快捷键目标过滤工具。 | 修改回放计时与快捷键。 | 中 |
| `src/game/replay/replayTestUtils.ts` | 导出样例 `MatchLog`。 | 新增回放测试。 | 低 |
| `src/game/replay/roundReplay.ts` | 通过局初快照和动作纯函数重建任意步骤的完整牌桌与牌山状态。 | 修改逐步回放动作归约或牌山推导。 | 高 |
| `src/game/replay/serialization.ts` | 导出牌谱 JSON 序列化与反序列化。 | 修改牌谱传输格式。 | 高 |
| `src/game/replay/types.ts` | 定义日志版本、全部事件、快照、局日志和回放状态类型。 | 新增事件或改变牌谱格式。 | 高（Replay 格式） |
| `src/game/replay/validation.ts` | 导出日志、事件序列和回放状态校验。 | 新增事件约束或数据完整性规则。 | 高 |

### 规则说明数据

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/game/rules/ruleDescriptions.ts` | 导出设置字段的简体中文说明表和键类型。 | 设置项文案与规则字段变化时。 | 中 |
| `src/game/rulesGuide/fuPointsGuide.ts` | 导出符数示例和由真实点数函数批量生成的点数表。 | 修改规则说明的符数/点数示例。 | 中 |
| `src/game/rulesGuide/yakuCatalog.ts` | 导出 `GUIDE_YAKU`、稳定役种 ID、役种卡片元数据和合法牌例。 | 修改规则说明内容或牌例；需与计分注册一致。 | 高 |

### `src/game/score`

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/game/score/fu/fuCalculator.ts` | 导出 `calculateFu`、`calculateFuDetails` 和符数明细，处理固定符、面子符、等待符与进位。 | 修改符数计算或说明明细。 | 高（符数核心） |
| `src/game/score/fu/fuRules.ts` | 定义符计算输入 `FuContext`、`FuMeld` 等类型。 | 符数上下文新增规则字段时。 | 高 |
| `src/game/score/fu/fuUtils.ts` | 导出幺九/三元集合、役牌雀头符、面子符、平和形和符数进位工具。 | 修改具体符值规则。 | 高 |
| `src/game/score/fuCalculator.ts` | 兼容性导出层，转发新 `fu/` 目录的符计算 API。 | 仅在公共导出路径变化时。 | 中 |
| `src/game/score/hanCalculator.ts` | 导出总番计算与宝牌、里宝牌、赤宝牌计数。 | 修改番数汇总或宝牌计数入口。 | 高 |
| `src/game/score/pointCalculator.ts` | 导出基本点、满贯以上限、庄闲荣和/自摸支付计算。 | 修改切上满贯、累计役满或支付公式。 | 高（点数核心） |
| `src/game/score/rules/RuleConfig.ts` | 定义单局计分规则及 `defaultRuleConfig`。 | 新增计分开关或改变底层默认值。 | 高 |
| `src/game/score/scoringAdapter.ts` | 导出副露到计分面子的转换和从 `GameState` 构造计分上下文。 | 游戏状态字段与计分输入衔接变化时。 | 高 |
| `src/game/score/scoringTypes.ts` | 定义等待类型、和牌方式、和牌张来源和计分副露上下文。 | 改变计分输入契约。 | 高 |
| `src/game/score/waitClassifier.ts` | 导出根据听牌前结构和和牌张判定两面、边张、嵌张、单骑、双碰。 | 修改等待型与等待符来源。 | 高 |
| `src/game/score/yaku/ancient/index.ts` | 导出古役白名单 `ANCIENT_YAKU` 及稳定 ID。 | 增删古役注册或番数元数据。 | 高 |
| `src/game/score/yaku/normal/index.ts` | 导出普通役注册表 `NORMAL_YAKU`。 | 修改现代普通役的名称、开门番数或注册。 | 高 |
| `src/game/score/yaku/types.ts` | 定义 `YakuResult`、役种类别，并导出普通役/役满结果构造器。 | 修改役种结果数据结构。 | 高 |
| `src/game/score/yaku/yakuman/index.ts` | 导出标准役满和双倍役满注册表。 | 修改役满名称、倍数或注册。 | 高 |
| `src/game/score/yakuChecker.ts` | 导出和牌拆解、普通役、役满与古役实际判定。 | 修改任何役种成立条件。 | 高（役种判定核心） |
| `src/game/scoreCalculator.ts` | 导出 `evaluateWin`，枚举拆解并选择最高点结果，整合役、番、符、点。 | 修改计分总流程或最优拆解选择。 | 高（番符点总入口） |

### 应用入口、Hook 与声明

| 文件 | 作用与主要导出/职责 | 通常修改场景 | 风险 |
| --- | --- | --- | --- |
| `src/App.tsx` | 默认导出应用根组件，管理页面导航、规则选择、活动对局、保存/退出和规则说明。 | 修改跨页面状态或顶层流程。 | 高 |
| `src/app/navigation.ts` | 导出页面联合类型、设置选择、比赛长度映射和面包屑标签。 | 新增页面或菜单路径。 | 中 |
| `src/hooks/useGameState.ts` | 导出局部游戏状态 Hook，封装初始化与状态更新。 | 修改组件侧状态管理方式。 | 中 |
| `src/main.tsx` | 创建 React 根节点，加载 `App` 和全局样式。 | 更换应用挂载或全局 Provider。 | 中 |
| `src/styles.css` | 全局样式表，涵盖菜单、牌桌、牌图、弹窗、规则说明和响应式布局。 | 所有视觉与响应式调整。 | 中；全局选择器可能互相影响 |
| `src/test-node.d.ts` | 为测试代码补充最小 `process.cwd` 类型声明。 | 测试需要更多 Node 全局类型时。 | 低 |
| `src/vite-env.d.ts` | 引入 Vite 客户端环境类型。 | Vite 环境类型入口变化时。 | 低 |

## 测试文件

每个测试文件一行说明其主要覆盖内容；修改业务文件时优先运行同模块测试。

### 应用与组件测试

| 测试文件 | 主要覆盖内容 |
| --- | --- |
| `src/app/navigation.test.ts` | 页面选择到东风/南风比赛配置及路径标签的映射。 |
| `src/components/AbortiveDrawDialog.test.tsx` | 途中流局原因、连庄、本场和供托的结果弹窗。 |
| `src/components/ActionPromptCallOptions.test.tsx` | 吃碰杠/跳过候选、候选牌图与被叫牌突出。 |
| `src/components/ActionPromptClickTargets.test.tsx` | 鸣牌候选只有外层按钮承接点击且无嵌套按钮。 |
| `src/components/ActionPromptRiichiCandidates.test.tsx` | 立直文字与全部合法弃牌候选。 |
| `src/components/AnalysisTileImages.test.tsx` | 牌理推荐、有效牌和 34 种牌统计使用真实牌图。 |
| `src/components/ContinueMatchDialog.test.tsx` | 有效存档继续/放弃选择和加载错误。 |
| `src/components/ExhaustiveDrawDialog.test.tsx` | 荒牌流局听牌、未听、点差、连庄及手牌展示。 |
| `src/components/InteractionFlow.test.tsx` | 实战组件的摸牌间隔、操作按钮、弃牌和局结果交互。 |
| `src/components/MatchResultDialog.test.tsx` | 终局排名、原始点、换算分、马点、头跳和供托。 |
| `src/components/MatchSettings.test.tsx` | 比赛设置字段、默认值、辅助显示和配置更新。 |
| `src/components/MatchSettingsExtraRoundDefaults.test.tsx` | 东风/南风最大延长场风和返还点默认值。 |
| `src/components/MeldDisplay.test.tsx` | 吃碰杠牌数、来源标签、横置牌和暗杠样式。 |
| `src/components/NavigationMenus.test.tsx` | 主菜单、本地模式、立直模式、设置与规则说明导航。 |
| `src/components/ReplayDetail.test.tsx` | 牌谱详情页与逐步回放入口。 |
| `src/components/ReplayLayout.test.tsx` | 全屏三段结构、无整页滚动、牌山抽屉和窄屏控制布局。 |
| `src/components/ReplayScreen.test.tsx` | 四家视角、全牌公开、座位旋转和牌山信息边界。 |
| `src/components/PlayerMelds.test.tsx` | 多组副露顺序和座位旋转元数据。 |
| `src/components/ReplayControls.test.tsx` | 回放按钮、进度和速度选项。 |
| `src/components/ResultDialog.test.tsx` | 多家荣和明细、每位和牌者点数与结果结构。 |
| `src/components/SaveStatusIndicator.test.tsx` | 保存中、成功和失败三种反馈。 |
| `src/components/TileImageRendering.test.tsx` | 牌正面、牌背、占位图及手牌/牌河图片渲染。 |
| `src/components/WinResultDialog.test.tsx` | 和牌手牌、和牌张、副露、里宝牌和宝牌视觉。 |
| `src/components/game/AnalysisDrawer.test.tsx` | 分析抽屉开关、向听、有效牌、推荐和牌数统计。 |
| `src/components/game/DiscardRiver.test.tsx` | 普通/立直弃牌槽位、旋转、宝牌和同牌悬停。 |
| `src/components/game/DiscardRiverRiichiClaimed.test.tsx` | 立直宣言牌被鸣后留空开关及后续横牌。 |
| `src/components/game/DoraIndicatorStack.test.tsx` | 五个指示牌槽及局数、本场、供托信息。 |
| `src/components/game/GameResponsiveLayout.test.tsx` | 单屏牌桌、牌河固定尺寸和响应式 CSS。 |
| `src/components/game/GameScreen.test.tsx` | 游戏页三区结构、顶部按钮、规则说明与操作区。 |
| `src/components/game/HandTrack.test.tsx` | 四家手牌单行轨道、座位旋转和摸入牌间距。 |
| `src/components/game/LocalHandArea.test.tsx` | 本家头像/手牌/副露布局、弃牌、悬停和摸切标记。 |
| `src/components/game/MahjongTable.test.tsx` | 四家区域、中央牌河、副露、AI 摸切和牌桌组合。 |
| `src/components/game/PlayerZone.test.tsx` | 对手牌背、头像、庄家/行动者及摸切禁止标志。 |
| `src/components/game/RiichiStick.test.tsx` | 立直棒空槽、横纵 SVG 尺寸和红点。 |
| `src/components/game/TableCenter.test.tsx` | 中央尺寸、四家点数、局数、本场和余牌。 |
| `src/components/game/TableLayoutRegression.test.tsx` | 九宫格牌桌定位与关键布局回归。 |
| `src/components/rulesGuide/RulesGuideScreen.test.tsx` | 双入口、选项卡、役种注册/牌例、古役状态及符点表。 |

### 游戏规则与引擎测试

| 测试文件 | 主要覆盖内容 |
| --- | --- |
| `src/game/abortiveDraw.test.ts` | 九种九牌、四风连打、四家立直、四杠散了等条件。 |
| `src/game/abortiveDrawIntegration.test.ts` | 三家荣和配置与途中流局在完整流程中的结算。 |
| `src/game/ai.test.ts` | AI 玩家识别、可见牌、弃牌和自动行动。 |
| `src/game/callChecker.test.ts` | 碰、复合鸣牌候选、鸣牌优先级与执行。 |
| `src/game/chankan.test.ts` | 加杠前抢杠窗口、荣和与跳过后的杠流程。 |
| `src/game/chiChecker.test.ts` | 各种吃法、座次限制、候选与执行。 |
| `src/game/exhaustiveDraw.test.ts` | 0～4 家听牌的罚符分配和流局结果。 |
| `src/game/exhaustiveDrawIntegration.test.ts` | 最后一张自摸/荣和优先于荒牌流局及海底河底。 |
| `src/game/furiten.test.ts` | 舍牌振听、临时振听、立直后振听及自摸不受限。 |
| `src/game/interactionFlow.test.ts` | 摸打、摸切记录、鸣牌、立直和玩家/AI 回合推进。 |
| `src/game/kanChecker.test.ts` | 暗杠、大明杠、加杠、岭上牌、宝牌和抢杠。 |
| `src/game/meldDisplayAdapter.test.ts` | 副露来源方向、横置索引、杠牌顺序和暗杠。 |
| `src/game/nextRoundReset.test.ts` | 下一局清理临时状态并保留整场分数。 |
| `src/game/northPlayerRiichi.test.ts` | 北家立直弃牌、鸣牌窗口与轮转回东家。 |
| `src/game/riichi.test.ts` | 立直条件、供托、听牌限制与状态更新。 |
| `src/game/riichiCallRestrictions.test.ts` | 立直后禁止吃碰大明杠及引擎防御。 |
| `src/game/riichiClaimedDiscard.test.ts` | 立直宣言牌被鸣后的横置状态和一次性转移。 |
| `src/game/riichiFlowRegression.test.tsx` | 四家与双立直弃牌横置的交互回归。 |
| `src/game/riichiVisualState.test.ts` | 立直正式成立前后立直棒视觉状态。 |
| `src/game/shanten.test.ts` | 标准形、七对子、国士向听数、有效牌和弃牌推荐。 |
| `src/game/tileAssets.test.ts` | 34 张基础牌、牌背、占位、赤五和图片映射。 |
| `src/game/winChecker.test.ts` | 自摸、荣和、多家荣和、支付与真实役要求。 |

### 比赛、存档与回放测试

| 测试文件 | 主要覆盖内容 |
| --- | --- |
| `src/game/match/endChoice.test.ts` | 和了止/听牌止的自动或玩家选择流程。 |
| `src/game/match/endConditions.test.ts` | 击飞、目标点、东四/南四及延长局终局条件。 |
| `src/game/match/finalRanking.test.ts` | 顺位、同分庄家顺序、马点、头跳和供托结算。 |
| `src/game/match/matchEngine.test.ts` | 比赛初始化、座风、开局和应用局结果。 |
| `src/game/match/matchIntegration.test.ts` | 东风场/半庄完整推进、连庄及终局。 |
| `src/game/match/matchRules.test.ts` | 预设、旧标识迁移、规则校验和默认一致性。 |
| `src/game/match/roundTransition.test.ts` | 局名、座风、庄家轮换、东南场推进。 |
| `src/game/persistence/migration.test.ts` | 当前、缺失和未来版本存档迁移/拒绝。 |
| `src/game/persistence/saveManager.test.ts` | 当前对局与牌谱的持久化、排序、兼容、重命名、删除、导出和损坏隔离。 |
| `src/game/persistence/storageValidation.test.ts` | 有效存档及结构错误校验。 |
| `src/game/replay/eventRecorder.test.ts` | 连续唯一事件、牌实例、状态迁移和终局记录。 |
| `src/game/replay/eventReducer.test.ts` | 发牌、摸打确定性归约、不变性和重复事件拒绝。 |
| `src/game/replay/replayEngine.test.ts` | 前进、后退、跳转、播放状态和倍速。 |
| `src/game/replay/replayPlayback.test.ts` | 自动播放倍速、暂停/卸载清理、局末停止和键盘目标过滤。 |
| `src/game/replay/replayIntegration.test.ts` | 序列化到最终公开状态及非法事件序列拒绝。 |
| `src/game/replay/roundReplay.test.ts` | 配牌、摸打、吃碰杠、立直、岭上、结算、确定性和旧牌谱降级。 |

### 计分测试

| 测试文件 | 主要覆盖内容 |
| --- | --- |
| `src/game/score/fu/fuCalculator.test.ts` | 基础符、门前荣和、自摸、面子、雀头、等待和进位。 |
| `src/game/score/pointCalculator.test.ts` | 非上限、满贯以上、切上满贯、累计役满和庄闲支付。 |
| `src/game/score/sanankouProvenance.test.ts` | 三暗刻对暗刻、暗杠及荣和双碰来源的判定。 |
| `src/game/score/scoringAdapter.test.ts` | 吃碰杠到计分面子及门清判断。 |
| `src/game/score/scoringContextIntegration.test.ts` | 海底、河底、岭上、抢杠等和牌来源上下文。 |
| `src/game/score/scoringIntegration.test.ts` | 多拆解枚举并选择最高得点结果。 |
| `src/game/score/yaku/remainingModernYaku.test.ts` | 海底、河底、岭上、抢杠、双立直等现代役。 |
| `src/game/score/yakuChecker.test.ts` | 普通役、役满、古役及开门番数的广泛判定。 |
| `src/game/score/yakuhaiNames.test.ts` | 三元牌、场风和自风役牌的具体中文名称。 |
| `src/game/scoreCalculator.test.ts` | 计分总入口的役种、番符、宝牌和点数整合。 |

## 资源文件

### `src/assets/tiles/`

- 用途：保存牌桌、手牌、牌河、副露、规则牌例和结果弹窗共用的麻将牌 PNG。
- 命名规则：`m1`～`m9` 为万子，`p1`～`p9` 为筒子，`s1`～`s9` 为索子，`z1`～`z7` 为东南西北白发中；另有 `back.png` 牌背和 `placeholder.png` 透明/空位图。
- 引用入口：统一由 `src/game/tileAssets.ts` 映射，再由 `src/components/Tile.tsx` 等组件使用；不要在各组件重复维护图片路径。
- 当前目录的每张二进制牌图不逐项解释。

### 其他二进制文件

- 根目录的“一局规则”PDF 是外部规则参考资料，不参与运行时导入；它不是可维护源码文本，因此不逐页说明。
- `node_modules/`、`dist/`、`coverage/`、`.npm-cache/` 属于依赖、构建或测试生成目录，不在 `git ls-files` 的维护文件说明范围内。

## 文件依赖关系

### App 与页面导航

`src/main.tsx` 挂载 `src/App.tsx`；`App` 使用 `src/app/navigation.ts` 的页面类型和比赛选择映射，在主菜单、本地模式、规则设置、对局、回放和规则说明组件之间切换。

### 设置到牌局配置

`MatchSettings.tsx` 编辑 `FullRuleConfig`；`matchRules.ts` 提供整场预设和校验，`RuleConfig.ts` 提供单局计分默认值，最终由 `App.tsx` 创建 `MatchState` 与 `GameState` 并传入引擎和界面。

### 游戏引擎到界面

`engine.ts` 及吃碰杠、振听、和牌模块更新 `GameState`；`Board.tsx` 把状态与动作接到 `GameScreen.tsx`，再由 `MahjongTable.tsx`、`LocalHandArea.tsx`、`DiscardRiver.tsx`、`MeldDisplay.tsx` 和 `Tile.tsx` 展示。

### 计分判定到结果弹窗

`winChecker.ts` 构造计分上下文，经 `scoringAdapter.ts` 调用 `scoreCalculator.ts`；后者组合 `yakuChecker.ts`、`hanCalculator.ts`、`fuCalculator.ts` 和 `pointCalculator.ts`，结果由 `ResultDialog.tsx` 展示。

### AI 决策

`engine.ts` 进入 AI 回合后由 `ai.ts` 读取当前状态和公开可见牌，调用现有向听/推荐能力选择动作，再通过相同的摸打、鸣牌和杠接口推进，避免维护另一套牌局规则。

### 牌谱保存与回放

`App.tsx` 通过 `SaveManager` 与 `LocalStorageAdapter` 保存 `SavedMatch`；加载时依次经过 `migration.ts` 和 `storageValidation.ts`。牌谱由 `eventRecorder.ts` 记录为 `MatchLog`，通过 `serialization.ts` 保存；逐步研习由 `roundReplay.ts` 从局初快照与动作纯函数重建，再由 `ReplayScreen.tsx` 适配到现有牌桌和牌图组件。

新增、移动或删除源码文件后，应同步更新本说明。
