import type { GameState, TileId, VisibleTileCount } from './types';
import { ALL_TILE_IDS } from './tileUtils';

export function getVisibleTileCounts(state: GameState): VisibleTileCount[] {
  const visibleById = new Map<TileId, number>();
  ALL_TILE_IDS.forEach((id) => visibleById.set(id, 0));

  state.players.forEach((player) => {
    player.river.forEach((tile) => visibleById.set(tile.id, (visibleById.get(tile.id) ?? 0) + 1));
    player.calls.forEach((call) => {
      call.tiles.forEach((tile) => visibleById.set(tile.id, (visibleById.get(tile.id) ?? 0) + 1));
    });
  });

  state.doraIndicators.forEach((tile) => {
    visibleById.set(tile.id, (visibleById.get(tile.id) ?? 0) + 1);
  });

  state.players[0].hand.forEach((tile) => {
    visibleById.set(tile.id, (visibleById.get(tile.id) ?? 0) + 1);
  });

  return ALL_TILE_IDS.map((id) => {
    const visible = visibleById.get(id) ?? 0;
    return {
      id,
      visible,
      remaining: 4 - visible,
    };
  });
}
