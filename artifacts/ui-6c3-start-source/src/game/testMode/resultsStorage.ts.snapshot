import type { TestCaseOutcome, TestCaseResult } from './catalog';

export const TEST_CASE_RESULTS_STORAGE_VERSION = 1 as const;
export const TEST_CASE_RESULTS_STORAGE_KEY = `local-mahjong.test-mode.case-results.v${TEST_CASE_RESULTS_STORAGE_VERSION}`;

interface StoredTestCaseResultsV1 {
  version: typeof TEST_CASE_RESULTS_STORAGE_VERSION;
  results: Record<string, TestCaseResult>;
}

export class TestCaseResultsStorage {
  constructor(private readonly storage: Storage) {}

  load(): Record<string, TestCaseResult> {
    try {
      const raw = this.storage.getItem(TEST_CASE_RESULTS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<StoredTestCaseResultsV1>;
      if (parsed.version !== TEST_CASE_RESULTS_STORAGE_VERSION || !parsed.results || typeof parsed.results !== 'object') return {};
      return Object.fromEntries(Object.entries(parsed.results).filter(([, result]) => isTestCaseResult(result)));
    } catch {
      return {};
    }
  }

  save(caseId: string, caseVersion: number, outcome: TestCaseOutcome, testedAt = new Date().toISOString()): Record<string, TestCaseResult> {
    const results = {
      ...this.load(),
      [caseId]: { caseId, caseVersion, outcome, testedAt },
    };
    const value: StoredTestCaseResultsV1 = { version: TEST_CASE_RESULTS_STORAGE_VERSION, results };
    this.storage.setItem(TEST_CASE_RESULTS_STORAGE_KEY, JSON.stringify(value));
    return results;
  }
}

function isTestCaseResult(value: unknown): value is TestCaseResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<TestCaseResult>;
  return typeof result.caseId === 'string'
    && Number.isInteger(result.caseVersion)
    && (result.outcome === 'passed' || result.outcome === 'failed' || result.outcome === 'blocked')
    && typeof result.testedAt === 'string';
}
