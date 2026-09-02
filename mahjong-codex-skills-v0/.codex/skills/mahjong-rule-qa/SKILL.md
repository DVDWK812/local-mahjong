---
name: mahjong-rule-qa
description: Validate Mahjong game rules and scoring deterministically, including hand legality, waits, yaku, han/fu, limit handling, minimum-han restrictions, draw/tenpai/penalty behavior, calls, riichi conditions, 17-step rules, and isolation between Mahjong variants. Use for rule implementation, scoring bugs, rule explanations tied to code, or acceptance of game-engine changes.
---

# Mahjong rule acceptance

## Objective

Prove game-rule behavior with explicit fixtures and isolate rule semantics from UI labels.

## Workflow

1. Identify the exact game variant and enabled rule options before evaluating behavior.
2. Define the rule question as input state -> legal outcomes -> scoring/penalty result.
3. Inspect the authoritative rule/scoring modules and their call sites. Do not infer engine behavior from displayed text alone.
4. Build deterministic fixtures for the reported case and nearby boundaries.
5. Test positive, negative, and boundary cases.
6. Check whether the same helper is reused across variants and whether option flags are applied at the correct layer.
7. Verify scoring decomposition when relevant: yaku/han, fu, limits, payments, and special-rule overrides.
8. For draws/tenpai/penalties, distinguish hand shape, valid yaku, winning eligibility, and draw-settlement eligibility; these are not automatically the same concept.

## Required regression dimensions when relevant

- Closed vs open hand.
- Ron vs tsumo.
- Dealer vs non-dealer.
- Riichi vs no riichi.
- Minimum-han/han-shibari enabled vs disabled.
- Valid shape with zero yaku vs valid winning hand.
- Normal Riichi Mahjong vs 17-step or other variant-specific overrides.
- Edge waits and tile-exhaustion-sensitive cases.

## Evidence standard

Prefer executable tests with explicit tiles/state over prose-only reasoning. If rules are uncertain or house-rule dependent, state the uncertainty and identify the configuration/source needed to resolve it.
