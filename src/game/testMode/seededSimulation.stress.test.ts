import { describe, expect, it } from 'vitest';
import { getRulePreset } from '../match/matchRules';
import { runSeededBatch } from './seededSimulation';

describe('STAB-010 default seeded stress', () => {
  it('runs 500 deterministic rounds with per-action invariants', async () => {
    const result = await runSeededBatch({ seed: 'stab-010-default-500', ruleConfig: getRulePreset('east-round'), rounds: 500 });
    expect(result.failure, result.failure ? JSON.stringify(result.failure, null, 2) : '').toBeUndefined();
    expect(result.completedRounds).toBe(500);
  }, 120_000);
});
