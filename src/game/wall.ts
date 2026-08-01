import type { Tile } from './types';
import { ALL_TILE_IDS, createTile } from './tileUtils';

export const RINSHAN_SLOT_INDICES = [0, 1, 2, 3] as const;
export const DORA_INDICATOR_SLOT_INDICES = [4, 6, 8, 10, 12] as const;
export const URA_DORA_INDICATOR_SLOT_INDICES = [5, 7, 9, 11, 13] as const;

export type DeadWallSlotRole = 'rinshan' | 'dora-indicator' | 'ura-dora-indicator';

export function deadWallSlotRole(index: number): DeadWallSlotRole | undefined {
  if ((RINSHAN_SLOT_INDICES as readonly number[]).includes(index)) return 'rinshan';
  if ((DORA_INDICATOR_SLOT_INDICES as readonly number[]).includes(index)) return 'dora-indicator';
  if ((URA_DORA_INDICATOR_SLOT_INDICES as readonly number[]).includes(index)) return 'ura-dora-indicator';
  return undefined;
}

/**
 * 王牌始终保留原始 14 张固定槽位：0..3 为岭上牌，4/6/8/10/12 为表宝牌，
 * 5/7/9/11/13 为对应里宝牌。杠只推进已用岭上牌数与活牌墙边界，不移动槽位。
 */
export function advanceWallAfterKan(
  liveWall: Tile[],
  deadWall: Tile[],
  usedRinshanCount: number,
): { liveWall: Tile[]; deadWall: Tile[]; rinshanTile?: Tile; doraIndicator?: Tile } {
  const rinshanSlot = RINSHAN_SLOT_INDICES[usedRinshanCount];
  const doraSlot = DORA_INDICATOR_SLOT_INDICES[usedRinshanCount + 1];
  const legacyOffset = deadWall.length < 14 ? Math.max(14 - deadWall.length, usedRinshanCount) : 0;
  const originalSlot = (slot: number | undefined): Tile | undefined =>
    slot === undefined ? undefined : deadWall[slot - legacyOffset];

  return {
    liveWall: liveWall.length > 0 ? liveWall.slice(0, -1) : liveWall,
    deadWall: deadWall.length < 14 ? deadWall.slice(1) : deadWall,
    rinshanTile: originalSlot(rinshanSlot),
    doraIndicator: originalSlot(doraSlot),
  };
}

export function doraIndicatorSlots(deadWall: Tile[]): Tile[] {
  return DORA_INDICATOR_SLOT_INDICES.map((slot) => deadWall[slot]).filter((tile): tile is Tile => Boolean(tile));
}

export function uraDoraIndicatorSlots(deadWall: Tile[]): Tile[] {
  return URA_DORA_INDICATOR_SLOT_INDICES.map((slot) => deadWall[slot]).filter((tile): tile is Tile => Boolean(tile));
}

export function activeUraDoraIndicators(deadWall: Tile[], revealedDoraCount: number): Tile[] {
  return uraDoraIndicatorSlots(deadWall).slice(0, revealedDoraCount);
}

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
  const doraIndicators = doraIndicatorSlots(deadWall).slice(0, 1);

  return { liveWall, deadWall, doraIndicators };
}
