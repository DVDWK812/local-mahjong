# Testing Guide

## Environment Requirements

- Node.js LTS
- npm

## Start The App

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Build Test

```bash
npm run build
```

## Unit Tests

```bash
npm test
```

Current verified suite:

- 45 test files
- 255 passing tests
- 0 skipped tests

## Manual Page Test Checklist

- The page displays the mahjong table.
- East player starts with 14 tiles.
- The UI clearly shows whose turn it is.
- Clicking a hand tile discards it.
- The river gains the discarded tile.
- The hand loses the discarded tile.
- Visible tile counts update.
- Remaining tile counts update.
- Shanten updates.
- Ukeire updates.
- Top 3 discard recommendations update.
- After Player 1 discards, Player 2, Player 3, and Player 4 draw and discard automatically.
- AI actions appear with a short delay between each step.
- The turn returns to Player 1 after all AI players act.
- If the live wall is empty and nobody wins, the round enters exhaustive draw settlement.
- If Player 1 can declare riichi, the riichi button is enabled.
- Double riichi is shown when first-turn conditions are met.
- Declaring riichi pays 1000 points and adds one riichi stick.
- If Player 1 can pon a discard, Pon and Pass buttons appear.
- If Player 1 can chi a discard from the left player, Chi options and Pass appear.
- If Player 1 can kan, the matching kan action appears.
- Chi, pon, ankan, minkan, and kakan melds are visible beside the hand.
- Called tiles show source orientation.
- Closed kan display masks the inner tiles.
- Ankan display shows face-down tiles on both ends and face-up tiles in the middle.
- Ankan tiles are all vertical, with no called-from source.
- Kakan declaration opens a chankan window before the meld upgrades.
- Chankan success keeps the original pon and cancels the kakan.
- If every eligible player passes chankan, the kakan completes and the player draws rinshan.
- If Player 1 can declare kyuushu kyuuhai, the action button appears.
- Abortive draw result dialog shows the abortive reason and carry-over information.
- Exhaustive draw result dialog shows tenpai/noten players and point changes.
- The header shows East/South round, hand number, honba, riichi sticks, dealer, and match length.
- Clicking the round result button advances to the next hand when the match continues.
- The next hand inherits player scores, dealer, round wind, honba, and riichi sticks.
- The final match dialog appears when end conditions are met.
- Final ranking shows raw points, converted score, uma, oka, and final match score.
- Match settings show presets, match rules, and round rules.
- Changing a settings field moves rules into custom mode.
- Agari-yame and tenpai-yame player-choice mode shows end/continue buttons.
- Replay controls show play, pause, step, seek, and speed controls.
- Continue-match dialog shows valid saves or readable load errors.
- Save status indicator shows saving, saved, and error states.

## Mahjong Logic Test Checklist

- Tenpai.
- One-shanten.
- Two-shanten.
- Seven pairs.
- Thirteen orphans.
- Tanyao.
- Pinfu.
- Yakuhai.
- Dora and red dora.
- Double riichi.
- Haitei, houtei, rinshan, chankan scoring flags.
- Full kakan chankan interruption.
- Sankantsu.
- Shousangen.
- Provenance-aware sanankou.
- Chanta.
- Junchan.
- Tenhou and chiihou.
- Yakuman and double yakuman.
- Open-hand han reduction.
- Fu for waits, pairs, triplets, kans, pinfu tsumo, and chiitoitsu.
- Multi-decomposition best scoring.
- Real call-aware scoring from `PlayerState.calls`.
- Shanpon ron does not count the completed triplet as concealed for sanankou.
- Shanpon tsumo counts the completed triplet as concealed for sanankou.
- Noten penalty distribution for 1/2/3 tenpai players.
- Dealer tenpai repeat on exhaustive draw.
- Dealer noten rotation metadata on exhaustive draw.
- East-only match ends after East 4 when target conditions are satisfied.
- Hanchan ends after South 4 when target conditions are satisfied.
- Extra rounds start when nobody reaches target and extension is enabled.
- Bankruptcy ends the match when a player falls below the configured threshold.
- Leftover riichi sticks are awarded according to match rule config.
- Tied final scores are ordered by initial dealer order.
- Rule presets restore Mahjong Soul style, standard competitive, and custom settings.
- Replay event sequence and event ids validate correctly.
- Replay step forward, step backward, and seek are deterministic.
- Saved matches validate MatchState, GameState, MatchLog, and version.
- Damaged rule config or save data does not need to white-screen the app.

## Abortive Draw Test Checklist

- Kyuushu kyuuhai is available only on the first draw and only by player choice.
- Kyuushu kyuuhai requires nine distinct terminal/honor kinds.
- Suufon renda triggers only for four identical first wind discards and no interruption.
- Suucha riichi triggers after all four players are riichi.
- Suukan sanra triggers after the fourth kan by two or more players.
- Sanchahou follows `tripleRonMode`.
- Abortive draw keeps riichi sticks on table and increments honba.
- Special abortive draws do not apply tenpai/noten payments.

## Exhaustive Draw Test Checklist

- 0 tenpai players have no point changes.
- 1 tenpai player gets +3000; the other three pay -1000.
- 2 tenpai players get +1500 each; the two noten players pay -1500 each.
- 3 tenpai players get +1000 each; the only noten player pays -3000.
- 4 tenpai players have no point changes.
- Point deltas always sum to zero.
- Last tile tsumo resolves before exhaustive draw.
- Last discard ron and houtei resolve before exhaustive draw.
- Seven-pairs and thirteen-orphans tenpai are detected.
- Open-hand standard tenpai is detected with fixed melds.
- Riichi sticks carry over and honba increments.

## AI Auto Play Test Checklist

- Player 2 uses a recommended discard when available.
- Player 3 uses a recommended discard when available.
- Player 4 uses a recommended discard when available.
- AI fallback can still discard when no recommendation is available.
- AI can pass call windows.
- AI can chi when it improves shanten.
- AI can declare riichi when eligible.
- AI can declare kyuushu kyuuhai when eligible.
- AI can declare chankan ron when eligible.
- AI stops acting after round end, abortive draw, or exhaustive draw.

## Known Current Limitations

- Other players use simple local AI and are not strategically strong yet.
- Kokushi robbing ankan is reserved by config and is not exposed as a full ankan interruption window yet.
- Call-claimed discard styling is not a full discard-history model yet.
- Han and fu cover the requested core rules, but rare house-rule variations are not exhaustive.
