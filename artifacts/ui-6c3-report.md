# UI-6C.3 人工 Gate 缺陷修复报告

日期：2026-09-20。范围：AV-04、11、12、13、14、15、18、19。未 commit/push。

**UI-6C.3 MACHINE FIX GATE PASS**

**UI-6C BLOCKED — HUMAN MANUAL AV/VISUAL RE-GATE**  
**17-3D.D BLOCKED — HUMAN MANUAL VISUAL RE-GATE**

发布总 Gate：**FAIL（人工验收未关闭）**。机器修复通过不表示整体 UI 冻结。

## 逐项修复

| ID | 问题与根因 | 修复 | Machine QA | Manual pending |
|---|---|---|---|---|
| AV-04 | 手切后 generic arrange 路径先经过旧 gap，再发生第二次排序搬移 | 捕获实际 drawn DOM rect；落牌后直接返回新摸牌，抓取后搬至 final insertion slot，最后让位/释放 snapshot；本家不再 generic sweep | PASS：连续坐标/端点测试与浏览器轨迹；无第二只手 | 是，连续动作自然度 |
| AV-11 | draw mask 在 prepare 才生效；补牌已提交但还在等 Kan，静态牌先露出 | 在 confirmed draw 入队时预留现有 ownership/mask；准备时仍走共享 draw controller，settle 后 handoff | PASS：Ankan、Minkan 正式 action 自动测试；浏览器暗杠静态源隐藏 | 是，肉眼只摸一次 |
| AV-12 | stick 使用了普通牌 grounding，release 又抬起；旧 lane 被中央 HUD 遮挡 | 修 stick grounding 与 release 手/棒连续端点；集中 lane 径向外移至 5.2，四席共享 static/proxy target | PASS：四席端点测试；720/1080 四席投影与 HUD 无交集 | 是，不卡顿及两声音感 |
| AV-13 | Dora 在事件到达/DOM commit 时立即揭示，未等 Kan settle | confirmed presentation 顺序为 Kan→Dora→补牌；Dora 作为 pacing participant 等前序 settle，再 commit/cue；取消和跨局关闭 pending run | PASS：meld→dora→draw 各一次；媒体均开始/结束 | 是，实际听觉顺序 |
| AV-14 | 小倾角仍像立牌，旧 hold 680ms；结果很快覆盖 | Ron 全部公开牌 rotationX=0 并按 flat grounding；有限 scheduler hold 3000ms，结果等 gate | PASS：浏览器平放 13 张；hold 约3009.7ms 后 cleanup/result；双 Ron、skip/cancel 测试 | 是，完整倒牌/3秒可读性 |
| AV-15 | Tsumo 与 Ron 共用整手 push/reveal | Tsumo 去掉 push；只抓取真实 drawn winning tile，scheduler progress 驱动拍桌、impact rong、手撤回 | PASS：DOM 仅1张代理、原 drawn 源隐藏；四席目标变换测试；无第二次整手 reveal | 是，拍牌自然度 |
| AV-18 | 17步正式 screen 没有共享强 overlay/win controller，旧静态 cue 与结果直接出现分离 | 正式 screen 接共享 win/overlay/pacing；最小 winner view 从 authoritative ResultViewModel 取得 fixed13+winning tile；与 App 原 AudioManager 集成 | PASS：正式 App DEV fixture 入口和 Final Gate 都验证；rong 一次、14张、overlay→result | 是，人耳及完整视觉 |
| AV-19 | 17步未接 round-end overlay；四人 terminal 状态会过早停用最后手部动作 | 两玩法共用 strong「流局」overlay；等最后动作 settle，有限 readable hold 后结果；保留 terminal 动画 owner | PASS：17步720/1080见「流局」先于结果；2次discard、0rong；四人共享 controller/event 自动测试 | 是，流局呈现自然度 |

## 关键表现合同

- Ron：前序 winning discard settle → 共享荣和 overlay / 完全公开平放 → rong once → **3000ms hold** → cleanup → ResultDialog。hold 使用 AnimationScheduler finite wait，没有新增永久 RAF/interval。多个赢家按队列逐个展示，已经公开的赢家保持公开；跨局清理 revealed IDs。等待前序的 fail-open 上限为15000ms，避免第二个 Ron 被旧2500ms上限抢跑。
- Tsumo：真实 winning drawn tile → grab/carry/slap → impact rong → retract → 既有结果 pacing。仅1张代理，保留 instance/red/Appearance/Dora 语义。本家复用已加载 TileFaceDomAppearance。没有第二次整手推倒。
- Draw：authoritative round end → 等 final action settle → 中央「流局」（strong，700ms readable hold，另有180ms lead-in/140ms enter/140ms exit）→ ResultDialog；不增加 SFX。
- 17步 Ron：候选弃牌结束后经正式 result/observer，共享 WinPresentationConsumer/Controller、EventOverlay 和 AudioPresentationConsumer。牌来自现有 ResultViewModel 的 concealedTiles + winningTile，不重新算番符，不公开未和牌候选。对家和牌不会隐藏本家 fixed grid。

AV-18 原人工报告中的“完全无声音/结果无牌”在本轮基线机器执行中**未完整复现**：基线部分路径已有 rong backend 请求和13+1结果牌。确认的产品缺陷是正式 screen 缺共享胜利表现和等待链；不能把此前 trace PASS 当成实际听感 PASS。本轮另从真正 App 挂载路径复验，不只跑 harness。旧独立 seventeen fixture 页面不挂 App AudioManager，不能用于代表生产音频。

## 浏览器与性能证据

- 使用内置浏览器。重点8项已逐项执行；AV-12/14/15/18/19 在实际 CSS **1280×720、1920×1080** 检查。四席 stick clearance 是从真实场景/camera/中央HUD投影检查，四席 overlap=false；底席另直接截图观察。
- AV-13 示例实际顺序：meld media start 295606.8；Dora commit 296314.6 / media start 296378.1；draw contact 296546.3 / media start 296710.6。各1次。调用/媒体时间不是扬声器声波时间。
- Real App 17 Ron：rong1 backend start 10275.1，volume=.64、muted=false，ended 11381.7；同次 App voice/BGM 正常。Result 为权威13+1。未修改用户音频/外观设置。
- AV-14 720p：hold 363579→cleanup 366588.7；result 366696.5。完整13张3D手牌 rotationX=0。
- 静止窗口实测约18.6秒：frameloop=demand，WebGL drawDelta=0、clearDelta=0、sprite=0、DOM proxy=0、scene proxy=0。退出后 Canvas/proxy/sprite=0。未单独用声卡测延迟，也未测 Ron hold 每一个毫秒的 GPU 计数。
- 最小回归：普通 draw、Chi；Legacy 显式 table3d=0：Canvas=0、3D层=0，draw/discard 各一次、media ended、退出无残留。
- Console：编辑过程中 Fast Refresh 留下两条 useEffect dependency 数组长度变化日志；完整刷新后的复验没有新增同类错误。既有 THREE.Clock deprecation / renderer diagnostic warning 保留。
- Network：最后一次 Legacy 捕获的215条响应无失败/HTTP>=400；缓冲区标记 truncated，因此这不是整轮所有请求零错误的证明。前序重点场景媒体开始/结束已有 trace。
- 截图工具存在宿主合成灰边/缩放区域问题；实际 CSS viewport 由页面读取确认。未为截图改产品 Camera/CSS/DPR。截图可观察完整牌桌区域，但动态流畅度仍需要人工复验。
- `MANUAL LISTENING PENDING`；`DYNAMIC MANUAL VISUAL PENDING`。Kakan和多Ron没有逐个浏览器手工演练；Kan自动覆盖Ankan+Minkan，多Ron/skip/cancel自动覆盖。四人流局本轮以共享controller/event和全量测试验证，直接浏览器流局观察为17步。

## 工程验证与差异归属

- Targeted：21文件 **206 PASS**；最后生命周期修订后再跑核心4文件 **42 PASS**（含新增 manualGateFixes 19项）。
- `npm test` 最终：**237 files PASS，1766 tests PASS，1 existing SKIP**，没有新增 skip。
- `npm run build`：PASS；保留现有大chunk warning。
- `git diff --check`：PASS；Git 的 LF/CRLF 提示不是 diff 错误。
- 首轮 full 的3个失败已保留日志：都是旧事件顺序、旧倾角、旧lane断言，按本次明确的新合同更新；没有改AI/Rules换绿测。
- 498个 `src/music` 文件与任务开始快照逐字节一致；无裁切/转码/生成素材。
- 开始的 dirty/untracked 全部保留。`ui-6c3-start-status.txt` / `ui-6c3-start-stat.txt` 记录基线。相对任务开始的差异在 `ui-6c3-only.diff`、完整文件清单 `ui-6c3-changed-files.json`。
- 37个源码文件相对开始有差异，其中 `src/audio/audioBackend.ts` / `.test.ts` 的 automation mute 变动为本任务期间出现但未归属于本轮修复的既有/并发工作，已保留；不把它们归功于本轮。其余35个文件是本轮修复/测试/DEV入口。
- 只读审查：覆盖完整任务差异、消费者/目标/调度/pacing、ownership、清理和测试。**No actionable findings**（针对修复后本轮范围）。未把人工 pending 升级为发布 PASS。

证据文件：`ui-6c3-browser-evidence.json`、`ui-6c3-assets-unchanged.json`、`ui-6c3-full-first.log`、`ui-6c3-full-verified.log`、`ui-6c3-targeted-final.log`、`ui-6c3-targeted-last.log`、`ui-6c3-build-final2.log`、`ui-6c3-diff-check.log`。截图以 `ui-6c3-ron-*`、`tsumo-*`、`seventeen-ron-*`、`draw-*`、`riichi-*` 保存；早期与最终证据字段并存，立直使用 `sticks720Final` / `sticks1080Final`，手切使用 `tedashi720Final`。

## 用户复验顺序

1. 打开 `http://127.0.0.1:5173/?testMode=1&uiFinalGate=1`，明确勾选 QA 音频（不持久化）。
2. AV-04 → AV-11 → AV-12 → AV-13 → AV-14 → AV-15 → AV-18 → AV-19。
3. 在720p与1080p重复 AV-12/14/15/18/19。必要时点击「重演动作」。
4. 重点：手切直接拿新摸牌；补牌只出现一次；meld先于dora；立直棒可见；荣和平放约3秒；自摸只拍1张；17步14张+rong；流局大字后结算。
5. 用 `AV-xx PASS` 或 `AV-xx FAIL：具体观察` 回报。原 VIS-01～04 的人工17步视觉 Gate 仍独立保留。

没有进入 MP-1、新 Hand Pack、三人玩法或 Notion 同步。没有自动勾选人工 PASS。
