# 血战到底 V1 实现与复核报告

日期：2026-09-22。执行范围为附件及 Notion 第16—21节；Notion 已成功读取。XZ-0—XZ-6 已连续实施，未等待逐阶段批准。**当前 gate：FAIL（全项目验证有阻断，人工复核未进行）**。不能据专项通过声称全部验收完成。

## 已实现行为

- 沿用本地模式原有“血战到底”按钮，接入比赛信息和正式对局；四个基础预设、常用/高级分组、搜索、规则摘要/差异、自定义保存及校验后导入。规则包含版本、来源预设、完整快照和稳定语义标识，开局后只读。
- 比赛局数/积分/负分或小局清算后破产结束、指定/随机首庄、轮庄/首胡坐庄及流局庄家选择；同色换三/四及四种方向，四家提交后原子交换；定缺/自由打缺、持缺时碰杠选项。准备中的选牌草稿也通过权威动作保存。
- 108张万筒条唯一实体、固定四座、无吃；胡后退出行牌但保留座位，真人胡后观战。单/双/三响统一响应仲裁；单响最近下家优先，落选不算主动过胡；过手胡关闭/等本人实际摸牌/仅更高基值可胡；仅自摸和抢补杠配置实际生效。
- 完整普通拆分与四川七对择优，四张同牌可算两对；大对子、清一色、七对、根、杠上花/炮、抢杠奖励、海底自摸/炮、门清、中张、金钩钓、将对、带幺九、天胡、地胡共16项开关及受限番值。查叫不注入自摸、海底或杠奖励；不使用日麻役/振听/宝牌/番符判断。
- 底分、2—6番封顶/不封顶、自摸不加/加底/加番、附加值及封顶顺序；暗杠/直杠/补杠支付与倍率。补杠先抢后提交，被抢不收分不补牌；无补牌不允许杠。
- 点杠花包赔按当时其他活跃对手应付金额求和；呼叫转移只转最近成功杠实收一次，多响按最近一家或均分且稳定分配余数。逐笔账本保存事务、动作/杠来源、支付方、原因、幂等键；已转移部分不再退税。
- 墙尽最后响应后同快照分类，按退税→花猪→查叫清算。花猪罚额/含已胡收款者、叠加查叫、结构/公开耗尽听牌、两种退税范围均接入；不得需要第五张同牌，公开耗尽不偷看对手暗牌。保留历局账本、下一局及整场名次。
- 接入已有共享 MatchRuntime / DecisionClock：基础时间、小局Bank、独立换牌/定缺时限及不限时；自动和牌优先、不碰杠不屏蔽胡、超时合法补全/弃牌/Pass；准备、碰后和杠中预算不混用，旧决策域命令失效，暂停/退出清理。
- AI 使用可见 observation，四难度三性格实际参与策略，定缺与自由策略区分；可重选自由策略目标，确定性合法回退。
- 独立血战存档/动作回放，保存种子或初始牌墙、完整规则、准备动作、多响、历局账本和剩余时钟预算。恢复重放生产动作，核验摘要/账本及预算边界；拒绝未知版本、规则不一致、非法动作和被篡改时间状态。旧日麻/17步数据版本未修改。
- 同级“测试者模式→血战到底”Tab，20个真实场景（19个有自动部分，1个纯视觉），分组/风险/状态/类型/预设筛选、全部/分组运行、失败重跑、固定场景/自动结果加载、重置/逐步/完全控制、隔离全知、规则/合法动作/日志/账本、报告与复现导出/导入。自动/人工分栏，代码/规则/用例变更后显示需复验。

具体口径与数值范围见 audit.md、src/game/xuezhan/config.ts 和 fields.ts。这些是项目预设，不宣称通用竞赛标准。覆盖是两两组合和重点边界，未声称穷尽配置空间。

## 实际修改文件与兼容边界

新增：

- `src/game/xuezhan/{config,types,scoring,engine,ai,runtime,persistence,fields,scenarios}.ts`、`buildStamp.d.ts`。
- `src/game/xuezhan/{engine,runtime,transactions,boundaries,acceptance,presentation}.test.ts`。
- `src/components/{XuezhanSettings,XuezhanScreen,XuezhanHud,XuezhanTestTab}.tsx`、`xuezhan.css`。
- `src/presentation/table/xuezhanPresentation.ts`、`scripts/xzBuildStamp.ts`、本报告目录。

增补已有文件（保留原有/并行修改，仅下列部分归本任务）：

- `src/App.tsx`、`src/app/navigation.ts`、`src/components/LocalModeMenu.tsx`：原入口路由、血战配置/恢复、血战正式与测试音频消费。
- `src/components/TestModeScreen.tsx`、`src/game/testMode/{catalog,resultsStorage}.ts`：同级Tab、泛型场景类型和隔离结果命名空间。
- `src/presentation3d/Table3DHud.tsx`：共享头像卡可选状态内容；`sceneState/buildTableSceneState.ts`：导出现有座位投影工具；`sceneState/tableSceneTypes.ts`、`hand/Hand3D.tsx`：可选公开手牌语义。默认旧模式行为保留。
- 任务开始已有未跟踪共享时钟文件 `src/game/timeControl/{config,decisionClock}.ts`：血战模式和通用准备时限支持；`src/components/MatchClockHud.tsx`：血战“不碰杠”文案。共享 MatchRuntime 原机制继续作为权威时钟。
- `package.json`：`test:xuezhan`、`check:types`；`vite.config.ts`：测试结果工作区指纹插件。

复用公共3D宿主、相机/四座、牌模型/材质、牌河副露、LocalHandArea、手部动画消费者与 pacing、头像昵称、HUD卡、现有外观/音量和通用BGM/摸打碰杠音效。没有付费生成，没有覆盖旧Voice Pack，没有改冻结相机/坐标。新增内容限血战准备、状态和账本/结果。既有声音索引预检通过（3个有效包）。

启动时12个tracked修改和既有未跟踪工作记录在 start-status.txt / start-diff.patch。过程中同一工作区继续出现 SANMA、17步、HUD 等并行修改；当前全部git diff并不都属于血战。未重置、回退、覆盖这些工作，未提交或发布。尤其 `src/game/shanten.ts`、SANMA 和冻结坐标文件的当前修改不归本任务。

## 自动证据

环境：Windows PowerShell，Node 24.18.0，npm 11.16.0，Vite 6.4.3，Vitest 2.1.9。起点及当前HEAD `5620bbbb4f73fa1001d663f49c98ad88e75b58e8`。

| 命令/批次 | 实际结果 | 日志 |
| --- | --- | --- |
| 启动基线 `npm test`（沙箱外本地重试） | 239文件/1832项通过，1文件/1项失败，1项既有跳过 | baseline-test-unrestricted.log |
| `npm run test:xuezhan` 最终专项 | 6文件、214项通过，0失败/0跳过，122.11秒 | acceptance-final.log |
| 合法字段值两两组合 | 3099对均从生产动作走完一小局；233对不合法依赖被拒绝；650步上限 | acceptance-final.log |
| 1000小局固定种子压力 | 10000—10999，每预设200局+合法随机200局；最大92步，851次胡窗口/929次墙尽；每步牌与账本守恒 | acceptance-final.log |
| 转移/退款来源额外100种子 | 30—129，154笔退款、3笔转移、114笔查叫；金样和来源检查通过 | transactions-first.log、acceptance-final.log |
| 难度/性格区分 | 同一批100个中局观察，难度43处不同、性格33处不同；全部合法且确定 | boundaries-and-hud-final.log |
| 保存时间域注入拒绝 | 引擎+时钟26项通过，含伪造预算/参与者/决策拒绝 | restore-validation.log |
| 浏览器场景最终批次 | 19自动通过，1视觉未自动运行；没有人工通过记录 | browser-evidence.md |
| 全项目中间回归 `npm test` | 249文件/2131项通过，1项既有失败、1项既有跳过 | project-rerun.log |
| 最后全项目回归 `npm test` | 249文件/2168项通过，1项既有失败、1项既有跳过；159.94秒 | project-final-unrestricted.log |
| 最后 `npm run build`（包含tsc、素材索引及Vite） | 通过，exit 0；Vite打包13.91秒；仍有既有大块体积警告 | production-build-completion.log |
| 最后样式修复后 `npm run build` | 通过，exit 0；Vite打包9.73秒；只移除遮暗积分的血战渐变、提高测试场景名对比度 | production-build-visual-final.log |
| `git diff --check` | 通过，exit 0；仅Windows换行提示，无空白错误 | diff-check.log |

每次失败保留日志；修复后才重跑。初期沙箱 `spawnSync node EPERM` 单独记录，获准后原命令在本地运行，没有把环境错误记为测试通过。不存在新加 skip、删断言或放宽期望。配置组合的期望来自固定金样、独立数字和守恒/合法性约束，不从被测评分函数反推 expected。

## 浏览器与人工边界

全部自动浏览器访问带 `mute=1`。使用内置浏览器的稳定本地预览5186，避免并行改动触发HMR导致场景重置。浏览器详情、视口与资源证据见 browser-evidence.md。诊断预览用 `VITE_ENABLE_TEST_MODE=true npx vite build --outDir artifacts/xz-v1/browser-dist` 生成，此单独Vite打包**不能替代** `npm run build` 的 TypeScript gate。预览仅本机，未部署。

真实人工入口：[固定验收预览](http://127.0.0.1:5186/?mute=1&testMode=1) → 血战到底；日常开发入口：[本地开发](http://127.0.0.1:5173/?mute=1) → 测试模式（开发者）→ 血战到底。场景、固定点击步骤和期望见 manual-review.md。预览进程须保持运行。

尚未进行的是真人对界面、听感、动画细节、降动效/素材缺失、配置操作习惯和完整普通对局的复核。浏览器自动观察不能代替真人。只有全项目自动阻断清除后，状态才可更新为“自动复核通过，待人工复核”；当前不得这样标记。

## 阻断与最终记录

1. 启动前已有 `src/presentation3d/table/centralConsoleLayout.test.ts:26` 失败：期望 `[-0.1,0.698,2.3]`，当前冻结调参返回 `[-0.1,0.698,1.9]`。基线与中间全量日志一致。按AGENTS不回退用户调参、不放宽测试。
2. 先前生产构建在并行 `src/presentation3d/participants/SanmaMotion3D.tsx:21,25` 类型错误处失败（PresentationTile无instanceId、number可能undefined），见 production-build-final.log。并行工作后该阻断已消除，最后生产构建通过；没有由本任务修改SANMA来掩盖失败。
3. 人工验收仍待真人执行。本任务没有代填任何人工通过。
4. 导出按钮已连接，但内置浏览器未返回download事件，下载文件落盘尚未确认。720高度三响公开手牌与冻结HUD/结果面板有局部遮挡，需人工复核；截图与具体范围见 browser-evidence.md。未将这两项写成UI通过。

最后全量结果2168通过/1失败/1既有跳过，所有血战214项通过。全项目唯一测试失败仍为上述基线坐标断言，因此总体FAIL仍有效。没有血战功能占位被列作未来开发；未完成的是既有回归阻断的归属处理和真人验收。已依据AGENTS停止越界修改冻结坐标及其他任务工作。

全量测试后仅补正血战显示顺位文案与两条局部样式，未更改规则/计时/保存/AI。已重跑生产构建及浏览器场景自动部分，未为颜色/文案改动重复1000种子压力。最终固定预览的代码指纹为 `fe16e82684bf8a2e`（完整指纹由页面导出报告记录）。
