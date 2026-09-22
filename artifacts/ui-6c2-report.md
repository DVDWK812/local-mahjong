# UI-6C.2 — Final Manual Gate Test Mode / Codex Preflight

日期：2026-09-19。验收范围：本轮 DEV harness 与机器 preflight。用户原有 dirty/untracked 保留；无 commit/push。

UI-6C.2 TEST MODE HARNESS PASS  
MACHINE PREFLIGHT PASS

UI-6C BLOCKED — HUMAN MANUAL AV GATE  
17-3D.D BLOCKED — HUMAN MANUAL VISUAL GATE

MANUAL LISTENING PENDING。DYNAMIC MANUAL VISUAL PENDING。
本报告不宣布 UI-6C FROZEN、17-3D.D PASS 或 UI ENGINEERING COMPLETE。

## 入口与隔离

`http://127.0.0.1:5173/?testMode=1&uiFinalGate=1`

普通 Test Mode 用例库新增折叠入口。Final Gate 仅 DEV 且 testMode=1 与 uiFinalGate=1 同时存在时挂载。
默认 QA Audio OFF；可显式勾选开启，或显式 URL qaAudio=1。开关与人工勾选均只在当前页面内存，不写生产设置。
普通 `?testMode=1&testAnimations=1&qaAudio=1` 已通过正式暗杠实测：Canvas=1、3D、Final Gate 控件=0、媒体调用=0。Replay 的原有 consumer policy 不变，相关全量测试通过。

Harness 使用独立内存 MusicLibrary 与受管理的 AudioManager，播放真实 builtin；不写入用户选择游标、音频库或存档。读取 Appearance，未修改素材、手部轨迹、相机、牌河参数、SFX timing 或规则。

## MACHINE PREFLIGHT

| ID | Scenario | Machine preflight | Manual required |
|---|---|---|---|
| AV-01 | 本家摸牌 | PASS | Listening |
| AV-02 | 对手摸牌 | PASS | Listening |
| AV-03 | 本家摸切 | PASS | Listening |
| AV-04 | 本家手切 | PASS | Listening |
| AV-05 | 下席弃牌 | PASS | Listening |
| AV-06 | 右席弃牌 | PASS | Listening |
| AV-07 | 上席弃牌 | PASS | Listening |
| AV-08 | 左席弃牌 | PASS | Listening |
| AV-09 | 吃 | PASS | Listening |
| AV-10 | 碰 | PASS | Listening |
| AV-11 | 暗杠 | PASS | Listening |
| AV-12 | 立直 | PASS | Listening |
| AV-13 | 新增宝牌 | PASS | Listening |
| AV-14 | 荣和 | PASS | Listening |
| AV-15 | 自摸 | PASS | Listening |
| AV-16 | 17步本家弃牌 | PASS | Listening |
| AV-17 | 17步对手弃牌 | PASS | Listening |
| AV-18 | 17步荣和 | PASS | Listening |
| AV-19 | 17步最终流局 | PASS | Listening |
| VIS-01 | 720p 满牌河 | PASS | Visual |
| VIS-02 | 12→13 紧凑过渡 | PASS | Dynamic visual |
| VIS-03 | 1080p 满牌河 | PASS | Visual |
| VIS-04 | 1080p→720p resize 后弃牌 | PASS | Dynamic visual |
| QA-01 | 运行时静音/恢复 | PASS | Listening |
| QA-02 | impact 前取消 | PASS | Listening / cleanup |
| QA-03 | impact 后退出 | PASS | Listening / cleanup |
| QA-04 | Reduced Motion | PASS | Listening / visual |

AV-01～19 在最终干净页面再次全部执行，逐个等待对应媒体结束。每个 eventId + cueKind 的计数都是 1。

- Draw：grasp@0 → draw。
- 四人 discard：river-settle@0 → discard。手切/摸切通过已有 DOM 手牌按钮捕获起点。
- Chi/Pon/Ankan：release@1 → meld。
- Riichi：discard-impact → discard，随后 riichi-stick-impact → riichi；各一次。
- Dora：indicator-commit@1 → dora。初始 counts={}；杠后等待扫光 35.5 秒，cue 未增加。
- Ron：winning discard 先 river-settle，之后 push@0 → rong。
- Tsumo：push@0 → rong；媒体结束后无重复。
- 17-step candidate：release@0 → discard；对手仍使用正式 AI/动作入口，没有 draw cue。
- 17-step Ron：winning-hand-reveal-commit@1 → rong；最终 Draw 仅两次 discard，没有 rong。
- 1x / 2x 同一弃牌事件到 cue 约 419.7 / 231.9ms，继续同一 river-settle keyframe，无固定音频 offset。

Trace 来自 AudioPresentationConsumer 的只读诊断 callback 与实际 backend create/play/ended/error；正式事件来自现有 PresentationEventBus 的只读订阅。没有第二个音频 consumer 或 SFX 时钟。
调用/媒体事件时间不是扬声器声波时间，不能替代人耳确认。

## 视觉、清理与性能

实际 CSS viewport：1280×720、1920×1080。两者 Canvas=1、active=3d、fallback=none。

- VIS-01/03：正式17步 renderer，真实 state 的 river counts=17,17；直接观察满34张牌，未见 avatar/HUD/candidate header 遮住牌河。VIS 场景仅 DEV 隐藏结果弹窗，便于看完整牌桌。
- VIS-02：正式 candidate action 将 12,12 推进到 13,13；已观察手部动作中与落定状态。完整运动自然程度由用户确认。
- VIS-04：同一 session 从1920×1080切到1280×720，随后直接点击候选牌；Canvas identity=true，完成13,13，无残留。
- 17步稳定窗口17.3秒：drawDelta=0、clearDelta=0、sprite=0。另以真实 R3F scene traversal 核查 candidate-discard-proxy / table-animation-3d 均为0；67.5秒窗口 frameDelta=0。
- QA-01：静音 action 有 cue、无媒体调用；开启后不补播，下一次新 action 正常播放。
- QA-02：正式 discard event 后立即取消，未出现 cue；独立 HTMLMediaElement.play 计数没有增加，Canvas=0。
- QA-03：impact 后退出只有一条新增媒体调用，Canvas=0。
- QA-04：reduced-motion-settled@1 一次，媒体结束，无旧动画延迟音。
- 重演重新创建 fixture 与新事件；不重放旧 PresentationEvent。就绪检查使用有限 MutationObserver，完成/取消即断开，无新增 RAF、interval、polling 或 timeout。
- 人工勾选交互测试后刷新：1/27 恢复0/27；这些测试勾选不是人工验收结论。

截图：ui-6c2-vis01-720.png、ui-6c2-vis02-settled-720.png、ui-6c2-vis03-final-1080.png。
内置浏览器原生截图存在宿主缩放/灰色合成区域；实际CSS尺寸与完整场景已通过DOM/renderer与截图联合确认。额外CDP截图ui-6c2-vis01-clean.png被工具裁切，不作为完整构图证据。

## Engineering

- Targeted：121 PASS / 8 files（ui-6c2-targeted-final.log）。
- 首次 full：1743 PASS + 1 FAIL + 1 existing SKIP。既有 src/game/ai.test.ts:308 随机fixture：expected discard, received draw。保留 ui-6c2-full.log。
- 原样复跑：1744 PASS + 1 existing SKIP。
- 最终代码 full：1744 PASS + 1 existing SKIP / 237 files（ui-6c2-full-final.log）。未新增 skip、未改 Rules/AI。
- Build PASS（ui-6c2-build-final.log），仅已有 bundle size warning。
- git diff --check PASS（ui-6c2-diff-check-final.log），已有 CRLF 提示不属于 whitespace error。
- 干净最终 AV 矩阵 Console errors=[]。开发过程中修改 effect 依赖产生一次 HMR-only 警告；刷新后未复现。
- Network 观察窗口没有失败的 required requests；所有19个音频场景有真实 media ended 证据。长会话最终历史缓冲曾 truncated，不能宣称保留了整个会话每一条请求。
- Legacy release smoke：显式 table3d=0，Canvas=0，正式暗杠正常完成，无 crash。
- 只读最终 review：No actionable findings。范围为本轮14个源码/测试文件；已检查单音频authority、policy、generation/cleanup、无第二时钟、无规则修改、fixture与正式动作、motion override 的DEV隔离。

完整证据：ui-6c2-fresh-av-matrix.json、ui-6c2-browser-evidence.json、ui-6c2-network.json、ui-6c2-network-final.json、ui-6c2-console-final.json。
本轮相对初始dirty工作区的diff：ui-6c2-only.diff；初始/结束状态与文件清单亦在本目录。

## Changed files

- `src/main.tsx`
- `src/audio/AudioPresentationConsumer.ts`
- `src/components/SeventeenStepsScreen.tsx`
- `src/components/TestModeScreen.tsx`
- `src/components/game/WinPresentationOverlay.tsx`
- `src/presentation3d/animation/useTableAnimation3D.ts`
- `src/presentation3d/participants/useCandidateAnimation.ts`
- `src/dev/finalGate/finalGate.css`
- `src/dev/finalGate/FinalGate.test.tsx`
- `src/dev/finalGate/FinalGate.tsx`
- `src/dev/finalGate/route.ts`
- `src/dev/finalGate/scenarios.test.ts`
- `src/dev/finalGate/scenarios.ts`
- `src/presentation/animation/QaMotionContext.ts`

## 用户点击顺序

1. 打开上述入口，勾选“显式开启 QA 音频”。
2. AV-01→AV-19，点“重演动作”；AV-03 摸牌后再点“执行下一动作”完成摸切。重复弃牌至少10次，覆盖四席、摸切与手切。
3. 1280×720：VIS-01、VIS-02；折叠面板查看全桌。VIS-02 点“重演动作”反复看12→13。
4. 1920×1080：VIS-03。
5. 先在1080p选择VIS-04，再缩到720p，直接点击候选牌。不要在resize后点重演（那会新建session）。
6. QA-01～04，分别使用临时静音、取消/退出、减少动态效果；必要时用重演恢复fixture。
7. 每项人工检查后再勾选；用 `AV-xx PASS` 或 `VIS-02 FAIL：…` 报告结果。

NOT VERIFIED：人耳音画自然度、完整动态过渡的人工主观确认、物理声卡延迟。用户最终人工确认仍未关闭。

本轮限定范围 gate decision：PASS（仅 UI-6C.2 harness 与机器 preflight）。上级 UI-6C / 17-3D.D release gates 仍 BLOCKED；代码/机器结果不替代人工发布许可。
