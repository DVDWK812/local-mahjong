import { it, expect } from 'vitest';
import { sanmaEvidenceStale } from './evidence';
it('old auto and manual passes need revalidation without changing stored manual results', () => {
  const old = Object.freeze({ code: { fingerprint: 'old' }, ruleVersion: 'v1', fingerprint: 'case', automatic: '通过', manual: '通过' });
  const current = { code: 'new', ruleVersion: 'v1', fingerprint: 'case' };
  const stale = sanmaEvidenceStale(old, current);
  expect(stale ? '需复验' : old.automatic).toBe('需复验');
  expect(stale ? '待核查' : old.manual).toBe('待核查');
  expect(old.manual).toBe('通过');
  expect(sanmaEvidenceStale(old, { ...current, code: 'old' })).toBe(false);
  expect(sanmaEvidenceStale(old, { ...current, code: 'old', fingerprint: 'changed-fixture' })).toBe(true);
});
