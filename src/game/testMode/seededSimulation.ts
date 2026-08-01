import { selectAIRandomLegalDiscardTile } from '../ai';
import { passCall } from '../callChecker';
import { declareRon, discardTile, drawTile, createInitialGameState } from '../engine';
import { settleExhaustiveDraw } from '../exhaustiveDraw';
import { passChankan } from '../kanChecker';
import type { FullRuleConfig } from '../match/types';
import { createSeededRandomSource, type RandomSource } from '../randomSource';
import { createInitialMatchLog, recordGameStateTransition, startRoundInMatchLog } from '../replay/eventRecorder';
import type { MatchLog } from '../replay/types';
import { validateTileInstanceRegions } from '../tileInstanceValidation';
import type { GameState, Tile } from '../types';
import { legalActionSummary, scenarioFromGameState } from './scenario';
import type { InvariantCheck, TestScenarioV1 } from './types';

export const SEEDED_ACTION_STRATEGY = 'official-ai-pass-calls-v1';

export interface SeededSimulationFailure {
  seed: string;
  ruleConfig: FullRuleConfig;
  actionIndex: number;
  action: string;
  reasons: string[];
  scenario: TestScenarioV1;
}

export interface SeededRoundResult {
  seed: string;
  strategy: typeof SEEDED_ACTION_STRATEGY;
  initialWall: string[];
  actions: string[];
  finalState: GameState;
  matchLog: MatchLog;
  invariantChecks: Array<{ actionIndex: number; action: string; checks: InvariantCheck[] }>;
  failure?: SeededSimulationFailure;
}

export interface SeededBatchResult {
  seed: string;
  requestedRounds: number;
  completedRounds: number;
  paused: boolean;
  failure?: SeededSimulationFailure;
  lastResult?: SeededRoundResult;
}

export function runSeededRound(params: { seed: string; ruleConfig: FullRuleConfig; maxActions?: number }): SeededRoundResult {
  const randomSource = createSeededRandomSource(params.seed);
  let state = withSimulationRules(createInitialGameState(randomSource), params.ruleConfig);
  const initialWall = [...state.players.flatMap((player) => player.hand), ...state.wall, ...state.deadWall].map(tileSignature);
  let matchLog = startRoundInMatchLog({
    ...createInitialMatchLog({
      matchId: `seeded-${sanitizeSeed(params.seed)}`,
      playerNames: state.players.map((player) => player.name) as [string, string, string, string],
      playerTypes: ['ai', 'ai', 'ai', 'ai'],
      initialDealer: state.dealer,
      initialScores: state.players.map((player) => player.score) as [number, number, number, number],
      ruleConfig: params.ruleConfig,
    }),
    createdAt: new Date(0).toISOString(),
    seed: params.seed,
  }, state, 1);
  const actions: string[] = [];
  const invariantChecks: SeededRoundResult['invariantChecks'] = [];
  const maxActions = params.maxActions ?? 300;

  while (!isTerminal(state) && actions.length < maxActions) {
    const before = state;
    const next = nextSimulationAction(state, randomSource);
    const actionIndex = actions.length;
    if (next.state === before) {
      const failure = simulationFailure(params.seed, params.ruleConfig, actionIndex, next.label, ['正式状态机没有推进'], state);
      return finishResult(params.seed, initialWall, actions, state, matchLog, invariantChecks, failure);
    }
    state = next.state;
    actions.push(next.label);
    matchLog = recordGameStateTransition(matchLog, before, state);
    const checks = checkSimulationInvariants(state, params.ruleConfig.match.startingPoints * 4);
    invariantChecks.push({ actionIndex, action: next.label, checks });
    const failed = checks.filter((check) => !check.passed);
    if (failed.length > 0) {
      const failure = simulationFailure(params.seed, params.ruleConfig, actionIndex, next.label, failed.map((check) => `${check.label}：${check.detail}`), state);
      return finishResult(params.seed, initialWall, actions, state, matchLog, invariantChecks, failure);
    }
  }

  const failure = isTerminal(state)
    ? undefined
    : simulationFailure(params.seed, params.ruleConfig, actions.length, '动作上限', [`超过${maxActions}步仍未终局`], state);
  return finishResult(params.seed, initialWall, actions, state, matchLog, invariantChecks, failure);
}

export function compareSeededRuns(seed: string, ruleConfig: FullRuleConfig): { equal: boolean; first: SeededRoundResult; second: SeededRoundResult; differences: string[] } {
  const first = runSeededRound({ seed, ruleConfig });
  const second = runSeededRound({ seed, ruleConfig });
  const differences: string[] = [];
  if (JSON.stringify(first.initialWall) !== JSON.stringify(second.initialWall)) differences.push('牌墙顺序不同');
  if (JSON.stringify(first.actions) !== JSON.stringify(second.actions)) differences.push('动作选择不同');
  if (JSON.stringify(first.finalState) !== JSON.stringify(second.finalState)) differences.push('最终状态不同');
  if (JSON.stringify(first.matchLog.rounds[0]?.events) !== JSON.stringify(second.matchLog.rounds[0]?.events)) differences.push('牌谱动作序列不同');
  return { equal: differences.length === 0 && !first.failure && !second.failure, first, second, differences };
}

export async function runSeededBatch(params: {
  seed: string;
  ruleConfig: FullRuleConfig;
  rounds: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, result: SeededRoundResult) => void;
}): Promise<SeededBatchResult> {
  let lastResult: SeededRoundResult | undefined;
  for (let index = 0; index < params.rounds; index += 1) {
    if (params.signal?.aborted) return { seed: params.seed, requestedRounds: params.rounds, completedRounds: index, paused: true, lastResult };
    const roundSeed = params.rounds === 1 ? params.seed : `${params.seed}:${index}`;
    lastResult = runSeededRound({ seed: roundSeed, ruleConfig: params.ruleConfig });
    params.onProgress?.(index + 1, lastResult);
    if (lastResult.failure) return { seed: params.seed, requestedRounds: params.rounds, completedRounds: index + 1, paused: false, failure: lastResult.failure, lastResult };
    if ((index + 1) % 5 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return { seed: params.seed, requestedRounds: params.rounds, completedRounds: params.rounds, paused: false, lastResult };
}

export function serializeSeededFailure(failure: SeededSimulationFailure): string {
  return JSON.stringify({
    auditId: 'STAB-010',
    seed: failure.seed,
    strategy: SEEDED_ACTION_STRATEGY,
    ruleConfig: failure.ruleConfig,
    actionIndex: failure.actionIndex,
    action: failure.action,
    reasons: failure.reasons,
    scenario: failure.scenario,
  }, null, 2);
}

export function checkSimulationInvariants(state: GameState, initialTotalPoints: number): InvariantCheck[] {
  const regionIssues = validateTileInstanceRegions(state);
  const uniqueTiles = uniquePhysicalTiles(state);
  const typeCounts = new Map<number, number>();
  uniqueTiles.forEach((tile) => typeCounts.set(tile.id, (typeCounts.get(tile.id) ?? 0) + 1));
  const overFour = [...typeCounts.entries()].filter(([, count]) => count > 4);
  const points = state.players.reduce((sum, player) => sum + player.score, 0) + state.riichiSticks * 1000;
  const terminal = isTerminal(state);
  const legal = legalActionSummary(state);
  return [
    invariant('tile-total', '牌实例总量', uniqueTiles.size === 136, `${uniqueTiles.size} / 136`),
    invariant('effective-unique', '有效区域实例唯一性', regionIssues.length === 0, regionIssues.join('；') || '通过'),
    invariant('tile-copies', '每种牌不超过四张', overFour.length === 0, overFour.map(([id, count]) => `${id}:${count}`).join('；') || '通过'),
    invariant('dead-wall', '固定王牌数量', state.deadWall.length === 14, `${state.deadWall.length} / 14`),
    invariant('phase-player', '当前玩家与phase有效', Number.isInteger(state.currentPlayer) && state.currentPlayer >= 0 && state.currentPlayer <= 3, `${state.currentPlayer} / ${state.phase}`),
    invariant('points', '点数加供托守恒', points === initialTotalPoints, `${points} / ${initialTotalPoints}`),
    invariant('legal-progress', '存在合法推进或已经终局', terminal || legal.length > 0, terminal ? '终局' : legal.join('、') || '无合法动作'),
  ];
}

function nextSimulationAction(state: GameState, randomSource: RandomSource): { label: string; state: GameState } {
  if (state.phase === 'draw') return { label: `玩家${state.currentPlayer + 1}摸牌`, state: drawTile(state, { settleTsumo: false }) };
  if (state.phase === 'discard') {
    const tile = selectAIRandomLegalDiscardTile(state, state.currentPlayer, randomSource);
    return tile
      ? { label: `玩家${state.currentPlayer + 1}弃${tile.instanceId}`, state: discardTile(state, state.currentPlayer, tile.instanceId) }
      : { label: `玩家${state.currentPlayer + 1}无合法弃牌`, state };
  }
  if (state.phase === 'ron-window' && state.pendingRon) {
    const winner = state.pendingRon.eligibleRonPlayers.find((player) => !state.pendingRon?.passedPlayers.includes(player));
    return winner === undefined
      ? { label: '跳过荣和', state }
      : { label: `玩家${winner + 1}荣和`, state: declareRon(state, winner) };
  }
  if (state.phase === 'call-window') return { label: '跳过鸣牌', state: passCall(state) };
  if (state.phase === 'exhaustive-draw') return { label: '结算流局', state: settleExhaustiveDraw(state) };
  if (state.phase === 'chankan-window' && state.pendingKakan) {
    const passer = state.pendingKakan.eligibleRonPlayers.find((player) => !state.pendingKakan?.passedPlayers.includes(player));
    return passer === undefined ? { label: '抢杠窗口无候选', state } : { label: `玩家${passer + 1}跳过抢杠`, state: passChankan(state, passer) };
  }
  return { label: `无法推进${state.phase}`, state };
}

function withSimulationRules(state: GameState, rules: FullRuleConfig): GameState {
  return {
    ...state,
    ruleConfig: rules.round,
    matchRuleConfig: rules.match,
    players: state.players.map((player) => ({ ...player, score: rules.match.startingPoints })),
  };
}

function finishResult(
  seed: string,
  initialWall: string[],
  actions: string[],
  finalState: GameState,
  matchLog: MatchLog,
  invariantChecks: SeededRoundResult['invariantChecks'],
  failure?: SeededSimulationFailure,
): SeededRoundResult {
  return {
    seed,
    strategy: SEEDED_ACTION_STRATEGY,
    initialWall,
    actions,
    finalState: JSON.parse(JSON.stringify(finalState)) as GameState,
    matchLog: canonicalizeMatchLog(matchLog),
    invariantChecks,
    failure,
  };
}

function canonicalizeMatchLog(log: MatchLog): MatchLog {
  return {
    ...JSON.parse(JSON.stringify(log)) as MatchLog,
    createdAt: new Date(0).toISOString(),
    rounds: log.rounds.map((round) => ({
      ...JSON.parse(JSON.stringify(round)) as typeof round,
      events: round.events.map((event, index) => ({ ...JSON.parse(JSON.stringify(event)), timestamp: index })),
    })),
  };
}

function simulationFailure(seed: string, ruleConfig: FullRuleConfig, actionIndex: number, action: string, reasons: string[], state: GameState): SeededSimulationFailure {
  return {
    seed,
    ruleConfig,
    actionIndex,
    action,
    reasons,
    scenario: scenarioFromGameState({
      id: `STAB-010-${sanitizeSeed(seed)}-ACTION-${actionIndex}`,
      name: `STAB-010失败种子 ${seed}`,
      description: reasons.join('；'),
      relatedAuditId: 'STAB-010',
      ruleConfig,
      handNumber: 1,
      gameState: state,
      initialTotalPoints: ruleConfig.match.startingPoints * 4,
      instructions: [`从动作${actionIndex}附近复现`, `失败动作：${action}`],
    }),
  };
}

function uniquePhysicalTiles(state: GameState): Map<string, Tile> {
  const unique = new Map<string, Tile>();
  const add = (tile: Tile) => { if (!unique.has(tile.instanceId)) unique.set(tile.instanceId, tile); };
  state.players.forEach((player) => {
    player.hand.forEach(add);
    player.river.forEach(add);
    player.calls.forEach((call) => call.tiles.forEach(add));
  });
  state.wall.forEach(add);
  state.deadWall.forEach(add);
  return unique;
}

function invariant(id: string, label: string, passed: boolean, detail: string): InvariantCheck {
  return { id, label, passed, detail };
}

function isTerminal(state: GameState): boolean {
  return state.phase === 'round-ended' && Boolean(state.result);
}

function tileSignature(tile: Tile): string {
  return `${tile.id}:${tile.red ? 1 : 0}:${tile.instanceId}`;
}

function sanitizeSeed(seed: string): string {
  return seed.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64) || 'seed';
}
