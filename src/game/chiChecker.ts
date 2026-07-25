import { shanten } from './shanten';
import type { GameState, PendingCallOption, PlayerId, Tile, TileId } from './types';
import { sortTiles } from './tileUtils';

export function canChi(state: GameState, playerId: PlayerId): boolean {
  const discard = state.pendingCall?.tile ?? state.lastDiscard?.tile;
  const discarder = state.pendingCall?.discarder ?? state.lastDiscard?.player;
  if (!discard || discarder === undefined) return false;
  if (state.players[playerId].riichi) return false;
  if (state.pendingCall && !state.pendingCall.options.some((option) => option.type === 'chi' && option.player === playerId)) return false;
  return getChiOptions(state, discarder, discard).some((option) => option.player === playerId);
}

export function getChiOptions(state: GameState, discarder: PlayerId, discardedTile: Tile): PendingCallOption[] {
  const caller = ((discarder + 1) % 4) as PlayerId;
  const player = state.players[caller];
  if (!player || player.riichi || discardedTile.id >= 27) return [];

  const tileSuitStart = Math.floor(discardedTile.id / 9) * 9;
  const tileSuitEnd = tileSuitStart + 8;
  const starts = [discardedTile.id - 2, discardedTile.id - 1, discardedTile.id]
    .filter((start) => start >= tileSuitStart && start + 2 <= tileSuitEnd) as TileId[];

  return starts.flatMap((start) => {
    const sequence = [start, start + 1, start + 2] as TileId[];
    if (!sequence.includes(discardedTile.id)) return [];
    const usedTileIds = sequence.filter((id) => id !== discardedTile.id);
    return hasTiles(player.hand, usedTileIds)
      ? [{
          type: 'chi' as const,
          player: caller,
          sequence,
          usedTileIds,
        }]
      : [];
  });
}

export function executeChi(state: GameState, playerId: PlayerId, optionIndex = 0): GameState {
  if (state.phase !== 'call-window' || !state.pendingCall) return state;

  const options = state.pendingCall.options.filter((option) => option.type === 'chi' && option.player === playerId);
  const option = options[optionIndex];
  if (!option?.sequence || !option.usedTileIds || !canChi(state, playerId)) return state;

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
  const usedTiles: Tile[] = [];

  for (const neededId of option.usedTileIds) {
    const index = caller.hand.findIndex((handTile) => handTile.id === neededId);
    if (index === -1) return state;
    const [removed] = caller.hand.splice(index, 1);
    usedTiles.push(removed);
  }

  markRiverTileClaimed(discardingPlayer.river, tile.instanceId, playerId);

  caller.calls.push({
    type: 'chi',
    tiles: [...usedTiles, tile].sort(sortTiles),
    from: discarder,
    opened: true,
    sequence: option.sequence,
    calledTile: tile,
    usedTileIds: option.usedTileIds,
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

export function findUsefulChiOption(state: GameState, playerId: PlayerId): number | null {
  if (state.phase !== 'call-window' || !state.pendingCall) return null;
  const player = state.players[playerId];
  const options = state.pendingCall.options.filter((option) => option.type === 'chi' && option.player === playerId);
  const before = shanten(player.hand).best;

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (!option.usedTileIds) continue;
    const afterHand = [...player.hand];
    let valid = true;
    option.usedTileIds.forEach((id) => {
      const tileIndex = afterHand.findIndex((tile) => tile.id === id);
      if (tileIndex === -1) {
        valid = false;
        return;
      }
      afterHand.splice(tileIndex, 1);
    });
    if (!valid) continue;
    if (shanten(afterHand).best < before) return index;
  }

  return null;
}

function hasTiles(hand: Tile[], ids: TileId[]): boolean {
  const counts = new Map<TileId, number>();
  hand.forEach((tile) => counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1));
  return ids.every((id) => {
    const count = counts.get(id) ?? 0;
    if (count <= 0) return false;
    counts.set(id, count - 1);
    return true;
  });
}

function clearIppatsu(players: GameState['players']): GameState['players'] {
  return players.map((player) => ({
    ...player,
    riichiState: player.riichiState ? { ...player.riichiState, ippatsuAvailable: false } : null,
    furitenState: player.furitenState ? { ...player.furitenState } : undefined,
  }));
}
