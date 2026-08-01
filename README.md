# Local Mahjong Trainer

Local four-player Japanese mahjong trainer built with Vite, React, and TypeScript.

The project runs fully offline. It does not use third-party game clients, online services, Mahjong Soul assets, UI, audio, or APIs.

## Features

- 34 tile kinds encoded as `0-33`.
- Full `Tile`, `PlayerState`, `GameState`, and separated `MatchState`.
- Local four-player round flow with draw, discard, chi, pon, kan, riichi, tsumo, ron, chankan, exhaustive draw, and special abortive draws.
- Shanten, ukeire, and discard recommendation modules.
- Yaku, han, fu, point calculation, yakuman, double yakuman, dora, red dora, and multi-decomposition best scoring.
- East-only and hanchan match flow with dealer repeat, rotation, honba, riichi sticks, final ranking, uma, and oka.
- Match settings with presets:
  - Mahjong Soul style
  - Standard competitive
  - Custom
- Player-choice agari-yame and tenpai-yame modes.
- Replay data model and deterministic event reducer.
- Local save model, migration, validation, and localStorage adapter.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Test

```bash
npm test
npm run test:stress
npm run test:stress:long
npm run build
```

Current verified stability baseline (2026-08-01):

- 97 test files in the default suite
- 867 passing tests
- 0 skipped tests
- 10 consecutive full-suite runs passed
- 500-round and 5000-round deterministic stress tests pass
- production build passes

## Key Docs

- `TESTING.md`
- `MATCH_RULES.md`
- `REPLAY_FORMAT.md`
- `SAVE_FORMAT.md`
- `SCORING_AUDIT.md`
- `docs/STABILITY_AUDIT_FINAL.md`
- `docs/TEST_MODE.md`

## Notes

The AI is intentionally simple and local. It uses existing recommendation logic where appropriate and does not connect to a backend.

Replay and save systems are JSON/data-model first. They do not serialize React components, DOM nodes, timers, functions, or closures.
