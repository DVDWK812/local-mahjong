import { describe, it, expect } from 'vitest';
import { SANMA_CASES, runSanmaCase } from './scenarios';
import { writeFileSync, mkdirSync } from 'node:fs';
describe('统一三人fixture registry：自动测试与测试Tab共用', () => {
  const rows: unknown[] = [];
  for (const t of SANMA_CASES) it(`${t.caseId} ${t.name}`, () => {
    const result = runSanmaCase(t); rows.push({ caseId: t.caseId, passed: result.passed, expected: result.expected, actual: result.actual, error: result.error });
    mkdirSync('artifacts/sanma-v1', { recursive: true }); writeFileSync('artifacts/sanma-v1/scenario-results.json', JSON.stringify(rows, null, 2));
    expect(result.passed, result.error).toBe(true);
  });
});
