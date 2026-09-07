import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import type { Table3DSeat } from './seatTransforms';
import { getSeatRotation } from './seatTransforms';
import type { TileOrientation } from '../tile/tileOrientation';
import { getFlatTileCenterY, getStandingTileCenterY } from '../tile/tileGrounding';
import { TILE_SPACING_3D } from '../tile/tileSpacing';
import {
  getFlatTileFootprint,
  packCenteredFootprints,
  packedWidth,
  packFromRightEdge,
  TILE_PACKING_GAPS,
} from '../tile/tileFootprintPacking';
import {
  getHandTileScale,
  TABLE_PRESENTATION_TUNING,
} from '../table/tablePresentationTuning';

export type SceneTileTransform = Readonly<{
  position: readonly [number, number, number];
  rotationX: number;
  rotationY: number;
}>;

export const TABLE_SCENE_LAYOUT = {
  tileCenterY: getFlatTileCenterY(),
  standingHandCenterY: getStandingTileCenterY(),
  standingHandRotationX: Math.PI / 2,
  handZ: 10.25,
  sideHandOutset: 2.5,
  handSpacing: TILE_SPACING_3D.standingHand,
  drawnGap: TILE_SPACING_3D.drawnGap,
  riverZ: 2.8,
  /** Rectangular-table radial room that keeps side rivers out of the top/bottom grids. */
  sideRiverOutset: 2.2,
  riverColumnSpacing: MAHJONG_TILE_DIMENSIONS.width + TILE_PACKING_GAPS.riverInline,
  riverRowSpacing: MAHJONG_TILE_DIMENSIONS.depth + TILE_PACKING_GAPS.riverRow,
  riverColumns: 6,
  meldZ: 9,
  sideMeldOutset: 2.5,
  meldRightX: 11.4,
  meldTileSpacing: TILE_SPACING_3D.meldTile,
  meldGroupSpacing: TILE_SPACING_3D.meldGroup,
  wallZ: 7.4,
  wallStackSpacing: 1.12,
  wallLayerHeight: MAHJONG_TILE_DIMENSIONS.height,
  deadWallStartGap: 0.28,
} as const;

const WALL_STACKS_PER_SEAT = [11, 10, 11, 10] as const;
const WALL_SEATS = ['bottom', 'right', 'top', 'left'] as const;
const LIVE_WALL_STACK_COUNT = 35;

export function getHandTileTransform(
  seat: Table3DSeat,
  index: number,
  tileCount: number,
  hasDrawnTile: boolean,
): SceneTileTransform {
  const tileScale = getHandTileScale(seat);
  const handSpacing = TABLE_SCENE_LAYOUT.handSpacing * tileScale;
  const drawnGap = TABLE_SCENE_LAYOUT.drawnGap * tileScale;
  // The drawn slot is independent: adding/removing it must not recenter the base hand.
  const totalSpan = Math.max(0, tileCount - (hasDrawnTile ? 2 : 1)) * handSpacing;
  const drawnOffset = hasDrawnTile && index === tileCount - 1
    ? drawnGap
    : 0;
  const transform = offsetLowerTableContent(applyHandSeatOffset(seat, canonicalToSeat(seat, [
    -totalSpan / 2 + index * handSpacing + drawnOffset,
    getStandingTileCenterY(tileScale),
    TABLE_SCENE_LAYOUT.handZ + (isSideSeat(seat) ? TABLE_SCENE_LAYOUT.sideHandOutset : 0),
  ])), isSideSeat(seat));
  return {
    ...transform,
    rotationX: TABLE_SCENE_LAYOUT.standingHandRotationX,
  };
}

export function getRiverTileTransform(
  seat: Table3DSeat,
  layoutIndex: number,
  columns = TABLE_SCENE_LAYOUT.riverColumns,
): SceneTileTransform {
  return getRiverTileTransforms(
    seat,
    Array.from({ length: layoutIndex + 1 }, (_, index) => ({
      layoutIndex: index,
      orientation: 'upright' as const,
    })),
    columns,
  ).get(layoutIndex)!;
}

export type RiverTransformInput = Readonly<{
  layoutIndex: number;
  orientation: TileOrientation;
}>;

export function getRiverTileTransforms(
  seat: Table3DSeat,
  tiles: readonly RiverTransformInput[],
  columns = TABLE_SCENE_LAYOUT.riverColumns,
  tileScale: number = TABLE_PRESENTATION_TUNING.tileScale.river,
): ReadonlyMap<number, SceneTileTransform> {
  if (tiles.length === 0) return new Map();
  const inlineGap = TILE_PACKING_GAPS.riverInline * tileScale;
  const rowGap = TILE_PACKING_GAPS.riverRow * tileScale;
  const byIndex = new Map(tiles.map((tile) => [tile.layoutIndex, tile.orientation]));
  const maximumIndex = Math.max(...tiles.map((tile) => tile.layoutIndex));
  const rowCount = Math.floor(maximumIndex / columns) + 1;
  const rowOrientations = Array.from({ length: rowCount }, (_, row) => (
    Array.from({ length: columns }, (_, column) => (
      byIndex.get(row * columns + column) ?? 'upright'
    ))
  ));
  const rowDepths = rowOrientations.map((orientations) => Math.max(
    ...orientations.map((orientation) => getFlatTileFootprint(orientation, tileScale).z),
  ));
  const rowCenters = rowDepths.map((depth, row) => {
    if (row === 0) return 0;
    return rowDepths.slice(1, row + 1).reduce(
      (offset, currentDepth, index) => offset
        + rowDepths[index] / 2
        + rowGap
        + currentDepth / 2,
      0,
    );
  });
  const baseZ = TABLE_SCENE_LAYOUT.riverZ
    + (isSideSeat(seat) ? TABLE_SCENE_LAYOUT.sideRiverOutset : 0);
  const seatOffset = TABLE_PRESENTATION_TUNING.riverSeatOffsets[seat];
  const result = new Map<number, SceneTileTransform>();
  rowOrientations.forEach((orientations, row) => {
    const centers = packCenteredFootprints(
      orientations.map((orientation) => getFlatTileFootprint(orientation, tileScale).x),
      inlineGap,
    );
    orientations.forEach((_orientation, column) => {
      const layoutIndex = row * columns + column;
      if (!byIndex.has(layoutIndex)) return;
      result.set(layoutIndex, offsetLowerTableContent(canonicalToSeat(seat, [
        centers[column] + seatOffset.inlineX,
        getFlatTileCenterY(tileScale),
        baseZ + rowCenters[row] + seatOffset.radialZ,
      ]), true));
    });
  });
  return result;
}

export function getRiverTileRotationY(
  seat: Table3DSeat,
  orientation: TileOrientation,
): number {
  return getSeatRotation(seat) + (orientation === 'sideways' ? Math.PI / 2 : 0);
}

export function getMeldTileTransform(
  seat: Table3DSeat,
  meldIndex: number,
  tileIndex: number,
  stackedOnIndex?: number,
): SceneTileTransform {
  const syntheticMelds = Array.from({ length: meldIndex + 1 }, (_, index) => ({
    tiles: Array.from({ length: index === meldIndex ? tileIndex + 1 : 3 }, (_unused, innerIndex) => ({
      orientation: 'upright' as const,
      stacked: index === meldIndex && innerIndex === tileIndex && stackedOnIndex !== undefined,
      called: index === meldIndex && innerIndex === stackedOnIndex,
    })),
  }));
  return getMeldTileTransforms(seat, syntheticMelds)[meldIndex][tileIndex];
}

export type MeldTransformInput = Readonly<{
  tiles: readonly Readonly<{
    orientation: TileOrientation;
    stacked: boolean;
    called: boolean;
  }>[];
}>;

export function getMeldTileTransforms(
  seat: Table3DSeat,
  melds: readonly MeldTransformInput[],
): readonly (readonly SceneTileTransform[])[] {
  const tileScale = TABLE_PRESENTATION_TUNING.tileScale.meld;
  const inlineGap = TILE_PACKING_GAPS.meldInline * tileScale;
  const groupGap = TILE_PACKING_GAPS.meldGroup * tileScale;
  let rightEdge = TABLE_SCENE_LAYOUT.meldRightX + MAHJONG_TILE_DIMENSIONS.width / 2;
  return melds.map((meld) => {
    const baseTiles = meld.tiles
      .map((tile, tileIndex) => ({ tile, tileIndex }))
      .filter(({ tile }) => !tile.stacked);
    const footprints = baseTiles.map(({ tile }) => getFlatTileFootprint(tile.orientation, tileScale).x);
    const centers = packFromRightEdge(footprints, rightEdge, inlineGap);
    const centersByTileIndex = new Map(baseTiles.map(({ tileIndex }, index) => [tileIndex, centers[index]]));
    const calledIndex = meld.tiles.findIndex((tile) => tile.called);
    const transforms = meld.tiles.map((tile, tileIndex) => {
      const stackBaseIndex = tile.stacked && calledIndex >= 0 ? calledIndex : tileIndex;
      const x = centersByTileIndex.get(stackBaseIndex) ?? centersByTileIndex.get(tileIndex) ?? rightEdge;
      const seatTransform = canonicalToSeat(seat, [
        x,
        getFlatTileCenterY(tileScale)
          + (tile.stacked ? (MAHJONG_TILE_DIMENSIONS.height + 0.04) * tileScale : 0),
        TABLE_SCENE_LAYOUT.meldZ + (isSideSeat(seat) ? TABLE_SCENE_LAYOUT.sideMeldOutset : 0),
      ]);
      return offsetLowerTableContent(applyMeldSeatOffset(seat, seatTransform), seat !== 'top');
    });
    rightEdge -= packedWidth(footprints, inlineGap) + groupGap;
    return transforms;
  });
}

function applyMeldSeatOffset(
  seat: Table3DSeat,
  transform: SceneTileTransform,
): SceneTileTransform {
  const { inline, radial } = TABLE_PRESENTATION_TUNING.meldSeatOffsets[seat];
  if (inline === 0 && radial === 0) return transform;
  const rotatedOffset = canonicalToSeat(seat, [inline, 0, radial]).position;
  return {
    ...transform,
    position: [
      transform.position[0] + rotatedOffset[0],
      transform.position[1],
      transform.position[2] + rotatedOffset[2],
    ],
  };
}

function applyHandSeatOffset(
  seat: Table3DSeat,
  transform: SceneTileTransform,
): SceneTileTransform {
  const { inline, radial } = TABLE_PRESENTATION_TUNING.handSeatOffsets[seat];
  if (inline === 0 && radial === 0) return transform;
  const rotatedOffset = canonicalToSeat(seat, [inline, 0, radial]).position;
  return {
    ...transform,
    position: [
      transform.position[0] + rotatedOffset[0],
      transform.position[1],
      transform.position[2] + rotatedOffset[2],
    ],
  };
}

function isSideSeat(seat: Table3DSeat): boolean {
  return seat === 'left' || seat === 'right';
}

function offsetLowerTableContent(
  transform: SceneTileTransform,
  enabled: boolean,
): SceneTileTransform {
  if (!enabled || Number(TABLE_PRESENTATION_TUNING.lowerTableContentOffsetZ) === 0) return transform;
  return {
    ...transform,
    position: [
      transform.position[0],
      transform.position[1],
      transform.position[2] + TABLE_PRESENTATION_TUNING.lowerTableContentOffsetZ,
    ],
  };
}

export function getWallTileTransform(slotIndex: number): SceneTileTransform {
  const stackIndex = Math.floor(slotIndex / 2);
  const layer = slotIndex % 2;
  return getWallStackTransform(stackIndex, layer, false);
}

export function getDeadWallTileTransform(slotIndex: number): SceneTileTransform {
  const stackIndex = LIVE_WALL_STACK_COUNT + Math.floor(slotIndex / 2);
  const layer = slotIndex % 2;
  return getWallStackTransform(stackIndex, layer, true);
}

function getWallStackTransform(
  stackIndex: number,
  layer: number,
  deadWall: boolean,
): SceneTileTransform {
  let seatIndex = 0;
  let localStackIndex = stackIndex;
  while (
    seatIndex < WALL_STACKS_PER_SEAT.length - 1
    && localStackIndex >= WALL_STACKS_PER_SEAT[seatIndex]
  ) {
    localStackIndex -= WALL_STACKS_PER_SEAT[seatIndex];
    seatIndex += 1;
  }
  const capacity = WALL_STACKS_PER_SEAT[seatIndex];
  const seat = WALL_SEATS[seatIndex];
  const deadWallOffset = deadWall ? TABLE_SCENE_LAYOUT.deadWallStartGap : 0;
  return canonicalToSeat(seat, [
    (localStackIndex - (capacity - 1) / 2) * TABLE_SCENE_LAYOUT.wallStackSpacing
      + deadWallOffset,
    TABLE_SCENE_LAYOUT.tileCenterY + layer * TABLE_SCENE_LAYOUT.wallLayerHeight,
    TABLE_SCENE_LAYOUT.wallZ,
  ]);
}

export function canonicalToSeat(
  seat: Table3DSeat,
  position: readonly [number, number, number],
): SceneTileTransform {
  const rotationY = getSeatRotation(seat);
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return {
    position: [
      position[0] * cosine + position[2] * sine,
      position[1],
      -position[0] * sine + position[2] * cosine,
    ],
    rotationX: 0,
    rotationY,
  };
}
