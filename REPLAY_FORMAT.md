# Replay Format

## Version

Current `MatchLog.version`: `1`.
Current `ReplayRecord.version`: `1`.

`ReplayRecord` is the local library envelope around a `MatchLog`. It adds the stable
`id`, title, created/updated timestamps, match type, four player names, current/final
scores, round count, local source, and completed/incomplete status. Missing envelope
fields in legacy bare `MatchLog` entries are derived safely when read.

The library keeps an index at `local-mahjong.replay-index.v1` and stores each record
under its own `local-mahjong.replay.v1.<id>` key. This isolates a damaged record from
the rest of the list. The former `local-mahjong.replays.v1` map is read and migrated
lazily without changing `MatchLog.version`.

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
- `initialScores` (optional for legacy compatibility)
- `initialHands`
- `initialDoraIndicators` (optional)
- `liveWall` / `deadWall` (optional explicit wall split)
- `wallOrder`
- `events`
- `result`

Local development replay may store full initial hands and wall order. A future public replay format can omit private information.
New local records write the explicit live wall, 14-tile dead wall, initial scores, and
initial dora indicators. Legacy records continue to use `wallOrder` when it contains
the complete remaining wall; records without either representation remain readable
but report that the full wall was not recorded.

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
`tile-drawn` may also include an optional `source` (`live-wall`, `rinshan`, or
`initial-hand`). Missing sources are inferred by tile `instanceId` for old logs.

## Deterministic round playback

`buildReplayState(round, stepIndex)` rebuilds from the round snapshot on every step.
It never mutates the source log, invokes AI, or advances the live game engine.
Player views reveal only the selected hand and public information. Full-open view may
reveal all four hands, live-wall order, dead wall, rinshan, dora, and ura positions.

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
