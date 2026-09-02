---
name: mahjong-bugfix
description: Diagnose and fix a concrete Mahjong application defect using reproduction evidence, screenshots, logs, failing tests, incorrect UI states, regressions, or user-reported behavior. Use when the task says something is wrong, duplicated, stale, missing, inconsistent, unexpectedly reset, visually broken, or previously working behavior regressed.
---

# Mahjong bug fix

## Objective

Find the actual failure mechanism, apply the smallest reliable fix, and prove that the reported symptom and its underlying regression are resolved.

## Workflow

1. Read `AGENTS.md`, inspect the worktree, and preserve unrelated local changes.
2. Convert the report into a concrete expected-vs-actual statement.
3. Reproduce where possible using the existing app/tests. If a screenshot is provided, map visible symptoms to likely component/state boundaries but do not treat appearance alone as proof of root cause.
4. Trace the data/state flow from source to render or from action to state transition. Identify where the first incorrect value/state appears.
5. Form competing hypotheses before editing. Prefer evidence from code, logs, tests, DOM/state inspection, or deterministic reproduction.
6. Add a failing regression test when practical before fixing.
7. Fix the root cause, not only the visible symptom. Avoid broad dedupe/reset/retry logic unless its semantics are justified.
8. Re-run the reproduction and relevant regression tests.
9. Inspect neighboring states that share the same mechanism.

## Frequent project failure patterns

Explicitly check for these when relevant:

- Search/filter paths creating duplicate rows because two collections are concatenated without stable identity dedupe.
- Runtime status overlays disappearing before refreshed persistent/cache state arrives, causing a visible rollback such as `generated -> not generated`.
- Batch success/failure state being refreshed only at batch end instead of per item.
- Stale memo/cache/query results surviving pack/manifest updates.
- React list keys based on non-unique labels or filtered indexes.
- Async race conditions where an older request overwrites a newer result.
- Mode-specific rules leaking into another game mode.

## Completion report

Include root cause, fix, regression coverage, verification evidence, and any remaining uncertainty. Do not report only the edited lines.
