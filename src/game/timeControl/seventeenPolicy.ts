import { confirmBuild, declareSeventeenStepsRon, discardCandidate, passSeventeenStepsRon, validateSeventeenSelection, type SeventeenStepsState } from '../seventeenSteps';
import { canonicalLegalTile } from './fourPlayerPolicy';
import type { ModePolicy } from './matchRuntime';
import type { Tile } from '../types';

export const SEVENTEEN_HUMAN = 'seventeen:0';
export type SelectionCompletion = { kind: 'ready'; tiles: Tile[]; strategy: 'current' | 'recent' | 'canonical-completion-v1' }
  | { kind: 'failed'; reason: 'invalid-pool' | 'no-completion' | 'budget-exhausted' };
/** Existing confirmation has no shape/yaku constraint: at most 34 visits suffice, no AI/search needed. */
export function completeSelection(state: SeventeenStepsState, recent: Tile[] = [], expansionLimit = 34): SelectionCompletion {
  const player = state.players[0];
  if (validateSeventeenSelection(state, 0)) return { kind: 'ready', tiles: player.fixedHand, strategy: 'current' };
  const candidate = (tiles: Tile[]) => ({ ...state, players: [{ ...player, fixedHand: tiles }, state.players[1]] } as SeventeenStepsState);
  if (validateSeventeenSelection(candidate(recent), 0)) return { kind: 'ready', tiles: recent, strategy: 'recent' };
  if (new Set(player.sourceTiles.map(t => t.instanceId)).size !== player.sourceTiles.length) return { kind: 'failed', reason: 'invalid-pool' };
  const pool = new Map(player.sourceTiles.map(t => [t.instanceId, t]));
  const tiles = [...new Map(player.fixedHand.filter(t => pool.has(t.instanceId)).map(t => [t.instanceId, pool.get(t.instanceId)!])).values()].slice(0, 13);
  const sorted = [...player.sourceTiles].sort((a, b) => a.id - b.id || Number(a.red) - Number(b.red) || (a.instanceId < b.instanceId ? -1 : 1));
  let visits = 0;
  for (const tile of sorted) {
    if (tiles.length === 13) break;
    if (++visits > expansionLimit) return { kind: 'failed', reason: 'budget-exhausted' };
    if (!tiles.some(t => t.instanceId === tile.instanceId)) tiles.push(tile);
  }
  return validateSeventeenSelection(candidate(tiles), 0) ? { kind: 'ready', tiles, strategy: 'canonical-completion-v1' } : { kind: 'failed', reason: 'no-completion' };
}
export function createSeventeenPolicy(): ModePolicy<SeventeenStepsState> {
  let latest: Tile[] = [];
  let poolVersion = '';
  return {
    mode: 'seventeen', handId: s => `${s.completedHands}:${s.players[0].sourceTiles.map(t => t.instanceId).join(',')}`,
    resourceKey: s => `${s.completedHands}:${s.phase === 'build' ? 'build' : 'battle'}`,
    decisions: s => {
      const participantId = SEVENTEEN_HUMAN;
      const version = `${s.completedHands}:${s.players[0].sourceTiles.map(t => t.instanceId).join(',')}`;
      if (poolVersion !== version) { latest = []; poolVersion = version; }
      if (s.phase === 'build' && !s.players[0].buildConfirmed) {
        if (validateSeventeenSelection(s, 0)) latest = [...s.players[0].fixedHand];
        return [{ participantId, kind: 'selection', key: `selection:${version}`, budgetId: `selection:${version}` }];
      }
      if (s.phase === 'active' && s.currentPlayerId === 0) return [{ participantId, kind: 'turn', key: `candidate:${s.turnIndex}`, budgetId: `candidate:${s.turnIndex}` }];
      if (s.phase === 'ron-window' && s.pendingRon?.winnerId === 0) return [{ participantId, kind: 'response', key: `ron:${s.turnIndex}`, budgetId: `ron:${s.turnIndex}` }];
      return [];
    },
    editable: (_s, d) => d.kind === 'selection',
    timeout: (s, d) => {
      if (d.kind === 'selection') {
        const result = completeSelection(s, latest);
        if (result.kind === 'failed') throw new Error(`准备失败（preparation-failed：${result.reason}），本次不计分，请返回比赛设置`);
        return confirmBuild({ ...s, players: [{ ...s.players[0], fixedHand: result.tiles }, s.players[1]] }, 0);
      }
      if (d.kind === 'response') return passSeventeenStepsRon(s, 0);
      const tile = canonicalLegalTile(s.players[0].discardCandidates);
      if (!tile) throw new Error('候选池没有合法弃牌，已停止自动操作');
      return discardCandidate(s, 0, tile.instanceId);
    },
    automatic: (s, _d, p) => s.phase === 'ron-window' && s.pendingRon?.winnerId === 0 && p.autoWin
      ? { state: declareSeventeenStepsRon(s, 0), source: 'auto-win' } : null,
  };
}
