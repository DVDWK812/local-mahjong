# 17-3D.B.2

本轮布局修正：PASS。此结论不关闭此前 B.1 的完整迁移 Gate，不宣称 17 步整体迁移完成。

## 改动

仅修改以下三个产品/测试文件：

- src/components/SeventeenStepsScreen.tsx
- src/presentation3d/participants/participantTable.css
- src/presentation3d/participants/participantBaseline.test.tsx

固定手牌改为左侧独立信息卡：7 列、固定两行，13 张仅展示的牌；分析在同一卡片内展开/折叠并局部滚动。固定牌宽 54–68 CSS px，大于 B.1 底部的约 43–56 px。

候选池改为底部中央 11 列、固定两行 grid，初始 21 张无需横向滚动，剩余 4 张也保留两行高度。牌宽约 37–46 CSS px，点击仍使用原 instanceId → discardCandidate。删除 B.1 的 DOM rect 跟随观察器和右侧单行候选浮层。荣和/跳过提示使用 17 步专用右侧浮层，避免原横条遮挡新候选池。

左右没有新增 participant、avatar、river 或 consumer。候选池和固定手牌都是本家模式 UI，未改变权威 fixedHand/candidates/river 分离。

起始 status/diff/hash 保存在 artifacts/17-3d-b2-start-*。最终 hash 对照确认：除上述三文件外，扫描的 presentation3d、game、components/game 以及 src/styles.css 全部与本轮起始一致。TABLE_CAMERA、FixedTableCamera、TABLE_SCENE_LAYOUT、桌面/牌河/HUD/宝牌/灯光 authority、ParticipantScene、SceneCanvasHost、普通四人 UI 未修改。既有 dirty/untracked 及素材保留；未写存档和配置。

## 浏览器证据

使用内置浏览器已有 Vite 服务及原 DEV fixture：

- http://127.0.0.1:5173/?seventeenFixture=ron&table3d=1
- http://127.0.0.1:5173/?seventeenFixture=last-turn&table3d=1

最初直接请求 1280×720 返回 1333×750，该阶段不记作目标视口通过。改用浏览器 viewport 覆盖后，一次比例校准请求 1229×691 得到 innerWidth/innerHeight **1280×720**；请求 1843×1037 得到 **1920×1080**。未修改产品 CSS zoom、Canvas scale、camera 或 DPR 来适配工具。

| 检查 | 1280×720 | 1920×1080 |
| --- | --- | --- |
| 左侧固定手牌 | 已观察 7+6 两行，约 54×75.86 px/牌 | 已观察 7+6 两行，约 68×95.53 px/牌 |
| 宝牌与固定面板 | 宝牌区底部约 167，面板顶部 190，无相交 | 宝牌区底部约 198，面板顶部 270，无相交 |
| 候选池 | 21 张两行，行顶约 601/657 | 21 张两行，行顶约 932/1001 |
| 初始候选命中 | 所有 21 张中心点 elementFromPoint 落在对应 button；真实鼠标点击第一行/第二行末张成功 | 所有 21 张中心点命中；真实点击第二行末张成功 |
| 本家头像 | 头像底部约 596.88，候选 grid 顶部约 598.86；标题靠右避开头像 | 候选 grid 从 x≈687 开始，头像右侧≈608，无相交 |
| 构筑/确认 | 原构筑选13张、确认、进入3D | 原构筑选13张、确认、Loading、进入3D |
| 连续弃牌 | 确定性 ron fixture 跳过后连续点击三次，21→18，固定13不变 | 构筑确认后的新局连续点击三次，21→18，固定13不变，双方各3张牌河 |
| 结果 | 本家荣和；另一构筑局对手正常荣和 | last-turn 流局、下一局；ron fixture 荣和 |
| Renderer | requested=3d / active=3d / fallback=none / Canvas=1 | 同左 |

观察到的真实运行画面中，固定手牌、两行候选及独立荣和提示均可见；中央 HUD 与上下真实桌面内容保留。ResultDialog 正常覆盖新 UI，未被候选池盖住。画面捕获仍有灰色余区和旧边界重复，完整应用画面在捕获的左上区域可观察；不把捕获像素尺寸当作 CSS viewport，不将这些捕获边界现象归因产品，也未重试帧流。

resize 的同一 session Canvas identity 不变。运行时 camera=[0,35,27]、FOV=32，未改变 baseline。返回菜单后实测 Canvas=0、固定面板=0、候选面板=0。Console 无新增 error；资源记录无 HTTP >=400，DOM 图片全部完成且 naturalWidth>0。最终场景 sprite=0、proxy=0。未在本轮重复 B.1 的 WebGL draw/clear 计数。

浏览器验收仅使用隔离 DEV 场景，不启动普通对局、不修改存档。临时视口覆盖已 reset，临时测试标签页已关闭。

## 自动验证

- Targeted：3 files / 15 PASS，17-3d-b2-targeted.log。
- npm test：230 files PASS / 1 既有 SKIP；1627 PASS / 1 既有 SKIP，17-3d-b2-tests.log。
- npm run build：PASS，17-3d-b2-build.log；保留已有 large chunk warning。
- git diff --check：PASS。
- 旧 B.1 的“固定手牌必须在底部”测试按用户明确新布局要求改为左侧展示/底部两行；保留身份分离、数量、隐藏信息、四人 authority、无动画 consumer 等断言，增加初始21实例与固定13禁用断言。

## 未验证 / 范围外

- 未提供无捕获边界瑕疵的原尺寸截图；本轮布局与点击结论来自实际可见画面、精确 CSS viewport 与真实交互的组合证据。
- 本轮未重复普通四人及三人预览的完整浏览器矩阵；其产品文件/布局 authority hash 未变，完整自动测试通过。
- B.1 中冻结头像/中央框与满牌河的历史视觉 Gate 未在本轮重新判定；本轮未改这些 authority。
- 未进入 17-3D.C / UI-6C，未添加候选手部动画或 pacing，未同步 Notion。
