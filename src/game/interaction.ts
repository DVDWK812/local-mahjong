import { canDeclareKyuushuKyuuhai } from './abortiveDraw';
import { canDeclareDoubleRiichi, canDeclareRiichi, getRiichiDiscardCandidateGroups } from './engine';
import {
  getAnkanCandidates,
  getKakanCandidates,
  isRiichiAnkanWaitPreserving as isKanRiichiAnkanWaitPreserving,
  type KanCandidate,
} from './kanChecker';
import type { GameState, PlayerId, Tile, TileId } from './types';
import type { RiichiDiscardCandidateGroup } from './engine';
import { canTsumo } from './winChecker';

export interface DrawActionState {
  canTsumo: boolean;
  canRiichi: boolean;
  canDoubleRiichi: boolean;
  canKyuushuKyuuhai: boolean;
  riichiDiscardCandidates: Tile[];
  riichiDiscardCandidateGroups: RiichiDiscardCandidateGroup[];
  ankanCandidates: KanCandidate[];
  kakanCandidates: KanCandidate[];
}

export function getDrawActionState(state: GameState, playerId: PlayerId): DrawActionState {
  const player = state.players[playerId];
  const allAnkanCandidates = getAnkanCandidates(state, playerId);
  const riichiDiscardCandidateGroups = getRiichiDiscardCandidateGroups(state, playerId);
  const ankanCandidates = player?.riichi
    ? allAnkanCandidates.filter((candidate) => isRiichiAnkanWaitPreserving(state, playerId, candidate.tileId))
    : allAnkanCandidates;
  return {
    canTsumo: state.phase === 'discard' && state.currentPlayer === playerId && canTsumo(state, playerId) !== null,
    canRiichi: canDeclareRiichi(state, playerId),
    canDoubleRiichi: canDeclareRiichi(state, playerId) && canDeclareDoubleRiichi(state, playerId),
    canKyuushuKyuuhai: canDeclareKyuushuKyuuhai(state, playerId),
    riichiDiscardCandidates: riichiDiscardCandidateGroups.map((candidate) => candidate.tile),
    riichiDiscardCandidateGroups,
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

export function isRiichiAnkanWaitPreserving(state: GameState, playerId: PlayerId, tileId: TileId): boolean {
  return isKanRiichiAnkanWaitPreserving(state, playerId, tileId);
}
