import {
  getRulePreset,
  loadStoredRuleConfigResult,
  removeStoredRuleConfig,
  RULE_CONFIG_STORAGE_KEY,
  saveStoredRuleConfig,
  type RuleConfigStorageAdapter,
} from '../match/matchRules';
import { createMemoryTestStorage, type TestStorageFailureMode, type TestStorageAdapter } from './testCases';
import { TEST_CASE_DEFINITION_VERSION, type PersistenceTestCase } from './types';

export const STAB008_TEST_CASE_IDS = [
  'STAB-008-GET-FAILURE',
  'STAB-008-SET-SECURITY-ERROR',
  'STAB-008-SET-QUOTA-ERROR',
  'STAB-008-REMOVE-FAILURE',
] as const;

const RUNNER_ID = 'stab-008-storage-failure';
const originalConfig = getRulePreset('south-round');
const nextConfig = {
  ...getRulePreset('east-round'),
  match: { ...getRulePreset('east-round').match, targetPoints: 32000 },
};

export function getStab008TestCases(): PersistenceTestCase[] {
  return [
    storageCase(STAB008_TEST_CASE_IDS[0], '读取失败', 'read-failure'),
    storageCase(STAB008_TEST_CASE_IDS[1], 'SecurityError写入失败', 'write-failure'),
    storageCase(STAB008_TEST_CASE_IDS[2], 'QuotaExceededError写入失败', 'write-failure'),
    storageCase(STAB008_TEST_CASE_IDS[3], '删除失败', 'remove-failure'),
  ];
}

export const stab008PersistenceRunners: Record<string, (testCase: PersistenceTestCase, storage: TestStorageAdapter) => Promise<string[]>> = {
  [RUNNER_ID]: async (testCase) => runStorageFailureCase(testCase),
};

function runStorageFailureCase(testCase: PersistenceTestCase): string[] {
  const mode = failureModeFor(testCase.id);
  const backing = createMemoryTestStorage();
  backing.setItem(RULE_CONFIG_STORAGE_KEY, JSON.stringify({ version: 1, config: originalConfig }));
  const failing = failureAdapter(mode, backing);

  if (testCase.id === STAB008_TEST_CASE_IDS[0]) {
    const result = loadStoredRuleConfigResult(failing);
    if (result.ok || result.error.operation !== 'read') throw new Error('读取失败未返回统一错误');
    return [`模拟：${result.error.kind}`, '读取错误：已捕获', `回退配置：${result.config.match.matchLength}`, '页面可继续：是'];
  }

  const before = backing.getItem(RULE_CONFIG_STORAGE_KEY);
  if (testCase.id === STAB008_TEST_CASE_IDS[3]) {
    const result = removeStoredRuleConfig(failing);
    if (result.ok || result.error.operation !== 'remove') throw new Error('删除失败未返回统一错误');
    if (backing.getItem(RULE_CONFIG_STORAGE_KEY) !== before) throw new Error('删除失败清空了原配置');
    return [`模拟：${result.error.kind}`, '删除错误：已捕获', '原有配置：已保留', '页面可继续：是'];
  }

  let inMemoryConfig = originalConfig;
  inMemoryConfig = nextConfig;
  const result = saveStoredRuleConfig(inMemoryConfig, failing);
  if (result.ok || result.error.operation !== 'write') throw new Error('写入失败未返回统一错误');
  if (backing.getItem(RULE_CONFIG_STORAGE_KEY) !== before) throw new Error('写入失败覆盖了原配置');
  return [
    `模拟：${result.error.kind}`,
    '写入错误：已捕获',
    `内存设置：目标点${inMemoryConfig.match.targetPoints}（已生效）`,
    '原有持久化配置：已保留',
    '非阻断提示：应显示',
    '页面可继续：是',
  ];
}

function storageCase(id: string, name: string, operation: PersistenceTestCase['operation']): PersistenceTestCase {
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name: `STAB-008 ${name}`,
    description: '使用测试模式专用Storage适配器模拟失败，不读写window.localStorage。',
    relatedAuditId: 'STAB-008',
    category: 'persistence-migration',
    kind: 'persistence',
    runnerId: RUNNER_ID,
    operation,
    storageKey: RULE_CONFIG_STORAGE_KEY,
    fixtureJson: JSON.stringify({ version: 1, config: originalConfig }, null, 2),
    expectedResults: ['异常不逃逸', '页面可继续', '原有持久化配置不被清空'],
    manualSteps: ['在“模拟存储失败”面板选择对应故障。', '运行用例并核对统一错误、内存设置和原配置状态。'],
    tags: ['STAB-008', '存档与迁移', 'Storage', '隔离', '自动'],
  };
}

function failureModeFor(id: string): TestStorageFailureMode {
  if (id === STAB008_TEST_CASE_IDS[0]) return 'get-error';
  if (id === STAB008_TEST_CASE_IDS[1]) return 'set-security';
  if (id === STAB008_TEST_CASE_IDS[2]) return 'set-quota';
  return 'remove-error';
}

function failureAdapter(mode: TestStorageFailureMode, backing: TestStorageAdapter): RuleConfigStorageAdapter {
  const failures = createMemoryTestStorage(mode);
  return {
    getItem: mode === 'get-error' ? failures.getItem : backing.getItem,
    setItem: mode.startsWith('set-') ? failures.setItem : backing.setItem,
    removeItem: mode === 'remove-error' ? failures.removeItem : backing.removeItem,
  };
}
