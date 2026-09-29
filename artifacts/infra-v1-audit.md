# INF-0 — 2026-09-22

工作目录：C:/Users/Wenkai/Desktop/UNSW/local-mahjong-voice-phase1。
分支 feature/voice-pack-repository；HEAD 5620bbbb4f73fa1001d663f49c98ad88e75b58e8。
原有 dirty：src/presentation3d/table/tablePresentationTuning.ts 一行（hudOnlyOffsetZ 0.3→-0.1，对应计算后中央 HUD z 2.3→1.9）。不覆盖。

附件和 Notion 3e3dc10ec1b581669b2dfe3a3666e8a0 正文已读取。连续执行采用本次用户授权。本地历史 17-3D.D.1 仍有人工视觉未验项，不沿用历史 PASS。

## 实际调用链

- 四人：App MatchSettings → startConfiguredGame → startMatch → withRules → ActiveGame。Board 共享 TablePresentationContract → App.updateGame → engine/callChecker/kanChecker → recordGameStateTransition。
- 自动推进：App effect → runPacedAutomaticAction → PresentationPacingGate.waitUntilClear → advanceAutomaticGameState → draw/AI/立直摸切。目前仅 seat 0 为真人，其他为既有 AI；不新增多人规则裁定或改变 AI 强度。
- 响应：engine.discardTile 优先建立真人 Ron 窗口；passRon 结算振听后可能进入同张牌 call-window；Pass 必须复用此链且不能重发预算。declareRon 保留现有多家和牌规则。
- 真实摸牌实例：PlayerState.drawnTile；庄家初始十四张亦设置 drawnTile。吃碰明确清空 drawnTile。legalDiscardTiles 管理食替，discardTile 还校验阶段和立直。
- 杠：kanChecker 暗杠可直接岭上；加杠经过 chankan/kakan-declaration，再 resolveKakan/rinshan。需要延续原回合预算。
- 17 步：SeventeenStepsScreen 局部 state → selectFixedTile/moveFixedTile → confirmBuild。源码确认目前仅 13 张结构条件，不要求听牌、役或番缚；番缚在和牌入口判断。34 张 source → 13 fixed + 21 candidates。正式只能 discardCandidate，不存在摸牌。
- 17 步 submitDiscard 同步 Rules 后 capture 动画，动画 busy 会阻挡下一个输入；AI effect 等 Pacing，Ron 面板也等动画 frame 清空。须先解耦为 Match 有上限的过渡窗口，表现被动清理；不能按动画完成起算。
- 四人 GameScreen：DOM 手牌资源/布局 ready → TableRenderer / SceneCanvasHost；必须将初次资源准备与思考时间分开。
- 保存：App.createSavedMatch → LocalStorageAdapter；version=1。显式退出保存为本地暂停。17 步当前无可靠保存/续局、无既有 replay；本轮不虚构该能力，退出终止 session。
- 回放：eventRecorder → MatchLog → ReplayDetail / replayEngine；回放不创建计时 runtime。

## 决策

采用 5 秒基础 + 每小局 20 秒 Bank，17 步独立 120 秒；显式不限时类型。数值上限集中校验。新比赛开关全关；新小局保留和/鸣、关闭切。旧存档按不限时迁移。后台按单调时间差结算；显式保存暂停，恢复重建时间域。计时服务与原有状态 owner 结合，不建立第二套规则状态。

## 基线

- npm test：首次沙箱 EPERM（scripts/verifyVoicePackIndex Node spawn），保留 infra-v1-logs/infra-v1-baseline-test.log。
- 原命令获权限后：1774 PASS / 1 FAIL / 1 existing SKIP；238 passed files / 1 failed / 1 skipped。失败 centralConsoleLayout.test.ts:26 正是用户已有 HUD z 调整；保留原输出 infra-v1-logs/infra-v1-baseline-test-escalated.log，不改断言。
- package scripts 无独立 lint/typecheck；build 内含 tsc。
