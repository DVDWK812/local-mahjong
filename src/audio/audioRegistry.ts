import type { AudioChannel } from './audioSettings';
import defaultTileSfxUrl from '../music/effects/default-tile.wav';

export type BgmTrackId = 'home' | 'game' | 'riichi';
export type SfxId = 'discard' | 'riichi' | 'draw' | 'chi' | 'pon' | 'kan' | 'win';
export type VoiceId = 'round-start' | 'win';

export interface AudioAssetDefinition {
  readonly id: string;
  readonly channel: AudioChannel;
  readonly src: string;
  readonly loop: boolean;
  readonly source: 'self-generated' | 'project-local';
}

export interface AudioAssetRegistry {
  readonly bgm: Partial<Record<BgmTrackId, AudioAssetDefinition>>;
  readonly sfx: Partial<Record<SfxId, AudioAssetDefinition>>;
  readonly voice: Partial<Record<VoiceId, AudioAssetDefinition>>;
}

export const AUDIO_ASSETS: AudioAssetRegistry = Object.freeze({
  bgm: Object.freeze({}),
  sfx: Object.freeze({
    discard: Object.freeze({
      id: 'discard',
      channel: 'sfx',
      src: defaultTileSfxUrl,
      loop: false,
      source: 'self-generated',
    }),
  }),
  voice: Object.freeze({}),
});

export const EMBEDDED_AUDIO_ASSET_BYTES = 1004;
