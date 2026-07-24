# Scoring Audit

Project: `C:\Users\Wenkai\Desktop\UNSW\local mahjong`

Scope: yaku, han, fu, point calculation, real `PlayerState`/call context scoring, call visualization, abortive draw handling, and match-level progression.

## Verification Snapshot

- `npm test`: passed, 45 test files, 255 passed, 0 skipped.
- `npm run build`: passed.
- Compatibility entry `src/game/scoreCalculator.ts` is preserved.
- No changes were made to `shanten.ts`, `ukeire.ts`, `recommendDiscards.ts`, or AI discard recommendation ranking.

## RuleConfig

| Option | Default | Status | Notes |
|---|---:|---|---|
| `allowAncientYaku` | `false` | Implemented | Enables optional ancient yaku. |
| `allowDoubleYakuman` | `true` | Implemented | Downgrades double yakuman patterns when disabled. |
| `multipleYakuman` | `true` | Implemented | Controls accumulated yakuman. |
| `akaDora` | `true` | Implemented | Enables red dora counting. |
| `ippatsu` | `true` | Implemented | Enables ippatsu. |
| `doubleWindPairFu` | `true` | Implemented | Double wind pair scores 4 fu when true, 2 fu when false. |
| `allowOpenTanyao` | `true` | Implemented | Controls open tanyao. |
| `kiriageMangan` | `false` | Implemented | Optional 4 han 30 fu / 3 han 60 fu mangan upgrade. |
| `kazoeYakumanMode` | `yakuman` | Implemented | Supports `yakuman`, `sanbaiman`, and `disabled`. |
| `allowKyuushuKyuuhai` | `true` | Implemented | Enables nine terminals abortive draw declaration. |
| `abortOnFourWinds` | `true` | Implemented | Enables four identical first wind discards abort. |
| `abortOnFourRiichi` | `true` | Implemented | Enables four riichi abort. |
| `abortOnFourKans` | `true` | Implemented | Enables four kan abort by two or more players. |
| `tripleRonMode` | `allow` | Implemented | Supports normal triple ron or abortive draw. |
| `allowKokushiChankanAnkan` | `false` | Configured | Reserved for kokushi robbing closed kan rule; default keeps ankan closed. |
| `dealerContinuesOnTenpaiDraw` | `true` | Implemented | Dealer repeats on exhaustive draw when dealer is tenpai. |
| `revealTenpaiHandsOnDraw` | `true` | Implemented | Exhaustive draw result records tenpai hand reveal candidates. |

## Modern Yaku Coverage

### 1 Han

| Yaku | Status | Closed Han | Open Han | Closed Only | RuleConfig |
|---|---|---:|---:|---|---|
| Riichi | Implemented | 1 | - | Yes | No |
| Ippatsu | Implemented | 1 | - | Yes | `ippatsu` |
| Menzen tsumo | Implemented | 1 | - | Yes | No |
| Tanyao | Implemented | 1 | 1 | No | `allowOpenTanyao` |
| Pinfu | Implemented | 1 | - | Yes | No |
| Iipeikou | Implemented | 1 | - | Yes | No |
| Yakuhai: round wind | Implemented | 1 | 1 | No | No |
| Yakuhai: seat wind | Implemented | 1 | 1 | No | No |
| Yakuhai: white | Implemented | 1 | 1 | No | No |
| Yakuhai: green | Implemented | 1 | 1 | No | No |
| Yakuhai: red | Implemented | 1 | 1 | No | No |
| Haitei raoyue | Implemented | 1 | 1 | No | Context flag |
| Houtei raoyui | Implemented | 1 | 1 | No | Context flag |
| Rinshan kaihou | Implemented | 1 | 1 | No | Context flag |
| Chankan | Implemented | 1 | 1 | No | Full kakan interruption flow |

### 2 Han

| Yaku | Status | Closed Han | Open Han | Closed Only | RuleConfig |
|---|---|---:|---:|---|---|
| Double riichi | Implemented | 2 | - | Yes | First-turn context |
| Chiitoitsu | Implemented | 2 | - | Yes | No |
| Toitoi | Implemented | 2 | 2 | No | No |
| Sanankou | Implemented | 2 | 2 | No | Provenance-aware concealed triplet/kan counting |
| Sanshoku doukou | Implemented | 2 | 2 | No | No |
| Sankantsu | Implemented | 2 | 2 | No | Uses real kan melds/scoring shapes |
| Shousangen | Implemented | 2 | 2 | No | Suppressed when daisangen applies |
| Honroutou | Implemented | 2 | 2 | No | No |
| Sanshoku doujun | Implemented | 2 | 1 | No | Open hand loses one han |
| Ittsu | Implemented | 2 | 1 | No | Open hand loses one han |
| Chanta | Implemented | 2 | 1 | No | Suppressed when junchan applies |

### 3 Han

| Yaku | Status | Closed Han | Open Han | Closed Only | RuleConfig |
|---|---|---:|---:|---|---|
| Ryanpeikou | Implemented | 3 | - | Yes | No |
| Junchan | Implemented | 3 | 2 | No | Open hand loses one han |
| Honitsu | Implemented | 3 | 2 | No | Open hand loses one han |

### 6 Han

| Yaku | Status | Closed Han | Open Han | Closed Only | RuleConfig |
|---|---|---:|---:|---|---|
| Chinitsu | Implemented | 6 | 5 | No | Open hand loses one han |

## Yakuman Coverage

| Yakuman | Status | Yakuman Value | RuleConfig |
|---|---|---:|---|
| Tenhou | Implemented | 1 | Initial dealer tsumo context |
| Chiihou | Implemented | 1 | Uninterrupted first-turn child tsumo context |
| Kokushi musou | Implemented | 1 | No |
| Suuankou | Implemented | 1 | No |
| Daisangen | Implemented | 1 | No |
| Shousuushii | Implemented | 1 | No |
| Tsuuiisou | Implemented | 1 | No |
| Ryuuiisou | Implemented | 1 | No |
| Chinroutou | Implemented | 1 | No |
| Chuuren poutou | Implemented | 1 | No |
| Suukantsu | Implemented | 1 | Uses real kan melds |

## Double Yakuman Coverage

| Double Yakuman | Status | Yakuman Value | RuleConfig |
|---|---|---:|---|
| Kokushi musou 13-sided | Implemented | 2 when enabled | `allowDoubleYakuman` |
| Suuankou tanki | Implemented | 2 when enabled | `allowDoubleYakuman` |
| Daisuushii | Implemented | 2 when enabled | `allowDoubleYakuman` |
| Pure chuuren 9-sided | Implemented | 2 when enabled | `allowDoubleYakuman` |

## Ancient Yaku

Ancient yaku are optional and only evaluated when `allowAncientYaku=true`.

Implemented: renhou, daisharin, daichikurin, daisuurin, sanrenkou, suurenkou, isshoku sanjun, chiisei puutao, shiisan puuta.

## Fu And Real Context

Implemented and tested:

- Base 20 fu, closed ron +10, tsumo +2.
- Pinfu tsumo fixed 20 fu and closed ron pinfu fixed 30 fu.
- Chiitoitsu fixed 25 fu without rounding.
- Open pinfu-shaped ron minimum 30 fu.
- Ryanmen 0 fu; kanchan, penchan, tanki +2 fu; shanpon wait itself 0 fu.
- Dragon, seat wind, round wind, and configurable double wind pair fu.
- Open/closed triplets and open/closed kans for simple and yaochu tiles.
- Ron shanpon winning triplet is scored open; tsumo shanpon winning triplet is scored closed.
- Chi is passed as an open sequence, pon as an open triplet, ankan as a closed kan, minkan/kakan as open kan.
- Ankan does not break menzen status.
- Wait classification uses the pre-win 13-tile tenpai hand, fixed melds, and each legal decomposition.
- Multi-decomposition scoring evaluates all legal decompositions and chooses the highest final payment with stable tie-breaking.
- Sanankou detection is provenance-aware: concealed hand triplets, ankan, ron shanpon, tsumo shanpon, pon, minkan, and kakan are distinguished per decomposition.

## Chankan

Implemented:

- Kakan declaration opens a chankan window before the pon is upgraded.
- Eligible ron players are computed using the added tile and `winningTileSource: 'kakan'`.
- Chankan ron cancels the kakan, keeps the original pon, does not add a kan, does not reveal a kan dora, does not draw rinshan, and enters normal ron settlement.
- If all eligible players pass, the kakan resolves, the added tile is removed from the hand, the pon upgrades to kakan, kan dora is revealed, and the player draws from rinshan.
- AI players declare legal chankan by default and otherwise pass.

## Exhaustive Draw

Implemented:

- Normal live wall exhaustion is separate from special abortive draws.
- Last tile tsumo is checked before exhaustive draw.
- Last discard ron and houtei are checked before exhaustive draw.
- Pending call and chankan windows resolve before exhaustive draw settlement.
- Tenpai players are detected from concealed hand plus fixed melds; standard, seven-pairs, and thirteen-orphans tenpai are covered.
- Noten penalties distribute 3000 points for 1/2/3 tenpai players, with zero-sum deltas.
- Four or zero tenpai players have no point changes.
- Dealer repeats when dealer is tenpai by default; honba increments and riichi sticks carry over.

## Abortive Draws

Implemented:

- Kyuushu kyuuhai declaration from first draw, with nine distinct terminal/honor kinds.
- Suufon renda after four identical first wind discards when uninterrupted.
- Suucha riichi, counting double riichi as riichi.
- Suukan sanra after the fourth kan by two or more players, resolved after the kan player's discard.
- Sanchahou via `tripleRonMode: 'abortive-draw'`; default remains normal triple ron.
- Abortive draw results carry zero point deltas, honba increment, riichi stick carry-over, and dealer repeat metadata.

## UI Audit

Implemented:

- Meld visualization for chi, pon, ankan, minkan, and kakan.
- Called tile orientation/source markers for left/opposite/right/self.
- Closed kan display masks inner tiles while keeping scoring data intact.
- Score panel exposes riichi/double-riichi and kyuushu kyuuhai actions when legal.
- Result dialog renders abortive draw reasons and carry-over information.
- Result dialog renders exhaustive draw tenpai/noten players, point deltas, dealer repeat, honba increment, and riichi-stick carry-over.

## Skipped Tests

There are currently no skipped tests in `src`.

## Match Audit

Implemented:

- `MatchState` is separated from single-round `GameState`.
- `MatchRuleConfig` supports east-only and hanchan matches, starting/target/return points, bankruptcy, dealer continuation, agari-yame, tenpai-yame, extra rounds, sudden death, leftover riichi stick handling, uma, and oka.
- New rounds are generated from match state with inherited scores, dealer, round wind, hand number, honba, and riichi sticks.
- Seat winds are calculated dynamically from the current dealer.
- Dealer win repeats; child win rotates dealer and advances hand number.
- Exhaustive draw repeats when dealer is tenpai and rotates when dealer is noten.
- Special abortive draws repeat the dealer and carry riichi sticks.
- East-only and hanchan scheduled final rounds are recognized.
- Extra rounds and sudden death are supported.
- Bankruptcy ends the match when configured threshold is crossed.
- Final ranking uses raw score first and initial-dealer order as tie-break.
- Final settlement supports converted score, leftover riichi sticks, uma, and oka.
- Duplicate round result application is guarded by round ids.

## Replay And Save Audit

Implemented:

- `MatchLog` version 1.
- `SavedMatch` version 1.
- Typed replay event model with tile instance snapshots.
- Deterministic replay reducer with step forward, step backward, seek, play/pause, and speed state.
- Replay validation for event sequence, duplicate event ids, actor range, duplicate tile occupancy, and illegal actions after end events.
- LocalStorage-backed `StorageAdapter`.
- Current match save/load/delete.
- Replay library save/list/load/delete.
- Save migration and validation.
- Match settings presets and readable validation errors.
- Rule config localStorage restore with damaged-data fallback.

## Differences From Full Modern Japanese Mahjong

Remaining limitations:

- Kokushi robbing ankan is reserved behind `allowKokushiChankanAnkan`; the default rule does not open an ankan robbing window yet.
- Agari-yame and tenpai-yame are automatic; optional player choice is reserved for a later UI pass.
- Match settings UI is intentionally minimal in this version.
- Call-claimed discard styling in the river is not a full discard-history model yet.
- AI call/kan choices are intentionally simple and training-prototype oriented.
