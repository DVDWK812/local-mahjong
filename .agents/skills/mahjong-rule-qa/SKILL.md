---
name: mahjong-rule-qa
description: "Validate Mahjong rules, scoring, legality, waits, yaku, han/fu, limit handling, minimum-han restrictions, calls, riichi, draws, penalties, and 17-step rules with deterministic fixtures. Use for rule implementation or regression acceptance and code-backed rule questions; do not use to change Rules merely to satisfy presentation."
---

# Mahjong rule acceptance

Prove rule behavior from authoritative engine state and explicit fixtures, never from UI labels or renderer state.

## Workflow

1. Identify the exact game variant, enabled options, and authoritative rule / scoring entry points.
2. Express the question as input state → legal outcomes → yaku / han / fu / payment or settlement result.
3. Build deterministic positive, negative, and boundary fixtures.
4. Verify the relevant dimensions: closed / open, ron / tsumo, dealer / non-dealer, riichi / no riichi, minimum-han enabled / disabled, valid shape with zero yaku, and tile-exhaustion-sensitive waits.
5. For scoring, inspect yaku, han, fu, limit classification, payments, and special overrides independently.
6. For draws and penalties, distinguish hand shape, tenpai, winning eligibility, valid yaku, and settlement eligibility.
7. Verify 17-step rules and other variant overrides at their own boundary; prevent rule leakage between modes.
8. Run targeted deterministic tests and report any house-rule or configuration uncertainty.

Rules / GameState / Scoring remain authoritative. Presentation, DOM, and Three.js must consume the result and must not duplicate legality or mutate the state to satisfy a visual expectation.

## Output

Report the variant and options, fixtures, expected and actual outcomes, executable evidence, failures, and unresolved rule-source uncertainty.
