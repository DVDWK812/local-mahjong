# 17-3D.C 验收记录 — 2026-09-18

**17-3D.C BLOCKED — 1080p 动态视觉检查待人工确认。**

实现与自动验证已完成；不能用通过的测试或运行时坐标替代未完整观察到的 1080p 接触画面。本轮未进入 17-3D.D、UI-6C，也未同步 Notion。

## 实现

1. 候选仍按权威数组顺序排列：`topCount=max(0,N-11)`，前 topCount 张放上排，其余放下排。固定 11 列、两行高度、原底部锚点及牌宽不变。21/20/17/12/11/10/4 均有断言。同牌面使用 instanceId 区分。
2. 固定手牌仅改模式局部 CSS：牌宽 `clamp(49px,3.2vw,61px)`，padding 10px，网格间距 4px/3px，仍为 7+6。未使用整体 scale；分析仍局部滚动。
3. 点击前捕获候选 instanceId、row/column、实际 `.tile` rect 和整个出牌前候选数组；调用原 `discardCandidate`，只在权威候选减少且对应实例新增到牌河后保留动画快照。
4. 复用原 `useGamePresentationEvents` 的一次 confirmed discard → 原 PresentationEventBus → HandAnimationConsumer → HandAnimationController / AnimationScheduler → CandidateAnimationTarget → CandidateDiscard3D / HandVisualController。没有另发弃牌事件或重复触发 SFX。模式 consumer 不使用普通固定手牌 handHistory。
5. 本家来源由真实 DOM rect 投影到当前 camera；对家来源为模式布局内桌面上边缘之外的 concealed-candidate anchor。对家快照不含未公开候选；固定 13 张不作为来源、不减牌。本轮没有 draw、drawn-slot insert 或普通 arrange-push 阶段。
6. approach 保留原候选；grasp/travel/release 隐藏源槽但保留原布局，只有代理可见，静态新牌河隐藏。进入 retreat 时代理移除，静态牌河接管，并切换到最新候选布局。手部和代理使用同一个运动位置及既有 crossfade。
7. Pack 按稳定 participant 0/1 → appearance slot 0/1 解析，不按风位/top读取 slot 2。只预加载实际两位参与者的有效 Pack，继续复用缓存和资源失败策略。代理准备还等待场景关键资源就绪。
8. 原 350ms 保留为独立 AI 思考延迟，其后等待原 PresentationPacingGate，再派发自动动作。ron-window 提示、AI 荣和响应、ResultDialog 均在当前表现结束后继续；分数和结果仍取 Rules。动画期间重复提交被拒绝。
9. cancel/unmount/reduced motion/disable/speed 切换清空源 mask、快照和代理，释放对应 barrier。异步 prepare 可取消，旧 generation/session 回调不能复活动作。复用原 2500ms fail-open，未新增永久 RAF/useFrame/interval 或第二套时钟。

## 自动验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 定向测试 | PASS，35 项 | `17-3d-c-targeted.log` |
| npm test | PASS，1647 项；1 项既有 SKIP | `17-3d-c-full-test.log`；231 suites passed / 1 skipped |
| npm run build | PASS | `17-3d-c-build.log`；保留现有大 chunk 提示 |
| git diff --check | PASS | 最终命令退出码 0 |

新增测试包含实际 scheduler phase 断言、release/retreat 的 ownership 与 12→11、相同牌面实例、上下行投影、固定手牌不变、有效 Pack 归属、pacing 不抢跑、荣和权威结果、skip/speed/dispose、取消未完成 decode、prepare 失败、fail-open 和旧会话回调。

第一次 build 发现新增测试 action.playerId 被推断为 number；已补正确的事件类型，最终 targeted/full/build 已在最终产品代码上执行。没有删除、跳过或弱化旧测试。此前固定牌宽的 CSS 断言按本轮明确要求改为 49–61px。

## 内置浏览器结果

使用现有 localhost DEV fixtures；没有覆盖用户存档或持久外观。新增 `cross-row` 沿原 fixture 调用真实 discard/pass 构造 12 张候选状态；`seventeenPacks=split` 只在开发预览 props 中覆盖 female/male，不保存设置。

| 项目 | 结果 | 直接证据 |
|---|---|---|
| 实际 CSS viewport | PASS | 1280×720、1920×1080；读取 innerWidth/innerHeight，不用捕获像素代替 |
| 真实 WebGL | PASS，两尺寸 | requested=3d、active=3d、fallback=none、Canvas=1；实际看见桌布、背面固定牌与牌河 |
| 初始 21 张 | PASS，720p | 上10/下11；上、下排均真实点击；连续本家3次及对家推进 |
| 固定面板 | PASS，静态两尺寸 | 左侧7+6清晰，局部缩小，未压缩Canvas或遮挡宝牌 |
| 本家 source→proxy→river | PASS，720p 抽样中间帧 | 看见抓取、原槽空位、携牌、河落点及补位；未见重复源牌/代理 |
| 对家与不同 Pack | PASS，720p 抽样中间帧 | female本家、male对家；手从桌外进入；对家13张背面牌仍完整 |
| 12→11 | PASS，720p | 上排1张实际弃出后上排为空，下排11张不向上跳 |
| 11→10、5→4 | PASS，1080p 操作/DOM | 下排 top 均约1000.635 CSS px；固定13张保持 |
| 最后一步流局 | PASS，720p/1080p | 真实点击后双方推进；动画 approach 时无结果弹窗，结束后原 ResultDialog；剩4张在下排 |
| 荣和/跳过 | PASS，交互 | 720p实际跳过后继续；1080p既有ron fixture点击荣和，显示原4番40符/12000结果 |
| 下一局 | PASS，1080p | 点击下一局，重新选13张确认，进入新session；旧快照未带入 |
| resize / Canvas identity | PASS，运行时与静态画面 | 同session由720p到1080p，Canvas对象相同，active=3d/fallback=none |
| 1080p 动态接触点及完整交接视觉 | **NOT VERIFIED** | 帧流捕获旧边界裁掉底部区域，不能确认本家手/候选接触的完整画面 |
| reduced motion | PASS，真实中途切换 | approach期间sprite=1；启用reduce后sprite=0、mask=0、权威候选20、固定13；恢复后可再次弃牌 |
| 动画中退出 | PASS，1080p | sprite=1时点击返回菜单；随后Canvas=0、Loading=0、sprite=0、候选面板=0 |
| 稳定 demand | PASS，1080p | 停止捕获后31.5秒：sprite=0、proxy=0、drawDelta=0、clearDelta=0 |
| Console / Network | 观察窗口PASS | 应用error列表为空；既有THREE.Clock弃用警告。可用149条网络响应/失败事件中无失败；历史缓冲截断，未宣称全量冷启动网络验证 |

捕获尺寸与 CSS viewport 不同：720p CUA 截图为1333×750，实际内容缩放在左上；短时帧流能完整观察动作。1080p CUA 捕获含旧边界/重复边缘，帧流底部裁切。没有据此修改产品 CSS、camera、DPR 或牌桌。停止重复捕获尝试，待验项保留人工门禁。

辅助树读出的“无法启动3D”来自 Canvas 的备用文本，并不是屏幕实际 fallback；后续真实画面及 renderer diagnostics 已区分。QA 临时的内存 storage 试验、WebGL调用计数器、reduced-motion override 已随页面离开/还原移除；viewport已reset，测试tab已关闭。

## 保留与改动文件

任务开始的 dirty/untracked 记录在 `17-3d-c-start-status.txt`、`17-3d-c-start-stat.txt`、`17-3d-c-start-hashes.json`。与开始时逐文件 hash 比较，本轮修改以下9个既有文件，新增4个文件；其余已有源码、资源改动保留。普通四人、Rules/AI/Scoring、SceneCanvasHost、HandVisualController、AnimationScheduler、Pack素材、frozen camera/layout authority、renderer policy均未改动。

新增：

- `src/presentation3d/participants/candidateAnimation.ts`
- `src/presentation3d/participants/useCandidateAnimation.ts`
- `src/presentation3d/participants/CandidateDiscard3D.tsx`
- `src/presentation3d/participants/candidateAnimation.test.ts`

修改：

- `src/components/SeventeenStepsScreen.tsx`
- `src/presentation3d/participants/ParticipantTable.tsx`
- `src/presentation3d/participants/ParticipantScene.tsx`
- `src/presentation3d/participants/participantLayout.ts`
- `src/presentation3d/participants/participantTable.css`
- `src/presentation3d/participants/participantPresentation.test.tsx`
- `src/presentation3d/participants/participantBaseline.test.tsx`
- `src/dev/SeventeenPresentationPreview.tsx`
- `src/dev/seventeenPresentationFixtures.ts`

## 剩余人工检查 / NOT VERIFIED

在本机浏览器实际1920×1080下使用以下开发入口：

1. `/?seventeenFixture=ron&seventeenPacks=split&table3d=1`：跳过荣和，再分别点击上下两排候选；看见手接触正确实例、源gap保留、代理落河后才补位，连续双方动作不重叠。
2. `/?seventeenFixture=cross-row&seventeenPacks=split&table3d=1`：点击唯一上排候选，确认12→11上排清空、下排不跳；resize后再弃一张，确认接触仍对齐。
3. `/?seventeenFixture=last-turn&seventeenPacks=split&table3d=1`：观察最后双方弃牌的完整落河/撤手，再出现流局结果。确认没有瞬时闪白/缺牌/双牌。

此外，真实浏览器中的 speed切换、presentation-disabled、资源decode失败注入及“刚发生的荣和弃牌动画→提示→结果”整段未做端到端视觉验证；有相应 controller/pacing 层自动证据，但不冒充浏览器PASS。未重新执行普通四人或Legacy浏览器矩阵（本轮未改公共动画接口；相关全量测试通过）。三人依旧仅布局预览。

**17-3D.C BLOCKED。即使人工门禁随后关闭，也不自动代表17步整体迁移最终Gate完成。**
