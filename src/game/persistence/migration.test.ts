import { describe, expect, it } from 'vitest';
import { migrateSavedMatch } from './migration';
import { sampleSavedMatch } from './saveTestUtils';
import { validateSavedMatch } from './storageValidation';
import { defaultMatchRuleConfig } from '../match/matchRules';
import { defaultRuleConfig } from '../score/rules/RuleConfig';

const matchStateLaterAddedFields = [
  ['matchState.appliedRoundIds', []],
  ['matchState.scoreHistory', []],
  ['matchState.currentMatchIndex', 0],
  ['matchState.matchResults', []],
  ['matchState.aggregateScores', [0, 0, 0, 0]],
] as const;

const gameStateLaterAddedFields = [
  ['pendingCall', null],
  ['pendingRon', null],
  ['pendingKakan', null],
  ['kanState', null],
  ['callsOccurred', false],
  ['firstTurnInterrupted', false],
  ['playerDrawCounts', [0, 0, 0, 0]],
  ['playerDiscardCounts', [0, 0, 0, 0]],
  ['lastDrawSource', 'initial-hand'],
  ['lastWinSource', null],
  ['lastLiveWallDiscarder', null],
  ['pendingAbortiveDrawAfterFourthKan', false],
  ['kuikaeForbiddenTileIds', {}],
] as const;

const laterAddedFields: ReadonlyArray<readonly [string, unknown]> = [
  ...matchStateLaterAddedFields,
  ...gameStateLaterAddedFields.flatMap(([field, value]) => [
    [`gameState.${field}`, value] as const,
    [`matchState.currentGame.${field}`, value] as const,
  ]),
  ['gameState.players.0.furitenState', { temporaryFuriten: false, riichiPermanentFuriten: false }],
  ['gameState.players.0.pendingRiichiSidewaysDiscard', false],
  ['matchState.currentGame.players.0.furitenState', { temporaryFuriten: false, riichiPermanentFuriten: false }],
  ['matchState.currentGame.players.0.pendingRiichiSidewaysDiscard', false],
];

describe('saved match migration', () => {
  it('loads current version and rejects newer or missing versions', () => {
    expect(migrateSavedMatch(sampleSavedMatch()).saveId).toBe('save-1');
    expect(() => migrateSavedMatch({ ...sampleSavedMatch(), version: 999 })).toThrow(/newer/);
    expect(() => migrateSavedMatch({ saveId: 'bad' })).toThrow(/version/);
  });

  it('migrates legacy roundCount and initializes series progress fields', () => {
    const legacy = sampleSavedMatch() as any;
    delete legacy.ruleConfig.match.matchCount;
    legacy.ruleConfig.match.roundCount = 3;
    delete legacy.matchState.ruleConfig.matchCount;
    legacy.matchState.ruleConfig.roundCount = 3;
    delete legacy.matchState.currentMatchIndex;
    delete legacy.matchState.matchResults;
    delete legacy.matchState.aggregateScores;
    const migrated = migrateSavedMatch(legacy);
    expect(migrated.ruleConfig.match.matchCount).toBe(3);
    expect(migrated.matchState.ruleConfig.matchCount).toBe(3);
    expect(migrated.matchState.currentMatchIndex).toBe(0);
    expect(migrated.matchState.matchResults).toEqual([]);
    expect(migrated.matchState.aggregateScores).toEqual([0, 0, 0, 0]);
  });

  it('旧存档缺少三家和字段时迁移为开启', () => {
    const legacy = sampleSavedMatch() as any;
    delete legacy.ruleConfig.round.tripleRonMode;
    delete legacy.matchLog.ruleConfig.round.tripleRonMode;
    const migrated = migrateSavedMatch(legacy);
    expect(migrated.ruleConfig.round.tripleRonMode).toBe('allow');
    expect(migrated.matchLog.ruleConfig.round.tripleRonMode).toBe('allow');
  });

  it.each(laterAddedFields)('version 1 单独缺少 %s 时补齐默认值并可继续验证', (path, expected) => {
    const legacy = structuredClone(sampleSavedMatch()) as unknown as Record<string, unknown>;
    deletePath(legacy, path);
    const migrated = migrateSavedMatch(legacy);
    expect(readPath(migrated as unknown as Record<string, unknown>, path)).toEqual(expected);
    expect(() => validateSavedMatch(migrated)).not.toThrow();
  });

  it.each([
    'ruleConfig',
    'ruleConfig.round',
    'ruleConfig.match',
    'matchState.ruleConfig',
    'matchLog.ruleConfig',
    'matchLog.ruleConfig.round',
    'matchLog.ruleConfig.match',
    'gameState.ruleConfig',
    'gameState.matchRuleConfig',
    'matchState.currentGame.ruleConfig',
    'matchState.currentGame.matchRuleConfig',
  ])('version 1 单独缺少规则对象 %s 时整体归一化', (path) => {
    const legacy = structuredClone(sampleSavedMatch()) as unknown as Record<string, unknown>;
    deletePath(legacy, path);
    const migrated = migrateSavedMatch(legacy);
    expect(migrated.ruleConfig.round.tripleRonMode).toBeDefined();
    expect(migrated.ruleConfig.match.matchCount).toBeDefined();
    expect(migrated.matchState.ruleConfig).toEqual(migrated.ruleConfig.match);
    expect(migrated.matchLog.ruleConfig).toEqual(migrated.ruleConfig);
    expect(migrated.gameState?.ruleConfig).toEqual(migrated.ruleConfig.round);
    expect(migrated.gameState?.matchRuleConfig).toEqual(migrated.ruleConfig.match);
    expect(() => validateSavedMatch(migrated)).not.toThrow();
  });

  it.each([
    ...Object.keys(defaultRuleConfig).map((field) => [`round.${field}`, (defaultRuleConfig as unknown as Record<string, unknown>)[field]] as const),
    ...Object.keys(defaultMatchRuleConfig).map((field) => [`match.${field}`, (defaultMatchRuleConfig as unknown as Record<string, unknown>)[field]] as const),
  ])('完整规则归一化会补齐单独缺少的 ruleConfig.%s', (path, expected) => {
    const legacy = structuredClone(sampleSavedMatch()) as unknown as Record<string, unknown>;
    deletePath(legacy, `ruleConfig.${path}`);
    const migrated = migrateSavedMatch(legacy);
    expect(readPath(migrated.ruleConfig as unknown as Record<string, unknown>, path)).toEqual(expected);
  });

  it('保留旧存档已有的合法值而不以默认值覆盖', () => {
    const legacy = structuredClone(sampleSavedMatch());
    legacy.matchState.currentMatchIndex = 1;
    legacy.matchState.appliedRoundIds = ['round-old'];
    legacy.matchState.scoreHistory = [{ roundLabel: '东1局', scores: [24000, 25000, 25000, 26000], honba: 1, riichiSticks: 0 }];
    legacy.matchState.aggregateScores = [4, 3, 2, 1];
    legacy.ruleConfig.round.forbidKuikae = false;
    legacy.ruleConfig.match.matchCount = 2;
    const migrated = migrateSavedMatch(legacy);
    expect(migrated.matchState.currentMatchIndex).toBe(1);
    expect(migrated.matchState.appliedRoundIds).toEqual(['round-old']);
    expect(migrated.matchState.scoreHistory).toEqual(legacy.matchState.scoreHistory);
    expect(migrated.matchState.aggregateScores).toEqual([4, 3, 2, 1]);
    expect(migrated.ruleConfig.round.forbidKuikae).toBe(false);
    expect(migrated.ruleConfig.match.matchCount).toBe(2);
  });

  it('最小可恢复v1存档缺少全部后增字段和规则对象时仍可归一化验证', () => {
    const legacy = structuredClone(sampleSavedMatch()) as unknown as Record<string, unknown>;
    delete legacy.ruleConfig;
    deletePath(legacy, 'matchState.ruleConfig');
    deletePath(legacy, 'matchLog.ruleConfig');
    matchStateLaterAddedFields.forEach(([path]) => deletePath(legacy, path));
    gameStateLaterAddedFields.forEach(([field]) => {
      deletePath(legacy, `gameState.${field}`);
      deletePath(legacy, `matchState.currentGame.${field}`);
    });
    deletePath(legacy, 'gameState.ruleConfig');
    deletePath(legacy, 'gameState.matchRuleConfig');
    deletePath(legacy, 'matchState.currentGame.ruleConfig');
    deletePath(legacy, 'matchState.currentGame.matchRuleConfig');
    deletePath(legacy, 'gameState.players.0.furitenState');
    deletePath(legacy, 'gameState.players.0.pendingRiichiSidewaysDiscard');
    deletePath(legacy, 'matchState.currentGame.players.0.furitenState');
    deletePath(legacy, 'matchState.currentGame.players.0.pendingRiichiSidewaysDiscard');
    const migrated = migrateSavedMatch(legacy);
    expect(() => validateSavedMatch(migrated)).not.toThrow();
    expect(migrated.matchState.appliedRoundIds).toEqual([]);
    expect(migrated.matchState.currentGame?.playerDrawCounts).toEqual([0, 0, 0, 0]);
    expect(migrated.ruleConfig.round).toMatchObject(defaultRuleConfig);
    expect(migrated.ruleConfig.match).toMatchObject(defaultMatchRuleConfig);
  });

  it.each([
    [{ version: 1, matchLog: sampleSavedMatch().matchLog }, 'matchState'],
    [{ version: 1, matchState: sampleSavedMatch().matchState }, 'matchLog'],
    [{ ...sampleSavedMatch(), matchState: { ...sampleSavedMatch().matchState, scores: null } }, 'matchState.scores'],
  ])('无法安全恢复时返回明确不兼容错误：%s', (input, field) => {
    expect(() => migrateSavedMatch(input)).toThrow(new RegExp(`不兼容.*${field}`));
  });
});

function deletePath(target: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  const key = parts.pop()!;
  let current: Record<string, unknown> = target;
  for (const part of parts) current = current[part] as Record<string, unknown>;
  delete current[key];
}

function readPath(target: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => (current as Record<string, unknown>)[part], target);
}
