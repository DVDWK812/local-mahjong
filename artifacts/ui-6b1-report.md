# UI-6B.1 PASS

## 1. 素材 mapping

原始七张透明 PNG 保持不变，正常静态 import；没有生成素材、修改 PNG 或使用 base64 asset。

| Pose | 原始文件 |
| --- | --- |
| reach-open | hand-reach.png |
| touch-contact | hand-touch-contact.png |
| pinch-grab | hand-pinch-grab.png |
| carry-forward | hand-carry-forward.png |
| release-open | hand-release-open.png |
| arrange-push | hand-arrange-push.png |
| retract-relaxed | hand-retract-relaxed.png |

逐张查看实际图像后配置各自归一化指尖接触点；arrange 原图方向单独旋转 90 度。CSS 只柔化袖口退出边缘，保留原 PNG alpha。

## 2. Architecture

HandVisualController 是被动 DOM sprite consumer。已有 UI-6A frame/phase/progress 驱动 pose、接触点、旋转、缩放、透明度；不创建第二套动画 authority 或时钟。预加载使用 Image.decode，缓存且失败放行，不进入 Canvas Suspense。

## 3. 四席 anchor / transform

本家弃牌沿用实际点击 source/proxy rect resolver；正常摸牌每次更新读取真实 drawn tile DOM rect。手切 insert/reorder 读取 snapshot 中 drawn tile 对应实际 DOM slot。其他三家使用 tile proxy 的同一 world position，经 active camera 与 canvas rect 投影；理牌阶段复用 Hand3D 的 slot resolver。四席共享 controller，仅旋转与进入方向不同：bottom 0、right -90、top 180、left 90 度。sprite 尺寸限制在 220–320 CSS px。

## 4. 摸切

reach → contact → pinch → carry → river release → retract。继续沿用 snapshot 与 single tile proxy ownership；原 13 张稳定，不选择 arrange pose。

## 5. 手切及理牌

原 slot 留 gap，抓牌落河，gap-hold 退手；随后在真实 drawn slot 再接触/引导，跟随 insert，reorder 使用 arrange-push，再 retract。未改 UI-6A 阶段顺序或 timing。

## 6. Pose transition

沿已有 progress 使用 smoothstep 插值进入/退出位置、旋转和缩放；相邻姿态短交叉淡化，两个稳定 image 节点共享指尖锚点。plus-lighter 避免交叉层重叠时皮肤变暗。人手层高于 tile proxy、低于 HUD/操作框/结果框，pointer-events:none。

## 7. Skip / cancel

事件 controller 随既有 consumer 生命周期 dispose，移除整个 sprite root，忽略过期 update；不增加 input lock。继续复用 UI-6A scheduler 的 skip/cancel/speed/disabled/unmount 清理。新增测试验证 dispose 幂等、两张交叉层清理和后续事件重建；已有 UI-6A 测试验证上游中断与 snapshot 清理。新增测试中的中断名称参数表示共同 dispose 契约，并非六种独立端到端 UI 测试。

## 8. Performance

保留 frameloop=demand。没有新增 RAF、interval、polling 或永久 useFrame；其他动作复用既有有限 useFrame 生命周期。720p 和 1080p 均在停止 CDP screencast、牌局稳定后观察到 drawDelta=0、clearDelta=0，sprite=0。捕获工具自身会触发绘制，捕获期间的数据没有用于静止结论。

## 9. Browser QA

真实 Codex 内置浏览器 / Chromium WebGL，默认 3D URL；没有用 JSON/runtime 状态替代画面判断。

| 矩阵 | 1280×720 | 1920×1080 |
| --- | --- | --- |
| 本家正常摸牌 | 实际查看 | 实际查看 |
| 本家摸切 | 实际查看 | 实际查看 |
| 本家手切及理牌 | 实际查看 | 实际查看 |
| right/top/left discard | 三席实际查看 | 三席实际查看 |
| 普通牌局连续自动回合 | 完整帧流补看 | 完整帧流补看 |

观察抓取点覆盖目标牌、carry 同轨迹、落河后退手、手切回手理牌、摸切不理牌；所观察画面未见明显 sprite pop、双手、双牌、ghost 或整屏闪烁。Canvas 在同一牌局动作期间保持同一实例。辅助 lifecycle 观察最多一只可见 sprite，结束后 sprite=0。

工具限制：初始截图/帧流有超时或吞吐不足；后来成功取得并直接查看真实 CDP screencast 图像，连续回合使用较低采样率补足全程。1080p 图像由工具缩放，部分截图右边缘被裁切；实际 CSS viewport 单独确认 1920×1080。没有把截图文件落盘作为 PASS 条件。

测试场景使用既有 UI-6A.1 fixtures。正常摸牌 fixture 出现既有牌墙 invariant 提示；普通牌局连续回合另用无旧存档的隔离本地 origin 验证。原 origin 新游戏曾被自动审批拒绝（可能覆盖续局），因此没有在该 origin 开始新游戏，原存档保留。

Legacy：?table3d=0 内置正式测试场景可进入，跳过立直后弃出白，牌河出现白并进入下一家摸牌；Canvas=0、3D layer=0、新 sprite=0，无 crash。没有实现 Legacy 新手部或要求视觉 parity。

## 10. Tests / build / diff

- 新增 hand visual targeted：17 passed；结合 owner appearance：19 passed。
- UI-6A hand presentation / flash 等 targeted 通过（分别 68、36 项验证批次）。
- 最终 npm test：224 files passed、1 skipped；1587 tests passed、1 existing skipped。
- 最终 npm run build：通过；仍有 >500 kB bundle 提示。
- git diff --check：通过，仅既有 LF/CRLF 提示。
- 日志：ui-6b1-full-test.log、ui-6b1-build.log。

## 11. 本任务修改文件

- 新增 src/hand/handAssets.ts
- 新增 src/hand/HandVisualController.ts
- 新增 src/hand/handProjection.ts
- 新增 src/hand/handVisual.css
- 新增 src/hand/HandVisualController.test.ts
- 修改 src/components/game/LocalAnimationHand.tsx（任务开始时已是 untracked）
- 修改 src/presentation3d/animation/HandAction3D.tsx（保留原 dirty 内容）
- 修改 src/presentation3d/TableRenderer.tsx（仅预加载接入）
- 新增本报告及测试/构建日志

其余开始前 dirty/untracked 保留。没有改 Rules、GameState、AI、Scoring、Camera、Tile geometry、Appearance、Dora、Hand3D consumer、UI-6A snapshot semantics 或 UI-6A.1 texture warmup。

## 12. NOT VERIFIED

- 未逐个浏览器手动穷举 skip/cancel/route/disabled/speed 在每个 pose 边界的所有排列；依赖新增共同清理契约与既有 scheduler 回归测试。
- 未测试其他浏览器/GPU、超出两个指定视口的完整矩阵、生产服务器缓存/网络异常。
- 帧流为真实画面采样，未声称检查每一个显示刷新帧；未保存原生 1080p 完整分辨率录屏文件。

以上限制不影响本次指定矩阵中已直接观察的视觉结论。
