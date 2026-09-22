# 17-3D.C.1 — BLOCKED

本轮已实施模式内修复，但不能关闭动态视觉门禁。17-3D.C 保持 BLOCKED；未进入 D、UI-6C，未同步 Notion。

## 原因与修复

- 旧 candidate plan 调用普通 `resolveTableAnimation3DMotion`，每段单独 smoothstep，grasp→travel 在边界重新从零速度起步。新 `candidateMotion` 在 grasp + travel 共用一条 330ms 搬运曲线；release 保持落点，不再二次升降。
- 前后时长均为 approach 150 / grasp 90 / travel 240 / release 90 / retreat 170ms，总计740ms。未修改四人 timing、HandVisualController、AnimationScheduler、相机或桌面 authority。
- 原始实测两次动作 phase 交接空档为0–0.1ms，不支持“阶段之间固定等待40–100ms”的归因。阶段内部最大帧间隔约54–86ms；prepare约75–78ms，发生在approach之前，未发现动作中 await decode/texture 的代码。
- 模式根组件原来随动画每帧重复执行听牌分析，关闭的 AnalysisDrawer 也继续渲染；现在缓存分析、memo 固定牌面板、关闭抽屉时不挂载。source plan 不再逐帧重新测量 DOM，只在真实resize时重测。
- 代理原先到grasp才挂载；现在prepare期间预挂载，在ownership节点切换可见性。没有新增cache、时钟或事件总线。
- 修改后的720p连续五轮（共十次双方动作），后九次最大帧间隔约7–12ms；首个冷动作仍出现约83ms长帧。CPU抽样包含GC、React/R3F提交、HandVisualController更新及native/program时间，不能据此精确归因到某一个函数。**首个冷动作顿挫仍未完全解决，不能宣称全程平滑PASS。**

## 诊断入口

DEV URL附加 `candidateTrace=1`，只在DEV下记录到 `window.__candidateTrace`（最多4000项，不持久化）：click/自动动作、权威确认、snapshot、prepare、各phase开始/结束、scheduler progress、visual position、source、target、手部contact/pose、settle、static takeover、cleanup。时间使用performance.now，可从相邻记录计算frame interval。没有记录对手隐藏候选牌身份。

## 候选语义与安全

旧顶排来源是 `ParticipantScene` 的 `participant.fixedHand.count`，所以一直显示13张。
双人场景现在读取hidden `discardCandidates.count`。`candidateRows` / `candidateRowSlots` 共用于本家和对家：outer=min(11,N)、inner=max(0,N−11)，bottom outer在下，top outer在上。
背面布局只接受数量与seat；位置固定为11列，不因数量重新居中。匿名移除槽只由数量决定，与实际隐藏牌顺序无关；不传tile、instanceId、red或牌面。对家固定13张权威数据完全未动。
动画snapshot仅额外保存candidateCount，直到release完成/retreat开始才用权威新数量收排。抓取时只隐藏匿名source槽，代理搬运，静态牌河在retreat接管；不虚构隐藏tile identity。

## 连续性、文字

新增测试覆盖source投影误差≤1CSSpx、各阶段位置/scale/rotationX连续、grasp→travel边界非零且连续速度、release与静态river落点一致、单一owner、snapshot收排节点。
左侧固定panel宽度与固定13张grid不变；分析改为两列可收缩网格，normal换行、overflow-wrap:anywhere、取消省略裁切、只在分析容器纵向滚动。本家候选标题数量亦随presentation snapshot保持。

## Browser QA事实

使用内置浏览器真实WebGL，DEV fixture不写存档或配置；现有视频已解码查看，原录像2268×1202、30fps、19.09秒，不能当成CSS viewport证据。

| 项目 | 实际结果 |
| --- | --- |
| CSS viewport | window.innerWidth/innerHeight确认1280×720、1920×1080；请求1229×691和1843×1037进行校准 |
| 720p | 实际看到完整桌面、21张双排背面、左侧固定13张/分析、source抓取/搬运/落河/回收中间帧。双方连续五轮交互21→16；另跑12→11→10，固定13不变。没有完整逐帧查看每一次动作，不能提升为全矩阵动态PASS |
| 1080p | 双方连续五轮交互21→16；实际看到对家双排、部分搬运/落河，场景遍历确认16个匿名牌背（11+5）。捕获3686×2074像素裁掉底部候选区，无法验证完整source接触，不再反复捕获 |
| 结果/pacing | 720p首次弃牌后对手荣和到ResultDialog；1080p末步5→4、对家推进到流局；下一局回构筑；单独ron fixture点击荣和正常。自动测试继续验证barrier到retreat结束、skip/cancel/资源失败/过期callback |
| reduced motion | 720p正常推进，候选递减、固定13、sprite/proxy为0；已恢复媒体模拟 |
| resize | 1080→720，Canvas对象身份相同，Loading=0；1080底部接触未完整可见 |
| 长文字 | 720p临时替换分析DOM为长中文串进行QA，已恢复。normal/anywhere，每项clientHeight=scrollHeight=71，分析scrollWidth=clientWidth=345；看到中文多行；panel未扩宽 |
| demand | 停止捕获后的约43.95秒稳定窗口：sprite=0、proxy=0、drawDelta=0、clearDelta=0；临时WebGL计数包装已恢复 |
| cleanup | 下一局进入构筑Canvas=0/sprite=0；动作中返回菜单Canvas=0、Loading=0、sprite=0，无残留场景 |
| Console | 本轮验收标签未记录error；未隐藏任何诊断。网络失败矩阵未独立复验 |

## 工程验证

- targeted：47 PASS，4文件。
- npm test：1659 PASS、1既有SKIP；231文件通过、1文件跳过。
- npm run build：PASS（既有bundle大小提示）。
- git diff --check：PASS（仅Git换行提示）。
- 普通四人、共享host/renderer/动画相关路径由全量测试覆盖；本轮未重新跑普通四人浏览器矩阵。源码基线hash对比确认未修改四人相机/layout、规则、AI、计分、controller/scheduler core、资源或存档。

## 本轮文件

修改：

- src/components/SeventeenStepsScreen.tsx
- src/presentation3d/participants/CandidateDiscard3D.tsx
- src/presentation3d/participants/candidateAnimation.ts
- src/presentation3d/participants/candidateAnimation.test.ts
- src/presentation3d/participants/ParticipantScene.tsx
- src/presentation3d/participants/participantLayout.ts
- src/presentation3d/participants/participantTable.css
- src/dev/seventeenPresentationFixtures.ts
- src/dev/SeventeenPresentationPreview.tsx

新增：candidateMotion.ts、candidateRows.ts、candidateTrace.ts（同participants目录），以及本轮artifacts日志/报告/视频联系表。开发fixture新增initial入口，用于双方初始21张测试，不接生产菜单。
开始时48个tracked改动和所有已有untracked继续保留。hash清单见17-3d-c1-start-hashes.json；变更清单见17-3d-c1-changed-files.json（不含三个本轮新文件）。

## NOT VERIFIED / 未关闭

1. 首个冷动作约83ms长帧的精确根因与最终消除。
2. 1080p底部source→proxy接触、完整逐帧smoothness及此前C动态人工门禁。
3. 两种分辨率完整五轮逐帧矩阵、每种边界在每种分辨率的动态视觉、全部不同长文案滚动可读性。
4. 普通四人/三人预览本轮独立浏览器复验；网络故障矩阵。

结论：**17-3D.C.1 BLOCKED**。**17-3D.C BLOCKED**，不得标记FROZEN。
