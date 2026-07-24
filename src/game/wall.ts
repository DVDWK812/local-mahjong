import type { Tile } from './types';
import { ALL_TILE_IDS, createTile } from './tileUtils';

export function buildWall(): Tile[] {
  return ALL_TILE_IDS.flatMap((id) => [0, 1, 2, 3].map((copyIndex) => createTile(id, copyIndex)));
}

export function shuffleWall(tiles: Tile[]): Tile[] {
  const shuffled = [...tiles];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function createShuffledWall(): Tile[] {
  return shuffleWall(buildWall());
}

export function splitDeadWall(wall: Tile[]): { liveWall: Tile[]; deadWall: Tile[]; doraIndicators: Tile[] } {
  const deadWall = wall.slice(-14);
  const liveWall = wall.slice(0, -14);
  const doraIndicators = [deadWall[4]];

  return { liveWall, deadWall, doraIndicators };
}
