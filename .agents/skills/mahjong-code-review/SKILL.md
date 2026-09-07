---
name: mahjong-code-review
description: "Perform a read-only, defect-first review of Mahjong changes in a diff, commit, branch, worktree, or specified files. Use when the user asks for independent implementation review, architecture and regression inspection, or pre-merge findings with precise locations; do not modify code unless the user explicitly changes the task."
---

# Mahjong code review

Review only. Do not modify files, silently fix findings, create commits, push, delete assets, or regenerate media.

## Workflow

1. Read every applicable `AGENTS.md` and record the starting dirty / untracked work.
2. Resolve the exact review target and inspect its complete diff plus enough surrounding call sites to understand behavior.
3. Review tests for actual behavioral coverage and look for skipped, deleted, weakened, or assertion-only accommodation.
4. Continue through the entire target after the first finding.
5. Report only concrete defects or material risks the author should reasonably fix; omit style-only noise.

## Priorities

1. Rules / GameState / Scoring authority violations and variant leakage.
2. Shared presentation violations, renderer-specific legality, or duplicated sources of truth.
3. State identity, stale cache, async races, proxy-to-authoritative handoff, and unmount cleanup.
4. Legacy Compatibility Mode regressions when shared GameScreen, Local Hand/shared DOM tiles, PresentationEvent/pacing, renderer switch/fallback, shared CSS/layout, shared audio, Rules/GameState, or an explicitly reported 2.5D bug is involved; WebGL fallback, interaction, or animation risks. New 3D presentation work does not require 2.5D feature or visual parity.
5. Illegal or nondeterministic AI behavior and hidden-information leakage.
6. Data loss, destructive operations, paid / external API side effects, and unsafe asset cleanup.
7. Dirty-work contamination, missing regression coverage, and material performance regressions.

## Finding format

For each finding include severity (`blocking`, `high`, `medium`, or `low`), precise file and line, failure scenario, why it is wrong, and minimal remediation direction.

If there are no actionable findings, say so and list the reviewed scope plus checks not executed.
