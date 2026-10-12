# 国标 V1 人工反馈修订验收（2026-10-04）

最终自动门禁：**PASS WITH RISKS**。实现、自动测试、资产审计与下面列出的浏览器路径完成；等待用户阅读和人耳试听，不宣称全部语音已通过。没有提交、推送、tag、release或部署。

## 分项状态

| 项目 | 状态 | 证据/待办 |
|---|---|---|
| 规则UI与设置清理 | 实现完成，自动验证完成，待人工签收 | 两入口共用GuobiaoRulesGuide；9个主题＋81番定义/条件/完整牌形/不计＋5固定算例；GUOBIAO_RULES_GUIDE.md |
| 既有语音接入 | 完成；yaya点和安全跳过 | 三包34常规报牌；适用吃碰杠/点和/自摸/流局；未改原通道与播放策略 |
| 逐包缺口审计 | 完成 | 3包各145；435MP3全帧可解码；GUOBIAO_VOICE_AUDIT.md含435逐项行，JSON含完整TTS文本/文件/映射/fallback/证据 |
| 新音频待办 | 未生成 | 必需yaya国标点和1条；补花/花名/国标番种和结算为可选；真实TTS调用0 |
| 用户人工阅读/人耳试听 | NOT_RUN | 当前自动证据不能代替签收；原静音和报牌设置已恢复 |

## 自动证据

| 检查 | 实际结果 | 文件 |
|---|---|---|
| 定向规则页/语音/计时 | 6文件96测试通过 | artifacts/gb-feedback/targeted-final.log |
| 全量npm test | 268文件、2438测试通过；原有1文件/1测试跳过 | full-tests-final.log；未新增skip或弱化断言 |
| npm run check:types | exit0 | types-final.log |
| 正常npm run build | exit0，普通生产产物 | build-final.log；原有大chunk提醒 |
| git diff --check | exit0 | diff-check.log |
| 音频实际解码 | 435成功，缺失/损坏0 | voice-audit.json；PyAV完整解码frame.samples |
| 资产和既有工作 | 471保护文件SHA256原样，新增音频/花牌文件0 | baseline-final.json；涵盖MP3/manifest/catalogue/生成记录/cache/迁移花牌PNG |

固定expect均为独立手工值：7番点和＋1花不能补门槛、同手自摸8＋1、无番和8/改自摸1、十三幺92＋2、一色双龙会64＋全求人6。81项逐一物理合法与成立目标番测试；目标番值沿用冻结目录。教程不调用scorer生成显示期望，不改规则、AI或保存版本。

权威阅读保护测试：计时已用2200ms，阅读120000ms后同decision ID/基础时间/Bank；准备AI选择不在暂停期提交，关闭后仅记2200ms、Bank0。重复释放、其他暂停、多原因、未就绪和只读回放覆盖。全项目原有58条timeControl测试通过。

## 内置浏览器证据

所有常规UI路径带mute=1；非静音语音路径是用户本轮明确要求的例外。未使用Chrome扩展、未注入/改写隐藏应用状态、未绕过播放许可。

| 条件 | 结果 | 直接证据 |
|---|---|---|
| 两入口同正文/版本 | PASS | 赛前“比赛规则”；局内“规则说明”；同目录/检索/版本；settings-clean.png及production-cold-rules.png |
| 草稿保留 | PASS | 单盘＋基础9秒，打开来源页显示同配置，返回仍为9；未调用开始覆盖原存档 |
| 局内原Canvas保持、背景隔离 | PASS | 打开前后Canvas=1，data-table-renderer=3d、ready=true；主main inert；Escape返回焦点；没有新增Canvas或卸载Match |
| 阅读暂停/恢复与暂停所有权 | PASS | 打牌→规则已暂停→返回打牌；先手动暂停→规则→返回仍暂停；真实AI启用后阅读约33秒期间sequence=2、剩余86张不变 |
| 1280×720目标布局 | PASS（浏览器缩放取整风险） | 实测CSS1281×720，无横溢出；目录、搜索、正文与牌例可读；rules-1280.png |
| 1920×1080目标布局 | PASS（浏览器缩放取整风险） | 实测CSS1920×1081，无横溢出；完整固定算例可读；rules-1920.png |
| 同包预览→日麻→国标 | PASS（播放链路，非人耳） | 校长管理预览tile_m1 HTTP200；正式日麻tile_s1 HTTP200；国标tile_m1实际play-resolved |
| 本人/真实AI/all/self | PASS | actor0、actor1实际play-resolved；self对手actor3只有received，无resolved/play；browser-voice.json |
| 自动摸切/超时/自摸 | PASS | 自动本人tile.s4；5次时钟＋5秒后电脑一tile.p3；最终action.tsumo实际play-resolved |
| 规则开关/保存/回放/退出恢复 | PASS | Home/End跳转、退出、恢复无新增旧语音事件；同态恢复不提交；退出/回放停止既有语音 |
| 日麻规则页与报牌 | PASS | 正式四人局原规则容器与原番役目录可打开/返回；同包报牌HTTP200；riichi-rules.png/riichi-network.json |
| 缺文件/播放拒绝/重复/优先级/静音 | 自动PASS；实际浏览器拒绝未人为制造 | 原Director18测试与国标5测试；拒绝继续沿既有清理；全局/语音/角色关闭沿原设置；缺文件安全跳过 |
| 换圈角色身份 | 代码与自动映射检查通过；完整16盘逐包浏览器试听NOT VERIFIED | 国标上下文固定playerIds0～3，公开事件actor来自稳定参与者，观察席/风位不参与分包；沿用原voicePreferences解析 |
| Legacy独立smoke | PASS | table3d=0&mute=1；Canvas=0、3D layer=0，权威弃牌sequence=1；legacy-smoke.json |
| 正常生产冷启动 | PASS | 普通build后4174/?mute=1主菜单无开发测试按钮；赛前规则检索正常；production-network.json；不启动覆盖该来源既有用户对局 |
| Console/Network | PASS（无相关错误） | GB/正式日麻/冷启动无应用error或必需资源失败；保留既有THREE.Clock弃用及TableRenderer初始化诊断；浏览器初次服务未就绪的失败标签已弃用 |

浏览器设备缩放为0.96，整数设备尺寸换算造成1px取整偏差，明确记录实际CSS尺寸，不伪称精确像素。人工请仍在原定1280×720和1920×1080复查。逐包每key实际浏览器播放与人耳内容正确性未全部执行；未把435次离线解码当435次试听。

## 最终修改范围与复核

修改已有10个文件：App.tsx、GuobiaoScreen.tsx、GuobiaoSettings.tsx、GuobiaoTestTab.tsx、TestModeScreen.tsx、VoiceDirector.ts、voiceEvents.ts、matchRuntime.ts、PresentationEventBus.ts、guobiaoPresentation.ts。GUOBIAO_V1.md仅追加本轮说明。

新增：GuobiaoRulesGuide.tsx/css/test，guideContent.ts，readingPause.ts/test，guobiaoVoice.test.ts，规则页说明、语音审计和本验收报告；证据/脚本位于artifacts/gb-feedback。完整实际列表与相对基线SHA256见baseline-final.json；不是把整个未提交GB-0～7/手部/Sanma diff算作本轮修改。

最终缺陷优先复核覆盖事件生命周期/角色上下文/去重、台词适用性、暂停决策/审计额度/所有权、版本/固定案例、模态焦点/inert、跨模式接口兼容与资产保护。发现并修复：读取暂停原恢复重建decision ID、AI收到时间跨暂停审计偏移、教程普通五牌误红、共享规则页背景/文字对比度、正文键盘焦点环绕、赛前返回回调随父页刷新导致焦点重置。没有遗留已知阻断性实现缺陷；上述人耳、逐包逐key及完整16盘浏览器换位是明确未执行项。

## 人工入口

规则页：正常生产 http://127.0.0.1:4174/ → 本地模式 → 国标麻将 → 比赛规则。局内右上角同页；原音量/静音/角色和报牌开关保持原值。

未静音隔离试听：http://127.0.0.1:5174/?testMode=1 → 国标 → 固定种子单盘 → 音乐设置。请按意愿启用报牌、选择角色与all/self，再手动弃牌、自动摸切、关闭完全控制运行AI、时钟＋5秒。yaya点和缺录音；其他报牌可试听。不要点生成，补录不在本轮。

自动复核后停止，等待用户阅读与实际试听；不自动commit/push/release。
