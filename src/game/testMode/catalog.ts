import { getBuiltInTestScenarios } from './builtInScenarios';
import type { TestScenarioV1 } from './types';

export type TestCaseType = 'automatic' | 'visual' | 'hybrid';
export type TestCaseOutcome = 'passed' | 'failed' | 'blocked';
export type TestCaseStatus = 'pending' | TestCaseOutcome | 'needs-retest';

export interface TestCaseResult {
  caseId: string;
  caseVersion: number;
  outcome: TestCaseOutcome;
  testedAt: string;
}

export interface TestCaseDefinition {
  id: string;
  version: number;
  type: TestCaseType;
  scenario: TestScenarioV1;
  keywords: string[];
  steps: string[];
  expectedResults: string[];
  manualChecks: string[];
}

export interface TestCaseFilters {
  type: 'all' | TestCaseType;
  status: 'all' | TestCaseStatus;
  keyword: string;
}

export interface TestCaseStats {
  passed: number;
  failed: number;
  pending: number;
  blocked: number;
}

const CASE_METADATA: Record<string, Omit<TestCaseDefinition, 'id' | 'scenario' | 'steps'>> = {
  'STAB-001-ANKAN': {
    version: 1,
    type: 'automatic',
    keywords: ['暗杠', '岭上牌', '宝牌', '牌墙'],
    expectedResults: ['正式引擎允许暗杠，岭上牌、宝牌槽与活牌数量通过自动不变量。'],
    manualChecks: [],
  },
  'STAB-001-MINKAN': {
    version: 1,
    type: 'hybrid',
    keywords: ['明杠', '鸣牌', 'claimed', '岭上牌'],
    expectedResults: ['鸣牌窗口显示“明杠”，执行后副露、claimed 历史、岭上牌和宝牌槽一致。'],
    manualChecks: ['确认被鸣牌方向正确。', '确认牌河保留被鸣位置且没有重复牌面。'],
  },
  'STAB-001-KAKAN': {
    version: 1,
    type: 'hybrid',
    keywords: ['加杠', '抢杠', '副露', '岭上牌'],
    expectedResults: ['碰副露升级为加杠，抢杠窗口、岭上牌和宝牌槽符合当前状态。'],
    manualChecks: ['确认加杠牌在原碰副露中的视觉位置正确。', '如出现抢杠提示，确认按钮与牌图清晰。'],
  },
  'STAB-001-FOUR-KANS': {
    version: 1,
    type: 'hybrid',
    keywords: ['连续四杠', '岭上牌', '宝牌', '牌墙'],
    expectedResults: ['四次杠依次使用固定岭上槽和表宝槽，每次活牌墙减少一张。'],
    manualChecks: ['逐次确认公开宝牌数量与牌面。', '确认第四次杠后的提示和终止状态可读。'],
  },
  'UI-RIICHI-WAIT-PREVIEW': {
    version: 1,
    type: 'visual',
    keywords: ['立直', '听牌', '剩余枚数', '悬停'],
    expectedResults: ['悬停不同立直候选时，听牌与剩余枚数立即更新；移出后提示消失。'],
    manualChecks: ['候选切换无残留或闪烁。', '提示框不遮挡立直候选。', '点击候选后仍按原流程立直并弃牌。'],
  },
  'RULE-MINIMUM-HAN-2': minimumHanMetadata(2),
  'RULE-MINIMUM-HAN-3': minimumHanMetadata(3),
  'RULE-MINIMUM-HAN-4': minimumHanMetadata(4),
  'RULE-MINIMUM-HAN-5': minimumHanMetadata(5),
};

function minimumHanMetadata(minimumHan: 2 | 3 | 4 | 5): Omit<TestCaseDefinition, 'id' | 'scenario' | 'steps'> {
  const label = minimumHan === 5 ? '满贯缚' : `${minimumHan}番缚`;
  return {
    version: 1,
    type: 'hybrid',
    keywords: [label, '听牌', '番数不足', '和牌限制'],
    expectedResults: [`低于${label}仍显示听牌并标记“番数不足”；等于及高于门槛的牌型显示为可和。`],
    manualChecks: ['三家听牌及剩余枚数均可见。', '切换视角后提示立即对应当前玩家。', '宝牌、里宝牌和赤宝牌不改变门槛判定。'],
  };
}

export function getTestCaseCatalog(): TestCaseDefinition[] {
  return getBuiltInTestScenarios().map((scenario) => {
    const metadata = CASE_METADATA[scenario.id];
    if (!metadata) throw new Error(`缺少测试用例元数据：${scenario.id}`);
    return {
      id: scenario.id,
      scenario,
      steps: [...scenario.instructions],
      ...metadata,
    };
  });
}

export function createImportedTestCase(scenario: TestScenarioV1): TestCaseDefinition {
  return {
    id: scenario.id,
    version: 1,
    type: 'hybrid',
    scenario,
    keywords: ['导入', scenario.name, scenario.relatedAuditId ?? ''].filter(Boolean),
    steps: [...scenario.instructions],
    expectedResults: ['场景通过字段校验，并且后续动作仅由正式规则引擎执行。'],
    manualChecks: ['按导入场景说明核对界面结果。'],
  };
}

export function getTestCaseStatus(testCase: TestCaseDefinition, result?: TestCaseResult): TestCaseStatus {
  if (!result) return 'pending';
  return result.caseVersion === testCase.version ? result.outcome : 'needs-retest';
}

export function summarizeTestCases(testCases: TestCaseDefinition[], results: Record<string, TestCaseResult>): TestCaseStats {
  return testCases.reduce<TestCaseStats>((stats, testCase) => {
    const status = getTestCaseStatus(testCase, results[testCase.id]);
    if (status === 'needs-retest' || status === 'pending') stats.pending += 1;
    else stats[status] += 1;
    return stats;
  }, { passed: 0, failed: 0, pending: 0, blocked: 0 });
}

export function filterTestCases(testCases: TestCaseDefinition[], results: Record<string, TestCaseResult>, filters: TestCaseFilters): TestCaseDefinition[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase('zh-CN');
  return testCases.filter((testCase) => {
    if (filters.type !== 'all' && testCase.type !== filters.type) return false;
    if (filters.status !== 'all' && getTestCaseStatus(testCase, results[testCase.id]) !== filters.status) return false;
    if (!keyword) return true;
    const haystack = [testCase.id, testCase.scenario.name, testCase.scenario.description, ...testCase.keywords].join(' ').toLocaleLowerCase('zh-CN');
    return haystack.includes(keyword);
  });
}
