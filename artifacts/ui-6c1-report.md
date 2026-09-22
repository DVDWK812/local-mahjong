# UI-6C.1 — Final SFX Integration / Settings 验收报告

日期：2026-09-19。范围：本轮新增素材注册、六类音效选择/自定义界面；以 UI-6C.1 开始时的 dirty worktree 为基线，不把此前 UI-6C/UI-6A/UI-6B 修改计入本轮。

**UI-6C.1 CODE / ASSET INTEGRATION PASS**

**UI-6C BLOCKED — MANUAL AV GATE**。未宣布 UI-6C FROZEN / UI ENGINEERING COMPLETE。Release gate 范围结论：PASS WITH RISKS，风险为下文明确保留的人工 AV 与未重测项。

## A. Assets

磁盘实际是 `effects/win/rong1.wav`、`effects/win/rong2.wav`，并不存在 `effects/rong/`。保留目录与文件名，注册到逻辑 group `rong`。没有移动、重命名、裁切、转码、生成或下载音频。

| Group | Count | 实际文件 |
|---|---:|---|
| draw | 2 | draw/draw1.wav、draw/draw2.wav |
| discard | 2 | discard/discard1.wav、discard/discard2.wav |
| meld | 2 | meld/meld1.wav、meld/meld2.wav |
| riichi | 2 | riichi/riichi1.wav、riichi/riichi2.wav |
| dora | 2 | dora/dora1.wav、dora/dora2.wav |
| rong | 2 | win/rong1.wav、win/rong2.wav |

以上 12 个音效均为非空 PCM WAV，48 kHz、双声道、16 bit、1.0 秒、192,078 bytes/文件。另有历史 default-tile.wav 兼容资源，不属于六类正式池。新六文件均通过浏览器真实 Audio 元素播放并收到 ended，没有媒体 error；URL 与实际文件名一致。

用户确认 draw/discard/meld 听感满意；新增素材由用户作为最终素材提供。此前 onset/peak/clipping 仅保留诊断，**不作为 ASSET BLOCKER**。开始/结束哈希比较：音频内容变更 0。不存在本轮 ASSET BLOCKER。

证据：ui-6c1-assets.json、ui-6c1-start-asset-hashes.json、ui-6c1-browser-new-assets.json。

## B. Mapping / Authority

| Semantic cue | SFX group | 沿用 UI-6C 的语义节点 |
|---|---|---|
| draw-contact | draw | grasp/contact |
| discard-impact | discard | 四人 river-settle；17 步 candidate release/settle |
| meld-impact | meld | release 完成 / 最终落桌 |
| riichi-stick-impact | riichi | stick release 完成 |
| dora-reveal | dora | indicator-commit，仅新 indicator |
| win-impact | rong | 四人 push commit；17 步 winning-hand-reveal-commit |

Ron/Tsumo 共用 rong，不新增两个播放器池。保留旧 `win` 调用名作为兼容 alias，同样解析到 rong。流局没有 win cue。没有修改动画 phase、时长、scheduler、UI-6A/6B motion、17 步轨迹/紧凑牌河。仍是 semantic cue → AudioPresentationConsumer → AudioManager；没有恢复即时 GameEvent 音效路径。

## C. Settings / Custom / Preview

六类共用 SfxGroupSection + MusicTrackList：可勾选内置/自定义参与池；保留 sequential/shuffle/repeat-one；单曲模式提供明确曲目选择。显示当前模式、已选数量及内置/游戏库副本/外部文件来源。每类均有添加、复制导入、试听、删除/隐藏、恢复默认。

- 使用既有 MusicLibrary + IndexedDB Blob/FileSystemHandle 存储与 object URL 引用生命周期；偏好只新增稳定 ID 列表 sfxAssetIds，不保存 Blob/Object URL。
- 旧三类模式/选择保留；新三类默认 sequential。恢复默认只作用当前类别，恢复内置池/顺序/模式，保留已保存自定义文件。
- 删除当前 custom 清除目录与选择/顺序引用；选择失效回退本类别 builtin。
- Blob 缺失、resolve 异常、play rejection、播放中 media error：释放后最多回退一次同类别 builtin，generation/mute/route guards 继续有效。
- SFX preview 复用 AudioManager 管理的一次性播放、通道音量、并发限制和 release；独立 preview cancellation generation，不进入 PresentationEvent/cue/dedupe，也不推进游戏 cursor，不暂停/重启 BGM。停止 SFX preview 不会停止已有 temporary BGM；自然结束/关闭/切换语音管理/退出均清理。
- 没有第二套二进制库、无人管理的 audio 元素、定时器或 WebAudio 重写。

浏览器完整 vertical slice：摸牌导入仓库 WAV 副本 → 试听 → 仅选 custom → 刷新仍选中 → 删除回退双 builtin → 恢复默认。另对新 rong 分类实际导入 WAV、单曲选择、刷新、试听、关闭、删除、恢复默认，证明新增分类经 IndexedDB normalize 后不会丢失。测试副本已删除；音效开关已恢复开启。未重置用户整体音频、Voice 或 Appearance 设置。

## D. Layout / Browser

| 检查 | 结果 | 直接证据 |
|---|---|---|
| CSS viewport 1280×720 | PASS | 实测 innerWidth=1280、innerHeight=720 |
| CSS viewport 1920×1080 | PASS | 实测 innerWidth=1920、innerHeight=1080 |
| 左右面板等高 | PASS | 两尺寸 SFX/Voice 均约419.995px；同一 top |
| 弹窗完整在 viewport 内 | PASS | 720p top≈16、height≈687.785；1080p top≈90.104、height≈900 |
| SFX 内部滚动 | PASS | flex:1、min-height:0、overflow-y:auto、overscroll-behavior:contain、scrollbar-gutter:stable |
| 滚轮不带动 Voice/header/footer | PASS | 左列表 scrollTop 0→1322.917；外层 body 保持490.625，Voice scrollTop=0、top≈215.072 |
| 末项及自定义可达 | PASS | 实际滚到和牌、导入/试听/删除/模式控件可操作 |
| Voice 功能结构 | PASS | 原语音开关、音量、报牌范围、座位分配、角色管理保留；仅必要等高/滚动 CSS |

弹窗高度仍沿用原 min(900px, viewport-32px)，没有增高。使用纯 CSS 420px 共同行高；列表增加不会扩大弹窗。没有 JS 测高、ResizeObserver/interval 同步尺寸。弹窗主体仍可滚动至 SFX/Voice 所在行，进入该行后音效内容独立滚动。

截图：ui-6c1-720-settings.png、ui-6c1-720-scroll.png、ui-6c1-1080-settings.png。浏览器截图输出存在宿主缩放/灰区伪影；尺寸证据来自实际 CSS viewport 和 DOM 边界，没有修改 Camera/CSS/DPR 来伪造尺寸。

## E. Gameplay / Policy

使用 artifacts/ui-6c1-harness.html 的隔离开发验收页：加载仓库现有 validated test scenarios，以 applyOfficialTestModeAction 分派到正式 Rules 入口，挂真实 Board/SeventeenStepsScreen、AnimationScheduler、AudioPresentationConsumer、AudioManager、BrowserAudioBackend。此页不挂 App TestMode，也未绕过或改变 App Test/Replay 静音政策；只用于可重复的有声集成验收。正式 App 路径另行验证。

| 项目 | 结果 | 证据 |
|---|---|---|
| 四人 draw/discard/pon | PASS | 真实 App `/` 继续对局→碰→本家弃牌→3 家 AI 摸切→本家摸牌；9 个有效 SFX 请求对应9次媒体调用 |
| 暗杠 / 新 Dora | PASS | STAB-001-ANKAN 正式暗杠；dora indicator-commit→dora1、meld release1→meld1、draw grasp0→draw1，各一次 |
| Riichi 两段 | PASS | UI-RIICHI-DISCARD-WAIT-PREVIEW；discard1@river-settle、riichi1@release1，各一次，cue 间隔约899.8ms |
| Tsumo | PASS | 既有地和场景，正式弃牌/摸牌/自摸；win push0→rong1 |
| 17步 Ron | PASS | 既有 ron fixture，点击正式荣和；winning-hand-reveal-commit→rong2 一次 |
| 17步 candidate/local/opponent/final Draw | PASS | last-turn：点击当刻无 discard；随后本家与对家 release0 各一次 discard，最终流局无额外 rong |
| 初始 Dora / sweep | PASS | 初始 fixture 无 dora cue；稳定窗口与后续 scene/sweep 未新增 dora 音效；生产代码没有把 shader sweep 接入音频 |
| SFX mute/unmute | PASS | 真实 App 关音效后8个动作仍推进，但无新增 SFX媒体播放；重新开启无历史补播 |
| Preview 与 BGM | PASS | 真实浏览器临时播放 Double Down，播放/停止 rong1 后当前 BGM仍播放；自动测试覆盖 cursor 隔离和清理 |
| Replay/Test policy、skip/cancel/speed | PASS（自动） | 现有及新增 targeted/full tests；未改政策或 timing |
| Legacy shared-audio smoke | PASS | 显式 ?table3d=0，Canvas=0、3D layer=0，基本摸切与退出运行 |

真实 App与夹具日志分别为 ui-6c1-real-app.json、ui-6c1-gameplay-fixtures.json；不要把夹具误写为真实 App完整稀有动作路径。cue→backend 创建通常在同一调用帧（记录约0–0.2ms）；HTMLMediaElement.play promise 完成包含加载/启动时间，且不等同扬声器输出时间。本轮没有以机器时间替代人耳 AV 判断，也没有提前触发 cue 来补偿素材。

## F. Engineering / Review / Limits

- Targeted：33 files，272 tests PASS（audio、settings、semantic cue）。
- Full `npm test`：234 files PASS，1713 tests PASS；1 file/1 test 是原有 skip，未新增 skip。
- `npm run build`：PASS。保留现有 large-chunk warning，不进行无关拆包。
- `git diff --check`：PASS。
- 首轮 targeted 6处失败来自新分类/本类别 fallback 引入后的旧固定断言，已按新合同更精确更新。保留 ui-6c1-targeted-first.log。
- 首次 full误收集 artifacts 内测试源码备份（5个备份 suite相对导入失败）；备份改为 .snapshot 后原样运行产品测试通过。原始日志 ui-6c1-full-first.log 保留；未删改/skip 产品测试以换绿。
- Console：没有在最终产品路径观察到应用异常。保留既有 Three.Clock deprecated/renderer DEV诊断。隔离 QA页热更新曾出现 createRoot重复挂载警告；另一次 CDP日志表达式语法错误属于诊断脚本，已重录，不作为产品错误或通过证据。
- Network：新六 WAV实际成功播放并结束；夹具 backend播放成功，未观察到必需资源失败。CDP长窗口曾报告截断，因此不声称完整全会话网络抓包。
- 本轮没有新增 permanent RAF、interval、audio timeout 或 pacing barrier，没有改变 Scene Ready 或 demand renderer。没有新增 preload；沿用当前 Audio元素 preload/cache。未对整个音库预热。
- 只读复查覆盖本轮独立 diff：重复 audio authority、Rules耦合、fixed-delay、generation/preview cleanup、custom fallback、旧偏好兼容、Voice/BGM边界。收尾问题修复并回归后：**No actionable findings**。

### NOT VERIFIED / 保留 Gate

- **MANUAL AV GATE**：本轮未进行人耳/声卡实际输出同步验收。需用户在真实环境试听六类动作；不宣称毫秒级扬声器精度。
- 浏览器未单独重测四人 Ron（已测 Tsumo）、全部 Kan种类（已测暗杠）、全部 linked-file picker授权/文件搬移组合、MP3实际导入、Replay完整浏览流程；现有自动测试覆盖相关共享合同。当前任务要求的 custom WAV完整slice和Ron或Tsumo路径已完成。
- 本轮未重新量测稳定窗口 WebGL draw/clear计数；renderer/动画文件未改，完整回归通过；保留 UI-6C demand基线，不把它声称为本轮新测量。
- **EXTERNAL 17-3D.D GATE**：既有最终人工视觉 gate 未在本轮关闭。
- 没有 MP-1、新Hand Pack、三人玩法、外部生成/API、Notion、commit/push。

### 本轮代码文件

- `src/App.tsx`
- `src/styles.css`
- `src/components/AudioSettingsDialog.tsx`
- `src/components/settings/AudioSettingsPanel.tsx`
- `src/audio/audioBackend.ts`
- `src/audio/AudioManager.test.ts`
- `src/audio/AudioManager.ts`
- `src/audio/AudioPresentationConsumer.test.ts`
- `src/audio/AudioPresentationConsumer.ts`
- `src/audio/audioRegistry.ts`
- `src/audio/musicLibrary.test.ts`
- `src/audio/musicLibrary.ts`
- `src/audio/musicLibraryStorage.ts`
- `src/audio/musicPreferences.ts`
- `src/audio/musicRegistry.test.ts`
- `src/audio/musicRegistry.ts`
- `src/audio/musicTypes.ts`
- `src/components/AudioSettingsDialog.test.tsx`
- `src/audio/audioBackend.test.ts`

用户新增素材目录 `src/music/effects/{riichi,dora,win}/` 原样保留。开始/结束 status、diff-stat、独立 diff及测试日志均位于 artifacts/ui-6c1-*。
