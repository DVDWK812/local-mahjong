import { passCall } from './callChecker';
import { canDeclareKyuushuKyuuhai, declareKyuushuKyuuhai } from './abortiveDraw';
import { executeChi, findUsefulChiOption } from './chiChecker';
import { canDeclareRiichi, declareRiichi, discardTile, drawTile } from './engine';
import { canAnkan, canChankan, canKakan, canMinkan, declareChankanRon, executeKan, passChankan } from './kanChecker';
import { recommendDiscards, shanten } from './shanten';
import type { GameState, PlayerId, Tile } from './types';
import { ALL_TILE_IDS } from './tileUtils';

export const HUMAN_PLAYER_ID: PlayerId = 0;

export function isAIPlayer(playerId: PlayerId): boolean {
  return playerId !== HUMAN_PLAYER_ID;
}

export function getVisibleCountsForPlayer(state: GameState, playerId: PlayerId): number[] {
  const visible = Array.from({ length: 34 }, () => 0);

  state.players.forEach((player) => {
    player.river.forEach((tile) => {
      visible[tile.id] += 1;
    });
    player.calls.forEach((call) => {
      call.tiles.forEach((tile) => {
        visible[tile.id] += 1;
      });
    });
  });

  state.doraIndicators.forEach((tile) => {
    visible[tile.id] += 1;
  });

  state.players[playerId].hand.forEach((tile) => {
    visible[tile.id] += 1;
  });

  return ALL_TILE_IDS.map((id) => visible[id]);
}

export function selectAIDiscardTile(state: GameState, playerId: PlayerId, rng: () => number = Math.random): Tile | null {
  const player = state.players[playerId];
  if (!player || player.hand.length === 0) return null;

  const visibleCounts = getVisibleCountsForPlayer(state, playerId);
  const [best] = recommendDiscards(player.hand, visibleCounts);

  if (best) {
    const recommended = player.hand.find((tile) => tile.id === best.tileId);
    if (recommended) return recommended;
  }

  const index = Math.min(player.hand.length - 1, Math.floor(rng() * player.hand.length));
  return player.hand[index];
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
    if (aiKanOption && canMinkan(state, aiKanOption.player) && shouldKan(state, aiKanOption.player)) {
      return executeKan(state, aiKanOption.player, 'minkan');
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
    const riichiState = canDeclareRiichi(state, state.currentPlayer)
      ? declareRiichi(state, state.currentPlayer)
      : state;
    if ((canAnkan(riichiState, riichiState.currentPlayer) || canKakan(riichiState, riichiState.currentPlayer)) && shouldKan(riichiState, riichiState.currentPlayer)) {
      return executeKan(riichiState, riichiState.currentPlayer);
    }
    const tile = selectAIDiscardTile(riichiState, riichiState.currentPlayer, rng);
    return tile ? discardTile(riichiState, riichiState.currentPlayer, tile.instanceId) : riichiState;
  }

  return state;
}

function shouldDeclareKyuushuKyuuhai(_state: GameState, _playerId: PlayerId): boolean {
  return true;
}

function shouldKan(state: GameState, playerId: PlayerId): boolean {
  return shanten(state.players[playerId].hand).best <= 0;
}
