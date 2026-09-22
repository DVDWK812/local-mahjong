# 17-3D.A：共享 3D Session / Canvas 生命周期提取

结论：**17-3D.A BLOCKED**。基础设施提取和自动验证完成，指定的两档 CSS viewport 视觉验收未完成，不能签发 PASS。**17 步正式3D迁移尚未完成。** 本轮没有进入 17-3D.B、UI-6C 或同步 Notion。

## 提取边界与组件关系

提取前：Board → GameScreen → TableRenderer（选择、错误边界、Loading、Pack 预热）→ Table3DScene（四人内容、Canvas、context-loss、frame commit）。

提取后：Board → GameScreen → TableRenderer（同一公开接口、四人模式 wrapper）→ Table3DScene（四人 composition）→ **SceneCanvasHost → Canvas**。SceneErrorBoundary / SceneLoading 位于共享 session 目录，由模式 wrapper 组合。

17 步仍为 SeventeenStepsScreen → MahjongTable。本轮没有修改这条路径。

唯一共享 Canvas 实现在 `src/presentation3d/session/SceneCanvasHost.tsx`。接口：

```tsx
<SceneCanvasHost
  sessionKey={sessionKey}
  camera={modeCamera}
  onRendererReady={optionalTelemetry}
  onReady={onFullFrameCommitted}
  onUnavailable={onInitializationOrContextFailure}
>
  {/* 模式场景、原资源 provider、原动画 consumer */}
  <SceneContentReady sceneReady={sceneReady} criticalAssetsReady={assetsReady} />
</SceneCanvasHost>
```

宿主不接收 GameState、玩家或完整四席 Record。最小立方体测试场景已在真实 WebGL 下运行；它仅证明接口解耦，不是 17 步接入。

宿主负责原 WebGLRenderer 设置、demand Canvas、context-loss 监听清理、初始完整帧提交、session lease 与过期回调保护。具体 Camera 数值仍由四人层传入，FixedTableCamera 仍在四人 composition 内。

仍属于四人模式：standardFourPlayer、buildTableSceneState、SEAT_ORDER/四席 Record、HUD、winner reveal、普通手牌/drawnTile、普通 discard snapshot/plan、Dora、四人布局、参与者身份与 effective Hand Pack 解析。

## Readiness、资源与生命周期

- Canvas.onCreated 只确认 renderer，不揭开 Loading。
- SceneContentReady 合并 renderer、模式 scene、关键资源信号；请求 demand frame，并验证当前 Canvas 的 `gl.info.render.frame` 已前进，再触发一次 ready。其他 R3F root 的全局 after-effect 不能误报本场景已提交。
- TableRenderer 继续使用原 `isInitialPresentationReady` 合并完整帧、当前有效 Hand Packs 和本家 DOM ready。
- 普通 lazy 加载的 Suspense fallback 改为 null；Loading 保持遮挡，不把 Legacy 当正常加载占位。
- 原 Loading 样式原样移入提前加载的 `session/sceneSession.css`，避免等待 scene chunk 才获得遮挡样式。
- 同一 session 的 Loading / resize 不改变 Canvas key。新 animationSessionKey 切换整个四人 renderer session，使旧 ready、Pack Promise 和 error 状态不能作用于新局。
- session lease 在卸载、取消、StrictMode 重激活时拒绝旧回调；frame callback 与 context-loss listener 在 cleanup 中移除。
- AppearanceResources3D、Texture/Object URL cache、Hand Pack registry、effective-pack 去重预热、失败策略均沿用原实现，没有复制。四人观测的 effective pack 为 female；宿主不推断参与者或遍历固定四席。
- 未新增时钟、RAF、interval、polling 或固定揭开延迟。共享 Context 单独成模块，避免跨 DOM/R3F root 的组件热更新身份问题。

## 自动验证

| 检查 | 最终结果 | 证据 |
| --- | --- | --- |
| 3D / Hand / pacing / ready targeted | 50 files，318 tests passed | 17-3d-a-targeted.log |
| 最終 host / renderer / SSR 回归 | 7 files，76 tests passed | 17-3d-a-ssr-regression.log |
| npm test | 228 passed、1 skipped files；1616 passed、1 skipped tests | 17-3d-a-tests.log |
| npm run build | PASS，既有大 chunk 提示 | 17-3d-a-build.log |
| git diff --check | PASS | 最终命令 exit 0 |

新增宿主测试覆盖无玩家 composition、唯一 Canvas owner、ready 条件、当前 root 帧提交、取消后的排队回调、旧 Promise、StrictMode、错误分类、fallback 与 session key。

原 5 份 SSR DOM 测试曾隐式依赖 3D lazy loading 的 Legacy fallback，移除该加载占位后导致 12 项断言失败。现明确选择 2D 来保留它们原本检查的 Legacy DOM；原断言未删除、弱化或更改 expected，另外新增“请求 3D 的 SSR Loading 不包含 Legacy”检查。未新增 skip；全量中的 1 项 skip 为原有。新测试首次构建出现 node:fs 声明不支持 Dirent 的类型错误，已改用仓库支持的签名，最终构建通过。

## 实际浏览器证据

使用 Codex 内置浏览器、隔离 URL `http://127.0.0.1:5173/?testMode=1&testAnimations=1&table3d=1`，没有进入或覆盖普通继续对局。辅助宿主页为 `/artifacts/17-3d-a-host-fixture.html`。

| 项目 | 结果 | 证据与边界 |
| --- | --- | --- |
| 普通四人真实 3D | PASS（功能观测） | Canvas=1、requested=3d、active=3d、fallback=none；真实四人 scene 存在，恢复默认视口后截图可见桌布、立体手牌/牌背、头像及 DOM 本家手牌 |
| 初始加载顺序 | PASS（状态轨迹） | cold trace：无 Canvas + Loading → 有 Canvas、scene/local 未齐 → scene true/local false → 全部 ready 后揭开；各阶段 Legacy=false，Canvas 身份集合大小 1 |
| 摸切 | PASS（行为/阶段） | STAB-001-ANKAN：跳过提示、九筒摸切；grasp → travel → release → retreat，handTsumogiri=true；同一 Canvas |
| 手切与理牌 | PASS（行为/阶段） | 重置后九万手切；lift → carry → river-settle → gap-hold → insert → reorder → complete，handTsumogiri=false |
| 对手摸牌和弃牌 | PASS（行为/阶段） | 测试工具栏正式入口，right seat 的 tile_drawn 与 tile_discarded 阶段记录；之后轮到西家 |
| 本家正常摸牌 / 自摸 | PASS（行为） | 现有 EXAMPLE-CHIIHOU，庄家摸切后切换控制玩家2，正常摸牌出现自摸6筒，结算为地和役满32000 |
| 荣和 | PASS（行为） | STAB-001-ANKAN 九筒弃牌触发原结算：测试玩家3荣和5200；无新计分实现 |
| 静止 demand | PASS（一次稳定窗口） | 实际 R3F scene traverse proxy=0，DOM sprite=0；Dora active=0；两次采样 draw=7422、clear=90，drawDelta=0、clearDelta=0 |
| resize / Canvas identity | PASS（生命周期） | 两次尺寸修改后 sameCanvas=true，无 Loading；接触锚点视觉正确性未验证 |
| 退出、重进 | PASS（行为） | 回用例库 Canvas=0/sprite=0 → 主菜单 → 测试模式重新进入，Canvas=1/active=3d/fallback=none |
| context-loss 最小 fallback | PASS | WEBGL_lose_context 后原 fallback=webgl-init-failure，Canvas=0、Legacy=1、Loading=0、sprite=0；退出再进恢复3D。未运行完整 Legacy 矩阵 |
| 最小宿主场景 | PASS（真实 WebGL） | scene/assets ready 后 commits=1、DOM 未就绪 ready=false；DOM ready 后 true，resize 同一Canvas且 commits仍1；未挂载时 ready 信号不提交旧 session；context-loss 沿相同分类回退 |
| Console / Network | 限定通过 | 正常操作最终版本无 error；主动 context-loss 有预期故障日志。已捕获 Network.loadingFailed 记录为空；不宣称未捕获时段或所有资源变体均已验证 |

**指定视觉矩阵未通过验收：**

| 请求 CSS viewport | 实际读取 innerWidth×innerHeight | 截图 | 结论 |
| --- | --- | --- | --- |
| 1280×720 | 1333×750（DPR≈0.96） | 对应捕获失败 | NOT VERIFIED |
| 1920×1080 | 2000×1125（DPR≈0.96） | 对应捕获失败 | NOT VERIFIED |
| 恢复默认后（额外观测） | 687×574 | 返回图像688×574，可见真实3D牌桌和荣和结果 | 不能替代要求的两档 |

使用 viewport capability 和 CDP metrics 后仍有上述差异；Ctrl+0 未消除。早期 fromSurface=false 的2560×1440图像是整个应用界面，不是牌桌截图，已排除为视觉证据。没有把 capture bounds 或工具尺寸问题归因于产品；也没有以 DOM/Canvas 指标冒充指定尺寸视觉 PASS。

另观察到现有 STAB / CHIIHOU fixture 正常摸牌后显示“测试状态检查失败：活牌墙与王牌数量关系：活牌68，王牌14，已杠0”。本轮没有修改规则、fixture 或校验器，尚未独立证明它在提取前同样复现，因此列为已观察问题、归因 NOT VERIFIED，不擅自修复或隐去。

## 工作区保留与文件

启动时已有39个 tracked dirty 文件（635 insertions /168 deletions），以及 UI-6B2、审计报告、Hand Packs、ready 模块等 untracked。开始编辑前重复文件元数据检查未发现持续并发变化。结束复核的实际变更均为本轮预期文件；未覆盖资源、配置、存档、图库或其他已有修改。

两个指定资源：`src/hand/cyberpunk.png`、`src/hand/robot.png` 均不存在；git ls-files 无 tracked 条目，git check-ignore 无匹配；运行源码/脚本无这两个单文件路径引用。当前 registry 使用各自 `src/hand/packs/...` 姿态图。未恢复、删除或替换这两个文件。原 `src/hand/default/` 七个删除状态在启动时已经存在，保留原状。

本轮新增：

- src/presentation3d/session/SceneCanvasHost.tsx
- src/presentation3d/session/SceneCanvasHost.test.tsx
- src/presentation3d/session/SceneErrorBoundary.tsx
- src/presentation3d/session/initialFrameCommit.ts
- src/presentation3d/session/sceneSessionContext.ts
- src/presentation3d/session/sceneSession.css
- artifacts/17-3d-a-host-fixture.html、17-3d-a-host-fixture.tsx、报告与验证日志

本轮修改：Table3DScene.tsx/test.ts、TableRenderer.tsx/test.ts、table3d.css（原 Loading 样式迁出，最终此文件相对 HEAD 无 diff）；5份 SSR 测试为 PlayerProfileIntegration、ReplayScreen、TestModePerspective、game/GameScreen、game/TableLayoutRegression。其余 git diff 属于原有工作，不能把整个工作区 diff 视为本轮产出。

按 code-review 检查了共享 session、四人接线、旧回调、资源边界及测试变更，未发现需要扩大到规则或公共动画重构的具体缺陷。结构断言不等于 mounted React 行为测试；上述真实宿主 fixture 提供了补充生命周期证据。

## NOT VERIFIED / 17-3D.B 可复用入口

尚未验证：指定两档 CSS viewport 的完整桌面、手部接触锚点、无闪屏/缺图/重复代理的逐帧视觉矩阵；完整普通 Home 新开局流程使用隔离 fixture 路径替代，未触碰普通存档；fixture 牌墙校验提示的基线归因；所有外观资源失败组合。

后续 17-3D.B 可直接组合 `session/SceneCanvasHost` + `SceneContentReady`，传入自己的 camera、sessionKey、场景 children 与 ready 信号；在外层沿用 `SceneErrorBoundary`、`SceneLoading`、原 readiness helper。资源和动画仍从既有 provider / consumer 复用，不需要普通四人 GameState 或虚构玩家。此入口已实现；本轮没有开始17步布局、候选池动画或结算 pacing。
