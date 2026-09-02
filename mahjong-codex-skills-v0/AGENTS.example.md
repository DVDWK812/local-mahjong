# Mahjong Project Agent Instructions

## Scope discipline

- Inspect the current worktree and relevant surrounding code before editing.
- Do not modify unrelated files, reformat unrelated code, or opportunistically refactor outside the requested scope.
- Preserve existing user-facing behavior unless the task explicitly changes it.
- Do not commit, push, call paid/external generation APIs, regenerate media, or delete user assets unless explicitly requested.
- Prefer dry-run/read-only inspection before any bulk, destructive, paid, or irreversible action.

## Project boundaries

- Keep rules/scoring logic separate from UI presentation.
- Keep game-mode-specific rules isolated; do not silently apply Riichi rules to other Mahjong variants or vice versa.
- Keep persistent state/manifest truth separate from transient UI/runtime overlays.
- Avoid duplicated sources of truth for generated asset status.
- Deterministic AI and rule tests must use explicit seeds or fixed fixtures where applicable.

## Verification

- After code changes, run the narrowest relevant tests first, then broader checks when warranted.
- Report exactly what was verified and what was not verified.
- Do not claim UI, audio, browser, build, or test success without running the corresponding check.
- When a failure appears pre-existing or unrelated, provide evidence rather than silently ignoring it.

## Canonical commands

Replace these placeholders with the real repository commands:

- Unit tests: `<UNIT_TEST_COMMAND>`
- Type check: `<TYPECHECK_COMMAND>`
- Lint: `<LINT_COMMAND>`
- Build: `<BUILD_COMMAND>`
- E2E/UI: `<E2E_COMMAND>`

## Skill routing

Install project-local skills at `.agents/skills/`; the archived `.codex/skills/` tree is not the repository discovery path.

Use the smallest relevant set of project skills:

- `mahjong-dev-task` for scoped feature/change implementation.
- `mahjong-bugfix` for reproducible defects, screenshots, logs, incorrect states, or regressions.
- `mahjong-ui-qa` for browser/UI/visual/interactivity acceptance.
- `mahjong-rule-qa` for hand legality, yaku/han/fu, scoring, draw/penalty, mode rules, and rule regressions.
- `mahjong-ai-qa` for AI action legality, difficulty/personality behavior, determinism, and seeded regression tests.
- `mahjong-asset-qa` for voice/BGM/SFX manifests, duplicates, orphan files, generated-state consistency, and safe cleanup plans.
- `mahjong-code-review` for read-only defect-first review.
- `mahjong-release-gate` for final acceptance before declaring a larger task complete.
