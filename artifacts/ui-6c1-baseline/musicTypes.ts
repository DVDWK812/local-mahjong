export type MusicCategory =
  | 'bgm_main'
  | 'bgm_game'
  | 'bgm_richi'
  | 'effects'
  | 'voice_lines';

export type MusicTrackId = string;

export type PlaybackMode = 'shuffle' | 'sequential' | 'repeat-one';

export type MusicSourceType = 'builtin' | 'linked' | 'copied';

export type GameSfxId = 'draw' | 'discard' | 'chi' | 'pon' | 'kan';

export type GameSfxGroup = 'draw' | 'discard' | 'meld';

export interface MusicTrackDefinition {
  readonly id: MusicTrackId;
  readonly name: string;
  readonly category: MusicCategory;
  readonly sourceType: MusicSourceType;
  readonly url?: string;
  readonly mimeType?: string;
  readonly order?: number;
  readonly createdAt?: string;
  readonly gameSfxGroup?: GameSfxGroup;
}

export function isGameSfxId(value: string): value is GameSfxId {
  return value === 'draw' || value === 'discard' || value === 'chi' || value === 'pon' || value === 'kan';
}
