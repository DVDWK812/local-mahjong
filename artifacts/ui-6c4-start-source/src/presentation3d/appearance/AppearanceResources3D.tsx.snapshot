import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { TILE_APPEARANCE_IDS, type AppearanceAssetRef, type AppearanceSettings, type TileAppearanceId } from '../../presentation/appearance/appearanceSettings';
import { usePlayerSlotAppearances, type PlayerSlotAppearance, type PlayerSlotAppearances } from '../../presentation/appearance/playerSlotAppearance';
import { AppearanceTextureCache, type AppearanceTextureKind } from './AppearanceTextureCache';
import type { PlayerAppearance3DResources } from './TileAppearance3DContext';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE, type RiichiStick3DAppearance } from '../riichi/riichiStickAppearance';
import { TileAppearance3DContext, resolveLoadedPlayerAppearance3D } from './TileAppearance3DContext';
import { TileFaceResources3DContext, type FaceResources3D } from './TileAppearance3DContext';
import { RIICHI_STICK_3D_LAYOUT, applyRiichiStickTextureCover } from '../riichi/riichiStickGeometry';
import {
  applyFeltMainViewMapping,
  DEFAULT_FELT_MAIN_VIEW_MAPPING,
} from '../table/feltMainViewMapping';

export const DEFAULT_FELT_TEXTURE_SOURCE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Crect width="1" height="1" fill="white"/%3E%3C/svg%3E';

export function getTileBackCropAspectRatio(): number {
  return 1.08 / 1.46;
}

export function getFeltCropAspectRatio(): number {
  return DEFAULT_FELT_MAIN_VIEW_MAPPING.cropAspectRatio;
}

export function getRiichiStickCropAspectRatio(): number {
  return RIICHI_STICK_3D_LAYOUT.length / RIICHI_STICK_3D_LAYOUT.width;
}

export function configureLocalAppearanceTexture(texture: Texture, kind: AppearanceTextureKind): Texture {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.center.set(0, 0);
  texture.rotation = 0;
  // The back surface faces the opposite table direction from source artwork.
  // Flip only user-supplied back artwork; other surfaces retain existing UVs.
  texture.flipY = kind !== 'tile-back';
  if (kind === 'felt') applyFeltMainViewMapping(texture);
  if (kind === 'riichi-stick') applyRiichiStickTextureCover(texture);
  texture.needsUpdate = true;
  return texture;
}

const sharedPlayerTextureCache = new AppearanceTextureCache(configureLocalAppearanceTexture);

/** Resolve the table's 37 selections once, never from individual tile meshes. */
function useFaceResources(settings: AppearanceSettings, faceIds: readonly TileAppearanceId[]): Readonly<{
  resources: FaceResources3D;
  ready: boolean;
}> {
  const invalidate = useThree(state => state.invalidate);
  const signature = JSON.stringify(faceIds.map(key => [key, settings.tileFaces[key].face]));
  const [loaded, setLoaded] = useState<{ signature: string; textures: (Texture | undefined)[] }>({ signature: '', textures: [] });
  useEffect(() => {
    let active = true;
    const refs = (JSON.parse(signature) as [TileAppearanceId, AppearanceAssetRef][]).map(([, ref]) => ref);
    const leases = refs.map(ref => sharedPlayerTextureCache.acquire(ref, 'tile-face'));
    void Promise.all(leases.map(lease => lease.promise)).then(textures => {
      if (active) { setLoaded({ signature, textures }); invalidate(); }
    });
    return () => { active = false; leases.forEach(lease => lease.release()); };
  }, [signature, invalidate]);
  const resources = useMemo(() => Object.fromEntries(faceIds.map((key, index) => [key, {
    texture: loaded.signature === signature ? loaded.textures[index] : undefined,
    sideColor: settings.tileFaces[key].sideColor,
  }])), [loaded, signature, settings.tileFaces]);
  return { resources, ready: loaded.signature === signature };
}
function useSharedAppearanceTexture(ref: AppearanceAssetRef, kind: AppearanceTextureKind, enabled = true): Readonly<{
  texture?: Texture;
  ready: boolean;
}> {
  const invalidate = useThree(state => state.invalidate);
  const key = ref.kind === 'local' ? ref.assetId : '';
  const [loaded, setLoaded] = useState<{ key: string; texture?: Texture }>({ key: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const lease = sharedPlayerTextureCache.acquire(key ? { kind: 'local', assetId: key } : { kind: 'builtin', id: 'default' }, kind);
    void lease.promise.then(texture => { if (active) { setLoaded({ key, texture }); invalidate(); } });
    return () => { active = false; lease.release(); };
  }, [key, kind, invalidate, enabled]);
  return {
    texture: enabled && loaded.key === key ? loaded.texture : undefined,
    ready: !enabled || loaded.key === key,
  };
}

function usePlayerResources(player: PlayerSlotAppearance, global: PlayerAppearance3DResources, enabled = true, includeRiichi = true): Readonly<{
  resources: PlayerAppearance3DResources;
  backReady: boolean;
  stickReady: boolean;
}> {
  const back = useSharedAppearanceTexture(player.tileBack.texture === 'inherit' ? { kind: 'builtin', id: 'default' } : player.tileBack.texture, 'tile-back', enabled);
  const stick = useSharedAppearanceTexture(player.riichiStick === 'inherit' ? { kind: 'builtin', id: 'default' } : player.riichiStick, 'riichi-stick', enabled && includeRiichi);
  const resources = useMemo(() => resolveLoadedPlayerAppearance3D(player, global, back.texture, stick.texture),
    [player, global.backTexture, global.backColor, global.riichiStickAppearance, back.texture, stick.texture]);
  return { resources, backReady: back.ready, stickReady: stick.ready };
}

export function AppearanceResources3D({
  settings,
  children,
  criticalPlayerIds = [],
  criticalRiichiPlayerIds = [],
  activePlayerIds = [0, 1, 2, 3],
  includeRiichiResources = true,
  faceIds = TILE_APPEARANCE_IDS,
  playerAppearances,
}: Readonly<{
  settings: AppearanceSettings;
  children: (resources: Readonly<{
    feltTexture?: Texture;
    riichiStickAppearance: RiichiStick3DAppearance;
    criticalAssetsReady: boolean;
  }>) => ReactNode;
  criticalPlayerIds?: readonly number[];
  criticalRiichiPlayerIds?: readonly number[];
  activePlayerIds?: readonly number[];
  includeRiichiResources?: boolean;
  faceIds?: readonly TileAppearanceId[];
  playerAppearances?: PlayerSlotAppearances;
}>) {
  const faces = useFaceResources(settings, faceIds);
  const backTexture = useSharedAppearanceTexture(settings.tileBack.texture, 'tile-back');
  const feltTexture = useSharedAppearanceTexture(settings.tableFelt.asset, 'felt');
  const stickTexture = useSharedAppearanceTexture(settings.riichiStick.asset, 'riichi-stick', includeRiichiResources);

  const tileResources = useMemo(() => ({
    backTexture: backTexture.texture,
    backColor: settings.tileBack.sideColor,
  }), [backTexture.texture, settings.tileBack.sideColor]);
  const riichiStickAppearance = useMemo<RiichiStick3DAppearance>(() => ({
    ...DEFAULT_RIICHI_STICK_3D_APPEARANCE,
    textureSource: DEFAULT_RIICHI_STICK_3D_APPEARANCE.textureSource,
    texture: stickTexture.texture,
  }), [stickTexture.texture]);
  const savedSelections = usePlayerSlotAppearances();
  const selections = playerAppearances ?? savedSelections;
  const globalResources = { ...tileResources, riichiStickAppearance };
  const player0 = usePlayerResources(selections[0], globalResources, activePlayerIds.includes(0), includeRiichiResources);
  const player1 = usePlayerResources(selections[1], globalResources, activePlayerIds.includes(1), includeRiichiResources);
  const player2 = usePlayerResources(selections[2], globalResources, activePlayerIds.includes(2), includeRiichiResources);
  const player3 = usePlayerResources(selections[3], globalResources, activePlayerIds.includes(3), includeRiichiResources);
  const players = { 0: player0, 1: player1, 2: player2, 3: player3 } as const;
  const resources = useMemo(() => ({ ...tileResources, players: {
    0: player0.resources,
    1: player1.resources,
    2: player2.resources,
    3: player3.resources,
  } }), [tileResources, player0.resources, player1.resources, player2.resources, player3.resources]);
  const playerBacksReady = criticalPlayerIds.every((id) =>
    id === 0 || id === 1 || id === 2 || id === 3 ? players[id].backReady : true);
  const riichiTexturesReady = criticalRiichiPlayerIds.length === 0 || (
    stickTexture.ready
    && criticalRiichiPlayerIds.every((id) =>
      id === 0 || id === 1 || id === 2 || id === 3 ? players[id].stickReady : true)
  );
  const criticalAssetsReady = faces.ready
    && backTexture.ready
    && feltTexture.ready
    && playerBacksReady
    && riichiTexturesReady;

  return (
    <TileAppearance3DContext.Provider value={resources}>
      <TileFaceResources3DContext.Provider value={faces.resources}>
      {children({ feltTexture: feltTexture.texture, riichiStickAppearance, criticalAssetsReady })}
      </TileFaceResources3DContext.Provider>
    </TileAppearance3DContext.Provider>
  );
}
