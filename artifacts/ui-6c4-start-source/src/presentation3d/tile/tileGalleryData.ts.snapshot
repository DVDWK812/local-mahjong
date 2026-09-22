import type { TileId } from '../../game/types';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import type { TileFaceState, TileOrientation } from './tileOrientation';
import type { TileDefinition } from './tileTextures';

export type GalleryTile = Readonly<{
  tile?: TileDefinition;
  faceState?: TileFaceState;
  orientation?: TileOrientation;
}>;

const tile = (id: TileId, red = false): GalleryTile => ({ tile: { id, red } });

export const GALLERY_ROWS: readonly (readonly GalleryTile[])[] = [
  Array.from({ length: 9 }, (_, index) => tile(index as TileId)),
  Array.from({ length: 9 }, (_, index) => tile((index + 9) as TileId)),
  Array.from({ length: 9 }, (_, index) => tile((index + 18) as TileId)),
  Array.from({ length: 7 }, (_, index) => tile((index + 27) as TileId)),
  [
    tile(4, true),
    tile(13, true),
    tile(22, true),
    { faceState: 'face-down' },
    { faceState: 'face-down', orientation: 'sideways' },
    { tile: { id: 27, red: false }, orientation: 'sideways' },
  ],
];

export const GALLERY_ROW_Z = [-3.05, -1.53, 0, 1.53, 3.08] as const;
export const GALLERY_TILE_SPACING = 1.16;
export const GALLERY_TILE_CENTER_Y = 0.86;
export const SEAT_SAMPLE_TILE_CENTER_Y = 0.83;

export const SEAT_SAMPLES: Record<Table3DSeat, readonly TileDefinition[]> = {
  bottom: [{ id: 0, red: false }, { id: 13, red: true }, { id: 33, red: false }],
  right: [{ id: 9, red: false }, { id: 22, red: true }, { id: 31, red: false }],
  top: [{ id: 18, red: false }, { id: 4, red: true }, { id: 30, red: false }],
  left: [{ id: 8, red: false }, { id: 17, red: false }, { id: 29, red: false }],
};
