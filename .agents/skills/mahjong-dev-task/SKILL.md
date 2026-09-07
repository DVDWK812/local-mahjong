---
name: mahjong-dev-task
description: "Implement a scoped feature or requested behavior change in this Mahjong repository, including UI interactions, small modules, shared presentation contracts, or game-flow integration. Use for planned development work; do not use when the primary task is defect diagnosis, read-only review, domain-only QA, or a final release gate."
---

# Mahjong development task

Implement the requested observable behavior with the smallest coherent change and no unrelated churn.

## Workflow

1. Read the applicable `AGENTS.md`, record the starting worktree, and preserve existing dirty / untracked work.
2. Turn the request into explicit acceptance criteria. Separate required behavior from optional cleanup.
3. Locate the narrowest implementation path, its tests, call sites, state owner, and persistence or presentation boundaries.
4. Before editing, check whether Rules, shared presentation, renderer, AI, or asset authority owns each decision.
5. Reuse existing components, types, and utilities. Do not create a second source of truth or mix variant-specific behavior.
6. Add or update deterministic tests for the requested behavior and an important regression boundary.
7. Run targeted checks first, then the broader verification required by the applicable `AGENTS.md` and the change risk.
8. Inspect the final diff for unrelated changes, debug code, generated junk, weakened types, skipped tests, or altered assertions.

Load a domain QA Skill only when the change actually affects that domain. Development does not itself imply a release gate.

## Project boundaries

- Rules / GameState / Scoring remain authoritative; presentation and renderers do not infer legality.
- Shared functional semantics flow through shared presentation state / actions; renderer-specific coordinates stay in the renderer.
- 3D is the primary/default renderer. 2.5D is frozen Legacy Compatibility Mode: do not add 2.5D feature or visual parity for new 3D presentation work. Run a lightweight legacy smoke, and expand 2.5D regression only when shared GameScreen, Local Hand/shared DOM tiles, PresentationEvent/pacing, renderer switch/fallback, shared CSS/layout, shared audio, Rules/GameState, or a reported 2.5D bug is in scope.
- Use fixed fixtures or seeds for random and rule-sensitive behavior.
- Use `PresentationEvent`, `AnimationScheduler`, and `PresentationPacing` for presentation animation; do not substitute fixed AI timers.

## Completion report

Report what changed, files changed, checks actually run, behavioral evidence, and any remaining risk or unverified path.
