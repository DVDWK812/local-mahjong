import { createContext, useContext } from 'react';
import type { ColorRepresentation, Texture } from 'three';
import type { RiichiStick3DAppearance } from '../riichi/riichiStickAppearance';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE } from '../riichi/riichiStickAppearance';
import type { PlayerSlotAppearance } from '../../presentation/appearance/playerSlotAppearance';
import type { TileAppearanceId } from '../../presentation/appearance/appearanceSettings';

export type FaceResources3D = Partial<Record<TileAppearanceId, { texture?: Texture; sideColor: string }>>;
export const TileFaceResources3DContext = createContext<FaceResources3D>({});
export function useTileFaceResources3D(key: string) {
  return useContext(TileFaceResources3DContext)[key as TileAppearanceId];
}

export type TileAppearance3DResources = Readonly<{
  backTexture?: Texture;
  backColor?: ColorRepresentation;
}>;

export type PlayerAppearance3DResources = TileAppearance3DResources & { riichiStickAppearance?: RiichiStick3DAppearance };
export type TableAppearance3DResources = TileAppearance3DResources & { players?: Readonly<Record<number, PlayerAppearance3DResources>> };
export const TileAppearance3DContext = createContext<TableAppearance3DResources>({});

/** Explicit builtin wins; a missing/failed custom decode inherits the global resource. */
export function resolveLoadedPlayerAppearance3D(player: PlayerSlotAppearance, global: PlayerAppearance3DResources, back?: Texture, stick?: Texture): PlayerAppearance3DResources {
  return {
    backTexture: player.tileBack.texture !== 'inherit' && player.tileBack.texture.kind === 'builtin' ? undefined : back ?? global.backTexture,
    backColor: player.tileBack.sideColor === 'inherit' ? global.backColor : player.tileBack.sideColor,
    riichiStickAppearance: player.riichiStick !== 'inherit' && player.riichiStick.kind === 'builtin'
      ? DEFAULT_RIICHI_STICK_3D_APPEARANCE
      : stick ? { ...DEFAULT_RIICHI_STICK_3D_APPEARANCE, texture: stick } : global.riichiStickAppearance,
  };
}

export function resolveOwnedAppearance3D(resources: TableAppearance3DResources, playerId?: number): PlayerAppearance3DResources {
  return playerId === undefined ? resources : resources.players?.[playerId] ?? resources;
}
export function useTileAppearance3D(playerId?: number): PlayerAppearance3DResources {
  return resolveOwnedAppearance3D(useContext(TileAppearance3DContext), playerId);
}
