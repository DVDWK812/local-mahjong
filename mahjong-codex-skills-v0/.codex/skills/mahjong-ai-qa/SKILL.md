---
name: mahjong-ai-qa
description: Validate Mahjong AI behavior across difficulty levels, personalities, seeded randomness, legal-action constraints, pressure/defense choices, 17-step AI behavior, and regression stability. Use after AI logic changes, difficulty mapping changes, personality changes, decision-policy changes, or when AI behavior appears illegal, identical across levels, unstable, or implausible.
---

# Mahjong AI acceptance

## Objective

Test AI as a decision system under controlled states, not by judging a few random games subjectively.

## Workflow

1. Identify the AI entry point, difficulty mapping, personality parameters, and random source.
2. Use fixed seeds and explicit game-state fixtures for reproducibility.
3. Verify legality first: the AI must never choose an unavailable action or violate mode rules.
4. Test decision invariants that should hold across all difficulties.
5. Test intended differences between difficulty/personality settings with multiple representative fixtures.
6. Separate deterministic policy changes from randomness/noise used to make weaker levels less optimal.
7. Check fallback behavior when candidate actions tie, features are missing, or evaluation returns invalid values.
8. Run pressure/defense/offense boundary scenarios where the AI's weighting should visibly differ.

## Anti-pattern checks

- Difficulty names mapping to the same effective configuration accidentally.
- Randomness large enough to erase intended skill differences.
- Tests that assert one exact move when several moves are strategically equivalent.
- Hidden nondeterminism from time/global RNG.
- AI using information unavailable to a real player unless the mode explicitly permits it.
- Variant-specific assumptions leaking between rule sets.

## Output

Report legality, determinism, expected level/personality differentiation, failed fixtures, and performance concerns separately.
