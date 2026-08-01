import { describe, expect, it } from 'vitest';
import { getRulePreset } from '../match/matchRules';
import { runSeededBatch } from './seededSimulation';

describe('STAB-010 long seeded stress', () => {
  it('runs 5000 deterministic rounds with per-action invariants', async () => {
    const result = await runSeededBatch({ seed: 'stab-010-long-5000', ruleConfig: getRulePreset('east-round'), rounds: 5000 });
    expect(result.failure, result.failure ? JSON.stringify(result.failure, null, 2) : '').toBeUndefined();
    expect(result.completedRounds).toBe(5000);
  }, 600_000);
});
