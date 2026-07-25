import type { GameState, PendingCallOption, PlayerId, Tile } from './types';
import { sortTiles } from './tileUtils';
import { settleExhaustiveDraw } from './exhaustiveDraw';

export function canPon(state: GameState, playerId: PlayerId): boolean {
  const discard = state.pendingCall?.tile ?? state.lastDiscard?.tile;
  const discarder = state.pendingCall?.discarder ?? state.lastDiscard?.player;
  if (!discard || discarder === undefined || discarder === playerId) return false;
  if (state.players[playerId].riichi) return false;
  if (state.pendingCall && !state.pendingCall.options.some((option) => option.type === 'pon' && option.player === playerId)) return false;
  return state.players[playerId].hand.filter((tile) => tile.id === discard.id).length >= 2;
}

export function getPonOptions(state: GameState, discarder: PlayerId, discardedTile: Tile): PendingCallOption[] {
  return state.players.flatMap((player) => {
    if (player.id === discarder || player.riichi) return [];
    const matchingTiles = player.hand.filter((tile) => tile.id === discardedTile.id);
    return matchingTiles.length >= 2 ? [{ type: 'pon' as const, player: player.id }] : [];
  });
}

export function executePon(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== 'call-window' || !state.pendingCall) return state;
  if (!canPon(state, playerId)) return state;

  const { discarder, tile } = state.pendingCall;
  const players = clearIppatsu(state.players).map((player) => ({
    ...player,
    hand: [...player.hand],
    river: [...player.river],
    calls: player.calls.map((call) => ({ ...call, tiles: [...call.tiles] })),
    drawnTile: player.drawnTile ? { ...player.drawnTile } : null,
    furitenState: player.furitenState ? { ...player.furitenState } : undefined,
  }));
  const caller = players[playerId];
  const discardingPlayer = players[discarder];

  const calledTiles = [];
  for (let i = caller.hand.length - 1; i >= 0 && calledTiles.length < 2; i -= 1) {
    if (caller.hand[i].id === tile.id) {
      const [removed] = caller.hand.splice(i, 1);
      calledTiles.push(removed);
    }
  }

  markRiverTileClaimed(discardingPlayer.river, tile.instanceId, playerId);

  caller.calls.push({
    type: 'pon',
    tiles: [...calledTiles, tile].sort(sortTiles),
    from: discarder,
    opened: true,
  });
  caller.hand.sort(sortTiles);
  caller.drawnTile = null;

  return {
    ...state,
    players,
    currentPlayer: playerId,
    phase: 'discard',
    pendingCall: null,
    callsOccurred: true,
    firstTurnInterrupted: true,
  };
}

function markRiverTileClaimed(river: Tile[], instanceId: string, claimedBy: PlayerId): void {
  const riverIndex = river.findIndex((riverTile) => riverTile.instanceId === instanceId);
  if (riverIndex !== -1) {
    river[riverIndex] = {
      ...river[riverIndex],
      claimed: true,
      claimedBy,
    } as Tile & { claimed: boolean; claimedBy: PlayerId };
  }
}

export function passCall(state: GameState): GameState {
  if (state.phase !== 'call-window' || !state.pendingCall) return state;
  const nextPlayer = ((state.pendingCall.discarder + 1) % 4) as PlayerId;
  if (state.wall.length === 0) return settleExhaustiveDraw({ ...state, currentPlayer: nextPlayer, pendingCall: null });
  return {
    ...state,
    currentPlayer: nextPlayer,
    phase: state.wall.length > 0 ? 'draw' : 'exhaustive-draw',
    pendingCall: null,
  };
}

function clearIppatsu(players: GameState['players']): GameState['players'] {
  return players.map((player) => ({
    ...player,
    riichiState: player.riichiState ? { ...player.riichiState, ippatsuAvailable: false } : null,
    furitenState: player.furitenState ? { ...player.furitenState } : undefined,
  }));
}
