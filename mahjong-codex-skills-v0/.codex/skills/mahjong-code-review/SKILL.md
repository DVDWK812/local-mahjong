---
name: mahjong-code-review
description: Perform a read-only, defect-first review of Mahjong application changes and return concrete actionable findings with file and line references. Use before merge, after a Codex implementation, when the user asks to review a diff/commit/worktree, or when an implementation needs independent verification for correctness, regression risk, state consistency, rules, UI, tests, performance, or safety.
---

# Mahjong code review

## Read-only constraint

Do not modify files, create commits, push, delete assets, regenerate media, or silently fix findings. Review only unless the user explicitly changes the task.

## Workflow

1. Read applicable `AGENTS.md` instructions.
2. Determine the exact review target: uncommitted diff, staged diff, commit, branch/base diff, or specified files.
3. Inspect the complete target diff and enough surrounding code/call sites to understand behavior.
4. Review tests and verify whether they actually exercise the changed behavior.
5. Continue through the entire diff after finding the first issue.
6. Report only concrete issues the author would reasonably fix. Avoid style-only noise unless it creates maintainability or correctness risk.

## Review priorities

1. Rule/game correctness and variant leakage.
2. State ownership, stale cache, async races, duplicated sources of truth.
3. User-visible regressions and list identity/deduplication.
4. Data loss, destructive operations, paid/external API side effects.
5. Illegal AI actions, nondeterminism, hidden-information leakage.
6. Incorrect error handling and retry semantics.
7. Missing regression tests.
8. Performance regressions in render loops, large lists, 3D/animation, audio lifecycle, or repeated computation.

## Finding format

Number every finding. For each finding include:

- Severity: blocking / high / medium / low.
- File and line or smallest precise location.
- Failure scenario.
- Why the current code is incorrect or risky.
- Minimal remediation direction.

If no actionable defect is found, say so and list what was reviewed and what was not executed.
