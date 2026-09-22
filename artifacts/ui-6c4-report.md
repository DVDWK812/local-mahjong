# UI-6C.4 剩余人工 Gate 修复报告

## 状态

**UI-6C.4 MACHINE FIX GATE PASS**

**UI-6C BLOCKED — HUMAN MANUAL AV/VISUAL RE-GATE**

人工已通过 AV-04 / AV-11 / AV-13 / AV-18 / AV-19；本轮只要求用户重验 AV-12 / AV-14 / AV-15。17-3D.D 的外部人工视觉 Gate 不在本轮关闭。没有 commit/push。

## AV-12：中央整体与首张弃牌

新增 `centralConsoleLayout.ts` 集中输出 outerFrame、scoreHud、四席 riichiLanes。装饰框、HUD、静态棒和动画目标使用同一 authority。

- 中央框仍为 8.2、中心 [0,2]，HUD 实际原偏移 [-0.1,+0.3] 保留；Camera、桌面、River 未变。
- lane radial offset 5.2 → 3.85，四席棒完整位于框内，外侧不碰河牌。静态和动画 target 相同。
- 1080p HUD scale 保持 0.72。720p 原 0.96 会占用内部槽位，集中 fit cap 将其限制为 0.74743（约缩小22%，并非仅移动棒）。这是本轮需要人工确认的比例变化；17步/非立直布局不使用此 cap。
- 实测 CSS viewport 精确为 1280×720、1920×1080；四席目标投影与实际 HUD DOM bounds 均不相交。浏览器实际观察本家静态棒与动画落点，其余三席以统一变换、投影与几何测试验证，未分别执行三次对手立直。

**卡顿根因：隐藏的 AnalysisDrawer 仍挂载 AnalysisPanel，每次 presentation React 更新重复执行 recommendDiscards/shanten 搜索。** CPU profile 的热点为 `AnalysisPanel → recommendDiscards → ukeire → shanten → standardShanten → removeMelds/removeTaatsu`，removeTaatsu 采样346次。不是通过缩短 discard、提前隐藏或音频延迟解决。

修复：关闭抽屉不挂载分析内容；打开时按 immutable gameState memo，动画帧不重复计算。没有改搜索算法、规则或AI。原普通弃牌 duration/phase 未变。

修改前首张立直时间线（performance.now，ms）：action60671.5 → beforeEnqueue60708.5 → prepare60710.6 → first lift60750.1；提交期间长任务139ms。discard finish61427.8 与 riichi prepare61427.8 同时，stick first approach61469.4：没有证据表明 discard→stick barrier 存在额外死等。普通非立直样本也有66ms长任务。

修改后720p重复5次，hand update记录178/182/163/191/186，同event最大间隔25.7/26.9/25.3/18.9/22.9ms，均没有≥50ms长任务。第一次单独热加载后样本仍记录一次52ms任务，未从证据中删除。上述是此设备DEV采样，不是所有设备帧率保证。

## AV-14：Ron停留

`RON_REVEAL_HOLD_MS = 2000`，仍由 AnimationScheduler finite wait 和 PresentationPacing 控制。完整公开/平放逻辑未变；rong仍只在原cue一次；多荣和、skip/cancel测试通过。

- 720p：push54814.3 → announce55096.5 → hold55258.2 → cleanup57268.8，hold约2010.6ms。
- 1080p：push425316.7 → announce425598.2 → hold425759.4 → cleanup427772.4，hold约2013ms。
- 两尺寸均抓取完全倒牌与随后ResultDialog截图。没有用现实墙钟精确2000.0ms作为断言。

## AV-15：连续单牌拍下

两个根因：隐藏分析反复计算造成86–297ms长任务；原grasp→carry将全局progress=.25直接传入carry，导致pose已完成切换，同时分段位置速度在.25处突变。每帧重复setPhase还会重置announce/release状态。

修复保留slap-only：approach150ms → grasp/carry/slap210ms共享smoothstep位置 → 原impact cue → release/retract → finite hold/result。phase只进入一次；carry pose使用阶段内progress。DOM手contact与winning tile使用同一resolver；不再为本家DOM帧重复发布3D状态。未新增scheduler或更改SFX素材。

修改前21个手部记录、最大间隔102.3ms，并反复出现86–95ms长任务（另有297ms）。修改后720p重演5次：80/79/81/81/80条手部记录，最大间隔19.6/21.7/18.9/18.1/19.1ms，无≥50ms长任务。每次可见代理牌最多1张，真实drawn source由现有mask交接；无第二次全手推倒，win-impact→rong一次。1080p额外重演并截图确认源牌、抓取单牌与其余手牌保持原位。

## 最小回归、性能与清理

- AV-04：discard一次。
- AV-11 / AV-13：meld、dora、draw各一次，顺序保持。
- AV-18：正式17步界面荣和，win-impact→rong一次，媒体开始/结束，权威和牌组及结果显示。
- AV-19：双方discard各一次，流局结算，无rong。
- Legacy独立smoke：Canvas=0、3D layer=0，真实弃牌及discard一次，随后退出。不是默认renderer。
- 四人真实3D：frameloop=demand；1001.7ms稳定窗口drawDelta=0、clearDelta=0、frameDelta=0、sprite=0、proxy=0。
- 17步稳定窗口18.6秒无draw/clear增长。四人25秒长窗口包含原有宝牌deadline sweep，记录175次有限重绘；未把这段伪报为零。没有新增永久RAF、interval、polling。
- 最终退出：Canvas=0、真实`.hand-visual-sprite`=0、`.win-presentation-stage`=0。
- 所有浏览器URL带mute=1；qaAudio执行真实管线但backend静音。测试探针仅注入当前页面，已通过导航/关页清除；viewport override已reset。
- Network本次窗口43条事件，无HTTP>=400及loadingFailed。Console保留已有renderer诊断、THREE.Clock弃用warning；早期探针表达式错误属于诊断脚本，不作为产品错误或掩盖。未发现当前产品异常。

## 工程验证

- targeted：18 files / **91 PASS**，`ui-6c4-targeted-complete.log`。
- full：239 files PASS / 1 existing SKIP；**1772 PASS + 1 existing SKIP**，`ui-6c4-full-final.log`。
- build PASS，`ui-6c4-build.log`；原有大chunk warning仍在。
- diff-check PASS，exit0；Git CRLF提示单独保留。
- 首轮失败/调试记录仍保留：closed-drawer红测、旧3000ms断言、负零边界、测试环境缺RAF等；修正实现/正式新合同和fakeRAF环境，没有删测试或新增skip。
- 对照启动源码快照只读检查全部本轮diff及新增文件：**No actionable findings**。准确文件清单：`ui-6c4-changed-files.json`（16个既有文件＋4个新增源/测试文件）。现有dirty/untracked保留。

主要文件组：AnalysisDrawer及测试；WinPresentationController、WinPresentationOverlay、Hand3D、tsumoSlapMotion及测试；CentralConsoleLayout、HUD anchor、FeltDecoration、Table3DHud/Table3DScene、riichiStickLayout/tuning及测试；manualGateFixes测试和FinalGate三项说明。未改AV-04、AV-11、AV-13、AV-18、AV-19实现或音频文件。

## NOT VERIFIED / 人工复验

- **MANUAL LISTENING PENDING**：机器调用时间与媒体开始不代表真实扬声器听感。
- **DYNAMIC MANUAL VISUAL PENDING**：帧流、轨迹连续性不替代用户对自然度的判断。
- 内置浏览器viewport override后的截图存在宿主合成灰边/重复条带；DOM实测尺寸准确，牌桌主体可观察，未修改产品CSS/Camera/DPR来迁就截图。
- 未扩大三人玩法、多人计时、素材或已有人工PASS范围。

用户顺序：打开 `http://127.0.0.1:5173/?testMode=1&uiFinalGate=1`（不带mute）→手动开启QA音频→AV-12（中央四槽与连续动作）→AV-14（完整倒牌后约2秒）→AV-15（单牌连续拍下）。请只报告这三项PASS或失败现象。

机器修复Gate PASS；最终release decision **FAIL / HUMAN MANUAL GATE BLOCKED**，直到这三项人工确认，不宣布FROZEN或UI ENGINEERING COMPLETE。
