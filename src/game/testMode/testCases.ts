import { parseTestScenarioJson, TestScenarioValidationError, validateTestScenario } from './scenario';
import { getBuiltInTestScenarios } from './builtInScenarios';
import { getP0RegressionTestCases } from './p0RegressionCases';
import { getStab005TestCases } from './stab005Cases';
import { getStab004TestCases } from './stab004Cases';
import { getStab006TestCases } from './stab006Cases';
import { getStab007TestCases } from './stab007Cases';
import { getStab008TestCases } from './stab008Cases';
import { getStab009TestCases } from './stab009Cases';
import { getStab012TestCases } from './stab012Cases';
import { normalizeReplayRecord } from '../persistence/replayRecord';
import { deserializeMatchLog } from '../replay/serialization';
import {
  TEST_CASE_CATEGORIES,
  TEST_CASE_DEFINITION_VERSION,
  type ImportValidationTestCase,
  type PersistenceTestCase,
  type PlayableTestCase,
  type ReplayTestCase,
  type SeededRunTestCase,
  type TestCaseCategory,
  type TestCaseDefinitionV1,
  type TestCaseKind,
  type TestCaseRunResultV1,
  type UiInteractionTestCase,
} from './types';

export const TEST_CASE_CATEGORY_LABELS: Record<TestCaseCategory, string> = {
  'game-rules': '对局规则',
  'scoring-settlement': '计分与结算',
  'replay-hidden-information': '牌谱与隐藏信息',
  'persistence-migration': '存档与迁移',
  'import-version': '导入与版本',
  'random-stress': '随机与压力',
  'ui-keyboard': '界面与键盘',
  'stab-001-legacy': 'STAB-001旧场景',
};

export const TEST_CASE_KIND_LABELS: Record<TestCaseKind, string> = {
  playable: '可操作对局',
  replay: '牌谱检查',
  persistence: '存档检查',
  'import-validation': '导入校验',
  'seeded-run': '固定种子运行',
  'ui-interaction': '界面交互',
};

export const TEST_CASE_STATUS_LABELS = {
  'not-run': '未运行',
  running: '运行中',
  passed: '通过',
  failed: '失败',
  'manual-confirmation': '需人工确认',
} as const;

export interface TestStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TestCaseExecutionContext {
  storage: TestStorageAdapter;
  seededRunner?: (testCase: SeededRunTestCase) => Promise<string[]> | string[];
  uiRunner?: (testCase: UiInteractionTestCase) => Promise<string[]> | string[];
  replayRunner?: (testCase: ReplayTestCase) => Promise<string[]> | string[];
  replayRunners?: Record<string, (testCase: ReplayTestCase) => Promise<string[]> | string[]>;
  persistenceRunners?: Record<string, (testCase: PersistenceTestCase, storage: TestStorageAdapter) => Promise<string[]> | string[]>;
}

export type TestCaseExecutor<T extends TestCaseDefinitionV1 = TestCaseDefinitionV1> = (
  testCase: T,
  context: TestCaseExecutionContext,
) => Promise<TestCaseRunResultV1> | TestCaseRunResultV1;

export interface TestCaseExecutors {
  playable: TestCaseExecutor<PlayableTestCase>;
  replay: TestCaseExecutor<ReplayTestCase>;
  persistence: TestCaseExecutor<PersistenceTestCase>;
  'import-validation': TestCaseExecutor<ImportValidationTestCase>;
  'seeded-run': TestCaseExecutor<SeededRunTestCase>;
  'ui-interaction': TestCaseExecutor<UiInteractionTestCase>;
}

export function playableTestCaseFromScenario(scenario: PlayableTestCase['scenario']): PlayableTestCase {
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    relatedAuditId: scenario.relatedAuditId,
    category: 'stab-001-legacy',
    kind: 'playable',
    scenario,
    expectedResults: (scenario.expectedCheckpoints ?? []).map((checkpoint) => checkpoint.description),
    manualSteps: [...scenario.instructions],
    tags: ['对局', '杠', '确定性', scenario.relatedAuditId ?? ''].filter(Boolean),
  };
}

export function getBuiltInTestCases(): TestCaseDefinitionV1[] {
  const legacy = getBuiltInTestScenarios().map(playableTestCaseFromScenario);
  return [
    ...legacy,
    ...getP0RegressionTestCases(),
    ...getStab004TestCases(),
    ...getStab005TestCases(),
    ...getStab006TestCases(),
    ...getStab007TestCases(),
    ...getStab008TestCases(),
    ...getStab009TestCases(),
    ...getStab012TestCases(),
    commonCase<ReplayTestCase>({
      id: 'REPLAY-HIDDEN-INFORMATION-MANUAL',
      name: '牌谱隐藏信息人工验收',
      description: '按四家视角检查暗摸牌、未来牌墙和未公开里宝的显示权限。',
      relatedAuditId: 'STAB-003',
      category: 'replay-hidden-information',
      kind: 'replay',
      expectedResults: ['普通视角不泄漏隐藏实例', '全牌公开只在显式开启后生效'],
      manualSteps: ['导入目标测试牌谱', '逐步前进并切换四家视角', '核对牌山抽屉正反面'],
      tags: ['牌谱', '隐藏信息', '人工'],
    }),
    commonCase<PersistenceTestCase>({
      id: 'PERSISTENCE-ADAPTER-ROUNDTRIP',
      name: '测试存储适配器往返',
      description: '仅在测试内存适配器中验证写入、读取与删除，不接触普通存档。',
      relatedAuditId: 'STAB-008',
      category: 'persistence-migration',
      kind: 'persistence',
      operation: 'round-trip',
      storageKey: 'test-mode/persistence-roundtrip',
      fixtureJson: JSON.stringify({ version: 1, source: 'test-mode' }),
      expectedResults: ['读取内容与写入内容一致', '删除后键不存在'],
      manualSteps: [],
      tags: ['存档', '隔离', '自动'],
    }),
    commonCase<ImportValidationTestCase>({
      id: 'IMPORT-UNKNOWN-SCENARIO-VERSION',
      name: '未知场景版本拒绝',
      description: '确认 TestScenario 未知版本不会按 V1 静默加载。',
      relatedAuditId: 'STAB-009',
      category: 'import-version',
      kind: 'import-validation',
      format: 'test-scenario-v1',
      inputJson: JSON.stringify({ version: 999 }),
      expectValid: false,
      expectedResults: ['输入被明确拒绝'],
      manualSteps: [],
      tags: ['导入', '版本', '自动'],
    }),
    commonCase<SeededRunTestCase>({
      id: 'SEEDED-RUN-BASELINE',
      name: 'STAB-010固定种子500局',
      description: '使用统一确定性随机源运行500局，并在每个正式动作后检查状态不变量。',
      relatedAuditId: 'STAB-010',
      category: 'random-stress',
      kind: 'seeded-run',
      seed: 'stability-baseline-001',
      iterations: 500,
      runnerId: 'full-match-seeded-v1',
      expectedResults: ['相同种子产生等价动作与结果', '每步不变量通过'],
      manualSteps: ['运行用例或在随机与压力面板输入seed', '失败时导出种子、动作索引和场景JSON'],
      tags: ['随机', '压力', '自动'],
    }),
    commonCase<UiInteractionTestCase>({
      id: 'UI-DIALOG-KEYBOARD-MANUAL',
      name: '界面与键盘实验室',
      description: '使用四类真实弹窗检查 Tab、Shift+Tab、Escape、背景点击、滚动锁定和关闭后焦点恢复。',
      relatedAuditId: 'STAB-011',
      category: 'ui-keyboard',
      kind: 'ui-interaction',
      route: '/',
      steps: [
        { action: 'click', target: '打开弹窗的按钮' },
        { action: 'key', value: 'Tab' },
        { action: 'key', value: 'Escape' },
        { action: 'assert-focus', target: '打开弹窗的按钮' },
      ],
      expectedResults: ['焦点不进入背景', '不可关闭弹窗不响应Escape或背景点击', '退出取消后焦点恢复到触发按钮'],
      manualSteps: ['在界面与键盘实验室依次打开四类弹窗', '循环Tab与Shift+Tab并核对当前焦点', '按面板预期检查Escape和背景点击', '关闭后核对返回元素'],
      tags: ['界面', '键盘', '人工'],
    }),
  ].map(cloneTestCase);
}

export function parseTestCaseDefinitionJson(json: string): TestCaseDefinitionV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`不是有效JSON：${error instanceof Error ? error.message : '解析失败'}`);
  }
  const errors = validateTestCaseDefinition(parsed);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return cloneTestCase(parsed as TestCaseDefinitionV1);
}

export function validateTestCaseDefinition(input: unknown): string[] {
  if (!isRecord(input)) return ['$：用例必须是对象'];
  const errors: string[] = [];
  if (input.version !== TEST_CASE_DEFINITION_VERSION) errors.push(`version：仅支持版本${TEST_CASE_DEFINITION_VERSION}`);
  for (const key of ['id', 'name', 'description'] as const) {
    if (typeof input[key] !== 'string' || !input[key].trim()) errors.push(`${key}：必须是非空字符串`);
  }
  if (!TEST_CASE_CATEGORIES.includes(input.category as TestCaseCategory)) errors.push('category：未知用例分类');
  for (const key of ['expectedResults', 'manualSteps', 'tags'] as const) {
    if (!isStringArray(input[key])) errors.push(`${key}：必须是字符串数组`);
  }

  if (input.kind === 'playable') {
    const validation = validateTestScenario(input.scenario);
    validation.issues.forEach((issue) => errors.push(`scenario.${issue.path}：${issue.message}`));
  } else if (input.kind === 'replay') {
    if (input.replay !== undefined && !isRecord(input.replay)) errors.push('replay：必须是可序列化牌谱记录');
  } else if (input.kind === 'persistence') {
    if (!['round-trip', 'write-failure', 'read-failure', 'remove-failure'].includes(String(input.operation))) errors.push('operation：未知存储操作');
    if (typeof input.storageKey !== 'string' || !input.storageKey) errors.push('storageKey：必须是非空字符串');
    if (typeof input.fixtureJson !== 'string') errors.push('fixtureJson：必须是字符串');
  } else if (input.kind === 'import-validation') {
    if (!['test-scenario-v1', 'test-case-v1', 'replay-record', 'raw-match-log', 'json'].includes(String(input.format))) errors.push('format：未知导入格式');
    if (typeof input.inputJson !== 'string') errors.push('inputJson：必须是字符串');
    if (typeof input.expectValid !== 'boolean') errors.push('expectValid：必须是布尔值');
  } else if (input.kind === 'seeded-run') {
    if (typeof input.seed !== 'string' || !input.seed) errors.push('seed：必须是非空字符串');
    if (!Number.isInteger(input.iterations) || Number(input.iterations) <= 0) errors.push('iterations：必须是正整数');
    if (typeof input.runnerId !== 'string' || !input.runnerId) errors.push('runnerId：必须是非空字符串');
  } else if (input.kind === 'ui-interaction') {
    if (typeof input.route !== 'string') errors.push('route：必须是字符串');
    if (!Array.isArray(input.steps)) errors.push('steps：必须是数组');
  } else {
    errors.push('kind：未知用例类型');
  }
  return errors;
}

export async function executeTestCase(
  testCase: TestCaseDefinitionV1,
  context: TestCaseExecutionContext,
  executors: TestCaseExecutors = createDefaultTestCaseExecutors(),
): Promise<TestCaseRunResultV1> {
  switch (testCase.kind) {
    case 'playable': return executors.playable(testCase, context);
    case 'replay': return executors.replay(testCase, context);
    case 'persistence': return executors.persistence(testCase, context);
    case 'import-validation': return executors['import-validation'](testCase, context);
    case 'seeded-run': return executors['seeded-run'](testCase, context);
    case 'ui-interaction': return executors['ui-interaction'](testCase, context);
  }
}

export function createDefaultTestCaseExecutors(): TestCaseExecutors {
  return {
    playable: (testCase) => manualResult(testCase, '在正式牌桌中按步骤继续操作'),
    replay: async (testCase, context) => {
      const runner = (testCase.runnerId ? context.replayRunners?.[testCase.runnerId] : undefined) ?? context.replayRunner;
      return runner
        ? passedResult(testCase, '牌谱执行器', await runner(testCase))
        : manualResult(testCase, testCase.replay ? '打开附带牌谱并逐步检查' : '导入目标牌谱后逐步检查');
    },
    persistence: async (testCase, context) => {
      const runner = testCase.runnerId ? context.persistenceRunners?.[testCase.runnerId] : undefined;
      return runner
        ? passedResult(testCase, '存档回归执行器', await runner(testCase, context.storage))
        : runPersistenceCase(testCase, context);
    },
    'import-validation': runImportValidationCase,
    'seeded-run': async (testCase, context) => context.seededRunner
      ? passedResult(testCase, `固定种子 ${testCase.seed}`, await context.seededRunner(testCase))
      : manualResult(testCase, `尚未注入运行器 ${testCase.runnerId}`),
    'ui-interaction': async (testCase, context) => context.uiRunner
      ? passedResult(testCase, `界面路径 ${testCase.route}`, await context.uiRunner(testCase))
      : manualResult(testCase, `在 ${testCase.route} 按步骤人工验收`),
  };
}

export type TestStorageFailureMode = 'none' | 'get-error' | 'set-security' | 'set-quota' | 'set-error' | 'remove-error';

export function createMemoryTestStorage(failureMode: TestStorageFailureMode = 'none'): TestStorageAdapter {
  const values = new Map<string, string>();
  return {
    getItem: (key) => {
      if (failureMode === 'get-error') throw testStorageError('SecurityError', '测试适配器模拟读取失败');
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (failureMode === 'set-security') throw testStorageError('SecurityError', '测试适配器模拟安全限制');
      if (failureMode === 'set-quota') throw testStorageError('QuotaExceededError', '测试适配器模拟配额耗尽');
      if (failureMode === 'set-error') throw testStorageError('Error', '测试适配器模拟普通写入错误');
      values.set(key, value);
    },
    removeItem: (key) => {
      if (failureMode === 'remove-error') throw testStorageError('SecurityError', '测试适配器模拟删除失败');
      values.delete(key);
    },
  };
}

function testStorageError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function serializeTestCaseRunResult(result: TestCaseRunResultV1): string {
  return JSON.stringify(result, null, 2);
}

export function failureReportFromResult(testCase: TestCaseDefinitionV1, result: TestCaseRunResultV1): string {
  return JSON.stringify({
    caseId: result.caseId,
    relatedAuditId: result.relatedAuditId,
    currentStep: result.currentStep,
    expected: result.expected,
    actual: result.actual,
    stateSummary: result.stateSummary,
    definition: testCase,
    artifacts: result.artifacts ?? [],
  }, null, 2);
}

function runPersistenceCase(testCase: PersistenceTestCase, context: TestCaseExecutionContext): TestCaseRunResultV1 {
  try {
    if (testCase.operation === 'round-trip') {
      context.storage.setItem(testCase.storageKey, testCase.fixtureJson);
      const actual = context.storage.getItem(testCase.storageKey);
      context.storage.removeItem(testCase.storageKey);
      const removed = context.storage.getItem(testCase.storageKey);
      if (actual !== testCase.fixtureJson || removed !== null) return failedResult(testCase, '测试存储适配器往返', [`读取=${actual}`, `删除后=${removed}`]);
      return passedResult(testCase, '测试存储适配器往返', ['读取内容一致', '删除后键不存在']);
    }
    const operation = testCase.operation.split('-')[0];
    try {
      if (operation === 'write') context.storage.setItem(testCase.storageKey, testCase.fixtureJson);
      if (operation === 'read') context.storage.getItem(testCase.storageKey);
      if (operation === 'remove') context.storage.removeItem(testCase.storageKey);
      return failedResult(testCase, `模拟${operation}失败`, ['适配器没有按用例预期抛错']);
    } catch (error) {
      return passedResult(testCase, `模拟${operation}失败`, [`错误已隔离：${error instanceof Error ? error.message : '未知错误'}`]);
    }
  } catch (error) {
    return failedResult(testCase, '测试存储适配器执行', [error instanceof Error ? error.message : '未知错误']);
  }
}

function runImportValidationCase(testCase: ImportValidationTestCase): TestCaseRunResultV1 {
  let valid = false;
  let detail = '通过';
  try {
    if (testCase.format === 'test-scenario-v1') parseTestScenarioJson(testCase.inputJson);
    else if (testCase.format === 'test-case-v1') parseTestCaseDefinitionJson(testCase.inputJson);
    else if (testCase.format === 'replay-record') normalizeReplayRecord(JSON.parse(testCase.inputJson));
    else if (testCase.format === 'raw-match-log') deserializeMatchLog(testCase.inputJson);
    else JSON.parse(testCase.inputJson);
    valid = true;
  } catch (error) {
    detail = error instanceof TestScenarioValidationError || error instanceof Error ? error.message : '未知导入错误';
  }
  return valid === testCase.expectValid
    ? passedResult(testCase, '导入与版本校验', [valid ? '输入被接受' : `输入被拒绝：${detail}`])
    : failedResult(testCase, '导入与版本校验', [`预期valid=${testCase.expectValid}，实际valid=${valid}`, detail]);
}

function manualResult(testCase: TestCaseDefinitionV1, stateSummary: string): TestCaseRunResultV1 {
  return baseResult(testCase, 'manual-confirmation', '等待人工步骤', ['尚未提交人工结论'], stateSummary);
}

function passedResult(testCase: TestCaseDefinitionV1, currentStep: string, actual: string[]): TestCaseRunResultV1 {
  return baseResult(testCase, 'passed', currentStep, actual, '执行器完成且未报告失败');
}

function failedResult(testCase: TestCaseDefinitionV1, currentStep: string, actual: string[]): TestCaseRunResultV1 {
  return baseResult(testCase, 'failed', currentStep, actual, '测试用例执行失败');
}

function baseResult(
  testCase: TestCaseDefinitionV1,
  status: TestCaseRunResultV1['status'],
  currentStep: string,
  actual: string[],
  stateSummary: string,
): TestCaseRunResultV1 {
  return {
    version: 1,
    caseId: testCase.id,
    relatedAuditId: testCase.relatedAuditId ?? null,
    status,
    currentStep,
    expected: [...testCase.expectedResults],
    actual,
    stateSummary,
    artifacts: [{ name: `${testCase.id}.test-case.json`, mediaType: 'application/json', content: JSON.stringify(testCase, null, 2) }],
  };
}

function commonCase<T extends TestCaseDefinitionV1>(testCase: Omit<T, 'version'>): T {
  return { version: TEST_CASE_DEFINITION_VERSION, ...testCase } as T;
}

function cloneTestCase<T extends TestCaseDefinitionV1>(testCase: T): T {
  return JSON.parse(JSON.stringify(testCase)) as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
