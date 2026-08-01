import { executePon } from '../callChecker';
import { executeChi } from '../chiChecker';
import { createInitialGameState } from '../engine';
import { executeKan } from '../kanChecker';
import { startMatch } from '../match/matchEngine';
import { getRulePreset } from '../match/matchRules';
import { createReplayRecord } from '../persistence/replayRecord';
import { LocalStorageAdapter } from '../persistence/saveManager';
import { CURRENT_SAVE_VERSION, type SavedMatch } from '../persistence/storageTypes';
import { validateSavedMatch } from '../persistence/storageValidation';
import { createInitialMatchLog, recordGameStateTransition, startRoundInMatchLog } from '../replay/eventRecorder';
import type { MatchLog, RoundLog, TileSnapshot } from '../replay/types';
import type { CallSet, GameState, PlayerState, Tile, TileId } from '../types';
import { getTileRank, getTileSuit } from '../tileUtils';
import type { TestStorageAdapter } from './testCases';
import { TEST_CASE_DEFINITION_VERSION, type PersistenceTestCase, type ReplayTestCase, type TestCaseDefinitionV1 } from './types';

export const P0_PERSISTENCE_RUNNER_IDS = {
  chi: 'stab-002-chi-save',
  pon: 'stab-002-pon-save',
  minkan: 'stab-002-minkan-save',
  invalidAliases: 'stab-002-invalid-aliases',
} as const;

export const P0_REPLAY_RUNNER_IDS = {
  hiddenDraw: 'stab-003-hidden-draw',
  publicAfterDiscard: 'stab-003-public-after-discard',
  callPublic: 'stab-003-call-public',
  cameraSwitch: 'stab-003-camera-switch',
  fullOpen: 'stab-003-full-open',
} as const;

export function getP0RegressionTestCases(): TestCaseDefinitionV1[] {
  const hiddenReplay = replayRecord('STAB-003-HIDDEN-DRAW', [opponentDrawRound('hidden-draw')]);
  const publicReplay = replayRecord('STAB-003-PUBLIC-AFTER-DISCARD', [opponentDrawRound('public-after-discard')]);
  const callReplay = replayRecord('STAB-003-CALL-PUBLIC', [
    callRound('chi-declared', 0),
    callRound('pon-declared', 1),
    callRound('minkan-declared', 2),
  ]);
  const cameraReplay = replayRecord('STAB-003-CAMERA-SWITCH', [opponentDrawRound('camera-switch')]);
  const fullOpenReplay = replayRecord('STAB-003-FULL-OPEN', [opponentDrawRound('full-open')]);

  return [
    persistenceCase('STAB-002-CHI-SAVE', '吃牌存档恢复', P0_PERSISTENCE_RUNNER_IDS.chi, [
      '吃牌后保存并恢复成功', 'claimed牌河、来源玩家和食替集合保持一致',
    ], ['运行自动检查。', '展开实际结果，人工核对claimed实例、from与食替集合。']),
    persistenceCase('STAB-002-PON-SAVE', '碰牌存档恢复', P0_PERSISTENCE_RUNNER_IDS.pon, [
      '碰牌后保存并恢复成功', 'claimed牌河与副露来源保持一致',
    ], ['运行自动检查。', '人工核对碰副露三张实例和来源玩家。']),
    persistenceCase('STAB-002-MINKAN-SAVE', '大明杠岭上摸牌存档恢复', P0_PERSISTENCE_RUNNER_IDS.minkan, [
      '大明杠及岭上摸牌后保存并恢复成功', 'claimed牌河、副露来源、岭上实例和活牌墙保持一致',
    ], ['运行自动检查。', '人工核对恢复后的岭上牌instanceId、宝牌和活牌剩余。']),
    persistenceCase('STAB-002-INVALID-ALIASES', '非法实例别名拒绝', P0_PERSISTENCE_RUNNER_IDS.invalidAliases, [
      '手牌与牌墙重复被拒绝', '手牌与副露重复被拒绝', '未claimed牌河与副露重复被拒绝', '一个claimed实例对应两个副露被拒绝',
    ], ['运行自动篡改矩阵。', '展开实际结果，确认每种篡改都有明确拒绝原因。']),
    replayCase('STAB-003-HIDDEN-DRAW', '对手暗摸保持牌背', P0_REPLAY_RUNNER_IDS.hiddenDraw, hiddenReplay, [
      '对手摸牌后弃牌前，已消费实例在普通视角仍为牌背',
    ], ['打开附带牌谱第1步和牌山抽屉。', '保持玩家1视角，核对对手暗摸槽为牌背。']),
    replayCase('STAB-003-PUBLIC-AFTER-DISCARD', '弃牌后按实例公开', P0_REPLAY_RUNNER_IDS.publicAfterDiscard, publicReplay, [
      '弃牌后仅公开实际弃出的instanceId', '同牌型其他物理实例不获得公开权限',
    ], ['打开附带牌谱第2步。', '核对实际弃牌实例翻面，同牌型其他实例仍按权限显示。']),
    replayCase('STAB-003-CALL-PUBLIC', '鸣牌实例公开', P0_REPLAY_RUNNER_IDS.callPublic, callReplay, [
      '吃、碰、大明杠只公开各自副露引用的实际实例',
    ], ['依次选择附带牌谱的三局并前进到鸣牌步骤。', '核对每个副露实例在牌山抽屉中的公开状态。']),
    replayCase('STAB-003-CAMERA-SWITCH', '切换视角重算自知牌', P0_REPLAY_RUNNER_IDS.cameraSwitch, cameraReplay, [
      '四家视角切换时按新的主视角重新计算自知牌',
    ], ['打开附带牌谱第1步。', '依次切换玩家1至玩家4视角并核对暗摸牌。']),
    replayCase('STAB-003-FULL-OPEN', '全牌公开开关权限恢复', P0_REPLAY_RUNNER_IDS.fullOpen, fullOpenReplay, [
      '开启后显示全部已有牌山信息', '关闭后恢复当前视角权限',
    ], ['打开附带牌谱第1步。', '记录普通视角，开启全牌公开，再关闭并对比初始显示。']),
  ].map(clone);
}

export const p0PersistenceRunners: Record<string, (testCase: PersistenceTestCase, storage: TestStorageAdapter) => Promise<string[]>> = {
  [P0_PERSISTENCE_RUNNER_IDS.chi]: (_testCase, storage) => runCallSave('chi', storage),
  [P0_PERSISTENCE_RUNNER_IDS.pon]: (_testCase, storage) => runCallSave('pon', storage),
  [P0_PERSISTENCE_RUNNER_IDS.minkan]: (_testCase, storage) => runCallSave('minkan', storage),
  [P0_PERSISTENCE_RUNNER_IDS.invalidAliases]: (_testCase, storage) => runInvalidAliases(storage),
};

function persistenceCase(id: string, name: string, runnerId: string, expectedResults: string[], manualSteps: string[]): PersistenceTestCase {
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name,
    description: `STAB-002 自动回归：${name}。`,
    relatedAuditId: 'STAB-002',
    category: 'persistence-migration',
    kind: 'persistence',
    runnerId,
    operation: 'round-trip',
    storageKey: `test-mode/${id.toLowerCase()}`,
    fixtureJson: JSON.stringify({ id, runnerId }),
    expectedResults,
    manualSteps,
    tags: ['STAB-002', 'P0回归', '自动', '可人工查看'],
  };
}

function replayCase(id: string, name: string, runnerId: string, replay: ReplayTestCase['replay'], expectedResults: string[], manualSteps: string[]): ReplayTestCase {
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name,
    description: `STAB-003 自动回归：${name}。`,
    relatedAuditId: 'STAB-003',
    category: 'replay-hidden-information',
    kind: 'replay',
    runnerId,
    replay,
    initialRoundIndex: 0,
    initialStepIndex: 1,
    expectedResults,
    manualSteps,
    tags: ['STAB-003', 'P0回归', '自动', '可人工查看'],
  };
}

async function runCallSave(type: 'chi' | 'pon' | 'minkan', storage: TestStorageAdapter): Promise<string[]> {
  const before = callWindowState(type);
  const after = type === 'chi'
    ? executeChi(before, 1, 0)
    : type === 'pon'
      ? executePon(before, 1)
      : executeKan(before, 1, 'minkan');
  if (after === before) throw new Error(`${type}正式动作入口未推进状态`);

  const adapter = new LocalStorageAdapter(asWebStorage(storage));
  const save = savedMatch(after, `STAB-002-${type.toUpperCase()}-SAVE`, before);
  await adapter.saveCurrentMatch(save);
  const restored = (await adapter.loadCurrentMatch())?.gameState;
  if (!restored) throw new Error('保存后未恢复出GameState');

  const riverTile = restored.players[0].river.find((tile) => tile.claimed);
  const call = restored.players[1].calls[0];
  if (!riverTile || riverTile.claimedBy !== 1) throw new Error('恢复后的牌河缺少claimed/claimedBy');
  if (!call || call.from !== 0) throw new Error('恢复后的副露来源玩家不正确');
  if (!call.tiles.some((tile) => tile.instanceId === riverTile.instanceId)) throw new Error('恢复后的claimed实例未对应唯一副露');
  if (JSON.stringify(restored.kuikaeForbiddenTileIds) !== JSON.stringify(after.kuikaeForbiddenTileIds)) throw new Error('恢复后的食替禁打集合发生变化');

  const actual = [
    `claimed=${riverTile.instanceId}，claimedBy=${riverTile.claimedBy}`,
    `call=${call.type}${call.kanType ? `/${call.kanType}` : ''}，from=${call.from}`,
    `食替=${JSON.stringify(restored.kuikaeForbiddenTileIds)}`,
  ];
  if (type === 'minkan') {
    if (restored.players[1].drawnTile?.instanceId !== before.deadWall[0].instanceId) throw new Error('恢复后的岭上摸牌instanceId不正确');
    if (restored.wall.length !== before.wall.length - 1) throw new Error('恢复后的活牌墙未按大明杠减少1');
    actual.push(`岭上=${restored.players[1].drawnTile.instanceId}`, `活牌=${restored.wall.length}`);
  }
  return actual;
}

async function runInvalidAliases(storage: TestStorageAdapter): Promise<string[]> {
  storage.removeItem('local-mahjong.current-match.v1');
  const valid = executePon(callWindowState('pon'), 1);
  if (!valid.players[1].calls[0]) throw new Error('无法建立合法碰牌基准');
  const mutations: Array<[string, (state: GameState) => void]> = [
    ['手牌与牌墙重复', (state) => { state.wall.push(state.players[1].hand[0]); }],
    ['手牌与副露重复', (state) => { state.players[2].hand.push(state.players[1].calls[0].tiles[0]); }],
    ['未claimed牌河与副露重复', (state) => {
      state.players[0].river[0].claimed = false;
      state.players[0].river[0].claimedBy = undefined;
    }],
    ['一个claimed实例对应两个副露', (state) => {
      const claimed = state.players[0].river[0];
      state.players[2].calls.push({
        type: 'pon',
        tiles: [claimed, fixedTile(27, 'invalid-second-call-1'), fixedTile(27, 'invalid-second-call-2')],
        from: 0,
        opened: true,
        calledTile: claimed,
      });
    }],
  ];
  return mutations.map(([label, mutate], index) => {
    const tampered = clone(valid);
    mutate(tampered);
    try {
      validateSavedMatch(savedMatch(tampered, `STAB-002-INVALID-${index}`));
      throw new Error(`${label}：篡改存档被错误接受`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知拒绝原因';
      if (reason.includes('被错误接受')) throw error;
      if (!/tile instance|claimed river alias/i.test(reason)) throw new Error(`${label}：拒绝原因不明确：${reason}`);
      return `${label}：已拒绝（${reason}）`;
    }
  });
}

function callWindowState(type: 'chi' | 'pon' | 'minkan'): GameState {
  const base = createInitialGameState();
  const target = type === 'chi' ? 1 : 27;
  const called = fixedTile(target, `${type}-called`);
  const ownIds: TileId[] = type === 'chi' ? [0, 2] : Array.from({ length: type === 'pon' ? 2 : 3 }, () => 27 as TileId);
  const fillers: TileId[] = type === 'chi'
    ? [27, 28, 29, 30, 31, 32, 33, 27, 28, 29, 30]
    : [0, 4, 8, 9, 13, 17, 18, 22, 26, 31, 33];
  const hand = [...ownIds, ...fillers.slice(0, 13 - ownIds.length)].map((id, index) => fixedTile(id, `${type}-caller-hand-${index}`));
  const deadWall = Array.from({ length: 14 }, (_, index) => fixedTile(((index + 5) % 34) as TileId, `${type}-dead-${index}`));
  const wall = Array.from({ length: 20 }, (_, index) => fixedTile(((index + 10) % 34) as TileId, `${type}-live-${index}`));
  const players = base.players.map((player): PlayerState => ({
    ...player,
    score: 25000,
    hand: player.id === 1 ? hand : [],
    river: player.id === 0 ? [called] : [],
    calls: [],
    drawnTile: null,
    riichi: false,
    riichiState: null,
    furitenState: { temporaryFuriten: false, riichiPermanentFuriten: false },
  }));
  return {
    ...base,
    dealer: 0,
    honba: 0,
    riichiSticks: 0,
    wall,
    deadWall,
    doraIndicators: [deadWall[4]],
    players,
    currentPlayer: 0,
    phase: 'call-window',
    turn: 2,
    lastDiscard: { player: 0, tile: called },
    pendingCall: {
      discarder: 0,
      tile: called,
      options: type === 'chi'
        ? [{ type: 'chi', player: 1, sequence: [0, 1, 2], usedTileIds: [0, 2] }]
        : type === 'minkan'
          ? [{ type: 'kan', kanType: 'minkan', player: 1 }]
          : [{ type: 'pon', player: 1 }],
    },
    pendingRon: null,
    pendingKakan: null,
    result: null,
    kuikaeForbiddenTileIds: {},
    playerDiscardCounts: [1, 0, 0, 0],
  };
}

function savedMatch(gameState: GameState, id: string, roundStartState: GameState = gameState): SavedMatch {
  const ruleConfig = getRulePreset('east-round');
  const initial = startMatch(ruleConfig.match);
  const matchState = {
    ...initial,
    phase: 'round-active' as const,
    scores: gameState.players.map((player) => player.score) as [number, number, number, number],
    dealer: gameState.dealer,
    roundWind: gameState.roundWind,
    handNumber: 1 as const,
    honba: gameState.honba,
    riichiSticks: gameState.riichiSticks,
    currentGame: gameState,
  };
  const initialLog = createInitialMatchLog({
    matchId: id.toLowerCase(),
    playerNames: gameState.players.map((player) => player.name) as [string, string, string, string],
    initialDealer: gameState.dealer,
    initialScores: matchState.scores,
    ruleConfig,
  });
  const startedLog = startRoundInMatchLog({ ...initialLog, createdAt: '2026-08-01T00:00:00.000Z' }, roundStartState, 1);
  const matchLog = roundStartState === gameState ? startedLog : recordGameStateTransition(startedLog, roundStartState, gameState);
  return {
    version: CURRENT_SAVE_VERSION,
    saveId: id,
    savedAt: '2026-08-01T00:00:00.000Z',
    matchState,
    gameState,
    matchLog,
    ruleConfig,
  };
}

function asWebStorage(storage: TestStorageAdapter): Storage {
  return {
    get length() { return 0; },
    clear: () => storage.removeItem('local-mahjong.current-match.v1'),
    getItem: (key) => storage.getItem(key),
    key: () => null,
    removeItem: (key) => storage.removeItem(key),
    setItem: (key, value) => storage.setItem(key, value),
  };
}

function replayRecord(id: string, rounds: RoundLog[]): ReplayTestCase['replay'] {
  const rules = getRulePreset('east-round');
  const base = createInitialMatchLog({
    matchId: id,
    playerNames: ['测试玩家1', '测试玩家2', '测试玩家3', '测试玩家4'],
    initialDealer: 0,
    initialScores: [25000, 25000, 25000, 25000],
    ruleConfig: rules,
  });
  const log: MatchLog = { ...base, createdAt: '2026-08-01T00:00:00.000Z', rounds };
  return createReplayRecord({ log, title: id, updatedAt: '2026-08-01T00:00:00.000Z', source: 'test-mode' });
}

function opponentDrawRound(suffix: string): RoundLog {
  const value = baseReplayRound(`STAB-003-${suffix}`);
  const draw = snapshot(17, `${suffix}-opponent-draw`);
  value.initialHands![0] = [snapshot(17, `${suffix}-same-type-private`)];
  value.liveWall = [draw, snapshot(18, `${suffix}-future-live`)];
  value.events = [
    { type: 'tile-drawn', eventId: `${suffix}-draw`, sequence: 1, roundId: value.roundId, actor: 1, tile: draw },
    { type: 'tile-discarded', eventId: `${suffix}-discard`, sequence: 2, roundId: value.roundId, actor: 1, tile: draw },
  ];
  return value;
}

function callRound(type: 'chi-declared' | 'pon-declared' | 'minkan-declared', index: number): RoundLog {
  const value = baseReplayRound(`STAB-003-call-${index}`);
  const called = snapshot(3, `${type}-called`);
  const consumed = snapshot(type === 'chi-declared' ? 4 : 3, `${type}-consumed`);
  const companions = type === 'chi-declared'
    ? [snapshot(5, `${type}-companion-1`)]
    : [snapshot(3, `${type}-companion-1`), ...(type === 'minkan-declared' ? [snapshot(3, `${type}-companion-2`)] : [])];
  value.initialHands = [[called], companions, [], []];
  value.liveWall = [consumed, snapshot(18, `${type}-future`)];
  value.events = [
    { type: 'tile-drawn', eventId: `${type}-draw`, sequence: 1, roundId: value.roundId, actor: 1, tile: consumed },
    { type: 'tile-discarded', eventId: `${type}-discard`, sequence: 2, roundId: value.roundId, actor: 0, tile: called },
    { type, eventId: `${type}-call`, sequence: 3, roundId: value.roundId, actor: 1, from: 0, tiles: [called, consumed, ...companions] },
  ];
  return value;
}

function baseReplayRound(roundId: string): RoundLog {
  const deadWall = Array.from({ length: 14 }, (_, index) => snapshot(((19 + index) % 34) as TileId, `${roundId}-dead-${index}`));
  return {
    roundId,
    roundWind: 'east',
    handNumber: 1,
    dealer: 0,
    honba: 0,
    riichiSticks: 0,
    initialScores: [25000, 25000, 25000, 25000],
    initialHands: [[snapshot(8, `${roundId}-p0`)], [snapshot(0, `${roundId}-p1`)], [snapshot(9, `${roundId}-p2`)], [snapshot(10, `${roundId}-p3`)]],
    initialDoraIndicators: [deadWall[4]],
    liveWall: [snapshot(17, `${roundId}-live-0`)],
    deadWall,
    events: [],
  };
}

function snapshot(tileId: TileId, instanceId: string): TileSnapshot {
  return { tileId, instanceId, red: false };
}

function fixedTile(id: TileId, instanceId: string): Tile {
  return { id, suit: getTileSuit(id), rank: getTileRank(id), red: false, instanceId };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
