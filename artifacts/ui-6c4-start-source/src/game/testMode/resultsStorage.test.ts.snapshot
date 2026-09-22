import { describe, expect, it } from 'vitest';
import { CURRENT_MATCH_SAVE_KEY, REPLAY_INDEX_KEY, REPLAY_LIBRARY_KEY } from '../persistence/storageTypes';
import { filterTestCases, getTestCaseCatalog, getTestCaseStatus, summarizeTestCases } from './catalog';
import { TEST_CASE_RESULTS_STORAGE_KEY, TEST_CASE_RESULTS_STORAGE_VERSION, TestCaseResultsStorage } from './resultsStorage';

describe('测试用例目录与结果存储', () => {
  it('用独立版本化键保存通过、失败和阻塞结果，不写入普通存档或牌谱键', () => {
    const storage = new MemoryStorage();
    const store = new TestCaseResultsStorage(storage);
    store.save('STAB-001-ANKAN', 1, 'passed', '2026-08-03T01:02:03.000Z');
    store.save('STAB-001-MINKAN', 1, 'blocked', '2026-08-03T02:03:04.000Z');

    expect(storage.keys()).toEqual([TEST_CASE_RESULTS_STORAGE_KEY]);
    expect(storage.getItem(CURRENT_MATCH_SAVE_KEY)).toBeNull();
    expect(storage.getItem(REPLAY_LIBRARY_KEY)).toBeNull();
    expect(storage.getItem(REPLAY_INDEX_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(TEST_CASE_RESULTS_STORAGE_KEY)!)).toMatchObject({ version: TEST_CASE_RESULTS_STORAGE_VERSION });
    expect(store.load()['STAB-001-ANKAN']).toMatchObject({ outcome: 'passed', caseVersion: 1 });
    expect(store.load()['STAB-001-MINKAN']).toMatchObject({ outcome: 'blocked', caseVersion: 1 });
  });

  it('拒绝未知存储版本和结构错误的结果', () => {
    const storage = new MemoryStorage();
    storage.setItem(TEST_CASE_RESULTS_STORAGE_KEY, JSON.stringify({ version: 99, results: { bad: true } }));
    expect(new TestCaseResultsStorage(storage).load()).toEqual({});
  });

  it('用例版本变化后旧结果标记为需复验，并计入待测试', () => {
    const testCase = getTestCaseCatalog()[0];
    const oldResult = { caseId: testCase.id, caseVersion: testCase.version - 1, outcome: 'passed' as const, testedAt: '2026-08-03T00:00:00.000Z' };
    expect(getTestCaseStatus(testCase, oldResult)).toBe('needs-retest');
    expect(summarizeTestCases([testCase], { [testCase.id]: oldResult })).toEqual({ passed: 0, failed: 0, pending: 1, blocked: 0 });
  });

  it('按自动、视觉、混合类型，状态和关键词筛选', () => {
    const catalog = getTestCaseCatalog();
    const visual = filterTestCases(catalog, {}, { type: 'visual', status: 'all', keyword: '' });
    expect(visual.map((entry) => entry.id)).toEqual(['UI-RIICHI-DISCARD-WAIT-PREVIEW']);
    expect(filterTestCases(catalog, {}, { type: 'all', status: 'pending', keyword: '立直' }).map((entry) => entry.id)).toEqual([
      'RIICHI-DISCARD-MUST-TENPAI',
      'UI-RIICHI-DISCARD-WAIT-PREVIEW',
    ]);
    expect(new Set(catalog.map((entry) => entry.type))).toEqual(new Set(['automatic', 'visual', 'hybrid']));
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  keys(): string[] { return [...this.values.keys()]; }
}
