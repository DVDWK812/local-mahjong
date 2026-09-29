# XZ-6R 配置与独立期望映射

判定层级：配置接受/持久化、生产状态转换、独立金额/动作金样分开记录。acceptance.test.ts 的 3,099 个两两合法组合只证明配置可创建且生产局面可推进，不能替代下列行为金样。

| 配置/交互 | 权威路径 | 独立证据 |
|---|---|---|
| 自摸活跃付款、胡后退出 | engine settleWins/continueAfter | boundaries：三、二、一家付款，最终 [106,116,91,87] |
| 点杠花包赔 | engine settleWins | boundaries：普通 [93,117,95,95]，包赔 [83,117,100,100] |
| 多响/呼叫转移/余数/退税 | engine resolveResponse/settleWins/settleWall | boundaries：3分转移最近赢家或2+1；新增保存恢复后推进墙尽，不重复退税 |
| 花猪/查叫/叠加/固定罚额 | engine settleWall | boundaries：8组合固定3分花猪与1/4分查叫独立账目 |
| 结构听牌/公开耗尽 | engine readyScores | boundaries：等待[12,15]与[12]；暗杠不泄漏、不能听第五张 |
| 过手胡 | engine winScore | boundaries：基值4放弃后8分，off/higher/until-draw分别处理 |
| 破产、庄家、局数 | engine applyXz next | boundaries：仅完整结算后破产结束；三响首胡庄家为放炮者 |
| 定缺持缺碰杠 | engine legalActions | boundaries：非缺门杠依unclearedCalls开关，缺门永远拒绝 |
| 天胡/地胡/仅自摸 | scoring + engine winScore | boundaries：真实首轮上下文；仅自摸无接炮 |
| 番型、封顶、自摸附加顺序 | scoring | engine.test：固定牌型与4/8分等金样；不是日麻番符 |
| 三种杠、抢补杠、源账本 | engine | transactions：生产杠支付与抢杠无虚假杠收入；closeout：三响部分响应恢复，恰好三笔1分 |
| 准备独立时限、Bank、自动开关 | runtime + MatchRuntime | runtime：30秒换牌/10秒定缺/5秒基础+20秒Bank；暂停恢复17秒Bank；自动胡优先 |
| 碰后超时无drawn | runtime defaultAction | 新增runtime夹具：真实碰后25秒恰好弃二万，无重复碰；旧测试名称已去掉未执行的碰后描述 |
| AI难度/个性 | observeXz/chooseXzAction | boundaries相同局面43/33处分歧只证明分支差异，不证明强度排序；AI合法性/不泄露与完整局另测 |
| 保存/回放/报告隔离 | persistence/report | replay拒绝损坏摘要、预算；新增报告格式独立校验，不写人工记录；实际下载另见报告 |

保留限制：没有穷举所有高阶组合。已胡玩家参与花猪收款与退税的每种交叉、抢补杠部分响应剩余预算的独立组合金样仍不是本轮新增项；已有分项测试和压力不能等同该组合的金额金样。人工听感、可读性评价仍NOT_RUN。
