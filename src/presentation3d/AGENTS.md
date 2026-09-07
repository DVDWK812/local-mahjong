# 3D Presentation 约束

本目录继承仓库根 `AGENTS.md`，并补充仅适用于 Three.js / R3F renderer 的稳定约束。

## Renderer policy

3D is the primary/default renderer. 2.5D is frozen Legacy Compatibility Mode and is bugfix-only. New presentation work targets 3D unless the task explicitly says otherwise.

保留 WebGL fallback 到 2.5D。普通本目录 3D 工作只需按 `mahjong-ui-qa` 做 3D 验收与轻量 legacy smoke；仅在共享层、renderer switch / fallback 或根 `AGENTS.md` 所列边界受影响时扩大 2.5D regression。

## Authority boundary

- 只消费 shared presentation state / actions；不得判断 legality、调用 Rules 或修改 `GameState`。
- pointer interaction 使用 authoritative tile identity，并通过 shared actions 提交。
- 3D scene state 是只读 presentation projection，不是第二套规则状态。

## Coordinates and grounding

- 以 bottom seat 的 seat-local layout 为唯一规范，再通过 `coordinates/seatTransforms.ts` / `coordinates/sceneTransforms.ts` 旋转到其他座位；不要在组件中复制四套坐标。
- `table/tableSurfaceSpec.ts` 的 felt top 是实际桌面高度权威；牌面 grounding 使用 `tile/tileGrounding.ts`，不要散落 magic Y offsets。
- renderer-specific world coordinates 留在本目录，不进入 shared presentation contract。

## Manual-tuned baseline protection

- Camera、桌体 physical dimensions 与 grounding 属于用户手调冻结基线；未经任务明确授权不得以构图、适配、视觉优化或防嵌桌为由修改。
- Hand、River 与中央 HUD 的 layout authority 必须保持集中；用户明确手调确认后，其确认值同样视为冻结基线。
- 视觉收口或浏览器验收不得自动改写 Hand、River、Meld 或 HUD 坐标；当前正式 frozen values 以本文件下一节列出的源码 authority 为准。

## UI-5F frozen baseline

UI-5F.4 已将以下源码 authority 与精确值冻结。后续任务必须修改相应 authority，不能在组件、动画或测试中另建 magic-number baseline，也不能为了历史 expected 把产品视觉改回旧值。

### Camera、Table 与 grounding

- `TABLE_CAMERA`：`position=[0,35,27]`、`target=[0,0.72,4]`、`fov=32`、`near=0.1`、`far=60`。
- `TABLE_WORLD_DIMENSIONS`：`width=38`、`depth=35`、`edgeHeight=0.15`；felt inset 为 `0.75`，因此 felt 平面尺寸为 `37.25 × 34.25`。
- `TABLE_SURFACE_SPEC`：`feltCenterY=0.5`、`feltThickness=0.54`、`flatEpsilon=0.55`、`standingEpsilon=0.6`；`TABLE_FELT_TOP_Y=0.77`。
- Tile outer geometry 保持 `width=1.08`、`height=0.6`、`depth=1.46`、`radius=0.11`。flat / standing / animation grounding 必须继续通过 `tileGrounding.ts` 计算。
- `lowerTableContentOffsetZ=2` 是共享 lower-table 内容位移 authority；各 resolver 对哪些座位应用它的既有语义不得在组件中复制。

### Tile scale、Hand、River 与 Meld

- `tileScale`：`river=1.2`、`meld=1.2`、`topHand=1.15`、`leftHand=1.15`、`rightHand=1.15`。bottom Local Hand 是 DOM，不消费这些 3D Hand scales。
- Hand canonical authority：`handZ=10.25`、`sideHandOutset=2.5`；`handSeatOffsets` 为 bottom `(inline=0, radial=0)`、right `(0,0)`、top `(0,-2)`、left `(0,0)`。
- River canonical authority：`riverZ=2.8`、`sideRiverOutset=2.2`、六列换行；`riverSeatOffsets` 为 bottom `(inlineX=0, radialZ=2.8)`、right `(-0.5,0)`、top `(0,1.8)`、left `(0.5,0)`。packing、riichi sideways footprint 与 scale 必须来自 shared footprint resolver。
- Meld canonical authority：`meldZ=9`、`sideMeldOutset=2.5`、`meldRightX=11.4`；`meldSeatOffsets` 为 bottom `(inline=4.5, radial=3)`、right `(2,3.5)`、top `(4.5,2)`、left `(2,3.5)`。Chi / Pon / Kan / Kakan grouping、sideways called tile、stacked tile 与 animation destination 共用 `getMeldTileTransforms`。
- Draw / Discard / Meld / Riichi animation destination、scale 与 grounding 必须与最终静态 resolver 一致；不得 settle 到旧坐标或 scale `1`。

### HUD、Decoration、Riichi 与 Avatar

- `centralHud.position=[0,0.698,0]`，shared effective center 为 `[0,0.698,2]`；`hudOnlyOffsetX=0.2`、`hudOnlyOffsetZ=-0.3`，最终 HUD anchor 为 `[0.2,0.698,1.7]`。
- HUD rotation 为 `[-PI/2,0,0]`；`compactViewportMaxHeight=800`、`compactScale=0.96`、`regularScale=0.72`、font-size authority 为 `clamp(23px, 0.8vw, 14px)`。
- Decoration center 跟随 shared effective HUD center；`offsetX=0`、`offsetZ=0`、`innerSquareSize=8.2`、`riichiGap=9.45`、`outerSquareSize=27.1`、`lineWidth=0.06`、`segmentHeight=0.04`、`surfaceClearance=0.004`。
- Riichi stick layout：`laneOffset=3.35`，四席 seat offsets 均为 `(inline=0, radial=0)`；asset geometry 为 `length=3.16`（UI-5G.2B Final Sizing）、`width=0.24`、`height=0.065`、`epsilon=0.006`，座位变换统一由 `riichiStickLayout` resolver 提供。
- `avatarFrame.size=1.1` 是默认 base size；seat offsets：bottom `(x=500,y=-100)`、right `(-30,0)`、top `(350,0)`、left `(30,0)`。Avatar position 与统一 size multiplier 是独立 authority。开发环境的 `?avatarFrameTuning=1` 仅可临时手调该共享 base size，不能写入 AppearanceSettings / PlayerProfile；最终尺寸只通过 `responsiveLayout` / `getResponsiveLayoutScale` 按 CSS container 的宽高相对 `1920×1080` 连续缩放，并 clamp 到 `0.72..1.3`；不得消费 DPR，也不得改变 seat offsets。

### Lighting、Fog 与 Tile materials

- Hemisphere light：`['#f1f3dd','#10251f',1.35]`。
- Shadow directional light：color `#fff4d7`、intensity `2.5`、position `[-6.5,12.5,7.5]`，保留当前 shadow camera / bias 配置。
- `TOP_SIDE_FILL_LIGHT`：position `[0,8,-11.5]`、intensity `30`、color `#edf5ef`、distance `15`、decay `2`；不要重新设计 Lighting。
- Scene Fog 保留 `Fog('#071712',42,58)`。Tile body、face/back、red marker、interaction overlays、hit material 与 Dora shader 均保持 `fog=false`；不要改 Scene Fog 来补偿 Tile 明暗。
- Aka identity 继续来自 `tile.red`；Dora animation semantics 继续来自 shared `tileVisualSemantics`。red marker `polygonOffsetFactor=-2`、face decal `-1` 的深度顺序不得回归；hidden identity 不得显示 Aka/Dora 特效。

### Dora 与 demand rendering

- Local Hand 始终是 screen-space DOM Hand，继续使用现有 `.local-hand-dora-sweep.dora-breath-visual` diagonal CSS sweep；不得接入 `Tile3D`、`DoraHighlight3D` 或 3D scheduler。
- Tile3D Dora 使用 Tile local-space child `DoraHighlight3D`，复用 rounded tile-body geometry 的轻量 shell；禁止恢复 Drei `<Html>`、CSS3D 或 viewport/DPR 对齐路径。
- `doraSweep3D` frozen tuning：`enabled=1`、`repeatEnabled=1`、`repeatIntervalMs=5000`、`normalDurationMs=950`、`combinedDurationMs=1100`、`shellScale=1.008`、`bandWidth=0.2`、`softness=0.16`、`intensity=0.72`、`dimmedStrength=0.28`、`color=#fff5c4`、`direction=[0.72,0.28,-0.63]`、`start=-1.28`、`end=1.28`。
- 第一次 visible/settled pulse 立即发生；后续相邻 pulse start time 间隔约 `5000ms`。一个 controller 管理所有 visible Dora 与各自 deadline，只允许一个集中式 one-shot timeout；禁止 `setInterval`、永久 RAF 或永久 `useFrame` polling。
- Canvas 必须保持 `frameloop="demand"`。Sweep active 时 conditional frame driver 请求 render；完成后 driver unmount。等待下次 pulse 的 timeout 不得 invalidate：inactive window 的 WebGL draw / clear 必须为 `0`；没有 visible 3D Dora 时可长期保持 `0` draw。

## R3F resources and interaction

- 依赖纹理的 scene 内容保留在 Canvas 内的 `Suspense` boundary；继续使用集中 texture warmup / cache，避免逐牌加载闪烁。
- module-level shared geometry、material 与 texture cache 跨 scene toggle 复用；单个 Tile / mesh 不得擅自 dispose。
- 可交互牌保持稳定的独立 hit target；视觉 lift、scale 或 animation 不应改变 pointer ownership。

## Animation handoff

- 动画 proxy 只负责 presentation；必须在同一 render-state transition 中把可见性交还 authoritative hand / river / meld / riichi state。
- skip、cancel、session change 与 unmount 必须清理 proxy、mask、source capture、scheduler 与 pacing。
- 复用 shared `PresentationEvent`、`AnimationScheduler` 与 `PresentationPacing`，不新增固定 AI timer。

3D runtime、layout、interaction 或 animation 变更完成后，按 `mahjong-ui-qa` 做真实 Chrome / WebGL 验收；完成轻量 Legacy Compatibility smoke，只有共享层变更时才扩大 2.5D regression。
