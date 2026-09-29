# HUD / 时间设置调整 — 2026-09-22

本轮沿用当前 feature/voice-pack-repository，HEAD 5620bbbb4f73fa1001d663f49c98ad88e75b58e8。开始前全部 V1 dirty/untracked work 与用户 tablePresentationTuning.ts 修改均保留。未 commit/push/发布；未同步外部文档。

## 实际修改

- 左下82px竖版浮层，默认展开：和/鸣/切纵向排列，右侧中部箭头；收起仅24px箭头入口。完整读屏名称、键盘操作、偏好勾选/禁止标识保留。
- 计时位于最下行，仅显示如 `5s 20s`，选牌显示 `120s`，不限时用 `∞`。等待或底层准备时不显示状态文案。时间行 title 为“前者为当前基础时间，后者为本局累计额外时间”。无面板说明块。
- 权威默认开放延迟由2500ms改为0；初次资源 readiness 仍保留。旧快照中的准备余时按新开放策略截断，不补基础/Bank预算。时间仍由 MatchRuntime/DecisionClock 决定，UI不触发到期动作。
- 四人进入权威可操作窗口后使用最终可交互手牌，动画快照不替代按钮；17步候选池与Ron面板不等待候选动画完成。点击候选牌取消旧表现后沿原权威命令入口提交。AI、结算pacing以及资源准备机制保留，没有修改规则合法性。
- 设置页说明移入现有圆圈问号 RuleHelpTooltip，保留用户给出的两段原文。普通状态无直接铺开的说明段落；支持悬浮/键盘焦点显示。
- 标签改为“响应基础时间（秒）”“小局累计额外响应时间（秒）”，底层出牌/响应共用逻辑不拆分。
- 17步选牌只有1/2/3/5分钟四个下拉选项；默认2分钟。旧设置草稿中非预设值归到2分钟，已有合法预设保留；运行/存档配置的合法旧数值仍兼容。

文件：App.tsx、Board.tsx、GameScreen.tsx、SeventeenStepsScreen.tsx、MatchClockHud.tsx、matchClockHud.css、TimeControlSettings.tsx、game/timeControl/config.ts、matchRuntime.ts、timeControl.test.ts。没有改动冻结Camera/Table/Hand/River坐标或AI策略。

## 自动验证

- `npm test -- src/game/timeControl/timeControl.test.ts src/components/SeventeenStepsScreen.test.tsx src/components/game src/components/ActionPromptRiichiCandidates.test.tsx`：196项通过。
- 修复复验：计时、participantBaseline、ai 三文件84项通过。随后新增旧准备窗口恢复测试，最终计时测试58项通过。
- 最终 `npm test`：1832通过 / 1原有失败 / 1原有跳过，239文件通过 / 1失败 / 1跳过。
- `npm run build`：通过，只有大chunk警告；build包括tsc，package没有独立lint/typecheck脚本。
- `git diff --check`：通过。

保留日志：`infra-v1-logs/hud-v2-*.log`。

开发中失败及处理：

1. 本轮17步Ron面板曾被ready条件从静态输出隐藏，已修复；原participantBaseline断言保持不变。
2. 一次全量出现既有 `ai.test.ts:296` 明杠可见牌计数5而非4。源fixture在随机createInitialGameState之后覆盖手牌，却未同步重建随机岭上牌；额外摸到白会形成第五个白实例。该测试、ai.ts、engine.ts、kanChecker.ts本轮无diff。单次定向及修复后的最终全量均通过，保留首轮失败日志；没有更改AI或降低断言。视为仍需另行整理的随机fixture风险。
3. 最终唯一失败仍为 `centralConsoleLayout.test.ts:26`，期望z2.3、实际1.9，对应开始前已有中央HUD offset修改。未改布局或断言。

## 内置浏览器检查

URL始终带mute=1，服务 http://127.0.0.1:5175/?mute=1 。

| 检查 | 结果 | 证据 |
|---|---|---|
| 普通四人1280×720 / 1920×1080 | PASS（所列项目） | innerWidth/Height核实；Canvas=1，requested/active=3d，fallback=none；无水平溢出；HUD与实际手牌按钮交集0 |
| 17步1280×720 / 1920×1080 | PASS（所列项目） | 同上；HUD与固定手牌、候选按钮交集0；原两人牌桌 |
| 展开/收起与键盘 | PASS | 展开仅和/鸣/切/数字及箭头；收起textContent为›，仅1按钮、宽24px；Enter重新展开 |
| 计时及出牌 | PASS | 无“操作准备中”；初次资源就绪显示5s/20s，真实点击四人手牌后进入下一状态；17步进入选牌即120s，选13确认并点击候选后轮到对手 |
| 设置文案 | PASS | 新标签可见；时间控制区域p数量0；tooltip默认opacity0，圆圈问号悬浮data-open=true且完整两段文案 |
| 分钟下拉 | PASS | 实际SELECT只有60000/120000/180000/300000，默认120000；已操作切换后恢复2分钟 |
| Legacy smoke | PASS | 因共享手牌边界修改单独进入?mute=1&table3d=0；Canvas=0/3D层0；即刻5s20s；真实点击出牌后AI继续 |
| Console | PASS（观测段） | 两模式error记录为空 |
| Network | 有限观测 | 记录141个普通模式事件；语音200、BGM和SFX206；无已捕获HTTP错误。2条canceled/ERR_ABORTED（Other/Media），事件缓存截断，不能宣称全会话完整无失败。17步短时捕获0个新请求，不作为音频成功依据 |
| 完整像素/逐帧效果 | NOT VERIFIED | 截图通道仍有缩放、灰带和重复片段；原图保留，不据此批准完整视觉 |

截图：hud-v2-tooltip-720.png、hud-v2-four-720.png、hud-v2-four-1080.png、hud-v2-seventeen-720.png、hud-v2-seventeen-1080.png。没有修图或伪造截图。

## 人工快速检查

1. 四人比赛信息→悬浮时间控制旁问号→说明仅悬浮出现，字段名称正确。
2. 开始游戏→看左下、点击箭头→展开竖排，收起仅箭头；有决策时直接数字倒计时，无固定前摇。
3. 正常摸牌及Ron窗口→立即点牌/Ron/Skip→不被手牌或候选动画快照挡住，不重复提交。
4. 17步设置→打开选牌下拉→只有1/2/3/5分钟，默认2分钟；确认构筑后仍只弃候选池。
5. 两种分辨率→展开分析/Ron/结果面板→实看字体、位置、动画交接及遮挡。本轮不代签完整视觉。

旧infra-v1-report.md为上轮历史记录；其中2500ms准备期、HUD说明块和自由选牌秒数已由本轮要求替换，以本文件及当前代码为准。
