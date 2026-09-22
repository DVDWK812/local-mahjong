# 17-3D.B.1 布局修正报告

结果：**17-3D.B.1 BLOCKED — 精确目标视口的完整视觉门禁待人工确认**。

实现已完成，双人正式对战真实使用 3D。未关闭 17-3D.B；未进入 17-3D.C、UI-6C 或 Notion。17 步整体迁移尚未完成最终 Gate。

## 根因与修正

原 B 构图差异来自模式专用的双列 grid（右侧 minmax(250px, 27%)）、容器 padding/尺寸、独立 camera（[0,39,29]、FOV 48）、独立牌河/手牌偏移、9 列牌河、默认 tile scale，以及小横向玩家卡。并非 WebGL fallback，也未使用 CSS 放大 Canvas 掩盖。

双人现直接引用四人 authority：TABLE_CAMERA / FixedTableCamera；TABLE_SCENE_LAYOUT 与 getHandTileTransform / getRiverTileTransforms / getRiverTileRotationY；TABLE_PRESENTATION_TUNING / getHandTileScale / getAvatarFrameTuning / getLocalHandScreenOffset；TableLighting、TableMesh、CentralConsoleHudAnchor3D、Table3DPlayerFrame、DoraIndicatorStack 及原 table3d.css。四人原背景、雾、地面原样提取为唯一 TableEnvironment，两个正式 composition 共用；所有原数值保持。

SceneCanvasHost / SceneContentReady / 资源缓存保持唯一，未修改 session 实现。普通四人完整四席 contract 和 composition 保持。无 Rules、AI、Scoring、tile geometry、camera、layout authority、Dora scheduler、snapshot 或动画时序改动。

## 最终区域与身份

- 数据仍只有 seventeen:0 → bottom/config slot 0，seventeen:1 → top/config slot 1。左右无玩家、手牌、牌河、HUD 或动画 consumer；不补假 GameState。
- 固定 13 张手牌位于普通四人底部 DOM local-hand-area--screen-space，使用同一 CSS 尺度/锚点，不带候选弃牌动作或普通摸牌位；不重复显示。
- 上下竖版头像复用四人 frame，按 participant.appearanceSlot 解析头像、昵称、牌背与 Hand Pack。
- 中央 HUD 使用原 3D 投影锚点及外框，仅显示两位真实分数、剩余步数、局数。左上角宝牌区使用原组件与位置，仅显示真实指示牌数量。
- 候选池为固定手牌上方靠右的独立浮层，横向内部滚动；听牌分析可展开并局部滚动。两者不参与 Canvas 容器布局。展开分析的宽度已限制，避免覆盖牌河。无常驻侧栏。
- 桌布及牌面/牌背仍来自 Appearance；未写入用户配置或重置外观。

## 同条件对照与视觉限制

同一浏览器、相同缩放和读取到的外观配置，普通四人与 17 步分别对照。视口只做两轮校准：

| 目标 CSS viewport | 第一次请求 → 实际 | 第二次请求 → 实际 | 最终对照实际 CSS viewport |
| --- | --- | --- | --- |
| 1280×720 | 1229×691 → 1281×720 | 1228×691 → 1279×720 | 1279×720 |
| 1920×1080 | 1843×1037 → 1920×1081 | 1843×1036 → 1920×1079 | 1920×1079 |

不将上述近似视口当成精确 720p/1080p PASS。1080 档首次命令超时后通过读取 innerWidth/innerHeight 确认实际值，仅执行一次反向校准。此后停止校准。

两模式实测相同：

| 对照项 | 1279×720（四人 = 双人） | 1920×1079（四人 = 双人） |
| --- | --- | --- |
| Canvas rect x/y/w/h | 16.172 / 49.635 / 1246.823 / 665.534 | 22.422 / 55.339 / 1875.156 / 1013.294 |
| 本家手牌 rect x/y/w/h | 159.590 / 650.273 / 959.987 / 61.094 | 480.007 / 987.552 / 959.987 / 78.672 |
| DOM tile w/h | 43.490 / 61.094 | 55.990 / 78.672 |
| 中央 HUD 外框 x/y/w/h | 507.861 / 250.887 / 257.612 / 197.657 | 810.783 / 395.694 / 289.688 / 225.368 |
| Camera position / FOV | [0,35,27] / 32 | [0,35,27] / 32 |

上下头像锚点及竖框尺寸一致（浮点误差 <0.001 CSS px）；宝牌区起点与高度一致，宽度因真实指示牌数量不同而不同。13 张固定牌不补普通 drawn tile。17 张牌河全部 transform/scale 与普通四人 authority 逐项测试一致。

实际看到恢复后的牌桌和浮层；但捕获画面存在灰色空区、旧边界重复/裁切，无法可靠观察两个目标视口的完整画面。没有将这些捕获现象无证据归因产品，也没有继续重复截图重试。截图像素尺寸不作为 CSS viewport。

另有待确认的真实遮挡：在近 720p 的 16/17 张牌河场景，下方三行牌河与本家头像及中央 HUD 边缘相交。DOM frame 与标准基线一致，牌河 world transform 已证明引用相同 authority；不能在本轮擅自移动冻结坐标来消除此相交。应在本机精确视口确认该遮挡及可接受性，不能写作“17 张完全无遮挡 PASS”。

候选池和分析展开后的 projected river box 检查无交集；浮层展开/收起前后的 Canvas、固定手牌、头像、中央 HUD rect 不变；resize 同一 session Canvas identity 不变。以上测量只辅助布局判断，不替代完整视觉验收。

## 功能、性能与清理

- last-turn fixture：真实候选弃牌后，双方各 17 张牌河；固定 13 张牌的标签/顺序与弃牌前完全一致；候选池 5 → 4；进入原流局 ResultDialog。
- 下一局 → 原构筑选 13 → 确认 → Loading → 再次进入 3D。连续三次本家候选弃牌和原 350ms 对手动作后，候选池 21 → 18，固定手牌完全不变；轮到本家正常操作。
- ron fixture：跳过后恢复候选池操作；重新加载隔离 fixture 后荣和进入原 ResultDialog，真实分数 62000/38000，没有新 UI 重算得点。
- active=3d、requested=3d、fallback=none、Canvas=1。AX 中 Canvas 自带故障文案是 fallback 子内容，不能据此误判正在 fallback。
- 普通四人正常菜单进入、一次本家弃牌及对手后续回合、返回菜单正常。其 camera/layout 数值及 CSS 未改；背景/雾/地面仅原样共享。
- 停止捕获且无活动动画的稳定窗口：普通四人、双人均 sprite=0、proxy=0、drawDelta=0、clearDelta=0。计数来自临时 WebGL draw/clear 包装，无新增产品 RAF/轮询。
- 双人返回菜单 Canvas=0、Loading=0、候选浮层=0；四人返回菜单 Canvas=0、Loading=0。三人退出预览 Canvas=0、Loading=0、HUD=0；不存在留在活动场景中的手/代理。
- 三人开发预览原 preset 未重新设计。进入真实 3D，切换 18 张牌河后共 54 张，重映射为蓝海/bottom、赤枫/right、青竹/left，仍只有 3 位参与者。完整三人视觉矩阵本轮未重复验收。
- 普通对局写存档使用当前标签页内存 Storage 隔离，未覆盖真实存档；17 步 fixture 不新增存档。测试标签页和临时 viewport override 已关闭/清除。
- 最终普通四人控制台无 error。双人最终重进/操作未出现新的产品 error；日志保留实现过程中 HMR 的旧 DuelHud settings 异常及已处理的诊断脚本句柄误用，不把旧日志隐去或视为最终场景失败。THREE.Clock deprecation warning 仍存在。

## 工程结果与修改范围

- targeted：11 files / 55 PASS，artifacts/17-3d-b1-targeted.log。
- npm test：230 files PASS、1 既有 SKIP；1626 PASS、1 既有 SKIP，artifacts/17-3d-b1-tests.log。
- npm run build：PASS；保留原有大 chunk 提示，artifacts/17-3d-b1-build.log。
- git diff --check：PASS。Git 提示部分既有 LF 文件未来转 CRLF，不是 diff whitespace failure。
- 唯一受提取影响的旧源码结构测试现在对 TableEnvironment 验证相同 fog/floor 数值，并额外确认普通场景真实引用；未删除、跳过或弱化原断言。

本轮产品/测试文件：

- src/components/SeventeenStepsScreen.tsx
- src/components/game/DoraIndicatorStack.tsx
- src/presentation3d/Table3DHud.tsx
- src/presentation3d/Table3DScene.tsx
- src/presentation3d/Table3DScene.test.ts
- src/presentation3d/table/TableEnvironment.tsx（新增）
- src/presentation3d/participants/ParticipantTable.tsx
- src/presentation3d/participants/ParticipantScene.tsx
- src/presentation3d/participants/participantLayout.ts
- src/presentation3d/participants/participantTable.css
- src/presentation3d/participants/DuelHud.tsx（新增）
- src/presentation3d/participants/participantBaseline.test.tsx（新增）

起始已有 46 个 tracked dirty 文件及大量 untracked A/B/资源/报告；全部保留，未 reset/clean/恢复或删除素材。participantPresentation adapter、原测试和 src/styles.css 与本轮起始 hash 相同。当前总 git diff 含先前 A/B/Hand Pack 等改动，不能全部归为 B.1。本轮新增报告与验证日志也保留。

## NOT VERIFIED / 本机关闭门禁清单

1. 在实际 1280×720 和 1920×1080、同缩放同外观下，完整可见对照四人/双人牌桌；本工具最终只提供 1279×720 和 1920×1079。
2. 本家 17 张牌河与冻结头像/中央框相交的实际可见效果；不擅自修改四人冻结 authority。
3. 两档完整 Loading 首帧无闪白/闪黑/半成品、所有牌河无遮挡、所有候选横向滚动及鼠标命中、荣和/跳过按钮无遮挡。已验证键盘操作及辅助布局信息，未将其替代完整视觉 PASS。
4. 用户提及的两张截图本轮未附在消息中；以仓库 authority 同条件对照，未按截图像素比硬编码。

候选来源/river target 合同保留给 17-3D.C；本轮未新增候选池手部动画或 pacing。三人仅布局预览，无三人玩法。
