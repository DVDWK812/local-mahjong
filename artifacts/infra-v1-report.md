# 麻将基础设施 V1 — 人工核查交付包

日期：2026-09-22。交付状态：**READY_FOR_MANUAL_QA — STOP**。人工验收尚未完成，不标记 COMPLETE / FROZEN，不提交或发布。

## 工作区与改动归属

- 路径：`C:/Users/Wenkai/Desktop/UNSW/local-mahjong-voice-phase1`。
- 分支：`feature/voice-pack-repository`。
- 起止 HEAD：`5620bbbb4f73fa1001d663f49c98ad88e75b58e8`，未切换分支、未从远端重建。
- 原有唯一修改：`src/presentation3d/table/tablePresentationTuning.ts` 的 `hudOnlyOffsetZ: 0.3 → -0.1`。计算后中央 HUD z 为 1.9，原断言仍要求 2.3。本轮保留这行以及原测试，未修改冻结布局。
- 以下代码、报告、截图和日志为本轮新增或修改。未修改计分、番缚、AI 核心策略、资产和顶层 SavedMatch/Replay 格式版本；未 commit/push/merge/tag/发布。
- 已读取附件、Notion 正文、适用 AGENTS.md、开发/规则/UI/审查/门禁 Skills 和 17 步冻结记录；旧“阶段 STOP”按本次明确授权替换。

## 各阶段实际结果

| 阶段 | 实际结果 | 证据 / 限制 |
|---|---|---|
| INF-0 | 源码审计完成 | [调用链和基线](infra-v1-audit.md)；没有重复 Match 或伪四人状态 |
| INF-1 | 实现并验证 | 原比赛设置页加入版本化时间配置；模式草稿隔离、显式不限时、统一校验、冻结快照 |
| INF-2 | 实现并验证 | 可注入单调时钟、权威命令接收、独立参与者 Bank、截止幂等、资源准备与有限开放窗口分离 |
| INF-3 | 实现并验证 | 真实 drawn instance、既有 Pass/振听、食替后确定性弃牌、三个统一自动偏好、8 种组合 |
| INF-4 | 实现并验证 | 从构筑就创建权威 owner；120 秒独立预算、草稿版本、最近合法方案、有限补全、候选池超时 |
| INF-5 | 实现；人工视觉待核查 | 左下 HUD、展开/收缩、完整读屏名称、模式禁用原因、仅 HUD 刷新；双分辨率 DOM 与实际交互已测 |
| INF-6 | 既有能力接入完成 | 四人保存剩余预算/偏好/审计、旧存档不限时、回放不建真实时钟；17 步仍无既有可靠续局/回放，不虚构该能力 |
| INF-7 | 自动审查与可执行检查完成 | 自动测试/构建/浏览器证据见下；所有人工项保持未勾选 |

## 关键实现决定

1. `MatchRuntime` 接管当前 Rules state 的同步更新，React 仅接收不可变投影。原引擎、合法动作与计分仍是结果权威；现有 AI/draw 生产者经 `advance` 进入同一 owner。UI 倒计时没有弃牌或 Pass 逻辑。
2. `DecisionClock` 只管理预算，不复制规则状态。定时器仅唤醒；以 `performance.now()` 差值结算，后台延迟不赠时。单个唤醒句柄有版本保护；命令同步记录接收时间，`receivedAt >= deadline` 走超时。
3. 初次资源加载不扣时；每个新动作窗口由 Match 给出固定上限 2500ms 的输入准备期。开放时通知既有 HandAnimationController 清理滞留动画/mask/pacing，动画完成回调不决定期限。2500ms 是本轮保守实现值，需人工审阅手感；不会在跳过动画后追加规则时间。
4. 默认 5 秒基础 / 每小局 20 秒 Bank / 17 步选牌 120 秒。每独立决策重新给予基础时间，Bank 只在基础用完后减少。同张弃牌 Ron→Call 共用预算；吃碰后新基础、不补 Bank；自己杠暂停并恢复原预算。
5. 正常摸牌仅弃真实 drawnTile（含赤牌）；无 drawn 的合法吃碰后按最高合法牌种、非赤优先、instanceId 升序。异常缺少 drawn 或没有合法弃牌进入受控错误。
6. 自动策略顺序：检查有效性/截止→合法和牌→不吃碰杠→摸切。可自摸但未开启自动和牌时保留手动机会。新比赛全关；新局保留和/鸣，重置切。
7. 17 步现有确认入口不要求听牌/役/番缚，复用并补强 13 张唯一、本人实例校验。超时优先当前合法方案→最近完整方案→保留当前选择的固定序补全，最多访问 34 张，不调用强 AI。失败/预算耗尽区分，停止且不计分。正式超时只动 candidates；禁用“鸣”和“切”。
8. 显式退出确认即暂停；取消后恢复剩余值；后台切页不当作暂停。资源 ready 不解除用户暂停；StrictMode effect 重挂载单独恢复已启动 session，既不提前绕过资源准备，也不补预算。暂停期间拒绝迟到 AI 推进。
9. 保存相对预算，不保存 timer handle 或单调绝对 deadline。新增可选 v1 扩展，不改变现有顶层版本；缺失字段的旧存档不限时。普通牌谱保留既有动作，并附加六种来源审计；decisionId 不包含牌面/候选池身份。17 步审计当前只在运行 session 中，退出后不持久化。

## 修改文件

新增：

- `src/game/timeControl/config.ts` — 配置/草稿/新比赛开关。
- `src/game/timeControl/decisionClock.ts` — 预算、决策、调度、快照。
- `src/game/timeControl/matchRuntime.ts` — 统一权威命令、自动策略、暂停/恢复、审计。
- `src/game/timeControl/fourPlayerPolicy.ts`、`seventeenPolicy.ts` — 各模式决策适配。
- `src/game/timeControl/timeControl.test.ts` — 55 项假时钟及规则集成测试。
- `src/components/TimeControlSettings.tsx`、`MatchClockHud.tsx`、`matchClockHud.css` — 配置与显示。

修改：

- `src/App.tsx` — 四人 owner、命令、设置、保存/续局、退出、17 步配置快照。
- `src/components/Board.tsx`、`components/game/GameScreen.tsx` — 抑制鸣牌与资源就绪透传。
- `src/components/SeventeenStepsMatchSettings.tsx`、`SeventeenStepsScreen.tsx` — 17 步接入。
- `src/game/seventeenSteps.ts` — 共享构筑合法校验。
- `src/game/persistence/storageTypes.ts`、`storageValidation.ts` — 可选运行快照及加载验证。
- `src/game/replay/types.ts` — 可选配置/动作审计。
- `src/presentation/handAnimation/HandAnimationController.ts` — 沿既有 controller 清理滞留表现。
- `src/presentation3d/TableRenderer.tsx` — 初次资源就绪通知。

交付证据：本报告、`infra-v1-audit.md`、4 张 `infra-v1-*.png`、`infra-v1-logs/` 原始命令日志。日志保留开发过程失败与修复记录，不仅保留绿色结果。

## 自动检查

所有命令在上述工作目录执行。package 无独立 lint/typecheck script；`npm run build` 包含 `tsc`，另执行过 `npx tsc --noEmit`。

| 检查 | 实际结果 |
|---|---|
| 基线 `npm test` | 1774 通过 / 1 原有失败 / 1 原有跳过；首次沙箱 Node spawn EPERM，获权限后执行成功 |
| 定向规则/保存/回放/手部动画测试 | 18 文件、184 项通过，见 targeted-2 日志 |
| 立直提示回归复验 | 57 项通过；移除本轮曾引入的重复标记，见 repair-test 日志 |
| 最后暂停/StrictMode/保存/回放定向测试 | 6 文件、114 项通过，其中计时 55 项 |
| 最终 `npm test` | 1829 通过 / 1 原有失败 / 1 原有跳过；239 文件通过、1 失败、1 跳过 |
| 最终 `npm run build` | 通过；保留既有大 chunk 警告 |
| `git diff --check` | 通过；只有 Git 的 LF/CRLF 提示 |
| 测试修改约束 | 没有删除、跳过或放宽原断言；新增测试，无新增 skip |

定向命令：

```powershell
npm test -- src/game/timeControl/timeControl.test.ts src/game/chankan.test.ts src/game/kuikae.test.ts src/game/seventeenSteps.test.ts src/game/persistence src/game/replay src/components/SeventeenStepsScreen.test.tsx src/components/MatchSettings.test.tsx src/presentation/handAnimation
npm test -- src/game/timeControl/timeControl.test.ts src/components/ActionPromptRiichiCandidates.test.tsx
npm test -- src/game/timeControl/timeControl.test.ts src/game/persistence src/components/ReplayDetail.test.tsx src/components/ReplayScreen.test.tsx
npm test
npm run build
git diff --check
```

基线失败定位：`src/presentation3d/table/centralConsoleLayout.test.ts:26`。开始前和最终均为 scoreHud z 期望 2.3 / 实际 1.9，和用户原有 offset 修改一致。未将其修成绿，也未把全量命令标作成功。

## 内置浏览器证据

实际 URL：`http://127.0.0.1:5175/?mute=1`。仅独立 Legacy smoke 使用 `?mute=1&table3d=0`。静音没有跳过音频请求。

| 检查 | 结果 | 直接证据 / 限制 |
|---|---|---|
| 四人真实 3D | PASS | CSS viewport 1280×720、1920×1080；Canvas=1；requested=3d、active=3d、fallback=none；有真实牌桌与持续对局 |
| 17 步真实 3D | PASS | 同上两个 CSS viewport；Canvas=1；真实两人牌桌 |
| 布局几何与 HUD 交互 | PASS | 两分辨率无水平溢出；HUD 与实际手牌/候选按钮交集为 0；展开收缩、Enter 键操作；17 步禁用说明可见 |
| 配置校验 | PASS | 基础 0 阻止开始并显示错误；1 秒 + Bank 0 可开始；普通不显示选牌；模式草稿独立 |
| 四人实际流程 | PASS | 超时弃牌、AI 推进、和牌结算、继续下一局、退出保存、继续对局、牌谱打开并步进 |
| 17 步实际流程 | PASS | 5 秒选牌自动补齐；双方各 17 次弃牌后候选池各余 4 张、固定 13 张、进入流局和下一局；另手动点击选满 13、确认并点击候选九筒，实际进入对手回合 |
| 暂停/恢复 | PASS | 退出确认显示“已暂停”，取消恢复；剩余预算精确值另由假时钟验证 |
| 减少动态效果 | PASS（基本流程） | 模拟 prefers-reduced-motion=reduce；3D 持续运行；完整动画观感未代签 |
| Legacy | PASS（smoke） | Canvas=0、3D layer=0；初次准备期开启、真人超时和 AI 基础牌局推进，无 crash；没有扩充 Legacy 视觉功能 |
| Console | PASS（观测时段） | 普通与17步相关 error 记录均为空 |
| Network | PASS（完整短时捕获） | 17步确认/弃牌段83条响应无失败、含2条音频；普通段有音效206/语音200且无已捕获失败，较早缓存事件被截断，不宣称全会话无失败 |
| 完整像素视觉/逐帧动画/所有 Ron 叠层 | NOT VERIFIED | 原始截图通道存在缩放、灰带、重复片段；不能据此批准完整构图、动态遮挡或逐帧交接。需用户浏览器实看 |
| 所有3D悬停命中、禁用对手命中 | NOT VERIFIED | 本轮实际验证 DOM 手牌/候选点击；没有系统穷举所有 world hit targets |
| HUD 不引起额外3D帧 | NOT VERIFIED（性能计数） | 代码隔离在 HUD 的100ms刷新，无 App订阅 tick；未取得可信GPU帧计数 |

原图保留，未裁剪、拼接或修复：

- [四人720截图](infra-v1-four-720.png)
- [四人1080截图](infra-v1-four-1080.png)
- [17步720截图](infra-v1-seventeen-720.png)
- [17步1080截图](infra-v1-seventeen-1080.png)

工具 viewport 在当前缩放环境需校准，实际 `innerWidth/innerHeight` 已核实为目标值。测试结束恢复视口和 reduced-motion 覆盖；将本次浏览器写入的测试存档/牌谱恢复到开始前逐键相同的备份，时间草稿恢复5/20/120。没有改动用户原有对局文件。

## 审查与门禁

已读完整本轮代码 diff、新文件及主要调用端。修复了立直提示重复标记、退出确认仍扣时、暂停期间迟到自动推进以及 StrictMode 就绪路径恢复问题。未发现仍需修改的本轮阻断性代码缺陷；数据校验、真 drawn、共享响应窗口、杠预算、17步实例保护均有针对性测试。

**发布门禁：FAIL。** 这是发布/冻结门禁，不是要求继续自动修改冻结布局：全量测试仍有明确原有失败，完整视觉及动画证据尚未通过人工验收。**UI 综合结果：NOT VERIFIED。** 核心工程可交给人工核查；不能将局部 PASS 升级为整体 UI PASS。

## 启动与确定性复现

当前本轮开发服务为端口5175（5173/5174在启动时已占用）。打开 `http://127.0.0.1:5175/?mute=1`。服务若停止：

```powershell
cd C:\Users\Wenkai\Desktop\UNSW\local-mahjong-voice-phase1
npm run dev -- --host 127.0.0.1
```

以 Vite 输出的实际端口为准，所有自动化访问保留 `mute=1`。

确定性规则场景无需等真实倒计时：

```powershell
npm test -- src/game/timeControl/timeControl.test.ts -t "receipt at"
npm test -- src/game/timeControl/timeControl.test.ts -t "same discarded tile"
npm test -- src/game/timeControl/timeControl.test.ts -t "Pon starts"
npm test -- src/game/timeControl/timeControl.test.ts -t "own Ankan|own Kakan"
npm test -- src/game/timeControl/timeControl.test.ts -t "legal Tsumo priority|automatic preference combination"
npm test -- src/game/timeControl/timeControl.test.ts -t "17-step|selection|draft|preparation"
npm test -- src/game/timeControl/timeControl.test.ts -t "resource|reattachment|pause|old saves"
```

这些命令覆盖截止前/恰好/之后、Ron→Call见逃、吃碰食替、杠剩余预算、8开关组合、构筑异常、过期草稿、17次候选弃牌、保存和无UI推进。UI发牌仍使用原有随机机制，不把随机牌局冒充固定和牌场景。

## 人工核查清单（均待用户操作）

| 状态 | 入口 | 操作 | 预期结果 |
|---|---|---|---|
| 待核查 | 主菜单→本地→立直→四人间→四人东 | 检查默认值，再输入0/负数/空值；改为1秒+0Bank开始 | 默认5/20；非法不能开始；普通没有选牌字段 |
| 待核查 | 同上 | 选择不限时；开始后等待、展开HUD | 显示不限时，不自动超时；本场配置只读 |
| 待核查 | 普通对局 | 本家摸牌时不操作直到到期 | 只弃真实摸入实例；赤牌身份保留；后续每轮仍有基础时间 |
| 待核查 | 普通对局、5/20配置 | 一次用完基础并消耗部分Bank，完成动作 | 下一次基础恢复，Bank不补；下一小局才重置Bank |
| 待核查 | 有荣和/抢杠机会 | 不选和牌等到期 | 走原Pass，见逃/振听副作用保留；同张牌后续吃碰不再赠时 |
| 待核查 | 吃碰成功后的弃牌 | 无摸牌时等待超时 | 弃合法集合固定序最后牌种；食替禁牌不被选中 |
| 待核查 | 自己暗杠/加杠 | 消耗部分Bank后杠，等待抢杠/岭上 | 等他人时自己的预算冻结；岭上恢复原剩余预算 |
| 待核查 | HUD | 逐一测试和/鸣/切及8组合，包含可自摸情形 | 和优先；鸣禁止所有吃碰杠但保留和；切不提前切掉手动自摸机会 |
| 待核查 | HUD | Tab/Enter、展开收起，随后进入下一局 | 名称完整可读；收起不改偏好；新局和/鸣保留、切关闭 |
| 待核查 | 普通对局→返回菜单 | 在退出确认等待，再继续；随后保存退出并续局 | 确认框显示暂停；预算不变；续局不补满，不重复动作 |
| 待核查 | 主菜单旧存档/旧牌谱 | 继续旧局；播放或拖动旧牌谱 | 旧局不限时；回放不倒计时、不重算超时策略 |
| 待核查 | 17步设置→构筑 | 默认120秒；改5秒后只选少量牌并等到期 | 按本人34张确定性补全；不要求新增听牌门槛；固定13+候选21 |
| 待核查 | 17步构筑 | 选满13后取消部分选择至到期；另一次提前确认 | 到期优先最近合法方案；提前确认锁定；余时不转Bank |
| 待核查 | 17步正式对局 | 等超时、手动选候选牌、查看和/鸣/切 | 只从候选池弃牌；固定13不变；鸣/切禁用且解释清楚 |
| 待核查 | 17步一整局 | 双方完成17次弃牌，再进入下一局 | 各剩4候选；原结算不变；新局独立选牌预算 |
| 待核查 | 普通和17步，1280×720及1920×1080 | 展开HUD、分析、Ron/Skip、结果面板；移动指针出牌 | 无关键遮挡、裁切或溢出；牌与命中一致；每次操作只提交一次 |
| 待核查 | 两种3D对局 | 正常速度、Skip、减少动态、退出/重入 | 无重复proxy、残留mask；开放准备期不扣时；不依赖动画完成裁定期限 |
| 待核查 | 5/20/120与2500ms准备期 | 连续体验几局 | 用户确认默认值、偏好复位及等待节奏是否合适，之后才能讨论冻结 |

已知限制：17步没有新增持久续局/牌谱；开关只服务当前工程真人seat0（Clock底层覆盖独立多参与者测试），没有新增联机/多人交互；完整视觉、全套world pointer、真实后台节流/设备休眠、GPU帧性能与长时内存稳定性未代签。无付费生成、无发布动作。

## Notion 同步状态

规划正文读取成功。尝试追加本轮实施摘要时，自动审批拒绝：当前明确授权只覆盖读取，分支、HEAD、测试结果和本地服务地址属于向外部页面发送工程信息。没有绕过拒绝，页面未写入。已请求用户单独批准追加到同一个规划页面；批准前以本报告作为待同步内容。本项不阻断本地实现及人工核查交付。
