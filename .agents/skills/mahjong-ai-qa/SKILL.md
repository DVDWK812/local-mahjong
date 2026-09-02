---
name: mahjong-ai-qa
description: "Validate Mahjong AI legality, difficulty and personality differentiation, seeded determinism, offense/defense choices, fallbacks, and 17-step AI regressions. Use after AI policy, difficulty mapping, personality, random-source, or decision changes, or when AI decisions are illegal, identical, unstable, or implausible; keep rules validation separate."
---

# Mahjong AI acceptance

Test AI as a controlled decision system, not by subjectively watching a few random games.

## Workflow

1. Identify the AI entry point, difficulty mapping, personality parameters, candidate-action source, and random source.
2. Use explicit game-state fixtures and fixed seeds.
3. Verify legality first: every chosen action must exist in the authoritative candidate set and obey the active mode, including 17-step rules.
4. Test invariants shared by all difficulties, then expected difficulty and personality differences across representative offense, defense, and pressure fixtures.
5. Separate deterministic policy changes from intentional weaker-level noise.
6. Test ties, empty candidates, missing features, invalid evaluation values, and safe fallback behavior.
7. Detect hidden nondeterminism from time or global RNG and hidden-information access not permitted to a real player.
8. Keep strategic AI expectations separate from rule legality; use `mahjong-rule-qa` only when the authoritative legal outcome itself is in question.

Avoid brittle tests that require one exact move when multiple moves are intentionally equivalent. Do require deterministic outputs when the policy and seed promise them.

## Output

Report legality, determinism, difficulty / personality differentiation, 17-step coverage, failed fixtures, and performance concerns separately.
