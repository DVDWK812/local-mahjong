# 17 步 3D 接入审计

结论：**17-STEP 3D MIGRATION BLOCKED**。

本次确认了未接入的根因，未完成迁移，未修改产品源码或测试。停止依据是用户的明确边界：“若必须修改规则状态或大范围重构公共 renderer，先停止并报告原因及最小可行方案，不自行扩大范围。”当前判断需要跨公共 renderer、scene 生命周期和动画来源合同的重构；不是 Rules 需要修改，也不是浏览器失败阻止了源码修复。

## 已确认的调用链

普通四人：

`App.tsx:1126 Board → Board.tsx:293 GameScreen → GameScreen.tsx:283 TableRenderer → resolveTableRenderer → standardFourPlayer guard → shared TablePresentationState.scene / buildTableSceneState → lazy Table3DScene → Canvas → StableTableScene / Hand3D / River3D / Meld3D`

17 步：

`App.tsx:983 on17Steps → riichi-17-steps-settings → App.tsx:1000 onStart → App.tsx:1008 SeventeenStepsScreen → createSeventeenStepsGame + createSeventeenStepsAIGame → toSeventeenStepsGameState → SeventeenStepsScreen.tsx:100 MahjongTable`

构筑阶段显示 BuildSummary / BuildPanel；正式对战显示 MahjongTable、固定手牌与听牌信息、弃牌候选池。这个分支没有 TableRenderer，也没有 resolveTableRenderer 调用。普通 GameScreen 的 renderer policy 不会控制这条路径。

现有 toSeventeenStepsGameState 是供旧组件/结算消费的投影，不是可直接用于新 3D 的合格 adapter。它在 src/game/seventeenSteps.ts:234 添加 player 2/3 的“未使用座位”，并把 fixedHand 投影到 hand。旧 MahjongTable 用 activeSeats 隐藏了两席。若直接替换为 TableRenderer，这个补齐投影可能通过四人 guard，却不代表两人 3D 已被正确实现。

## 真实运行证据

使用 Codex 内置浏览器，现有开发服务器：`http://127.0.0.1:5173/?table3d=1`。

操作：主菜单 → 本地模式 → 立直麻将 → 17步麻将 → 开始游戏 → 实际点击选择 13 张固定牌 → 确认固定手牌 → 候选池点击七筒 → 等待对手弃北 → 返回菜单（实际返回 17 步设置页）。没有进入普通存档的“继续对局”，没有修改玩家/外观设置。

正式对战 DOM 实测：

| 项目 | 观测 |
|---|---|
| Canvas | 0 |
| table-3d-scene | 0 |
| data-table-renderer-requested 节点 | 0 |
| 实际牌桌 | section.mahjong-table，aria-label=麻将牌桌 |
| requested / active / fallback | 不提供，不能填为 3d / 2d / none |
| 本家固定手牌 | 13 张；弃牌后仍为 13 张 |
| 候选池 | 21 → 20 张 |
| 步数 | 剩 17 → 剩 16 步 |
| 牌河 / 回合 | 自己 1/17、对家 1/17，回到本家回合 |
| Console | 此次读取的 warn/error 列表为空 |

源码调用链与实测 DOM 一致，根因分类为 **未接入**。没有证据说明 17 步请求了 3D 后发生初始化 fallback；单独 Canvas=0 也没有被用于证明 fallback。

## 为什么不能只换组件 / 加 adapter

1. **renderer 入参和选择器绑定四人 GameState。** TableRenderer.tsx:60 继承 LegacyTable2DProps；129、189、299 通过 standardFourPlayer 控制挂载；hud、winner reveal 和 scene adapter 直接消费普通 GameState。两个真实参与者会被 guard 拒绝；沿用补齐投影则违反本任务不伪造四位参与者的边界。
2. **公共 scene 强制四席，生命周期尚未独立。** tableSceneTypes.ts:52 是完整 Record<Table3DSeat, SeatSceneState>。Table3DScene.tsx:106 遍历四席并直接访问手牌/河/副露，215、266、299 的 winner、关键资源、Dora 统计也直接访问四席。Canvas、资源 ready、帧提交、context loss、动画 consumer 都封装在该组件中；不存在可直接插入两人 composition 的现成通用 shell。
3. **现有 discard event 的来源语义不适用候选池。** gamePresentationEvents.ts:78 从投影 hand 生成 preDiscardHand，而这里 hand 是固定 13 张。实际 discardCandidate 删除的是 discardCandidates。HandPresentationSnapshot.ts:45 找不到该弃牌实例会返回 null，tableAnimation3D.ts:248 随即落到普通手牌 fallback 来源，造成抓错区域。
4. **只替换 history 仍不够。** HandPresentationSnapshot.ts:61 对非摸切包含 gap-hold / insert / reorder；17 步没有 drawn tile，不应机械播放这些阶段。useTableAnimation3D.ts:157 直接调用普通 plan resolver，208 直接消费这些 phases，没有模式 plan/source 接口。需要同时定义候选池 snapshot、来源布局和真实动作阶段，保留现有 scheduler/proxy/pacing cleanup。
5. **17 步尚未等待 pacing。** SeventeenStepsScreen.tsx:60、71 现有 AI 弃牌/荣和用 350ms timer；结果在159行随权威状态直接显示。接入动作后需要改为既有 PresentationPacing 的等待与取消机制，并处理结算等待。不能只挂动画而保留 timer 作为动作交接。

这组变更会涉及公共 TableRenderer、Table3DScene、scene 合同或可插拔 composition 边界、useTableAnimation3D / snapshot phase 接口，再加模式 adapter、布局和屏幕接线。判断已超出仅加可选样式参数的局部修改；本次在动这些公共路径之前停止，没有用空 Canvas 或关闭动画来替代完成。

## 最小可行实施方案（未实施）

1. 从现有 TableRenderer / Table3DScene **提取一份共享 session/canvas 生命周期**：renderer policy、error boundary、Loading、按参与者加载资源及当前 Pack、InitialFrameCommit、context loss、demand frame。普通四人路径作为现有 composition 接入，保持 frozen camera/layout 值不动。应提取而非复制第二套壳。
2. 新增 SeventeenStepsPresentationState/adapter，直接读取两位权威参与者，分开 fixedHand、discardCandidates、discardedTiles 与结果；对手隐藏区域投影不带牌面。保持 instanceId/red/原始顺序，不调用 Rules 判断合法性。普通 GameState 投影只留给现有结算/状态栏，不作为新 scene 的规则替身。
3. 新增 17 步布局/composition，复用 Tile3D、桌体/桌布、River3D（必要时加入可选布局 resolver）、头像和 Pack registry。明确 participant 0 → 配置 slot 0、participant 1 → slot 1；seat/wind 只影响位置。
4. 在现有 consumer 增加向后兼容的 source/plan/phase 接口。模式 adapter 从实际候选池来源 slot 冻结 snapshot，执行抓取 → carry → river settle → retreat；不生成 draw/insert/reorder。静态源、proxy、river 共用实例和目标 resolver。skip/cancel/unmount/disabled 交回当前权威投影并释放 pacing。
5. 17 步屏幕保留构筑、确认、听牌分析、候选池合法动作、ron-window、流局/和牌结果与下一局等入口。自动动作等待共享 gate，结果沿用现有 ResultDialog 和 state.result；不重新计分。
6. 先补模式来源/布局/隐藏信息/身份/cleanup 测试，再做两尺寸真实 3D 浏览器验收，以及普通四人进入/一次动作/退出回归。公共加载/fallback 边界变动后做最小针对性 fallback 检查。

## 玩法与持久化边界

源码阶段：build → active ↔ ron-window → round-ended → 下一局 build 或 match-ended。每人34张私有牌，选择13张固定手牌，剩余21张为候选池，最多弃17张。荣和与流局结果由现有 rules/score 投影提供。

SeventeenStepsScreen.tsx:42 用组件内 useState 初始化；App 的这条分支仅持久化17步比赛配置，没有看到独立17步局面存档/恢复入口。返回设置后重新挂载会创建新局。本次没有添加新的续局格式，也没有覆盖普通牌局存档。“17步存档续局迁移保持”不能作为已验证项。

AppearanceSettings 未作为 props 传入该屏幕；它当前没有普通3D的外观/Pack consumer。实施时需要从 App 传入共享设置，并按稳定 participant id 接线；不能声称当前已经复用这些外观。

## 浏览器验收表

| Criterion | Result | Viewport / State | Evidence | Likely component |
|---|---|---|---|---|
| 未接入根因复现 | PASS | 正式17步对战，显式table3d=1 | Canvas=0、诊断=0、mahjong-table | SeventeenStepsScreen |
| 现有选牌/确认/一次双方弃牌/返回 | PASS | 本次实际对局 | 13固定牌、21→20候选、双方1/17 | BuildPanel/DiscardPanel |
| 正式对战使用3D | FAIL | 正式对战 | 仍为旧组件，无3D | 路由/renderer边界 |
| 1280×720 CSS viewport视觉验收 | NOT VERIFIED | 请求1280×720，实际1333×750 | DPR约0.96；调整请求后出现1279/1281×720，未达到精确目标 | 浏览器环境，产品原因未确定 |
| 1920×1080 CSS viewport视觉验收 | NOT VERIFIED | 请求1920×1080，实际2000×1125 | DOM innerWidth/innerHeight实测 | 浏览器环境，产品原因未确定 |
| 截图 | MANUAL BLOCKED | 两种尺寸 | 工具返回 Unable to capture screenshot；没有产出截图尺寸可报告 | 不归因于产品布局或旧CDP bounds |
| 3D来源/proxy/河交接、Pack、连续回合、skip/cancel | NOT VERIFIED | 未迁移 | 无3D动画可验证 | 待实施 |
| 3D和牌/流局fixture到结算、再次进入/续局 | NOT VERIFIED | 未执行 | 不以源码或测试代替浏览器证据 | 待实施 |
| 3D Scene Ready/资源fallback/demand drawDelta/clearDelta | NOT VERIFIED | 未迁移 | 无3D scene | 待实施 |
| 普通四人3D浏览器回归 | NOT VERIFIED | 未执行 | 未修改公共路径 | — |
| 必需Network请求 | NOT VERIFIED | 未采集完整网络验收证据 | Console空不等于Network通过 | — |

浏览器的临时 viewport / CDP device metrics override 已重置。未进入 table3d=0，也未做 Legacy 完整浏览器矩阵。

## 自动检查（现有基线，不是迁移验收）

- targeted：7文件，100测试通过。覆盖17步规则/比赛/屏幕、TableRenderer、Table3DScene、四人scene adapter、3D plan。
- npm test：227文件通过、1文件skip；1608测试通过、1测试skip。没有修改或新增 skip。
- npm run build：通过；有现有大chunk提示（>500kB）。
- git diff --check：exit 0；有LF/CRLF提示，无diff空白错误。
- 日志：17-step-3d-audit-targeted.log、17-step-3d-audit-tests.log、17-step-3d-audit-build.log。

## 文件与工作区

本次只新增本报告及上述3份日志；没有修改产品源码、规则、测试、配置、图库或存档；没有提交、reset、clean或格式化。开始时已有39个tracked dirty文件，包括7个既有手部图片删除，最终tracked diff仍为39文件、635插入/168删除。本报告不把这些已有UI-6B2改动算作本次产出。

开始状态还列出了 untracked src/hand/cyberpunk.png 与 src/hand/robot.png，结束git status未再列出这两项。本次没有对它们执行删除、移动或覆盖；无法由当前证据确定其变化来源，不擅自恢复。其余已有untracked与UI-6B2产物不作清理。

未进入UI-6C，未扩展Hand Pack，未同步Notion。
