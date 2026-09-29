# 三人立直 V1 最终验收记录

日期：2026-09-22。交付状态 **IMPLEMENTED_WITH_VALIDATION_BLOCKERS**。最终 Gate：**FAIL**（必需的完整视觉证据受截图工具阻断）。SANMA-0～5 实现已落地；SANMA-6 等待用户人工核查。没有代点人工通过，没有提交、推送、发布或调用付费生成。

## 实现与审查

规则、共享适配、计时、AI、保存回放、测试 Tab 与正式菜单的范围及 S3-01～22 映射见 ../../docs/SANMA_V1.md。新增 79 个共用场景。默认35000起点、40000目标／返还；自摸有损默认，无损采用缺席闲家份额均分后各向上取百点。三人东／南各自处理常规末局和一个追加场。

代码复核围绕所有权、响应收齐、包牌分量、剩余供托、存档预算、回放、旧命令、PresentationPacing、资源卸载及跨模式隔离。收尾中修复了：JSON省略undefined后的存档指纹差异、终局剩余供托后的结果delta、恢复时钟校验、StrictMode与真实卸载区分、三席HUD昵称/布局、长牌河可达性，以及Windows开发路径导致的工作区指纹不更新。最终三人范围内未保留已确认的未修复规则缺陷；完整3D视觉表现尚不能批准。

工作区指纹复验：原场景记录2d8fe2a3b8c2；修正共享 scripts/xzBuildStamp.ts 的路径分隔符识别后，当前页面显示5a60f8491365，旧 SM-06-DOUBLE 显示“自动：需复验／人工：待核查（版本变化）”。证据 fingerprint-recheck-dom.txt。原有人工结果未被自动改为通过。

## 命令与自动结果

| 检查 | 实际结果 | 文件 |
| --- | --- | --- |
| 启动基线 npm test | 245文件：243通过、1失败、1跳过；2021测试通过、1失败、1跳过 | baseline-* |
| npx vitest run src/game/sanma/scenarios.test.ts --reporter=dot | 79场景通过；改进后的长牌河由合法动作生成并回放验证 | fixture-recheck.log、scenario-results.json |
| 最终 npm test | 252文件：250通过、1失败、1跳过；2185测试通过、1失败、1跳过；159.88秒 | final-validation.log |
| 三人子集（包含在最终全仓中） | wall 4、rules 7、scenarios 79、integration 9、longRun 40，共139通过 | final-validation.log |
| npx vitest run src/game/ai.test.ts src/game/shanten.test.ts | 44通过，用于调查之前一轮偶发四人AI失败 | ai-regression-recheck.log |
| npm run check:types | 通过 | types.log |
| npm run build | TypeScript与Vite通过；最终含指纹更新修复 | build.log |
| git diff --check | 通过；Git有LF/CRLF提示，无空白错误 | diff-check.log |
| lint | package.json没有lint脚本，未虚构运行结果 | package.json |
| 音频索引检查（npm test的pretest） | 3个有效包、0跳过；索引生命周期校验通过 | final-validation.log 开头 |

最后一次全仓测试之后只有共享工作区指纹路径修复和文档更新；该构建脚本修复随后完成生产构建及浏览器旧结果失效验证。未改变规则或测试断言。

40场长跑：三人东／三人南 × loss／split_missing_share_ceil100 × seed 1～10，每组合10场。全部自然终局。每次动作检查合法性、108实体唯一归属及点棒账本，最终从原始开局重放全部命令。10000步上限触发会直接失败并输出轨迹，没有强制结束后算通过。每场局数、步数、终局原因及点数见 long-run-results.json；本轮无失败seed。

## 失败归属

| 项目 | 基线与最终事实 | 归属／影响 |
| --- | --- | --- |
| centralConsoleLayout.test.ts:26 | 启动基线已失败，最终仍失败；预期HUD z=2.3，工作区现值1.9 | 初始已有HUD工作；本次没有改该坐标或放宽断言。不阻止三人核心运行，但全仓不能声称全绿。 |
| ai.test.ts:308 非下家非法吃 | 较早一轮final-tests.log失败，启动基线未失败；定向复验44通过，最终全仓也通过 | 原fixture包含未固定的随机初始玩家手牌；本次未改四人ai.ts。存在偶发测试风险，未当作固定基线或删测试。 |
| 截图裁切／重复 | 多次内置浏览器截图在DPI/viewport变化后出现裁切、灰块或重复条带 | 阻断完整两档3D视觉Gate。没有修改摄像机来掩盖工具输出，也没有拼接或伪造截图。 |

## 内置浏览器操作证据

主地址 `http://127.0.0.1:5173/?mute=1`。使用已在运行且提供当前代码的5173服务。正常启动命令为 `npm run dev -- --host 127.0.0.1`；工作中另一次启动因端口占用落到5176，已停止该额外进程。主验收与最终人工入口均为5173。

| 项目 | 状态 | 直接观察 |
| --- | --- | --- |
| 正式菜单 | PASS | 本地模式→立直麻将→三人间，三人东／三人南均可开始；无第四名玩家。 |
| 真人＋两AI正常路径 | PASS | 默认点数的三人南无损模式中，真人摸切和拔北，AI响应与和牌，下一局换庄，保存退出恢复。所得分数及规则未受赛前新选择影响。 |
| 正式完整比赛 | PASS | seed3374887155，三人东有损，起始／目标／返还均1000，1秒基础/0秒Bank，用于快速超时与整场边界验收；182步，东一至东三，常规终局。三家1000，同分按开局风序，成绩20/0/-20。formal-completion-dom.txt。该特殊时间配置的AI频繁走超时后备；默认时间下AI实际动作另由上一条验证。 |
| 原子抢北双响 | PASS | SM-06-DOUBLE：真人拔北，电脑二先Ron后仍等待，电脑一Ron才结算。三家29700/39000/36300；北区0、活牌54不变，供托仅一次。 |
| 低番无损与账本 | PASS | SM-10-LOW-FULL：电脑一2番30符，自摸后33700/37100/34200；逐笔付款1300、800。 |
| 真实测试时钟 | PASS | SM-14-TIME：5次＋5秒后，只执行一次弃出真实摸入北；北区仍0，下一位活牌摸入，余牌54→53。 |
| 四北／四杠 | PASS（操作） | SM-09-EIGHT：同一玩家从2北再拔两北，北区4、活牌48→46，表指示牌保持5；自动断言验证8补牌、14保留边界。视觉细节待核查。 |
| 保存恢复 | PASS | 三人南无损牌局退出恢复后保持原支付策略、局次、点数及北区。中间响应和预算边界由共用registry与集成测试覆盖。 |
| 回放 | PASS | SM-10-LOW-FULL从头0/1恢复35000各家；快进至1/1重现同一1300＋800；滑杆Home退回0/1，动作禁用。 |
| 三人渲染诊断 | PASS | CSS1280×720、1920×1080均读到Canvas=1、requested=3d、active=3d、fallback=none、participant-count=3、无横向溢出。 |
| 两档完整构图／指针／动画细节 | MANUAL BLOCKED | 有正常720整桌图，但其他关键截图反复裁切或重复；不能确认所有动画中间帧、四杠间距和两档全构图。 |
| 生命周期 | PASS（已执行路径） | 多次场景加载、退出、同页面正式/测试切换、观察席切换、回放开关均可继续操作；没有观察到残余决策回调。长期内存曲线未测，不能据此声称无任何泄漏。 |
| 四人3D回归 | PASS（smoke） | 正式四人东，三万弃牌后AI接续，4席；Canvas=1、active=3d、fallback=none。 |
| 17步回归 | PASS（smoke） | 正式构筑13张后确认；双席3D，Canvas=1、fallback=none；后续进入对手行动。 |
| 血战回归 | PASS（smoke） | 正式四席换三张→定缺条→正常行牌；Canvas=1、active=3d、fallback=none。 |
| Legacy独立回归 | PASS（smoke） | 仅最终Gate访问 `http://127.0.0.1:5173/?table3d=0&mute=1`；四人Canvas=0、3D layer=0，二万弃牌后进入南家摸牌，无崩溃。未为三人新功能扩展Legacy。 |

Console：回归专用页未见error；最终三人场景没有Runtime.exceptionThrown。开发期间有一次修改effect依赖数组造成的HMR警告，刷新后未复现；THREE.Clock弃用提示单列为既有运行库警告。未把这些描述为生产异常。

Network：final-scene-network.json为最终四杠／四北加载与操作的84条事件，hasMore=false、truncated=false；没有HTTP400+或异常；一项 canceled=true 的 Media ERR_ABORTED 对应切换场景取消旧媒体。browser-events.json保留较早136条事件，音频MP3为200、draw/discard WAV为206；较早长时段缓冲有truncated=true，不能代表完整冷启动历史。未发现必需资源失败；完整冷启动请求归档仍不完整。

## 截图证据及限制

- formal-south-720.png：已打开检查，完整三席桌面、正确换庄后的HUD、底部手牌与操作区；是可用的720档整桌参考。浏览器CSS为1280×720，平台输出PNG为1229×691，不能冒称PNG本身1280×720。
- formal-south-result-720.png、double-ron-720.png、low-full-1080.png、long-river-720.png、long-river-1080.png：已检查，含裁切／重复／灰色留白的无效或不完整截图；保留用于说明环境阻断，不列为视觉通过证据。
- 浏览器实际点击和DOM状态可支持交互结果，但不能替代完整截图、hover命中与动画中间帧视觉检查。人工核查顺序及每一步caseId见实现文档最后一节。

## 剩余核查

用户需完成SANMA-6：两档完整视觉、长河与四北／四杠空间关系、手部动画中间帧、hover命中、实际听感、连续退出重入，以及逐场景人工通过／不通过。测试静音不代表音频听感已验收。该模式尚未标记COMPLETE或FROZEN。

构建仍有大于500KB chunk提示（入口约2.53MB）；没有为消除体积提示进行无关拆包。最终状态清单和差异保存于final-status.txt、final-diff-stat.txt、final-tracked-diff.patch；这些包含其他并行任务原有工作，不能全归入三人改动。
