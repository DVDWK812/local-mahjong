# Phase 7A：114 条 VoiceLine 游戏事件覆盖审计

审计对象：`src/music/voice_lines/mahjong_voice_lines.csv`（114 条）。

## 结论

| 分类 | 数量 | 含义 |
| --- | ---: | --- |
| A. 已接入 | 6 | 已由 `PresentationEvent → VoiceEvent` 实际播放。 |
| B. 有可靠游戏语义，尚未接入 | 100 | 有权威状态/结算来源；应先补语义事件或稳定代码，不能从中文台词推断。 |
| C. 无可靠独立触发点 / flavor | 8 | 目前不应接入。 |

当前接入链路是 `GamePresentationEventObserver.observe()` → `PresentationEventBus` → `voiceEventFromPresentation()` → `VoiceDirector`。它只覆盖 `riichi_declared`、`meld_declared`、`win_declared` 的六种 key。

## A. 已接入（6）

| key | 当前权威事件 | actorId | 优先级 |
| --- | --- | --- | ---: |
| `action.riichi` | `riichi_declared` | `event.playerId` | 80 |
| `action.ron` | `win_declared(winType=ron)` | `winner.winner` | 100 |
| `action.tsumo` | `win_declared(winType=tsumo)` | `winner.winner` | 100 |
| `action.chi` | `meld_declared(meldType=chi)` | `call.playerId` | 70 |
| `action.pon` | `meld_declared(meldType=pon)` | `call.playerId` | 70 |
| `action.kan` | `meld_declared(meldType=kan)` | `call.playerId` | 70 |

## B. 有可靠游戏语义但尚未接入（100）

### B1. 宣言与杠细分（3）

| key | 推荐 semantic event | 权威触发位置 | actorId | 建议优先级 | 同时发生风险 |
| --- | --- | --- | --- | ---: | --- |
| `action.double_riichi` | `riichi_declared { kind: 'double-riichi' }` | `GamePresentationEventObserver.observe()` 读取 `player.riichiState.kind`；源状态由 `declareRiichi()` 设置 | 立直玩家 `player.id` | 80 | 与 `action.riichi` 互斥；不能两个都播。 |
| `action.ankan` | `kan_declared { kanType: 'ankan' }` | `GamePresentationEventObserver.observe()` 读取新增 `CallSet.kanType` | 杠玩家 `player.id` | 70 | 与泛化 `action.kan` 互斥。 |
| `action.kakan` | `kan_declared { kanType: 'kakan' }` | 同上 | 杠玩家 `player.id` | 70 | 与泛化 `action.kan` 互斥；之后可能紧接抢杠。 |

### B2. 开局、流局与中止流局（7）

| key | 推荐 semantic event | 权威触发位置 | actorId | 建议优先级 | 同时发生风险 |
| --- | --- | --- | --- | ---: | --- |
| `game.start` | `match_started` | 启动对局命令完成 `startMatch()` / `createActiveGame()` 后；不是 React render | 新局 `gameState.dealer`，或全局事件无 actor | 50 | 仅与开局音乐并行；不与动作语音并发。 |
| `game.end` | `match_finalized { rank: 1 }` | `completeCurrentMatch()` 产生 `MatchState.finalResult` | `FinalPlayerResult.player` | 55 | 四名最终排名同时可用；当前单声道不应一次播四条。 |
| `game.draw` | `round_settled { type: 'exhaustive-draw' }` | `settleExhaustiveDraw()` 的 `GameState.result`，经 Presentation observer 发布 | 无单一 actor；使用 `undefined` 走默认 Pack | 85 | 与听牌/未听结果同帧；应选一条摘要或后续队列。 |
| `game.four_winds_abortive_draw` | `round_settled { type: 'abortive-draw', reason: 'suufon-renda' }` | `checkAbortiveDrawAfterDiscard()` → `buildAbortiveDrawResult()` | `result.triggeringPlayer` | 85 | 紧接第四次弃牌；可盖过低优先级动作。 |
| `game.four_kans_abortive_draw` | `round_settled { reason: 'suukan-sanra' }` | 同上 | `result.triggeringPlayer` | 85 | 可紧接 `action.kan`；应允许中止流局覆盖它。 |
| `game.four_riichi_abortive_draw` | `round_settled { reason: 'suucha-riichi' }` | 同上 | `result.triggeringPlayer` | 85 | 与第四家立直同轮；覆盖 `action.riichi`。 |
| `game.nine_terminals_and_honors_abortive_draw` | `round_settled { reason: 'kyuushu-kyuuhai' }` | `declareKyuushuKyuuhai()` | `result.declaredBy` | 85 | 该声明本身是唯一动作；无现有语音冲突。 |

### B3. 最终排名（3）

| key | 推荐 semantic event | 权威触发位置 | actorId | 建议优先级 | 同时发生风险 |
| --- | --- | --- | --- | ---: | --- |
| `result.second_place` | `match_finalized { rank: 2 }` | `MatchState.finalResult.players`（来自 `completeCurrentMatch()`） | 对应 `FinalPlayerResult.player` | 55 | 与其余三名排名同时生成；需串行队列或只播一个结果。 |
| `result.third_place` | `match_finalized { rank: 3 }` | 同上 | 同上 | 55 | 同上。 |
| `result.fourth_place` | `match_finalized { rank: 4 }` | 同上 | 同上 | 55 | 同上。 |

### B4. 满贯、役满与多倍役满（11）

这些 key 都应由一个 `win_scored` 语义事件承载。权威计算在 `canTsumo()` / `canRon()` 取得的 `ScoreResult`；建议把稳定的 `limitTier` 与 `yakumanMultiplier` 写入 `WinResultEntry`，再由结算 observer 发布。不要根据 `line` 或中文展示名反推。

| key | 推荐 semantic event 条件 | actorId | 建议优先级 | 同时发生风险 |
| --- | --- | --- | ---: | --- |
| `score.mangan` | `limitTier='mangan'`（含切上满贯策略） | 每名 `winner.winner` | 90 | 与和牌动作及役种明细同一结算。 |
| `score.haneman` | `limitTier='haneman'` | 同上 | 90 | 同上。 |
| `score.baiman` | `limitTier='baiman'` | 同上 | 90 | 同上。 |
| `score.sanbaiman` | `limitTier='sanbaiman'` | 同上 | 90 | 同上。 |
| `score.counted_yakuman` | `limitTier='counted-yakuman'` | 同上 | 95 | 与役满倍数、役种明细冲突。 |
| `score.yakuman` | `yakumanMultiplier=1` | 同上 | 95 | 同上。 |
| `score.double_yakuman` | `yakumanMultiplier=2` | 同上 | 95 | 同上。 |
| `yaku.triple_yakuman` | `yakumanMultiplier=3` | 同上 | 95 | 同上。 |
| `yaku.quadruple_yakuman` | `yakumanMultiplier=4` | 同上 | 95 | 同上。 |
| `yaku.quintuple_yakuman` | `yakumanMultiplier=5` | 同上 | 95 | 同上。 |
| `yaku.sextuple_yakuman` | `yakumanMultiplier=6` | 同上 | 95 | 同上。 |

当前 `VoiceDirector` 没有结算语音队列；若这些事件与 `action.ron` / `action.tsumo` 同时发布，优先级 90 会被 100 的和牌动作忽略。建议先定义“和牌动作完成后再播一条结算摘要”的调度规则，而非同帧全部发布。

### B5. 役种：常规、特殊与役牌（35）

共同推荐事件：`win_scored { yakuIds: readonly YakuId[] }`。权威数据为 `canTsumo()` / `canRon()` 中 `ScoreResult.yaku`，随后存在 `WinRoundResult.winners[].yaku`。当前 `YakuResult` 只有展示 `name`，实施前应在 `src/game/score/yaku/types.ts` 增加稳定 `id`（或构建等价的非展示层 adapter）；**不得依赖中文 name/line 比较**。actor 均为该条 `winner.winner`；建议优先级均为 90，且与和牌动作、满贯/役满、其他役种同时发生，必须采用“每次和牌最多选择一条细节”的策略或未来队列。

| key | 语义来源 / 建议稳定 yakuId |
| --- | --- |
| `yaku.riichi` | `riichi` |
| `yaku.ippatsu` | `ippatsu` |
| `yaku.chankan` | `chankan` |
| `yaku.rinshan_kaihou` | `rinshan-kaihou` |
| `yaku.haitei` | `haitei` |
| `yaku.houtei` | `houtei` |
| `yaku.pinfu` | `pinfu` |
| `yaku.tanyao` | `tanyao` |
| `yaku.iipeikou` | `iipeikou` |
| `yaku.chanta` | `chanta` |
| `yaku.honroutou` | `honroutou` |
| `yaku.toitoi` | `toitoi` |
| `yaku.sanankou` | `sanankou` |
| `yaku.sanshoku` | `sanshoku-doujun` |
| `yaku.ittsu` | `ittsu` |
| `yaku.sankantsu` | `sankantsu` |
| `yaku.sanshoku_doukou` | `sanshoku-doukou` |
| `yaku.junchan` | `junchan` |
| `yaku.chinitsu` | `chinitsu` |
| `yaku.honitsu` | `honitsu` |
| `yaku.chiitoitsu` | `chiitoitsu` |
| `yaku.shousangen` | `shousangen` |
| `yaku.ryanpeikou` | `ryanpeikou` |
| `yaku.tenhou` | `tenhou` |
| `yaku.chiihou` | `chiihou` |
| `yaku.kokushi_13_wait` | `kokushi-13-wait` |
| `yaku.suukantsu` | `suukantsu` |
| `yaku.junsei_chuuren` | `junsei-chuuren` |
| `yaku.ton` | `yakuhai` + source tile `east` |
| `yaku.shaa` | `yakuhai` + source tile `west` |
| `yaku.nan` | `yakuhai` + source tile `south` |
| `yaku.pei` | `yakuhai` + source tile `north` |
| `yaku.haku` | `yakuhai` + source tile `white` |
| `yaku.hatsu` | `yakuhai` + source tile `green` |
| `yaku.chun` | `yakuhai` + source tile `red` |

### B6. 正统役满（10）

共同语义、权威位置、actor 与并发规则同 B5：`win_scored.yakuIds`、`canTsumo()` / `canRon()` 的 `ScoreResult.yaku`、赢家、优先级 95。它们同时也会匹配 B4 的倍数语音，二者必须选其一或串行。

`yakuman.kokushi`、`yakuman.suuankou`、`yakuman.daisangen`、`yakuman.shousuushi`、`yakuman.daisuushi`、`yakuman.tsuuiisou`、`yakuman.chinroutou`、`yakuman.ryuuiisou`、`yakuman.chuuren`、`yakuman.suuankou_tanki`。

### B7. 宝牌计数（14）

共同推荐事件为 `win_scored { totalDora }`；权威数据为 `WinResultEntry.dora + uraDora + redDora`（源自 `ScoreResult`）。actor 是赢家；建议优先级 75；它会与所有和牌、役种及 limit 事件同时发生，因此不应在第一批与役种逐条同时播。

`yaku.dora`、`yaku.dora_2`、`yaku.dora_3`、`yaku.dora_4`、`yaku.dora_5`、`yaku.dora_6`、`yaku.dora_7`、`yaku.dora_8`、`yaku.dora_9`、`yaku.dora_10`、`yaku.dora_11`、`yaku.dora_12`、`yaku.dora_13`、`yaku.dora_many`。

`dora_many` 的阈值目前没有领域定义，故在接入前必须明确为 `totalDora >= 14`（或写入规则配置）；不能由文本猜测。

### B8. 听牌 / 未听（2）

| key | 推荐 semantic event | 权威触发位置 | actorId | 建议优先级 | 同时发生风险 |
| --- | --- | --- | --- | ---: | --- |
| `yaku.tenpai` | `exhaustive_draw_player_status { status: 'tenpai' }` | `buildExhaustiveDrawResult().tenpaiPlayers` | 列表内的 playerId | 45 | 多家可同时听牌，且与 `game.draw` 同帧。 |
| `yaku.noten` | `exhaustive_draw_player_status { status: 'noten' }` | `buildExhaustiveDrawResult().notenPlayers` | 列表内的 playerId | 45 | 多家可同时未听；同上。 |

### B9. 古役（14）

`yaku.tsubamegaeshi`、`yaku.kanfuri`、`yaku.shiisanpuutaa`、`yaku.go_men_zei`、`yaku.sanrenkou`、`yaku.isshoku_sanjun`、`yaku.one_pin_moon`、`yaku.nine_pin_fish`、`yaku.renhou`、`yaku.daisharin`、`yaku.daichikurin`、`yaku.daisuulin`、`yaku.suurenkou`、`yaku.ishigami_sannen`、`yaku.daichisei`。

> 上列实际为 15 条（CSV 的古役尾段共 15 条）。它们与 B5 同样使用 `win_scored.yakuIds`：权威来源是 `checkAncientYaku()` / `checkYakuman()`，且受 `allowAncientYaku` 等规则开关控制；actor 是赢家；建议优先级 90（役满结果为 95）；与和牌、其他役种和 limit 同时发生。实施时必须给古役结果稳定 ID，不能用展示名称匹配。

## C. 当前无可靠独立触发点 / flavor（5）

| key | 原因 | 处理建议 |
| --- | --- | --- |
| `action.nuki` | 当前标准四人引擎没有北拔/三麻 nuki 状态转换或事件。 | 等三麻规则与 `north_extracted` 领域动作完成后再接。 |
| `game.nagashi_mangan` | `ExhaustiveDrawResult` 仅预留 `nagashiManganPlayers?`，当前没有检测或结算实现。 | 等检测、结算和赢家 actor 均落地后再接。 |
| `flavor.win` | 只有情绪标签，没有不歧义的游戏语义。 | 未来由产品定义为哪种胜利/何时触发。 |
| `flavor.lose` | 同上。 | 同上。 |
| `flavor.close_game` | 同上；退出菜单不等于对局结算。 | 未来明确是否仅在 final result 后播。 |

## 推荐实施批次（不在本审计中实施）

1. **批次 1：低风险动作细分** — 扩展现有 PresentationEvent payload，接 `action.double_riichi`、`action.ankan`、`action.kakan`；保证分别替换普通立直/杠，而不是叠播。
2. **批次 2：轮结果事件** — 以 `GameState.result` 形成一次性 `round_settled`，先接 `game.draw` 和四种中止流局；明确全局事件没有 actor 时使用默认 Pack。
3. **批次 3：结算数据规范化** — 在评分层给 `YakuResult`、limit tier、yakuman multiplier 增加稳定语义 code，并传入 `WinResultEntry`；先接一条“和牌细节选择策略”，不要立刻播全部役种/宝牌。
4. **批次 4：役种与役满** — 在有队列或明确“每次和牌只读一条”的政策后，按 stable yakuId 接 B5/B6/B9；同时覆盖满贯至六倍役满。
5. **批次 5：终局与排名** — 对 `MatchState.finalResult` 增加非 render 的 match presentation event；先决定四名排名是串行播报、只播本地玩家，还是只播冠军。

## 实施约束

- 语义映射只能来自领域状态、stable id 与规则配置，不能检查 `line`、`tts_text` 或中文展示名。
- 事件应由状态转换/Presentation observer 发布，绝不在 React render 中触发。
- 多人荣和、多役种、宝牌、流局听牌与最终排名都可能同帧；当前 VoiceDirector 是单声道优先级抢占模型，新增细节语音前必须先定义选择或队列策略。
