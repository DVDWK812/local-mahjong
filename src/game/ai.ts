import { canPon, executePon, passCall } from './callChecker';
import { canDeclareKyuushuKyuuhai, declareKyuushuKyuuhai } from './abortiveDraw';
import { executeChi, findUsefulChiOption } from './chiChecker';
import { declareRiichi, discardTile, drawTile, getRiichiDiscardCandidates } from './engine';
import { canChankan, canKakan, canMinkan, declareChankanRon, executeKan, getLegalAnkanCandidates, passChankan, type KanCandidate } from './kanChecker';
import { recommendDiscards, shanten } from './shanten';
import type { GameState, PlayerId, Tile, TileId } from './types';
import { isKuikaeEnabled, kuikaeForbiddenForPlayer, legalDiscardTiles } from './kuikae';
import { getVisibleTileCounts } from './visibility';
import { productionRandomSource, randomValue, type RandomSource } from './randomSource';

export const HUMAN_PLAYER_ID: PlayerId = 0;

export function isAIPlayer(playerId: PlayerId): boolean {
  return playerId !== HUMAN_PLAYER_ID;
}

export function getVisibleCountsForPlayer(state: GameState, playerId: PlayerId): number[] {
  return getVisibleTileCounts(state, playerId).map((count) => count.visible);
}

export function getAIAnkanCandidates(state: GameState, playerId: PlayerId): KanCandidate[] {
  return isAIPlayer(playerId) ? getLegalAnkanCandidates(state, playerId) : [];
}

export function selectAIDiscardTile(
  state: GameState,
  playerId: PlayerId,
  rng: RandomSource | (() => number) = productionRandomSource,
  allowedCandidates?: readonly Tile[],
): Tile | null {
  const player = state.players[playerId];
  if (!player || player.hand.length === 0) return null;

  const allowedInstanceIds = allowedCandidates
    ? new Set(allowedCandidates.map((tile) => tile.instanceId))
    : null;
  const legalTiles = legalDiscardTiles(state, playerId);
  const candidates = allowedInstanceIds
    ? legalTiles.filter((tile) => allowedInstanceIds.has(tile.instanceId))
    : legalTiles;
  if (candidates.length === 0) return null;

  const visibleCounts = getVisibleCountsForPlayer(state, playerId);
  const forbiddenTileIds = isKuikaeEnabled(state) ? kuikaeForbiddenForPlayer(state, playerId) : [];
  const recommendations = recommendDiscards(player.hand, visibleCounts, forbiddenTileIds);
  for (const recommendation of recommendations) {
    const recommended = candidates.find((tile) => tile.id === recommendation.tileId);
    if (recommended) return recommended;
  }

  return selectAIRandomLegalDiscardTile(state, playerId, rng, candidates);
}

export function selectAIRandomLegalDiscardTile(
  state: GameState,
  playerId: PlayerId,
  rng: RandomSource | (() => number) = productionRandomSource,
  allowedCandidates?: readonly Tile[],
): Tile | null {
  const legal = legalDiscardTiles(state, playerId);
  const allowed = allowedCandidates ? new Set(allowedCandidates.map((tile) => tile.instanceId)) : null;
  const candidates = allowed ? legal.filter((tile) => allowed.has(tile.instanceId)) : legal;
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(randomValue(rng) * candidates.length));
  return candidates[index];
}

export function advanceAIAction(state: GameState, rng: RandomSource | (() => number) = productionRandomSource): GameState {
  if (state.phase === 'chankan-window') {
    const aiWinner = state.pendingKakan?.eligibleRonPlayers.find((playerId) => isAIPlayer(playerId) && canChankan(state, playerId));
    if (aiWinner !== undefined) return declareChankanRon(state, aiWinner);
    const aiPasser = state.pendingKakan?.eligibleRonPlayers.find((playerId) => isAIPlayer(playerId) && !state.pendingKakan?.passedPlayers.includes(playerId));
    return aiPasser !== undefined ? passChankan(state, aiPasser) : state;
  }

  if (state.phase === 'call-window') {
    const aiKanOption = state.pendingCall?.options.find((option) => option.type === 'kan' && option.kanType === 'minkan' && isAIPlayer(option.player));
    if (aiKanOption && canMinkan(state, aiKanOption.player) && shouldMinkan(state, aiKanOption.player)) {
      return executeKan(state, aiKanOption.player, 'minkan');
    }
    const aiPonOption = state.pendingCall?.options.find((option) => option.type === 'pon' && isAIPlayer(option.player));
    if (aiPonOption && canPon(state, aiPonOption.player) && shouldPon(state, aiPonOption.player)) {
      return executePon(state, aiPonOption.player);
    }
    const aiChiPlayer = state.pendingCall?.options.find((option) => option.type === 'chi' && isAIPlayer(option.player))?.player;
    const chiOption = aiChiPlayer === undefined ? null : findUsefulChiOption(state, aiChiPlayer);
    if (aiChiPlayer !== undefined && chiOption !== null) return executeChi(state, aiChiPlayer, chiOption);
    return passCall(state);
  }

  if (!isAIPlayer(state.currentPlayer)) return state;
  if (state.phase === 'exhaustive-draw' || state.phase === 'round-ended') return state;

  if (state.phase === 'draw') {
    return drawTile(state);
  }

  if (state.phase === 'discard') {
    if (canDeclareKyuushuKyuuhai(state, state.currentPlayer) && shouldDeclareKyuushuKyuuhai(state, state.currentPlayer)) {
      return declareKyuushuKyuuhai(state, state.currentPlayer);
    }
    const playerId = state.currentPlayer;
    const riichiCandidates = getRiichiDiscardCandidates(state, playerId);
    if (riichiCandidates.length > 0) {
      const riichiDiscard = selectAIDiscardTile(state, playerId, rng, riichiCandidates);
      if (riichiDiscard) {
        const riichiState = declareRiichi(state, playerId);
        return discardTile(riichiState, playerId, riichiDiscard.instanceId);
      }
    }
    if ((getAIAnkanCandidates(state, playerId).length > 0 || canKakan(state, playerId)) && shouldKan(state, playerId)) {
      return executeKan(state, playerId);
    }
    const tile = selectAIDiscardTile(state, playerId, rng);
    return tile ? discardTile(state, playerId, tile.instanceId) : state;
  }

  return state;
}

function shouldDeclareKyuushuKyuuhai(_state: GameState, _playerId: PlayerId): boolean {
  return true;
}

function shouldKan(state: GameState, playerId: PlayerId): boolean {
  return shanten(state.players[playerId].hand).best <= 0;
}

function shouldMinkan(state: GameState, playerId: PlayerId): boolean {
  const tileId = state.pendingCall?.tile.id;
  if (tileId === undefined) return false;
  if (isYakuhaiValue(tileId, state, playerId)) return true;
  return shanten(state.players[playerId].hand).best <= 0;
}

function shouldPon(state: GameState, playerId: PlayerId): boolean {
  const tileId = state.pendingCall?.tile.id;
  if (tileId === undefined) return false;
  if (isYakuhaiValue(tileId, state, playerId)) return true;

  const player = state.players[playerId];
  const before = shanten(player.hand).best;
  const afterHand = removeMatchingTiles(player.hand, tileId, 2);
  if (afterHand.length !== player.hand.length - 2) return false;
  return shanten(afterHand).best < before;
}

function removeMatchingTiles(hand: Tile[], tileId: TileId, amount: number): Tile[] {
  let removed = 0;
  return hand.filter((tile) => {
    if (tile.id !== tileId || removed >= amount) return true;
    removed += 1;
    return false;
  });
}

function isYakuhaiValue(tileId: TileId, state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return tileId >= 31 || tileId === windToTileId(state.roundWind) || tileId === windToTileId(player.seatWind);
}

function windToTileId(wind: GameState['roundWind']): TileId {
  const ids: Record<GameState['roundWind'], TileId> = {
    east: 27,
    south: 28,
    west: 29,
    north: 30,
  };
  return ids[wind];
}
