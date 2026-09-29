# 三人座席与拔北语音验收 — 2026-09-27

状态：IMPLEMENTED_WITH_VALIDATION_BLOCKERS。SANMA-6 未批准；没有提交、推送、发布、生成音频或代填人工通过。

## 范围与文件

任务开始前的 dirty/untracked 工作保留，基线见 baseline/status.txt、tracked.patch 及源文件副本。全局 git diff 包含此前三人、四人、17步、血战与 HUD 修改，不能全部归为本轮。

本轮修改：

- src/presentation/table/sanmaPresentation.ts：唯一三席映射、鸣牌来源方向、宣言事件。
- src/presentation/PresentationEventBus.ts、src/audio/voice/voiceEvents.ts：north_declared → action.nuki。
- src/audio/voice/VoiceDirector.ts：缺失资源诊断。
- src/audio/AudioManager.ts：Voice 创建时遵守总开关和总音量，静音释放播放并通知结束。
- src/components/SanmaScreen.tsx、sanma.css：HUD 映射、回放观察席选择、会话身份及退出清理。
- src/App.tsx、src/components/TestModeScreen.tsx、SanmaTestTab.tsx：沿用现有 Director 的停止回调。
- src/game/sanma/scenarios.ts：三个可立即拔北场景。
- src/game/sanma/integration.test.ts、src/presentation/table/sanmaFormalScene.test.tsx、src/audio/voice/sanmaNorthVoice.test.ts：定向回归。
- docs/SANMA_V1.md：现行契约与人工入口。

未改规则、AI 策略、计分、牌山、存档版本、四人相机或 HUD 基线。

## 唯一映射与语音契约

sanmaSeatMapping(viewer) 从 Rules nextSeat 得到 [观察者, 下一位, 另一位]，投影到 bottom/right/top；left 无 participant。正式东／南、测试、保存恢复及回放均消费此适配，正式共享组件链保持不变。HUD 方向通过同一 physical seat 转换。副露来源先解析真实 participant，再比较映射后的物理锚点；没有用四人索引差计算三人规则关系。

真实 key 为 action.nuki。CSV、各包 manifest 均已有 audio/action_nuki.mp3。已核查 xiaozhang、voice-20260821-001、yaya-001 三包实体文件，大小和 SHA 见 nuki-assets.json。管理试听与对局共用 VoicePackRepository；开发资源为 /api/voice-packs/<packId>/audio/action_nuki.mp3，构建沿用既有 manifest 音频索引。

权威 north-declared → north_declared（真实 playerId、会话/小局/事件 declarationId）→ VoiceDirector → actor 的稳定 voicePackBySeat → Repository → AudioManager Voice。管理页 selectedVoicePackId、屏幕方向、庄家风位不参与音色身份。north 成立只发动画；被抢北仍有宣言请求，后续荣和沿用优先级抢占。没有等待语音或修改 deadline、preparePolicyCommand、PresentationPacing。

同 declarationId 使用共享去重；连续合法宣言有不同 id。恢复初始化与回放 seek 不发布历史转换，观察席只改变投影。重置新会话可正常重新宣言；退出/回放停止旧异步语音。发现并修复共享 AudioManager 原先创建 Voice 未检查总静音、未乘总音量的问题；静音停止正在播放的 Voice，解除静音不续播旧尾音。缺失资源保留现有策略，并记录 lastMissingVoice 的 actor、pack、key、reason。

## 实测证据与状态

源码指纹：92aab3bf6a7c5caf91c9a95f57b1ee458a306aba141688e57bb5008080bd68f7。

| 分项 | 状态与依据 |
| --- | --- |
| 实现 | 已实现，待人工；映射、事件、生命周期均有源码与集成测试 |
| 定向自动 | PASS：35 文件、370 测试，targeted.log；包含三人规则/计时/40场长跑、共享表现与音频 |
| 全仓 | FAIL：258 文件中256通过、1失败、1跳过；2245测试通过、1失败、1跳过，full-tests.log |
| 失败归属 | 既有 centralConsoleLayout.test.ts:26，期待2.3而当前1.9；严格断言和实现值均未调整 |
| 类型/build | PASS：types.log、build.log；仅既有 chunk 提示 |
| 浏览器 | 部分 PASS：当前版本三 actor 请求200、恢复不重播、回放切席/seek、长河加载；不能推为所有交互通过 |
| 视觉 | BLOCKED：精确 viewport 与截图存在尺寸/条带异常，需本机观察 |
| 听感 | NOT_VERIFIED：自动浏览器始终 mute=1 |
| 人工 Gate | NOT_VERIFIED：用户未批准，旧版本通过不继承 |

新语音集成13项使用真实 Repository 与 AudioManager，仅替换音频后端：真人合法命令、两 AI 的策略确实选 north；三者各自包 URL 命中并进入 Voice。覆盖抢北事件先后、连续/重复、非法/过期、StrictMode、恢复/seek、换庄/观察席、总/Voice开关及零音量、退出晚回调和缺失资源。布局13项含三个观察者、恢复/回放/庄家变化、北区/副露/牌河及动画方向。全仓涵盖四人、17步、血战共享回归。

第一次全仓误收集了 baseline 中的 .test.tsx 副本；副本改为 .tsx.txt 后完整重跑，保留 full-tests-including-backup.log。没有删除、跳过或放宽项目测试。最终日志对应上表。

## 浏览器与截图边界

最终服务器 http://127.0.0.1:5174/?mute=1。5173 已被原有服务器占用，未停止它。最初5173上的 SM-06-DOUBLE、SM-09-EIGHT 和截图仅为较早运行版本的诊断，不作为最终指纹的浏览器通过证据。final-* 文件均在5174核对当前指纹。

- final-three-actors.json：SM-04-VOICE-0/1/2 各策略单步后实际 MP3 请求200；浏览器当前三席均使用校长。不同角色包对应关系由上述真实资源集成测试证明，未声称浏览器听过三种音色。
- final-restore.json：SM-15-RESTORE 在拔北响应中保存，再经测试隔离导入恢复，历史拔北请求0。
- final-replay.json：SM-16-REPLAY 从头回放，观察席1/2/0均为 bottom/right/top，left空；逐步无历史拔北请求。
- final-captures.json：SM-15-RESTORE 与 SM-18-LONG-RIVER 的版本、CSS viewport、DPR、Canvas和Console；两个页面记录的Console错误均为空。

| 请求 viewport | 实际 CSS | DPR | Canvas 像素 | 截图像素 | caseId |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | 1333×750 | 0.959999957 | 1299×695 | 1389×781 | SM-15-RESTORE |
| 1920×1080 | 2000×1125 | 0.959999957 | 1955×1058 | 2083×1172 | SM-18-LONG-RIVER |

两档使用独立页面。较早同场景普通截图与CDP截图对照仍有异常，不能视为独立系统采集；当前 final-long-river-1080.png 仍有重复条带，final-restore-720.png 带灰色外沿。未调整相机/UI/系统DPI迎合截图，未修补图片。不能仅据条带判断应用错误，也没有充分独立证据认定百分之百工具错误。精确两档视觉、top区域遮挡、动画与pointer本机观感仍待核查。

## 用户本机核查

1. 打开5174，主菜单 → 测试模式 → 三人立直麻将。先保持完全控制（关闭自动AI）、暂停，按需单步；每个场景页面显示步骤与预期。不要把“加载”当作通过。
2. 听感时自行移除 mute=1，开启总声音和 Voice，音量大于零。为稳定玩家0/1/2分别配置现有校长/曼波/yaya，避免管理页试听选中项与玩家配置混淆。
3. 依次加载 SM-04-VOICE-0、SM-04-VOICE-1、SM-04-VOICE-2。真人点拔北；两电脑可单步策略，或关闭完全控制让AI行动。核对发声者、bottom/right/top、宣言与动画时点，以及只响一次。每次重新加载可重复核查。
4. SM-06-DOUBLE：真人拔北后两家依次荣和；核对宣言先发、响应结束前不结算、荣和各自音色。高优先级荣和可打断拔北，不等于漏发。
5. SM-09-EIGHT：连续拔出剩余两北，检查四北与多副露；切换三个观察席，完整玩家区跟随至top/right，left空。SM-18-LONG-RIVER：检查长牌河朝向、换行、宝牌/HUD遮挡、pointer与动画。
6. SM-15-RESTORE：响应中保存、退出、导入，不能补播宣言。SM-16-REPLAY：打开账本从头回放、切观察席、逐步及seek，left始终空且不补播历史语音。
7. 正式三人东、南均核对真人bottom及两个AI；换庄不交换人物/音色，保存恢复沿用身份。四人、17步、血战本轮未逐一重跑浏览器，自动回归通过不能代替其人工观感。
8. 本机分别建立1280×720、1920×1080窗口，用独立系统截图保留整张；同时记录CSS viewport、DPR、Canvas尺寸、PNG尺寸、caseId、上述指纹。核对听感、top区域、四北、长河和点击。人工结果仍由用户填写，旧视觉/听感需复验。

尚未验证：精确两档视觉、人耳听感、最终版本完整抢北/四北浏览器链、默认完整比赛和SANMA-6批准。未修复：既有HUD基线分歧。当前仅交付待人工核查版本。
