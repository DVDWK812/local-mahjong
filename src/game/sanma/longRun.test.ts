import { describe, it, expect } from 'vitest';
import { runSanmaMatch } from './longRun';
import { writeFileSync, mkdirSync } from 'node:fs';
const rows: unknown[] = [];
describe('SANMA-5 固定seed整场（同一合法命令接口）', () => {
  for (const length of ['east-only', 'hanchan'] as const) for (const policy of ['loss', 'split_missing_share_ceil100'] as const) {
    for (let seed = 1; seed <= 10; seed++) it(`${length}/${policy}/seed=${seed}`, () => {
      const result = runSanmaMatch(seed, length, policy);
      expect([result.startingPoints, result.targetPoints, result.returnPoints]).toEqual([35000, 40000, 40000]);
      expect(result.actionSources.policy).toBeGreaterThan(0); expect(result.actionSources.timeout).toBe(0);
      expect(result.state.completed).toBe(true); expect(result.scores.reduce((a, b) => a + b)).toBe(105000);
      const { state: _, ...record } = result; rows.push(record);
      mkdirSync('test-results/sanma-closeout', { recursive: true }); writeFileSync('test-results/sanma-closeout/long-run-results.json', JSON.stringify(rows, null, 2));
    }, 120000);
  }
});
