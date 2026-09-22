export type TileFaceState = 'face-up' | 'face-down';
export type TileOrientation = 'upright' | 'sideways';

export type TileOrientationTransform = Readonly<{
  faceState: TileFaceState;
  rotation: readonly [number, number, number];
}>;

export function resolveTileOrientation(
  faceState: TileFaceState = 'face-up',
  orientation: TileOrientation = 'upright',
): TileOrientationTransform {
  return {
    faceState,
    rotation: [0, orientation === 'sideways' ? Math.PI / 2 : 0, 0],
  };
}
