# Save Format

## Version

Current `SavedMatch.version`: `1`.

## SavedMatch

```ts
type SavedMatch = {
  version: number;
  saveId: string;
  savedAt: string;
  matchState: SerializableMatchState;
  gameState?: SerializableGameState;
  matchLog: MatchLog;
  ruleConfig: FullRuleConfig;
};
```

Saved data contains only serializable JSON. It must not contain React components, DOM nodes, functions, timers, closures, or random generators.

## Storage Keys

- Current match: `local-mahjong.current-match.v1`
- Replay library: `local-mahjong.replays.v1`
- Rule config: `local-mahjong.rule-config.v1`

The first implementation uses localStorage through a `StorageAdapter` interface. The adapter can be replaced with IndexedDB later without changing callers.

## Auto Save Timing

The save manager supports debounced saving after state changes such as:

- starting a match
- draw/discard
- chi, pon, kan
- riichi
- chankan window changes
- win or draw result
- next round
- match end choice

`SaveManager.saveNow()` is available for immediate saves before page unload.

## Migration

`migrateSavedMatch()`:

- accepts current version
- rejects unknown newer versions
- rejects missing versions
- leaves room for future version upgrades

Invalid data is not silently discarded.

## Validation

`validateSavedMatch()` checks:

- save id and timestamp
- match state invariants
- replay log validity
- GameState and MatchState consistency
- duplicate tile instances in saved GameState

Production loading should stop and show an error if validation fails, while preserving the raw saved data.

## Recovery Stages

The data model can represent:

- normal discard phase
- `call-window`
- `chankan-window`
- `round-result`
- `match-end-choice`
- next-round waiting state

If a future transient state cannot be restored safely, callers should fall back to the latest valid replay snapshot and report a recovery warning.
