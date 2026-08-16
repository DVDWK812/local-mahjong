import { declareKyuushuKyuuhai } from '../abortiveDraw';
import { advanceAIAction } from '../ai';
import { executePon, passCall } from '../callChecker';
import { executeChi } from '../chiChecker';
import { declareRiichi, declareRon, declareTsumo, discardTile, drawTile, passRon } from '../engine';
import { declareChankanRon, executeKan, passChankan, type KanType } from '../kanChecker';
import { createInitialMatchLog, recordGameStateTransition, startRoundInMatchLog } from '../replay/eventRecorder';
import type { MatchLog } from '../replay/types';
import type { GameState, PlayerId, TileId } from '../types';
import type { TestScenarioV1 } from './types';

export type OfficialTestModeAction =
  | { type: 'draw' }
  | { type: 'discard'; playerId: PlayerId; tileInstanceId: string }
  | { type: 'tsumo'; playerId: PlayerId }
  | { type: 'ron'; playerId: PlayerId }
  | { type: 'pass-ron'; playerId: PlayerId }
  | { type: 'riichi'; playerId: PlayerId; tileInstanceId: string }
  | { type: 'kyuushu-kyuuhai'; playerId: PlayerId }
  | { type: 'pon'; playerId: PlayerId }
  | { type: 'chi'; playerId: PlayerId; optionIndex: number }
  | { type: 'kan'; playerId: PlayerId; kanType?: KanType; tileId?: TileId }
  | { type: 'chankan-ron'; playerId: PlayerId }
  | { type: 'pass-chankan'; playerId: PlayerId }
  | { type: 'pass-call' }
  | { type: 'ai-next' };

/** 仅分派到正式游戏入口；测试模式不包含任何绕过合法性检查的动作实现。 */
export function applyOfficialTestModeAction(state: GameState, action: OfficialTestModeAction): GameState {
  if (action.type === 'draw') return drawTile(state, { settleTsumo: false });
  if (action.type === 'discard') return discardTile(state, action.playerId, action.tileInstanceId);
  if (action.type === 'tsumo') return declareTsumo(state, action.playerId);
  if (action.type === 'ron') return declareRon(state, action.playerId);
  if (action.type === 'pass-ron') return passRon(state, action.playerId);
  if (action.type === 'riichi') return declareRiichi(state, action.playerId, action.tileInstanceId);
  if (action.type === 'kyuushu-kyuuhai') return declareKyuushuKyuuhai(state, action.playerId);
  if (action.type === 'pon') return executePon(state, action.playerId);
  if (action.type === 'chi') return executeChi(state, action.playerId, action.optionIndex);
  if (action.type === 'kan') return executeKan(state, action.playerId, action.kanType, action.tileId);
  if (action.type === 'chankan-ron') return declareChankanRon(state, action.playerId);
  if (action.type === 'pass-chankan') return passChankan(state, action.playerId);
  if (action.type === 'pass-call') return passCall(state);
  return advanceAIAction(state);
}

export function createTestModeMatchLog(scenario: TestScenarioV1): MatchLog {
  const initial = createInitialMatchLog({
    matchId: `test-mode-${scenario.id}`,
    playerNames: scenario.gameState.players.map((player) => player.name) as [string, string, string, string],
    playerTypes: ['human', 'human', 'human', 'human'],
    initialDealer: scenario.gameState.dealer,
    initialScores: scenario.gameState.players.map((player) => player.score) as [number, number, number, number],
    ruleConfig: scenario.ruleConfig,
  });
  return startRoundInMatchLog(initial, scenario.gameState, scenario.handNumber);
}

export function recordTestModeAction(log: MatchLog, before: GameState, after: GameState): MatchLog {
  return recordGameStateTransition(log, before, after);
}

export function shouldAutomaticallyAdvanceTestModeAI(_manualPlayerIds: readonly PlayerId[], _currentPlayer: PlayerId): false {
  return false;
}
