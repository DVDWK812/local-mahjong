# 17-3D.B 验收记录

结论：**17-3D.B BLOCKED — 完整视觉门禁待本机确认**。

双人17步正式对战已经真实使用3D，功能与工程验证通过。三人仅为可运行布局预览，未实现玩法。候选池手部动画/pacing 留待17-3D.C；17步整体迁移尚未完成最终Gate。本轮未进入C、UI-6C，未同步Notion。

## 调用链与边界

正式路径：App → SeventeenStepsScreen → presentSeventeenSteps（直接读取17步权威状态）→ ParticipantTable → ParticipantScene → SceneCanvasHost → 唯一共享Canvas。

准备/构筑仍为原DOM界面。toSeventeenStepsGameState 只保留给既有状态栏、分析、事件与ResultDialog，不作为新3D场景输入。没有新增四人GameState cast、占位玩家、规则状态、缓存或时钟。普通四人继续走原TableRenderer/Table3DScene composition，未改其Camera/layout数值。

新场景使用现有TableMesh、Tile3D、TileTextureWarmup、AppearanceResources3D、SceneContentReady、SceneErrorBoundary/SceneLoading。显示真实对手13张背面固定牌、双方权威牌河、桌布与两家HUD。本家固定手牌、候选池、操作区使用原DOM；没有本家重复手牌、牌墙、摸牌位、副露或立直棒。

## 布局、身份与隐藏信息

- resolveParticipantLayout(participants, mapping, preset)：显式参与者集合和 participantId→seat 映射；拒绝重复/不存在的参与者、重复席位和不属于预设的席位。
- duel：bottom/top；three-preview：bottom/right/left，top不创建对象或HUD。参数集中在participantLayout.ts，独立于四人冻结参数。
- participant 0/1固定对应配置slot 0/1，top不是slot 2。席位只决定位置；头像、昵称、牌背/sideColor、Hand Pack解析跟随稳定身份。
- adapter分别保留 fixedHand / discardCandidates / discardedTiles。公开牌保留instanceId、red、顺序及权威标记；对手私有区域只有visibility/count，无牌型、red、Dora身份或实例ID。场景背牌没有tile props或秘密调试标签。权威结果对象不重算。
- 只为实际slot获取牌背资源，只预取实际公开牌河所需牌面；DOM只预取本家已知牌、公开指示牌及结算允许公开的信息。未加载空席位或全部Hand Packs。Pack仅解析，本轮不播放动作。

## 玩法与下一阶段接口

保留34选13、确认、候选池弃牌、350ms AI动作、听牌提示、剩余步数、ron-window、荣和/流局、下一局、返回设置。没有修改Rules/AI/计分/存档格式或旧投影；没有新增17步存档。

浏览器正式流程确认：固定手牌13张；连续两次本家弃牌及两次对手回应后，本家候选21→19，固定手牌身份/顺序未变，双方各两张真实3D牌河。最终性能修复后另测一次完整双方回应，候选21→20，双方各一张牌河。

candidateSourceSlot(candidateContainer, instanceId) 提供精确候选实例、source index和DOM rect；找不到实例返回null，不回退到固定手牌。participantRiverTarget(preset, seat, index, tiles)提供权威牌河位置与方向。没有把它们接到普通13张手牌resolver，没有伪造draw/insert/reorder或PresentationEvent。候选动画与pacing尚待C。

## 开发预览与fixture入口

启动现有Vite开发服务器后：

- `http://127.0.0.1:5173/?layoutPreview=three`：明确标注“布局预览，非三人玩法”；切换每家3/18张牌河、轮换位置、退出/重进。
- `http://127.0.0.1:5173/?seventeenFixture=ron&table3d=1`：原17步规则的荣和窗口。
- `http://127.0.0.1:5173/?seventeenFixture=last-turn&table3d=1`：双方已弃16步，真实再弃一轮进入流局。

三人数据仅是三个presentation参与者，不调用17步Rules或伪造第四家。三个明确slot使用独立头像、昵称、背面颜色、分数。换位后蓝海/蓝背在bottom，赤枫/红背在right，青竹/绿背在left，身份不变。以上入口均DEV限定，未加入生产菜单；生产dist中未检出预览路由/文案。

## Scene Ready、性能与清理

复用宿主完整frame commit，再合并当前资源签名对应的本家DOM ready及实际HUD图片ready，原子撤去共享全屏Loading。下一局不复用上一局的牌面ready；旧异步工作由现有abort/lease/session guard取消。resize不改变session key或重建Canvas。

检查中发现新DOM外观Provider包围Canvas后，父App音频刷新生成新context，R3F bridge反复configure相同尺寸。通过记录store更新栈证实；稳定DOM外观context、牌桌props和双人mapping后，停止捕获窗口 drawDelta=0、clearDelta=0。双人sprite=0/proxy=0；三人frameDelta=0、drawDelta=0、clearDelta=0、sprite=0、proxy=0。没有新增RAF/interval/polling。

双人退出、下一局回到构筑、三人退出均Canvas=0、Loading=0。三人卸载后直接遍历保留的旧scene引用，sprite=0/proxy=0。测试tab与临时viewport override均已清理。

真实WEBGL_lose_context触发后：双人active=2d、Canvas=0、Loading=0、安全平面牌河可见，候选仍可合法弃出。正常Loading未挂载该fallback。仅做此针对性检查，没有Legacy矩阵。

## 浏览器证据与视觉限制

以window.innerWidth/innerHeight为准，校准请求1229×691得到1280×720，请求1843×1037得到1920×1080。没有改产品CSS/Camera/DPR迁就捕获。

| 项目 | 结果 |
| --- | --- |
| 双人两种CSS viewport | 实际尺寸达标，requested=3d、active=3d、fallback=none、Canvas=1；观察到真实桌布、牌河、对手背牌与DOM操作区 |
| Loading与完整揭开 | 功能信号/状态转换通过；初次与下一局均观察到Loading→3D；完整逐帧无闪屏仍待人工 |
| 连续弃牌 | 候选来源、固定13、双方牌河与步数通过 |
| 荣和 | 1080p实际操作到原ResultDialog，满贯4番40符12000，双方权威分数62000/38000；最终版本720p又复验荣和与下一局 |
| 流局 | 720p实际末步弃牌+AI回应进入原流局ResultDialog；固定13、候选4、剩0步，下一局正常 |
| 双人resize | 720→1080同一Canvas identity，未重现Loading |
| 三人预览 | 720p三家18张牌河；1080p换位后身份/外观跟随；同一Canvas；无第四席 |
| 普通四人 | 隔离testMode，显式table3d=1/testAnimations=1；现有RIICHI-DISCARD-MUST-TENPAI进入3D，执行“并打出白”，转南家摸牌，退出Canvas/Loading=0；无产品error |

捕获输出并不等同CSS viewport：720p画面被缩到1333×750捕获区域左上方，周围灰底；1080p出现裁切/旧边界重复片段，荣和截图也只覆盖约1919×1008捕获区域。可辨认局部结构和结果，但不足以诚实证明全屏无裁切/重叠、resize后全部锚点以及过渡无闪屏。没有把截图尺寸当CSS尺寸，没有归因为产品缺陷，也没有继续反复校准。**完整视觉Gate保留PENDING。**

未复现本轮新的牌墙invariant错误；没有修改规则或fixture校验器，也没有将此前同文字提示归因为同一根因。

## 自动验证与工作区

- 最终targeted：10 files / 81 PASS（含新增7项adapter/layout/source测试、共享ready/session/appearance和四人相关路径）。
- 最终npm test：229 files PASS、1既有SKIP；1623 tests PASS、1既有SKIP。
- 首轮全量曾出现未修改的src/game/ai.test.ts:308随机失败；未改expected，单独重跑及后续完整运行均通过。首轮日志单独保留，不能据此宣称已证明基线根因。
- npm run build：PASS；保留既有large chunk提示。
- git diff --check：PASS。未删除、放宽或跳过任何旧测试。
- 证据：17-3d-b-targeted.log、17-3d-b-tests.log、17-3d-b-tests-first-run.log、17-3d-b-build.log。

本轮修改已有文件：App.tsx、main.tsx、SeventeenStepsScreen.tsx、TileFaceDomAppearance.tsx、AppearanceResources3D.tsx。后两者叠加在原dirty内容上，保留A已有ready/resource逻辑。

新增：participants目录下participantPresentation.ts、participantLayout.ts、ParticipantScene.tsx、ParticipantTable.tsx、participantTable.css、participantPresentation.test.tsx；dev目录下ParticipantLayoutPreview.tsx、SeventeenPresentationPreview.tsx、seventeenPresentationFixtures.ts；本轮报告/日志。

开始时43个tracked dirty文件；结束时46个（全工作区累计737 insertions/318 deletions，不代表本轮独占diff），全部原dirty/untracked与资源保留。未reset/clean/覆盖普通存档或玩家配置。原7个default手部图片删除仍是开始前内容；src/hand/cyberpunk.png、src/hand/robot.png仍缺失、未tracked/未ignored、src内无直接引用，未恢复或替换。

## NOT VERIFIED / 本机完成清单

1. 在实际1280×720和1920×1080浏览器画面中，确认双人Loading完整揭开、双方多次弃牌、固定手牌/候选池清晰、牌河无裁切重叠、resize后全部布局正确。
2. 两个尺寸打开三人预览，切至18张牌河并轮换位置；检查三家背牌/头像/昵称/分数归属、top无占位、无重叠裁切。
3. 两种尺寸复核荣和/流局弹窗滚动与按钮、返回/重进无残留和输入锁。
4. 本轮未对自定义图片全部组合做浏览器资源故障矩阵；共享缓存/失败策略由自动回归覆盖，新增模式的真实context-loss已测。
5. 普通四人的完整手部动作视觉矩阵不在本轮范围，只做受影响路径smoke；候选手部锚点/代理接管尚未实现，属于C，不能以本报告宣称完成。

完成上述本机视觉确认后可关闭B的视觉门禁；不得将当前结果称为17步整体迁移最终PASS。
