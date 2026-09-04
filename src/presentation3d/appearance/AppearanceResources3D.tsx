import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import { TILE_APPEARANCE_IDS, type AppearanceAssetRef, type AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import { usePlayerSlotAppearances, type PlayerSlotAppearance } from '../../presentation/appearance/playerSlotAppearance';
import { AppearanceTextureCache, type AppearanceTextureKind } from './AppearanceTextureCache';
import type { PlayerAppearance3DResources } from './TileAppearance3DContext';
import { useAppearanceAssetSource } from '../../presentation/appearance/appearanceAssetResolver';
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

export function configureLocalAppearanceTexture(texture: Texture, kind: AppearanceTextureKind | 'felt'): Texture {
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
function useFaceResources(settings: AppearanceSettings): FaceResources3D {
  const invalidate = useThree(state => state.invalidate);
  const signature = JSON.stringify(TILE_APPEARANCE_IDS.map(key => settings.tileFaces[key].face));
  const [loaded, setLoaded] = useState<{ signature: string; textures: (Texture | undefined)[] }>({ signature: '', textures: [] });
  useEffect(() => {
    let active = true;
    const refs = JSON.parse(signature) as AppearanceAssetRef[];
    const leases = refs.map(ref => sharedPlayerTextureCache.acquire(ref, 'tile-face'));
    void Promise.all(leases.map(lease => lease.promise)).then(textures => {
      if (active) { setLoaded({ signature, textures }); invalidate(); }
    });
    return () => { active = false; leases.forEach(lease => lease.release()); };
  }, [signature, invalidate]);
  return useMemo(() => Object.fromEntries(TILE_APPEARANCE_IDS.map((key, index) => [key, {
    texture: loaded.signature === signature ? loaded.textures[index] : undefined,
    sideColor: settings.tileFaces[key].sideColor,
  }])), [loaded, signature, settings.tileFaces]);
}
function useSharedAppearanceTexture(ref: AppearanceAssetRef, kind: AppearanceTextureKind): Texture | undefined {
  const invalidate = useThree(state => state.invalidate);
  const key = ref.kind === 'local' ? ref.assetId : '';
  const [loaded, setLoaded] = useState<{ key: string; texture?: Texture }>({ key: '' });
  useEffect(() => {
    let active = true;
    const lease = sharedPlayerTextureCache.acquire(key ? { kind: 'local', assetId: key } : { kind: 'builtin', id: 'default' }, kind);
    void lease.promise.then(texture => { if (active) { setLoaded({ key, texture }); invalidate(); } });
    return () => { active = false; lease.release(); };
  }, [key, kind, invalidate]);
  return loaded.key === key ? loaded.texture : undefined;
}

function usePlayerResources(player: PlayerSlotAppearance, global: PlayerAppearance3DResources): PlayerAppearance3DResources {
  const back = useSharedAppearanceTexture(player.tileBack.texture === 'inherit' ? { kind: 'builtin', id: 'default' } : player.tileBack.texture, 'tile-back');
  const stick = useSharedAppearanceTexture(player.riichiStick === 'inherit' ? { kind: 'builtin', id: 'default' } : player.riichiStick, 'riichi-stick');
  return useMemo(() => resolveLoadedPlayerAppearance3D(player, global, back, stick),
    [player, global.backTexture, global.backColor, global.riichiStickAppearance, back, stick]);
}

/**
 * Loads one local texture per appearance slot without a Suspense boundary.
 * A replacement keeps the previously committed texture visible while its Blob
 * decodes, so a new image cannot blank the entire table.
 */
function useLocalAppearanceTexture(source: string, kind: 'tile-back' | 'felt' | 'riichi-stick'): Texture | undefined {
  const invalidate = useThree((state) => state.invalidate);
  const textureRef = useRef<Texture | undefined>(undefined);
  const [texture, setTexture] = useState<Texture | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!source.startsWith('blob:')) {
      const previous = textureRef.current;
      textureRef.current = undefined;
      setTexture(undefined);
      previous?.dispose();
      invalidate();
      return () => { active = false; };
    }

    const loader = new TextureLoader();
    loader.load(
      source,
      (loaded) => {
        configureLocalAppearanceTexture(loaded, kind);
        if (!active) {
          loaded.dispose();
          return;
        }
        const previous = textureRef.current;
        textureRef.current = loaded;
        setTexture(loaded);
        previous?.dispose();
        invalidate();
      },
      undefined,
      () => {
        // A corrupt/revoked Blob falls back safely instead of throwing through
        // the Canvas. Retain a previous valid texture when one exists.
        if (active && !textureRef.current) {
          setTexture(undefined);
          invalidate();
        }
      },
    );
    return () => { active = false; };
  }, [invalidate, kind, source]);

  useEffect(() => () => {
    textureRef.current?.dispose();
    textureRef.current = undefined;
  }, []);

  return texture;
}

export function AppearanceResources3D({
  settings,
  children,
}: Readonly<{
  settings: AppearanceSettings;
  children: (resources: Readonly<{
    feltTexture?: Texture;
    riichiStickAppearance: RiichiStick3DAppearance;
  }>) => ReactNode;
}>) {
  const feltSource = useAppearanceAssetSource(settings.tableFelt.asset, DEFAULT_FELT_TEXTURE_SOURCE);
  const faces = useFaceResources(settings);
  const backTexture = useSharedAppearanceTexture(settings.tileBack.texture, 'tile-back');
  const feltTexture = useLocalAppearanceTexture(feltSource, 'felt');
  const stickTexture = useSharedAppearanceTexture(settings.riichiStick.asset, 'riichi-stick');

  const tileResources = useMemo(() => ({
    backTexture,
    backColor: settings.tileBack.sideColor,
  }), [backTexture, settings.tileBack.sideColor]);
  const riichiStickAppearance = useMemo<RiichiStick3DAppearance>(() => ({
    ...DEFAULT_RIICHI_STICK_3D_APPEARANCE,
    textureSource: DEFAULT_RIICHI_STICK_3D_APPEARANCE.textureSource,
    texture: stickTexture,
  }), [stickTexture]);
  const selections = usePlayerSlotAppearances();
  const globalResources = { ...tileResources, riichiStickAppearance };
  const player0 = usePlayerResources(selections[0], globalResources);
  const player1 = usePlayerResources(selections[1], globalResources);
  const player2 = usePlayerResources(selections[2], globalResources);
  const player3 = usePlayerResources(selections[3], globalResources);
  const resources = useMemo(() => ({ ...tileResources, players: { 0: player0, 1: player1, 2: player2, 3: player3 } }),
    [tileResources, player0, player1, player2, player3]);

  return (
    <TileAppearance3DContext.Provider value={resources}>
      <TileFaceResources3DContext.Provider value={faces}>
      {children({ feltTexture, riichiStickAppearance })}
      </TileFaceResources3DContext.Provider>
    </TileAppearance3DContext.Provider>
  );
}
