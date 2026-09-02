import type { MeldDisplayModel } from '../../game/meldDisplayAdapter';
import type { PlayerId } from '../../game/types';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import type { TileFaceState, TileOrientation } from '../tile/tileOrientation';
import type { TileDefinition } from '../tile/tileTextures';

export type TableSceneTile = Readonly<{
  key: string;
  tile?: TileDefinition;
  faceState: TileFaceState;
  orientation: TileOrientation;
}>;

export type HandSceneTile = TableSceneTile & Readonly<{
  drawn: boolean;
}>;

export type RiverSceneTile = TableSceneTile & Readonly<{
  riverIndex: number;
  layoutIndex: number;
  claimed: boolean;
  visible: boolean;
}>;

export type MeldSceneTile = TableSceneTile & Readonly<{
  called: boolean;
  stacked: boolean;
}>;

export type MeldSceneState = Readonly<{
  key: string;
  callType: MeldDisplayModel['callType'];
  tiles: readonly MeldSceneTile[];
}>;

export type SeatSceneState = Readonly<{
  seat: Table3DSeat;
  playerId: PlayerId;
  riichi: boolean;
  hand: readonly HandSceneTile[];
  river: readonly RiverSceneTile[];
  melds: readonly MeldSceneState[];
}>;

export type WallSceneTile = TableSceneTile & Readonly<{
  slotIndex: number;
  visible: boolean;
  role?: 'rinshan' | 'dora-indicator' | 'ura-dora-indicator';
}>;

export type TableSceneState = Readonly<{
  seats: Readonly<Record<Table3DSeat, SeatSceneState>>;
  wall: readonly WallSceneTile[];
  deadWall: readonly WallSceneTile[];
  doraIndicators: readonly TableSceneTile[];
}>;

export type TableSceneSeatMapping = Readonly<{
  bottomPlayerId: PlayerId;
  rightPlayerId: PlayerId;
  topPlayerId: PlayerId;
  leftPlayerId: PlayerId;
}>;
