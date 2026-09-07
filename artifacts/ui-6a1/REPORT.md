# UI-6A.1 BLOCKED

实现完成，自动验证通过；完整浏览器逐帧视觉验收尚未完成。未进入 UI-6B。

## 根因与修复

1. **闪屏是真实的 R3F visibility 空帧。** 旧 `TileTextureWarmup` 的 `useTexture` 输入是全部 URL 的一个数组，`Tile3D` 使用的是 `[faceURL, backURL]`。缓存以完整输入元组为键，前者没有预热后者。首次弃牌／和牌翻开新牌面时，冷缓存触发共享 Suspense，将四席 group 暂时设为不可见。修复前 Ron 实际记录只剩 9 个可见 mesh、四席 group 隐藏，Canvas 仍为同一实例（`ron-before-flash.json`）。现改为在初次挂载时预热与 Tile3D 完全相同的输入对。没有加 CSS fade、延迟或重建 Canvas，也没有修改 Tile3D、几何或 Appearance authority。
2. **弃牌手部缺失是 consumer 漏渲染。** UI-6A 的 `SnapshotDiscardProxy3D` 分支只有 tile proxy，没有 `HandProxy3D`。现将现有对手手部加入同一 snapshot 生命周期；本家复用现有 DOM SVG 手部，位于 DOM 牌上方。没有制作新资源。
3. **本家摸牌偏移是坐标 authority 不匹配。** 原手部沿 bottom world hand 坐标运动，本家真实手牌却在独立 DOM 层，且 WebGL 手部无法覆盖上层 DOM 牌。现从真实 `.drawn-tile-gap .tile` 的 `getBoundingClientRect()` 获取接触中心与尺寸，每个 scheduler 帧重新测量；活动期 resize 事件也重新测量。旧本家 world draw hand 隐藏，避免双手。

## 生命周期与保留边界

- reach 放入原 lift 时段，接触后 lift/carry；river-settle 时手仍可见；手切在 gap-hold retract，摸切在原 110ms hold 内 retract；complete 清理。总阶段节奏和原 hold 总时长保持。
- 本家手和牌共用 `resolveLocalDiscardRect`，对手手与牌共用 `resolveSnapshotDiscardMotion`。手部没有独立 timer/RAF。
- snapshot、gap、insert/reorder、exact/deterministic slot、single proxy authority 均保留。Rules/GameState/Scoring/AI、Camera、Tile geometry、UI-5G Appearance、Dora scheduler 未修改；2.5D 行为未修改。
- skip/cancel/dispose/speed-change 清理沿现有 controller；浏览器暂停 lift 后启用 reduced-motion，手／proxy／snapshot 均清零。UI-6A 的阶段与中断测试保留，增加手部可见性／接触／回收断言。
- Canvas 保持 `frameloop="demand"`。没有新增常驻 useFrame、interval、polling 或另一套 RAF。

## Browser QA

使用 Codex 内置浏览器，`http://127.0.0.1:5173/?table3d=1&testAnimations=1`，实际 CSS viewport 为 1280×720 和 1920×1080。JSON 场景由现有正式引擎生成并通过现有 scenario validator；操作通过实际 UI 点击。

| Criterion | Result | Viewport / State | Evidence | Component |
|---|---|---|---|---|
| 真实 WebGL，Canvas=1，requested/active=3d，fallback=none | PASS | 两分辨率 | 运行时属性、WebGL context 未丢失、实际 draw calls | TableRenderer |
| 四席弃牌 render visibility／生命周期 | PASS（运行记录） | 两分辨率，手切／本家摸切 | `frame-summary.json`；所有记录 CanvasSame=true，hidden=0；三对手 lift/carry/settle 中 hand count=1 | Snapshot consumers |
| 本家手切 gap→settle→insert/reorder | PASS（阶段记录） | 两分辨率 | `tedashi-*.json` 完整八阶段、结束残留为 0 | Snapshot |
| Ron／Tsumo 无共享牌层隐藏 | PASS（已采样实际 render 帧） | 两分辨率，本家 Tsumo、摸切后对手 Ron | `tsumo-*.json`、`tsumogiri-and-opponent-ron-*.json` | Texture warmup |
| 本家正常摸牌接触点 | PASS（DOM 测量） | 两分辨率 | `draw-*.json`，grasp/travel/release 中心误差 <0.02 CSS px | LocalAnimationHand |
| 活动中 resize 跟随 | PASS（DOM 测量） | 720→1080 暂停 grasp | resize 后 hand=(1402.5019,1022.4609)，tile=(1402.5053,1022.4646) | LocalAnimationHand |
| 本家 lift 手与牌视觉接触 | PASS（局部视觉） | 720p | `hand-lift-720.png`，曾实际查看；手与 tile proxy 中心重合 | DOM proxy |
| 完整逐帧视觉：无闪白/黑/亮度跳变，四席手部遮挡与回收，双分辨率截图 | **NOT VERIFIED / MANUAL BLOCKED** | 尤其 1080p 完整动作 | 后续 `tab.screenshot` / `getScreenshot` 持续返回 `Unable to capture screenshot`；打开面板返回 queued。运行记录不能替代完整视觉验收 | 内置浏览器截图通道 |
| 清理后 demand rendering | PASS | 两分辨率，600ms 静止采样 | `stable-*.json`，所有 draw 方法与 clear 增量均 0 | AnimationScheduler |
| Console / Network | PASS（已观察范围） | 两分辨率动作 | Console errors=[]；Network.loadingFailed=[] | Runtime |
| 默认 2.5D 隔离／点击 | PASS（运行/交互）；完整截图 NOT VERIFIED | `/`，两分辨率 | Canvas=0；赤五万实际点击后 14→13；无横向溢出、无新 hand/snapshot 残留 | LocalHandArea |

注意：render 记录只覆盖实际采样帧，1080p 部分 Win 阶段未产生可单独记录的 draw 帧，不能将其表述成逐显示帧视觉证明。测试模式既有普通摸牌牌墙 invariant 会误报（没有扣除正常摸牌数）；未修改规则／测试模式模块。弃牌／和牌采用正式 draw 后重新生成并校验的 ready 场景完成验证。

自动审批曾将 Canvas 的 HTML 备用提示文本误判成 active fallback，拒绝自摸点击；随后读取明确属性 active=3d、fallback=none 及可见 mesh／WebGL 数据，重试通过。该审批误判已解除，当前未完成项是截图视觉验收。已请求将任务浏览器面板切到前台，尚未获得可用截图。探针、临时 scheduler 暂停、reduced-motion 和 viewport override 均已恢复，浏览器回到默认菜单。

## 自动验证

- 最终 targeted：4 files、68 tests passed（`targeted-final.log`）。此前含 Win overlay 的 targeted：5 files、71 passed。
- `npm test`：223 files passed、1 skipped；1569 tests passed、1 skipped（`full-test.log`）。
- `npm run build`：通过（`build.log`）；已有 >500KB chunk 提示。
- `git diff --check`：通过。最终 status/diff 已复查，保留启动前 dirty/untracked；`baseline.diff`、`baseline-status.txt` 为起点。
- 新 `flashLifecycle.test.tsx` 使用真实 R3F reconciler、TextureLoader/useLoader 缓存，只控制图片 I/O 完成和测试 renderer；断言 discard/Ron/Tsumo 更新无新增图片请求、四席始终可见、scene/Canvas/seat 对象不重建。

## 本次涉及文件（不含原 UI-6A 其余 dirty）

- `src/presentation3d/tile/TileTextureWarmup.tsx`
- `src/presentation3d/animation/HandAction3D.tsx`
- `src/presentation3d/animation/discardHandLifecycle.ts`（新增）
- `src/presentation3d/animation/tableAnimation3D.ts`
- `src/presentation3d/animation/useTableAnimation3D.ts`
- `src/components/game/HandAnimationOverlay.tsx`（只导出现有 HandPlaceholder）
- `src/components/game/LocalAnimationHand.tsx`（新增）
- `src/components/game/LocalHandArea.tsx`
- `src/components/game/LocalHandSnapshot.tsx`
- `src/presentation3d/hand/handSnapshot.css`
- `src/presentation3d/animation/flashLifecycle.test.tsx`（新增）
- `src/presentation3d/animation/handPresentation.test.tsx`
- `artifacts/ui-6a1/`（诊断、场景和验收证据）

最终状态：**UI-6A.1 BLOCKED**，阻塞限于尚未完成的完整视觉验收，不以测试通过代替 Browser QA。
