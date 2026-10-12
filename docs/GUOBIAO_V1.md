# 国标麻将 V1 执行记录

状态：十项工程均已实现并取得自动验证证据，READY_FOR_MANUAL_REVIEW。人工验收 NOT_RUN。最终门禁 PASS WITH RISKS，结论与非阻断项见末尾；不以阶段自测替代交付门禁。

## 事实基线（2026-10-03）

- 仓库：`C:/Users/Wenkai/Desktop/UNSW/local-mahjong-voice-phase1`。
- 分支 `feature/voice-pack-repository`，HEAD `12e4fc5ecfa31629496d02475e652c5010272ff2`。
- 既有 dirty/untracked 清单与补丁：`artifacts/gb-v1/start-status.txt`、`start-diff.patch`；保留三麻、布局、手部素材成果。
- 真实入口：`App.tsx` 的 `local-mode-menu` → `LocalModeMenu.tsx` → `onComingSoon('国标麻将')`。尚无国标 mode ID、比赛创建或规则实现；新增正式 ID `guobiao` 并接通该按钮，不能声称发现已有比赛链路。
- 共用边界：`game/timeControl/MatchRuntime`、`presentation/table/TablePresentationContract`、`presentation3d/Table3DScene`、`game/replay`、`game/persistence`。国标规则独立，普通牌编码 0–33 不变。
- 首次沙箱 `npm test`/`npm run build` 因 EPERM 失败；正常权限重跑均 exit 0。259 文件/2272 测试通过，原有 1 条跳过；未新增 skip。日志 `baseline-*-approved.log`。无 lint 脚本，build 包含 tsc。
- Notion 最新第 13 节和验收矩阵已读取；本地记录持续更新，同步状态须单独核实。

## 规则冻结

采用 WMO 官网提供的中文《麻将竞赛规则》PDF：`http://www.mindmahjong.com/adobe/z20140402.pdf`。封面记载中文首印 2009-01，正文后记 2013，官网文件发布路径 20140402。准确称为“WMO 官网 2014 发布中文文本”，不宣称最新。不混入 IML 2023 的 6 番双暗杠/5 番明暗杠政策。

原文证据在 `artifacts/gb-v1/wmo-chinese-2014.pdf` 与提取文本。历史英文 2006 仅交叉参考。正式版本 `wmo-cn-2014-publication-v1`，番表 `wmo-cn-2014-81-v1`，数字政策 `gb-local-digital-v1`。

- 四人 144 张，完整 81 番种；非花至少 8 番，花不补门槛；双暗杠为 8 番。
- 自动公开并补花，省略线下报牌、理牌及保留花牌操作；花牌不允许弃入牌河。开局按庄、南、西、北补花，每家连续补完；正常摸牌墙头，花/杠补牌墙尾，无王牌或固定补牌上限。
- 来源分别记录 initial/live/flower/kong；杠补牌遇花后的实际成和来源为 flower，不将普通补花冒充杠上开花。条件番依据真实事件，详见后续用例与差异记录。
- 吃仅上家；和优先碰杠，碰杠优先吃；相同优先级按弃牌者下家起顺序裁定，等待全部必要响应，点击快慢不决定胜者。
- 吃碰后必须弃牌，下一次摸牌前不可自开杠；允许跟张打牌，无日麻食替/振听/立直/宝牌。
- 加杠采用待裁定事务；暗杠不能抢。流局零支付，每盘轮庄不连庄。
- 四圈十六盘与明确单盘练习；初始 0 分、允许负分。附件四换位矩阵按参与者身份保存；同分按初始参与者顺序。
- 点和 F=10：+34/-18/-8/-8；自摸：+54/-18/-18/-18。比赛净积分与赛事标准分分开。
- 时间采用现有 MatchRuntime Bank；测试隔离存储，未知版本拒绝，不重算旧牌谱。

## 阶段清单

|阶段|状态|证据/下一步|
|---|---|---|
|GB-0|IMPLEMENTED / 自动证据已取得|入口、基线、WMO原文、候选库许可、花牌审计|
|GB-1|IMPLEMENTED / 自动测试通过|144唯一实例、正常/杠/花来源、原子补花链、墙尽|
|GB-2|IMPLEMENTED / 自动测试通过|完整算番权威资格、快照响应、座次仲裁、抢加杠事务|
|GB-3A|IMPLEMENTED / 自动测试通过|普通多拆解、七对、十三幺、组合龙、全不靠、七星不靠|
|GB-3B|IMPLEMENTED / 自动测试通过|81固定正例及有效负例、反序不变性、15排除组合与独立总番/边界|
|GB-4|IMPLEMENTED / 自动测试通过|逐人支付账本、F=10金样、16盘、圈间换位、同分排序|
|GB-5|IMPLEMENTED / 浏览器已执行|共享场景/动作、专用花牌、既有测试模式第四Tab、结算与提示|
|GB-6A|IMPLEMENTED / 自动测试通过|有限合法观察、四难度三风格、可和牌/8番路线、MatchRuntime与和鸣切|
|GB-6B|IMPLEMENTED / 自动测试通过|版本隔离、初始态+命令重建、任意跳转、响应/补花/结算恢复、小数计时余额|
|GB-7|AUTOMATED_VERIFIED / READY_FOR_MANUAL_REVIEW|清理后最终全量、类型、构建、浏览器、独立复核及Notion同步；用户签收NOT_RUN|

## 素材审计/清理

8 张真实 PNG，均 1024×1536 RGBA；视觉顺序春、夏、秋、菊、冬、梅、兰、竹。单张非拼图，字名和图案一致。完整原样复制到 `src/assets/tiles/flowers/`，保留可编辑母图，文件哈希和字节清单 `artifacts/gb-v1/asset-migration.json`。来源：用户提供 ChatGPT 生成图；未提供额外许可文本，不擅自推定第三方授权。

旧 `src/国标` 已完成精确删除。删除前再次校验八项清单、全部哈希/字节、规范化路径和 reparse point；未使用递归删除或通配符。脚本 `artifacts/gb-v1/cleanup-migrated-flowers.ps1`，dry-run和实际结果分别为 `asset-delete-dry-run.json`、`asset-deletion-result.json`。目录存在性 false。正式目录保留原始完整母图；alpha范围0–254和透明边缘详见 `asset-alpha-audit.json`，未改变颜色/裁切图案。删除后生产构建及禁缓存加载八种贴图均200、fromDiskCache/fromServiceWorker均false；证据 `network-after-delete.json`。BGM 206，切换播放产生一次预期取消后重新206，无必需资源404。

## 独立复核

独立只读审计确认：候选 jan-js-lib 2.0.0（Apache-2.0）不能直接作为权威答案；候选 miaoda analysis 0.3.1 为 subset，已拒用。只复用 jan 的牌形检测原语，完整授权文本 `vendor/LICENSE.txt`，来源/改编记录 `vendor/NOTICE.md`。国标自己的枚举、组合复用、排除后择优、花牌/条件/账本/事务为权威。

独立复核覆盖 scoring/shapes/engine/runtime/persistence/AI，发现并复验修复：输入排序影响九莲/连七对、幺九刻参与组与部分排除次数、末张禁鸣、抢杠失方drawn清理、小数毫秒Bank恢复、重复响应决策遗漏玩家、伪造暗吃暗碰、回放/未就绪保存覆写。另以seed101/313执行214条合法命令及10次内存保存重建，144实例与积分守恒。当前已审查范围没有未修复的具体缺陷；未宣称穷尽所有组合或官方图形牌例。

## 架构与接入

新增 `src/game/guobiao/` 为独立规则 authority，普通 TileId 0–33不改，花牌不伪造常规牌编码。`App/navigation/LocalModeMenu/GuobiaoSettings` 接通正式比赛；`timeControl/config` 只新增模式并复用既有 MatchRuntime。`guobiaoPresentation.ts` 输出 Shared TablePresentationState/LocalHandPresentation/SharedActions，Three只接收公开语义。对手暗手/暗杠不输出隐藏脸面，墙牌不进入AI；允许提示使用本人及公开可见牌，不影响和牌资格。既有中心台、相机、河/副露/HUD/手牌坐标不修改；新花牌沿独立公共lane，按四席朝向。

保存为独立版本1国标键，既有Replay/SavedMatch格式不修改。正式初始态以seed重建，所有command含sequence/id并逐项重放，末态fingerprint检查；拒绝未知规则版本和异常预算。补花链是同步原子规则事务，动画期间保存记录已完成链和事件；恢复不重复花事件/移动牌墙。无需把规则挂起等待补花动画。历史回放只读，禁止覆写继续局存档。

音频沿共享Presentation consumer播放通用SFX/BGM，国标不触发日麻专属角色喊话；无需生成付费音频。自动AI沿 PresentationPacing 推进，不以固定规则setTimeout代替；回放播放间隔只负责可视展示。

## 自动证据

- `npm test`：最终 `full-test-final-06.log` 265文件、2421测试通过、原有1条skip，exit0。基线2272，新增国标149条（18算番、97逐项番/排除、13集成、10引擎、7AI、4牌尾补花边界）。未删除/弱化原有断言。final-04/05为较早检查，最终以final-06为准。
- 真实AI单盘/16盘各seed3/42/2026，共6次E2E，逐步验证动作属于合法集合、144实例守恒、积分守恒、正常结束、防死循环。默认动作另以seed1/7/42完成单盘/16盘；开局seed1–29补花审计。
- 定向规则证据：非花7+花1不可和、自摸8可和；十三幺88/92；三杠37/53；四杠98/154；组合龙15；双龙22/70；点和/自摸F=10账本；三家同和座次仲裁；抢杠提交/取消；吃碰后的预算；超时/自动和优先；隐藏信息置换；每命令回放与恢复。
- `npm run check:types` exit0，最终 `types-final-03.log`；无lint脚本。正常 `npm run build` exit0（`build-final-normal.log`）；临时开启既有测试入口的最终生产预览构建见 `build-final-preview-02.log`，已有大chunk警告。最终命令日志以末尾为准。
- 第一次全量集成发生新vendor/LICENSE无扩展名与现有三麻扫描冲突，已重命名LICENSE.txt并保留全文，原有扫描20测试与后续全量均通过；保留失败日志供审计。
- 81行矩阵 `GUOBIAO_FAN_MATRIX.md`：实现ID—正例—有效反例/物理/反序边界—排除—附件来源。高风险总分由手工固定断言给出，测试未用scorer生成期望答案。通用反例不是每项近邻牌形穷尽证明。

## 人工交接（NOT_RUN）

开发 `npm run dev -- --host 127.0.0.1 --port 5174`，当前实际地址 `http://127.0.0.1:5174/?mute=1`。正式入口：本地模式→国标麻将→单盘练习/四圈十六盘→开始游戏。测试入口：`http://127.0.0.1:5174/?testMode=1&mute=1`，既有测试模式→国标麻将；全控制默认开启并使用测试时钟，保存只写测试键。生产预览当前 `http://127.0.0.1:4174/?testMode=1&mute=1`；测试构建用PowerShell临时 `$env:VITE_ENABLE_TEST_MODE='true'; npm run build`，完成后移除环境变量。不要借截图填写人工“通过”。

|场景|操作与预期|
|---|---|
|八种花牌四方向归属|四家各2花，操作席依次0/1/2/3；检查全部8身份/朝向/归属；1280×720及1920×1080均无手牌/头像遮挡|
|八种花牌／四组副露|本人8花，对家4副露；检查完整lane、字名、牌面、归属与最大布局；结果明细可滚动|
|正常摸牌连续补花|弃本家最后四万；其他响应点过或测试时钟+5秒五次；电脑一补春/夏，余墙减3。展示时保存→返回→恢复上次国标测试：花2、不重复补牌|
|七番加花点和门槛|操作席1弃2万→席0：提示点和7不足、自摸8可和，本次没有和按钮；花1不补门槛|
|非花七番加一花|当前实际自摸8，点击和可结算；总番9。提示开关不是规则开关|
|无番和点和边界|席1弃4条→席0可和8；自摸产生1番时不能重新补作无番和|
|十三幺自摸与支付|和：非花92＋花2＝94；各付102、赢家306，净变化和为0。展开支付/拆解/排除；回放Home/End切0/1步，积分重建不再次支付|
|同牌三家和响应|本人弃1万，切席3和、2和、1和（可换顺序）；收齐前不结算，最后最近下家电脑一胜。响应中保存恢复，已提交者不重复询问|
|加杠可中断事务|加1万杠→响应中保存；墙和原碰保持。席1和，其他响应过，抢杠96番，失方-104/赢家120/另两家-8；原碰不升级、不补牌。另次全部过只提交一杠一补牌|
|固定种子单盘|完全控制关掉跑AI；或开启逐步+切席，调整和/鸣/切并组合，测试时钟验证超时摸切/响应过/吃碰无drawn确定性弃牌；暂停后推进时钟不扣时|
|固定种子十六盘|每盘结果点下一盘，完成16盘；东南西北各4盘，圈间按附件换位，人名积分绑定身份，净积分和0，同分按原始身份排序|

本次人工用户签收、真实未静音人耳试听均 NOT_RUN。浏览器自动交互和截图不等于签收。

## 最终自动门禁（2026-10-04）

**PASS WITH RISKS。READY_FOR_MANUAL_REVIEW。MANUAL_REVIEW: NOT_RUN。**

十个任务GB-0/1/2/3A/3B/4/5/6A/6B/7均IMPLEMENTED及AUTOMATED_VERIFIED，等待用户复核，不写工程COMPLETE/FROZEN。

|检查|实际结论|最终证据|
|---|---|---|
|npm test|exit0；265文件/2421测试通过，原有1条skip；新增国标149|full-test-final-06.log|
|npm run check:types|exit0|types-final-03.log|
|npm run build正常|exit0；生产逻辑最终版本，未启用测试入口|build-final-normal.log|
|npm run build测试预览|exit0；仅临时VITE_ENABLE_TEST_MODE=true，随后移除环境变量；包含最终新增测试的tsc|build-final-preview-02.log|
|git diff --check|exit0；新增国标源文件另查无行尾空白|diff-check-final.log|
|资产迁移/清理|8项完整母图哈希/字节一致，旧目录不存在；生产禁缓存8图200|asset-migration.json、asset-deletion-result.json、network-final-package.json|
|真实AI E2E|单盘/16盘各seed3、42、2026；合法、守恒、正常结束|full-test-final-06.log中的ai.test.ts；其他默认流程seed1/7/42|
|独立复核|定向缺陷均已修复；214命令/10重建及4尾墙边界另行执行；精确9+1番断言已加强|independent-review.md|
|浏览器|两档CSS尺寸、四模式定向回归、正常/减弱动态/Cancel、保存回放、网络与Console；Legacy基本运行|browser-acceptance.md及jpg/json证据|
|既有工作保护|20个无关dirty文件补丁原样；共用3D两文件仅本次花牌语义接入，既有布局保留|protected-baseline-final.json、start-diff.patch、final-diff.patch|
|Notion|主规划最新第14节与十任务执行记录/日期/待验证已更新并回读；原工作项/验收结构保留|notion-sync-verification.json|

上表证据文件均在 `artifacts/gb-v1/`。原失败日志保留：首次vendor/LICENSE路径冲突已修为LICENSE.txt；首次新尾墙fixture默认对手占完2筒，仅修改对手为明确合法13张以保留真实补牌，未放宽断言。最终全量无失败。

末墙新增4条明确覆盖1花/2花无补牌、暗杠尾牌仅花、暗杠补花再普通牌。最后一个固定算例非花9=不求人4+暗杠2+幺九刻1+无字1+单吊1，花1，总10，实际来源flower，不计杠上开花。此强化来自WMO及独立复核，不从被测器生成期望。

非阻断项：已有Vite大chunk及THREE.Clock弃用提示；测试非全部牌组合穷尽证明，未逐一转录官方所有图形牌例；用户未静音人耳试听和实际人工签收NOT_RUN。没有未解决的已知交付阻断。无单独动画倍速/Skip按钮，不声称执行不存在的控件；实际支持的减弱动态snap与共享Skip/Cancel测试已验证。

人工按上方11场景逐项操作，特别核对两档花牌归属/遮挡、7/8番、支付、抢杠/多人响应、和鸣切与超时、恢复/跳转、完整16盘。测试入口保存隔离，截图不能替用户勾选人工通过。

已停止新增功能；未commit、push、tag、release、部署或付费生成音频。等待用户实际复核。

## 2026-10-04 人工反馈修订

本轮在上述GB-0～7基线上实际实现统一国标规则说明页、赛前两处冗余正文清理、权威阅读暂停、逐包语音审计与既有语音接入修复。没有重做规则/算番/AI，没有调整桌面、相机、中央积分板、手牌、手部或花牌区，没有重新处理迁移花牌素材。

赛前“比赛规则”与局内“规则说明”共用一份新手正文，包含9个基础主题、完整81番定义/条件/牌形/不计与5个独立固定期望案例；局内读取当前Match快照。规则页暂停真正的Match计时及AI，保持decision ID和剩余Bank；不解除原暂停，不卸载桌面或Director。

当前三个包各145条，435 MP3全帧可解码。根因为旧mute=1地址、报牌开关关闭、国标语音入口及角色上下文缺失。已接通34常规报牌及适用通用动作/最终结算；yaya“荣和”台词在国标安全跳过，必须新增国标点和1条。补花、花名、国标番种与结算播报为可选新音频；本轮未生成、未覆盖资产，TTS调用0。原音频设置已恢复。

最终自动门禁PASS WITH RISKS；全量268文件/2438测试通过，原有1条skip保持；类型、普通生产build与diff check通过。471受保护语音/生成记录/cache/花牌文件SHA256原样。内置浏览器取得本人、真实AI、自动/超时弃牌及自摸play-resolved，self对手阻断；规则开关/回放/退出恢复无旧语音重播。生产冷启动规则检索正常；精确像素取整差异、逐包逐key/完整16盘换位浏览器试听及用户人耳签收保留为明确待确认，不宣称全部语音通过。

完整交付：[规则页说明](GUOBIAO_RULES_GUIDE.md)、[语音原因及435逐项审计](GUOBIAO_VOICE_AUDIT.md)、[最终验收与实际修改范围](GUOBIAO_FEEDBACK_ACCEPTANCE.md)。本轮实际证据在`artifacts/gb-feedback/`，不覆盖旧`artifacts/gb-v1/`。Notion主规划第15节已更新并回读。

人工规则入口：http://127.0.0.1:4174/ → 本地模式 → 国标 → 比赛规则；未静音隔离试听：http://127.0.0.1:5174/?testMode=1 → 国标 → 固定种子单盘 → 音乐设置，按用户意愿开启报牌与角色。自动复核后停止，等待用户阅读和试听；未commit/push/tag/release。
