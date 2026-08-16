import type { AudioBackend, AudioPlaybackHandle } from './audioBackend';
import { createDefaultAudioBackend } from './audioBackend';
import {
  AUDIO_ASSETS,
  type AudioAssetDefinition,
  type AudioAssetRegistry,
  type BgmTrackId,
  type SfxId,
  type VoiceId,
} from './audioRegistry';
import { normalizeAudioSettings, type AudioChannel, type AudioSettings } from './audioSettings';

const MAX_ACTIVE_SFX = 8;
const MAX_ACTIVE_VOICE = 4;

export interface AudioManagerSnapshot {
  readonly settings: AudioSettings;
  readonly currentBgmId: BgmTrackId | null;
  readonly bgmStarted: boolean;
  readonly activeSfxCount: number;
  readonly activeVoiceCount: number;
  readonly disposed: boolean;
}

export class AudioManager {
  private settings: AudioSettings;
  private currentBgmId: BgmTrackId | null = null;
  private bgmHandle: AudioPlaybackHandle | null = null;
  private bgmStarted = false;
  private disposed = false;
  private readonly activeSfx = new Set<AudioPlaybackHandle>();
  private readonly activeVoice = new Set<AudioPlaybackHandle>();

  constructor(
    initialSettings: AudioSettings,
    private readonly backend: AudioBackend = createDefaultAudioBackend(),
    private readonly registry: AudioAssetRegistry = AUDIO_ASSETS,
  ) {
    this.settings = normalizeAudioSettings(initialSettings);
  }

  activate(): void {
    this.disposed = false;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  getSnapshot(): AudioManagerSnapshot {
    return {
      settings: this.getSettings(),
      currentBgmId: this.currentBgmId,
      bgmStarted: this.bgmStarted,
      activeSfxCount: this.activeSfx.size,
      activeVoiceCount: this.activeVoice.size,
      disposed: this.disposed,
    };
  }

  getEffectiveVolume(channel: AudioChannel): number {
    const enabled = channel === 'bgm'
      ? this.settings.bgmEnabled
      : channel === 'sfx'
        ? this.settings.sfxEnabled
        : this.settings.voiceEnabled;
    if (!enabled) return 0;
    const channelVolume = channel === 'bgm'
      ? this.settings.bgmVolume
      : channel === 'sfx'
        ? this.settings.sfxVolume
        : this.settings.voiceVolume;
    return this.settings.masterVolume * channelVolume;
  }

  setSettings(settings: AudioSettings): void {
    const previous = this.settings;
    this.settings = normalizeAudioSettings(settings);
    this.bgmHandle?.setVolume(this.getEffectiveVolume('bgm'));
    this.activeSfx.forEach((handle) => handle.setVolume(this.getEffectiveVolume('sfx')));
    this.activeVoice.forEach((handle) => handle.setVolume(this.getEffectiveVolume('voice')));

    if (previous.bgmEnabled && !this.settings.bgmEnabled) {
      this.bgmHandle?.pause();
      this.bgmStarted = false;
    } else if (!previous.bgmEnabled && this.settings.bgmEnabled) {
      this.startCurrentBgm();
    }
  }

  setMasterVolume(value: number): void {
    this.setSettings({ ...this.settings, masterVolume: value });
  }

  setChannelVolume(channel: AudioChannel, value: number): void {
    const key = `${channel}Volume` as const;
    this.setSettings({ ...this.settings, [key]: value });
  }

  setChannelEnabled(channel: AudioChannel, enabled: boolean): void {
    const key = `${channel}Enabled` as const;
    this.setSettings({ ...this.settings, [key]: enabled });
  }

  setRiichiMusicEnabled(enabled: boolean): void {
    this.setSettings({ ...this.settings, riichiMusicEnabled: enabled });
  }

  playBgm(trackId: BgmTrackId): void {
    if (this.disposed || this.currentBgmId === trackId) return;
    this.disposeCurrentBgm();
    this.currentBgmId = trackId;
    const asset = this.registry.bgm[trackId];
    if (!asset) return;
    this.bgmHandle = this.backend.createPlayback(asset);
    this.bgmHandle.setVolume(this.getEffectiveVolume('bgm'));
    this.startCurrentBgm();
  }

  switchBgm(trackId: BgmTrackId): void {
    this.playBgm(trackId);
  }

  stopBgm(): void {
    this.disposeCurrentBgm();
    this.currentBgmId = null;
  }

  playSfx(soundId: SfxId): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    const asset = this.registry.sfx[soundId];
    if (asset) this.playOneShot(asset, 'sfx');
  }

  playVoice(voiceId: VoiceId): void {
    if (this.disposed || !this.settings.voiceEnabled) return;
    const asset = this.registry.voice[voiceId];
    if (asset) this.playOneShot(asset, 'voice');
  }

  resume(): void {
    if (this.disposed) return;
    this.startCurrentBgm();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeCurrentBgm();
    this.currentBgmId = null;
    [...this.activeSfx, ...this.activeVoice].forEach((handle) => handle.dispose());
    this.activeSfx.clear();
    this.activeVoice.clear();
    this.backend.dispose();
  }

  private startCurrentBgm(): void {
    const handle = this.bgmHandle;
    if (!handle || this.bgmStarted || !this.settings.bgmEnabled || this.disposed) return;
    this.bgmStarted = true;
    void handle.play().catch(() => {
      if (this.bgmHandle === handle) this.bgmStarted = false;
    });
  }

  private disposeCurrentBgm(): void {
    this.bgmHandle?.dispose();
    this.bgmHandle = null;
    this.bgmStarted = false;
  }

  private playOneShot(asset: AudioAssetDefinition, channel: 'sfx' | 'voice'): void {
    const active = channel === 'sfx' ? this.activeSfx : this.activeVoice;
    const limit = channel === 'sfx' ? MAX_ACTIVE_SFX : MAX_ACTIVE_VOICE;
    if (active.size >= limit) {
      const oldest = active.values().next().value as AudioPlaybackHandle | undefined;
      oldest?.dispose();
      if (oldest) active.delete(oldest);
    }

    const handle = this.backend.createPlayback(asset);
    active.add(handle);
    handle.setVolume(this.getEffectiveVolume(channel));
    let removeEnded: () => void = () => undefined;
    const release = () => {
      removeEnded();
      active.delete(handle);
      handle.dispose();
    };
    removeEnded = handle.onEnded(release);
    void handle.play().catch(release);
  }
}
