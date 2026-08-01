import { canDeclareKyuushuKyuuhai } from './abortiveDraw';
import { canDeclareDoubleRiichi, canDeclareRiichi, getRiichiDiscardCandidates } from './engine';
import { getLegalAnkanCandidates, getKakanCandidates, type KanCandidate } from './kanChecker';
import type { GameState, PlayerId, Tile } from './types';
import { canTsumo } from './winChecker';

export interface DrawActionState {
  canTsumo: boolean;
  canRiichi: boolean;
  canDoubleRiichi: boolean;
  canKyuushuKyuuhai: boolean;
  riichiDiscardCandidates: Tile[];
  ankanCandidates: KanCandidate[];
  kakanCandidates: KanCandidate[];
}

export function getDrawActionState(state: GameState, playerId: PlayerId): DrawActionState {
  const player = state.players[playerId];
  const ankanCandidates = getLegalAnkanCandidates(state, playerId);
  return {
    canTsumo: state.phase === 'discard' && state.currentPlayer === playerId && canTsumo(state, playerId) !== null,
    canRiichi: canDeclareRiichi(state, playerId),
    canDoubleRiichi: canDeclareRiichi(state, playerId) && canDeclareDoubleRiichi(state, playerId),
    canKyuushuKyuuhai: canDeclareKyuushuKyuuhai(state, playerId),
    riichiDiscardCandidates: getRiichiDiscardCandidates(state, playerId),
    ankanCandidates,
    kakanCandidates: player?.riichi ? [] : getKakanCandidates(state, playerId),
  };
}

export function hasDrawAction(state: GameState, playerId: PlayerId): boolean {
  const actions = getDrawActionState(state, playerId);
  return actions.canTsumo
    || actions.canRiichi
    || actions.canKyuushuKyuuhai
    || actions.ankanCandidates.length > 0
    || actions.kakanCandidates.length > 0;
}
