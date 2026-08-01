# 全量稳定性审查第一轮

审查日期：2026-08-01（Asia/Shanghai）  
审查对象：`C:\Users\Wenkai\Desktop\UNSW\local mahjong`  
审查边界：只读审查生产代码与现有测试；未修改生产代码、规则语义或测试。

## 1. 审查环境与基线

| 项目 | 实际结果 |
| --- | --- |
| Node | `v24.18.0` |
| npm | `11.16.0` |
| TypeScript | `5.9.3`（锁定安装；`package.json` 声明 `^5.7.2`） |
| Vite | `6.4.3`（锁定安装；声明 `^6.0.5`） |
| Vitest | `2.1.9`（锁定安装；声明 `^2.1.8`） |
| 分支 | `main`，跟踪 `origin/main` |
| Commit | `e402159ebde2316205e4628d55a861202ed404ac` |
| 审查前工作树 | 干净 |
| 测试文件 | 90 个（`rg --files` 与 `git ls-files` 一致） |
| 测试项 | 618 项通过，0 失败，0 跳过 |
| `npm test` | 通过，Vitest 报告耗时 5.09s |
| `npm run build` | 通过；TypeScript 编译和 Vite 生产构建均成功，155 modules transformed |

任务预期为 90 个测试文件、614 项测试和构建通过；实际测试文件数与构建一致，测试项多 4 项（618），无回退。README 的“45 文件/255 测试”基线已过时。

`package.json` 的全部脚本为 `dev`、`build`、`preview`、`test`。不存在 `lint`、`typecheck`、`test:coverage` 脚本，因此未运行、未添加；`build` 内含 `tsc`，但不能替代独立 typecheck 基线或覆盖率报告。

## 2. 模块清单

| 模块 | 主要入口 | 正常游戏 | AI | 回放/存档 | 审查结论 |
| --- | --- | --- | --- | --- | --- |
| 状态推进 | `engine.ts`、`types.ts` | `App.tsx`/`Board.tsx` | `ai.ts` | `eventRecorder.ts`/`roundReplay.ts` | 基本防御存在；局终供托状态不守恒 |
| 吃碰食替 | `chiChecker.ts`、`callChecker.ts`、`kuikae.ts` | 共享执行函数 | 共享执行函数 | `roundReplay.ts` 独立归约 | 底层会拦截非法弃牌；公开计数和存档对“历史别名”处理不一致 |
| 杠/抢杠 | `kanChecker.ts` | `executeKan` | 同一入口 | 事件归约 | 杠后宝牌槽与牌山缩短错误，属于计分高风险 |
| 和牌/振听 | `winChecker.ts`、`furiten.ts` | 荣和/自摸入口 | AI 自动荣和路径 | 结果事件 | 无役与振听有共享校验；多家荣和有测试 |
| 计分 | `scoreCalculator.ts`、`score/*` | `winChecker.ts` | 间接共享 | 记录结果为准 | 覆盖广；本轮不重审每个役种数学证明 |
| 比赛推进 | `matchEngine.ts`、`roundTransition.ts` | 局结果继续按钮 | AI 终局选择 | 最终结果记录 | 重复局结果有 ID 防护；点数校验容差过宽 |
| AI | `ai.ts`、`shanten.ts` | — | 合法候选后调用共享执行器 | — | 不读墙/对手暗手；完整对局不可固定种子复现 |
| 牌谱 | `replay/*`、`ReplayScreen.tsx` | 事件记录 | — | 确定性重建与视角显示 | 重建纯函数较好；牌山抽屉隐藏权限已按实例与主视角修复 |
| 设置/存档 | `matchRules.ts`、`persistence/*` | `App.tsx` | — | localStorage | 读失败有隔离；鸣牌局面保存会被校验拒绝 |
| 界面 | `components/game/*`、`styles.css` | 按钮和牌桌 | — | 回放复用牌桌 | 牌河布局有结构测试；弹窗键盘/焦点覆盖不足 |

## 3. 已验证的不变量

- 新牌由 `createTile` 生成独立 `instanceId`；发牌、摸牌、弃牌和副露都按实例移动。
- 被鸣弃牌在牌河中以 `claimed/claimedBy` 保留历史，同时副露保留同一实例；AI 可见牌统计用 `seenInstances` 去重。
- `discardTile` 在最底层调用 `canDiscardTileByRules`，食替禁打不能通过 UI 或 AI 绕过。
- 正常比赛点数基线由 `startingPoints * 4` 动态计算；`createMatch`、多场重置和 `validateMatchState` 未硬编码 100000。默认回放测试中的 100000 仅代表默认四家 25000。
- 新局通过全新 `GameState` 清空牌河、副露、立直/一发、临时振听、鸣牌窗口、抢杠窗口、当前摸牌引用、食替集合和局结果；`nextRoundReset.test.ts` 覆盖主要字段。
- `appliedRoundIds` 可阻止带稳定 `roundId` 的同一局结果重复应用；比赛结束后 `startNextRound` 不再启动新局。
- 赤五与普通五共享 `tile.id` 牌型语义，同时保留 `red` 与 `instanceId`；牌图、AI候选和计分均有相关测试。
- 荣和/自摸调用 `evaluateWin` 后以 `hasRealYaku` 排除仅宝牌无役；振听候选使用同一正式计分上下文。
- `buildReplayState` 每次从局初快照归约到目标步骤，不复用上次可变结果；现有测试覆盖重复构建、前后步进、序列化和旧牌谱无牌山降级。
- 回放视角通过 `TableSeatMapping` 旋转玩家映射；全牌公开是独立布尔状态，普通牌桌对手手牌保持牌背。
- 损坏牌谱在列表层逐条隔离为 `corrupted` 元数据，不会阻断整个列表。

### 核心状态覆盖缺口

- 没有贯穿所有有效区域（手牌、牌山、王牌、牌河历史、副露）的统一实例占用验证器；存档校验既漏掉牌山/王牌，又错误拒绝合法的“被鸣牌河历史 + 副露”别名。
- 没有在每个动作后强制验证 `sum(scores) + riichiSticks * 1000 === startingPoints * 4`；现有 `validateMatchState` 允许最多 20000 点漂移。
- 下一局重置测试未明确断言 `temporaryFuriten`、`pendingRiichiSidewaysDiscard`、`kuikaeForbiddenTileIds`、结果弹窗关闭状态的每个字段。
- 局终和杠结算各有独立 `settleRound` 实现，缺少共享幂等结算守卫。

## 4. 现有测试覆盖

### 规则调用矩阵

| 审查项 | 实现入口 | 共享校验函数 | 正常游戏调用 | AI 调用 | 回放调用 | 已有测试 | 缺失/风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 吃 | `getChiOptions`/`executeChi` | `canChi`、`hasTiles`、食替函数 | `App`→`executeChi` | `findUsefulChiOption`→同入口 | `applyCall` | `chiChecker.test.ts` | 回放不复验事件合法性，只按日志归约 |
| 碰 | `getPonOptions`/`executePon` | `canPon`、`removeTilesByType` | `App`→`executePon` | 同入口 | `applyCall` | `callChecker.test.ts` | 合法被鸣历史在存档验证中被当重复实例 |
| 杠 | `executeKan` 及三类分支 | `canAnkan/Minkan/Kakan` | `App`→同入口 | 同入口 | `applyCall` | `kanChecker.test.ts`、`chankan.test.ts` | 只测指示牌数量，未测具体槽位或活牌墙缩短 |
| 禁止食替 | `kuikae.ts` | `legalDiscardTiles`、`canDiscardTileByRules` | `discardTile` | `selectAIDiscardTile` | `roundReplay` 独立维护 | `kuikae.test.ts` | 正常路径较强；需做共享规则差分测试 |
| 赤五 | `tileUtils`/计数/番计算 | `tile.id` 等价、`instanceId` 区分 | 全流程 | 候选按实例过滤 | 快照保留 `red` | `tileAssets`、`ai`、`roundReplay`、计分测试 | 缺少赤五参与吃碰杠后全区域唯一性测试 |
| 立直 | `canDeclareRiichi`/`getRiichiDiscardCandidates`/`declareRiichi` | 向听数、门清、点数 | `Board` 候选→`App` | 同候选→同弃牌入口 | 立直事件归约 | `riichi*`、`ActionPromptRiichiCandidates` | `declareRiichi` 本身不绑定候选实例；底层直接调用可先扣点再提交非法弃牌 |
| 横牌顺延 | `markRiverTileClaimed`、`discardTile` | `pendingRiichiSidewaysDiscard` | 共享 | 共享 | `roundReplay` | `riichiClaimedDiscard`、组件测试 | 下一局清理未逐字段断言 |
| 一发 | 副露/杠清除，后续舍牌过期 | `riichiState.ippatsuAvailable` | 共享 | 共享 | 日志近似重建 | `riichi`、计分上下文测试 | 缺少所有鸣牌类型和抢杠窗口组合矩阵 |
| 振听/同巡振听 | `furiten.ts`、`passRon`、`passChankan` | `canRonWithFuritenCheck` | 荣和窗口 | 自动过/和 | 回放只展示结果 | `furiten.test.ts`、`tenpaiDisplay` | 缺少多家荣和逐人过牌后后续同巡组合 |
| 无役禁止 | `winChecker.ts` | `hasRealYaku` | 荣和/自摸 | 同入口 | 记录结果 | `winChecker`、`tenpaiDisplay` | 正常覆盖充分 |
| 平和 | `yakuChecker`、`waitClassifier`、`fuCalculator` | 共享计分上下文 | `evaluateWin` | 间接 | 结果记录 | 平和条件与符数多项测试 | 缺少与所有副露来源/荣和刻子归属的属性测试 |
| 多家荣和/三家和 | `canRon`/`buildRonResult` | 顺位、`useOka`（UI定义为截和）、`tripleRonMode` | 弃牌荣和窗口 | 自动结算 | 结果记录 | `winChecker`、`abortiveDrawIntegration` | 缺少供托、本场、截和和三家和四维组合 |
| 流局/途中流局 | `exhaustiveDraw.ts`、`abortiveDraw.ts` | 听牌、特殊条件 | 引擎 | AI九种九牌 | 结果归约 | 流局与集成测试 | 缺少点数守恒属性测试和四杠牌山边界 |
| 本场/连庄/供托 | `matchEngine.ts`、`roundTransition.ts`、计分 | `dealerContinuesFromResult` | 继续按钮 | AI终局选择 | `roundReplay` | match/round/finalRanking 测试 | 和牌后的 `GameState.riichiSticks` 未清零，局终瞬间不守恒 |
| 最大延长场风 | `maxExtraWindIndex`、`evaluateEndOfMatch` | `isExtraRound`/`reachedMaxExtraRound` | 比赛推进 | 同状态机 | 最终结果 | `endConditions`、`roundTransition` | north 边界与连庄跨最大场风组合不足 |
| 东风/南风/多场 | `matchRules`、`matchEngine` | `scheduledFinalWind`、`matchCount` | 设置→比赛 | 同状态机 | 元数据 | `matchIntegration`、`multi-match` | 多场中断保存恢复和旧配置迁移组合不足 |

### AI 合法性

- `selectAIDiscardTile` 先取 `legalDiscardTiles`，再与立直候选实例求交；食替与立直候选均不能由推荐结果扩大。
- AI 吃碰杠均调用正常游戏的 `execute*`，底层再次执行 `can*`；弃牌最终由 `discardTile` 防御。
- AI 可见信息只包括各家牌河、公开副露、宝牌指示和自身手牌，并按实例去重；未读取对手暗手、活牌墙、王牌或里宝牌。
- `recommendDiscards` 接收食替禁打类型，最终实例仍由共享 `legalDiscardTiles` 限定。
- 缺口：`wall.ts` 固定使用 `Math.random`，`createTile` 使用 `crypto.randomUUID`，日志虽有可选 `seed` 字段却未接入洗牌/AI/实例 ID；因此“固定随机种子完整对局可复现”未实现。
- 缺口：立直暗杠等待保持在 `interaction.ts` 与 `kanChecker.ts` 有两套不同实现，UI候选与底层执行可能分歧（见 STAB-006）。

### 牌谱

| 要求 | 结果 |
| --- | --- |
| 确定性重建/重复构建 | 已覆盖，构建从初始快照重新归约 |
| 下一步→上一步→下一步 | 控制器与纯重建结构支持，已有前后步测试 |
| 真实动作/结果合成边界 | `hasSettlementAction` 防止结果事件和 `round-ended` 双结算 |
| 后退再前进不重复结算 | `scoresSettled` 只在单次构建生效，重新构建仍只结一次 |
| 视角几何稳定 | 玩家 ID 映射旋转；CSS/组件结构测试存在，尚无像素截图回归 |
| 普通视角隐藏信息 | 已修复；对手暗摸、未来牌墙和未公开里宝保持牌背，弃牌/鸣牌后按实例公开（STAB-003） |
| 全牌公开与视角独立 | 独立状态，已有测试 |
| 中央计分/弹窗/最终分数 | 使用同一重建状态和权威最终分数优先；旧日志回退存在 |
| 旧牌谱降级 | 缺牌山可降级；缺规则依赖记录归一化，未来版本策略不完整 |
| 损坏牌谱隔离 | 列表逐条隔离已覆盖 |
| 正常游戏与回放最终公开状态 | 有集成测试，但未覆盖杠后错误宝牌槽及所有公开区域 |

### 设置与存档

- 默认规则集中在 `defaultRuleConfig` 与 `defaultMatchRuleConfig`，预设通过 `createFullRuleConfig` 复制，不直接共享可变对象。
- `roundCount` 可迁移到 `matchCount`；东风、南风、1～4 场和最大延长风有测试。
- 配置读取对 JSON、缺失或无效字段回退默认；配置写入失败未捕获（STAB-008）。
- 存档版本、牌谱记录版本均为 1；未来 SavedMatch 被明确拒绝，未来裸 MatchLog 却会被接受，策略不一致（STAB-009）。
- 当前版本的旧存档只补了部分新字段，缺少 `appliedRoundIds`/`scoreHistory` 等可能在验证时异常（STAB-007）。

### 界面

- 上下牌河显式 6 列×3 行；第 19 张固定在第 3 行第 7 列形成横向延伸。左右牌河继续复用 13 个半格轨道并整体旋转。
- 立直牌用旋转和 1.5 倍视觉宽度，不改变上下牌河的显式行号；已有组件/布局测试。
- 禁打牌由 `allowedDiscardInstanceIds` 驱动暗化且不可点击，底层仍二次校验。
- 回放进度、结果合成步骤、倍速、自动停止和局切换已有测试。
- 小窗口仅有 CSS 文本契约测试，没有浏览器多分辨率截图/实际溢出测量。
- 结果、继续、退出和比赛结果弹窗声明 `aria-modal`，但没有统一 Escape、焦点圈定/恢复测试；背景点击策略也未形成明确契约（STAB-011）。

## 5. 缺失测试

1. 杠后逐次断言：新宝牌必须来自原王牌索引 6/8/10/12，里宝牌不能提前公开，活牌墙每杠缩短一张，四杠后余牌和流局时机正确。
2. 鸣牌后立即 `saveCurrentMatch` 并成功恢复；允许 claimed 牌河历史与副露别名，同时拒绝其他跨有效区域重复。
3. `getVisibleTileCounts` 对吃/碰/大明杠被鸣牌按 `instanceId` 只计一次。
4. 普通回放牌山抽屉中：对手未公开摸牌、未来活牌墙、未公开里宝全部牌背；本家已摸牌按当前主视角自知集合公开（STAB-003 已覆盖）。
5. 每个动作后的动态点数守恒，包括 27000 等自定义起始点、1～4 根供托、多家荣和、流局和残余供托。
6. 立直暗杠 UI 候选与 `canAnkan/executeKan` 对所有 34 种牌做差分一致性测试。
7. 当前版本旧存档逐字段删除测试，以及 localStorage 的 get/set/remove 分别抛错时 UI 不崩溃测试。
8. 未来/未知 MatchLog 与 ReplayRecord 的统一拒绝或只读降级测试。
9. 回放中央计分板、结果弹窗和牌谱元数据在多局、多家荣和、供托携带时逐项一致。
10. Playwright/浏览器人工分辨率矩阵：1366×768、1280×720、1024×768、900×600、560×800；弹窗焦点、Escape 和背景点击。

## 6. 发现的问题

### STAB-001 — P0 — 已修复（2026-08-01）— 杠后宝牌槽和牌山记账错误

- 复现条件（修复前）：任意暗杠、大明杠或加杠成功。
- 实际行为（修复前）：`applyKanDraw` 在已有 1 张宝牌指示时读取 `deadWall[5]`，随后 `deadWall.slice(1)` 令后续槽位继续漂移，且没有缩短活牌墙；回放也只移除岭上牌而不推进活牌边界。
- 预期行为：逐杠公开原王牌 6/8/10/12 槽；每次依次摸原王牌 0/1/2/3 槽并令可摸活牌数减少一张；里宝 5/7/9/11/13 槽始终独立。
- 根因：把会被 `slice` 移动的数组当前位置误当成固定物理槽位，并由正常游戏和回放分别维护不完整的杠后记账。
- 采用模型：保留原始 14 张王牌固定槽位；岭上 `0..3`，表宝 `4/6/8/10/12`，里宝 `5/7/9/11/13`。`advanceWallAfterKan` 统一返回下一岭上牌、下一表宝牌和缩短一张后的活牌墙；完整新状态不移动王牌，旧的已截短状态按长度安全推导原槽位。
- 相关文件：`src/game/wall.ts`、`src/game/kanChecker.ts`、`src/game/replay/roundReplay.ts`、`src/game/score/scoringAdapter.ts`、`src/components/ResultDialog.tsx`。
- 新增/强化测试：固定 `instanceId` 牌山连续四杠；初始及后续表宝、里宝隔离、岭上顺序/唯一性、每杠活牌减一、槽位不漂移；暗杠/大明杠/加杠共享结果；旧截短王牌状态安全推导；正常游戏与 `buildReplayState` 的四项状态一致；计分上下文读取固定里宝槽。
- 验证结果：杠/牌山相关 7 文件 45 项通过；回放相关 10 文件 51 项通过；最终全量 90 文件 622 项通过；`npm run build` 通过（TypeScript 与 Vite，155 modules transformed）。全量复跑期间，未改动的 AI 随机用例和可见牌随机牌山用例各瞬时失败一次，单文件复跑及最终全量均通过；本轮未修改这些非 STAB-001 测试或实现。
- 修复范围：仅统一 STAB-001 的牌山推进与表/里宝槽消费方；未改变杠合法性、抢杠、一发、四杠边界或计分规则。

### STAB-002 — P0 — 已修复（2026-08-01）— 合法鸣牌局面无法保存

- 复现条件（修复前）：吃、碰或大明杠后保存当前对局。
- 实际行为（修复前）：`validateSavedMatch` 把牌河历史和副露合并后无条件要求 instanceId 全唯一，因而拒绝合法的被鸣弃牌历史别名；同时没有覆盖活牌墙和王牌占用。
- 根因：存档验证器没有区分“当前有效占用”与“历史/派生引用”，只能进行扁平数组去重。
- 采用模型：`validateTileInstanceRegions` 将手牌、活牌墙、未使用王牌槽、副露和未 claimed 牌河视为有效占用；claimed 牌河及固定王牌中已使用的岭上槽视为历史，`drawnTile`、宝牌指示牌等视为派生引用。唯一例外是“一条 claimed 牌河历史 ↔ 一个匹配副露”。
- 精确约束：校验 `claimedBy` 等于副露玩家、`call.from` 等于弃牌玩家、吃仅限下家、开放状态和吃/碰/大明杠/加杠类型正确、牌实例/牌型一致；一个 claimed 实例不得对应多个历史或多个副露。
- 仍拒绝：手牌↔活牌墙、手牌↔王牌、手牌↔副露、不同副露、未 claimed 牌河↔副露，以及伪造 `claimedBy`、来源、鸣牌类型或 `calledTile`。
- 兼容行为：吃、碰、大明杠真实动作状态可保存并加载；加杠、暗杠和普通局面继续通过；恢复后的食替禁打集合、牌河 `claimed/claimedBy`、副露来源和被鸣实例保持一致。
- 相关文件：`src/game/tileInstanceValidation.ts`、`src/game/persistence/storageValidation.ts`、`src/game/persistence/storageValidation.test.ts`、`src/game/persistence/saveManager.test.ts`。
- 验证结果：相关 6 文件 51 项通过；最终全量 90 文件 644 项通过；`npm run build` 通过（TypeScript 与 Vite，156 modules transformed）。全量首次运行遇到审计中已记录的可见牌随机牌山用例瞬时波动，单文件复跑及最终全量通过；本轮未修改该非 STAB-002 用例或实现。
- 修复范围：仅替换存档的实例区域校验并增加回归测试；未改变吃碰杠合法性、食替规则或 SavedMatch 格式版本。

### STAB-003 — P0 — 已修复（2026-08-01）— 普通牌谱牌山抽屉泄漏对手暗摸牌

- 复现条件（修复前）：普通视角（未开启全牌公开）打开牌山抽屉，并前进到对手已摸但尚未公开该牌的步骤。
- 实际行为（修复前）：`WallRow` 使用 `consumed || publicTile` 决定传入正面 tile；任何从活牌墙或岭上槽摸走的牌都会立即翻面。
- 根因：组件把“已离开牌山”的记账状态误作“已公开”的显示权限，且牌山抽屉没有接收当前主视角玩家。
- 采用模型：`consumedIds` 只控制“已摸走”槽位状态；公开集合按 `instanceId` 从牌河、副露、已公开宝牌及局终公开手牌构建；当前主视角玩家手牌形成独立自知集合；未消费槽位除公开宝牌外始终保持牌背，全牌公开是唯一全量覆盖开关。
- 精确约束：公开同牌型的另一物理实例不会使暗摸实例翻面；弃牌和吃/碰/大明杠只公开其实际引用的实例；切换玩家视角后重新计算自知集合；未来活牌墙与未公开里宝在普通视角继续隐藏。
- 兼容行为：仅把 `cameraPlayerId` 从 `ReplayScreen` 传至牌山抽屉，不修改 `ReplayRecord`、`ReplayAction`、`RoundLog` 或任何牌谱存储格式。
- 新增测试：回放组件测试净增 8 项并改写原“已摸走即显示正面”期望，覆盖对手摸后弃前、弃后公开、吃/碰/大明杠、同牌型不同实例、未来牌墙、未公开里宝、全牌公开、四家视角权限及前进/后退重复构建。
- 相关文件：`src/components/ReplayWallPanel.tsx`、`src/components/ReplayWallDrawer.tsx`、`src/components/ReplayScreen.tsx`、`src/components/ReplayScreen.test.tsx`、`src/components/ReplayLayout.test.tsx`。
- 验证结果：相关回放 10 文件 59 项通过；最终全量 90 文件 652 项通过；`npm run build` 通过（TypeScript 与 Vite，156 modules transformed）。
- 修复范围：仅分离牌山消费状态与显示权限并传递主视角；未改变回放重建、牌谱数据、规则或计分语义。

### STAB-004 — P1 — 被鸣弃牌在玩家可见牌统计中重复计数

- 复现条件：任意吃、碰或大明杠后查看牌数统计/牌理分析。
- 实际行为：`visibility.ts` 分别累加牌河和副露，未按 instanceId 去重；同一 claimed 弃牌计两次。AI 的独立统计实现反而会去重。
- 预期行为：保留牌河历史但每张物理牌只计一次可见数量。
- 疑似根因：AI 和 UI 维护了两套可见牌统计，只有 AI 版本有 `seenInstances`。
- 相关文件：`src/game/visibility.ts`、`src/game/ai.ts`、`src/components/AnalysisPanel.tsx`、`src/components/TileCounter.tsx`。
- 建议测试：吃/碰/杠分别断言被鸣牌可见数只增加一次且 remaining 不为负。
- 建议修复范围：抽取共享按实例去重的公开计数函数，让 AI 与 UI 共用。

### STAB-005 — P1 — 和牌局终瞬间供托未清零，点数守恒失败

- 复现条件：桌上有供托时荣和或自摸。
- 实际行为：和牌者 `pointDeltas` 已获得供托，但 `engine.settleRound`/`settleKanRound` 仍保留原 `riichiSticks`；此时 `sum(playerScores) + sticks*1000` 多出已发放供托，中央供托显示也可能滞留到点击继续。
- 预期行为：结算后的权威状态满足动态起始总点数守恒；若弹窗需要展示结算前供托，应使用独立快照字段。
- 疑似根因：把“结果展示所需的结算前供托”与“结算后的当前供托”放在同一字段。
- 相关文件：`src/game/engine.ts`、`src/game/kanChecker.ts`、`src/game/winChecker.ts`、`src/components/ResultDialog.tsx`。
- 建议测试：1～4 根供托的荣和、自摸、抢杠和多家荣和，在局终状态及进入下一局后都断言精确守恒。
- 建议修复范围：结算器统一清零权威供托，并为展示显式保存 settlement sticks；同步事件记录/回放。

### STAB-006 — P1 — 立直暗杠的 UI 与底层合法性算法不一致

- 复现条件：立直后摸到形成暗杠的牌，尤其摸牌属于四张同牌之一。
- 实际行为：`interaction.ts` 自行实现等待保持判定，直接在含摸入牌的 14 张手牌上算 before waits；`kanChecker.ts` 会先按条件移除摸入牌再算。按钮候选可能出现但执行被拒绝，或合法暗杠不显示。
- 预期行为：按钮候选、AI和 `executeKan` 使用同一个合法性函数并完全一致。
- 疑似根因：同一规则被复制实现。
- 相关文件：`src/game/interaction.ts`、`src/game/kanChecker.ts`、`src/components/Board.tsx`。
- 建议测试：生成所有立直听牌+摸入四张组合，差分断言 UI candidates 等于 `canAnkan`，点击后必推进。
- 建议修复范围：导出并复用 kanChecker 的单一判定；删除重复算法前先锁定测试语义。

### STAB-007 — P2 — 当前版本旧存档只补部分新增字段

- 复现条件：加载 version 1、但生成于 `appliedRoundIds`/`scoreHistory` 等字段加入之前的存档，或缺少整个规则子对象。
- 实际行为：迁移只补 `currentMatchIndex`、`matchResults`、`aggregateScores`；后续 `new Set(state.appliedRoundIds)` 或直接访问 `current.ruleConfig.round` 可抛异常。
- 预期行为：同版本缺失新字段安全填默认，或返回可展示的明确不兼容错误，不使继续入口异常。
- 疑似根因：版本号未随结构演进，迁移默认集合不完整。
- 相关文件：`src/game/persistence/migration.ts`、`src/game/match/matchEngine.ts`、`src/game/persistence/migration.test.ts`。
- 建议测试：对 SavedMatch 每个后加字段逐项删除后迁移/验证。
- 建议修复范围：集中定义 v1 归一化默认值；不提升格式版本也要保持字段级兼容。

### STAB-008 — P2 — 设置写入 localStorage 失败会逃逸到事件处理器

- 复现条件：浏览器禁用存储、配额耗尽或 `setItem` 抛 SecurityError。
- 实际行为：`saveStoredRuleConfig` 不捕获异常，`handleRuleConfigChange` 直接调用；设置交互可能产生未处理异常。当前对局 SaveManager 有错误状态，但规则设置没有。
- 预期行为：内存设置仍可使用，并显示/记录保存失败而不崩溃。
- 疑似根因：读取路径有 try/catch，写入路径没有对称处理。
- 相关文件：`src/game/match/matchRules.ts`、`src/App.tsx`。
- 建议测试：注入抛错 Storage，断言 UI 更新且错误被隔离。
- 建议修复范围：为规则配置保存返回结果/错误；由 App 展示非阻断提示。

### STAB-009 — P2 — 未知牌谱版本策略不一致

- 复现条件：导入未来版本裸 MatchLog 或未来 ReplayRecord。
- 实际行为：ReplayRecord version 非 1 被拒绝，但 `validateMatchLog` 只拒绝 `<1`，未来 log version 会继续按当前结构解释。
- 预期行为：未知版本统一明确拒绝、只读降级或标记损坏，不能静默误解。
- 疑似根因：记录层和日志层分别维护版本判断。
- 相关文件：`src/game/replay/validation.ts`、`src/game/persistence/storageValidation.ts`、`src/game/persistence/replayRecord.ts`。
- 建议测试：version 0、当前、当前+1 在裸日志和包装记录两条入口行为一致。
- 建议修复范围：统一版本兼容策略与错误类型，不改既有 v1 结构。

### STAB-010 — P2 — 固定种子完整对局不可复现

- 复现条件：尝试以相同 seed 重放自动对局。
- 实际行为：AI选择函数可注入 rng，但洗牌固定读 `Math.random`、实例 ID 读 `crypto.randomUUID`，日志 `seed` 未使用；没有统一随机源。
- 预期行为：相同规则、seed 和动作策略生成相同牌墙、动作序列与最终公开状态。
- 疑似根因：随机源未成为比赛初始化依赖。
- 相关文件：`src/game/wall.ts`、`src/game/tileUtils.ts`、`src/game/ai.ts`、`src/game/replay/types.ts`。
- 建议测试：同 seed 两次跑完整局日志深相等，不同 seed 至少牌墙不同。
- 建议修复范围：后续压力测试工程中注入统一 PRNG；生产默认仍可使用安全随机源。

### STAB-011 — P3 — 弹窗键盘与焦点行为未形成统一契约

- 复现条件：结果、继续、退出或比赛结果弹窗打开后使用 Tab/Escape，或尝试操作背景。
- 实际行为：组件有 `aria-modal`，但没有统一焦点圈定、初始焦点、关闭后焦点恢复和 Escape 规则；背景点击是否关闭也不一致/未测试。
- 预期行为：焦点不进入背景；Escape 和背景点击按每类弹窗明确行为；关闭后回到触发控件。
- 疑似根因：弹窗是多个独立 section，没有共享 dialog primitive。
- 相关文件：`src/components/ResultDialog.tsx`、`ContinueMatchDialog.tsx`、`ExitGameDialog.tsx`、`MatchResultDialog.tsx`。
- 建议测试：浏览器级键盘、焦点、背景点击和不可关闭结算弹窗矩阵。
- 建议修复范围：后续单独界面任务引入共享交互层，不改计分/推进逻辑。

## 7. 风险分级

| 级别 | 数量 | 编号 |
| --- | ---: | --- |
| P0 | 0 个未解决（3 个已修复） | STAB-001、STAB-002、STAB-003 已修复 |
| P1 | 3 | STAB-004、STAB-005、STAB-006 |
| P2 | 4 | STAB-007、STAB-008、STAB-009、STAB-010 |
| P3 | 1 | STAB-011 |

## 8. 建议修复顺序

1. STAB-001：已完成；固定王牌槽、活牌墙边界及正常游戏/回放差分测试均已落地。
2. STAB-002：已完成；鸣牌存档恢复及共享实例区域验证器均已落地。
3. STAB-003：已完成；牌山消费状态与按实例公开权限已分离，未改变数据格式。
4. STAB-005 与 STAB-004：统一点数守恒和可见计数共享函数。
5. STAB-006：消除立直暗杠重复判定，补差分测试。
6. STAB-007～010：完成旧数据、存储失败、版本和随机源基础设施。
7. STAB-011：作为独立 UI 可访问性修复，不与规则核心混改。

每个 P0 建议独立提交并完整运行 `npm test`、`npm run build`；在 stress harness 可用后追加固定失败种子回归。

## 9. 建议新增的压力测试

项目当前没有已跟踪 `scripts/`、自动对局器或随机合法动作 harness；本轮按要求未实现，也未声称运行 500 局。

后续方案：

1. 建立测试专用 `SeededRng`，同时注入洗牌、AI决策和可预测实例 ID；每次运行记录 seed、规则配置和动作索引。
2. 合法动作枚举器只调用现有 `can*`/候选函数；执行后若状态未变化则视为“候选与执行器分歧”。
3. 每个动作后验证：
   - 有效区域 instanceId 唯一；claimed 牌河历史只能精确别名到一个副露；
   - 每种 tile.id 物理实例不超过 4，赤牌实例不丢失；
   - `sum(scores)+riichiSticks*1000 === startingPoints*4`；
   - 当前 phase 至少有一种合法推进或已终局；
   - pendingCall/pendingRon/pendingKakan 与 phase 一致；
   - 活牌墙、王牌、手牌、牌河、副露的总实例集合保持 136 张守恒（历史别名去重）。
4. 第一阶段固定规则跑至少 500 局；第二阶段覆盖东/南、头跳、三家和、食替、不同最大延长风和自定义起始点的参数组合。
5. 失败产物写 JSON：seed、初始规则、动作列表、首个失败不变量、前后状态摘要；不得包含不可序列化对象。
6. 使用 delta debugging 删除无关动作/局，输出最短复现；失败 seed 固化为普通 Vitest 回归。
7. 另做 500 次回放差分：真实动作每步公开投影与 `buildReplayState` 同步比较，最后比较分数、供托、公开手牌、牌河、副露、宝牌和结果。

## 10. 人工验收清单

- [ ] 固定王牌顺序执行暗杠/大明杠/加杠，逐张核对表宝牌、里宝位置、岭上牌和余牌数。
- [x] 吃、碰、大明杠后退出保存，再继续对局；牌河历史、副露和禁打状态正确（自动化保存/加载回归已覆盖）。
- [ ] 1～4 根供托下分别荣和、自摸、多家荣和，核对中央点数、供托、结果弹窗和下一局。
- [ ] 普通回放分别从四家视角打开牌山；对手暗摸、未来牌山、未公开里宝不可见；全公开开关后可见（组件回归已覆盖，仍建议人工抽查）。
- [ ] 回放执行“下一步→上一步→下一步”并跨结果步骤，分数和弹窗不重复。
- [ ] 立直后暗杠候选逐个点击，所有显示候选都能执行，所有禁止候选都不可点击。
- [ ] 上下牌河第 18、19、20 张布局；立直横牌和被鸣留空开关均不改变换行契约；左右牌河保持原方向。
- [ ] 1366×768、1280×720、1024×768、900×600、560×800 无关键控件溢出或遮挡。
- [ ] 禁用 localStorage、配额满和损坏单条牌谱时，设置、退出和牌谱库均可继续操作并显示可理解错误。
- [ ] 结果/退出/继续弹窗用 Tab、Shift+Tab、Escape 和背景点击验收焦点与关闭策略。

结论：基线测试与构建健康；STAB-001、STAB-002、STAB-003 三个 P0 均已修复并通过全量回归。下一修复阶段建议按风险顺序处理 STAB-005、STAB-004 与 STAB-006；其余人工验收与压力测试仍应完成后再认定稳定发布候选。

## 确定性人工测试场景基础设施

已新增开发者专用测试模式和带版本号的 `TestScenarioV1`。它可严格校验并加载内置或导入场景，在真实牌桌、正式规则入口和正式事件记录器上继续操作；支持重置、当前状态导出、测试牌谱导出、状态摘要、全牌公开、控制玩家切换、单步 AI、实时不变量检查，以及从具有完整牌墙数据的牌谱步骤转换。

内置 `STAB-001-ANKAN`、`STAB-001-MINKAN`、`STAB-001-KAKAN`、`STAB-001-FOUR-KANS` 四个稳定实例 ID 场景，用于人工复查 STAB-001 的固定 14 张王牌槽位、岭上顺序、表/里宝隔离和杠后活牌边界。测试模式与普通继续游戏存档隔离，生成牌谱标记为 `source=test-mode`。使用与验收方法见 `docs/TEST_MODE.md`。

本基础设施不改变任何现有规则语义，也不改变本报告中任何 STAB 问题的修复状态。
