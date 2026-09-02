---
name: mahjong-asset-qa
description: "Audit Mahjong voice, BGM, riichi music, SFX, manifests, caches, generation records, and media files for missing, orphaned, duplicate, stale, unsafe, or inconsistent state. Use for audio acceptance, voice-pack workflows, asset migrations, cleanup plans, or manifest issues; do not use as general UI QA or call paid generation APIs without explicit authorization."
---

# Mahjong audio and asset acceptance

Default to read-only inspection and dry-run. Do not call paid / external generation APIs, regenerate media, modify audio binaries, or delete files unless the user explicitly authorizes that action.

## Workflow

1. Identify the authoritative manifest, filesystem, cache / index, persisted failure record, and runtime overlay.
2. Build an inventory keyed by stable logical asset ID rather than display name.
3. Compare manifest and filesystem in both directions.
4. Detect duplicate IDs or files, orphan files, missing files, stale generated / failed state, filename collisions, and multiple files competing for one logical asset.
5. For generation, trace each item through pending → generating → generated / failed → persisted refresh; verify one item's success cannot roll back while other items continue.
6. Preserve actionable error detail without exposing credentials or secrets.
7. When metadata tooling is available, inspect format, duration, sample rate, channels, clipping, and BGM loop / SFX ending anomalies relevant to the task.
8. For cleanup, produce an exact dry-run candidate list with a safety reason for each item before any deletion.

Do not transcode merely for uniformity unless the repository standard requires it. Use `mahjong-ui-qa` separately only when the task also asks to accept browser-visible media controls or state.

## Output

Separate observed filesystem truth from manifest, cache, and UI state. Report counts and exact actionable anomalies, plus any operation intentionally not performed.
