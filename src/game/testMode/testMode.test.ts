import { describe, expect, it, vi } from 'vitest';
import { canAnkan, canKakan, canMinkan, executeKan, getLegalAnkanCandidates } from '../kanChecker';
import { drawTile, discardTile } from '../engine';
import { createReplayRecord } from '../persistence/replayRecord';
import { applyOfficialTestModeAction, createTestModeMatchLog, recordTestModeAction, shouldAutomaticallyAdvanceTestModeAI } from './actions';
import { getBuiltInTestScenario, getBuiltInTestScenarios } from './builtInScenarios';
import { isTestModeEnabled, isTestModeRequested } from './availability';
import { cloneTestScenario, convertReplayStepToTestScenario, loadTestScenarioState, parseTestScenarioJson, runtimeInvariantChecks, serializeTestScenario, validateTestScenario } from './scenario';
import { buildReplayState } from '../replay/roundReplay';
import { createDefaultTestCaseExecutors, createMemoryTestStorage, executeTestCase, failureReportFromResult, getBuiltInTestCases, parseTestCaseDefinitionJson, playableTestCaseFromScenario, serializeTestCaseRunResult, validateTestCaseDefinition, type TestCaseExecutors } from './testCases';
import type { TestCaseDefinitionV1, TestCaseRunResultV1 } from './types';
import { p0PersistenceRunners } from './p0RegressionCases';
import { STAB004_TEST_CASE_IDS } from './stab004Cases';
import { getVisibleTileCounts } from '../visibility';
import { STAB006_TEST_CASE_IDS } from './stab006Cases';
import { getDrawActionState } from '../interaction';
import { STAB007_TEST_CASE_IDS, stab007PersistenceRunners } from './stab007Cases';
import { STAB008_TEST_CASE_IDS, stab008PersistenceRunners } from './stab008Cases';
import { STAB009_TEST_CASE_IDS } from './stab009Cases';
import { STAB012_TEST_CASE_IDS } from './stab012Cases';

describe('开发者测试模式', () => {
  it('普通生产环境不启用，开发环境或显式环境变量启用，URL参数只在启用后直达', () => {
    expect(isTestModeEnabled({ DEV: false })).toBe(false);
    expect(isTestModeEnabled({ DEV: true })).toBe(true);
    expect(isTestModeEnabled({ DEV: false, VITE_ENABLE_TEST_MODE: 'true' })).toBe(true);
    expect(isTestModeRequested({ DEV: false }, '?testMode=1')).toBe(false);
    expect(isTestModeRequested({ DEV: true }, '?testMode=1')).toBe(true);
    expect(isTestModeRequested({ DEV: true }, '?testMode=0')).toBe(false);
  });

  it('四个内置场景重复构建与重复加载都深度等价且使用稳定可读instanceId', () => {
    const first = getBuiltInTestScenarios();
    const second = getBuiltInTestScenarios();
    expect(first).toEqual(second);
    expect(first.map((scenario) => scenario.id)).toEqual(['STAB-001-ANKAN', 'STAB-001-MINKAN', 'STAB-001-KAKAN', 'STAB-001-FOUR-KANS']);
    first.forEach((scenario) => {
      expect(validateTestScenario(scenario)).toEqual({ valid: true, issues: [] });
      expect(scenario.declaredTileCount).toBe(136);
      expect(scenario.gameState.deadWall).toHaveLength(14);
      expect(loadTestScenarioState(scenario)).toEqual(loadTestScenarioState(scenario));
      expect([...physicalInstanceIds(scenario)].every((instanceId) => instanceId.startsWith(`${scenario.id}-`))).toBe(true);
    });
  });

  it('重置会完整恢复场景初始状态且不复用可变引用', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const loaded = loadTestScenarioState(scenario);
    loaded.players[0].score = 1;
    loaded.wall.shift();
    const reset = loadTestScenarioState(scenario);
    expect(reset).toEqual(scenario.gameState);
    expect(reset).not.toBe(scenario.gameState);
    expect(reset.players[0]).not.toBe(scenario.gameState.players[0]);
  });

  it('无效JSON、未知版本、重复instanceId和非法第五张牌都会被拒绝并给出路径', () => {
    expect(() => parseTestScenarioJson('{')).toThrow(/不是有效JSON/);
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    expect(validateTestScenario({ ...scenario, version: 2 }).issues.some((issue) => issue.path === 'version')).toBe(true);

    const duplicate = cloneTestScenario(scenario);
    duplicate.gameState.players[0].hand[0].instanceId = duplicate.gameState.wall[0].instanceId;
    expect(validateTestScenario(duplicate).issues.some((issue) => issue.message.includes('Duplicate tile instance') || issue.message.includes('同一instanceId'))).toBe(true);

    const fifth = cloneTestScenario(scenario);
    const changed = fifth.gameState.wall.find((tile) => tile.id !== 0)!;
    changed.id = 0;
    changed.suit = 'man';
    changed.rank = 1;
    changed.red = false;
    expect(validateTestScenario(fifth).issues.some((issue) => issue.message.includes('超过四张'))).toBe(true);
  });

  it('JSON导出再导入保持场景等价', () => {
    const scenario = getBuiltInTestScenario('STAB-001-KAKAN')!;
    expect(parseTestScenarioJson(serializeTestScenario(scenario))).toEqual(scenario);
  });

  it('测试动作分派与正式execute、discard、draw入口结果一致', () => {
    const ankan = loadTestScenarioState(getBuiltInTestScenario('STAB-001-ANKAN')!);
    expect(applyOfficialTestModeAction(ankan, { type: 'kan', playerId: 0, kanType: 'ankan', tileId: 0 }))
      .toEqual(executeKan(ankan, 0, 'ankan', 0));

    const discardId = ankan.players[0].hand[0].instanceId;
    expect(applyOfficialTestModeAction(ankan, { type: 'discard', playerId: 0, tileInstanceId: discardId }))
      .toEqual(discardTile(ankan, 0, discardId));

    const drawState = { ...ankan, phase: 'draw' as const, currentPlayer: 1 as const };
    expect(applyOfficialTestModeAction(drawState, { type: 'draw' })).toEqual(drawTile(drawState, { settleTsumo: false }));
  });

  it('全员手动场景不会自动推进AI', () => {
    expect(shouldAutomaticallyAdvanceTestModeAI([0, 1, 2, 3], 2)).toBe(false);
  });

  it('每个STAB-001场景启动后都有预期正式合法杠动作', () => {
    expect(canAnkan(loadTestScenarioState(getBuiltInTestScenario('STAB-001-ANKAN')!), 0, 0)).toBe(true);
    expect(canMinkan(loadTestScenarioState(getBuiltInTestScenario('STAB-001-MINKAN')!), 0)).toBe(true);
    expect(canKakan(loadTestScenarioState(getBuiltInTestScenario('STAB-001-KAKAN')!), 0, 7)).toBe(true);
    expect(canAnkan(loadTestScenarioState(getBuiltInTestScenario('STAB-001-FOUR-KANS')!), 0, 27)).toBe(true);
  });

  it('连续四杠后调试不变量、岭上牌、表宝槽和活牌墙与正式GameState一致', () => {
    const scenario = getBuiltInTestScenario('STAB-001-FOUR-KANS')!;
    let state = loadTestScenarioState(scenario);
    const initialLive = state.wall.length;
    const kanTileIds = [27, 28, 29, 30] as const;
    for (let index = 0; index < 4; index += 1) {
      const tileId = kanTileIds[index];
      expect(canAnkan(state, 0, tileId), `第${index + 1}杠前 phase=${state.phase} hand=${state.players[0].hand.map((tile) => tile.id).join(',')}`).toBe(true);
      state = applyOfficialTestModeAction(state, { type: 'kan', playerId: 0, kanType: 'ankan', tileId });
      const checkpoint = scenario.expectedCheckpoints![index];
      expect(state.players[0].drawnTile?.instanceId).toBe(checkpoint.expectedRinshanInstanceId);
      expect(state.doraIndicators[state.doraIndicators.length - 1]?.instanceId).toBe(state.deadWall[checkpoint.expectedDoraSlotIndex!].instanceId);
      expect(state.wall).toHaveLength(initialLive - index - 1);
      expect(runtimeInvariantChecks(scenario, state).filter((check) => !check.passed)).toEqual([]);
    }
  });

  it('四个场景执行杠后的牌墙、固定王牌、岭上牌与正式牌谱重建一致', () => {
    const cases = [
      ['STAB-001-ANKAN', { type: 'kan', playerId: 0, kanType: 'ankan', tileId: 0 }],
      ['STAB-001-MINKAN', { type: 'kan', playerId: 0, kanType: 'minkan' }],
      ['STAB-001-KAKAN', { type: 'kan', playerId: 0, kanType: 'kakan', tileId: 7 }],
      ['STAB-001-FOUR-KANS', { type: 'kan', playerId: 0, kanType: 'ankan', tileId: 27 }],
    ] as const;

    cases.forEach(([id, action]) => {
      const scenario = getBuiltInTestScenario(id)!;
      const before = loadTestScenarioState(scenario);
      const after = applyOfficialTestModeAction(before, action);
      const log = recordTestModeAction(createTestModeMatchLog(scenario), before, after);
      const rebuilt = buildReplayState(log.rounds[0], Number.MAX_SAFE_INTEGER, {
        scores: log.initialScores,
        playerNames: log.playerNames,
        ruleConfig: log.ruleConfig,
      }).gameState;
      expect(rebuilt.wall.map((tile) => tile.instanceId), id).toEqual(after.wall.map((tile) => tile.instanceId));
      expect(rebuilt.deadWall.map((tile) => tile.instanceId), id).toEqual(after.deadWall.map((tile) => tile.instanceId));
      expect(rebuilt.doraIndicators.map((tile) => tile.instanceId), id).toEqual(after.doraIndicators.map((tile) => tile.instanceId));
      expect(rebuilt.players[0].drawnTile?.instanceId, id).toBe(after.players[0].drawnTile?.instanceId);
    });
  });

  it('完整牌谱步骤可转换，缺少完整牌山的旧牌谱明确拒绝', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const log = createTestModeMatchLog(scenario);
    const replay = createReplayRecord({ log, title: '完整测试牌谱', source: 'test-mode' });
    const converted = convertReplayStepToTestScenario(replay, 0, 0);
    expect(converted.ok).toBe(true);
    if (converted.ok) {
      expect(converted.scenario.gameState.wall).toEqual(scenario.gameState.wall);
      expect(converted.scenario.gameState.deadWall).toEqual(scenario.gameState.deadWall);
      expect(converted.scenario.ruleConfig).toEqual(scenario.ruleConfig);
    }

    const oldReplay = cloneReplay(replay);
    delete oldReplay.log.rounds[0].liveWall;
    delete oldReplay.log.rounds[0].deadWall;
    delete oldReplay.log.rounds[0].wallOrder;
    const rejected = convertReplayStepToTestScenario(oldReplay, 0, 0);
    expect(rejected).toMatchObject({ ok: false });
    if (!rejected.ok) expect(rejected.reason).toContain('未记录完整');
  });

  it('测试牌谱标记source=test-mode，普通牌谱默认来源保持不变', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const log = createTestModeMatchLog(scenario);
    expect(createReplayRecord({ log, source: 'test-mode' }).source).toBe('test-mode');
    expect(createReplayRecord({ log }).source).toBe('local-match');
  });

  it('原TestScenarioV1保持原JSON语义并可无损包装为PlayableTestCase', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const json = serializeTestScenario(scenario);
    expect(parseTestScenarioJson(json)).toEqual(scenario);
    const wrapped = playableTestCaseFromScenario(scenario);
    expect(wrapped.scenario).toEqual(scenario);
    expect(parseTestCaseDefinitionJson(JSON.stringify(wrapped))).toEqual(wrapped);
    expect(validateTestCaseDefinition(wrapped)).toEqual([]);
  });

  it('六种用例可注册且四个旧场景继续位于STAB-001分类', () => {
    const testCases = getBuiltInTestCases();
    expect(new Set(testCases.map((testCase) => testCase.kind))).toEqual(new Set([
      'playable', 'replay', 'persistence', 'import-validation', 'seeded-run', 'ui-interaction',
    ]));
    expect(testCases.filter((testCase) => testCase.category === 'stab-001-legacy')).toHaveLength(4);
    expect(testCases.every((testCase) => validateTestCaseDefinition(testCase).length === 0)).toBe(true);
  });

  it('STAB-001至STAB-012均至少注册一个可运行用例', () => {
    const coveredAuditIds = new Set(
      getBuiltInTestCases()
        .map((testCase) => testCase.relatedAuditId)
        .filter((auditId): auditId is string => auditId !== undefined),
    );
    for (let index = 1; index <= 12; index += 1) {
      expect(coveredAuditIds.has(`STAB-${String(index).padStart(3, '0')}`)).toBe(true);
    }
  });

  it('STAB-012只注册五个支持尺寸和两个尺寸过小边界', () => {
    const cases = getBuiltInTestCases().filter((testCase) => testCase.relatedAuditId === 'STAB-012');
    expect(cases.map((testCase) => testCase.id)).toEqual(STAB012_TEST_CASE_IDS);
    expect(cases).toHaveLength(7);
    expect(cases.every((testCase) => testCase.kind === 'ui-interaction')).toBe(true);
    expect(cases.every((testCase) => validateTestCaseDefinition(testCase).length === 0)).toBe(true);
  });

  it('执行器严格按kind分派，不受category名称影响', async () => {
    const testCases = getBuiltInTestCases();
    const calls: string[] = [];
    const resultFor = (testCase: TestCaseDefinitionV1): TestCaseRunResultV1 => ({
      version: 1,
      caseId: testCase.id,
      relatedAuditId: testCase.relatedAuditId ?? null,
      status: 'passed',
      currentStep: testCase.kind,
      expected: [],
      actual: [],
      stateSummary: 'ok',
    });
    const executors = Object.fromEntries([
      'playable', 'replay', 'persistence', 'import-validation', 'seeded-run', 'ui-interaction',
    ].map((kind) => [kind, vi.fn((testCase: TestCaseDefinitionV1) => { calls.push(kind); return resultFor(testCase); })])) as unknown as TestCaseExecutors;
    const context = { storage: createMemoryTestStorage() };
    for (const testCase of testCases.filter((entry, index, values) => values.findIndex((candidate) => candidate.kind === entry.kind) === index)) {
      await executeTestCase({ ...testCase, category: 'game-rules' }, context, executors);
    }
    expect([...calls].sort()).toEqual(['playable', 'replay', 'persistence', 'import-validation', 'seeded-run', 'ui-interaction'].sort());
    Object.values(executors).forEach((executor) => expect(executor).toHaveBeenCalledTimes(1));
  });

  it('默认执行器只使用注入的测试Storage，失败报告与结果均可序列化', async () => {
    const persistence = getBuiltInTestCases().find((testCase) => testCase.id === 'PERSISTENCE-ADAPTER-ROUNDTRIP')!;
    const storage = createMemoryTestStorage();
    const result = await executeTestCase(persistence, { storage }, createDefaultTestCaseExecutors());
    expect(result.status).toBe('passed');
    expect(JSON.parse(serializeTestCaseRunResult(result))).toEqual(result);

    const failed = { ...result, status: 'failed' as const, actual: ['模拟失败'] };
    const report = failureReportFromResult(persistence, failed);
    expect(JSON.parse(report)).toMatchObject({ caseId: persistence.id, actual: ['模拟失败'] });
    expect(storage.getItem('test-mode/persistence-roundtrip')).toBeNull();
  });

  it('注册全部STAB-002/003 P0回归用例且保留自动与人工步骤', () => {
    const testCases = getBuiltInTestCases();
    const ids = [
      'STAB-002-CHI-SAVE',
      'STAB-002-PON-SAVE',
      'STAB-002-MINKAN-SAVE',
      'STAB-002-INVALID-ALIASES',
      'STAB-003-HIDDEN-DRAW',
      'STAB-003-PUBLIC-AFTER-DISCARD',
      'STAB-003-CALL-PUBLIC',
      'STAB-003-CAMERA-SWITCH',
      'STAB-003-FULL-OPEN',
    ];
    ids.forEach((id) => {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase, id).toBeDefined();
      expect('runnerId' in testCase! ? testCase.runnerId : undefined, id).toBeTruthy();
      expect(testCase!.manualSteps.length, id).toBeGreaterThan(0);
      expect(testCase!.tags, id).toContain('自动');
      expect(validateTestCaseDefinition(testCase), id).toEqual([]);
    });
  });

  it('注册五个STAB-005确定性结算用例且快照与动态总点数守恒', () => {
    const ids = [
      'STAB-005-RON-1-STICK',
      'STAB-005-TSUMO-4-STICKS',
      'STAB-005-CHANKAN-STICKS',
      'STAB-005-MULTI-RON-STICKS',
      'STAB-005-CUSTOM-STARTING-POINTS',
    ];
    const testCases = getBuiltInTestCases();
    ids.forEach((id) => {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase?.kind, id).toBe('playable');
      if (!testCase || testCase.kind !== 'playable') throw new Error(`Missing ${id}`);
      expect(testCase.relatedAuditId).toBe('STAB-005');
      expect(testCase.category).toBe('scoring-settlement');
      expect(testCase.scenario.gameState.phase).toBe('round-ended');
      expect(testCase.scenario.gameState.riichiSticks).toBe(0);
      expect(testCase.scenario.gameState.result?.settlementRiichiSticks).toBeGreaterThan(0);
      expect(validateTestScenario(testCase.scenario)).toEqual({ valid: true, issues: [] });
      expect(runtimeInvariantChecks(testCase.scenario, testCase.scenario.gameState).filter((check) => !check.passed)).toEqual([]);
    });
    const custom = testCases.find((entry) => entry.id === 'STAB-005-CUSTOM-STARTING-POINTS');
    expect(custom?.kind === 'playable' ? custom.scenario.initialTotalPoints : undefined).toBe(108000);
  });

  it('注册四个STAB-004确定性用例并保留claimed历史来源但按instanceId去重', () => {
    const expected = new Map<string, [number, number]>([
      ['STAB-004-CHI-VISIBLE-COUNT', [10, 1]],
      ['STAB-004-PON-VISIBLE-COUNT', [5, 3]],
      ['STAB-004-MINKAN-VISIBLE-COUNT', [5, 4]],
      ['STAB-004-RED-FIVE-COUNT', [4, 3]],
    ]);
    const testCases = getBuiltInTestCases();
    STAB004_TEST_CASE_IDS.forEach((id) => {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase?.kind, id).toBe('playable');
      if (!testCase || testCase.kind !== 'playable') throw new Error(`Missing ${id}`);
      expect(testCase.relatedAuditId).toBe('STAB-004');
      expect(validateTestScenario(testCase.scenario)).toEqual({ valid: true, issues: [] });
      const [tileId, visible] = expected.get(id)!;
      const detail = getVisibleTileCounts(testCase.scenario.gameState, 0).find((entry) => entry.id === tileId)!;
      expect(detail.visible, id).toBe(visible);
      expect(detail.remaining, id).toBe(4 - visible);
      expect(detail.instances.some((instance) => instance.sourceRegions.some((source) => source.includes('-river'))
        && instance.sourceRegions.some((source) => source.includes('-call-'))), id).toBe(true);
      expect(getVisibleTileCounts(testCase.scenario.gameState, 0).every((entry) => entry.visible <= 4 && entry.remaining >= 0)).toBe(true);
      if (id === 'STAB-004-RED-FIVE-COUNT') {
        expect(detail.instances.some((instance) => instance.red)).toBe(true);
        expect(detail.instances.some((instance) => !instance.red)).toBe(true);
      }
    });
  });

  it('注册四个STAB-006确定性场景且UI候选与底层共享暗杠结果一致', () => {
    const testCases = getBuiltInTestCases();
    STAB006_TEST_CASE_IDS.forEach((id) => {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase?.kind, id).toBe('playable');
      if (!testCase || testCase.kind !== 'playable') throw new Error(`Missing ${id}`);
      expect(testCase.relatedAuditId).toBe('STAB-006');
      expect(validateTestScenario(testCase.scenario)).toEqual({ valid: true, issues: [] });
      const state = testCase.scenario.gameState;
      const shared = getLegalAnkanCandidates(state, 0).map((candidate) => candidate.tileId);
      const ui = getDrawActionState(state, 0).ankanCandidates.map((candidate) => candidate.tileId);
      expect(ui, id).toEqual(shared);
      expect(shared.every((tileId) => canAnkan(state, 0, tileId)), id).toBe(true);
    });
    const unchanged = testCases.find((entry) => entry.id === 'STAB-006-ANKAN-WAIT-UNCHANGED');
    const changed = testCases.find((entry) => entry.id === 'STAB-006-ANKAN-WAIT-CHANGED');
    const none = testCases.find((entry) => entry.id === 'STAB-006-NO-LEGAL-ANKAN');
    if (!unchanged || unchanged.kind !== 'playable' || !changed || changed.kind !== 'playable' || !none || none.kind !== 'playable') throw new Error('Missing STAB-006 fixtures');
    expect(unchanged.scenario.gameState.players[0].drawnTile?.id).toBe(0);
    expect(changed.scenario.gameState.players[0].hand.filter((tile) => tile.id === 0)).toHaveLength(4);
    expect(none.scenario.gameState.players[0].hand.some((tile, _, hand) => hand.filter((other) => other.id === tile.id).length === 4)).toBe(false);
  });

  it('注册并自动执行四个STAB-007存档兼容用例，显示迁移前后差异与验证结果', async () => {
    const testCases = getBuiltInTestCases();
    for (const id of STAB007_TEST_CASE_IDS) {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase?.kind, id).toBe('persistence');
      if (!testCase || testCase.kind !== 'persistence') throw new Error(`Missing ${id}`);
      expect(testCase.relatedAuditId).toBe('STAB-007');
      expect(validateTestCaseDefinition(testCase)).toEqual([]);
      const result = await executeTestCase(testCase, {
        storage: createMemoryTestStorage(),
        persistenceRunners: stab007PersistenceRunners,
      });
      expect(result.status, `${id}: ${result.actual.join('; ')}`).toBe('passed');
      expect(result.actual.some((line) => line.startsWith('迁移前 ')), id).toBe(true);
      expect(result.actual.some((line) => line.startsWith('迁移后 ')), id).toBe(true);
      expect(result.actual).toContain('验证结果：通过');
    }
  });

  it('注册并自动执行四个STAB-008隔离存储失败用例', async () => {
    const testCases = getBuiltInTestCases();
    for (const id of STAB008_TEST_CASE_IDS) {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase?.kind, id).toBe('persistence');
      if (!testCase || testCase.kind !== 'persistence') throw new Error(`Missing ${id}`);
      expect(testCase.relatedAuditId).toBe('STAB-008');
      expect(validateTestCaseDefinition(testCase)).toEqual([]);
      const result = await executeTestCase(testCase, {
        storage: createMemoryTestStorage(),
        persistenceRunners: stab008PersistenceRunners,
      });
      expect(result.status, `${id}: ${result.actual.join('; ')}`).toBe('passed');
      expect(result.actual).toContain('页面可继续：是');
      expect(result.actual.some((line) => line.includes('已捕获')), id).toBe(true);
    }
  });

  it('六个STAB-009导入用例对ReplayRecord和裸MatchLog使用相同版本策略', async () => {
    const testCases = getBuiltInTestCases();
    for (const id of STAB009_TEST_CASE_IDS) {
      const testCase = testCases.find((entry) => entry.id === id);
      expect(testCase?.kind, id).toBe('import-validation');
      if (!testCase || testCase.kind !== 'import-validation') throw new Error(`Missing ${id}`);
      expect(validateTestCaseDefinition(testCase)).toEqual([]);
      const result = await executeTestCase(testCase, { storage: createMemoryTestStorage() });
      expect(result.status, `${id}: ${result.actual.join('; ')}`).toBe('passed');
      if (id.endsWith('V1')) expect(result.actual).toContain('输入被接受');
      else {
        expect(result.actual[0]).toContain('输入被拒绝');
        expect(result.actual[0]).toContain(id.includes('RAW-LOG') ? 'MatchLog' : 'ReplayRecord');
        expect(result.actual[0]).toContain(id.endsWith('V0') ? '实际版本 0，支持版本 1' : '实际版本 2，支持版本 1');
      }
    }
  });

  it('STAB-005结算场景导出的正式事件可重建相同供托快照和最终分数', () => {
    const testCase = getBuiltInTestCases().find((entry) => entry.id === 'STAB-005-TSUMO-4-STICKS');
    if (!testCase || testCase.kind !== 'playable') throw new Error('Missing STAB-005 tsumo case');
    const log = createTestModeMatchLog(testCase.scenario);
    expect(log.rounds[0].events.some((event) => event.type === 'round-ended')).toBe(true);
    const rebuilt = buildReplayState(log.rounds[0], Number.MAX_SAFE_INTEGER, {
      scores: log.initialScores,
      playerNames: log.playerNames,
      ruleConfig: log.ruleConfig,
    }).gameState;
    expect(rebuilt.result?.settlementRiichiSticks).toBe(4);
    expect(rebuilt.riichiSticks).toBe(0);
    expect(rebuilt.players.map((player) => player.score)).toEqual(testCase.scenario.gameState.players.map((player) => player.score));
  });

  it('STAB-002吃、碰、大明杠真实状态可保存恢复，非法别名矩阵均明确拒绝', async () => {
    const cases = getBuiltInTestCases().filter((testCase) => testCase.relatedAuditId === 'STAB-002');
    const storage = createMemoryTestStorage();
    for (const testCase of cases) {
      const result = await executeTestCase(testCase, { storage, persistenceRunners: p0PersistenceRunners });
      expect(result.status, `${testCase.id}: ${result.actual.join('; ')}`).toBe('passed');
      expect(result.actual.length, testCase.id).toBeGreaterThan(0);
      if (testCase.id === 'STAB-002-CHI-SAVE') expect(result.actual.join(' ')).toContain('食替');
      if (testCase.id === 'STAB-002-MINKAN-SAVE') expect(result.actual.join(' ')).toContain('岭上');
      if (testCase.id === 'STAB-002-INVALID-ALIASES') {
        expect(result.actual).toHaveLength(4);
        expect(result.actual.every((line) => line.includes('已拒绝'))).toBe(true);
      }
    }
  });
});

function physicalInstanceIds(scenario: ReturnType<typeof getBuiltInTestScenarios>[number]): Set<string> {
  const ids = new Set<string>();
  scenario.gameState.players.forEach((player) => {
    player.hand.forEach((tile) => ids.add(tile.instanceId));
    player.river.forEach((tile) => ids.add(tile.instanceId));
    player.calls.forEach((call) => call.tiles.forEach((tile) => ids.add(tile.instanceId)));
  });
  scenario.gameState.wall.forEach((tile) => ids.add(tile.instanceId));
  scenario.gameState.deadWall.forEach((tile) => ids.add(tile.instanceId));
  return ids;
}

function cloneReplay<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
