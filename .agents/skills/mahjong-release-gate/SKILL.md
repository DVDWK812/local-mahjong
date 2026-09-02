---
name: mahjong-release-gate
description: "Run the final evidence-based gate for a completed Mahjong change before commit, merge, release, or a user-requested comprehensive acceptance. Reconcile the final diff, required tests/build/diff checks, manual acceptance, and known blockers, then return PASS, PASS WITH RISKS, or FAIL; do not use as the implementation workflow."
---

# Mahjong release gate

Use completed evidence where it is current and trustworthy; run only the missing checks required by scope and risk. Do not repeat development logic or load every QA Skill by default.

## Routing

Select the minimal relevant evidence:

- frontend / 3D / interaction → `mahjong-ui-qa`;
- rules / scoring / legality → `mahjong-rule-qa`;
- AI → `mahjong-ai-qa`;
- voice / BGM / SFX / manifests → `mahjong-asset-qa`;
- final code diff → `mahjong-code-review`.

Read a routed Skill only when its domain changed or the user explicitly requests that acceptance. Do not create recursive or unbounded Skill invocation chains.

## Gate procedure

1. Confirm acceptance criteria and resolve the final diff scope against the starting worktree.
2. Check unrelated changes, dirty-work contamination, temporary artifacts, debug instrumentation, skipped tests, and generated junk.
3. Reconcile targeted tests, broader `npm test` / `npm run build` requirements, `git diff --check`, and applicable manual acceptance.
4. Execute missing domain checks; do not infer UI, rules, AI, asset, or WebGL PASS without the required evidence.
5. Review the final diff defect-first and classify unresolved items as blocking or non-blocking.
6. List every required check not performed and why.

## Decision

Return exactly one overall decision:

- `PASS` — all required behavior and checks are verified with no material unresolved risk.
- `PASS WITH RISKS` — core behavior is verified; only explicitly listed non-blocking risks or unverified paths remain.
- `FAIL` — a criterion fails, a material regression exists, required evidence is blocked, or critical verification was not completed.

Never convert `NOT VERIFIED` or `MANUAL BLOCKED` into `PASS`.

## Evidence summary

Include scope, commands and results, behavioral scenarios, manual acceptance, findings, known blockers, and remaining risks.
