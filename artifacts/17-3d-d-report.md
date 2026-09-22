# 17-3D.D Final Gate

状态：**17-3D.D BLOCKED**。本轮不宣布 COMPLETE / FROZEN。

用户确认的 A/B PASS、C PASS / FROZEN、1920×1080 动态人工确认均保留。历史约 83ms 首次动作尖峰不作为 blocker，也未重新调整动画。

## A. Architecture

- 正式入口：App 17步设置 → SeventeenStepsScreen 构筑/确认 → presentSeventeenSteps → ParticipantTable → ParticipantScene → 唯一 SceneCanvasHost → WebGL。
- participant `seventeen:0/1` 对应 appearance slot `0/1`，显示位置 bottom/top。未补 player 2/3；左右无玩家 consumer。
- 普通四人仍为 GameScreen → TableRenderer → Table3DScene → 同一个 SceneCanvasHost。
- 17步场景直接使用独立 participant presentation，不以 toSeventeenStepsGameState 作为伪四人 scene 输入。旧投影仍供状态栏、事件桥、分析和权威结算显示使用。
- 隐藏候选仅提供数量，背面使用匿名显示槽；对手 snapshot 的 candidates 为空数组，动画 tile 来自已经确认的公开弃牌。无固定13张替代候选源。
- 规则动作先产生权威结果，表现只持有 snapshot；自动动作入口等待 pacing，不把动画状态用作规则计算。
- 场景、资源、session、手部 controller、scheduler 未复制；未修改 frozen Camera/Table/layout、规则、AI、计分、Hand Pack 或动画时长。

## B. Full Gameplay

本轮从真实主菜单完成：本地模式 → 立直麻将 → 17步设置 → 开始 → 构筑 → 确认 → 正式3D。

- 构筑初始私有区34张、固定区0张、Canvas=0；选择13张后候选21张，确认可用。
- 第一局在实际 CSS 1280×720 完成双方各17次弃牌，候选21→4，固定13张不变；最后动作结束后出现流局 ResultDialog。
- 点击下一局，回到构筑且 Canvas=0；再次选13张、确认并进入3D。
- 第二局在实际 CSS 1920×1080 开始，完成双方各17次弃牌；中途 resize 并继续弃牌，Canvas identity 保持。最终流局 → 比赛结果 → 返回设置。
- `ron` fixture 验证本家荣和：权威结果4番40符、12000，双方点差正确显示；另一次加载验证跳过后永久振听提示及继续合法弃牌。
- 两个完整回合均覆盖21、20、17、12、11、10、5、4。相同牌面候选独立减少；纯测试额外验证 instanceId/red/order 与 fixedHand 分离。

## C. Animation / Pacing

- 720p 对上排、下排、12→11、11→10、5→4 进行了有限 screencast 直接观察。能见 source gap、手/代理携带、落河接管、候选重排；未见双手并行、双牌或输入锁死。
- 连续两局固定手牌没有参与弃牌或减少；对手候选隐藏双排随回合递减。
- 本轮1080p真实操作完成；后续捕获仍存在旧 bounds 裁切，不能以裁切图代替完整动态观察。用户此前对冻结C链路的1080p人工确认仍有效。
- split Pack fixture 的实际 sprite 记录：participant0 / bottom 使用 female；participant1 / top 使用 male，不读取四人 top 的 slot2。
- reduced motion 在动作中开启后，最终 sprite 清零、候选更新至20，操作恢复；未取得足够精细时间证据宣称“同一帧立即清理”。
- 动作中返回菜单：Canvas=0、Loading=0、sprite=0、候选浮层=0。
- 最后弃牌后 ResultDialog 的顺序已观察；ron-window 的 skip/ron 实际操作通过。普通候选 target 的几何连续性、ownership、prepare取消/失败、barrier释放等 targeted tests 通过。
- 未新增 speed 或 presentation-disabled UI；当前屏幕只以默认 speed=1 调用 hook。运行时调速/关闭表现及同fixture完整规则结果对照尚未完成，不能记为浏览器 PASS。

## D. Layout / Appearance

### 未关闭的可见问题

**720p 满牌河时，本家竖版头像遮住下方牌河的部分牌，中央HUD也贴近上方牌面。** 两家各17张的正式局面已直接观察，不能将所有弃牌记为完整可辨认。

普通四人对照同样显示该底部头像锚点；DuelHud 调用共享 getAvatarFrameTuning / Table3DPlayerFrame，双人 river 使用原共享 transform。不是本轮 CSS 颜色修改引入。由于用户明确冻结这些 authority，本轮没有移动头像、牌河、中央HUD或拉远相机。

关闭该项需对满牌河遮挡作明确视觉处理，并决定是否允许调整冻结 HUD 锚点；不能通过缩小牌桌、Canvas CSS scale 或掩盖画面解决。本报告不授权后续自动扩展。

### 已完成与边界

- 固定13张位于左侧；候选位于底部，两行 outer 优先。分析中文换行、内部纵向滚动可见，宝牌区仍在左上。
- 原结算分析卡片存在深底深字：3D battle 根节点没有继承 `--seventeen-text-*`。本轮只把五个颜色变量共享给 `.seventeen-steps-game, .seventeen-steps-battle`，几何变量仍只在原 `.seventeen-steps-game` 下。修复后实际文字为 rgb(241,245,242) / rgb(169,187,180)，深色卡片可读。
- 相同 session 的 resize、动画保持 Canvas identity，requested=3d、active=3d、fallback=none、Canvas=1。
- 后续工具重新设置720p时，两轮实际值分别为1281×720和1279×720；再次1080p设置得到1920×1081。未继续校准，也不把这些值写作精确目标视口。此前真实两局开始时读取的1280×720、1920×1080另行保留。
- 两位不同 Pack 的实际消费已验证；完整 Avatar/nickname/Tile Face/Tile Back/felt/Pack 设置切换、reload及下一局持久化组合未完成。本轮未写入用户 Appearance 配置。

### 三人

- `?layoutPreview=three` 实际 WebGL 运行，三个 participant，无第四席。
- 3→18张牌河、身份换位实际操作；青竹/蓝海/赤枫及兔/狐/猫头像随身份换位，三色牌背随参与者保留。左右与本家18张牌河可见。
- resize可运行、退出Canvas=0/Loading=0，稳定窗口零绘制。
- 受后续工具视口偏差及捕获裁切影响，三人两种精确目标视口的完整视觉矩阵未关闭。
- **Three-player = Layout Preview Only; Gameplay NOT IMPLEMENTED.**

## E. Regression

- 普通四人真实3D：进入、九筒摸切→对手荣和5200、重置→九万手切/理牌、对手摸牌和弃牌、resize、退出均已运行。
- 普通四人相机仍 position=[0,35,27]、FOV=32；resize Canvas identity 不变。所有 frozen 源文件与本轮开始 SHA256 一致。
- 普通四人本家独立正常摸牌链路和完整两目标视口矩阵未补齐，不能把对手摸牌等同本家摸牌验收。
- 四人 fixture 摸牌后出现“活牌68、王牌14、已杠0”校验提示。归类为 fixture 诊断，提取前同根因归属未证实；本轮未修改或隐藏，不阻止后续操作。
- fallback/context-loss 使用现有自动测试；本轮未修改故障分支，未进入Legacy视觉矩阵。
- Scene Ready 自动合同通过；正式构筑无Canvas，确认后Canvas先挂载且未揭开，完成准备后揭开。首次观察记录中的Loading选择器不正确，因此该记录不能单独证明Loading元素可见；结合实际页面Loading、完整画面及现有frame-commit测试。未宣称逐帧覆盖所有无闪烁情形。

停止捕获后的稳定窗口：

| 模式 | 采样窗口 | drawDelta | clearDelta | sprite |
|---|---:|---:|---:|---:|
| 17步 | 17.1s | 0 | 0 | 0 |
| 三人预览 | 27.6s | 0 | 0 | 0 |
| 普通四人 | 22.0s | 0 | 0 | 0 |

17步同时检查 candidate proxy=0；另两种无活动动作。三种退出均无Canvas/Loading/手部残留。未新增常驻RAF、interval或轮询。未进行长时间堆快照/Object URL增长分析，不宣称全面内存泄漏验收通过。

## F. Engineering / Review

- Targeted：**146 PASS**，13 files。覆盖seventeen rules/match/screen、participant/baseline/candidate、SceneCanvasHost/Ready、renderer/scene、hand visual、pacing、appearance owner mapping。
- Full首次：1658 PASS、1 FAIL、1既有SKIP。失败在 `buildTableSceneState.test.ts:92`：随机初始指示牌使红五成为 double-dora，测试却固定期待 red-dora。该测试/adapter/engine与本轮开始内容一致，未修改fixture或expected。
- Full原样复跑：**1659 PASS、1既有SKIP**。不抹去首次失败；保留随机fixture不稳定风险。
- SKIP来源：`seventeenStepsAI.pressure.test.ts` 的既有 `RUN_SEVENTEEN_STEPS_PRESSURE` 环境开关。
- `npm run build` PASS；只有既有chunk-size提示。
- `git diff --check` PASS；CRLF提示不是空白错误。
- Console error采样为空。重新加载后179条已返回Network响应/失败事件中无失败，DOM图片均完整；CDP标记历史截断，故不能宣称完整Network历史无失败。
- 只读代码审计：未发现新的 duplicated session、伪参与者、隐藏身份泄漏、规则反向修改、重复事件注册、未释放barrier或永久frame loop 的可操作代码问题。结算颜色缺陷已修复；上述满牌河视觉问题仍未关闭。未完成独立音频双SFX听觉验收。

### Changed files / preservation

唯一新增产品差异：`src/styles.css`，共享17步颜色变量；无测试修改。

新增D验收产物：本报告、start/final status/stat、start hashes、targeted/full/full-rerun/build/diff日志。

本轮开始所有已有dirty/untracked保留，包括先前资源删除。开始/结束src哈希对比只有styles.css改变。真实App流程使用临时内存Storage写入隔离，测试fixture不接触普通存档；未点击继续用户存档。临时CDP计数器、reduced-motion模拟、viewport已清理，验收tab已关闭。

### NOT VERIFIED / remaining gate

1. 满17张牌河被头像/HUD遮挡的视觉关闭。
2. 全部模式在两种精确CSS视口的完整视觉矩阵（不以近似尺寸替代）。此前用户C阶段1080p人工确认不等同本D全矩阵。
3. 完整Appearance切换和持久化矩阵。
4. presentation on/disabled/reduced/skip 的同fixture最终规则结果完整对照，以及支持范围内的运行时speed检查。
5. reduced motion同帧清理精确时序、本家普通摸牌独立链路、完整Network历史、长期资源/监听器增长和独立double-SFX听觉检查。

结论：**Two-player 17-step = 正式路径已使用真实3D；Final Gate 尚未关闭。Three-player = Layout Preview Only, gameplay not implemented。17-3D.D BLOCKED。**

STOP：未进入UI-6C，未扩展17步或三人玩法，未同步Notion。
