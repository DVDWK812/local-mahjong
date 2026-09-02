---
name: mahjong-asset-qa
description: Audit Mahjong voice, BGM, riichi music, and sound-effect assets plus manifests/caches/status records for duplicates, orphan files, missing files, stale generation state, unsafe cleanup, naming/format inconsistencies, and unintended external API calls. Use for media generation workflows, voice-pack UI issues, duplicate search results, cleanup requests, asset migrations, or audio acceptance.
---

# Mahjong audio and asset acceptance

## Safety rule

Default to read-only inspection and dry-run. Do not call paid/external generation APIs, regenerate assets, modify MP3/WAV/M4A files, or delete files unless explicitly requested.

## Workflow

1. Identify authoritative sources of truth: manifest, filesystem, cache/index, persisted failure records, and runtime overlay.
2. Build a normalized inventory keyed by stable logical asset ID, not display name alone.
3. Compare manifest entries to filesystem entries in both directions.
4. Detect:
   - duplicate logical IDs;
   - duplicate visible rows produced by merge/search logic;
   - orphan files;
   - missing files;
   - stale generated/failed flags;
   - multiple files competing for one logical asset;
   - unsafe filename collisions.
5. For generation workflows, trace state transitions item-by-item: pending -> generating -> generated/failed -> persisted refresh.
6. Confirm that a successful item cannot visually regress to `not generated` while persistence/cache refresh is in flight.
7. For failed items, preserve actionable safe error information without leaking secrets.
8. For cleanup, produce a dry-run candidate list first and explain why each item is safe to remove.

## Audio-specific checks

When metadata/tooling is available, inspect format consistency, duration anomalies, sample rate/channel anomalies, clipping/peak anomalies, and loop/end behavior relevant to BGM versus one-shot SFX. Do not transcode merely to make files uniform unless the project standard requires it.

## Output

Report counts for unchanged/new/missing/orphan/duplicate/failed when applicable, then list exact actionable anomalies. Clearly distinguish observed filesystem truth from UI/cache status.
