import { canPon, executePon, passCall } from './callChecker';
import { canDeclareKyuushuKyuuhai, declareKyuushuKyuuhai } from './abortiveDraw';
import { executeChi, findUsefulChiOption } from './chiChecker';
import { declareRiichi, discardTile, drawTile, getRiichiDiscardCandidates } from './engine';
import { canAnkan, canChankan, canKakan, canMinkan, declareChankanRon, executeKan, passChankan } from './kanChecker';
import { recommendDiscards, shanten } from './shanten';
import type { GameState, PlayerId, Tile, TileId } from './types';
import { ALL_TILE_IDS } from './tileUtils';
import { isKuikaeEnabled, kuikaeForbiddenForPlayer, legalDiscardTiles } from './kuikae';

export const HUMAN_PLAYER_ID: PlayerId = 0;

export function isAIPlayer(playerId: PlayerId): boolean {
  return playerId !== HUMAN_PLAYER_ID;
}

export function getVisibleCountsForPlayer(state: GameState, playerId: PlayerId): number[] {
  const visible = Array.from({ length: 34 }, () => 0);
  const seenInstances = new Set<string>();
  const countVisibleTile = (tile: Tile) => {
    if (seenInstances.has(tile.instanceId)) return;
    seenInstances.add(tile.instanceId);
    visible[tile.id] += 1;
  };

  state.players.forEach((player) => {
    player.river.forEach(countVisibleTile);
    player.calls.forEach((call) => {
      call.tiles.forEach(countVisibleTile);
    });
  });

  state.doraIndicators.forEach(countVisibleTile);
  state.players[playerId].hand.forEach(countVisibleTile);

  return ALL_TILE_IDS.map((id) => visible[id]);
}

export function selectAIDiscardTile(
  state: GameState,
  playerId: PlayerId,
  rng: () => number = Math.random,
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

  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[index];
}

export function advanceAIAction(state: GameState, rng: () => number = Math.random): GameState {
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
    if ((canAnkan(state, playerId) || canKakan(state, playerId)) && shouldKan(state, playerId)) {
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
