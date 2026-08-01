import type { GameState, PlayerId, Tile, TileId, VisibleTileCount } from './types';
import { ALL_TILE_IDS } from './tileUtils';

export interface VisibleTileInstance {
  instanceId: string;
  tileId: TileId;
  red: boolean;
  sourceRegions: string[];
}

export interface VisibleTileCountDetail extends VisibleTileCount {
  instances: VisibleTileInstance[];
}

export function getVisibleTileCounts(state: GameState, playerId: PlayerId = 0): VisibleTileCountDetail[] {
  const instances = new Map<string, VisibleTileInstance>();
  const addVisibleTile = (tile: Tile, sourceRegion: string) => {
    const existing = instances.get(tile.instanceId);
    if (existing) {
      if (!existing.sourceRegions.includes(sourceRegion)) existing.sourceRegions.push(sourceRegion);
      return;
    }
    instances.set(tile.instanceId, {
      instanceId: tile.instanceId,
      tileId: tile.id,
      red: tile.red,
      sourceRegions: [sourceRegion],
    });
  };

  state.players.forEach((player) => {
    player.river.forEach((tile) => addVisibleTile(tile, `player-${player.id}-river`));
    player.calls.forEach((call, callIndex) => {
      call.tiles.forEach((tile) => addVisibleTile(tile, `player-${player.id}-call-${callIndex}`));
    });
  });

  state.doraIndicators.forEach((tile) => addVisibleTile(tile, 'dora-indicator'));
  state.players[playerId]?.hand.forEach((tile) => addVisibleTile(tile, `player-${playerId}-hand`));

  return ALL_TILE_IDS.map((id) => {
    const visibleInstances = [...instances.values()].filter((instance) => instance.tileId === id);
    const visible = Math.min(4, visibleInstances.length);
    return {
      id,
      visible,
      remaining: Math.max(0, 4 - visible),
      instances: visibleInstances,
    };
  });
}
