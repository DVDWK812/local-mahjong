# 血战 V1 执行审计

规范：2026-09-22 附件及 Notion 3e3dc10ec1b581aaac6cf48f65a92180 第 16—21 节（已成功读取）。
起点：5620bbbb4f73fa1001d663f49c98ad88e75b58e8。原始修改见 start-status.txt / start-diff.patch；这些是用户已有工作，必须保留。

- 入口：src/components/LocalModeMenu.tsx 原按钮仅调用 onComingSoon；src/app/navigation.ts 没有血战模式 ID。沿用按钮接入 xuezhan，不另造菜单。
- 比赛配置：MatchSettings.tsx / SeventeenStepsMatchSettings.tsx，由 App.tsx 路由。血战配置接同一比赛信息流程，独立模式规则。
- 日麻权威：src/game/match/matchEngine.ts、src/game/engine.ts；日麻胡牌结束小局的语义不适用血战。
- 共享时钟：src/game/timeControl/{config,decisionClock,matchRuntime}.ts 已在用户未提交工作中，复用并增补通用准备阶段预算。
- 3D：Table3DScene、SceneCanvasHost 和 buildTableSceneState 的牌河/副露投影；保留四座、相机与坐标冻结值。
- 测试：src/game/testMode/catalog.ts、scenario.ts、resultsStorage.ts 与 TestModeScreen.tsx。血战复用用例元数据与类型，隔离场景和结果命名空间。
- 保存/回放：日麻 src/game/persistence 与 src/game/replay，17 步独立运行状态；血战使用带模式和版本标识的事件存档，不改旧格式默认值。
- 素材：使用已有 Tile、PlayerAvatar、外观设置、3D 场景与通用音效；不调用生成服务。

项目决议：摸牌统一从活墙前端取，无王牌；顺时针按固定座位 +1，逆时针 +3，对家 +2；允许负分默认；同分名次按固定座位稳定排序。首庄随机由比赛种子生成。所有计分用整数，番型 0–3 番、底分 1–100、局数 1–64、起分 0–1000000，自摸附加 0–3，杠倍率 0–16、花猪固定倍率 1–1024；按可达最大番数预检安全整数上界。配置依赖报错，UI 明示联动，不静默采用默认。四人 ID 和实体牌 ID 全程稳定。

验收状态：实现及自动复核结果见 report.md；人工复核尚未进行。
