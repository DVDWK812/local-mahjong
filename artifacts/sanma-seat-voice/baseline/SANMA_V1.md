# 三人立直 V1 实现与验收记录

交付状态：IMPLEMENTED_WITH_VALIDATION_BLOCKERS。SANMA-0～5 已实现，自动验证与浏览器证据见下文；两档完整视觉 Gate 受内置浏览器截图异常阻断。SANMA-6 人工核查未批准，不代表 COMPLETE / FROZEN。未提交、推送或发布。

## SANMA-0 审计

事实基线：feature/voice-pack-repository，HEAD 5620bbbb4f73fa1001d663f49c98ad88e75b58e8。原有 dirty/untracked 清单、差异和测试日志位于 artifacts/sanma-v1/baseline-*。保留计时、HUD、血战及所有既有工作；不提交、推送或调用付费生成。

现有导航 App / navigation / RiichiModeMenu 只有三人占位。三席 ParticipantTable / ParticipantScene 使用 SceneCanvasHost，原三席预览不能承担规则。四人 engine / winChecker / match 含固定四人顺序、3000 不听罚符、300 本场和第四局边界；因此三人建立独立的 Rules 状态与 reducer，复用 scoreCalculator 的役种／符数、tile 数据类型、MatchRuntime / DecisionClock、共享手牌与三席资源，不修改四人规则状态。

专项页已读取：https://app.notion.com/p/3e3dc10ec1b5813e97f3fed82b50316e 。旧暂停安排由本次任务覆盖。规则以用户指令为准。

## 工程规则决策

完整不可变快照为 src/game/sanma/config.ts 的 SANMA_RULES，规则版本 sanma-riichi-v1。默认 35000 起点、40000 目标、40000 返还；顺位 +20/0/-20，头名奖励为 3×(返还−起点)/1000。三人东、三人南均从东一开始。自摸损默认有，无损按缺席闲家份额各补一半、向上取百点，补偿只作用于基础和牌付款。

继承现行四人：食断、后付、双倍与复合役满、累计役满、双风雀头4符、九种九牌、暗杠只抢国士、禁止食替；不开切上满贯和古役。四人代码未找到包牌实现，三人明确补充大三元／大四喜责任支付：完成第三种公开三元刻或第四种公开风刻的鸣牌来源承担该役满分量；自摸该分量支付完整荣和额，荣和由责任人与放铳者均摊（同一人付全部）。复合役满其余分量按正常三人支付；本场单列。

北在手中为客风，拔北不破门清、不属于面子、不是弃牌。拔北成立才打断一发／首巡。抢北无额外抢杠役；补北自摸显式计岭上并排除海底。立直北限摸入牌且原等待不变。杠宝牌在杠成立后、补牌前翻开。多人四杠在补牌自摸机会、最终弃牌荣和机会之后流局；一人四杠继续；不提供第五杠。

流局满贯：非空牌河全为幺九字牌且未被鸣走、没有开放副露；允许暗杠和拔北。多人同时成立分别执行三人满贯自摸支付，获奖者仍支付其他获奖者；本场每位获奖者各收两家100，供托只给从庄家起最近获奖者；该局按和牌推进。

## 14 张保留边界与 8 次补牌契约

实体目录为108张唯一 instanceId。初始物理索引0..93为活牌，94..97为四格补牌队列，98..107为五对表／里指示牌。发13×3，再给庄家第14张，余活牌54。

正常摸牌从活牌头取。补牌从四格队列头取，再将活牌尾移入队尾；每次活牌数减1，保留边界始终14。最多8次补牌且最多4杠、4北。指示牌永不进入队列，杠只解锁既有下一对。这里不是18张固定死牌，也没有把18个互斥位置塞入14张；后四次补牌来自先前移入边界的活牌尾。used 是已分配索引审计清单，不是实体所有权区。真正所有权是活牌／队列／指示牌／手牌／未鸣牌河／副露／拔北，必须覆盖108张且互斥。drawn、已鸣牌河、响应及结果只是别名引用。活牌为0或已补8次时禁补牌动作。

## 完整结算后的结束决策表（优先级由上到下）

| 条件 | 处理 |
| --- | --- |
| 任意点数 <0 | 击飞终局；0分继续 |
| 追加场内任意玩家达到目标 | 结算后立即终局，优先于连庄 |
| 常规最终局，庄家为第一且达目标，庄家和牌或荒牌听牌 | 自动和了止／听牌止 |
| 庄家连庄（包括双响含庄、荒牌听牌、途中流局） | 保持风／局，本场+1 |
| 常规最终局换庄，有人达目标 | 终局 |
| 常规最终局换庄，无人达目标 | 三人东南入；三人南西入 |
| 追加场第三局换庄 | 强制终局；最多一个追加场，连庄仍可继续 |
| 其余换庄 | 庄家循环模3；第三局后换场；和牌本场归零、流局本场+1 |

中途达40000不终局。终局剩余供托归临时第一，平分按开局风序。成绩独立于点棒账本。

## 验证基线

首次 npm test 遇沙箱 Node EPERM，正常权限重跑：245文件，243通过、1失败、1跳过；2021测试通过、1失败、1跳过。未将文档历史数量当作本轮结果。后续报告记录实际命令与新增测试结果。

## SANMA-0～5 交付范围

| 阶段 | 实际状态与接入点 |
| --- | --- |
| SANMA-0 | 审计、完整规则快照、补牌索引契约和结束决策表已落地。本文件及 config.ts、wall.ts 是依据。 |
| SANMA-1 | App / navigation / RiichiModeMenu → SanmaSettings → SanmaScreen；真实三席 Rules、108牌、摸切碰杠、禁吃及独立测试 Tab 已实现。 |
| SANMA-2 | engine.ts / scoring.ts：拔北宣言、收齐抢北响应、成立后补牌；立直、振听、一发、双响、补牌资源边界已实现。 |
| SANMA-3 | 两种支付、逐笔账本、供托、本场、包牌、荒牌与流局满贯、完整东南战推进和排名已实现。 |
| SANMA-4 | MatchRuntime / DecisionClock、两 AI、三席正式 SceneCanvasHost、Shared LocalHand、拔北／副露、三列结果、自动设置、现有外观与声音接入。浏览器核心操作已执行，完整视觉 Gate 阻断。 |
| SANMA-5 | 独立存档／历史／测试命名空间、版本与指纹校验、权威动作回放、79场景、40固定seed整场、诊断导出和人工核查记录已实现。最终检查的实际结果见 artifacts/sanma-v1/ACCEPTANCE.md。 |

主要新增文件在 `src/game/sanma/`、`src/components/Sanma*.tsx`、`src/components/sanma.css`、`src/presentation/table/sanmaPresentation.ts` 和 `src/presentation3d/participants/Sanma*.tsx`／`useSanmaAnimation.ts`。共享修改集中在导航、测试Tab挂载、三席 ParticipantTable / ParticipantScene、计时模式识别和音频 consumer。

`standardShanten(hand, fixedMelds = 0)` 只新增固定副露数量参数，三人开放手牌需要这一共享算法能力；四人默认调用保持零副露偏移。未改 ukeire、recommendDiscards、四人核心 AI 或番符点数规则。三人独立状态不伪装四人 GameState。

先前 dirty/untracked 的 HUD、四人、17步、计时与血战工作继续保留。最终全局 diff 含这些其他任务的修改，不应把它们全部归为本次三人实现。

## 实际启动和核查入口

启动命令：`npm run dev -- --host 127.0.0.1`。已验证地址：`http://127.0.0.1:5173/?mute=1`。浏览器测试必须保留 mute=1；它只静音输出，仍加载并核对音频资源。

- 正式：本地模式 ＞ 立直麻将 ＞ 三人间 ＞ 三人东／三人南 ＞ 赛前配置。
- 核查：主菜单 ＞ 测试模式 ＞ 三人立直麻将。
- 复现：输入 caseId 搜索，加载场景。默认完全控制、关闭 AI，采用注入同一 runtime 的测试时钟；观察席选择决定操作哪位玩家。
- 计时：每按“测试时钟＋5秒”确实推进权威时钟；暂停时不扣时。单步通过同一合法命令接口。
- 检查：自动检查实际运行注册动作和断言，并单独显示结果；“加载”不算通过。诊断报告含配置、seed、版本、代码指纹、预期／实际、动作和可恢复存档。
- 人工：每个场景的“待核查／通过／不通过”和备注只由用户决定。自动检查不修改人工结论；代码、规则、场景或配置指纹变化后旧结论需复验。本次没有代点人工通过。
- 保存：正式存档 `local-mahjong.sanma.saved.v1`，历史 `local-mahjong.sanma.history.v1`；测试独立 `local-mahjong.sanma.test.v1`。恢复时采用原比赛规则和剩余时间；全局设置不能改写存档。
- 回放：牌桌“规则与账本”→“从头回放”，支持逐步、快进10步、进度跳转；赛前“三人牌谱”可打开已完成的正式比赛。回放不运行 AI／实时超时，不重发历史动作声音。

## 专项页 S3-01～22 到可复现场景的映射

来源：[三人立直 V1 专项页](https://app.notion.com/p/3e3dc10ec1b5813e97f3fed82b50316e)，2026-09-22 回读。自动测试和浏览器使用同一个 `SANMA_CASES` registry；下列前缀可直接在 Tab 搜索。细分 case 的具体步骤、预期和断言位于 scenarios.ts / edgeScenarios.ts。

| 专项项 | 实際场景／证据 |
| --- | --- |
| S3-01 108牌／赤五 | SM-02-IDENTITY；wall.test.ts |
| S3-02 三席／两 AI／风位 | SM-01-EAST、SM-01-SOUTH、SM-02-IDENTITY；正式换庄浏览器路径 |
| S3-03 禁吃／碰杠 | SM-03-PON、MINKAN、KAKAN、ROBKAN、ROBANKAN；SM-09-ANKAN |
| S3-04 宝牌与无役 | SM-08-DORA、BONUS-NOYAKU；rules.test.ts 万子映射 |
| S3-05 拔北／连续／禁用 | SM-04-NORTH、CHAIN；SM-03-PON；SM-09-EMPTY、EIGHT |
| S3-06 保留／弃北／振听 | SM-05-KEEP、NORTH-PAIR；SM-14-TIME；rules.test.ts |
| S3-07 抢北／单响／双响／Pass | SM-06-ROB、DOUBLE、NOYAKU；SM-07-FURITEN |
| S3-08 立直北／振听 | SM-07-RIICHI-OLD-NORTH、FURITEN、RINSHAN |
| S3-09 一发／首巡／岭上海底 | SM-07-FURITEN、RINSHAN；rules.test.ts |
| S3-10 八次补牌／指标互斥 | SM-09-EIGHT、MIX-north-first、MIX-kan-first、EMPTY；wall.test.ts |
| S3-11 有损／无损／本场／包牌 | SM-10-LOW、MANGAN、DEALER、HANEMAN、YAKUMAN 各 LOSS／FULL；SM-11-HONBA、PAO-* |
| S3-12 不听罚符／无役听牌 | SM-12-TENPAI-0／1／2／3、NOYAKU-TENPAI |
| S3-13 双响优先与结算竞争 | SM-06-DOUBLE；SM-14-RACE、DUPLICATE、AUTO-ROB、RESPONSE-TIMEOUT |
| S3-14 途中流局／四杠 | SM-12-ABORT；SM-09-FOUR-ONE、FOUR-TSUMO、FOUR-ABORT、FOUR-RON、FIFTH |
| S3-15 整场结束／成绩 | SM-13-EAST-END、SOUTH-END、EXTEND、WEST、EXTRA-CAP、TENPAI-STOP、MIDTARGET、BANKRUPT-ZERO／NEGATIVE |
| S3-16 权威超时与预算 | SM-14-TIME、NORTH-BUDGET、PON-TIMEOUT、RESPONSE-TIMEOUT、RACE、DUPLICATE |
| S3-17 和／鸣／切 | SM-14-AUTO-WIN、AUTO-NORTH、AUTO-ROB；integration.test.ts |
| S3-18 中间保存／不赠时 | SM-15-RESTORE、BUDGET、RESPONSE-BUDGET、ISOLATION；正式保存恢复浏览器路径 |
| S3-19 确定回放 | SM-16-REPLAY、BOUNDARIES；integration.test.ts 四组合；longRun.test.ts 40整场 |
| S3-20 AI 私有信息边界 | SM-17-AI、PRIVATE-WALL；integration.test.ts；40整场合法命令 |
| S3-21 正式3D／长河／四北／结果 | SM-18-LONG-RIVER、SM-09-EIGHT、SM-06-DOUBLE；两档浏览器证据与截图阻断见验收报告 |
| S3-22 四人／17步／血战与生命周期 | 全仓测试、相关模式浏览器 smoke、旧存档测试；验收报告分别记录实际观察与未验证项 |

长牌河场景从正常108牌开局经合法摸切和碰形成，保留完整动作前缀并从开局验证回放。默认 seed=100 可以直接进入；其他 seed 若在2000步内无法形成会明确报错，不伪造牌河或强制算通过。四北和多杠使用独立场景，避免为了单张展示图拼出无法到达的历史。

## SANMA-6 推荐人工顺序

1. 正式菜单分别进入三人东／三人南，核对默认 35000／40000／40000、有损和可选无损、两 AI 与时间快照；实际摸切、拔北、推进一小局、保存退出再恢复。
2. SM-02-IDENTITY → SM-03-PON：三席与风位、可操作实体牌、不能吃、碰后必须弃牌。
3. SM-04-NORTH、CHAIN → SM-06-DOUBLE：真人拔北，电脑二先荣和，再电脑一荣和；第二响应前不结算，之后不补牌，拔北数不增加。本场、供托只归最近赢家。
4. SM-07-* → SM-09-EIGHT：观察立直、振听和补北。EIGHT 初始已有四杠及两北，再依次拔出剩余两北，核对8次补牌、5张表指示牌和四北显示。
5. SM-10-LOW-LOSS／FULL，观察席选电脑一并自摸：1000＋500 对比 1300＋800。再查满贯、跳满、役满与 SM-11-PAO-* 的逐笔账本。
6. SM-14-TIME 连按5次＋5秒，确认真实摸入北被弃出；NORTH-BUDGET 核对连续拔北不重获基础时间；开关“和／鸣／切”并读提示。
7. SM-13-* 的末局、追加场、零分／负分；SM-12-* 的流局；确认三列结果、排名和成绩。
8. SM-15-RESTORE、SM-16-REPLAY：保存响应、导入恢复、逐步／快进／跳转；检查相同账本、原支付策略和剩余预算。
9. SM-18-LONG-RIVER、SM-09-EIGHT、SM-06-DOUBLE 在1280×720与1920×1080检查完整构图、地面接触、手牌／副露／北区、动画、控件遮挡与点击；切观察席、resize、反复退出重入。截图异常尚未排除，需用户实际观看。
10. 每个核查项分别记录人工结论和备注，最后导出诊断。自动测试通过不能替代这一步。

## 2026-09-24 验收收尾（共享界面修正前的历史证据）

状态继续为 IMPLEMENTED_WITH_VALIDATION_BLOCKERS；SANMA-6 未批准。现行分项状态、AI deadline 契约、默认配置动作来源、指纹回归、截图对照和人工步骤见 [本轮验收记录](../artifacts/sanma-closeout/ACCEPTANCE.md)。2026-09-22 的记录保留为历史证据。

本轮修复 AI 在动画等待后才计算策略以及同预算续用误扣等待时间；四人 AI fixture 固定 seed=308 和第四席输入，保留严格断言。共享指纹使用平台无关路径及共享代码范围，人工输出不使指纹自激。最终三人155项通过；全仓2216通过、1个既有HUD失败、1个原有跳过；类型与构建通过。默认浏览器仅完成开局行动链和保存恢复，默认整场仍待人工。截图两接口对照不支持将异常百分之百归因工具；精确两档视觉、听感与人工Gate仍未通过。

## 2026-09-24 共享正式 UI 接入修正（现行）

三人东、三人南、测试 Tab 和回放已从 ParticipantTable 预览路径迁移到四人共同调用的 FormalGameScreen、FormalTable3D → Table3DScene，以及正式 HUD、LocalHandArea、动作栏、结果和回放组件。规则与 MatchRuntime 保留三人权威，真实 bottom/right/left 三席，不伪造第四玩家。必要扩展仅为只读适配、三人宝牌/结果、北区与 north_committed 共用动画。四人相机、桌体及 HUD tuning 未在本轮调整。

实际调用链与逐项复用见 [复用审计](../artifacts/sanma-shared-ui/REUSE-AUDIT.md)，验证范围、指纹、原始日志、截图阻断及人工步骤见 [现行验收记录](../artifacts/sanma-shared-ui/ACCEPTANCE.md)。最终全仓2226通过、1个既有HUD失败、1个原有跳过；三人155项与新增10项通过，类型、build、diff-check通过。

状态保持 IMPLEMENTED_WITH_VALIDATION_BLOCKERS。旧独立页面截图及受影响人工记录不能沿用为通过；精确两档视觉、听感、默认完整比赛和 SANMA-6 人工批准仍未完成。
