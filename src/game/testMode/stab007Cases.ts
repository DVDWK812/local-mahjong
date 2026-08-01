import { startMatch } from '../match/matchEngine';
import { getRulePreset } from '../match/matchRules';
import { migrateSavedMatch } from '../persistence/migration';
import { CURRENT_SAVE_VERSION, type SavedMatch } from '../persistence/storageTypes';
import { validateSavedMatch } from '../persistence/storageValidation';
import { createInitialMatchLog } from '../replay/eventRecorder';
import type { TestStorageAdapter } from './testCases';
import { TEST_CASE_DEFINITION_VERSION, type PersistenceTestCase } from './types';

export const STAB007_TEST_CASE_IDS = [
  'STAB-007-MISSING-APPLIED-ROUND-IDS',
  'STAB-007-MISSING-SCORE-HISTORY',
  'STAB-007-MISSING-RULE-CONFIG',
  'STAB-007-MINIMAL-V1-SAVE',
] as const;

const RUNNER_ID = 'stab-007-v1-normalization';
const MINIMAL_DIFF_PATHS = [
  'matchState.appliedRoundIds',
  'matchState.scoreHistory',
  'matchState.currentMatchIndex',
  'matchState.matchResults',
  'matchState.aggregateScores',
  'ruleConfig',
] as const;

export function getStab007TestCases(): PersistenceTestCase[] {
  const applied = legacyFixture((save) => { delete save.matchState.appliedRoundIds; });
  const history = legacyFixture((save) => { delete save.matchState.scoreHistory; });
  const rules = legacyFixture((save) => {
    delete save.ruleConfig;
    delete save.matchState.ruleConfig;
    delete save.matchLog.ruleConfig;
    delete save.gameState.ruleConfig;
    delete save.gameState.matchRuleConfig;
    delete save.matchState.currentGame.ruleConfig;
    delete save.matchState.currentGame.matchRuleConfig;
  });
  const minimal = legacyFixture((save) => {
    MINIMAL_DIFF_PATHS.forEach((path) => deletePath(save, path));
    delete save.matchState.ruleConfig;
    delete save.matchLog.ruleConfig;
    for (const gamePath of ['gameState', 'matchState.currentGame']) {
      for (const field of ['pendingCall', 'pendingRon', 'pendingKakan', 'kanState', 'callsOccurred', 'firstTurnInterrupted', 'playerDrawCounts', 'playerDiscardCounts', 'lastWinSource', 'lastLiveWallDiscarder', 'pendingAbortiveDrawAfterFourthKan', 'kuikaeForbiddenTileIds', 'ruleConfig', 'matchRuleConfig']) {
        deletePath(save, `${gamePath}.${field}`);
      }
    }
  });
  return [
    persistenceCase(STAB007_TEST_CASE_IDS[0], '缺少 appliedRoundIds', applied, ['matchState.appliedRoundIds']),
    persistenceCase(STAB007_TEST_CASE_IDS[1], '缺少 scoreHistory', history, ['matchState.scoreHistory']),
    persistenceCase(STAB007_TEST_CASE_IDS[2], '缺少完整 ruleConfig', rules, ['ruleConfig', 'matchState.ruleConfig', 'matchLog.ruleConfig']),
    persistenceCase(STAB007_TEST_CASE_IDS[3], '最小可恢复 v1 存档', minimal, [...MINIMAL_DIFF_PATHS]),
  ];
}

export const stab007PersistenceRunners: Record<string, (testCase: PersistenceTestCase, storage: TestStorageAdapter) => Promise<string[]>> = {
  [RUNNER_ID]: async (testCase) => {
    const before = JSON.parse(testCase.fixtureJson) as Record<string, unknown>;
    const paths = pathsFor(testCase.id);
    const migrated = migrateSavedMatch(before);
    validateSavedMatch(migrated);
    const normalized = migrated as unknown as Record<string, unknown>;
    return [
      ...paths.map((path) => `迁移前 ${path}=${formatValue(readPath(before, path))}`),
      ...paths.map((path) => `迁移后 ${path}=${formatValue(readPath(normalized, path))}`),
      '验证结果：通过',
    ];
  },
};

function persistenceCase(id: string, name: string, fixture: Record<string, unknown>, paths: readonly string[]): PersistenceTestCase {
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name: `STAB-007 ${name}`,
    description: '加载 version 1 旧存档，显示迁移前后字段差异并运行正式存档验证。',
    relatedAuditId: 'STAB-007',
    category: 'persistence-migration',
    kind: 'persistence',
    runnerId: RUNNER_ID,
    operation: 'round-trip',
    storageKey: `test-mode/${id.toLowerCase()}`,
    fixtureJson: JSON.stringify(fixture, null, 2),
    expectedResults: [...paths.map((path) => `${path}得到安全默认值`), '验证结果为通过'],
    manualSteps: ['运行自动检查。', '展开实际结果，对照“迁移前”和“迁移后”字段。', '确认验证结果为通过。'],
    tags: ['STAB-007', '存档兼容', 'v1', '迁移', '自动'],
  };
}

function baseSave(): SavedMatch {
  const ruleConfig = getRulePreset('east-round');
  const matchState = startMatch(ruleConfig.match);
  return {
    version: CURRENT_SAVE_VERSION,
    saveId: 'STAB-007-v1-save',
    savedAt: new Date(0).toISOString(),
    matchState,
    gameState: matchState.currentGame,
    matchLog: createInitialMatchLog({
      matchId: 'STAB-007-v1-save',
      initialDealer: matchState.initialDealer,
      initialScores: matchState.scores,
      ruleConfig,
    }),
    ruleConfig,
  };
}

function legacyFixture(mutate: (save: Record<string, any>) => void): Record<string, unknown> {
  const save = structuredClone(baseSave()) as unknown as Record<string, any>;
  mutate(save);
  return save;
}

function pathsFor(id: string): readonly string[] {
  if (id === STAB007_TEST_CASE_IDS[0]) return ['matchState.appliedRoundIds'];
  if (id === STAB007_TEST_CASE_IDS[1]) return ['matchState.scoreHistory'];
  if (id === STAB007_TEST_CASE_IDS[2]) return ['ruleConfig', 'matchState.ruleConfig', 'matchLog.ruleConfig'];
  return MINIMAL_DIFF_PATHS;
}

function deletePath(target: Record<string, any>, path: string): void {
  const parts = path.split('.');
  const key = parts.pop()!;
  let current = target;
  for (const part of parts) current = current[part] as Record<string, any>;
  delete current[key];
}

function readPath(target: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, target);
}

function formatValue(value: unknown): string {
  return value === undefined ? '缺失' : JSON.stringify(value);
}
