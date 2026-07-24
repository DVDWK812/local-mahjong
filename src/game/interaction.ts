import { canDeclareKyuushuKyuuhai } from './abortiveDraw';
import { canDeclareDoubleRiichi, canDeclareRiichi, getRiichiDiscardCandidates } from './engine';
import { getAnkanCandidates, getKakanCandidates, type KanCandidate } from './kanChecker';
import { shanten } from './shanten';
import type { GameState, PlayerId, Tile, TileId } from './types';
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
  const allAnkanCandidates = getAnkanCandidates(state, playerId);
  const ankanCandidates = player?.riichi
    ? allAnkanCandidates.filter((candidate) => isRiichiAnkanWaitPreserving(state, playerId, candidate.tileId))
    : allAnkanCandidates;
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

export function isRiichiAnkanWaitPreserving(state: GameState, playerId: PlayerId, tileId: TileId): boolean {
  const player = state.players[playerId];
  if (!player?.riichi) return true;
  const before = waitsForHand(player.hand);
  const afterHand = removeTilesById(player.hand, tileId, 4);
  if (afterHand.length !== player.hand.length - 4) return false;
  const after = waitsForHand(afterHand);
  return sameSet(before, after);
}

function waitsForHand(hand: Tile[]): Set<TileId> {
  const waits = new Set<TileId>();
  for (let id = 0; id < 34; id += 1) {
    const tile = { id: id as TileId, suit: 'honor' as const, rank: 0, red: false, instanceId: `test-${id}` };
    if (shanten([...hand, tile]).best < 0) waits.add(id as TileId);
  }
  return waits;
}

function removeTilesById(hand: Tile[], tileId: TileId, amount: number): Tile[] {
  let removed = 0;
  return hand.filter((tile) => {
    if (tile.id !== tileId || removed >= amount) return true;
    removed += 1;
    return false;
  });
}

function sameSet(a: Set<TileId>, b: Set<TileId>): boolean {
  if (a.size !== b.size) return false;
  return [...a].every((item) => b.has(item));
}
