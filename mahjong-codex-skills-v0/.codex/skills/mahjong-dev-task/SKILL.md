---
name: mahjong-dev-task
description: Implement a scoped change in the Mahjong application with minimal unrelated churn, explicit architecture and state-boundary checks, targeted tests, and evidence-based completion reporting. Use for feature work, refactors requested by the user, UI behavior changes, state-management changes, game-flow changes, or other code modifications that are not primarily a bug investigation or read-only review.
---

# Mahjong development task

## Objective

Implement the requested behavior while preserving unrelated behavior and keeping rules, UI state, persistent state, assets, and game-mode boundaries explicit.

## Workflow

1. Read the applicable `AGENTS.md` and inspect the current worktree before editing.
2. Restate the requested observable behavior internally as acceptance criteria. Separate required behavior from optional cleanup.
3. Locate the smallest relevant code path, tests, call sites, state owners, and persistence boundaries.
4. Check for duplicated sources of truth, stale caches, transient overlays, mode-specific branching, and side effects before choosing the implementation.
5. Prefer the smallest coherent change. Do not perform unrelated refactors or formatting churn.
6. Add or update tests that prove the requested behavior and at least one important regression boundary.
7. Run narrow verification first. Escalate to typecheck/lint/build/E2E only when the change can affect those layers or project instructions require them.
8. Inspect the final diff for accidental changes, debug code, temporary files, weakened types, skipped tests, or silent behavior changes.

## Mahjong-specific checks

- Do not mix Riichi, Chinese Official, 17-step, or other mode rules unless explicitly intended.
- Do not let UI display state become the authoritative source for game rules or persistent asset truth.
- For asynchronous generation/loading flows, distinguish persisted status from runtime status and define how each transitions on success/failure/retry.
- For user-visible lists/search/filtering, verify identity keys and deduplication semantics rather than deduplicating by display text accidentally.
- For random behavior, make tests deterministic with seeds or fixtures.

## Completion report

Return:

- What changed and why.
- Files changed.
- Tests/checks actually run and their results.
- Any remaining risk, unverified path, or assumption.

Never claim a check was performed if it was not run.
