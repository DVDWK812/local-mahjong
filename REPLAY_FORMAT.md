# Replay Format

## Version

Current `MatchLog.version`: `1`.

## MatchLog

`MatchLog` is a pure JSON record:

- `version`
- `matchId`
- `createdAt`
- `seed`
- `playerNames`
- `playerTypes`
- `initialDealer`
- `initialScores`
- `ruleConfig`
- `rounds`
- `finalResult`

## RoundLog

Each round stores:

- `roundId`
- `roundWind`
- `handNumber`
- `dealer`
- `honba`
- `riichiSticks`
- `initialHands`
- `wallOrder`
- `events`
- `result`

Local development replay may store full initial hands and wall order. A future public replay format can omit private information.

## TileSnapshot

Every tile reference uses:

```ts
{
  instanceId: string;
  tileId: number;
  red: boolean;
}
```

The same tile instance must not occupy two physical locations at the same time.

## Event Model

Supported event types:

- `match-started`
- `round-started`
- `tiles-dealt`
- `tile-drawn`
- `tile-discarded`
- `riichi-declared`
- `call-window-opened`
- `call-passed`
- `chi-declared`
- `pon-declared`
- `ankan-declared`
- `minkan-declared`
- `kakan-declared`
- `chankan-declared`
- `dora-revealed`
- `tsumo-declared`
- `ron-declared`
- `abortive-draw`
- `exhaustive-draw`
- `round-ended`
- `match-end-choice`
- `match-ended`

Every event includes `eventId`, `sequence`, `roundId`, optional `timestamp`, and optional `actor`.

## Replay

Replay uses pure event reduction:

- `reduceGameEvent()` is deterministic and immutable.
- It does not call AI.
- It does not randomize wall order.
- It does not read or write localStorage.
- `stepBackward()` and `seekToEvent()` rebuild from the initial replay state.
- Snapshots are supported through `ReplaySnapshot` and can be stored every 20 events.

## Validation

`validateMatchLog()` checks:

- contiguous event sequence
- unique event ids
- valid actor range
- tile instance uniqueness
- max four physical copies per tile id
- no tile actions after round end
- no events after match end

Invalid logs are rejected with explicit errors.
