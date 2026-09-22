import type { GameSfxGroup, GameSfxId, MusicCategory, MusicTrackDefinition, MusicTrackId } from './musicTypes';

// Re-exporting the read-only repository makes its Vite asset URLs part of the
// production graph without registering any voice track or triggering playback.
export { VOICE_PACK_REPOSITORY } from './voice/VoicePackRepository';

export type BuiltinMusicModuleMap = Record<string, string>;

const MUSIC_CATEGORY_PATTERN = /\/(bgm_main|bgm_game|bgm_richi|effects|voice_lines)\//;
const SFX_GROUP_PATTERN = /\/music\/effects\/(draw|discard|meld)\//;

export function musicCategoryFromModulePath(path: string): MusicCategory | null {
  const match = MUSIC_CATEGORY_PATTERN.exec(path);
  return (match?.[1] as MusicCategory | undefined) ?? null;
}

export function gameSfxGroupFromModulePath(path: string): GameSfxGroup | null {
  const match = SFX_GROUP_PATTERN.exec(path);
  return (match?.[1] as GameSfxGroup | undefined) ?? null;
}

export function fileNameFromModulePath(path: string): string {
  const segments = path.split('/');
  const last = segments[segments.length - 1] ?? '';
  return last.replace(/\.(mp3|wav)$/i, '');
}

export function musicDisplayNameFromFileName(fileName: string): string {
  return fileName.replace(/[_-]+/g, ' ').trim() || fileName;
}

export function builtinTrackId(category: MusicCategory, fileName: string): MusicTrackId {
  return `builtin:${category}:${fileName}`;
}

export function createMusicRegistry(modules: BuiltinMusicModuleMap): MusicTrackDefinition[] {
  return Object.entries(modules)
    .map(([path, url]): MusicTrackDefinition | null => {
      const category = musicCategoryFromModulePath(path);
      if (!category) return null;
      const fileName = fileNameFromModulePath(path);
      return {
        id: builtinTrackId(category, fileName),
        name: musicDisplayNameFromFileName(fileName),
        category,
        sourceType: 'builtin',
        url,
        ...(category === 'effects' ? { gameSfxGroup: gameSfxGroupFromModulePath(path) ?? undefined } : {}),
      };
    })
    .filter((track): track is MusicTrackDefinition => track !== null);
}

const builtinModules: BuiltinMusicModuleMap = {
  ...import.meta.glob('../music/{bgm_main,bgm_game,bgm_richi,effects}/**/*.{mp3,wav}', { eager: true, import: 'default' }) as BuiltinMusicModuleMap,
};

export const BUILTIN_MUSIC_TRACKS: readonly MusicTrackDefinition[] = Object.freeze(
  createMusicRegistry(builtinModules).map((track) => Object.freeze(track)),
);

export const DEFAULT_TILE_SFX_TRACK_ID = builtinTrackId('effects', 'default-tile');

export const GAME_SFX_TO_TRACK: Record<GameSfxId, MusicTrackId> = Object.freeze({
  draw: DEFAULT_TILE_SFX_TRACK_ID,
  discard: DEFAULT_TILE_SFX_TRACK_ID,
  chi: DEFAULT_TILE_SFX_TRACK_ID,
  pon: DEFAULT_TILE_SFX_TRACK_ID,
  kan: DEFAULT_TILE_SFX_TRACK_ID,
});

export const GAME_SFX_GROUP_BY_ACTION: Record<GameSfxId, GameSfxGroup> = Object.freeze({
  draw: 'draw',
  discard: 'discard',
  chi: 'meld',
  pon: 'meld',
  kan: 'meld',
});

export const GAME_SFX_IDS: readonly GameSfxId[] = Object.freeze(['draw', 'discard', 'chi', 'pon', 'kan']);
