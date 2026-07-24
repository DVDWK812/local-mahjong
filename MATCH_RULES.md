# Match Rules

This project now separates single-round rules from match rules.

## Match Length

- `east-only`: scheduled rounds are East 1 through East 4.
- `hanchan`: scheduled rounds are East 1 through South 4.
- If nobody reaches the target at the scheduled end and extra rounds are enabled, the match continues into later winds.

## Round Progression

- `dealer` is the current dealer player index.
- `roundWind` is the table wind.
- `handNumber` is 1 through 4 within the current wind.
- When the dealer repeats, `roundWind` and `handNumber` do not advance.
- When the dealer rotates, `dealer = (dealer + 1) % 4`.
- After hand 4 rotates, the wind advances: east -> south -> west -> north.
- Seat winds are calculated dynamically from the current dealer.

## Dealer Repeat And Rotation

- Dealer win repeats by default.
- Dealer tenpai exhaustive draw repeats by default.
- Child win rotates the dealer and resets honba to 0.
- Exhaustive draw always increments honba.
- Special abortive draws repeat the dealer by default and increment honba.

## Honba

- Dealer win: honba +1.
- Dealer repeat draw: honba +1.
- Dealer rotation after child win: honba resets to 0.
- Dealer rotation after exhaustive draw: honba +1.
- Special abortive draw: honba +1.

## Riichi Sticks

- Round scoring pays claimed riichi sticks to winners.
- Unclaimed sticks carry to the next round by default.
- At match end, leftover sticks are handled by `leftoverRiichiStickMode`:
  - `first-place`: award all leftover sticks to the temporary first-place player.
  - `initial-dealer`: award all leftover sticks to the initial dealer.
  - `discard`: do not award them.

## Exhaustive Draw

- Live wall exhaustion is separate from special abortive draws.
- Last tile tsumo is checked before exhaustive draw.
- Last discard ron and houtei are checked before exhaustive draw.
- Tenpai/noten payments use the standard 3000-point pool.
- Riichi sticks carry over.

## Special Abortive Draws

Implemented special abortive draws:

- Kyuushu kyuuhai.
- Suufon renda.
- Suucha riichi.
- Suukan sanra.
- Sanchahou when configured as abortive draw.

These do not apply tenpai/noten payments.

## Bankruptcy

- `bankruptcyEndsMatch=true` by default.
- `bankruptcyThreshold=0` means negative scores end the match.
- Set `bankruptcyThreshold=1` if 0 points should also end the match.

## Agari-Yame

When `agariYame=true`, the dealer may automatically end the match after winning in the scheduled final round or an extra round if:

- Dealer is ranked first.
- Dealer has at least `targetPoints`.

`agariYameMode` controls behavior:

- `automatic`: end immediately.
- `player-choice`: enter `match-end-choice`; the dealer may end the match or continue dealership.

AI dealer uses `chooseAgariYame()`: end when first and ahead of second place by at least 1000 points.

## Tenpai-Yame

When `tenpaiYame=true`, the dealer may automatically end the match after exhaustive draw in the scheduled final round or an extra round if:

- Dealer is tenpai.
- Dealer is ranked first.
- Dealer has at least `targetPoints`.

Default is `false`.

`tenpaiYameMode` supports the same `automatic` and `player-choice` modes.

## Extra Rounds And Sudden Death

- `allowWestRound=true` means extra rounds are allowed.
- The field name is kept for compatibility; in this project it means “allow extra rounds”.
- East-only can continue beyond East 4 when nobody reaches target.
- Hanchan can continue beyond South 4 when nobody reaches target.
- In extra rounds, the match ends after a completed round when any player reaches `suddenDeathTarget`.
- `maxExtraRoundWind` limits forced extension.

## Final Ranking

Ranking order:

1. Higher raw score.
2. If tied, earlier order from the initial dealer.
3. Initial dealer has the highest tie priority, then seat order clockwise.

## Converted Score

When uma and oka are disabled:

```text
convertedScore = (rawScore - returnPoints) / 1000
```

Scores are rounded to one decimal with `roundMatchScore()`.

## Uma

When `useUma=true`, final ranking receives configured adjustments:

```text
uma = [20, 10, -10, -20]
```

The configured uma must sum to zero.

## Oka

When `useOka=true`, first place receives:

```text
4 * (returnPoints - startingPoints) / 1000
```

With 25,000 start and 30,000 return, this is 20.0.

## Default MatchRuleConfig

```ts
{
  matchLength: "east-only",
  startingPoints: 25000,
  targetPoints: 30000,
  returnPoints: 30000,
  bankruptcyEndsMatch: true,
  bankruptcyThreshold: 0,
  dealerContinuationOnWin: true,
  dealerContinuationOnTenpaiDraw: true,
  agariYame: true,
  tenpaiYame: false,
  agariYameMode: "automatic",
  tenpaiYameMode: "automatic",
  allowWestRound: true,
  maxExtraRoundWind: "west",
  suddenDeathTarget: 30000,
  carryRiichiSticksToNextRound: true,
  leftoverRiichiStickMode: "first-place",
  useUma: false,
  uma: [20, 10, -10, -20],
  useOka: false
}
```

## Known Differences

- Agari-yame and tenpai-yame support automatic and player-choice modes.
- Match settings UI exposes core match and round rules, with presets for Mahjong Soul style, standard competitive, and custom.
- Full professional league variants are not exhaustive.
