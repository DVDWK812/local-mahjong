# 三人立直 V1 验收收尾 — 2026-09-24

状态：IMPLEMENTED_WITH_VALIDATION_BLOCKERS。最终 Gate：FAIL（既有严格 HUD 测试失败，精确两档视觉／听感与用户人工 Gate 尚未通过）。本轮没有提交、推送、发布、付费生成或填写人工通过。

| 维度 | 当前状态 | 证据范围 |
|---|---|---|
| 实现 | IMPLEMENTED_WITH_VALIDATION_BLOCKERS | 保留 SANMA-0～5，仅本轮计时、可靠性和核查入口修复 |
| 三人自动测试 | PASS | 最终全仓中的 155 项三人测试，含 40 场策略长跑、8 场权威 runtime 整场 |
| 全仓回归 | FAIL | 2216 通过、1 失败、1 原有跳过；唯一失败是 HUD z 基线 |
| 浏览器交互 | PASS（本轮已执行路径）／其余 NOT_VERIFIED | 默认开局、真人拔北弃牌、两 AI 策略行动、暂停、保存恢复及 9 个场景入口；不代表全部交互或完整比赛 |
| 视觉／听感 | BLOCKED／NOT_VERIFIED | 两档实际 CSS 尺寸偏离目标；1080p 对照图重复片段；自动化静音，听感未验收 |
| SANMA-6 人工 Gate | NOT_VERIFIED，未批准 | 人工状态保持待核查，旧证据不自动继承 |

1. 本轮发现与修复

- AI 的 chooseSanmaAction 原本位于 runPacedAutomaticAction 回调中，权威决策却已开始计时。动画等待超过 1 秒时，策略还没有执行就被 timeout 取代。
- 改为先计算并交给 MatchRuntime.preparePolicyCommand；正常节奏仍通过 PresentationPacing 提交。到期时若有有效、未取消且对应当前 decisionId 的选择，由 MatchRuntime 执行该选择。取消／决策替换会使选择失效，未提交或无效的选择继续走原超时规则。两名响应者分别登记选择。
- 拔北／杠同预算续用按策略收到时刻扣时，而非动画完成时刻；否则后续决策会错误继承被动画耗尽的预算。未增加 UI 时钟、额外 setTimeout 或延长 deadline。
- 原有共享脚本的 snapshotId、commit、buildMode 行为保留。只修改列在 closeout-existing-files.patch 中的既有文件，并新增定向测试／证据 helper；另外为 longRun 返回值补默认点数与动作来源字段，输出转入本目录。
- 场景加载后的侧栏此前未展示 manualFocus，现补齐，并写明暂停、单步、AI 关闭、逐席关闭自动操作和人工取消静音方式。

2. AI 计时契约与证据

真人与 AI 使用同一比赛 TimeControlConfig；每席各自持有基础时间／本小局 Bank，并不共用真人席 Bank。默认 5 秒＋20 秒，短时验证为 1 秒＋0 Bank。DecisionClock 唯一决定 opensAt、startedAt、deadline；没有独立 AI UI 计时器。

当前 AI 是同步、有限候选枚举的启发式选择，没有独立可抢占 CPU 的 worker 计算上限。选择必须在通用权威 deadline 前交付；计算／主线程调度若真的超过 deadline，仍拒绝迟到选择并执行超时后备。已及时交付选择后的 presentation 等待不扣 AI 计算预算，deadline 也不会被动画无限延后。真人仍按实际操作接收时刻扣时。

运行时审计新增 ai-policy，与 manual、auto-win、suppress-calls、auto-tsumogiri、timeout 分开。测试控制台的“单步推进”通过手动控制入口，不冒充后台 AI 策略审计。

- timing.test.ts：15 项通过，包括正常／1 秒、策略早交付、等待跨 deadline、明确自动摸切、未交付 fallback、取消，以及 8 场真实 MatchRuntime 整场。
- runtime-runs.json：seed=308；两长度×两支付×两时间；35000／40000／40000；1624 次 ai-policy、840 次测试驱动的 manual、0 timeout。manual 由测试驱动模拟真人命令，不声称是真人浏览器整场。
- long-run-results.json：40 场、seed=1～10、两长度×两支付，全部默认 35000／40000／40000。11132 次策略动作，另列下一局转换；0 显式自动操作、0 timeout。它直接调用策略／引擎，没有时钟，clockCoverage 明确为 none-direct-policy；不能单独证明计时正确。
- default-flow-save.json：本轮正式浏览器 seed=3468751524，默认东场／有损／默认点数和时间。真人拔北、弃中后 AI 两席分别产生 ai-policy，计算接收用时约 20.6ms、12.5ms；这四步为 manual×2、ai-policy×2、timeout=0。暂停后保存恢复，sequence=4、phase=turn、Canvas=1。默认完整比赛尚未取得浏览器证据。

3. 偶发测试与指纹

ai.test.ts 原失败记录是预期 discard、实际 draw，不是非法吃。fixture 只替换前三席，随机第四席可能产生合法碰候选，进入 call-window；advanceAIAction 本次先 Pass，返回 draw，尚未执行下一次摸牌。新增固定第四席一万对子的对照 fixture 稳定复现这个额外 Pass 步骤；原“非下家不能吃、后续 discard、下家行动”严格断言全部保留。第四席改为明确无关手牌，全部该文件的墙／宝牌／补牌 RNG 使用 LCG seed=308；原合法下家吃牌测试保留。最终 24 项通过（four-ai-final.log 与 full-suite.log）。

共享指纹 v2：路径统一为 /、稳定字典排序、路径与内容长度分帧；包括 src 全部 TS/TSX/JS/MJS/CSS/JSON/shader、scripts、package/lock、Vite、tsconfig 与 index.html。共享 Rules、AI、PresentationPacing、fixtures 不被排除。保留原 music 媒体目录排除，代码指纹不等于媒体资产校验；听感仍单独人工核查。

xzBuildStamp.test.ts 10 项通过，覆盖 Windows/POSIX、同内容同范围、共享源码／规则／fixture 变化、输出不自激、HMR。evidence.test.ts 1 项通过：旧自动通过显示需复验、旧人工通过显示待核查，原存储记录不被改为新版本通过。浏览器 final-entry-dom.txt 还实际显示 SM-06-DOUBLE 的旧自动记录“需复验”、人工“待核查（版本变化）”，未改原人工数据。三人使用该 helper，血战仍使用同一 virtual:xz-build 的 fingerprint 比较；血战相关回归及共享结果存储测试通过，未改血战 UI 的人工结果。

最终工作区 fingerprint：ddd16ebf44726797db359a653b7e873ffbac357c6cff0e2ec54f83f5b71f10fd。commit 只是原 HEAD 5620bbbb4f73fa1001d663f49c98ad88e75b58e8，并不表示未提交工作已进入该提交。见 build-stamp.json。

4. HUD 基线仍待用户决定

当前 hudOnlyOffsetZ=-0.1，计算 z=1.9；严格测试预期 z=2.3，对应原 offset=0.3，相差 -0.4。查阅 infra-v1-audit.md、infra-v1-report.md、hud-v2-qa.md、SANMA 历史验收和 xz-6r 相关记录，只有“原有 dirty 修改，未改断言”的说明，没有发现明确设计／人工批准证据。本轮没有选定 1.9 或 2.3，也没有修改坐标或期望值。

5. 当前自动验证

| 命令／范围 | 本轮结果 |
|---|---|
| 定向初跑 | 40 PASS；保留日志 |
| runtime 完整比赛 | 初跑暴露模拟驱动顺序与续用预算问题，修复后的 15 项 PASS；中间失败日志保留 |
| 三人、共享计时、血战、四人 AI、指纹、结果存储定向 | 18 文件 467 项 PASS（scoped.log；当时四人 AI 为23项） |
| 最终 npm test | 254 文件 PASS、1 FAIL、1 原有 skip；2216 PASS、1 FAIL、1 skip；exit=1 |
| 最终三人测试 | 155 PASS，包含在上述全仓中 |
| 最终四人 AI／共享计时／指纹／结果存储 | 24／58／10／4 PASS |
| npm run check:types | PASS（types-final.log） |
| npm run build | PASS（build.exit.txt=0）；仅已有大 chunk 警告，未开展拆包 |
| git diff --check | PASS（exit=0） |

没有运行或声称存在 lint 命令。sandbox 初跑 esbuild spawn EPERM 是执行环境限制，随后获自动批准在可启动子进程环境中执行。所有实际测试失败均保留日志，不以重复通过替代根因分析。

历史报告区分：artifacts/sanma-v1/ACCEPTANCE.md 是 2026-09-22 的交付记录；其 final-tests.log 曾有 AI+HUD 两失败，final-validation.log 后为 2185 PASS／1 FAIL／1 skip。本轮源码、测试数量、动作审计与截图结论以本目录为准，不把旧报告文字当成本轮复验。旧 1000 点快速整场仍只是边界浏览器证据。

6. 视觉采集对照与阻断

独立新标签分别加载 SM-18-LONG-RIVER、seed=100；未调整摄像机、UI 或系统 DPI。继承浏览器已有比例使请求尺寸与 CSS 实测不符；没有反复补偿比例迎合截图。

| 环境 | 请求 | CSS 实测 | DPR | Canvas 像素／CSS | 原始图 |
|---|---|---|---|---|---|
| 新标签 3 | 1280×720 | 1333×750 | 0.959999957 | 1333×609／1333×610 | 主通道实际 JPEG 1389×781（原文件名 .png）；CDP PNG 1280×720 |
| 新标签 4 | 1920×1080 | 2000×1125 | 0.959999957 | 2000×958／2000×958 | CDP PNG 1920×1080 |

720 主通道有灰边、缩放；同场景 CDP 能显示完整画面。1080 CDP 仍有重复片段。两个接口仍共享内置浏览器／合成环境，不能当作完全独立的外部浏览器或屏幕采集；不能据此断言应用有错或百分之百只有工具故障。截图时工作区前缀为 6800b91c34d3；之后只补四人 fixture 根因测试，最终前缀 ddd16ebf4472。图像未经裁切、拼接或修补。capture-files.json 记录真实文件格式，不把 JPEG 误报为 PNG。

默认路径 Console 无 error，存在 THREE.Clock 弃用警告。default-network.json 共42事件、未截断、无 HTTP >=400；有2条 canceled ERR_ABORTED，其中一条可关联 Shanghai Gambit.wav，另一条 Other 无对应 requestWillBeSent 记录，不能声称全部资源完成。静音不等于听感通过。

用户本机采集：分别开两个干净浏览器窗口，开发者工具设备视图设置 CSS 1280×720／1920×1080，确认 window.innerWidth/innerHeight、devicePixelRatio、canvas.width/height 与 clientWidth/clientHeight。加载同 caseId、seed，暂停、完全控制，使用浏览器原生 Capture screenshot，并另用系统截图对照；记录 PNG 实际尺寸及当前 Tab 指纹。若两渠道不同保留两份原图，不修补。听感核查由用户移除 mute=1、重新加载并在声音设置解除静音；自动化仍保持 mute=1。

7. SANMA-6 人工入口和步骤

运行 npm run dev，打开 http://127.0.0.1:5173/?mute=1 → 测试模式（开发者）→ 三人立直麻将。搜索精确 caseId，再点“加载 caseId”。9 个入口本轮浏览器均实际加载；steps、expected、manualFocus 均显示，人工仍待核查。8个核心入口明细见 case-entry-check.json，长牌河另见截图及 metadata。

| caseId | 人工操作和观察 |
|---|---|
| SM-06-DOUBLE | 真人拔北，切席分别荣和；先一席响应时不提前结算，第二席响应后一次完成双响；看账本／供托／北区 |
| SM-10-LOW-FULL | 电脑一自摸；核对2番30符、无损1300＋800与逐笔账本 |
| SM-14-TIME | 推进测试时钟至到期；只弃真实摸入北，不自动拔北；检查单次推进和按钮 |
| SM-09-EIGHT | 按场景继续拔剩余两北；检查4杠＋4北、5宝牌指示、补牌与区域遮挡 |
| SM-18-LONG-RIVER | 三席切换，观察真实合法动作形成的超过18张牌河；两档检查换行／副露／北区／中心遮挡 |
| SM-13-EAST-END / SM-13-SOUTH-END | 真人自摸；检查相应常规末局、终局三列与排名 |
| SM-15-RESTORE | 抢北响应中保存／导出，从测试隔离导入入口恢复；检查已响应者不重问、未先补牌 |
| SM-16-REPLAY | 拔北、自摸，打开规则与账本，从头／逐步／快进／跳转；检查账本一致且回放不重跑AI |

先暂停、勾选“完全控制（关闭 AI）”；“关闭自动操作”只清当前观察席，逐席清除。暂停时点“单步推进”后仍暂停。需要本人点具体动作时先继续；注入测试时钟不会自行流逝。“测试时钟＋5秒”有意推进权威时钟，可能触发超时，不当作 AI 策略动作。场景自动检查通过不能替代人工选择。

默认完整比赛仍由用户在本地模式→立直麻将→三人间，保留35000／40000／40000与5秒＋20秒，分别选择两长度和两支付，核查连庄、追加场、整场结果、保存恢复与牌谱。1000点快速模式不替代这项。

8. 尚未验证／未修复

- HUD 1.9／2.3 设计批准待用户；全仓仍 FAIL。
- 精确两档 CSS 的完整布局、逐帧遮挡／动画／pointer 和听感未完成人工核查。
- 默认完整比赛尚无本轮浏览器整场证据；8场 runtime 是自动集成，不冒充浏览器真人。
- 1080p 截图重复片段归因未定，720p 对照仅说明两个接口输出不同。
- 本轮未重新执行四人／17步／血战／Legacy 全套浏览器流程；其自动回归通过，历史浏览器证据仅历史有效。
- AI没有独立可抢占CPU上限，长主线程停顿仍可能使未交付策略超时；本轮修复的是动画等待错误占用，不宣称任意设备／后台挂起均零超时。
- SANMA-6 未获用户批准，交付为待人工核查版本，不是 COMPLETE／FROZEN。
