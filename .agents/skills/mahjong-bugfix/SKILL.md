---
name: mahjong-bugfix
description: "Diagnose and minimally repair an existing Mahjong defect such as a regression, screenshot-visible bug, duplicated or stale state, missing behavior, broken interaction, unexpected reset, or previously working feature failure. Use when behavior is wrong and root-cause evidence is required; do not use for net-new feature work or read-only review."
---

# Mahjong bug fix

Prove the first incorrect state or transition, fix its cause, and add regression evidence.

## Workflow

1. Read applicable `AGENTS.md`, capture the starting worktree, and write a concrete expected-versus-actual statement.
2. Reproduce with the existing app, tests, screenshots, logs, browser state, or a deterministic fixture. A screenshot locates symptoms but does not prove root cause.
3. Trace the authoritative data / state flow until the first incorrect value or transition appears.
4. Compare plausible hypotheses with evidence before editing.
5. Add a failing regression test when practical.
6. Apply the smallest root-cause repair. Do not hide failure with wider tolerance, arbitrary dedupe / retry, fixed `setTimeout`, deleted tests, skipped tests, or weakened assertions.
7. Re-run the reproduction, targeted tests, and neighboring states that share the mechanism.
8. Inspect the final diff for contamination from pre-existing work.

## Frequent boundaries

- Stable identity must drive list keys, dedupe, tile actions, and presentation handoff; visible labels and indexes are not authority.
- Persisted state, cache state, and transient runtime overlays must have explicit handoff semantics so stale refreshes cannot roll the UI backward.
- Older async results must not overwrite newer state.
- Presentation cannot repair itself by duplicating Rules or mutating `GameState`.
- Variant-specific behavior must remain isolated.

Use the relevant domain QA Skill after the fix only when it adds evidence for the reported defect.

## Completion report

Report root cause, the minimal fix, regression coverage, verification evidence, and remaining uncertainty.
