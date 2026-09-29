# SANMA-4 共享正式 UI 接入修正验收

2026-09-24。状态：IMPLEMENTED_WITH_VALIDATION_BLOCKERS。SANMA-6 未批准。
最终工作区指纹：`f69f351b83277dbc19a07c7fdcdd9ca591eaef6c610f0642df8c9bcd1a1ecf1b`。
HEAD：`5620bbbb4f73fa1001d663f49c98ad88e75b58e8`；这是 dirty 工作区，不是该 commit 的独立验收。
开始前状态与 tracked patch 保存于 baseline；已有 SANMA、计时、血战和其他并行成果保留。未提交、推送、发布或生成付费资产。

## 源码事实与修正

旧生产三人通过 ParticipantTable → ParticipantScene 参与者预览运行，独立 HUD、操作和结果，仅共用 Canvas/部分牌组件，确实没有进入四人正式界面。详见 [逐项复用差异表](REUSE-AUDIT.md)。

现在四人 GameScreen 和三人 SanmaScreen 共同使用 FormalGameScreen（真正实例化 LocalHandArea 和各层布局），FormalTable3D → Table3DScene，以及 Table3DHudView、TableCenterView、GameTopBarView、AnalysisDrawerView、ActionPrompt、OperationButton、WinnerResultCards、ResultShell、ResultDeltas、MatchRankingCards、ReplayBottomBar → ReplayControls。东、南、测试 Tab、回放均进入同一个 SanmaScreen。

三人保留自己的 MatchRuntime、Rules、合法命令与 readonly adapter。场景为真实 bottom/right/left 三席，无 top 占位玩家；牌河和副露沿用 River3D/Meld3D。三人碰杠方向、1万↔9万宝牌、结果与听牌提示由 adapter 投影。北区是独立 north 数据，使用原 Tile3D 材质、尺度和座席变换。旧 participants 三人表现仅预览隔离留存，正式 SanmaScreen 不引用。

拔北仅在权威成立后发布 north_committed；响应/抢北不提前补牌。共用 HandAnimationConsumer/Controller、3D proxy、scheduler、pacing；队列等待期间遮罩最终北牌，释放/取消清理，不冒充杠。真人北牌 DOM 起点投影沿用实际相机。最终回归发现非拔北动作也读取此起点，已限定到有 sourceRect 的北事件；四人 appearance consumer 回归重新通过。

另修复：SM-18 原停止条件把已鸣历史计入18张，现按可见未鸣牌超过18张才停止，仍是 seed=100 的合法动作前缀；结果遮罩拦截账本/回放点击，现打开详情时隐藏结果并在进入回放时关闭详情。

四人相机、桌体、灯光、布局 tuning 未被本轮调整。HEAD diff 中已有的 HUD tuning 和其他既有修改不归为本轮改动。四人共用提取行为由测试及浏览器入口核查支持；不宣称精确视觉等价已获人工批准。

## 六项状态

|项目|状态与证据|
|---|---|
|实现|IMPLEMENTED_WITH_VALIDATION_BLOCKERS；源码实际共同调用，必要三人扩展已接入|
|三人自动测试|PASS：155项原三人回归 + 10项 shared adapter/scene 测试|
|全仓回归|FAIL：2226通过、1失败、1原有跳过；唯一失败为 HUD 1.9/2.3|
|浏览器交互|已验证部分链路；完整比赛及全部场景动作 NOT_VERIFIED|
|视觉／听感|精确两档视觉 BLOCKED；听感 NOT_VERIFIED（自动化始终 mute=1）|
|人工 Gate|NOT_VERIFIED；未填人工通过，未批准 SANMA-6|

## 本轮重新执行的自动验证

- final-targeted.log：9文件95项通过，包括新增10项 adapter、三席、隐藏信息、真实长河、北抢断/成立/遮罩、DOM源投影、双响共享结果等。
- final-tests.log：最终 npm test，257文件，255通过/1失败/1跳过；2226通过/1失败/1跳过。三人 rules/wall/scenarios/integration/timing/longRun 全部通过，含40场长跑及正常/1秒0Bank的8场 runtime 审计；四人 ai.test 24项、共享指纹10项通过。17步、血战与共享表现回归包括在本次全仓运行内。
- 唯一失败：centralConsoleLayout.test.ts:26 严格期望 z=2.3，当前为1.9。本轮未改布局或期望，设计批准仍待用户决定。
- final-types.log：npm run check:types 通过。final-build.log：npm run build 通过，保留 chunk 大小警告，无无关拆包。
- diff-check.txt：git diff --check 通过，仅 Git 换行提示；没有虚构 lint 命令。

计时路径保留 preparePolicyCommand、decisionId、单一 MatchRuntime deadline、动作来源及动画后提交前的预算准备，没有 UI 权威时钟。生产浏览器东风保存的实际审计 browser-east-save.json：manual=2、ai-policy=5、timeout=1（人工观察等待期间）；不是全 fallback 场。先前计时根因与契约详见 ../sanma-closeout/ACCEPTANCE.md，本轮由 timing/integration 全仓重新验证支持，不把旧报告当本轮浏览器完整比赛。

## 实际浏览器观察及限制

先开四人正式菜单路径作参考，再进入三人东、三人南。共同外壳、HUD、手牌和同一正式场景实际挂载；四人4头像、三人3头像，单Canvas。东风默认35000/40000/40000真人拔北、弃牌、两AI接续、保存退出与恢复已操作；南风默认配置开局已操作，未完成默认整场。

SM-06-DOUBLE 实际先拔北再分别响应，两响应收齐才显示共享两赢家结果、三人点数，随后下一局。SM-16-REPLAY 实际拔北/自摸、账本、进入共用回放、单步/末步/关闭结果已操作。其余 browser-case-mounts.json 所列 SM-09-EIGHT、SM-10-LOW-FULL、SM-14-TIME、SM-18-LONG-RIVER、SM-13-EAST-END、SM-13-SOUTH-END、SM-15-RESTORE 仅验证加载共同界面，不冒充全部操作完成。

Console error 观察为空；browser-network.json 保存各页最近250条资源记录，未观察到>=400，且有音频资源，不代表无限历史 Network 全覆盖或听感通过。共享 GameScreen 变更另做独立 Legacy smoke：Canvas=0、3D层=0、基础牌局可运行，见 legacy-smoke.json。

## 截图对照阻断

两档独立测试 tab，原始图未修补。请求1280×720后实际CSS1333×750、DPR≈0.96；请求1920×1080后实际CSS2000×1125、DPR≈0.96。前者现场Canvas记录1559×834（resize初期，后续曾变化），后者1955×1058；完整game rect见各 metadata JSON。不能把请求尺寸当实际CSS尺寸。

同一南风场景 CDP PNG=1280×720，另一浏览器截图接口 JPEG=1389×781，裁切范围不同。长河 CDP PNG=1920×1080 与 JPEG=2083×1172 都有条带/重复错位；两个接口不是独立浏览器渲染器，因此不足以断言百分之百工具故障，也不能单凭此认定应用错位。未再次调相机、UI或系统DPI迎合截图。

这些图采集于最终北牌DOM起点修正之前，未保存采集瞬间完整工作区指纹，故仅作为通道故障诊断，不能算最终版本视觉通过。settled-metrics.json 是最后 HMR 回主菜单后的观测（Canvas为空），不用于替代场景尺寸。临时 metrics override 已清除。

## 人工入口与步骤

正式：本地模式 ＞ 立直麻将 ＞ 三人间 ＞ 三人东／三人南。测试：测试模式 ＞ 三人立直麻将，输入 caseId，展开“前置条件、操作步骤与观察重点”，加载场景。已保留浏览器测试 Tab，筛选 SM-06-DOUBLE；人工仍待核查，旧自动结果显示需复验。

加载后可收起场景说明与测试控制区，使用顶栏暂停及测试时钟单步；检查前关闭自动和/鸣/切，避免动作抢先。浏览器自动化URL保留mute=1；用户听感核查需自己移除mute=1并在声音设置解除静音，音频资源加载不能替代实际听辨。

建议逐项：SM-06-DOUBLE 收齐双响应与无错误补牌；SM-09-EIGHT 余下两次拔北至四北/八补牌，观察北区不遮挡；SM-10-LOW-FULL 电脑一自摸核对1300+800；SM-14-TIME 测试钟推进核对超时来源；SM-18-LONG-RIVER 长河不截断；SM-13-EAST-END/SM-13-SOUTH-END 终局三人排名；SM-15-RESTORE 保存恢复预算与回调；SM-16-REPLAY 逐步、跳转与账本。

用户本机分别建立1280×720、1920×1080干净窗口，四人与三人采用相同主题和外观；记录 innerWidth/innerHeight、devicePixelRatio、canvas.width/height、PNG尺寸、caseId和Tab工作区指纹。实际观察选牌/摸入、碰杠来源、四北避让、代理无重复、跳过/退出清理、声音、resize，并完成默认配置整场。只由用户填写人工结论和备注后导出诊断。

未验证/未解决：HUD设计决定；最终版本精确两档视觉及听感；默认配置浏览器完整比赛；上述仅挂载场景的全部人工动作；北区四张及动画细节人工认可。旧独立三人页面截图和受影响人工记录不能沿用为新版本通过。
