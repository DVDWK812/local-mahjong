import { describe, expect, it } from 'vitest';
import { canAnkan, canKakan, canMinkan, executeKan } from '../kanChecker';
import { drawTile, discardTile } from '../engine';
import { createReplayRecord } from '../persistence/replayRecord';
import { applyOfficialTestModeAction, createTestModeMatchLog, recordTestModeAction, shouldAutomaticallyAdvanceTestModeAI } from './actions';
import { getBuiltInTestScenario, getBuiltInTestScenarios } from './builtInScenarios';
import { isTestModeEnabled, isTestModeRequested } from './availability';
import { cloneTestScenario, convertReplayStepToTestScenario, loadTestScenarioState, parseTestScenarioJson, runtimeInvariantChecks, serializeTestScenario, validateTestScenario } from './scenario';
import { buildReplayState } from '../replay/roundReplay';

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
