# 全量稳定性审查第一轮

审查日期：2026-08-01（Asia/Shanghai）  
审查对象：`C:\Users\Wenkai\Desktop\UNSW\local mahjong`  
审查边界：只读审查生产代码与现有测试；未修改生产代码、规则语义或测试。

> 最终复审状态（2026-08-01）：STAB-001～STAB-012 均已关闭，未解决风险 P0/P1/P2/P3 均为 0。下方第一轮基线、问题复现和各次修复验证数字作为历史记录保留；当前权威基线、连续测试和 Release Candidate 结论见 `docs/STABILITY_AUDIT_FINAL.md`。

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
| 状态推进 | `engine.ts`、`types.ts` | `App.tsx`/`Board.tsx` | `ai.ts` | `eventRecorder.ts`/`roundReplay.ts` | 共享结算保存结算前供托快照并立即清零桌面供托，动态点数守恒 |
| 吃碰食替 | `chiChecker.ts`、`callChecker.ts`、`kuikae.ts` | 共享执行函数 | 共享执行函数 | `roundReplay.ts` 独立归约 | 底层会拦截非法弃牌；存档和公开计数均已支持受控历史别名 |
| 杠/抢杠 | `kanChecker.ts` | `executeKan` | 同一入口 | 事件归约 | 固定 14 张王牌槽位与共享杠后推进已覆盖正常游戏/回放 |
| 和牌/振听 | `winChecker.ts`、`furiten.ts` | 荣和/自摸入口 | AI 自动荣和路径 | 结果事件 | 无役与振听有共享校验；多家荣和有测试 |
| 计分 | `scoreCalculator.ts`、`score/*` | `winChecker.ts` | 间接共享 | 记录结果为准 | 覆盖广；本轮不重审每个役种数学证明 |
| 比赛推进 | `matchEngine.ts`、`roundTransition.ts` | 局结果继续按钮 | AI 终局选择 | 最终结果记录 | 重复局结果有 ID 防护；点数校验容差过宽 |
| AI | `ai.ts`、`shanten.ts` | — | 合法候选后调用共享执行器 | — | 不读墙/对手暗手；测试可注入固定 `RandomSource` 完整复现 |
| 牌谱 | `replay/*`、`ReplayScreen.tsx` | 事件记录 | — | 确定性重建与视角显示 | 重建纯函数较好；牌山抽屉隐藏权限已按实例与主视角修复 |
| 设置/存档 | `matchRules.ts`、`persistence/*` | `App.tsx` | — | localStorage | v1 后增字段集中归一化；规则存储错误通过可注入适配器隔离并返回结果 |
| 界面 | `components/game/*`、`styles.css` | 按钮和牌桌 | — | 回放复用牌桌 | 牌河布局有结构测试；四类弹窗已共享键盘与焦点契约 |

## 3. 已验证的不变量

- 新牌由 `createTile` 生成独立 `instanceId`；发牌、摸牌、弃牌和副露都按实例移动。
- 被鸣弃牌在牌河中以 `claimed/claimedBy` 保留历史，同时副露保留同一实例；UI、TileCounter 与 AI 统一通过 `getVisibleTileCounts` 按 `instanceId` 去重，并保留全部来源区域。
- `discardTile` 在最底层调用 `canDiscardTileByRules`，食替禁打不能通过 UI 或 AI 绕过。
- 正常比赛点数基线由 `startingPoints * 4` 动态计算；`createMatch`、多场重置和 `validateMatchState` 未硬编码 100000。默认回放测试中的 100000 仅代表默认四家 25000。
- 新局通过全新 `GameState` 清空牌河、副露、立直/一发、临时振听、鸣牌窗口、抢杠窗口、当前摸牌引用、食替集合和局结果；`nextRoundReset.test.ts` 覆盖主要字段。
- `appliedRoundIds` 可阻止带稳定 `roundId` 的同一局结果重复应用；比赛结束后 `startNextRound` 不再启动新局。
- 赤五与普通五共享 `tile.id` 牌型语义，同时保留 `red` 与 `instanceId`；牌图、AI候选和计分均有相关测试。
- 荣和/自摸调用 `evaluateWin` 后以 `hasRealYaku` 排除仅宝牌无役；振听候选使用同一正式计分上下文。
- `buildReplayState` 每次从局初快照归约到目标步骤，不复用上次可变结果；现有测试覆盖重复构建、前后步进、序列化和旧牌谱无牌山降级。
- 回放视角通过 `TableSeatMapping` 旋转玩家映射；全牌公开是独立布尔状态，普通牌桌对手手牌保持牌背。
- 损坏牌谱在列表层逐条隔离为 `corrupted` 元数据，不会阻断整个列表。

### 第一轮核心状态缺口的关闭状态

- 已由 `validateTileInstanceRegions` 统一区分有效占用与 claimed 牌河历史，并精确限制“claimed river tile ↔ 唯一对应 call”别名（STAB-002）。
- 测试模式逐动作不变量与结算回归验证 `sum(scores) + riichiSticks * 1000 === startingPoints * 4`，包括自定义起始点和供托（STAB-005、STAB-010）。
- 新局重置、食替/振听/立直临时状态及结果状态已有字段级回归；局终由 `appliedRoundIds` 防止重复应用。
- 正常和牌与杠相关和牌统一调用 `settleRoundState`，供托快照和权威状态使用相同语义（STAB-005）。

## 4. 现有测试覆盖

### 规则调用矩阵

| 审查项 | 实现入口 | 共享校验函数 | 正常游戏调用 | AI 调用 | 回放调用 | 已有测试 | 缺失/风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 吃 | `getChiOptions`/`executeChi` | `canChi`、`hasTiles`、食替函数 | `App`→`executeChi` | `findUsefulChiOption`→同入口 | `applyCall` | `chiChecker.test.ts` | 回放不复验事件合法性，只按日志归约 |
| 碰 | `getPonOptions`/`executePon` | `canPon`、`removeTilesByType` | `App`→`executePon` | 同入口 | `applyCall` | `callChecker.test.ts` | 合法被鸣历史在存档验证中被当重复实例 |
| 杠 | `executeKan` 及三类分支 | `canAnkan/Minkan/Kakan`、`advanceWallAfterKan` | `App`→同入口 | 同入口 | `roundReplay`→同推进函数 | `kanChecker`、`wallFlow`、`riichiAnkanLegality`、回放测试 | 固定槽位、四杠、活牌缩短及正常/回放差分已覆盖 |
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
| 本场/连庄/供托 | `matchEngine.ts`、`roundTransition.ts`、`settleRoundState` | `dealerContinuesFromResult` | 继续按钮 | AI终局选择 | `roundReplay` | match/round/finalRanking/settlement 测试 | 和牌立即清零桌面供托，流局保留；结果快照与回放一致 |
| 最大延长场风 | `maxExtraWindIndex`、`evaluateEndOfMatch` | `isExtraRound`/`reachedMaxExtraRound` | 比赛推进 | 同状态机 | 最终结果 | `endConditions`、`roundTransition` | north 边界与连庄跨最大场风组合不足 |
| 东风/南风/多场 | `matchRules`、`matchEngine` | `scheduledFinalWind`、`matchCount` | 设置→比赛 | 同状态机 | 元数据 | `matchIntegration`、`multi-match` | 多场中断保存恢复和旧配置迁移组合不足 |

### AI 合法性

- `selectAIDiscardTile` 先取 `legalDiscardTiles`，再与立直候选实例求交；食替与立直候选均不能由推荐结果扩大。
- AI 吃碰杠均调用正常游戏的 `execute*`，底层再次执行 `can*`；弃牌最终由 `discardTile` 防御。
- AI 可见信息只包括各家牌河、公开副露、宝牌指示和自身手牌，并按实例去重；未读取对手暗手、活牌墙、王牌或里宝牌。
- `recommendDiscards` 接收食替禁打类型，最终实例仍由共享 `legalDiscardTiles` 限定。
- 随机性：生产默认继续使用安全随机路径；测试通过统一 `RandomSource` 注入洗牌、AI选择和稳定实例 ID，相同规则/seed/策略可复现完整对局（STAB-010）。
- 立直暗杠等待保持已集中到 `kanChecker.ts`；交互、Board、AI 与执行入口共享合法候选和等待快照（见 STAB-006）。

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
| 旧牌谱降级 | 缺牌山可安全降级；ReplayRecord、裸 MatchLog 与存档共用 v1 版本策略，未来版本明确拒绝 |
| 损坏牌谱隔离 | 列表逐条隔离已覆盖 |
| 正常游戏与回放最终公开状态 | 集成与杠后差分测试覆盖宝牌、里宝、岭上、活牌余量和公开区域 |

### 设置与存档

- 默认规则集中在 `defaultRuleConfig` 与 `defaultMatchRuleConfig`，预设通过 `createFullRuleConfig` 复制，不直接共享可变对象。
- `roundCount` 可迁移到 `matchCount`；东风、南风、1～4 场和最大延长风有测试。
- 规则配置读、写、删除均通过可注入适配器返回统一结果；存储失败不阻断内存设置并显示提示（STAB-008 已修复）。
- SavedMatch、ReplayRecord 与裸 MatchLog 共用集中版本策略：当前 v1 正常读取，旧版仅允许明确迁移器，未来版本统一拒绝（STAB-009 已修复）。
- version 1 旧存档在加载前统一补齐比赛进度、GameState/PlayerState 后增字段及完整规则子对象；无法安全恢复的核心结构返回明确不兼容错误（STAB-007 已修复）。

### 界面

- 上下牌河显式 6 列×3 行；第 19 张固定在第 3 行第 7 列形成横向延伸。左右牌河继续复用 13 个半格轨道并整体旋转。
- 立直牌用旋转和 1.5 倍视觉宽度，不改变上下牌河的显式行号；已有组件/布局测试。
- 禁打牌由 `allowedDiscardInstanceIds` 驱动暗化且不可点击，底层仍二次校验。
- 回放进度、结果合成步骤、倍速、自动停止和局切换已有测试。
- STAB-012 已补齐正式桌面视口契约、共享逻辑画布和浏览器多分辨率溢出测量；范围外尺寸统一显示窗口过小提示。
- 结果、继续、退出和比赛结果弹窗已统一使用共享 `Dialog`：初始焦点、Tab圈定、焦点恢复、滚动/背景锁定及按业务类型配置的 Escape/背景点击均有明确契约（STAB-011 已修复）。

## 5. 第一轮缺失测试的关闭状态

1. [x] 固定王牌槽、逐杠表/里宝、岭上顺序、活牌缩短和四杠边界（STAB-001）。
2. [x] 吃/碰/大明杠保存恢复及严格历史别名矩阵（STAB-002）。
3. [x] 吃/碰/大明杠公开牌按 `instanceId` 去重（STAB-004）。
4. [x] 普通回放暗摸、未来墙、未公开里宝、视角和全公开权限（STAB-003）。
5. [x] 自定义起始点、1～4 根供托、多家荣和及流局的动态点数守恒（STAB-005、STAB-010）。
6. [x] 立直暗杠 UI/AI/执行器对 34 种牌型的差分一致性（STAB-006）。
7. [x] v1 后增字段逐字段删除及规则存储 get/set/remove 异常（STAB-007、STAB-008）。
8. [x] ReplayRecord、裸 MatchLog、存档和导入器统一拒绝无迁移器旧版与未来版（STAB-009）。
9. [x] 供托结算的局终、结果弹窗、事件记录和回放状态一致（STAB-005）。
10. [x] 真实浏览器正式桌面分辨率矩阵（STAB-012）；屏幕阅读器和完整键盘人工矩阵仍待人工完成，组件级焦点/关闭契约已自动覆盖（STAB-011）。

## 6. 发现的问题

本节保留第一轮原始问题、修复前行为和各修复节点的当时测试数字作为审计轨迹；当前关闭状态与最终基线以 `docs/STABILITY_AUDIT_FINAL.md` 为准。

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

### STAB-004 — P1 — 已修复（2026-08-01）— 被鸣弃牌在玩家可见牌统计中重复计数

- 复现条件（修复前）：任意吃、碰或大明杠后查看牌数统计/牌理分析。
- 实际行为（修复前）：`visibility.ts` 分别累加牌河和副露，未按 `instanceId` 去重；同一 claimed 弃牌计两次，大明杠甚至可得到 `visible=5`、`remaining=-1`。AI 的独立统计实现反而会去重。
- 根因：AI 和 UI 维护两套可见牌统计，只有 AI 版本维护 `seenInstances`；UI 按区域直接累加，未表达 claimed 牌河历史与副露的受控别名。
- 修复语义：`getVisibleTileCounts` 先按 `instanceId` 建立唯一公开实例，再按 `tile.id` 汇总；同一实例可记录牌河与副露等多个来源，但仅计一次。不同物理实例分别计数，赤五与普通五共享 `tile.id`，并保留每个实例的 `red` 标记。
- 边界保护：每种牌 `visibleCount` 最大为 4，`remainingCount` 最小为 0；损坏状态中的第五个独立实例仍可在明细中诊断，但不会产生非法计数。
- 共享调用：分析面板与 `TileCounter` 继续调用 `getVisibleTileCounts`；AI 的 `getVisibleCountsForPlayer` 改为直接映射同一函数，不再维护第二套遍历逻辑。
- 新增测试：吃、碰、大明杠 claimed 历史别名；同牌型不同实例；赤五/普通五；上限与非负保护；四家视角下 AI/UI 结果一致；四个确定性测试模式场景及调试来源表。
- 相关文件：`src/game/visibility.ts`、`src/game/visibility.test.ts`、`src/game/ai.ts`、`src/game/testMode/stab004Cases.ts`、`src/components/TestModeDebugPanel.tsx`。
- 验证结果：相关 4 文件 57 项通过；最终全量 94 文件 703 项通过；`npm run build` 通过（TypeScript 与 Vite，169 modules transformed）。
- 修复范围：仅统一可见牌统计及诊断展示；未修改副露、牌河、存档结构或规则语义。

### STAB-005 — P1 — 已修复 — 和牌局终瞬间供托未清零，点数守恒失败

- 复现条件：桌上有供托时荣和或自摸。
- 实际行为：和牌者 `pointDeltas` 已获得供托，但 `engine.settleRound`/`settleKanRound` 仍保留原 `riichiSticks`；此时 `sum(playerScores) + sticks*1000` 多出已发放供托，中央供托显示也可能滞留到点击继续。
- 预期行为：结算后的权威状态满足动态起始总点数守恒；若弹窗需要展示结算前供托，应使用独立快照字段。
- 疑似根因：把“结果展示所需的结算前供托”与“结算后的当前供托”放在同一字段。
- 相关文件：`src/game/engine.ts`、`src/game/kanChecker.ts`、`src/game/winChecker.ts`、`src/components/ResultDialog.tsx`。
- 建议测试：1～4 根供托的荣和、自摸、抢杠和多家荣和，在局终状态及进入下一局后都断言精确守恒。
- 建议修复范围：结算器统一清零权威供托，并为展示显式保存 settlement sticks；同步事件记录/回放。
- 修复状态：已修复。新增共享 `settleRoundState`，正常结算与杠相关结算统一调用；和牌结果写入可选 `settlementRiichiSticks` 快照后立即将权威 `GameState.riichiSticks` 清零，流局继续保留桌面供托。
- 展示与回放：`ResultDialog` 默认读取结果快照；新事件直接记录该字段，旧牌谱缺失字段时 `buildReplayState` 从结算前状态安全推导并写回重建结果。
- 新增测试：1～4根供托荣和/自摸、抢杠和、多家荣和、27000自定义起点、流局保留、事件记录、回放重建、结果弹窗及进入下一局前后动态点数守恒；测试模式新增五个 STAB-005 确定性结算用例。
- 最终验证：相关回归 7 个文件、64 项通过；全量 `npm test` 为 93 个测试文件、695 项通过；`npm run build` 通过（TypeScript 与 Vite，168 modules transformed）。

### STAB-006 — P1 — 已修复（2026-08-01）— 立直暗杠的 UI 与底层合法性算法不一致

- 复现条件（修复前）：立直后摸到形成暗杠的牌，尤其摸入牌属于四张同牌之一。
- 实际行为（修复前）：`interaction.ts` 直接在含摸入牌的 14 张手牌上计算杠前等待；`kanChecker.ts` 会在摸入牌属于暗杠牌型时先移除一张再计算。确定性差分夹具中，交互层判为禁止而底层判为允许。
- 根因：等待保持规则在交互层和底层各实现一次，且对摸入牌的基准手牌定义不同。
- 共享实现：`kanChecker.ts` 导出 `evaluateRiichiAnkanWaits`、`isRiichiAnkanWaitPreserving` 和 `getLegalAnkanCandidates`。等待快照、合法候选与 `canAnkan` 由单一实现生成；`interaction.ts` 删除本地等待算法，Board 通过交互动作状态消费共享候选，AI 使用同一合法候选集合，`executeKan` 在任何状态复制前再次调用共享校验。
- 规则语义：保留原底层算法作为权威语义。摸入牌属于四张之一时，杠前等待按移除该摸入牌后的 13 张计算；杠后按移除四张并固定一个面子计算。没有改变等待保持标准、杠后流程、一发或计分。
- 状态安全：等待改变或不存在四张同牌时不产生 UI/AI 候选；显式执行失败返回原 `GameState` 引用，且深度状态保持不变。
- 新增测试：当前实现下先失败的摸入牌差分；34 种牌型参数化差分；等待保持/改变、摸入牌在四张内/外、无合法暗杠；UI候选、AI候选、`canAnkan` 与执行结果双向一致；真实 Board 按钮和四个测试模式场景。
- 相关文件：`src/game/kanChecker.ts`、`src/game/interaction.ts`、`src/game/ai.ts`、`src/game/riichiAnkanLegality.test.ts`、`src/game/testMode/stab006Cases.ts`、`src/components/TestModeDebugPanel.tsx`。
- 验证结果：相关 7 文件 118 项通过；最终全量 95 文件 743 项通过；`npm run build` 通过（TypeScript 与 Vite，170 modules transformed）。
- 修复范围：仅统一立直暗杠等待保持与合法候选；未修改其他杠规则、立直规则语义、牌谱或存档格式。

### STAB-007 — P2 — 已修复（2026-08-01）— 当前版本旧存档只补部分新增字段

- 复现条件（修复前）：加载 version 1、但生成于 `appliedRoundIds`/`scoreHistory`、GameState 临时字段或完整规则子对象加入之前的存档。
- 实际行为（修复前）：迁移只补 `currentMatchIndex`、`matchResults`、`aggregateScores`；后续 `new Set(state.appliedRoundIds)` 或直接访问 `current.ruleConfig.round` 可抛异常。
- 根因：格式版本保持为 1，但迁移默认集合未随结构演进同步，且在归一化前直接解引用可选规则对象。
- 共享实现：`SAVED_MATCH_V1_DEFAULTS` 集中声明比赛进度、GameState 与 PlayerState 默认结构；`migrateSavedMatch` 同步归一化顶层对局和 `matchState.currentGame`，并通过 `createFullRuleConfig` 补齐完整 round/match 规则。
- 补齐字段：`appliedRoundIds`、`scoreHistory`、`currentMatchIndex`、`matchResults`、`aggregateScores`；pending call/ron/kakan、杠状态、首巡/计数/摸牌来源/食替等 GameState 字段；玩家振听与立直横牌待顺延状态；所有当前规则字段。
- 兼容与安全：仅补 `undefined`，不覆盖旧存档已有合法值；核心 matchState、matchLog、分数、牌墙、王牌或事件数组无法安全恢复时抛出可展示的 `SavedMatchCompatibilityError`，畸形 JSON 也转换为同类错误。格式版本仍为 1。
- 新增测试：每个后增字段、两份 GameState、玩家字段及规则字段逐项删除的参数化迁移/验证；缺失整个嵌套规则对象；保留已有合法值；最小可恢复 v1；损坏核心结构和 JSON 的明确拒绝；四个测试模式存档兼容用例。
- 测试模式：四个用例显示迁移前字段、迁移后字段及验证结果，全部使用测试中心注入数据，不写普通继续游戏存档。
- 相关文件：`src/game/persistence/migration.ts`、`src/game/persistence/migration.test.ts`、`src/game/persistence/saveManager.ts`、`src/game/persistence/saveManager.test.ts`、`src/game/testMode/stab007Cases.ts`、测试模式注册/UI及文档。
- 验证结果：相关存档 3 文件 126 项通过；最终全量 95 文件 838 项通过；`npm run build` 通过（TypeScript 与 Vite，171 modules transformed）。
- 修复范围：仅 v1 读取归一化、兼容错误和测试模式回归；未改变存档格式版本、规则语义或普通存档键。

### STAB-008 — P2 — 已修复（2026-08-01）— 设置写入 localStorage 失败会逃逸到事件处理器

- 复现条件（修复前）：浏览器禁用存储、配额耗尽，或 `getItem`/`setItem`/`removeItem` 抛出异常。
- 实际行为（修复前）：读取异常被静默回退，写入异常直接逃逸出 `handleRuleConfigChange`；设置页可能崩溃且没有保存失败提示。
- 根因：规则配置存储只注入单个方法，没有统一适配器、结果类型与错误分类；读写路径的异常契约不对称。
- 共享实现：新增 `RuleConfigStorageAdapter`、`RuleConfigStorageError` 和统一读/写/删除结果；错误记录 `read`/`write`/`remove` 操作及 `security`/`quota`/`invalid-data`/`unknown` 类型。
- 设置语义：`persistRuleConfigUpdate` 始终返回本次内存配置；写入失败时不覆盖或删除原持久化配置，并返回非阻断提示。App 设置页立即使用新配置，显示“已应用但无法保存”，普通成功路径不显示提示。
- 测试模式：新增 GET、SET SecurityError、SET QuotaExceededError、REMOVE 四个隔离用例，以及“模拟存储失败”面板；所有故障只注入测试内存适配器，不访问全局 `window.localStorage`。
- 新增测试：读取统一错误；三类写入失败不抛异常、内存配置生效、原值保留；删除失败保留原值；成功写入/读取/删除；四个测试模式用例与面板静态隔离检查。
- 相关文件：`src/game/match/matchRules.ts`、`src/game/match/matchRules.test.ts`、`src/App.tsx`、`src/game/testMode/stab008Cases.ts`、测试模式注册/UI及文档。
- 验证结果：相关 4 文件 77 项通过；最终全量 95 文件 846 项通过；`npm run build` 通过（TypeScript 与 Vite，172 modules transformed）。
- 修复范围：仅规则设置存储适配器、失败提示和测试模式模拟；未修改普通对局存档、规则语义或格式版本。

### STAB-009 — P2 — 已修复（2026-08-01）— 未知牌谱版本策略不一致

- 复现条件（修复前）：导入未来版本裸 MatchLog，或让未来版本 ReplayRecord 经过归一化入口。
- 实际行为（修复前）：`validateMatchLog` 只拒绝 `<1`，会把 v2 当当前结构解释；`normalizeReplayRecord` 又会在校验前重建包装记录，把 ReplayRecord v2 静默改写为 v1。
- 根因：MatchLog、ReplayRecord 与 SavedMatch 各自维护版本常量和判断顺序，归一化发生在版本授权之前。
- 共享策略：`versionPolicy.ts` 集中定义 `CURRENT_FORMAT_VERSION=1`、`FormatVersionError`、当前版本断言和显式迁移器入口。所有原常量均引用该唯一值。
- 接受规则：v1 正常读取；v0 在没有注册明确迁移器时拒绝，只有 `migrateVersionedFormat` 获得逐版本迁移器才能推进；v2 及更高版本明确标记“不支持的未来版本”，绝不进入当前结构归一化。
- 错误结构：包含格式类型（ReplayRecord、MatchLog 或 SavedMatch）、实际版本、支持版本及 `older`/`future`/`invalid` 原因；嵌套 MatchLog 也独立验证。
- 牌谱库隔离：未来版本记录与其他损坏记录一样生成单条 `corrupted` 元数据和具体错误，当前版本记录仍可正常列出、打开和导出。
- 测试模式：新增 ReplayRecord 与裸 MatchLog 的 v0/v1/v2 六个导入用例，显示统一接受或拒绝原因及实际/支持版本。
- 新增测试：两类牌谱 v0/v1/v2 参数矩阵、显式 v0→v1 迁移器、包装记录内嵌未来日志、SavedMatch/日志版本、未来记录逐条隔离和六个测试模式用例。
- 相关文件：`src/game/versionPolicy.ts`、`src/game/replay/types.ts`、`validation.ts`、`src/game/persistence/storageTypes.ts`、`replayRecord.ts`、`storageValidation.ts`、`migration.ts`、测试模式注册及文档。
- 验证结果：相关 6 文件 176 项通过；最终全量 95 文件 858 项通过；`npm run build` 通过（TypeScript 与 Vite，175 modules transformed）。
- 修复范围：仅统一版本判断、错误与导入测试；ReplayRecord、MatchLog、SavedMatch 当前 v1 内容及格式版本均未改变。

### STAB-010 — P2 — 已修复（2026-08-01）— 固定种子完整对局不可复现

- 根因：随机依赖分散在 `Math.random`、`crypto.randomUUID` 和 AI 局部 rng 参数中，比赛初始化没有统一随机源，日志中的 seed 也没有可执行含义。
- 修复：新增统一 `RandomSource`，牌实例创建、洗牌与 AI 随机合法弃牌均可注入；生产默认继续使用原安全随机路径，测试使用由 seed 驱动的确定性 PRNG 和 `<seed>-<顺序>-<区域>` 实例 ID。
- 确定性契约：同一规则、seed 和策略的牌墙、动作序列、最终 `GameState` 与牌谱事件深度等价；不同 seed 的牌墙不同。测试日志使用确定时间，避免时间戳造成伪差异。
- 压力工具：测试模式支持 1/10/100/500 局、暂停、同 seed 双跑比较、逐动作不变量、失败种子 JSON 导出和失败状态转 `TestScenarioV1`；另有 500 局与 5000 局独立脚本。
- 相关文件：`src/game/randomSource.ts`、`wall.ts`、`tileUtils.ts`、`ai.ts`、`engine.ts`、`testMode/seededSimulation.ts`、`SeededSimulationPanel.tsx`。
- 新增测试：相同/不同 seed 牌墙、稳定可读 ID、完整局四类确定性差分、每动作不变量、测试模式压力面板与 500 局压力回归。
- 验证结果：相关测试 3 文件 37 项通过；500 局通过（13.38s），5000 局通过（128.58s）；最终全量 96 文件 861 项通过；`npm run build` 通过（TypeScript 与 Vite，178 modules transformed）。

### STAB-011 — P3 — 已修复（2026-08-01）— 弹窗键盘与焦点行为未形成统一契约

- 根因：四个组件各自输出遮罩和 `role=dialog`，没有共享初始焦点、Tab 圈定、焦点恢复、滚动锁或关闭策略。
- 原业务语义：局结果只能“继续”，存档提示只能“继续比赛/放弃存档”，比赛总结只能“新比赛”；退出确认在未结束对局中可用“继续游戏”取消，比赛结束或保存中不可取消。
- 共享实现：新增 `Dialog.tsx`，打开后聚焦明确标记的安全控件，Tab/Shift+Tab 只在弹窗可用控件内循环；背景兄弟节点设为 `inert`，body 滚动锁定；卸载时恢复原状态并把焦点返回仍存在的打开按钮。
- 关闭矩阵：Result、ContinueMatch、MatchResult 的 Escape/背景点击均为 blocked；ExitGame 仅在未结束且非保存中映射到既有 `onCancel`，其他状态为 blocked。不可关闭结算弹窗不会触发推进回调。
- ARIA：保留 `role=dialog`、`aria-modal=true`，并为四类弹窗统一补齐 `aria-labelledby` 与 `aria-describedby`。
- 测试模式：新增“界面与键盘实验室”，使用四个真实弹窗显示当前焦点、焦点圈、Escape/背景预期和返回元素；不触发正式比赛推进。
- 新增测试：Tab/Shift+Tab 首尾循环、背景焦点拉回、Escape blocked/dismiss、四类策略、ARIA 关联及实验室静态入口。
- 相关文件：`src/components/Dialog.tsx`、`DialogKeyboardLab.tsx`、四类弹窗组件、`TestModeScreen.tsx`、组件测试及文档。
- 验证结果：相关 6 文件 41 项通过；最终全量 97 文件 866 项通过；`npm run build` 通过（TypeScript 与 Vite，181 modules transformed）。
- 修复范围：只修改交互与无障碍层；未修改计分、结算、存档选择或比赛推进逻辑。

### STAB-012 — P1 — 已修复（2026-08-01）— 最低桌面视口下牌桌裁切与区域重叠

- 根因：正常游戏、回放和测试模式分别依赖弹性 CSS 与零散断点；牌桌没有统一逻辑画布、最小视口契约或页面级缩放/拒绝策略，1280×720 下侧家、中央计分板和顶部工具存在裁切或拥挤风险。
- 修复：新增共享 `DesktopTableViewport`，把页面外壳、1280×720 固定逻辑画布与牌桌组件分离；统一计算 `min(availableWidth / 1280, availableHeight / 720, 1)`，正常游戏、回放和测试牌桌均复用。当前支持范围内缩放上限为 1，低于任一最低边界时不渲染牌桌，改为可返回菜单的明确提示。
- 几何：桌面牌尺寸与牌河语义保持固定；压缩测试工具栏而不滚动，调整共享桌面区域和中央计分板排版。上下牌河与对应玩家区域边界相接但不相交，左右玩家及牌河保持原方向。
- 视口契约：正式支持横屏桌面 1280×720 起，推荐 1366×768 及以上；已检查 1280×720、1366×768、1600×900、1920×1080、2560×1440。1279×720 与 1280×719 显示“当前窗口尺寸过小”和最低横屏要求。1024×768、900×600、800×560、560×800、手机横屏与竖屏均不在本轮适配范围。
- 测试模式：新增 7 个 `UiInteraction` 用例，分别覆盖五档正式尺寸和两个单边不足尺寸；用例只调整视口并检查可见性，不建立规则旁路。
- 相关文件：`DesktopTableViewport.tsx`、`GameScreen.tsx`、`Board.tsx`、`ReplayScreen.tsx`、`TestModeScreen.tsx`、`stab012Cases.ts`、`styles.css` 及布局回归测试。
- 验证结果：布局与测试模式专项 6 文件 72 项通过；最终全量 98 文件 878 项通过；500 局固定种子压力测试通过（测试体 13.32s）；`npm run build` 通过（TypeScript、Vite，183 modules transformed）。真实浏览器五档支持尺寸均无页面滚动、关键区域越界或测试工具栏溢出，两个边界尺寸均正确拦截。
- 修复范围：仅页面外壳和牌桌显示几何；未改变麻将规则、牌河换行语义、牌尺寸体系、存档或牌谱格式。手机横屏保留为未来页面外壳/布局配置扩展。

## 7. 风险分级

| 级别 | 数量 | 编号 |
| --- | ---: | --- |
| P0 | 0 个未解决（3 个已修复） | STAB-001、STAB-002、STAB-003 已修复 |
| P1 | 0 个未解决（4 个已修复） | STAB-004、STAB-005、STAB-006、STAB-012 已修复 |
| P2 | 0 个未解决（4 个已修复） | STAB-007、STAB-008、STAB-009、STAB-010 已修复 |
| P3 | 0 个未解决（1 个已修复） | STAB-011 已修复 |

## 8. 建议修复顺序

1. STAB-001：已完成；固定王牌槽、活牌墙边界及正常游戏/回放差分测试均已落地。
2. STAB-002：已完成；鸣牌存档恢复及共享实例区域验证器均已落地。
3. STAB-003：已完成；牌山消费状态与按实例公开权限已分离，未改变数据格式。
4. STAB-005：已完成；共享结算、供托快照、事件/回放和动态点数守恒回归均已落地。
5. STAB-004：已完成；UI、TileCounter 与 AI 已统一按实例去重，并增加确定性测试模式回归。
6. STAB-006：已完成；等待保持、UI/AI候选与底层执行统一使用共享判定，并覆盖34种牌型差分。
7. STAB-007：已完成；v1 默认结构、逐字段归一化、兼容错误与测试模式回归均已落地。
8. STAB-008：已完成；规则配置读写删除统一错误、非阻断提示和隔离模拟均已落地。
9. STAB-009：已完成；集中版本策略、结构化错误、未来版本隔离和导入矩阵均已落地。
10. STAB-010：已完成；统一随机源、确定性完整局、失败产物和独立压力脚本均已落地。
11. STAB-011：已完成；共享焦点圈、关闭策略、滚动/背景锁定、测试模式实验室及组件回归均已落地。
12. STAB-012：已完成；共享固定逻辑画布、桌面最小视口拦截、五档分辨率验收及测试模式用例均已落地。

每个 P0 建议独立提交并完整运行 `npm test`、`npm run build`；在 stress harness 可用后追加固定失败种子回归。

## 9. 建议新增的压力测试

项目现已具备固定种子自动对局 harness。`npm run test:stress` 运行 500 局，`npm run test:stress:long` 运行 5000 局且不加入普通 `npm test`；测试模式提供相同能力的交互入口。

当前实现与后续扩展方案：

1. 已建立测试专用确定性 `RandomSource`，同时注入洗牌、AI决策和可预测实例 ID；每次运行记录 seed、规则配置和动作索引。
2. 合法动作枚举器只调用现有 `can*`/候选函数；执行后若状态未变化则视为“候选与执行器分歧”。
3. 每个动作后验证：
   - 有效区域 instanceId 唯一；claimed 牌河历史只能精确别名到一个副露；
   - 每种 tile.id 物理实例不超过 4，赤牌实例不丢失；
   - `sum(scores)+riichiSticks*1000 === startingPoints*4`；
   - 当前 phase 至少有一种合法推进或已终局；
   - pendingCall/pendingRon/pendingKakan 与 phase 一致；
   - 活牌墙、王牌、手牌、牌河、副露的总实例集合保持 136 张守恒（历史别名去重）。
4. 第一阶段固定东风规则 500 局已落地；后续覆盖南风、头跳、三家和、食替、不同最大延长风和自定义起始点的参数组合。
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
- [x] 1280×720、1366×768、1600×900、1920×1080、2560×1440 无页面滚动、关键区域越界或工具栏溢出；1279×720、1280×719 正确拦截（浏览器实测）。
- [ ] 禁用 localStorage、配额满和损坏单条牌谱时，设置、退出和牌谱库均可继续操作并显示可理解错误。
- [ ] 结果/退出/继续/比赛总结弹窗用 Tab、Shift+Tab、Escape 和背景点击做真实浏览器人工验收（组件键盘回归已覆盖策略与循环）。

结论：基线测试与构建健康；STAB-001～STAB-012 已修复，并已建立可重复的压力、存档、牌谱和界面回归入口。正式桌面分辨率矩阵已完成浏览器验收；屏幕阅读器与完整键盘清单仍需人工验收。

## 确定性人工测试场景基础设施

已新增开发者专用测试模式和带版本号的 `TestScenarioV1`。它可严格校验并加载内置或导入场景，在真实牌桌、正式规则入口和正式事件记录器上继续操作；支持重置、当前状态导出、测试牌谱导出、状态摘要、全牌公开、控制玩家切换、单步 AI、实时不变量检查，以及从具有完整牌墙数据的牌谱步骤转换。

内置 `STAB-001-ANKAN`、`STAB-001-MINKAN`、`STAB-001-KAKAN`、`STAB-001-FOUR-KANS` 四个稳定实例 ID 场景，用于人工复查 STAB-001 的固定 14 张王牌槽位、岭上顺序、表/里宝隔离和杠后活牌边界。测试模式与普通继续游戏存档隔离，生成牌谱标记为 `source=test-mode`。使用与验收方法见 `docs/TEST_MODE.md`。

测试模式基础设施本身不改变规则语义；各 STAB 修复状态均以对应共享生产实现及其回归测试为依据。
