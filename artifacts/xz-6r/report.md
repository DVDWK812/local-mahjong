# XZ-6R 收尾报告

总体 Gate：**FAIL**。人工验收：**NOT_RUN**。未提交、未推送、未发布。

本报告仅对应冻结快照 `4f994175d7dfaf280fef0774b1285df29ccea82948c1973f99430b49c6a800cf`。不能标记“自动复核通过，待人工复核”：全项目仍有中央 HUD 基线冲突。暂停期间当前工作区产生了额外并行改动，不在本次固定构建验收范围内。

## 执行依据与边界

- 用户明确授权 XZ-6R 收尾修复、下载取证、关键测试补齐、最终复核，禁止扩展规则/素材/共享系统。
- 已读取 Notion 第22—23节，原文保留于 `notion-22-23.md`。Notion页：https://app.notion.com/p/3e3dc10ec1b581aaac6cf48f65a92180 。本轮未向 Notion 写入。
- 提到的 `XZ_6R_Codex_Closeout_Task.md` 未在指定附近及 Desktop/Downloads 检索到；没有因此中断，按用户正文和成功读取的 Notion 执行。V1附件已读取。
- 根 AGENTS、3D AGENTS、bugfix / rule / UI / release-gate Skill 边界适用。无付费素材调用、无 Voice Pack 覆盖、无冻结牌桌/相机生产坐标修改。

## R0：固定可复现快照

根因：仅记 HEAD 无法表示未提交 tracked 修改、untracked 血战/并行代码和实际参与构建的声音索引。

新增 `scripts/xzCloseoutSnapshot.mjs`：复制工作区字节，清单逐文件 SHA-256；显式纳入被忽略但运行必需的声音索引；复制后再次核对源字节，拒绝混合并发快照；不覆盖既有目录，不进行 Git 清理或回退。

最终目录：
`C:/Users/Wenkai/.codex/visualizations/2026/09/22/01a0c8b7-cdb2-7933-81ee-e49432b9a594/xz6r-final-r2`

| 项目 | 值 |
|---|---|
| HEAD | 5620bbbb4f73fa1001d663f49c98ad88e75b58e8 |
| 完整输入快照 | 4f994175d7dfaf280fef0774b1285df29ccea82948c1973f99430b49c6a800cf |
| 源码指纹 | d77d6134017e491bf927401cf84557a98446016705c1f043a2823996b5303c60 |
| 输入文件 | 1,350；70 个未跟踪/运行必需文件；694,557,535 字节 |
| package-lock SHA-256 | 057cd8da38ea251b50d105d73378497c4f0bad4a905ca59df0bfc912e588bfc5 |
| 已安装依赖锁 SHA-256 | c66118395c51c28327363ca85b3df75e5f6c5b13f8170bb0418defe65beb24fc |
| Node / npm | v24.18.0 / 11.16.0 |

完整文件清单 `source-manifest.json`；源快照、现场和版本核对 `snapshot-final-verification.json`；具体包版本 `package-versions.json`。node_modules 以 Junction 复用已安装依赖，安装锁前后哈希一致，未声称执行 npm ci。构建生成声音索引后的全部快照输入再次核对，零变化。

排除 artifacts、缓存、dist、node_modules、秘密目录等非输入文件；排除清单完整保留。任务开始状态、二进制 diff、最后状态均在本目录，未丢弃已有 dirty work。快照本身保存完整源码，不依赖未提交内容后来仍存在。

暂停后现场新增变化：xzBuildStamp、SanmaScreen、SanmaTestTab、ai.test、sanma longRun 两文件及共享 matchRuntime，共7项。它们未被覆盖，也未冒充已经受测。固定快照仍零漂移。

## R1：centralConsoleLayout — BLOCKED

- 测试 `src/presentation3d/table/centralConsoleLayout.test.ts:26` 严格期望 `[-0.1,0.698,2.3]`。
- 任务前既有生产调参 `hudOnlyOffsetZ=-0.1`，叠加中心2，实际 `[-0.1,0.698,1.9]`。
- 3D AGENTS 仍记录另一旧锚点 `[0.2,0.698,1.7]`；`artifacts/hud-v2-qa.md:31` 仅记录“期望2.3、实际1.9为既有修改”，不是批准1.9。
- 检查既有记录与历史，未找到明确批准1.9的依据。因此生产坐标和测试 expected 均未修改。没有权限自动审查拒绝；阻断是批准证据不足。
- 所需解除条件：提供明确批准基线及适用范围。只有确认1.9确为批准值，才严格同步这一旧 expected 并重跑新固定快照的门槛。

## R2：真实下载、落盘、回读 — 已完成

根因：工具的 download 事件通知超时并不等于应用没有下载。实际文件已经进入 Windows Downloads；最初错误判断已更正，没有无证据改写下载实现。

最小修改：比赛信息页补配置导出；测试报告明确 schemaVersion=1；新增独立报告格式校验和只读回读入口。报告回读不写验收状态，更不写人工结果。复现/回放继续走生产 parseXzSave → replayXz；配置走 validateConfig。

全部由真实页面按钮触发下载，读取磁盘实际字节后复制到 `downloads/`；与原 Downloads 文件逐字节一致。再把实际文件文本输入对应页面读取器，未使用 mock 或把内存序列化当作下载证据。

| 实物文件 | 字节 | SHA-256 | 回读结果 |
|---|---:|---|---|
| 血战配置.json | 3040 | 0babe6e8ce588e66ffbc4fbe14b2beb2980832b18bf9eb878daa870bb63a9fb3 | 配置已验证并导入 |
| 血战测试报告 (1).json | 551474 | e50d2794d9e8b6ee5ceaec4fb309508b4a159820ae63d47e8cecc0a7e879cf91 | 19个用例，代码和快照一致，未写人工记录 |
| XZ-TRIPLE-复现.json | 20527 | 77bc9ef0cb81d10d771e614d6ac323e5b6c67e34b7ae32d7f71a643c46d7d226 | 4个动作、3笔账、97/101/101/101 |
| 血战回放.json | 21270 | d33bb60fc6edd03243dbbcc032617dcbdf08dce8b99dc7104d536f3d0729b542 | 4个动作、3笔账，含runtime，生产回放验证通过 |

`download-manifest.json` 包含原落盘位置、时间、大小、版本与一致性。回读证据：`config-readback.txt`、`report-readback.txt`、`replay-readback.txt`。报告属于独立格式，没有拿回放校验器假冒报告阅读器。

## R3：720高度三响/HUD/结果可用性

根因：旧结算框固定在右上，720高度遮住右座头像；底部单行摘要不能可靠展示三位赢家细节，旧框不能收起。

最小修改仅在血战：`XuezhanResults.tsx` 只读权威 wins/score；中央结果容器、可键盘聚焦/滚轮滚动的明细区、固定在滚动区外的操作按钮、每位赢家独立展开、收起/展开结果。包含四座分数/状态、各赢家原番/计番/番型/支付。继续观战也可看胡牌记录。没有以视觉状态判定规则或修改 GameState。

真实交互：三响每位赢家详情可展开；720滚轮到底可看到第三家的基础点1/单份胡分1；收起后查看HUD/牌桌；单响、双响、真人自摸观战、下一局/退出均加载真实场景。720实点下一局后第2/2局、活跃4、97/101/101/101。对应DOM证据 XZ-SINGLE、XZ-DOUBLE、XZ-FIRST、XZ-NEXT-browser.txt 与 next-after.txt。

有效人工可读截图（已实际查看）：
- `screenshots/baseline-triple-720-valid.png`：修复前右侧遮挡。
- `screenshots/final-open-720-valid.png`：修复后四座汇总、操作按钮。
- `screenshots/final-third-detail-720.png`：第三位赢家滚动明细。
- `screenshots/final-triple-1080-valid.png`：1080三响完整结果。

截图哈希/像素见 `screenshot-manifest.json`。CSS视口1280×720、1920×1080；系统浏览器缩放96%，实物PNG像素相应为1229×691、1843×1037。部分早期和补拍PNG出现系统缩放裁切/拼接异常，保留作诊断，不作为通过依据；文件名含valid也不代替本段明确白名单。未移动冻结世界坐标以配合截图。临时CDP视口覆盖已清除。

## R4：配置与实质行为验证

详细映射见 `config-test-map.md`，区分配置接受/持久化、可推进、独立期望金样。

补齐：
- 多响×呼叫转移×3分余数：固定2+1或最近家3；保存恢复后推进墙尽，断言不会再次退税。
- 三响第一位响应后恢复：响应仍未结账；另外两位确认后只生成三笔1分，分数97/101/101/101。
- 真正碰后无drawn的权威25秒超时：固定夹具弃二万，只有一次碰。旧测试只调用默认动作却写“碰后”已纠正名称，新测试确实经过生产碰与时钟。
- 报告格式拒绝回放冒充与非法人工状态。

开发期失败也如实保留说明：曾使用不完整碰牌夹具，未真正进入碰后；又把未批准的“最右”当成期望。核对附件只要求确定性合法弃牌后，固定完整两门手牌与首庄，断言固定二万，未修改生产规则。类型检查曾报 ES目标不支持Array.at，改用既有数组索引方式。

统计：固定1000种子10000—10999，每预设200＋随机合法配置200；maxSteps=92（生产命令，含准备和每人响应），成功胡牌组851、胡牌人数855、多响组4；929局墙尽细分0胡448/1胡320/2胡161/3胡0；三家胡结束71局。不能把929说成无人胡，不能把难度分歧43/100或个性分歧33/100说成强度排序。

3099个合法字段两两组合完成生产小局，233依赖非法组合被拒绝。该批次不等价于所有组合的独立计分正确性。没有声称穷举高阶组合；已胡×花猪收款×退税、抢补杠部分响应×剩余预算的全部交叉仍没有逐组合独立金样。

## R5：全项目随机夹具根因修复

首份候选快照7510f78c…全项目还出现旧 adapter 测试随机失败：夹具调用随机初始牌，随机四万指示牌使赤五万成为双重宝牌，测试却固定只期待赤宝牌。

最小修改 `buildTableSceneState.test.ts`：固定指示牌0和3，两例分别严格断言 red-dora / double-dora，并继续保留牌序与drawn断言。不删除断言、不放宽 expected、不改生产语义。修复后生成全新 r2 快照，统一重跑，而不是挑一次随机通过。首次失败日志保留 `full-test.log`，最终日志在 `r2/`。

## R6：正式命令与结果

所有下列正式命令 cwd 为上述冻结 `xz6r-final-r2`。时间和退出码逐项在 `r2/commands.jsonl`。

| 命令 | 真实结果 |
|---|---|
| npm run test:xuezhan | 7文件，217测试通过；含1000种子与3099组合 |
| npm run check:types | exit 0 |
| npm test | 2189通过、1失败、1既有skip；251文件通过、1失败、1skip |
| npm run build | exit 0，完整tsc＋Vite生产构建 |
| VITE_ENABLE_TEST_MODE=true npm run build -- --outDir dist-diagnostic | exit 0，独立诊断产物 |
| git diff --check（现场） | exit 0；只有既有LF/CRLF提示 |

唯一最终测试失败：R1 centralConsoleLayout 2.3/1.9。既有skip没有新增或删除。构建有既有500kB chunk提醒，不影响退出码。未升级依赖。

生产和诊断各611个文件，完整哈希在 `build-manifest.json`：
- 生产 index.html SHA：10f288efd99c8d143b248881171418eea5d98daf4358dc754bc6fa13d9a9c018，入口 index-Bsh7BwVy.js。
- 诊断 index.html SHA：61fa1184aa5e811cbc637a9db0a1f35d1d7f47144689efe3c7bc4e2425588470，入口 index-DeeUQ27K.js。
- 页面导出报告与诊断页头显示同一完整快照/源码指纹。生产实际网络观察到对应入口200。

## 浏览器自动复核

| 项目 | 结果/证据 |
|---|---|
| 真实入口 | 生产5189主菜单→本地模式→血战到底→比赛信息；诊断5190测试者模式→血战到底 |
| 页面批次 | 19自动部分通过；1纯视觉未运行；人工待复核/不适用未被代填 |
| 三响3D | Canvas=1、requested=3d、active=3d、fallback=none；720/1080见上述有效截图 |
| 单胡/双响/观战/下一局/退出 | 真实场景加载，权威DOM和点击结果见上述证据；不把截图采集异常当成应用通过证据 |
| Console | 生产0错误；诊断无错误，既有THREE.Clock弃用警告 |
| Network | 生产9事件、诊断53事件，未截断；无HTTP≥400。Double Down/Iron Crest音频均206；切换时2/1个Media请求取消ERR_ABORTED，非缺文件 |
| Legacy独立冒烟 | 仅最终Gate执行table3d=0；隔离四人暗杠场景Canvas=0、3D层=0，实际暗杠余牌69→68，Console无错误；未写人工通过 |

网络与Console原始证据 `production-network.json`、`diagnostic-network.json`、对应 requests/console JSON。Legacy证据 `legacy-smoke.txt`。所有自动化URL均带mute=1；静音不是听感验收。

## 本轮实际源码修改

1. scripts/xzCloseoutSnapshot.mjs（新增固定快照工具）
2. scripts/xzBuildStamp.ts（快照身份、生产/诊断/开发标记）
3. src/game/xuezhan/buildStamp.d.ts（可选身份字段）
4. src/components/XuezhanResults.tsx（新增只读结果展示）
5. src/components/XuezhanScreen.tsx（接入结果组件）
6. src/components/XuezhanSettings.tsx（配置导出）
7. src/components/XuezhanTestTab.tsx（版本报告与只读回读）
8. src/components/xuezhan.css（血战专属结果容器）
9. src/game/xuezhan/report.ts（报告校验）
10. src/game/xuezhan/closeout.test.ts（报告/部分响应恢复金样）
11. src/game/xuezhan/boundaries.test.ts（转移后墙尽不重复退税）
12. src/game/xuezhan/runtime.test.ts（真实碰后超时）
13. src/game/xuezhan/acceptance.test.ts（精确压力统计）
14. src/presentation3d/sceneState/buildTableSceneState.test.ts（固定随机夹具、双重宝牌断言）

其余既有dirty/untracked是任务前或并行工作，不归为本轮修改。内容差异见 changes-6r.json（相对已含快照脚本/类型初步变更的baseline-complete）及任务起始/最终diff。未新增规则、未改血战生产engine/scoring/AI、未改旧声音资源或冻结牌桌坐标；保存和回放仍v1，新增报告是独立版本格式。

## 固定启动命令与人工入口

PowerShell终端1：
```powershell
Set-Location 'C:/Users/Wenkai/.codex/visualizations/2026/09/22/01a0c8b7-cdb2-7933-81ee-e49432b9a594/xz6r-final-r2'
npx vite preview --host 127.0.0.1 --port 5190 --strictPort --outDir dist-diagnostic
```
终端2同目录：
```powershell
npx vite preview --host 127.0.0.1 --port 5189 --strictPort --outDir dist
```
若端口已在运行，不重复启动。预览仅提供已构建产物，不重新构建。

真实测试入口： http://127.0.0.1:5190/?mute=1&testMode=1 → “血战到底”。页头应显示快照4f994175…、源码d77d6134…、diagnostic。

人工固定步骤（当前NOT_RUN）：
1. 搜索XZ-TRIPLE→加载真实场景，保持完全控制。打开规则与账本逐位win，或逐步执行三次；第三家确认前不结算，最终三笔1分、97/101/101/101。
2. 在1280×720与1920×1080检查四座身份、三赢家明细。滚轮查看第三家支付，收起/展开结果，打开/关闭账本，退出。不得用放大截图替代实际操作可读性。
3. XZ-SINGLE / XZ-DOUBLE加载自动结果：分别核对99/101/100/100和98/101/101/100，仍继续行牌。
4. XZ-FIRST加载真实场景→自摸：106/98/98/98，真人观战、另外三家继续。
5. XZ-NEXT加载真实场景→下一局：第2/2局，活跃四人，积分97/101/101/101保持。
6. 实际导出报告/复现/回放；用本报告对应读取器回读。比赛信息导出/导入配置，确认规则摘要一致。
7. 听感另由真人在非静音URL `http://127.0.0.1:5190/?testMode=1` 检查：主动操作触发出牌/碰杠/胡牌、确认音量/重复音/时序。不把mute=1自动化当成音频通过。

R1未解除前维持FAIL，不向人工阶段宣称自动门槛全部满足。当前现场含7项后续并行变更，其后续综合验收须再建立自己的固定快照。本轮未擅自提交、推送或发布。
