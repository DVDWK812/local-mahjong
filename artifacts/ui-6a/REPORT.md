# UI-6A 验收报告

结论：UI-6A PASS。2026-09-06，本地工作区验证；未提交。

## 1. 旧问题根因

弃牌事件发生时 Rules 已删除手牌并完成排序，DOM / Hand3D 立即读取压缩后的 hand。旧动画只保留单张 source / proxy，没有整副手牌的旧布局，因此动画仍在抓牌时其余手牌已经补位。drawn tile 参与整排居中也会使摸切前后原手牌移动。

## 2. Snapshot architecture

GamePresentationEventObserver 在前一次提交保存 hand / drawnTile 的只读投影；确认权威弃牌后发布冻结的 handHistory。共享工厂生成 eventId、playerId、preDiscardHand、drawnTile、discardedTile、discardVisualSlot、isTsumogiri、finalHand、visualHand。副本不是第二套 Rules 状态，不参与合法性或出牌决策。

HandPresentationSnapshot 定义共同阶段与归一化 slot 插值。TableAnimation3DTarget 通过现有 HandAnimationController → AnimationScheduler 驱动；本家 LocalHandSnapshot 使用 DOM，其余三家 Hand3D 使用同一 frame。正常结束及中断时回到当前权威状态。

## 3. Tsumogiri flow

lift → carry → river-settle → complete → release。只隐藏独立 drawn slot 并移动代理，原手牌不做 insert / reorder。DOM 和 3D 的 drawn slot 均从基础手牌居中计算中独立出来。

## 4. Tedashi flow

lift → carry → river-settle → gap-hold → insert → reorder → complete → release。

原 slot 从 lift 起隐藏但仍占位；river-settle 结束前其余手牌坐标冻结。gap-hold 时牌河接管弃牌、代理消失、空位仍保留。之后 drawn tile 插入空位，再按 finalHand 排列闭合。没有 drawn tile 的副露后弃牌使用同一闭合语义。

Snapshot 代理的 carry 终点与 settle 起点连续，不沿用旧轨迹在 settle 开始时再次抬高的动作。

## 5. Slot authority / appearance

本家依据权威 tile instanceId 在原手牌中的准确位置；真实点击捕获原 DOM rect。相同牌面不同实例不会混淆。其他三家通过 eventId/playerId 的确定性 hash 选择 concealed slot，手切不会选择 drawn slot；只交换隐藏的视觉 slot 身份，代理仍使用权威弃牌。

继续使用现有 DOM Tile、Tile3D 与 owner appearance，保留 Aka / face / back / sideColor 的现有来源。原手牌的弃牌位置隐藏，独立代理与牌河互斥交接。本阶段没有制作最终手部图片或模型。

## 6. Skip / cancel / pacing

Skip、变速、cancel、dispose 清理 controller / target / masks；generation guard 防止异步 prepare 在取消后启动旧动画。关闭 presentation 时不再捕获无 consumer 的本家 source；enabled/session 变化和卸载清理现有活动。

使用既有 PresentationPacing barrier 与 fail-open，Rules/GameState 不 await 动画。连续自动动作沿原队列串行执行。自动化覆盖 carry 中 skip/cancel/speed/dispose、异步 prepare 取消、4x、连续动作及 disabled consumer；浏览器实测 Skip 和 lift 中退出。

## 7. Demand rendering

保留 frameloop="demand"。新 animationFrameTask 只在 scheduler task 活动期间请求有限 RAF；abort / 完成 / update 异常均取消回调。Snapshot proxy 不增加 useFrame。稳定采样：1280×720 的 300ms 与 1920×1080 的 500ms 窗口均 drawDelta=0、clearDelta=0。现有 Dora sweep 自己的动画窗口仍会绘制，未修改它的调度。

## 8. Browser QA

使用 Codex 内置 Chromium 浏览器与真实 WebGL。URL：`http://127.0.0.1:5173/?table3d=1`；默认 2.5D：`http://127.0.0.1:5173/`。尺寸以运行时 innerWidth/innerHeight 为准；宿主缩放使响应式面板数字与 CSS viewport 不完全相同。

| Criterion | Result | Viewport / State | Evidence | Component |
|---|---|---|---|---|
| 3D runtime | PASS | 1280×720、1920×1080 | Canvas=1；requested/active=3d；fallback=none；完整牌桌可见 | Table3DScene |
| 摸切原手牌稳定 | PASS | 两个尺寸，真实点击 drawn tile | 只有 lift/carry/river-settle/complete；无 insert/reorder；原手牌位置稳定 | DOM + shared snapshot |
| 手切延迟闭合 | PASS | 两个尺寸；本家及其他座位 | river-settle 与 gap-hold 仍留空；其后才 insert/reorder | DOM + Hand3D |
| 单一代理交接 | PASS | 本家赤五筒等真实弃牌 | lift/carry/settle 一个 DOM proxy；gap-hold proxy=0；牌河保留弃牌 | LocalDiscardProxy / River |
| 四席连续动作 | PASS | 自动对手回合 | 四席阶段记录；本家之后 right/top/left；完成后继续对局 | Controller / pacing |
| Skip | PASS | 1280×720，gap-hold 中 reduced-motion change | phase=idle；gap/proxy/snapshot=0；后续可继续操作 | Controller |
| Cancel/unmount | PASS | lift 中返回菜单并确认 | Canvas/gap/proxy/snapshot=0 | Hook cleanup |
| 静止绘制 | PASS | 两个尺寸的稳定窗口 | drawDelta=0 / clearDelta=0 | Scheduler / demand |
| 布局 / 输入 | PASS | 两个尺寸 | 无横向溢出；本家仍 DOM；真实点击准确出牌并可继续操作 | LocalHandArea |
| Console | PASS | 3D、2.5D 验收流程 | 无相关 error；记录到既有 renderer 切换诊断及 Three.Clock deprecation warning | Runtime |
| Network | PASS | 3D、2.5D 验收流程 | 所查所需 JS/texture/UI 请求无失败；音轨切换/导航的 media abort 属预期取消 | Assets |
| 2.5D isolation | PASS | 默认 URL，两个尺寸 | Canvas=0、无 screen-space snapshot；出牌与鸣牌窗口仍可工作 | Legacy integration |

截图采用浏览器原生可见面板捕获，包含宿主窗口；离屏截图在该环境缩放失真，因此未用失真截图作为验收依据。阶段暂停仅用于观察空位，正常速度的完整事件记录用于验证顺序。所有临时浏览器 instrumentation 已通过导航清理，viewport/media override 已恢复。

证据文件：

- `local-gap-hold-1080.png`、`local-gap-hold-720.png`：本家落河后留空。
- `tedashi-gap-hold-1080.png`：其他座位留空。
- `tsumogiri-1080-browser.png`：摸切。
- `final-1080-browser.png`、`final-720-browser.png`：最终版本 3D 对局。
- `2d-1080-browser.png`、`2d-720-browser.png`：默认 2.5D 回归。
- `browser-phases.json`：四席阶段、slot rect、stable720、routeCleanup。
- `final-browser-phases.json`：最后轨迹修正后的两个尺寸实际动作与最终清理状态。proxy/gap 计数是 DOM 元素计数，不代表 WebGL 对手对象数量。
- `reference-0.jpg`、`reference-1.jpg`：用户两个参考录屏的抽帧对比，源视频未修改。

## 9. Tests / build / diff

- Targeted：48 passed，包含新增 17 个 snapshot 场景测试和 3 个 scheduler frame 生命周期测试，以及既有 controller / DOM 测试。
- `npm test`：222 files passed，1 file skipped；1567 tests passed，1 test skipped。没有新增 skip、删除或弱化测试。
- `npm run build`：成功；现有 bundle >500kB 提示仍在。
- `git diff --check`：通过；Git 仅提示既有 Windows LF/CRLF checkout 策略。
- 初始工作区干净；最终检查未触及硬边界文件。最终代码审查中发现并修复 carry/settle 跳变，四席 × 摸切/手切增加连续性断言后重跑 targeted/full/build。
- 日志：`targeted.log`、`npm-test.log`、`build.log`。

## 10. 修改文件

共 19 个源码/测试文件，另有本目录验收证据。

| 文件 | 改动 |
|---|---|
| src/presentation/PresentationEventBus.ts | 弃牌事件可选历史投影 |
| src/presentation/gamePresentationEvents.ts | 保存并冻结弃牌前后手牌 |
| src/presentation/handAnimation/HandPresentationSnapshot.ts | 新增共享 snapshot / phases / slots |
| src/presentation/handAnimation/HandAnimationController.ts | 自定义 tasks、中断 generation、变速 snap |
| src/presentation/animation/AnimationScheduler.ts | scheduler 管理的有限 frame task |
| src/presentation/animation/animationFrameTask.test.ts | 新增生命周期测试 |
| src/presentation3d/animation/tableAnimation3D.ts | snapshot plan / source / 连续 settle |
| src/presentation3d/animation/useTableAnimation3D.ts | 驱动共享 frame 与生命周期 |
| src/presentation3d/animation/HandAction3D.tsx | scheduler 驱动独立代理 |
| src/presentation3d/animation/localDiscardMotion.ts | DOM source 到现有 river 的投影 |
| src/presentation3d/animation/handPresentation.test.tsx | 新增四席与阶段/中断测试 |
| src/presentation3d/hand/Hand3D.tsx | 冻结手牌 consumer |
| src/presentation3d/hand/handSnapshotLayout.ts | 共享 slot 到 seat transform |
| src/presentation3d/hand/handSnapshot.css | 仅 3D DOM hand 样式 |
| src/presentation3d/coordinates/sceneTransforms.ts | 独立 drawn slot，基础手牌不重心漂移 |
| src/presentation3d/Table3DScene.tsx | frame 接入与阶段诊断 |
| src/components/game/LocalHandSnapshot.tsx | DOM snapshot 与弃牌代理 |
| src/components/game/LocalHandArea.tsx | 3D 本家 consumer 接入 |
| src/components/game/GameScreen.tsx | source 清理与 disabled guard |

## 11. NOT VERIFIED

没有本次要求范围内尚未执行的阻塞检查。4x/变速与 presentation disabled 使用自动化和生命周期检查验证；产品没有对应的可交互变速 UI，未把这部分写成浏览器人工 PASS。未逐一人工遍历所有自定义 appearance pack，未进行长时间整局压力测试；本阶段未包含最终手部美术制作或拟真程度验收。

UI-6A PASS
