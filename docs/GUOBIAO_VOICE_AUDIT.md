# 国标 V1 语音原因与逐包审计（2026-10-04）

本轮沿用既有 VoiceDirector、VoicePackRepository、AudioManager 语音通道。没有TTS调用，没有改写/删除/重命名MP3，没有批量改变CSV/cache。缺口审计完成不等于新音频补齐；PyAV全帧解码、HTTP响应、play()成功不等于人耳听过。

## 根因与修复

1. 上一轮地址带 `mute=1`，只静音输出，不能凭截图判定无语音。
2. 实测总音量、语音均开启，音量80%；四席均为校长；出牌报牌关闭（默认亦为false）。本轮临时开启验证，之后全部恢复原设置。管理页所选包与实际四席配置是不同字段。
3. 应用实时语音入口未包含国标；角色上下文缺少国标四位稳定参与者。现已修复正式国标及隔离国标测试入口，actor 0～3跟随参与者，不用门风/观察席。
4. 国标最终结算需要自己的公开语义：不调用日麻役种/点数串行播报。现已接入 `guobiao_settled` → action.ron/action.tsumo/game.draw；公开discard/meld复用已有key和优先级。
5. yaya 的 action.ron 实际文本“荣和”，不能机械挪用。国标安全跳过并给出缺失诊断；日麻保留原录音。缺可选音频不阻断行牌。

已提交公开事件 → 国标语义adapter → 全应用同一Director → actor稳定身份与voicePackBySeat → Repository实际key/manifest/URL → 既有通道play。未公开摸牌/隐藏手牌/暗杠牌面不进语音payload。事件ID由本次Match session＋权威提交ID组成；恢复建立当前状态基线，回放不提交语音。

开发环境可加 `voiceDebug=1` 查看只含公开eventId/key/actor/pack/URL与play-resolved/play-rejected原因的控制台诊断；该开关不改变权限、静音、设置、规则或播放策略，生产不记录。

## 当前真实盘点

| 包 | 台词/manifest/MP3 | 全帧解码 | 原有可接入项 | 必须补齐 | 新语义待办 |
|---|---|---|---|---|---|
| 曼波 voice-20260821-001 | 145 / 145 / 145 | 145成功 | 34报牌＋8通用＝42 | 0 | 补花1＋花名8＋番种族1＋结算族1 |
| 校长 xiaozhang | 145 / 145 / 145 | 145成功 | 34报牌＋8通用＝42 | 0 | 同上 |
| yaya yaya-001 | 145 / 145 / 145 | 145成功 | 34报牌＋7通用＝41 | 点和台词1 | 同上 |

总计435 MP3，损坏/缺失0；历史148条不能当作当前完成率。可选每包11个key/语义族（3包共33）；番种族将来若展开81具体key，则每包为91条新录音，三包273条；本轮既未生成也未宣称已补齐81番种。下列逐行状态“可复用”表示实际文件、台词与对应通道可复用，所有key均已接入同一语义路径；浏览器直接播放只覆盖校长部分key，其他项的人耳试听和逐key实际浏览器播放仍未验证。

状态含义：可复用、存在但未接入、静音/设置/权限阻断、音频缺失或损坏、新语义、台词不匹配、国标不适用、未验证分别记录，不能相互等同。“国标不适用”在此表示本轮不自动触发（包括日麻专属和闲聊），不删除也不修改原资产。

## 必须补齐

| 包 | 稳定key | 建议台词 | 时机 | 当前状态/数量 |
|---|---|---|---|---|
| yaya-001 | guobiao.action.ron（新增国标专用key，原action.ron保留日麻） | 和！ | 权威最终点和结算 | 原action.ron台词不匹配；1 |

“补花”为新增候选，普通报牌恢复不以补花/81番种录齐为前提。其他包必须补齐数0。

## 可选扩展（各包扫描均未有相应key）

| key | 建议台词 | 权威触发时机 |
|---|---|---|
| action.flower | 补花 | 仅已提交公开flower事件；连续补花逐事件处理 |
| flower.spring/summer/autumn/winter | 春/夏/秋/冬 | 公开对应花牌；不得读尚未公开的墙/手牌 |
| flower.plum/orchid/bamboo/chrysanthemum | 梅/兰/竹/菊 | 同上 |
| guobiao.fan.<fanId> | 各冻结番种名称 | 最终result合法fanItems；不可机械替换日麻近义役名 |
| guobiao.result | 非花×番，花×分，合计×番（按片段设计） | 最终权威result/payment；不是React渲染或回放跳转 |

上述尚未录音/接入，当前安全跳过。以后须另行授权生成并保持日麻资产与数据兼容。

## 已有但此前未接入

曼波与校长各42项、yaya41项；详细key清单为 `artifacts/gb-feedback/voice-missing-plan.json` 的 existingButPreviouslyUnconnected。本轮34普通报牌与吃/碰/明杠/暗杠/加杠/点和/自摸/流局接入已完成，yaya点和例外。无牌局角色、开关关闭、scope=self对手或用户静音时仍按原设置阻断。

## 播放证据与限制

校长管理页预览请求 tile_m1.mp3 HTTP200；正式日麻实际弃牌请求 tile_s1.mp3 HTTP200（独立localhost来源，避免覆盖127.0.0.1的存档）；国标本人/真实AI、自动摸切、时钟超时弃牌和最终自摸均记录play-resolved。self对手事件只有received，不解析URL/播放。规则开关、回放Home/End、退出恢复没有新增旧事件。

证据：browser-voice.json、browser-network.json、riichi-network.json、audio-settings-before/after.json。CDP Media域在内置浏览器不可用，实际play Promise结果由Director的只读开发诊断记录。校长曾经的正常交互后未遇NotAllowedError；不能据此宣布所有用户播放许可都已通过。未绕过浏览器限制、未强制用户开关。

## 逐包逐项（包含实际台词，TTS控制文本详见JSON）

每行证据均为该包voice_lines.json＋manifest.json＋实际MP3的PyAV全帧解码。映射统一：公开actor稳定身份→voicePackBySeat；流局无actor用既有安全默认包。Fallback：角色包无效按既有校长/首个可用包选择；无角色/单项缺失安全跳过，不换同义key。人耳试听全部NOT_RUN。

### 曼波 · voice-20260821-001

| 语义 | 实际key | 实际台词 | 文件 | 开发/生产URL | 可解码 | 触发时机 | 状态 | 必须补录 |
|---|---|---|---|---|---|---|---|---|
| flavor.win | flavor.win | 啊~死国一 | src/music/voice_lines/voice-20260821-001/audio/flavor_win.mp3 | /api/voice-packs/voice-20260821-001/audio/flavor_win.mp3；/assets/flavor_win-mJ1mEwQS.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| flavor.lose | flavor.lose | 呃啊 | src/music/voice_lines/voice-20260821-001/audio/flavor_lose.mp3 | /api/voice-packs/voice-20260821-001/audio/flavor_lose.mp3；/assets/flavor_lose-CDVHmavO.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| flavor.close_game | flavor.close_game | 这局结束了 | src/music/voice_lines/voice-20260821-001/audio/flavor_close_game.mp3 | /api/voice-packs/voice-20260821-001/audio/flavor_close_game.mp3；/assets/flavor_close_game-YGTsvs9M.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.start | game.start | 对局开始 | src/music/voice_lines/voice-20260821-001/audio/game_start.mp3 | /api/voice-packs/voice-20260821-001/audio/game_start.mp3；/assets/game_start-Bncbd63e.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.end | game.end | 曼波~~曼波~~欧码激励~~曼波！ | src/music/voice_lines/voice-20260821-001/audio/game_end.mp3 | /api/voice-packs/voice-20260821-001/audio/game_end.mp3；/assets/game_end-BH0NIp_r.mp3 | 是 3.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.second_place | result.second_place | 哦耶~ | src/music/voice_lines/voice-20260821-001/audio/result_second_place.mp3 | /api/voice-packs/voice-20260821-001/audio/result_second_place.mp3；/assets/result_second_place-JRrtkLfT.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.third_place | result.third_place | 哈基米~哈基米~ | src/music/voice_lines/voice-20260821-001/audio/result_third_place.mp3 | /api/voice-packs/voice-20260821-001/audio/result_third_place.mp3；/assets/result_third_place-CcVXUt9Q.mp3 | 是 1.65s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.fourth_place | result.fourth_place | 阿~米诺斯！ | src/music/voice_lines/voice-20260821-001/audio/result_fourth_place.mp3 | /api/voice-packs/voice-20260821-001/audio/result_fourth_place.mp3；/assets/result_fourth_place-CnKMQT7s.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tenpai | yaku.tenpai | 听牌 | src/music/voice_lines/voice-20260821-001/audio/yaku_tenpai.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_tenpai.mp3；/assets/yaku_tenpai-DuAteqxU.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.noten | yaku.noten | 没听 | src/music/voice_lines/voice-20260821-001/audio/yaku_noten.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_noten.mp3；/assets/yaku_noten-DD8qNr3V.mp3 | 是 0.57s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.draw | game.draw | 流局 | src/music/voice_lines/voice-20260821-001/audio/game_draw.mp3 | /api/voice-packs/voice-20260821-001/audio/game_draw.mp3；/assets/game_draw-CuR0gL-s.mp3 | 是 0.71s | 最终权威流局 | 可复用 | 否 |
| action.ron | action.ron | 胡啦！ | src/music/voice_lines/voice-20260821-001/audio/action_ron.mp3 | /api/voice-packs/voice-20260821-001/audio/action_ron.mp3；/assets/action_ron-JIADQxd3.mp3 | 是 0.57s | 最终权威和牌结算 | 可复用 | 否 |
| action.tsumo | action.tsumo | 哇哦！自摸！ | src/music/voice_lines/voice-20260821-001/audio/action_tsumo.mp3 | /api/voice-packs/voice-20260821-001/audio/action_tsumo.mp3；/assets/action_tsumo-B-CuFFyx.mp3 | 是 1.70s | 最终权威和牌结算 | 可复用 | 否 |
| action.riichi | action.riichi | 立直 | src/music/voice_lines/voice-20260821-001/audio/action_riichi.mp3 | /api/voice-packs/voice-20260821-001/audio/action_riichi.mp3；/assets/action_riichi-BOTLTswa.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| action.double_riichi | action.double_riichi | 双立直 | src/music/voice_lines/voice-20260821-001/audio/action_double_riichi.mp3 | /api/voice-packs/voice-20260821-001/audio/action_double_riichi.mp3；/assets/action_double_riichi-2oni6GKZ.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| action.chi | action.chi | 吃 | src/music/voice_lines/voice-20260821-001/audio/action_chi.mp3 | /api/voice-packs/voice-20260821-001/audio/action_chi.mp3；/assets/action_chi-DLb3yQXq.mp3 | 是 0.47s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.pon | action.pon | 碰 | src/music/voice_lines/voice-20260821-001/audio/action_pon.mp3 | /api/voice-packs/voice-20260821-001/audio/action_pon.mp3；/assets/action_pon-1tdZzlM6.mp3 | 是 0.47s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.kan | action.kan | 杠 | src/music/voice_lines/voice-20260821-001/audio/action_kan.mp3 | /api/voice-packs/voice-20260821-001/audio/action_kan.mp3；/assets/action_kan-SXn-K82M.mp3 | 是 0.44s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.ankan | action.ankan | 暗杠 | src/music/voice_lines/voice-20260821-001/audio/action_ankan.mp3 | /api/voice-packs/voice-20260821-001/audio/action_ankan.mp3；/assets/action_ankan-BkASGCv9.mp3 | 是 0.68s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.kakan | action.kakan | 加杠 | src/music/voice_lines/voice-20260821-001/audio/action_kakan.mp3 | /api/voice-packs/voice-20260821-001/audio/action_kakan.mp3；/assets/action_kakan-DZiQphiH.mp3 | 是 0.68s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.nuki | action.nuki | 拔北 | src/music/voice_lines/voice-20260821-001/audio/action_nuki.mp3 | /api/voice-packs/voice-20260821-001/audio/action_nuki.mp3；/assets/action_nuki-BsZNjYSm.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_winds_abortive_draw | game.four_winds_abortive_draw | 四风连打 | src/music/voice_lines/voice-20260821-001/audio/game_four_winds_abortive_draw.mp3 | /api/voice-packs/voice-20260821-001/audio/game_four_winds_abortive_draw.mp3；/assets/game_four_winds_abortive_draw-BittLHlG.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_kans_abortive_draw | game.four_kans_abortive_draw | 四杠散了 | src/music/voice_lines/voice-20260821-001/audio/game_four_kans_abortive_draw.mp3 | /api/voice-packs/voice-20260821-001/audio/game_four_kans_abortive_draw.mp3；/assets/game_four_kans_abortive_draw--OeDdLoe.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_riichi_abortive_draw | game.four_riichi_abortive_draw | 四家立直 | src/music/voice_lines/voice-20260821-001/audio/game_four_riichi_abortive_draw.mp3 | /api/voice-packs/voice-20260821-001/audio/game_four_riichi_abortive_draw.mp3；/assets/game_four_riichi_abortive_draw-D8VdO11Y.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.nine_terminals_and_honors_abortive_draw | game.nine_terminals_and_honors_abortive_draw | 九种九牌 | src/music/voice_lines/voice-20260821-001/audio/game_nine_terminals_and_honors_abortive_draw.mp3 | /api/voice-packs/voice-20260821-001/audio/game_nine_terminals_and_honors_abortive_draw.mp3；/assets/game_nine_terminals_and_honors_abortive_draw-BckUopY-.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.nagashi_mangan | game.nagashi_mangan | 流局满贯 | src/music/voice_lines/voice-20260821-001/audio/game_nagashi_mangan.mp3 | /api/voice-packs/voice-20260821-001/audio/game_nagashi_mangan.mp3；/assets/game_nagashi_mangan-D4CuD3xD.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.mangan | score.mangan | 满贯 | src/music/voice_lines/voice-20260821-001/audio/score_mangan.mp3 | /api/voice-packs/voice-20260821-001/audio/score_mangan.mp3；/assets/score_mangan-C2-OMPyQ.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.haneman | score.haneman | 跳满 | src/music/voice_lines/voice-20260821-001/audio/score_haneman.mp3 | /api/voice-packs/voice-20260821-001/audio/score_haneman.mp3；/assets/score_haneman-oGhup7CU.mp3 | 是 0.47s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.baiman | score.baiman | 倍满 | src/music/voice_lines/voice-20260821-001/audio/score_baiman.mp3 | /api/voice-packs/voice-20260821-001/audio/score_baiman.mp3；/assets/score_baiman-B5mtc3xK.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.sanbaiman | score.sanbaiman | 三倍满 | src/music/voice_lines/voice-20260821-001/audio/score_sanbaiman.mp3 | /api/voice-packs/voice-20260821-001/audio/score_sanbaiman.mp3；/assets/score_sanbaiman-BijNvgCo.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.counted_yakuman | score.counted_yakuman | 累计役满 | src/music/voice_lines/voice-20260821-001/audio/score_counted_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/score_counted_yakuman.mp3；/assets/score_counted_yakuman-DTcwZUJ8.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.yakuman | score.yakuman | 役满 | src/music/voice_lines/voice-20260821-001/audio/score_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/score_yakuman.mp3；/assets/score_yakuman-e1nM8oFf.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.double_yakuman | score.double_yakuman | 双倍役满 | src/music/voice_lines/voice-20260821-001/audio/score_double_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/score_double_yakuman.mp3；/assets/score_double_yakuman-D6Ws07FT.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.triple_yakuman | yaku.triple_yakuman | 三倍役满 | src/music/voice_lines/voice-20260821-001/audio/yaku_triple_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_triple_yakuman.mp3；/assets/yaku_triple_yakuman-B0G_RfAD.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.quadruple_yakuman | yaku.quadruple_yakuman | 四倍役满 | src/music/voice_lines/voice-20260821-001/audio/yaku_quadruple_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_quadruple_yakuman.mp3；/assets/yaku_quadruple_yakuman-DbWBnRkO.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.quintuple_yakuman | yaku.quintuple_yakuman | 五倍役满 | src/music/voice_lines/voice-20260821-001/audio/yaku_quintuple_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_quintuple_yakuman.mp3；/assets/yaku_quintuple_yakuman-D9UYnsql.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sextuple_yakuman | yaku.sextuple_yakuman | 六倍役满 | src/music/voice_lines/voice-20260821-001/audio/yaku_sextuple_yakuman.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_sextuple_yakuman.mp3；/assets/yaku_sextuple_yakuman-a90bHuig.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.kokushi | yakuman.kokushi | 国士无双 | src/music/voice_lines/voice-20260821-001/audio/yakuman_kokushi.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_kokushi.mp3；/assets/yakuman_kokushi-Cz2iTMdh.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.suuankou | yakuman.suuankou | 四暗刻 | src/music/voice_lines/voice-20260821-001/audio/yakuman_suuankou.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_suuankou.mp3；/assets/yakuman_suuankou-ihmfrmk0.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.daisangen | yakuman.daisangen | 大三元 | src/music/voice_lines/voice-20260821-001/audio/yakuman_daisangen.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_daisangen.mp3；/assets/yakuman_daisangen-TdHHaWvz.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.shousuushi | yakuman.shousuushi | 小四喜 | src/music/voice_lines/voice-20260821-001/audio/yakuman_shousuushi.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_shousuushi.mp3；/assets/yakuman_shousuushi-PbR89N_x.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.daisuushi | yakuman.daisuushi | 大四喜 | src/music/voice_lines/voice-20260821-001/audio/yakuman_daisuushi.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_daisuushi.mp3；/assets/yakuman_daisuushi-DjNIOIgk.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.tsuuiisou | yakuman.tsuuiisou | 字一色 | src/music/voice_lines/voice-20260821-001/audio/yakuman_tsuuiisou.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_tsuuiisou.mp3；/assets/yakuman_tsuuiisou-BnuIeiBe.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.chinroutou | yakuman.chinroutou | 清老头 | src/music/voice_lines/voice-20260821-001/audio/yakuman_chinroutou.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_chinroutou.mp3；/assets/yakuman_chinroutou-ZiU2JHpa.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.ryuuiisou | yakuman.ryuuiisou | 绿一色 | src/music/voice_lines/voice-20260821-001/audio/yakuman_ryuuiisou.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_ryuuiisou.mp3；/assets/yakuman_ryuuiisou-zZMnvG7Z.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.chuuren | yakuman.chuuren | 九莲宝灯 | src/music/voice_lines/voice-20260821-001/audio/yakuman_chuuren.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_chuuren.mp3；/assets/yakuman_chuuren-BfYZL0-8.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.suuankou_tanki | yakuman.suuankou_tanki | 四暗刻单骑 | src/music/voice_lines/voice-20260821-001/audio/yakuman_suuankou_tanki.mp3 | /api/voice-packs/voice-20260821-001/audio/yakuman_suuankou_tanki.mp3；/assets/yakuman_suuankou_tanki-1LsDLztD.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tenhou | yaku.tenhou | 天和 | src/music/voice_lines/voice-20260821-001/audio/yaku_tenhou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_tenhou.mp3；/assets/yaku_tenhou-C86D7lmw.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chiihou | yaku.chiihou | 地和 | src/music/voice_lines/voice-20260821-001/audio/yaku_chiihou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_chiihou.mp3；/assets/yaku_chiihou-DqAq0u6w.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.kokushi_13_wait | yaku.kokushi_13_wait | 国士无双十三面 | src/music/voice_lines/voice-20260821-001/audio/yaku_kokushi_13_wait.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_kokushi_13_wait.mp3；/assets/yaku_kokushi_13_wait-BOUhqTKp.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.suukantsu | yaku.suukantsu | 四杠子 | src/music/voice_lines/voice-20260821-001/audio/yaku_suukantsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_suukantsu.mp3；/assets/yaku_suukantsu-mYZJv-wq.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.junsei_chuuren | yaku.junsei_chuuren | 纯正九连宝灯 | src/music/voice_lines/voice-20260821-001/audio/yaku_junsei_chuuren.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_junsei_chuuren.mp3；/assets/yaku_junsei_chuuren-BJrCydfW.mp3 | 是 1.28s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.riichi | yaku.riichi | 立直 | src/music/voice_lines/voice-20260821-001/audio/yaku_riichi.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_riichi.mp3；/assets/yaku_riichi-DhzL_asF.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ippatsu | yaku.ippatsu | 一发 | src/music/voice_lines/voice-20260821-001/audio/yaku_ippatsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_ippatsu.mp3；/assets/yaku_ippatsu-U0zRa1h1.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chankan | yaku.chankan | 抢杠 | src/music/voice_lines/voice-20260821-001/audio/yaku_chankan.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_chankan.mp3；/assets/yaku_chankan-CqLzb-fB.mp3 | 是 0.68s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.rinshan_kaihou | yaku.rinshan_kaihou | 岭上开花 | src/music/voice_lines/voice-20260821-001/audio/yaku_rinshan_kaihou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_rinshan_kaihou.mp3；/assets/yaku_rinshan_kaihou-BC8pJHZ5.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.haitei | yaku.haitei | 海底摸月 | src/music/voice_lines/voice-20260821-001/audio/yaku_haitei.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_haitei.mp3；/assets/yaku_haitei-DqPqyt7L.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.houtei | yaku.houtei | 河底捞鱼 | src/music/voice_lines/voice-20260821-001/audio/yaku_houtei.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_houtei.mp3；/assets/yaku_houtei-CefOqe6B.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ton | yaku.ton | 东 | src/music/voice_lines/voice-20260821-001/audio/yaku_ton.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_ton.mp3；/assets/yaku_ton-B_JyKEVW.mp3 | 是 0.52s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shaa | yaku.shaa | 西 | src/music/voice_lines/voice-20260821-001/audio/yaku_shaa.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_shaa.mp3；/assets/yaku_shaa-BzafImTT.mp3 | 是 0.63s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.nan | yaku.nan | 南 | src/music/voice_lines/voice-20260821-001/audio/yaku_nan.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_nan.mp3；/assets/yaku_nan-Dd4kqyrA.mp3 | 是 0.47s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.pei | yaku.pei | 北 | src/music/voice_lines/voice-20260821-001/audio/yaku_pei.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_pei.mp3；/assets/yaku_pei-0bNIlS00.mp3 | 是 0.68s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.haku | yaku.haku | 白 | src/music/voice_lines/voice-20260821-001/audio/yaku_haku.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_haku.mp3；/assets/yaku_haku-R6y176ld.mp3 | 是 0.47s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.hatsu | yaku.hatsu | 发 | src/music/voice_lines/voice-20260821-001/audio/yaku_hatsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_hatsu.mp3；/assets/yaku_hatsu-CgU92vB4.mp3 | 是 0.57s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chun | yaku.chun | 中 | src/music/voice_lines/voice-20260821-001/audio/yaku_chun.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_chun.mp3；/assets/yaku_chun-BnvulYWb.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.pinfu | yaku.pinfu | 平和 | src/music/voice_lines/voice-20260821-001/audio/yaku_pinfu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_pinfu.mp3；/assets/yaku_pinfu-CuUwekCw.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tanyao | yaku.tanyao | 断幺九 | src/music/voice_lines/voice-20260821-001/audio/yaku_tanyao.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_tanyao.mp3；/assets/yaku_tanyao-DO1inagn.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.iipeikou | yaku.iipeikou | 一杯口 | src/music/voice_lines/voice-20260821-001/audio/yaku_iipeikou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_iipeikou.mp3；/assets/yaku_iipeikou-C8nZF2Pg.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chanta | yaku.chanta | 混全带幺九 | src/music/voice_lines/voice-20260821-001/audio/yaku_chanta.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_chanta.mp3；/assets/yaku_chanta-CNm-4k28.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.honroutou | yaku.honroutou | 混老头 | src/music/voice_lines/voice-20260821-001/audio/yaku_honroutou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_honroutou.mp3；/assets/yaku_honroutou-BWXgpOat.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.toitoi | yaku.toitoi | 对对和 | src/music/voice_lines/voice-20260821-001/audio/yaku_toitoi.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_toitoi.mp3；/assets/yaku_toitoi-DsptNUVE.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanankou | yaku.sanankou | 三暗刻 | src/music/voice_lines/voice-20260821-001/audio/yaku_sanankou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_sanankou.mp3；/assets/yaku_sanankou-BxZ_Qng_.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanshoku | yaku.sanshoku | 三色同顺 | src/music/voice_lines/voice-20260821-001/audio/yaku_sanshoku.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_sanshoku.mp3；/assets/yaku_sanshoku-D2bYJpJH.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ittsu | yaku.ittsu | 一气通贯 | src/music/voice_lines/voice-20260821-001/audio/yaku_ittsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_ittsu.mp3；/assets/yaku_ittsu-CsycfEpL.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sankantsu | yaku.sankantsu | 三杠子 | src/music/voice_lines/voice-20260821-001/audio/yaku_sankantsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_sankantsu.mp3；/assets/yaku_sankantsu-B22AUp0z.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanshoku_doukou | yaku.sanshoku_doukou | 三色同刻 | src/music/voice_lines/voice-20260821-001/audio/yaku_sanshoku_doukou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_sanshoku_doukou.mp3；/assets/yaku_sanshoku_doukou-BCyR_PRc.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.junchan | yaku.junchan | 纯全带幺九 | src/music/voice_lines/voice-20260821-001/audio/yaku_junchan.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_junchan.mp3；/assets/yaku_junchan-BLNu6y7q.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chinitsu | yaku.chinitsu | 清一色 | src/music/voice_lines/voice-20260821-001/audio/yaku_chinitsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_chinitsu.mp3；/assets/yaku_chinitsu-BoKdSUfU.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.honitsu | yaku.honitsu | 混一色 | src/music/voice_lines/voice-20260821-001/audio/yaku_honitsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_honitsu.mp3；/assets/yaku_honitsu-DRIC-PRa.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chiitoitsu | yaku.chiitoitsu | 七对子 | src/music/voice_lines/voice-20260821-001/audio/yaku_chiitoitsu.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_chiitoitsu.mp3；/assets/yaku_chiitoitsu-Du7ZpagD.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shousangen | yaku.shousangen | 小三元 | src/music/voice_lines/voice-20260821-001/audio/yaku_shousangen.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_shousangen.mp3；/assets/yaku_shousangen-aZ7Ae65-.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ryanpeikou | yaku.ryanpeikou | 二杯口 | src/music/voice_lines/voice-20260821-001/audio/yaku_ryanpeikou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_ryanpeikou.mp3；/assets/yaku_ryanpeikou-J14Y0ndd.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tsubamegaeshi | yaku.tsubamegaeshi | 燕返 | src/music/voice_lines/voice-20260821-001/audio/yaku_tsubamegaeshi.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_tsubamegaeshi.mp3；/assets/yaku_tsubamegaeshi-PMfw0RPj.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.kanfuri | yaku.kanfuri | 杠振 | src/music/voice_lines/voice-20260821-001/audio/yaku_kanfuri.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_kanfuri.mp3；/assets/yaku_kanfuri-CaGSNUsW.mp3 | 是 0.63s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shiisanpuutaa | yaku.shiisanpuutaa | 十二落抬 | src/music/voice_lines/voice-20260821-001/audio/yaku_shiisanpuutaa.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_shiisanpuutaa.mp3；/assets/yaku_shiisanpuutaa-e1SPGL9Y.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.go_men_zei | yaku.go_men_zei | 五门齐 | src/music/voice_lines/voice-20260821-001/audio/yaku_go_men_zei.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_go_men_zei.mp3；/assets/yaku_go_men_zei-B8ZukhbO.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanrenkou | yaku.sanrenkou | 三连刻 | src/music/voice_lines/voice-20260821-001/audio/yaku_sanrenkou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_sanrenkou.mp3；/assets/yaku_sanrenkou-dikl3ROv.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.isshoku_sanjun | yaku.isshoku_sanjun | 一色三同顺 | src/music/voice_lines/voice-20260821-001/audio/yaku_isshoku_sanjun.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_isshoku_sanjun.mp3；/assets/yaku_isshoku_sanjun-_lMSj3Ge.mp3 | 是 1.28s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.one_pin_moon | yaku.one_pin_moon | 一筒摸月 | src/music/voice_lines/voice-20260821-001/audio/yaku_one_pin_moon.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_one_pin_moon.mp3；/assets/yaku_one_pin_moon-BloafG9D.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.nine_pin_fish | yaku.nine_pin_fish | 九筒捞鱼 | src/music/voice_lines/voice-20260821-001/audio/yaku_nine_pin_fish.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_nine_pin_fish.mp3；/assets/yaku_nine_pin_fish-ChLIEjRg.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.renhou | yaku.renhou | 人和 | src/music/voice_lines/voice-20260821-001/audio/yaku_renhou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_renhou.mp3；/assets/yaku_renhou--eVH2nm7.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daisharin | yaku.daisharin | 大车轮 | src/music/voice_lines/voice-20260821-001/audio/yaku_daisharin.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_daisharin.mp3；/assets/yaku_daisharin-CciQYDhZ.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daichikurin | yaku.daichikurin | 大竹林 | src/music/voice_lines/voice-20260821-001/audio/yaku_daichikurin.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_daichikurin.mp3；/assets/yaku_daichikurin-CaCkW8uS.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daisuulin | yaku.daisuulin | 大数邻 | src/music/voice_lines/voice-20260821-001/audio/yaku_daisuulin.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_daisuulin.mp3；/assets/yaku_daisuulin-KdoRF2f8.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.suurenkou | yaku.suurenkou | 四连刻 | src/music/voice_lines/voice-20260821-001/audio/yaku_suurenkou.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_suurenkou.mp3；/assets/yaku_suurenkou-4Sh12y0N.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ishigami_sannen | yaku.ishigami_sannen | 石上三年 | src/music/voice_lines/voice-20260821-001/audio/yaku_ishigami_sannen.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_ishigami_sannen.mp3；/assets/yaku_ishigami_sannen-NeHzGwvp.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daichisei | yaku.daichisei | 大七星 | src/music/voice_lines/voice-20260821-001/audio/yaku_daichisei.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_daichisei.mp3；/assets/yaku_daichisei-DTGYBHpt.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora | yaku.dora | 宝牌 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora.mp3；/assets/yaku_dora-Bl4RAt3a.mp3 | 是 0.68s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_2 | yaku.dora_2 | 宝牌2 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_2.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_2.mp3；/assets/yaku_dora_2-DegQJ0df.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_3 | yaku.dora_3 | 宝牌3 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_3.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_3.mp3；/assets/yaku_dora_3-B86RN99w.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_4 | yaku.dora_4 | 宝牌4 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_4.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_4.mp3；/assets/yaku_dora_4-qBlFOx7S.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_5 | yaku.dora_5 | 宝牌5 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_5.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_5.mp3；/assets/yaku_dora_5-8qAV_lJt.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_6 | yaku.dora_6 | 宝牌6 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_6.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_6.mp3；/assets/yaku_dora_6-DjPES7aH.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_7 | yaku.dora_7 | 宝牌7 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_7.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_7.mp3；/assets/yaku_dora_7-B50-NtAJ.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_8 | yaku.dora_8 | 宝牌8 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_8.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_8.mp3；/assets/yaku_dora_8-DUo8-HO1.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_9 | yaku.dora_9 | 宝牌9 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_9.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_9.mp3；/assets/yaku_dora_9-B8zODzcD.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_10 | yaku.dora_10 | 宝牌10 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_10.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_10.mp3；/assets/yaku_dora_10-nk8uoZIe.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_11 | yaku.dora_11 | 宝牌11 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_11.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_11.mp3；/assets/yaku_dora_11-Deyumh7S.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_12 | yaku.dora_12 | 宝牌12 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_12.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_12.mp3；/assets/yaku_dora_12-CFm37wg-.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_13 | yaku.dora_13 | 宝牌13 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_13.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_13.mp3；/assets/yaku_dora_13-eOmAEQK3.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_many | yaku.dora_many | 宝牌一大堆 | src/music/voice_lines/voice-20260821-001/audio/yaku_dora_many.mp3 | /api/voice-packs/voice-20260821-001/audio/yaku_dora_many.mp3；/assets/yaku_dora_many-B0tqebZC.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| 普通公开弃牌 | tile.m1 | 一万 | src/music/voice_lines/voice-20260821-001/audio/tile_m1.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m1.mp3；/assets/tile_m1-CKbY8dGs.mp3 | 是 0.57s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m2 | 二万 | src/music/voice_lines/voice-20260821-001/audio/tile_m2.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m2.mp3；/assets/tile_m2-BN248U_O.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m3 | 三万 | src/music/voice_lines/voice-20260821-001/audio/tile_m3.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m3.mp3；/assets/tile_m3-DIeQN-Oj.mp3 | 是 0.81s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m4 | 四万 | src/music/voice_lines/voice-20260821-001/audio/tile_m4.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m4.mp3；/assets/tile_m4-DAwN-Ofh.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m5 | 五万 | src/music/voice_lines/voice-20260821-001/audio/tile_m5.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m5.mp3；/assets/tile_m5-CFIUAZJ1.mp3 | 是 0.57s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m6 | 六万 | src/music/voice_lines/voice-20260821-001/audio/tile_m6.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m6.mp3；/assets/tile_m6-BTgOlEvV.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m7 | 七万 | src/music/voice_lines/voice-20260821-001/audio/tile_m7.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m7.mp3；/assets/tile_m7-QxdvrH-c.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m8 | 八万 | src/music/voice_lines/voice-20260821-001/audio/tile_m8.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m8.mp3；/assets/tile_m8-DiefGfVV.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m9 | 九万 | src/music/voice_lines/voice-20260821-001/audio/tile_m9.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_m9.mp3；/assets/tile_m9-GlhLoU8p.mp3 | 是 0.71s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p1 | 一筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p1.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p1.mp3；/assets/tile_p1-BV--k_yI.mp3 | 是 0.71s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p2 | 二筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p2.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p2.mp3；/assets/tile_p2-DPX4AwP1.mp3 | 是 0.57s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p3 | 三筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p3.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p3.mp3；/assets/tile_p3-BpI7nv-2.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p4 | 四筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p4.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p4.mp3；/assets/tile_p4-BE9Wr7xX.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p5 | 五筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p5.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p5.mp3；/assets/tile_p5-BMg7mZBB.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p6 | 六筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p6.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p6.mp3；/assets/tile_p6-D1rSRZ1j.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p7 | 七筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p7.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p7.mp3；/assets/tile_p7-CnURMSxD.mp3 | 是 0.68s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p8 | 八筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p8.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p8.mp3；/assets/tile_p8-q2FyIGVP.mp3 | 是 0.68s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p9 | 九筒 | src/music/voice_lines/voice-20260821-001/audio/tile_p9.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_p9.mp3；/assets/tile_p9-CF8lBObF.mp3 | 是 0.68s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s1 | 幺鸡 | src/music/voice_lines/voice-20260821-001/audio/tile_s1.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s1.mp3；/assets/tile_s1-Cjd6tom1.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s2 | 二条 | src/music/voice_lines/voice-20260821-001/audio/tile_s2.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s2.mp3；/assets/tile_s2-D3ODCk5g.mp3 | 是 0.68s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s3 | 三条 | src/music/voice_lines/voice-20260821-001/audio/tile_s3.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s3.mp3；/assets/tile_s3-BznIgeUA.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s4 | 四条 | src/music/voice_lines/voice-20260821-001/audio/tile_s4.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s4.mp3；/assets/tile_s4-93gGjKNq.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s5 | 五条 | src/music/voice_lines/voice-20260821-001/audio/tile_s5.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s5.mp3；/assets/tile_s5-C_kyW0_o.mp3 | 是 0.71s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s6 | 六条 | src/music/voice_lines/voice-20260821-001/audio/tile_s6.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s6.mp3；/assets/tile_s6-B5dWxoGS.mp3 | 是 0.71s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s7 | 七条 | src/music/voice_lines/voice-20260821-001/audio/tile_s7.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s7.mp3；/assets/tile_s7-C0gWrS40.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s8 | 八条 | src/music/voice_lines/voice-20260821-001/audio/tile_s8.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s8.mp3；/assets/tile_s8-CCLt2dMM.mp3 | 是 0.68s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s9 | 九条 | src/music/voice_lines/voice-20260821-001/audio/tile_s9.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_s9.mp3；/assets/tile_s9-COg-Aefq.mp3 | 是 0.71s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z1 | 东风 | src/music/voice_lines/voice-20260821-001/audio/tile_z1.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z1.mp3；/assets/tile_z1-DyYKtGc3.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z2 | 南风 | src/music/voice_lines/voice-20260821-001/audio/tile_z2.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z2.mp3；/assets/tile_z2-kQeJC9Z2.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z3 | 西风 | src/music/voice_lines/voice-20260821-001/audio/tile_z3.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z3.mp3；/assets/tile_z3-PnanvZhM.mp3 | 是 0.81s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z4 | 北风 | src/music/voice_lines/voice-20260821-001/audio/tile_z4.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z4.mp3；/assets/tile_z4-DuGD_DWT.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z5 | 白板 | src/music/voice_lines/voice-20260821-001/audio/tile_z5.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z5.mp3；/assets/tile_z5-Bhm7YaJ2.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z6 | 发财 | src/music/voice_lines/voice-20260821-001/audio/tile_z6.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z6.mp3；/assets/tile_z6-C1qXL2CF.mp3 | 是 0.81s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z7 | 红中 | src/music/voice_lines/voice-20260821-001/audio/tile_z7.mp3 | /api/voice-packs/voice-20260821-001/audio/tile_z7.mp3；/assets/tile_z7-CV3S51KG.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |

### 校长 · xiaozhang

| 语义 | 实际key | 实际台词 | 文件 | 开发/生产URL | 可解码 | 触发时机 | 状态 | 必须补录 |
|---|---|---|---|---|---|---|---|---|
| flavor.win | flavor.win | 破釜沉舟，问鼎中原！ | src/music/voice_lines/xiaozhang/audio/flavor_win.mp3 | /api/voice-packs/xiaozhang/audio/flavor_win.mp3；/assets/flavor_win-DKRcVjvD.mp3 | 是 3.32s | 不在本轮国标触发 | 国标不适用 | 否 |
| flavor.lose | flavor.lose | 不要叫我校长，你是我的校长！ | src/music/voice_lines/xiaozhang/audio/flavor_lose.mp3 | /api/voice-packs/xiaozhang/audio/flavor_lose.mp3；/assets/flavor_lose-BjluQH2j.mp3 | 是 3.08s | 不在本轮国标触发 | 国标不适用 | 否 |
| flavor.close_game | flavor.close_game | 这局结束了 | src/music/voice_lines/xiaozhang/audio/flavor_close_game.mp3 | /api/voice-packs/xiaozhang/audio/flavor_close_game.mp3；/assets/flavor_close_game-CkHJGyz9.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.start | game.start | 八十万对六十万，优势在我！ | src/music/voice_lines/xiaozhang/audio/game_start.mp3 | /api/voice-packs/xiaozhang/audio/game_start.mp3；/assets/game_start-OBHTdIAS.mp3 | 是 2.90s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.end | game.end | 那种勃勃生机、万物竞发的境界，犹在眼前。 | src/music/voice_lines/xiaozhang/audio/game_end.mp3 | /api/voice-packs/xiaozhang/audio/game_end.mp3；/assets/game_end-CgrOnsVw.mp3 | 是 4.62s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.second_place | result.second_place | 真可谓占尽天时 | src/music/voice_lines/xiaozhang/audio/result_second_place.mp3 | /api/voice-packs/xiaozhang/audio/result_second_place.mp3；/assets/result_second_place-BSDDfC3M.mp3 | 是 2.30s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.third_place | result.third_place | 我不明白！ | src/music/voice_lines/xiaozhang/audio/result_third_place.mp3 | /api/voice-packs/xiaozhang/audio/result_third_place.mp3；/assets/result_third_place-CmEOsb4r.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.fourth_place | result.fourth_place | 娘希匹 | src/music/voice_lines/xiaozhang/audio/result_fourth_place.mp3 | /api/voice-packs/xiaozhang/audio/result_fourth_place.mp3；/assets/result_fourth_place-Cs5pdn4o.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tenpai | yaku.tenpai | 听牌 | src/music/voice_lines/xiaozhang/audio/yaku_tenpai.mp3 | /api/voice-packs/xiaozhang/audio/yaku_tenpai.mp3；/assets/yaku_tenpai-DjwLgurb.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.noten | yaku.noten | 没听 | src/music/voice_lines/xiaozhang/audio/yaku_noten.mp3 | /api/voice-packs/xiaozhang/audio/yaku_noten.mp3；/assets/yaku_noten-BKeImZQD.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.draw | game.draw | 流局 | src/music/voice_lines/xiaozhang/audio/game_draw.mp3 | /api/voice-packs/xiaozhang/audio/game_draw.mp3；/assets/game_draw-Cn6quvrA.mp3 | 是 0.99s | 最终权威流局 | 可复用 | 否 |
| action.ron | action.ron | 娘希匹，胡啦！ | src/music/voice_lines/xiaozhang/audio/action_ron.mp3 | /api/voice-packs/xiaozhang/audio/action_ron.mp3；/assets/action_ron-CyWuT3eK.mp3 | 是 2.01s | 最终权威和牌结算 | 可复用 | 否 |
| action.tsumo | action.tsumo | 自摸 | src/music/voice_lines/xiaozhang/audio/action_tsumo.mp3 | /api/voice-packs/xiaozhang/audio/action_tsumo.mp3；/assets/action_tsumo-cqb_xuO_.mp3 | 是 0.89s | 最终权威和牌结算 | 可复用 | 否 |
| action.riichi | action.riichi | 立直 | src/music/voice_lines/xiaozhang/audio/action_riichi.mp3 | /api/voice-packs/xiaozhang/audio/action_riichi.mp3；/assets/action_riichi-MzwPTn1u.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| action.double_riichi | action.double_riichi | 双立直 | src/music/voice_lines/xiaozhang/audio/action_double_riichi.mp3 | /api/voice-packs/xiaozhang/audio/action_double_riichi.mp3；/assets/action_double_riichi-CSehFRYd.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| action.chi | action.chi | 吃 | src/music/voice_lines/xiaozhang/audio/action_chi.mp3 | /api/voice-packs/xiaozhang/audio/action_chi.mp3；/assets/action_chi-Dmc4SCP3.mp3 | 是 0.71s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.pon | action.pon | 碰 | src/music/voice_lines/xiaozhang/audio/action_pon.mp3 | /api/voice-packs/xiaozhang/audio/action_pon.mp3；/assets/action_pon-DBgl3IDL.mp3 | 是 0.71s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.kan | action.kan | 杠 | src/music/voice_lines/xiaozhang/audio/action_kan.mp3 | /api/voice-packs/xiaozhang/audio/action_kan.mp3；/assets/action_kan-CdiFW2Mc.mp3 | 是 0.68s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.ankan | action.ankan | 暗杠 | src/music/voice_lines/xiaozhang/audio/action_ankan.mp3 | /api/voice-packs/xiaozhang/audio/action_ankan.mp3；/assets/action_ankan-5pHKagfz.mp3 | 是 0.89s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.kakan | action.kakan | 加杠 | src/music/voice_lines/xiaozhang/audio/action_kakan.mp3 | /api/voice-packs/xiaozhang/audio/action_kakan.mp3；/assets/action_kakan-DVsjH8JO.mp3 | 是 1.04s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.nuki | action.nuki | 拔北 | src/music/voice_lines/xiaozhang/audio/action_nuki.mp3 | /api/voice-packs/xiaozhang/audio/action_nuki.mp3；/assets/action_nuki-BuT4G7jx.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_winds_abortive_draw | game.four_winds_abortive_draw | 四风连打 | src/music/voice_lines/xiaozhang/audio/game_four_winds_abortive_draw.mp3 | /api/voice-packs/xiaozhang/audio/game_four_winds_abortive_draw.mp3；/assets/game_four_winds_abortive_draw-DKp-XQdc.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_kans_abortive_draw | game.four_kans_abortive_draw | 四杠散了 | src/music/voice_lines/xiaozhang/audio/game_four_kans_abortive_draw.mp3 | /api/voice-packs/xiaozhang/audio/game_four_kans_abortive_draw.mp3；/assets/game_four_kans_abortive_draw-CrlPGQOk.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_riichi_abortive_draw | game.four_riichi_abortive_draw | 四家立直 | src/music/voice_lines/xiaozhang/audio/game_four_riichi_abortive_draw.mp3 | /api/voice-packs/xiaozhang/audio/game_four_riichi_abortive_draw.mp3；/assets/game_four_riichi_abortive_draw-jpqfQFAt.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.nine_terminals_and_honors_abortive_draw | game.nine_terminals_and_honors_abortive_draw | 九种九牌 | src/music/voice_lines/xiaozhang/audio/game_nine_terminals_and_honors_abortive_draw.mp3 | /api/voice-packs/xiaozhang/audio/game_nine_terminals_and_honors_abortive_draw.mp3；/assets/game_nine_terminals_and_honors_abortive_draw-HqWnIqtH.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.nagashi_mangan | game.nagashi_mangan | 流局满贯 | src/music/voice_lines/xiaozhang/audio/game_nagashi_mangan.mp3 | /api/voice-packs/xiaozhang/audio/game_nagashi_mangan.mp3；/assets/game_nagashi_mangan-CdvtGDUS.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.mangan | score.mangan | 满贯 | src/music/voice_lines/xiaozhang/audio/score_mangan.mp3 | /api/voice-packs/xiaozhang/audio/score_mangan.mp3；/assets/score_mangan-D_HJRo6m.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.haneman | score.haneman | 跳满 | src/music/voice_lines/xiaozhang/audio/score_haneman.mp3 | /api/voice-packs/xiaozhang/audio/score_haneman.mp3；/assets/score_haneman-BL-sANpc.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.baiman | score.baiman | 倍满 | src/music/voice_lines/xiaozhang/audio/score_baiman.mp3 | /api/voice-packs/xiaozhang/audio/score_baiman.mp3；/assets/score_baiman-GLjOYDYo.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.sanbaiman | score.sanbaiman | 三倍满 | src/music/voice_lines/xiaozhang/audio/score_sanbaiman.mp3 | /api/voice-packs/xiaozhang/audio/score_sanbaiman.mp3；/assets/score_sanbaiman-GtRTnsc6.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.counted_yakuman | score.counted_yakuman | 累计役满 | src/music/voice_lines/xiaozhang/audio/score_counted_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/score_counted_yakuman.mp3；/assets/score_counted_yakuman-DzE_2wE9.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.yakuman | score.yakuman | 役满 | src/music/voice_lines/xiaozhang/audio/score_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/score_yakuman.mp3；/assets/score_yakuman-BiZSStya.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.double_yakuman | score.double_yakuman | 双倍役满 | src/music/voice_lines/xiaozhang/audio/score_double_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/score_double_yakuman.mp3；/assets/score_double_yakuman-gygPv-VF.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.triple_yakuman | yaku.triple_yakuman | 三倍役满 | src/music/voice_lines/xiaozhang/audio/yaku_triple_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/yaku_triple_yakuman.mp3；/assets/yaku_triple_yakuman-CrmrwKV2.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.quadruple_yakuman | yaku.quadruple_yakuman | 四倍役满 | src/music/voice_lines/xiaozhang/audio/yaku_quadruple_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/yaku_quadruple_yakuman.mp3；/assets/yaku_quadruple_yakuman-DFbMO1c1.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.quintuple_yakuman | yaku.quintuple_yakuman | 五倍役满 | src/music/voice_lines/xiaozhang/audio/yaku_quintuple_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/yaku_quintuple_yakuman.mp3；/assets/yaku_quintuple_yakuman-BS0BQtHQ.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sextuple_yakuman | yaku.sextuple_yakuman | 六倍役满 | src/music/voice_lines/xiaozhang/audio/yaku_sextuple_yakuman.mp3 | /api/voice-packs/xiaozhang/audio/yaku_sextuple_yakuman.mp3；/assets/yaku_sextuple_yakuman-D3mD89hB.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.kokushi | yakuman.kokushi | 国士无双 | src/music/voice_lines/xiaozhang/audio/yakuman_kokushi.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_kokushi.mp3；/assets/yakuman_kokushi-CF50FGCt.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.suuankou | yakuman.suuankou | 四暗刻 | src/music/voice_lines/xiaozhang/audio/yakuman_suuankou.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_suuankou.mp3；/assets/yakuman_suuankou-stUoJET6.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.daisangen | yakuman.daisangen | 大三元 | src/music/voice_lines/xiaozhang/audio/yakuman_daisangen.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_daisangen.mp3；/assets/yakuman_daisangen-B-62gDsO.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.shousuushi | yakuman.shousuushi | 小四喜 | src/music/voice_lines/xiaozhang/audio/yakuman_shousuushi.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_shousuushi.mp3；/assets/yakuman_shousuushi-Cdqp46P4.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.daisuushi | yakuman.daisuushi | 大四喜 | src/music/voice_lines/xiaozhang/audio/yakuman_daisuushi.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_daisuushi.mp3；/assets/yakuman_daisuushi-CDOa1TPM.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.tsuuiisou | yakuman.tsuuiisou | 字一色 | src/music/voice_lines/xiaozhang/audio/yakuman_tsuuiisou.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_tsuuiisou.mp3；/assets/yakuman_tsuuiisou-BMsdTFX-.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.chinroutou | yakuman.chinroutou | 清老头 | src/music/voice_lines/xiaozhang/audio/yakuman_chinroutou.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_chinroutou.mp3；/assets/yakuman_chinroutou-DcCDfW56.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.ryuuiisou | yakuman.ryuuiisou | 绿一色 | src/music/voice_lines/xiaozhang/audio/yakuman_ryuuiisou.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_ryuuiisou.mp3；/assets/yakuman_ryuuiisou-BIK_rzjP.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.chuuren | yakuman.chuuren | 九莲宝灯 | src/music/voice_lines/xiaozhang/audio/yakuman_chuuren.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_chuuren.mp3；/assets/yakuman_chuuren-XWNYfwth.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.suuankou_tanki | yakuman.suuankou_tanki | 四暗刻单骑 | src/music/voice_lines/xiaozhang/audio/yakuman_suuankou_tanki.mp3 | /api/voice-packs/xiaozhang/audio/yakuman_suuankou_tanki.mp3；/assets/yakuman_suuankou_tanki-T-OVfjae.mp3 | 是 1.72s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tenhou | yaku.tenhou | 天和 | src/music/voice_lines/xiaozhang/audio/yaku_tenhou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_tenhou.mp3；/assets/yaku_tenhou-BHQcmMpU.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chiihou | yaku.chiihou | 地和 | src/music/voice_lines/xiaozhang/audio/yaku_chiihou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_chiihou.mp3；/assets/yaku_chiihou-BPPiIPJN.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.kokushi_13_wait | yaku.kokushi_13_wait | 国士无双十三面 | src/music/voice_lines/xiaozhang/audio/yaku_kokushi_13_wait.mp3 | /api/voice-packs/xiaozhang/audio/yaku_kokushi_13_wait.mp3；/assets/yaku_kokushi_13_wait-w-FPYnSG.mp3 | 是 2.19s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.suukantsu | yaku.suukantsu | 四杠子 | src/music/voice_lines/xiaozhang/audio/yaku_suukantsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_suukantsu.mp3；/assets/yaku_suukantsu-BM11d0tL.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.junsei_chuuren | yaku.junsei_chuuren | 纯正九连宝灯 | src/music/voice_lines/xiaozhang/audio/yaku_junsei_chuuren.mp3 | /api/voice-packs/xiaozhang/audio/yaku_junsei_chuuren.mp3；/assets/yaku_junsei_chuuren-RzQ50V5T.mp3 | 是 1.88s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.riichi | yaku.riichi | 立直 | src/music/voice_lines/xiaozhang/audio/yaku_riichi.mp3 | /api/voice-packs/xiaozhang/audio/yaku_riichi.mp3；/assets/yaku_riichi-DlOkoNxy.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ippatsu | yaku.ippatsu | 一发 | src/music/voice_lines/xiaozhang/audio/yaku_ippatsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_ippatsu.mp3；/assets/yaku_ippatsu-CQbSo0SI.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chankan | yaku.chankan | 抢杠 | src/music/voice_lines/xiaozhang/audio/yaku_chankan.mp3 | /api/voice-packs/xiaozhang/audio/yaku_chankan.mp3；/assets/yaku_chankan-5N_VFH-V.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.rinshan_kaihou | yaku.rinshan_kaihou | 岭上开花 | src/music/voice_lines/xiaozhang/audio/yaku_rinshan_kaihou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_rinshan_kaihou.mp3；/assets/yaku_rinshan_kaihou-BD9h1HCD.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.haitei | yaku.haitei | 海底摸月 | src/music/voice_lines/xiaozhang/audio/yaku_haitei.mp3 | /api/voice-packs/xiaozhang/audio/yaku_haitei.mp3；/assets/yaku_haitei-CrZjGWrx.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.houtei | yaku.houtei | 河底捞鱼 | src/music/voice_lines/xiaozhang/audio/yaku_houtei.mp3 | /api/voice-packs/xiaozhang/audio/yaku_houtei.mp3；/assets/yaku_houtei-YEXkhnm5.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ton | yaku.ton | 东 | src/music/voice_lines/xiaozhang/audio/yaku_ton.mp3 | /api/voice-packs/xiaozhang/audio/yaku_ton.mp3；/assets/yaku_ton-BMm2EVCz.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shaa | yaku.shaa | 西 | src/music/voice_lines/xiaozhang/audio/yaku_shaa.mp3 | /api/voice-packs/xiaozhang/audio/yaku_shaa.mp3；/assets/yaku_shaa-Duo7BOAZ.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.nan | yaku.nan | 南 | src/music/voice_lines/xiaozhang/audio/yaku_nan.mp3 | /api/voice-packs/xiaozhang/audio/yaku_nan.mp3；/assets/yaku_nan-Ccgu-U7G.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.pei | yaku.pei | 北 | src/music/voice_lines/xiaozhang/audio/yaku_pei.mp3 | /api/voice-packs/xiaozhang/audio/yaku_pei.mp3；/assets/yaku_pei-BKJbiq6s.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.haku | yaku.haku | 白 | src/music/voice_lines/xiaozhang/audio/yaku_haku.mp3 | /api/voice-packs/xiaozhang/audio/yaku_haku.mp3；/assets/yaku_haku-u2PU98IZ.mp3 | 是 0.81s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.hatsu | yaku.hatsu | 发 | src/music/voice_lines/xiaozhang/audio/yaku_hatsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_hatsu.mp3；/assets/yaku_hatsu-Fk9bFcMf.mp3 | 是 0.86s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chun | yaku.chun | 中 | src/music/voice_lines/xiaozhang/audio/yaku_chun.mp3 | /api/voice-packs/xiaozhang/audio/yaku_chun.mp3；/assets/yaku_chun-C5pES_8i.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.pinfu | yaku.pinfu | 平和 | src/music/voice_lines/xiaozhang/audio/yaku_pinfu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_pinfu.mp3；/assets/yaku_pinfu-BoAu3EM-.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tanyao | yaku.tanyao | 断幺九 | src/music/voice_lines/xiaozhang/audio/yaku_tanyao.mp3 | /api/voice-packs/xiaozhang/audio/yaku_tanyao.mp3；/assets/yaku_tanyao-DHhIpCm3.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.iipeikou | yaku.iipeikou | 一杯口 | src/music/voice_lines/xiaozhang/audio/yaku_iipeikou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_iipeikou.mp3；/assets/yaku_iipeikou-Ds-9hyub.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chanta | yaku.chanta | 混全带幺九 | src/music/voice_lines/xiaozhang/audio/yaku_chanta.mp3 | /api/voice-packs/xiaozhang/audio/yaku_chanta.mp3；/assets/yaku_chanta-eXvvLX4C.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.honroutou | yaku.honroutou | 混老头 | src/music/voice_lines/xiaozhang/audio/yaku_honroutou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_honroutou.mp3；/assets/yaku_honroutou-F61bHyyU.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.toitoi | yaku.toitoi | 对对和 | src/music/voice_lines/xiaozhang/audio/yaku_toitoi.mp3 | /api/voice-packs/xiaozhang/audio/yaku_toitoi.mp3；/assets/yaku_toitoi-4iWrUPbT.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanankou | yaku.sanankou | 三暗刻 | src/music/voice_lines/xiaozhang/audio/yaku_sanankou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_sanankou.mp3；/assets/yaku_sanankou-DnA4KSlv.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanshoku | yaku.sanshoku | 三色同顺 | src/music/voice_lines/xiaozhang/audio/yaku_sanshoku.mp3 | /api/voice-packs/xiaozhang/audio/yaku_sanshoku.mp3；/assets/yaku_sanshoku-Bgeo2SvD.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ittsu | yaku.ittsu | 一气通贯 | src/music/voice_lines/xiaozhang/audio/yaku_ittsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_ittsu.mp3；/assets/yaku_ittsu-CkcXpo7A.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sankantsu | yaku.sankantsu | 三杠子 | src/music/voice_lines/xiaozhang/audio/yaku_sankantsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_sankantsu.mp3；/assets/yaku_sankantsu-C_h0sMS2.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanshoku_doukou | yaku.sanshoku_doukou | 三色同刻 | src/music/voice_lines/xiaozhang/audio/yaku_sanshoku_doukou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_sanshoku_doukou.mp3；/assets/yaku_sanshoku_doukou-D1kEX5Zs.mp3 | 是 1.52s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.junchan | yaku.junchan | 纯全带幺九 | src/music/voice_lines/xiaozhang/audio/yaku_junchan.mp3 | /api/voice-packs/xiaozhang/audio/yaku_junchan.mp3；/assets/yaku_junchan-BFCFaOW9.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chinitsu | yaku.chinitsu | 清一色 | src/music/voice_lines/xiaozhang/audio/yaku_chinitsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_chinitsu.mp3；/assets/yaku_chinitsu-CIze9TAN.mp3 | 是 0.99s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.honitsu | yaku.honitsu | 混一色 | src/music/voice_lines/xiaozhang/audio/yaku_honitsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_honitsu.mp3；/assets/yaku_honitsu-CvzoG7eb.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chiitoitsu | yaku.chiitoitsu | 七对子 | src/music/voice_lines/xiaozhang/audio/yaku_chiitoitsu.mp3 | /api/voice-packs/xiaozhang/audio/yaku_chiitoitsu.mp3；/assets/yaku_chiitoitsu-uxEJjY6S.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shousangen | yaku.shousangen | 小三元 | src/music/voice_lines/xiaozhang/audio/yaku_shousangen.mp3 | /api/voice-packs/xiaozhang/audio/yaku_shousangen.mp3；/assets/yaku_shousangen-DdKC8BrZ.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ryanpeikou | yaku.ryanpeikou | 二杯口 | src/music/voice_lines/xiaozhang/audio/yaku_ryanpeikou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_ryanpeikou.mp3；/assets/yaku_ryanpeikou-Brp0QkOl.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tsubamegaeshi | yaku.tsubamegaeshi | 燕返 | src/music/voice_lines/xiaozhang/audio/yaku_tsubamegaeshi.mp3 | /api/voice-packs/xiaozhang/audio/yaku_tsubamegaeshi.mp3；/assets/yaku_tsubamegaeshi-_Fwy4cyV.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.kanfuri | yaku.kanfuri | 杠振 | src/music/voice_lines/xiaozhang/audio/yaku_kanfuri.mp3 | /api/voice-packs/xiaozhang/audio/yaku_kanfuri.mp3；/assets/yaku_kanfuri-C7eM0Hci.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shiisanpuutaa | yaku.shiisanpuutaa | 十二落抬 | src/music/voice_lines/xiaozhang/audio/yaku_shiisanpuutaa.mp3 | /api/voice-packs/xiaozhang/audio/yaku_shiisanpuutaa.mp3；/assets/yaku_shiisanpuutaa-CmbWoG2C.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.go_men_zei | yaku.go_men_zei | 五门齐 | src/music/voice_lines/xiaozhang/audio/yaku_go_men_zei.mp3 | /api/voice-packs/xiaozhang/audio/yaku_go_men_zei.mp3；/assets/yaku_go_men_zei-VKMXogVN.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanrenkou | yaku.sanrenkou | 三连刻 | src/music/voice_lines/xiaozhang/audio/yaku_sanrenkou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_sanrenkou.mp3；/assets/yaku_sanrenkou-DuUg-6DI.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.isshoku_sanjun | yaku.isshoku_sanjun | 一色三同顺 | src/music/voice_lines/xiaozhang/audio/yaku_isshoku_sanjun.mp3 | /api/voice-packs/xiaozhang/audio/yaku_isshoku_sanjun.mp3；/assets/yaku_isshoku_sanjun-BnuuYcOa.mp3 | 是 1.65s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.one_pin_moon | yaku.one_pin_moon | 一筒摸月 | src/music/voice_lines/xiaozhang/audio/yaku_one_pin_moon.mp3 | /api/voice-packs/xiaozhang/audio/yaku_one_pin_moon.mp3；/assets/yaku_one_pin_moon-BoCWgxky.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.nine_pin_fish | yaku.nine_pin_fish | 九筒捞鱼 | src/music/voice_lines/xiaozhang/audio/yaku_nine_pin_fish.mp3 | /api/voice-packs/xiaozhang/audio/yaku_nine_pin_fish.mp3；/assets/yaku_nine_pin_fish-C-yvuuP-.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.renhou | yaku.renhou | 人和 | src/music/voice_lines/xiaozhang/audio/yaku_renhou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_renhou.mp3；/assets/yaku_renhou-BaOwkSXb.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daisharin | yaku.daisharin | 大车轮 | src/music/voice_lines/xiaozhang/audio/yaku_daisharin.mp3 | /api/voice-packs/xiaozhang/audio/yaku_daisharin.mp3；/assets/yaku_daisharin-BTww4aL_.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daichikurin | yaku.daichikurin | 大竹林 | src/music/voice_lines/xiaozhang/audio/yaku_daichikurin.mp3 | /api/voice-packs/xiaozhang/audio/yaku_daichikurin.mp3；/assets/yaku_daichikurin-iiicsERO.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daisuulin | yaku.daisuulin | 大数邻 | src/music/voice_lines/xiaozhang/audio/yaku_daisuulin.mp3 | /api/voice-packs/xiaozhang/audio/yaku_daisuulin.mp3；/assets/yaku_daisuulin-BMJrUWSE.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.suurenkou | yaku.suurenkou | 四连刻 | src/music/voice_lines/xiaozhang/audio/yaku_suurenkou.mp3 | /api/voice-packs/xiaozhang/audio/yaku_suurenkou.mp3；/assets/yaku_suurenkou-Do7U_0UR.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ishigami_sannen | yaku.ishigami_sannen | 石上三年 | src/music/voice_lines/xiaozhang/audio/yaku_ishigami_sannen.mp3 | /api/voice-packs/xiaozhang/audio/yaku_ishigami_sannen.mp3；/assets/yaku_ishigami_sannen-CsMNBhY1.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daichisei | yaku.daichisei | 大七星 | src/music/voice_lines/xiaozhang/audio/yaku_daichisei.mp3 | /api/voice-packs/xiaozhang/audio/yaku_daichisei.mp3；/assets/yaku_daichisei-t5SDKuge.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora | yaku.dora | 宝牌 | src/music/voice_lines/xiaozhang/audio/yaku_dora.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora.mp3；/assets/yaku_dora-BdbxhPnt.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_2 | yaku.dora_2 | 宝牌2 | src/music/voice_lines/xiaozhang/audio/yaku_dora_2.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_2.mp3；/assets/yaku_dora_2-_h2BXaH5.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_3 | yaku.dora_3 | 宝牌3 | src/music/voice_lines/xiaozhang/audio/yaku_dora_3.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_3.mp3；/assets/yaku_dora_3-CANRHaoL.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_4 | yaku.dora_4 | 宝牌4 | src/music/voice_lines/xiaozhang/audio/yaku_dora_4.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_4.mp3；/assets/yaku_dora_4-CloY4MpP.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_5 | yaku.dora_5 | 宝牌5 | src/music/voice_lines/xiaozhang/audio/yaku_dora_5.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_5.mp3；/assets/yaku_dora_5-mFlP32BI.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_6 | yaku.dora_6 | 宝牌6 | src/music/voice_lines/xiaozhang/audio/yaku_dora_6.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_6.mp3；/assets/yaku_dora_6-Dma_Y5Yn.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_7 | yaku.dora_7 | 宝牌7 | src/music/voice_lines/xiaozhang/audio/yaku_dora_7.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_7.mp3；/assets/yaku_dora_7-JrgfDdnK.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_8 | yaku.dora_8 | 宝牌8 | src/music/voice_lines/xiaozhang/audio/yaku_dora_8.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_8.mp3；/assets/yaku_dora_8-C-9NTLG4.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_9 | yaku.dora_9 | 宝牌9 | src/music/voice_lines/xiaozhang/audio/yaku_dora_9.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_9.mp3；/assets/yaku_dora_9-CBjSccVC.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_10 | yaku.dora_10 | 宝牌10 | src/music/voice_lines/xiaozhang/audio/yaku_dora_10.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_10.mp3；/assets/yaku_dora_10-ChWSkMP0.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_11 | yaku.dora_11 | 宝牌11 | src/music/voice_lines/xiaozhang/audio/yaku_dora_11.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_11.mp3；/assets/yaku_dora_11-CE_1s9QJ.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_12 | yaku.dora_12 | 宝牌12 | src/music/voice_lines/xiaozhang/audio/yaku_dora_12.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_12.mp3；/assets/yaku_dora_12-BLrHUMgs.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_13 | yaku.dora_13 | 宝牌13 | src/music/voice_lines/xiaozhang/audio/yaku_dora_13.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_13.mp3；/assets/yaku_dora_13-BjmFjIgG.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_many | yaku.dora_many | 宝牌一大堆 | src/music/voice_lines/xiaozhang/audio/yaku_dora_many.mp3 | /api/voice-packs/xiaozhang/audio/yaku_dora_many.mp3；/assets/yaku_dora_many-CFF-YV7v.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| 普通公开弃牌 | tile.m1 | 一万 | src/music/voice_lines/xiaozhang/audio/tile_m1.mp3 | /api/voice-packs/xiaozhang/audio/tile_m1.mp3；/assets/tile_m1-C7ikmugg.mp3 | 是 0.86s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m2 | 二万 | src/music/voice_lines/xiaozhang/audio/tile_m2.mp3 | /api/voice-packs/xiaozhang/audio/tile_m2.mp3；/assets/tile_m2-CooEZN81.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m3 | 三万 | src/music/voice_lines/xiaozhang/audio/tile_m3.mp3 | /api/voice-packs/xiaozhang/audio/tile_m3.mp3；/assets/tile_m3-9GZ5BhM3.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m4 | 四万 | src/music/voice_lines/xiaozhang/audio/tile_m4.mp3 | /api/voice-packs/xiaozhang/audio/tile_m4.mp3；/assets/tile_m4-DsHwh4Go.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m5 | 五万 | src/music/voice_lines/xiaozhang/audio/tile_m5.mp3 | /api/voice-packs/xiaozhang/audio/tile_m5.mp3；/assets/tile_m5-BJkPhXgV.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m6 | 六万 | src/music/voice_lines/xiaozhang/audio/tile_m6.mp3 | /api/voice-packs/xiaozhang/audio/tile_m6.mp3；/assets/tile_m6-DYW74JbH.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m7 | 七万 | src/music/voice_lines/xiaozhang/audio/tile_m7.mp3 | /api/voice-packs/xiaozhang/audio/tile_m7.mp3；/assets/tile_m7-CBYUigmt.mp3 | 是 0.99s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m8 | 八万 | src/music/voice_lines/xiaozhang/audio/tile_m8.mp3 | /api/voice-packs/xiaozhang/audio/tile_m8.mp3；/assets/tile_m8-CpN1amaO.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m9 | 九万 | src/music/voice_lines/xiaozhang/audio/tile_m9.mp3 | /api/voice-packs/xiaozhang/audio/tile_m9.mp3；/assets/tile_m9-DaLISHjj.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p1 | 一筒 | src/music/voice_lines/xiaozhang/audio/tile_p1.mp3 | /api/voice-packs/xiaozhang/audio/tile_p1.mp3；/assets/tile_p1-Kl7tWrBs.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p2 | 二筒 | src/music/voice_lines/xiaozhang/audio/tile_p2.mp3 | /api/voice-packs/xiaozhang/audio/tile_p2.mp3；/assets/tile_p2-eYIlPK5q.mp3 | 是 0.86s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p3 | 三筒 | src/music/voice_lines/xiaozhang/audio/tile_p3.mp3 | /api/voice-packs/xiaozhang/audio/tile_p3.mp3；/assets/tile_p3-lEZw3RXl.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p4 | 四筒 | src/music/voice_lines/xiaozhang/audio/tile_p4.mp3 | /api/voice-packs/xiaozhang/audio/tile_p4.mp3；/assets/tile_p4-WeDLooQC.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p5 | 五筒 | src/music/voice_lines/xiaozhang/audio/tile_p5.mp3 | /api/voice-packs/xiaozhang/audio/tile_p5.mp3；/assets/tile_p5-CxcAo36c.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p6 | 六筒 | src/music/voice_lines/xiaozhang/audio/tile_p6.mp3 | /api/voice-packs/xiaozhang/audio/tile_p6.mp3；/assets/tile_p6-FB7Q8vlJ.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p7 | 七筒 | src/music/voice_lines/xiaozhang/audio/tile_p7.mp3 | /api/voice-packs/xiaozhang/audio/tile_p7.mp3；/assets/tile_p7-BHq6xd81.mp3 | 是 0.99s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p8 | 八筒 | src/music/voice_lines/xiaozhang/audio/tile_p8.mp3 | /api/voice-packs/xiaozhang/audio/tile_p8.mp3；/assets/tile_p8-BKFAt6yC.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p9 | 九筒 | src/music/voice_lines/xiaozhang/audio/tile_p9.mp3 | /api/voice-packs/xiaozhang/audio/tile_p9.mp3；/assets/tile_p9-B9FH0QEk.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s1 | 幺鸡 | src/music/voice_lines/xiaozhang/audio/tile_s1.mp3 | /api/voice-packs/xiaozhang/audio/tile_s1.mp3；/assets/tile_s1-DpfbrQY3.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s2 | 二条 | src/music/voice_lines/xiaozhang/audio/tile_s2.mp3 | /api/voice-packs/xiaozhang/audio/tile_s2.mp3；/assets/tile_s2-CqFQSJnN.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s3 | 三条 | src/music/voice_lines/xiaozhang/audio/tile_s3.mp3 | /api/voice-packs/xiaozhang/audio/tile_s3.mp3；/assets/tile_s3-DwlpaGEC.mp3 | 是 0.99s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s4 | 四条 | src/music/voice_lines/xiaozhang/audio/tile_s4.mp3 | /api/voice-packs/xiaozhang/audio/tile_s4.mp3；/assets/tile_s4-BerzWAQC.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s5 | 五条 | src/music/voice_lines/xiaozhang/audio/tile_s5.mp3 | /api/voice-packs/xiaozhang/audio/tile_s5.mp3；/assets/tile_s5-D0Irm6rg.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s6 | 六条 | src/music/voice_lines/xiaozhang/audio/tile_s6.mp3 | /api/voice-packs/xiaozhang/audio/tile_s6.mp3；/assets/tile_s6-s0xUiwUX.mp3 | 是 0.86s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s7 | 七条 | src/music/voice_lines/xiaozhang/audio/tile_s7.mp3 | /api/voice-packs/xiaozhang/audio/tile_s7.mp3；/assets/tile_s7-C9OWuzv2.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s8 | 八条 | src/music/voice_lines/xiaozhang/audio/tile_s8.mp3 | /api/voice-packs/xiaozhang/audio/tile_s8.mp3；/assets/tile_s8-Dw4Ht2G_.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s9 | 九条 | src/music/voice_lines/xiaozhang/audio/tile_s9.mp3 | /api/voice-packs/xiaozhang/audio/tile_s9.mp3；/assets/tile_s9-rotf2Whc.mp3 | 是 0.99s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z1 | 东风 | src/music/voice_lines/xiaozhang/audio/tile_z1.mp3 | /api/voice-packs/xiaozhang/audio/tile_z1.mp3；/assets/tile_z1-DI3ptUom.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z2 | 南风 | src/music/voice_lines/xiaozhang/audio/tile_z2.mp3 | /api/voice-packs/xiaozhang/audio/tile_z2.mp3；/assets/tile_z2-BUFgMYnE.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z3 | 西风 | src/music/voice_lines/xiaozhang/audio/tile_z3.mp3 | /api/voice-packs/xiaozhang/audio/tile_z3.mp3；/assets/tile_z3-DPVAQ4_4.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z4 | 北风 | src/music/voice_lines/xiaozhang/audio/tile_z4.mp3 | /api/voice-packs/xiaozhang/audio/tile_z4.mp3；/assets/tile_z4-C0939xlD.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z5 | 白板 | src/music/voice_lines/xiaozhang/audio/tile_z5.mp3 | /api/voice-packs/xiaozhang/audio/tile_z5.mp3；/assets/tile_z5-B7wr3SuL.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z6 | 发财 | src/music/voice_lines/xiaozhang/audio/tile_z6.mp3 | /api/voice-packs/xiaozhang/audio/tile_z6.mp3；/assets/tile_z6-BHFAU9rV.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z7 | 红中 | src/music/voice_lines/xiaozhang/audio/tile_z7.mp3 | /api/voice-packs/xiaozhang/audio/tile_z7.mp3；/assets/tile_z7-Bf9GBQ5e.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |

### yaya · yaya-001

| 语义 | 实际key | 实际台词 | 文件 | 开发/生产URL | 可解码 | 触发时机 | 状态 | 必须补录 |
|---|---|---|---|---|---|---|---|---|
| flavor.win | flavor.win | 胜利 | src/music/voice_lines/yaya-001/audio/flavor_win.mp3 | /api/voice-packs/yaya-001/audio/flavor_win.mp3；/assets/flavor_win-DmgrAaxX.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| flavor.lose | flavor.lose | 失败 | src/music/voice_lines/yaya-001/audio/flavor_lose.mp3 | /api/voice-packs/yaya-001/audio/flavor_lose.mp3；/assets/flavor_lose-xAoAe5hL.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| flavor.close_game | flavor.close_game | 这局结束了 | src/music/voice_lines/yaya-001/audio/flavor_close_game.mp3 | /api/voice-packs/yaya-001/audio/flavor_close_game.mp3；/assets/flavor_close_game-Z91bSQME.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.start | game.start | 对局开始 | src/music/voice_lines/yaya-001/audio/game_start.mp3 | /api/voice-packs/yaya-001/audio/game_start.mp3；/assets/game_start-DEGTxfg6.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.end | game.end | 好耶！ | src/music/voice_lines/yaya-001/audio/game_end.mp3 | /api/voice-packs/yaya-001/audio/game_end.mp3；/assets/game_end-PHetnvSb.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.second_place | result.second_place | 不错不错，第二名 | src/music/voice_lines/yaya-001/audio/result_second_place.mp3 | /api/voice-packs/yaya-001/audio/result_second_place.mp3；/assets/result_second_place-bXeAdt0u.mp3 | 是 1.88s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.third_place | result.third_place | 一般一般，世界第三 | src/music/voice_lines/yaya-001/audio/result_third_place.mp3 | /api/voice-packs/yaya-001/audio/result_third_place.mp3；/assets/result_third_place-CUT2zEmX.mp3 | 是 2.80s | 不在本轮国标触发 | 国标不适用 | 否 |
| result.fourth_place | result.fourth_place | 哼，让你们一把 | src/music/voice_lines/yaya-001/audio/result_fourth_place.mp3 | /api/voice-packs/yaya-001/audio/result_fourth_place.mp3；/assets/result_fourth_place-CrESb8Bs.mp3 | 是 2.48s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tenpai | yaku.tenpai | 听牌 | src/music/voice_lines/yaya-001/audio/yaku_tenpai.mp3 | /api/voice-packs/yaya-001/audio/yaku_tenpai.mp3；/assets/yaku_tenpai-CpsLT91G.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.noten | yaku.noten | 没听 | src/music/voice_lines/yaya-001/audio/yaku_noten.mp3 | /api/voice-packs/yaya-001/audio/yaku_noten.mp3；/assets/yaku_noten-BtIvi-GE.mp3 | 是 1.28s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.draw | game.draw | 流局 | src/music/voice_lines/yaya-001/audio/game_draw.mp3 | /api/voice-packs/yaya-001/audio/game_draw.mp3；/assets/game_draw-DXcgk2Nh.mp3 | 是 1.23s | 最终权威流局 | 可复用 | 否 |
| action.ron | action.ron | 荣和 | src/music/voice_lines/yaya-001/audio/action_ron.mp3 | /api/voice-packs/yaya-001/audio/action_ron.mp3；/assets/action_ron-8jn14ZaA.mp3 | 是 1.28s | 最终权威和牌结算 | 台词不匹配 | 是 |
| action.tsumo | action.tsumo | 自摸 | src/music/voice_lines/yaya-001/audio/action_tsumo.mp3 | /api/voice-packs/yaya-001/audio/action_tsumo.mp3；/assets/action_tsumo-B9vxCKwb.mp3 | 是 1.10s | 最终权威和牌结算 | 可复用 | 否 |
| action.riichi | action.riichi | 立直 | src/music/voice_lines/yaya-001/audio/action_riichi.mp3 | /api/voice-packs/yaya-001/audio/action_riichi.mp3；/assets/action_riichi-CdZy_S8H.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| action.double_riichi | action.double_riichi | 双立直 | src/music/voice_lines/yaya-001/audio/action_double_riichi.mp3 | /api/voice-packs/yaya-001/audio/action_double_riichi.mp3；/assets/action_double_riichi-C6iEtcci.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| action.chi | action.chi | 吃 | src/music/voice_lines/yaya-001/audio/action_chi.mp3 | /api/voice-packs/yaya-001/audio/action_chi.mp3；/assets/action_chi-THm-fF0S.mp3 | 是 0.63s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.pon | action.pon | 碰 | src/music/voice_lines/yaya-001/audio/action_pon.mp3 | /api/voice-packs/yaya-001/audio/action_pon.mp3；/assets/action_pon-C9dBaG1o.mp3 | 是 1.23s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.kan | action.kan | 杠 | src/music/voice_lines/yaya-001/audio/action_kan.mp3 | /api/voice-packs/yaya-001/audio/action_kan.mp3；/assets/action_kan-DBdcTKKE.mp3 | 是 0.63s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.ankan | action.ankan | 暗杠 | src/music/voice_lines/yaya-001/audio/action_ankan.mp3 | /api/voice-packs/yaya-001/audio/action_ankan.mp3；/assets/action_ankan-DOMDbJEQ.mp3 | 是 0.76s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.kakan | action.kakan | 加杠 | src/music/voice_lines/yaya-001/audio/action_kakan.mp3 | /api/voice-packs/yaya-001/audio/action_kakan.mp3；/assets/action_kakan-Be66fWRc.mp3 | 是 0.89s | 公开已提交吃/碰/杠（非候选或加杠宣告待响应） | 可复用 | 否 |
| action.nuki | action.nuki | 拔北 | src/music/voice_lines/yaya-001/audio/action_nuki.mp3 | /api/voice-packs/yaya-001/audio/action_nuki.mp3；/assets/action_nuki-CTonOLGF.mp3 | 是 0.71s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_winds_abortive_draw | game.four_winds_abortive_draw | 四风连打 | src/music/voice_lines/yaya-001/audio/game_four_winds_abortive_draw.mp3 | /api/voice-packs/yaya-001/audio/game_four_winds_abortive_draw.mp3；/assets/game_four_winds_abortive_draw-DxGqNnot.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_kans_abortive_draw | game.four_kans_abortive_draw | 四杠散了 | src/music/voice_lines/yaya-001/audio/game_four_kans_abortive_draw.mp3 | /api/voice-packs/yaya-001/audio/game_four_kans_abortive_draw.mp3；/assets/game_four_kans_abortive_draw-BeBnandp.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.four_riichi_abortive_draw | game.four_riichi_abortive_draw | 四家立直 | src/music/voice_lines/yaya-001/audio/game_four_riichi_abortive_draw.mp3 | /api/voice-packs/yaya-001/audio/game_four_riichi_abortive_draw.mp3；/assets/game_four_riichi_abortive_draw-C88v0v6p.mp3 | 是 1.41s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.nine_terminals_and_honors_abortive_draw | game.nine_terminals_and_honors_abortive_draw | 九种九牌 | src/music/voice_lines/yaya-001/audio/game_nine_terminals_and_honors_abortive_draw.mp3 | /api/voice-packs/yaya-001/audio/game_nine_terminals_and_honors_abortive_draw.mp3；/assets/game_nine_terminals_and_honors_abortive_draw-vKsCkh16.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| game.nagashi_mangan | game.nagashi_mangan | 流局满贯 | src/music/voice_lines/yaya-001/audio/game_nagashi_mangan.mp3 | /api/voice-packs/yaya-001/audio/game_nagashi_mangan.mp3；/assets/game_nagashi_mangan-DG2B3deJ.mp3 | 是 1.72s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.mangan | score.mangan | 满贯 | src/music/voice_lines/yaya-001/audio/score_mangan.mp3 | /api/voice-packs/yaya-001/audio/score_mangan.mp3；/assets/score_mangan-9ID6qBk9.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.haneman | score.haneman | 跳满 | src/music/voice_lines/yaya-001/audio/score_haneman.mp3 | /api/voice-packs/yaya-001/audio/score_haneman.mp3；/assets/score_haneman-BynFZO50.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.baiman | score.baiman | 倍满 | src/music/voice_lines/yaya-001/audio/score_baiman.mp3 | /api/voice-packs/yaya-001/audio/score_baiman.mp3；/assets/score_baiman-Ckd9_qFB.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.sanbaiman | score.sanbaiman | 三倍满 | src/music/voice_lines/yaya-001/audio/score_sanbaiman.mp3 | /api/voice-packs/yaya-001/audio/score_sanbaiman.mp3；/assets/score_sanbaiman-D424wr59.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.counted_yakuman | score.counted_yakuman | 累计役满 | src/music/voice_lines/yaya-001/audio/score_counted_yakuman.mp3 | /api/voice-packs/yaya-001/audio/score_counted_yakuman.mp3；/assets/score_counted_yakuman-BRSSAP1h.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.yakuman | score.yakuman | 役满 | src/music/voice_lines/yaya-001/audio/score_yakuman.mp3 | /api/voice-packs/yaya-001/audio/score_yakuman.mp3；/assets/score_yakuman-CJ3ux7_1.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| score.double_yakuman | score.double_yakuman | 双倍役满 | src/music/voice_lines/yaya-001/audio/score_double_yakuman.mp3 | /api/voice-packs/yaya-001/audio/score_double_yakuman.mp3；/assets/score_double_yakuman-i9jDfvMw.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.triple_yakuman | yaku.triple_yakuman | 三倍役满 | src/music/voice_lines/yaya-001/audio/yaku_triple_yakuman.mp3 | /api/voice-packs/yaya-001/audio/yaku_triple_yakuman.mp3；/assets/yaku_triple_yakuman-BXo1h8zA.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.quadruple_yakuman | yaku.quadruple_yakuman | 四倍役满 | src/music/voice_lines/yaya-001/audio/yaku_quadruple_yakuman.mp3 | /api/voice-packs/yaya-001/audio/yaku_quadruple_yakuman.mp3；/assets/yaku_quadruple_yakuman-JdueeZv2.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.quintuple_yakuman | yaku.quintuple_yakuman | 五倍役满 | src/music/voice_lines/yaya-001/audio/yaku_quintuple_yakuman.mp3 | /api/voice-packs/yaya-001/audio/yaku_quintuple_yakuman.mp3；/assets/yaku_quintuple_yakuman-B61xCIsD.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sextuple_yakuman | yaku.sextuple_yakuman | 六倍役满 | src/music/voice_lines/yaya-001/audio/yaku_sextuple_yakuman.mp3 | /api/voice-packs/yaya-001/audio/yaku_sextuple_yakuman.mp3；/assets/yaku_sextuple_yakuman-DIY0m-Io.mp3 | 是 1.52s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.kokushi | yakuman.kokushi | 国士无双 | src/music/voice_lines/yaya-001/audio/yakuman_kokushi.mp3 | /api/voice-packs/yaya-001/audio/yakuman_kokushi.mp3；/assets/yakuman_kokushi-D2C6G_Tf.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.suuankou | yakuman.suuankou | 四暗刻 | src/music/voice_lines/yaya-001/audio/yakuman_suuankou.mp3 | /api/voice-packs/yaya-001/audio/yakuman_suuankou.mp3；/assets/yakuman_suuankou-DXcSTJfZ.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.daisangen | yakuman.daisangen | 大三元 | src/music/voice_lines/yaya-001/audio/yakuman_daisangen.mp3 | /api/voice-packs/yaya-001/audio/yakuman_daisangen.mp3；/assets/yakuman_daisangen-FE58-7RQ.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.shousuushi | yakuman.shousuushi | 小四喜 | src/music/voice_lines/yaya-001/audio/yakuman_shousuushi.mp3 | /api/voice-packs/yaya-001/audio/yakuman_shousuushi.mp3；/assets/yakuman_shousuushi-aTlzkkWV.mp3 | 是 1.78s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.daisuushi | yakuman.daisuushi | 大四喜 | src/music/voice_lines/yaya-001/audio/yakuman_daisuushi.mp3 | /api/voice-packs/yaya-001/audio/yakuman_daisuushi.mp3；/assets/yakuman_daisuushi-dFK2HlDp.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.tsuuiisou | yakuman.tsuuiisou | 字一色 | src/music/voice_lines/yaya-001/audio/yakuman_tsuuiisou.mp3 | /api/voice-packs/yaya-001/audio/yakuman_tsuuiisou.mp3；/assets/yakuman_tsuuiisou-D6DPTyDG.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.chinroutou | yakuman.chinroutou | 清老头 | src/music/voice_lines/yaya-001/audio/yakuman_chinroutou.mp3 | /api/voice-packs/yaya-001/audio/yakuman_chinroutou.mp3；/assets/yakuman_chinroutou-D_o7BcXY.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.ryuuiisou | yakuman.ryuuiisou | 绿一色 | src/music/voice_lines/yaya-001/audio/yakuman_ryuuiisou.mp3 | /api/voice-packs/yaya-001/audio/yakuman_ryuuiisou.mp3；/assets/yakuman_ryuuiisou-Cqzg6O4-.mp3 | 是 1.52s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.chuuren | yakuman.chuuren | 九莲宝灯 | src/music/voice_lines/yaya-001/audio/yakuman_chuuren.mp3 | /api/voice-packs/yaya-001/audio/yakuman_chuuren.mp3；/assets/yakuman_chuuren-Bk8_wc7D.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yakuman.suuankou_tanki | yakuman.suuankou_tanki | 四暗刻单骑 | src/music/voice_lines/yaya-001/audio/yakuman_suuankou_tanki.mp3 | /api/voice-packs/yaya-001/audio/yakuman_suuankou_tanki.mp3；/assets/yakuman_suuankou_tanki-BHo_opmK.mp3 | 是 1.83s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tenhou | yaku.tenhou | 天和 | src/music/voice_lines/yaya-001/audio/yaku_tenhou.mp3 | /api/voice-packs/yaya-001/audio/yaku_tenhou.mp3；/assets/yaku_tenhou-BpSHVfch.mp3 | 是 1.12s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chiihou | yaku.chiihou | 地和 | src/music/voice_lines/yaya-001/audio/yaku_chiihou.mp3 | /api/voice-packs/yaya-001/audio/yaku_chiihou.mp3；/assets/yaku_chiihou-DGeKH8vd.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.kokushi_13_wait | yaku.kokushi_13_wait | 国士无双十三面 | src/music/voice_lines/yaya-001/audio/yaku_kokushi_13_wait.mp3 | /api/voice-packs/yaya-001/audio/yaku_kokushi_13_wait.mp3；/assets/yaku_kokushi_13_wait-BuLYDvBp.mp3 | 是 2.19s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.suukantsu | yaku.suukantsu | 四杠子 | src/music/voice_lines/yaya-001/audio/yaku_suukantsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_suukantsu.mp3；/assets/yaku_suukantsu-DHV1EdO6.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.junsei_chuuren | yaku.junsei_chuuren | 纯正九连宝灯 | src/music/voice_lines/yaya-001/audio/yaku_junsei_chuuren.mp3 | /api/voice-packs/yaya-001/audio/yaku_junsei_chuuren.mp3；/assets/yaku_junsei_chuuren-Lmw43_9D.mp3 | 是 2.19s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.riichi | yaku.riichi | 立直 | src/music/voice_lines/yaya-001/audio/yaku_riichi.mp3 | /api/voice-packs/yaya-001/audio/yaku_riichi.mp3；/assets/yaku_riichi-D-m4OJ-j.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ippatsu | yaku.ippatsu | 一发 | src/music/voice_lines/yaya-001/audio/yaku_ippatsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_ippatsu.mp3；/assets/yaku_ippatsu-DbzL4ji2.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chankan | yaku.chankan | 抢杠 | src/music/voice_lines/yaya-001/audio/yaku_chankan.mp3 | /api/voice-packs/yaya-001/audio/yaku_chankan.mp3；/assets/yaku_chankan-DDIZvj0v.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.rinshan_kaihou | yaku.rinshan_kaihou | 岭上开花 | src/music/voice_lines/yaya-001/audio/yaku_rinshan_kaihou.mp3 | /api/voice-packs/yaya-001/audio/yaku_rinshan_kaihou.mp3；/assets/yaku_rinshan_kaihou-B0yLz4wx.mp3 | 是 2.01s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.haitei | yaku.haitei | 海底摸月 | src/music/voice_lines/yaya-001/audio/yaku_haitei.mp3 | /api/voice-packs/yaya-001/audio/yaku_haitei.mp3；/assets/yaku_haitei-C07W0Alq.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.houtei | yaku.houtei | 河底捞鱼 | src/music/voice_lines/yaya-001/audio/yaku_houtei.mp3 | /api/voice-packs/yaya-001/audio/yaku_houtei.mp3；/assets/yaku_houtei-BRx8fu5y.mp3 | 是 1.88s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ton | yaku.ton | 东 | src/music/voice_lines/yaya-001/audio/yaku_ton.mp3 | /api/voice-packs/yaya-001/audio/yaku_ton.mp3；/assets/yaku_ton-xJl762vn.mp3 | 是 0.57s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shaa | yaku.shaa | 西 | src/music/voice_lines/yaya-001/audio/yaku_shaa.mp3 | /api/voice-packs/yaya-001/audio/yaku_shaa.mp3；/assets/yaku_shaa-DDHkIn7J.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.nan | yaku.nan | 南 | src/music/voice_lines/yaya-001/audio/yaku_nan.mp3 | /api/voice-packs/yaya-001/audio/yaku_nan.mp3；/assets/yaku_nan-tEPWLi-N.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.pei | yaku.pei | 北 | src/music/voice_lines/yaya-001/audio/yaku_pei.mp3 | /api/voice-packs/yaya-001/audio/yaku_pei.mp3；/assets/yaku_pei-DzoJo9iL.mp3 | 是 0.29s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.haku | yaku.haku | 白 | src/music/voice_lines/yaya-001/audio/yaku_haku.mp3 | /api/voice-packs/yaya-001/audio/yaku_haku.mp3；/assets/yaku_haku-CmSUykJq.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.hatsu | yaku.hatsu | 发 | src/music/voice_lines/yaya-001/audio/yaku_hatsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_hatsu.mp3；/assets/yaku_hatsu-BerISU5r.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chun | yaku.chun | 中 | src/music/voice_lines/yaya-001/audio/yaku_chun.mp3 | /api/voice-packs/yaya-001/audio/yaku_chun.mp3；/assets/yaku_chun-DuSVsmzX.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.pinfu | yaku.pinfu | 平和 | src/music/voice_lines/yaya-001/audio/yaku_pinfu.mp3 | /api/voice-packs/yaya-001/audio/yaku_pinfu.mp3；/assets/yaku_pinfu-D2TQmRmu.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tanyao | yaku.tanyao | 断幺九 | src/music/voice_lines/yaya-001/audio/yaku_tanyao.mp3 | /api/voice-packs/yaya-001/audio/yaku_tanyao.mp3；/assets/yaku_tanyao-BCz9DgXJ.mp3 | 是 0.94s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.iipeikou | yaku.iipeikou | 一杯口 | src/music/voice_lines/yaya-001/audio/yaku_iipeikou.mp3 | /api/voice-packs/yaya-001/audio/yaku_iipeikou.mp3；/assets/yaku_iipeikou-Br_yrdas.mp3 | 是 0.89s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chanta | yaku.chanta | 混全带幺九 | src/music/voice_lines/yaya-001/audio/yaku_chanta.mp3 | /api/voice-packs/yaya-001/audio/yaku_chanta.mp3；/assets/yaku_chanta-DA2kT7bM.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.honroutou | yaku.honroutou | 混老头 | src/music/voice_lines/yaya-001/audio/yaku_honroutou.mp3 | /api/voice-packs/yaya-001/audio/yaku_honroutou.mp3；/assets/yaku_honroutou-0T2y2LoQ.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.toitoi | yaku.toitoi | 对对和 | src/music/voice_lines/yaya-001/audio/yaku_toitoi.mp3 | /api/voice-packs/yaya-001/audio/yaku_toitoi.mp3；/assets/yaku_toitoi-B220YkAc.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanankou | yaku.sanankou | 三暗刻 | src/music/voice_lines/yaya-001/audio/yaku_sanankou.mp3 | /api/voice-packs/yaya-001/audio/yaku_sanankou.mp3；/assets/yaku_sanankou-iINIeBzK.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanshoku | yaku.sanshoku | 三色同顺 | src/music/voice_lines/yaya-001/audio/yaku_sanshoku.mp3 | /api/voice-packs/yaya-001/audio/yaku_sanshoku.mp3；/assets/yaku_sanshoku-CSEIkc7s.mp3 | 是 1.65s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ittsu | yaku.ittsu | 一气通贯 | src/music/voice_lines/yaya-001/audio/yaku_ittsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_ittsu.mp3；/assets/yaku_ittsu-CgqssFvJ.mp3 | 是 1.41s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sankantsu | yaku.sankantsu | 三杠子 | src/music/voice_lines/yaya-001/audio/yaku_sankantsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_sankantsu.mp3；/assets/yaku_sankantsu-3qddGMhT.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanshoku_doukou | yaku.sanshoku_doukou | 三色同刻 | src/music/voice_lines/yaya-001/audio/yaku_sanshoku_doukou.mp3 | /api/voice-packs/yaya-001/audio/yaku_sanshoku_doukou.mp3；/assets/yaku_sanshoku_doukou-CbbtZ6CK.mp3 | 是 1.88s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.junchan | yaku.junchan | 纯全带幺九 | src/music/voice_lines/yaya-001/audio/yaku_junchan.mp3 | /api/voice-packs/yaya-001/audio/yaku_junchan.mp3；/assets/yaku_junchan-FzcSnyK_.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chinitsu | yaku.chinitsu | 清一色 | src/music/voice_lines/yaya-001/audio/yaku_chinitsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_chinitsu.mp3；/assets/yaku_chinitsu-BiKb7CXX.mp3 | 是 1.28s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.honitsu | yaku.honitsu | 混一色 | src/music/voice_lines/yaya-001/audio/yaku_honitsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_honitsu.mp3；/assets/yaku_honitsu-BNpWBxnr.mp3 | 是 1.31s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.chiitoitsu | yaku.chiitoitsu | 七对子 | src/music/voice_lines/yaya-001/audio/yaku_chiitoitsu.mp3 | /api/voice-packs/yaya-001/audio/yaku_chiitoitsu.mp3；/assets/yaku_chiitoitsu-DRsWPA3O.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shousangen | yaku.shousangen | 小三元 | src/music/voice_lines/yaya-001/audio/yaku_shousangen.mp3 | /api/voice-packs/yaya-001/audio/yaku_shousangen.mp3；/assets/yaku_shousangen-DgKgtHZL.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ryanpeikou | yaku.ryanpeikou | 二杯口 | src/music/voice_lines/yaya-001/audio/yaku_ryanpeikou.mp3 | /api/voice-packs/yaya-001/audio/yaku_ryanpeikou.mp3；/assets/yaku_ryanpeikou-yGVPTfsB.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.tsubamegaeshi | yaku.tsubamegaeshi | 燕返 | src/music/voice_lines/yaya-001/audio/yaku_tsubamegaeshi.mp3 | /api/voice-packs/yaya-001/audio/yaku_tsubamegaeshi.mp3；/assets/yaku_tsubamegaeshi-DY3sl9MH.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.kanfuri | yaku.kanfuri | 杠振 | src/music/voice_lines/yaya-001/audio/yaku_kanfuri.mp3 | /api/voice-packs/yaya-001/audio/yaku_kanfuri.mp3；/assets/yaku_kanfuri-Cl4kKk7q.mp3 | 是 0.76s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.shiisanpuutaa | yaku.shiisanpuutaa | 十二落抬 | src/music/voice_lines/yaya-001/audio/yaku_shiisanpuutaa.mp3 | /api/voice-packs/yaya-001/audio/yaku_shiisanpuutaa.mp3；/assets/yaku_shiisanpuutaa-CqDD85rZ.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.go_men_zei | yaku.go_men_zei | 五门齐 | src/music/voice_lines/yaya-001/audio/yaku_go_men_zei.mp3 | /api/voice-packs/yaya-001/audio/yaku_go_men_zei.mp3；/assets/yaku_go_men_zei-T7Iz5R70.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.sanrenkou | yaku.sanrenkou | 三连刻 | src/music/voice_lines/yaya-001/audio/yaku_sanrenkou.mp3 | /api/voice-packs/yaya-001/audio/yaku_sanrenkou.mp3；/assets/yaku_sanrenkou-KilrHxrT.mp3 | 是 1.88s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.isshoku_sanjun | yaku.isshoku_sanjun | 一色三同顺 | src/music/voice_lines/yaya-001/audio/yaku_isshoku_sanjun.mp3 | /api/voice-packs/yaya-001/audio/yaku_isshoku_sanjun.mp3；/assets/yaku_isshoku_sanjun-D2EstW6M.mp3 | 是 1.78s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.one_pin_moon | yaku.one_pin_moon | 一筒摸月 | src/music/voice_lines/yaya-001/audio/yaku_one_pin_moon.mp3 | /api/voice-packs/yaya-001/audio/yaku_one_pin_moon.mp3；/assets/yaku_one_pin_moon-BnTRzXh3.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.nine_pin_fish | yaku.nine_pin_fish | 九筒捞鱼 | src/music/voice_lines/yaya-001/audio/yaku_nine_pin_fish.mp3 | /api/voice-packs/yaya-001/audio/yaku_nine_pin_fish.mp3；/assets/yaku_nine_pin_fish-CSHBW8iA.mp3 | 是 1.52s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.renhou | yaku.renhou | 人和 | src/music/voice_lines/yaya-001/audio/yaku_renhou.mp3 | /api/voice-packs/yaya-001/audio/yaku_renhou.mp3；/assets/yaku_renhou-DXbt0aLM.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daisharin | yaku.daisharin | 大车轮 | src/music/voice_lines/yaya-001/audio/yaku_daisharin.mp3 | /api/voice-packs/yaya-001/audio/yaku_daisharin.mp3；/assets/yaku_daisharin-C0CU2wys.mp3 | 是 1.52s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daichikurin | yaku.daichikurin | 大竹林 | src/music/voice_lines/yaya-001/audio/yaku_daichikurin.mp3 | /api/voice-packs/yaya-001/audio/yaku_daichikurin.mp3；/assets/yaku_daichikurin-NU1RummM.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daisuulin | yaku.daisuulin | 大数邻 | src/music/voice_lines/yaya-001/audio/yaku_daisuulin.mp3 | /api/voice-packs/yaya-001/audio/yaku_daisuulin.mp3；/assets/yaku_daisuulin-CWcYJJjQ.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.suurenkou | yaku.suurenkou | 四连刻 | src/music/voice_lines/yaya-001/audio/yaku_suurenkou.mp3 | /api/voice-packs/yaya-001/audio/yaku_suurenkou.mp3；/assets/yaku_suurenkou-DHEpvce-.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.ishigami_sannen | yaku.ishigami_sannen | 石上三年 | src/music/voice_lines/yaya-001/audio/yaku_ishigami_sannen.mp3 | /api/voice-packs/yaya-001/audio/yaku_ishigami_sannen.mp3；/assets/yaku_ishigami_sannen-Cmu8vEkz.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.daichisei | yaku.daichisei | 大七星 | src/music/voice_lines/yaya-001/audio/yaku_daichisei.mp3 | /api/voice-packs/yaya-001/audio/yaku_daichisei.mp3；/assets/yaku_daichisei-BuXSNnC7.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora | yaku.dora | 宝牌 | src/music/voice_lines/yaya-001/audio/yaku_dora.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora.mp3；/assets/yaku_dora-B7xFO3Gs.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_2 | yaku.dora_2 | 宝牌2 | src/music/voice_lines/yaya-001/audio/yaku_dora_2.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_2.mp3；/assets/yaku_dora_2-CJxYnCW9.mp3 | 是 1.10s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_3 | yaku.dora_3 | 宝牌3 | src/music/voice_lines/yaya-001/audio/yaku_dora_3.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_3.mp3；/assets/yaku_dora_3-CwBWAH8j.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_4 | yaku.dora_4 | 宝牌4 | src/music/voice_lines/yaya-001/audio/yaku_dora_4.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_4.mp3；/assets/yaku_dora_4-0spQh3pP.mp3 | 是 1.28s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_5 | yaku.dora_5 | 宝牌5 | src/music/voice_lines/yaya-001/audio/yaku_dora_5.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_5.mp3；/assets/yaku_dora_5-CaIi0_iZ.mp3 | 是 1.36s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_6 | yaku.dora_6 | 宝牌6 | src/music/voice_lines/yaya-001/audio/yaku_dora_6.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_6.mp3；/assets/yaku_dora_6-CLXDoru5.mp3 | 是 1.59s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_7 | yaku.dora_7 | 宝牌7 | src/music/voice_lines/yaya-001/audio/yaku_dora_7.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_7.mp3；/assets/yaku_dora_7-GBsEkHkj.mp3 | 是 1.04s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_8 | yaku.dora_8 | 宝牌8 | src/music/voice_lines/yaya-001/audio/yaku_dora_8.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_8.mp3；/assets/yaku_dora_8-Q7I6TkiD.mp3 | 是 1.18s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_9 | yaku.dora_9 | 宝牌9 | src/music/voice_lines/yaya-001/audio/yaku_dora_9.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_9.mp3；/assets/yaku_dora_9-DnOT3zU3.mp3 | 是 1.54s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_10 | yaku.dora_10 | 宝牌10 | src/music/voice_lines/yaya-001/audio/yaku_dora_10.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_10.mp3；/assets/yaku_dora_10-vkiSRpfB.mp3 | 是 1.23s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_11 | yaku.dora_11 | 宝牌11 | src/music/voice_lines/yaya-001/audio/yaku_dora_11.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_11.mp3；/assets/yaku_dora_11-DUFRdwqz.mp3 | 是 1.70s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_12 | yaku.dora_12 | 宝牌12 | src/music/voice_lines/yaya-001/audio/yaku_dora_12.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_12.mp3；/assets/yaku_dora_12-Dry771bn.mp3 | 是 1.28s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_13 | yaku.dora_13 | 宝牌13 | src/music/voice_lines/yaya-001/audio/yaku_dora_13.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_13.mp3；/assets/yaku_dora_13-CUZ-aL1w.mp3 | 是 1.46s | 不在本轮国标触发 | 国标不适用 | 否 |
| yaku.dora_many | yaku.dora_many | 宝牌一大堆 | src/music/voice_lines/yaya-001/audio/yaku_dora_many.mp3 | /api/voice-packs/yaya-001/audio/yaku_dora_many.mp3；/assets/yaku_dora_many-BiirXShk.mp3 | 是 1.78s | 不在本轮国标触发 | 国标不适用 | 否 |
| 普通公开弃牌 | tile.m1 | 一万 | src/music/voice_lines/yaya-001/audio/tile_m1.mp3 | /api/voice-packs/yaya-001/audio/tile_m1.mp3；/assets/tile_m1-B2QJO1vp.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m2 | 二万 | src/music/voice_lines/yaya-001/audio/tile_m2.mp3 | /api/voice-packs/yaya-001/audio/tile_m2.mp3；/assets/tile_m2-Di6zdVAl.mp3 | 是 0.71s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m3 | 三万 | src/music/voice_lines/yaya-001/audio/tile_m3.mp3 | /api/voice-packs/yaya-001/audio/tile_m3.mp3；/assets/tile_m3-C9QFjEhA.mp3 | 是 0.86s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m4 | 四万 | src/music/voice_lines/yaya-001/audio/tile_m4.mp3 | /api/voice-packs/yaya-001/audio/tile_m4.mp3；/assets/tile_m4-BC9GpHbt.mp3 | 是 1.36s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m5 | 五万 | src/music/voice_lines/yaya-001/audio/tile_m5.mp3 | /api/voice-packs/yaya-001/audio/tile_m5.mp3；/assets/tile_m5-1PmNXd7P.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m6 | 六万 | src/music/voice_lines/yaya-001/audio/tile_m6.mp3 | /api/voice-packs/yaya-001/audio/tile_m6.mp3；/assets/tile_m6-T87rXlVv.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m7 | 七万 | src/music/voice_lines/yaya-001/audio/tile_m7.mp3 | /api/voice-packs/yaya-001/audio/tile_m7.mp3；/assets/tile_m7-kI-t3OEE.mp3 | 是 0.86s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m8 | 八万 | src/music/voice_lines/yaya-001/audio/tile_m8.mp3 | /api/voice-packs/yaya-001/audio/tile_m8.mp3；/assets/tile_m8-B3oj8YE7.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.m9 | 九万 | src/music/voice_lines/yaya-001/audio/tile_m9.mp3 | /api/voice-packs/yaya-001/audio/tile_m9.mp3；/assets/tile_m9-DHjA7ZKR.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p1 | 一筒 | src/music/voice_lines/yaya-001/audio/tile_p1.mp3 | /api/voice-packs/yaya-001/audio/tile_p1.mp3；/assets/tile_p1-nWqM-R0-.mp3 | 是 0.81s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p2 | 二筒 | src/music/voice_lines/yaya-001/audio/tile_p2.mp3 | /api/voice-packs/yaya-001/audio/tile_p2.mp3；/assets/tile_p2-D02e53Nw.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p3 | 三筒 | src/music/voice_lines/yaya-001/audio/tile_p3.mp3 | /api/voice-packs/yaya-001/audio/tile_p3.mp3；/assets/tile_p3-BKuhBWO4.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p4 | 四筒 | src/music/voice_lines/yaya-001/audio/tile_p4.mp3 | /api/voice-packs/yaya-001/audio/tile_p4.mp3；/assets/tile_p4-9XID_zgw.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p5 | 五筒 | src/music/voice_lines/yaya-001/audio/tile_p5.mp3 | /api/voice-packs/yaya-001/audio/tile_p5.mp3；/assets/tile_p5-C-1SDLI5.mp3 | 是 0.68s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p6 | 六筒 | src/music/voice_lines/yaya-001/audio/tile_p6.mp3 | /api/voice-packs/yaya-001/audio/tile_p6.mp3；/assets/tile_p6-DjCsfJwe.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p7 | 七筒 | src/music/voice_lines/yaya-001/audio/tile_p7.mp3 | /api/voice-packs/yaya-001/audio/tile_p7.mp3；/assets/tile_p7-DHSHf4uC.mp3 | 是 0.81s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p8 | 八筒 | src/music/voice_lines/yaya-001/audio/tile_p8.mp3 | /api/voice-packs/yaya-001/audio/tile_p8.mp3；/assets/tile_p8-Bz3SQNrE.mp3 | 是 0.63s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.p9 | 九筒 | src/music/voice_lines/yaya-001/audio/tile_p9.mp3 | /api/voice-packs/yaya-001/audio/tile_p9.mp3；/assets/tile_p9-KOVsTOjg.mp3 | 是 0.94s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s1 | 幺鸡 | src/music/voice_lines/yaya-001/audio/tile_s1.mp3 | /api/voice-packs/yaya-001/audio/tile_s1.mp3；/assets/tile_s1-COmm3bAv.mp3 | 是 1.23s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s2 | 二条 | src/music/voice_lines/yaya-001/audio/tile_s2.mp3 | /api/voice-packs/yaya-001/audio/tile_s2.mp3；/assets/tile_s2-C3elJ9Gu.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s3 | 三条 | src/music/voice_lines/yaya-001/audio/tile_s3.mp3 | /api/voice-packs/yaya-001/audio/tile_s3.mp3；/assets/tile_s3-Cpymn8Cq.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s4 | 四条 | src/music/voice_lines/yaya-001/audio/tile_s4.mp3 | /api/voice-packs/yaya-001/audio/tile_s4.mp3；/assets/tile_s4-DFzlx9xS.mp3 | 是 1.41s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s5 | 五条 | src/music/voice_lines/yaya-001/audio/tile_s5.mp3 | /api/voice-packs/yaya-001/audio/tile_s5.mp3；/assets/tile_s5-Ck8RdJbM.mp3 | 是 1.12s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s6 | 六条 | src/music/voice_lines/yaya-001/audio/tile_s6.mp3 | /api/voice-packs/yaya-001/audio/tile_s6.mp3；/assets/tile_s6-yszlxjy5.mp3 | 是 1.41s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s7 | 七条 | src/music/voice_lines/yaya-001/audio/tile_s7.mp3 | /api/voice-packs/yaya-001/audio/tile_s7.mp3；/assets/tile_s7-CDcD2LbO.mp3 | 是 1.23s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s8 | 八条 | src/music/voice_lines/yaya-001/audio/tile_s8.mp3 | /api/voice-packs/yaya-001/audio/tile_s8.mp3；/assets/tile_s8-QKbGfvR1.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.s9 | 九条 | src/music/voice_lines/yaya-001/audio/tile_s9.mp3 | /api/voice-packs/yaya-001/audio/tile_s9.mp3；/assets/tile_s9-d0SOXAJ9.mp3 | 是 1.12s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z1 | 东风 | src/music/voice_lines/yaya-001/audio/tile_z1.mp3 | /api/voice-packs/yaya-001/audio/tile_z1.mp3；/assets/tile_z1-bb8Wwsn9.mp3 | 是 0.86s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z2 | 南风 | src/music/voice_lines/yaya-001/audio/tile_z2.mp3 | /api/voice-packs/yaya-001/audio/tile_z2.mp3；/assets/tile_z2-DRu9JEil.mp3 | 是 1.36s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z3 | 西风 | src/music/voice_lines/yaya-001/audio/tile_z3.mp3 | /api/voice-packs/yaya-001/audio/tile_z3.mp3；/assets/tile_z3-CWvc2Btx.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z4 | 北风 | src/music/voice_lines/yaya-001/audio/tile_z4.mp3 | /api/voice-packs/yaya-001/audio/tile_z4.mp3；/assets/tile_z4-_70IZyz-.mp3 | 是 0.89s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z5 | 白板 | src/music/voice_lines/yaya-001/audio/tile_z5.mp3 | /api/voice-packs/yaya-001/audio/tile_z5.mp3；/assets/tile_z5-OFwE-OCq.mp3 | 是 0.76s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z6 | 发财 | src/music/voice_lines/yaya-001/audio/tile_z6.mp3 | /api/voice-packs/yaya-001/audio/tile_z6.mp3；/assets/tile_z6-BnUavkwv.mp3 | 是 1.10s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
| 普通公开弃牌 | tile.z7 | 红中 | src/music/voice_lines/yaya-001/audio/tile_z7.mp3 | /api/voice-packs/yaya-001/audio/tile_z7.mp3；/assets/tile_z7-B3dLn2Hn.mp3 | 是 1.04s | 权威公开弃牌（手动/AI/自动/超时） | 可复用 | 否 |
