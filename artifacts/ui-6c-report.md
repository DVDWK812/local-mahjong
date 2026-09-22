# UI-6C — Animation Timing + SFX + Final Gate

日期：2026-09-19。结论：**UI-6C BLOCKED**；release gate **FAIL（缺少最终素材与必需人工 AV 证据）**。不宣布 FROZEN 或 UI ENGINEERING COMPLETE。

## A. Before Audit

原调用链：

```text
committed GameState → GamePresentationEventObserver → PresentationEventBus
  ├─ App / AudioPresentationConsumer → 立即 playSfx(draw / discard / chi|pon|kan)
  └─ HandAnimationConsumer → HandAnimationController → AnimationScheduler → contact / settle
```

Draw、Discard、Chi/Pon/Kan 均为即时 event playback，没有 semantic timing。Riichi、Dora、Ron/Tsumo 没有正式 SFX 接线；荒牌流局没有专属 SFX。不存在应保留的即时 win 音效。Riichi 的 BGM 与 Voice 为独立路径。

App 只对 game / riichi-17-steps 开启实时音频；Replay/Test 不允许。EventBus 不重放历史，原 App effect 会 unsubscribe，但旧 SFX consumer 本身没有 event/cue 去重。旧 consumer 已移除 EventBus 订阅，现在只连接一个 callback sink。

AudioManager 使用 HTMLAudioElement，createPlayback 时 preload=auto；没有 WebAudio decode/cache 管线。素材 URL 通过 MusicLibrary 异步 resolve。保留 draw/discard/meld 分组，Chi/Pon/Kan 共享 meld；保留 sequential / shuffle / repeat-one，one-shot 的 loop=false。没有新增音乐库、预加载阻塞或音频生成调用。

## B. Final Cue Contract

```text
confirmed presentation event
→ existing animation consumer/controller/scheduler
→ semantic cue callback
→ one AudioPresentationConsumer, guarded by realtime/feature policy
→ AudioManager.playSfx(), fire-and-forget
```

| 动作 | keyframe / authority | 音效 |
|---|---|---|
| 四人 Draw | grasp / progress=0；本家延续现有 DOM drawn contact 与 local draw progress；对手消费相同 scheduler phase | draw |
| 四人 Snapshot Discard | river-settle / progress=0，carry 已到 river destination | discard |
| 17 步 Candidate Discard | release / progress=0，既有 candidate curve 已到 river destination | discard |
| 非 snapshot / Legacy discard | release / progress=1，最终落下完成 | discard |
| Chi/Pon/各类 Kan | release / progress=1，transient meld tiles 最终落桌 | chi/pon/kan → meld 组 |
| Riichi stick | 独立 riichi event 的 release / progress=1 | riichi，当前无文件 |
| New Dora | 新增 dora_revealed identity；DoraIndicatorStack 确认该 instance 已提交到 DOM | dora，当前无文件 |
| 四人 Ron/Tsumo | 原 Win controller 的 push/reveal commit；Ron 仍先等待较早 discard pacing | win，当前无文件 |
| 17 步 Ron | 无 candidate frame 且 authoritative Ron reveal 已提交 | win，当前无文件 |
| 荒牌流局 | 无 win cue | 无 |

新 Dora 只来自同一手牌 indicator 列表的追加；初始 baseline、新局替换、Scene Ready、resize、shader sweep 均不会制造 reveal event。Riichi 声音不映射到 discard，因此不会因 RiichiDeclared 再打一次落牌声。

四人旧 Draw/Meld/Riichi 的 HandAction3D 原先自行以 performance.now/useFrame 插值，现改为消费同一 scheduler progress；保留原 motion resolver、phase durations、坐标与 grounding。未修改 Candidate 740ms plan、trajectory、source gap、compact river 或 pacing。

handAnimations=false 保留既有独立音频语义：animation consumer 发出 static-settled cue，不排队动画；presentationEvents=false 仍静音。Reduced Motion 与用户 skip 区分：新动作 snap settled 后可发一次 cue，用户 skip 不补播遗漏 cue。

## C. Exactly Once / Cleanup

- identity 为全局唯一 eventId + cueKind；callback 捕获 sink generation，controller 另持有 cancel/session generation。
- 单 sink 避免多音频订阅；保留跨 effect rebuild 的去重记录。close 留下 event tombstone，已取消/已跳过事件不能靠重建补播。
- 去重缓存上限 2048 项，retired sequence watermark 拒绝已淘汰旧事件，避免无限增长与旧事件复活。
- 动画 onPlayedFrame 不从 snapToEnd 调用；skip 前后、cancel 前后、async prepare 取消、dispose 均有测试。
- Win controller 新增 await pacing / prepare 后的 generation 检查，防止已取消和牌继续执行。
- AudioManager 新增独立 SFX generation；route exit / mute 会取消待 resolve 请求并清理当前 SFX。mute / volume=0 在选曲前返回，不推进 cycle。重新开启不补播。
- 无 await AudioManager/decode/play 阻塞动画；sink throw 被隔离。没有新增音频 timer、interval、永久 RAF 或第二 scheduler。

## D. Audio Assets

逐文件机器测量见 `ui-6c-assets.json`。六个分组文件都是 WAV PCM、48 kHz、16-bit、stereo、1.000 s、192078 bytes。它们是现有 project-local 素材，仓库中未找到 final 人工签收依据；不能自动称为 final。

| 文件 | 峰值（归一化） | 首个超过 −60 dB 的采样 | 满幅采样数 |
|---|---:|---:|---:|
| draw/draw1.wav | 0.3617 | 386.5 ms | 0 |
| draw/draw2.wav | 0.06369 | 179.2 ms | 0 |
| discard/discard1.wav | 1.0 | 16.3 ms | 57 |
| discard/discard2.wav | 0.1764 | 89.4 ms | 0 |
| meld/meld1.wav | 1.0 | 0 ms | 15 |
| meld/meld2.wav | 1.0 | 0 ms | 36 |

draw=2、discard=2、meld=2。riichi-stick=0、dora=0、win=0：**ASSET BLOCKED**。技术 fallback `default-tile.wav` 为 1004 bytes、0.060 s、8 kHz、mono、16-bit，未冒充缺失类别。

−60 dB 指标是 onset 检测，不等同于严格数字零静音或人工可听起点；满幅采样提示削波风险，不等同于已完成听感判断。长前导低电平足以使“调用同帧”不能证明“听起来同步”。未提前播放补偿、未裁剪/转码、未下载或生成素材。

## E. Browser AV QA

使用 Codex 内置浏览器，localhost:5173。真实 App 路径：主菜单 → 本地模式 → 立直 → 四人间 → 四人东 → 开始游戏；另执行继续对局。没有改变 Appearance/Audio 设置。

| Criterion | Result | State / evidence |
|---|---|---|
| 四人 3D 进入、Scene Ready | PASS | Canvas=1，active=3d，tableSceneReady=true；初始 AX 的 fallback 文案是 Canvas fallback 内容，最终实际 3D 成功 |
| 四席 draw/discard、手切/摸切 | PASS（调用/动作 smoke） | 实际牌局观察本家手切/摸切，三名 AI draw/discard；首轮诊断 8 cues 对应 8 calls，0–0.1 ms 调用差 |
| Chi/Pon | PASS（动作 smoke） | 真实 AI 吃、本家碰，后续弃牌正常；AudioManager call 记录含 chi/pon |
| Kan/Riichi/New Dora/四人 Ron/Tsumo 完整 AV | NOT VERIFIED | 有自动 controller/plan 验证；未完成真实四人浏览器完整矩阵，不以 Legacy win 代替 |
| 精确 1280×720 | NOT VERIFIED | override 校准后实测 1281×720，未改 Camera/CSS/DPR 补偿 |
| 精确 1920×1080 | NOT VERIFIED | override 实测 1920×1081；截图另存在外部灰边/缩放，不冒充完整精确像素签收 |
| 17 步 local/opponent 最后弃牌 | PASS（semantic trace） | last-turn fixture，两次 release/p=0 discard-impact，最终 17×17 流局，无 win cue |
| 17 步 Ron | PASS（semantic trace） | ron fixture，authoritative +12000 结果；一次 winning-hand-reveal-commit win-impact |
| 17 步实际 SFX 听感 | NOT VERIFIED | 独立 DEV fixture 无 App audio sink；仅追踪 cue，未绕过静音策略连接假播放器 |
| 3D route exit | PASS（smoke） | 四人确认退出后 Canvas=0、sprite=0；fixture 导航卸载；未完整覆盖每个 impact 前后退出组合 |
| 三人 preview | PASS（smoke） | Canvas=1；静止 draw/clear=0；退出 Canvas=0、sprite=0；未播放 Gameplay SFX |
| Legacy | PASS（轻量 smoke） | 显式 ?table3d=0，Canvas=0、3D layer=0，真实 draw/discard 与后续 win 可运行；导航清理 |
| 10 次人工听觉 AV / 四席 / Riichi 双声 | MANUAL BLOCKED | 没有人工扬声器听觉确认，且三类素材缺失；不能从调用时间推断听感 |
| mute UI 即时修改/route/refresh 持久化 | NOT VERIFIED（浏览器） | manager/settings/storage 自动测试通过；本轮未改用户持久化设置完成 UI 矩阵 |
| Replay/Test 实际浏览器静音 | NOT VERIFIED（浏览器） | semantic sink policy 自动测试通过，真实页面完整路径未跑 |

截图：`ui-6c-four-1080.png`、`ui-6c-seventeen-720.png`、`ui-6c-seventeen-final.png`。
时序：`ui-6c-browser-calls.json`、`ui-6c-legacy-calls.json`、`ui-6c-seventeen-final.json`、`ui-6c-seventeen-ron.json`。
注意：HMR 后的两份 call 日志仅保留 AudioManager calls（动态 import 的旧模块 wrapper 不再观测 active cue module），不能据此宣称逐 event 去重已获浏览器完整证明。17 步 trace 使用核对后的实际模块 URL。所有临时 monkey-patch 随导航清除，viewport override 已 reset。

Console：观察期间未捕获新的应用异常；存在既有 THREE.Clock deprecated 警告。Network：观察到两条 canceled Media/ERR_ABORTED，期间发生 HMR/导航；早期 buffer 被截断，未取得完整可归因请求链，因此全矩阵 Console/Network clean **NOT VERIFIED**。

## F. Performance

四人静止采样 draw=189136→189136、clear=1868→1868，sprite=0、DOM proxy=0；Dora active count=0。三人 preview 静止采样 draw=0、clear=0。SceneCanvasHost 与 frameloop=demand 未修改。音频没有新增 render driver。

未加 preload：现 backend 仅创建元素时 preload=auto。没有证据把延迟归因于 backend 而非已测得素材 onset，故未重写 AudioManager。未向 Scene Ready 添加音频 blocker。

## G. Regression

自动覆盖：旧 AudioManager 的 BGM、Riichi BGM、temporary playback、shuffle/sequential/repeat-one、settings/storage；新静音不推进游标、route/mute 后 pending resolve 不复活。Replay/Test 的 policy denied cue 不补播。Appearance、Scene Ready、Rules/AI/17 步回归包含于全量测试。

未修改 Rules/GameState/Scoring/AI、HandVisualController、Hand Pack、Appearance schema、冻结 camera/table/anchors、17 步 compact layout、Voice/MP3 或 SceneCanvasHost。原始 dirty work 保留；标准 npm lifecycle 自行刷新既有 ignored voice indexes，未编辑 Voice 资源。

## H. Engineering / Review / Gate

- 首轮 targeted：184 PASS。
- 扩大 targeted：714 PASS；最后 static-policy targeted：26 PASS。
- 全量首跑因新增 Dora event 顺序破坏原 Kan→Draw 断言失败；移动 Dora 发布位置修复，保留原断言与 `ui-6c-full-first.log`。
- 第二轮全量 `ai.test.ts:308` 随机 fixture 失败；未修改 AI/Rules，保存 `ui-6c-full.log`，原样复跑 `ui-6c-full-rerun.log` 为 1683 PASS / 1 既有 SKIP。
- 最后 static-policy 补丁后的最终全量：**1684 PASS / 1 既有 SKIP**，233 个测试文件通过；`ui-6c-full-final.log`。最终 build **PASS**：`ui-6c-build-final.log`；最终 diff-check **exit=0**：`ui-6c-diff-check.log`。
- build 已通过，仅既有 chunk-size warning；diff-check 通过；无新增 SKIP、无删除旧测试、无放宽断言。
- 只读复查了完整本轮变更与调用处；已修复 audit 中发现的即时音频 authority、Win await 后 stale generation、mute/route 后 async resolve、handAnimations flag 兼容问题。复查未发现额外可操作代码缺陷；这不替代缺失的浏览器/人工 AV gate。
- 本轮源码/测试文件清单：`ui-6c-changed-files.json`。初始 status/stat/hash：`ui-6c-start-*`；已有 48 个 tracked dirty files 和大量 untracked 基线，不把它们计作本轮全部修改。

### Remaining gates

1. **ASSET BLOCKER**：缺 riichi-stick/dora/win；现有 draw/discard 前导低电平与若干满幅采样须素材确认。不得假素材或代码负延迟补偿。
2. **MANUAL AV GATE**：精确 720p/1080p、人耳至少十次四席弃牌、Draw/Meld/Kan/Riichi/Ron/Tsumo、完整 mute/Replay/Test 与 Network 矩阵未关闭。
3. **CODE BLOCKER**：未识别剩余确定代码缺陷；但未验证行为不被提升为 PASS。
4. **EXTERNAL 17-3D.D GATE**：既有 `17-3d-d1-report.md` 仍为 BLOCKED/人工最终确认待完成；本轮不代签。

停止于 UI-6C，不启动 MP-1、不加 Hand Pack/三人玩法、不调用外部生成 API、不更新 Notion、不提交或推送。
