import { BoxGeometry, CircleGeometry, PlaneGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const MAHJONG_TILE_DIMENSIONS = {
  width: 1.08,
  height: 0.6,
  depth: 1.46,
  radius: 0.11,
} as const;

export const MAHJONG_TILE_FACE = {
  width: 0.9,
  depth: 1.28,
  cornerRadius: 0.075,
  surfaceOffset: 0,
  markerOffset: 0,
} as const;

/** Top-left origin on the face, shared with settings thumbnails (not local DOM hand). */
export const TILE_FACE_VIEW = {
  aspect: MAHJONG_TILE_FACE.width / MAHJONG_TILE_FACE.depth,
  // Fits wholly in the generated glyph's top safe margin, not over a pip.
  aka: { u: 0.07, v: 0.05, radius: 0.04 },
} as const;

export function getTileFaceImageFit(width: number, height: number) {
  const aspect = width > 0 && height > 0 ? width / height : TILE_FACE_VIEW.aspect;
  return { width: Math.min(1, aspect / TILE_FACE_VIEW.aspect), height: Math.min(1, TILE_FACE_VIEW.aspect / aspect) };
}

export const MAHJONG_TILE_ANATOMY = {
  ivoryHeight: 0.45,
  ivoryCenterY: 0.075,
  backHeight: 0.15,
  backCenterY: -0.225,
  seamY: -0.15,
} as const;

export const MAHJONG_TILE_FACE_SURFACE_Y =
  MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.surfaceOffset;

export const sharedTileBodyGeometry = new RoundedBoxGeometry(
  MAHJONG_TILE_DIMENSIONS.width,
  MAHJONG_TILE_DIMENSIONS.height,
  MAHJONG_TILE_DIMENSIONS.depth,
  5,
  MAHJONG_TILE_DIMENSIONS.radius,
);
sharedTileBodyGeometry.name = 'shared-mahjong-tile-body';
sharedTileBodyGeometry.computeBoundingBox();

const tileBodyBounds = sharedTileBodyGeometry.boundingBox;
if (!tileBodyBounds) throw new Error('Mahjong tile geometry must expose bounding bounds.');

export const MAHJONG_TILE_GEOMETRY_SIZE = {
  width: tileBodyBounds.max.x - tileBodyBounds.min.x,
  height: tileBodyBounds.max.y - tileBodyBounds.min.y,
  depth: tileBodyBounds.max.z - tileBodyBounds.min.z,
} as const;

// Gameplay hand interaction uses a stationary, world-aligned volume. It is
// deliberately narrower than the visual tile slot, while its vertical extent
// includes the selected/hover lift so moving the visual never loses the ray.
export const STANDING_HAND_HIT_TARGET = {
  width: MAHJONG_TILE_GEOMETRY_SIZE.width * 0.98,
  height: MAHJONG_TILE_GEOMETRY_SIZE.depth + 0.32,
  depth: MAHJONG_TILE_GEOMETRY_SIZE.height * 0.98,
  liftCoverage: 0.32,
} as const;

export const sharedStandingHandHitGeometry = new BoxGeometry(
  STANDING_HAND_HIT_TARGET.width,
  STANDING_HAND_HIT_TARGET.height,
  STANDING_HAND_HIT_TARGET.depth,
);
sharedStandingHandHitGeometry.name = 'shared-standing-hand-hit-target';

export const sharedTileFaceGeometry = new PlaneGeometry(
  MAHJONG_TILE_FACE.width,
  MAHJONG_TILE_FACE.depth,
);
sharedTileFaceGeometry.name = 'shared-mahjong-tile-face';

export const sharedRedFiveMarkerGeometry = new CircleGeometry(TILE_FACE_VIEW.aka.radius, 20);
sharedRedFiveMarkerGeometry.name = 'shared-red-five-marker';
