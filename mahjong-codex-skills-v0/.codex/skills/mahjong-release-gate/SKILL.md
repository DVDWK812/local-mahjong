---
name: mahjong-release-gate
description: Run a final evidence-based acceptance gate for a completed Mahjong development task by selecting the minimal relevant development QA skills, checking the final diff, tests, UI/rules/AI/assets as applicable, and returning an explicit PASS, PASS WITH RISKS, or FAIL decision. Use before declaring a substantial task complete, before merge/release, or when the user asks for comprehensive acceptance/验收.
---

# Mahjong release gate

## Objective

Prevent a task from being declared complete merely because code was edited or one test passed.

## Routing

Choose only the relevant checks. If the named project skill is available in the current Codex session, open and follow its `SKILL.md` rather than re-inventing the workflow:

- UI/frontend changed -> use `mahjong-ui-qa`.
- Rules/scoring/game legality changed -> use `mahjong-rule-qa`.
- AI changed -> use `mahjong-ai-qa`.
- Voice/BGM/SFX/assets/manifests changed -> use `mahjong-asset-qa`.
- Any code change -> use `mahjong-code-review` on the final diff.

Use the minimal relevant set and sequence them as acceptance checks. Do not run irrelevant expensive checks just to appear thorough.

## Gate procedure

1. Confirm requested acceptance criteria and final diff scope.
2. Check for unrelated changes, temporary artifacts, debug instrumentation, skipped tests, and uncommitted generated junk.
3. Run the narrow relevant automated tests.
4. Run broader typecheck/lint/build only when required by project instructions or risk profile.
5. Execute relevant behavioral/UI/rule/AI/asset acceptance rather than inferring it.
6. Review the final diff defect-first.
7. Classify unresolved items as blocking or non-blocking.

## Decision

Return exactly one overall decision:

- `PASS` — requested behavior is verified and no material unresolved risk remains.
- `PASS WITH RISKS` — core behavior is verified, but explicitly listed non-blocking risks or unverified paths remain.
- `FAIL` — a requested criterion fails, a material regression exists, or critical verification could not be completed.

## Evidence summary

Include:

- Scope verified.
- Commands/tests run with results.
- Behavioral scenarios verified.
- Findings and remaining risks.
- Any checks not performed and why.

Never convert `NOT VERIFIED` into `PASS`.
