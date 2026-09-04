import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type Texture } from 'three';
import { TABLE_CAMERA } from '../camera/FixedTableCamera';
import { TABLE_FELT_DIMENSIONS } from './TableMesh';
import { TABLE_FELT_TOP_Y } from './tableSurfaceSpec';

export type FeltUvRect = Readonly<{
  u: number;
  v: number;
  width: number;
  height: number;
}>;

export type FeltMainViewMapping = Readonly<{
  visibleUvRect: FeltUvRect;
  cropAspectRatio: number;
  textureRepeat: readonly [number, number];
  textureOffset: readonly [number, number];
}>;

const DEFAULT_MAIN_VIEWPORT = { width: 1920, height: 1080 } as const;
const EPSILON = 0.0001;

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

/**
 * Calculates the fixed-camera portion of the felt plane that is on screen.
 * This is a setup-time projection authority; it is never called from a frame
 * loop. The horizontal field covers the whole felt, while the elevated camera
 * trims its far and near depth edges.
 */
export function getFeltMainViewMapping(
  viewportWidth: number = DEFAULT_MAIN_VIEWPORT.width,
  viewportHeight: number = DEFAULT_MAIN_VIEWPORT.height,
): FeltMainViewMapping {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const camera = new PerspectiveCamera(
    TABLE_CAMERA.fov,
    safeWidth / safeHeight,
    TABLE_CAMERA.near,
    TABLE_CAMERA.far,
  );
  camera.position.set(...TABLE_CAMERA.position);
  camera.lookAt(...TABLE_CAMERA.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const feltPlane = new Plane(new Vector3(0, 1, 0), -TABLE_FELT_TOP_Y);
  const raycaster = new Raycaster();
  const intersections = [-1, 1].flatMap((x) => [-1, 1].map((y) => {
    raycaster.setFromCamera(new Vector2(x, y), camera);
    return raycaster.ray.intersectPlane(feltPlane, new Vector3());
  })).filter((point): point is Vector3 => point !== null);

  if (intersections.length !== 4) throw new Error('Fixed table camera must intersect the felt plane.');

  const halfDepth = TABLE_FELT_DIMENSIONS.depth / 2;
  const visibleMinZ = clamp(Math.min(...intersections.map(({ z }) => z)), -halfDepth, halfDepth);
  const visibleMaxZ = clamp(Math.max(...intersections.map(({ z }) => z)), -halfDepth, halfDepth);
  const visibleDepth = Math.max(EPSILON, visibleMaxZ - visibleMinZ);
  const visibleUvRect: FeltUvRect = {
    u: 0,
    // Surface UV v increases toward -Z (image top), not toward the viewer.
    v: (halfDepth - visibleMaxZ) / TABLE_FELT_DIMENSIONS.depth,
    width: 1,
    height: visibleDepth / TABLE_FELT_DIMENSIONS.depth,
  };

  return {
    visibleUvRect,
    cropAspectRatio: TABLE_FELT_DIMENSIONS.width * visibleUvRect.width
      / (TABLE_FELT_DIMENSIONS.depth * visibleUvRect.height),
    textureRepeat: [1 / visibleUvRect.width, 1 / visibleUvRect.height],
    textureOffset: [
      -visibleUvRect.u / visibleUvRect.width,
      -visibleUvRect.v / visibleUvRect.height,
    ],
  };
}

export const DEFAULT_FELT_MAIN_VIEW_MAPPING = getFeltMainViewMapping();

/** Applies the exact same mapping consumed by the crop dialog to a Three texture. */
export function applyFeltMainViewMapping(
  texture: Texture,
  mapping: FeltMainViewMapping = DEFAULT_FELT_MAIN_VIEW_MAPPING,
): Texture {
  texture.repeat.set(...mapping.textureRepeat);
  texture.offset.set(...mapping.textureOffset);
  texture.center.set(0, 0);
  texture.rotation = 0;
  texture.needsUpdate = true;
  return texture;
}
