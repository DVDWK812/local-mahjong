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
import type { MusicLibraryView } from './musicLibrary';
import { DEFAULT_TILE_SFX_TRACK_ID, GAME_SFX_GROUP_BY_ACTION } from './musicRegistry';
import type { GameSfxGroup, GameSfxId, MusicCategory, MusicTrackDefinition, MusicTrackId, PlaybackMode } from './musicTypes';
import { isGameSfxId } from './musicTypes';

const MAX_ACTIVE_SFX = 8;
const MAX_ACTIVE_VOICE = 4;

export type TemporaryPlaybackReturnPolicy = 'resume-suspended-track' | 'restart-runtime-playlist';
export type PlaybackSource = 'runtime' | 'temporary' | null;

export interface AudioManagerSnapshot {
  readonly settings: AudioSettings;
  readonly currentBgmId: BgmTrackId | null;
  readonly currentBgmTrackId: MusicTrackId | null;
  readonly bgmStarted: boolean;
  readonly activeSfxCount: number;
  readonly activeVoiceCount: number;
  readonly temporaryTrackId: MusicTrackId | null;
  readonly disposed: boolean;
}

export interface NowPlayingInfo {
  readonly source: PlaybackSource;
  readonly trackId: MusicTrackId | null;
  readonly trackName: string | null;
}

export interface PlaybackSnapshot {
  readonly source: PlaybackSource;
  readonly trackId: MusicTrackId | null;
  readonly trackName: string | null;
  readonly category: MusicCategory | null;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly playbackMode: PlaybackMode | undefined;
}

interface SuspendedRuntime {
  readonly sceneTrackId: BgmTrackId;
  readonly category: MusicCategory;
  readonly handle: AudioPlaybackHandle | null;
  readonly release: (() => void) | null;
  readonly trackId: MusicTrackId | null;
}

function bgmCategoryFor(trackId: BgmTrackId): MusicCategory {
  return trackId === 'home' ? 'bgm_main' : trackId === 'game' ? 'bgm_game' : 'bgm_richi';
}

function volumeKeyForCategory(category: MusicCategory): keyof AudioSettings {
  switch (category) {
    case 'bgm_main': return 'bgmVolume';
    case 'bgm_game': return 'bgmGameVolume';
    case 'bgm_richi': return 'bgmRiichiVolume';
    case 'effects': return 'sfxVolume';
    case 'voice_lines': return 'voiceVolume';
  }
}

function enabledKeyForCategory(category: MusicCategory): keyof AudioSettings {
  switch (category) {
    case 'bgm_main': return 'bgmEnabled';
    case 'bgm_game': return 'bgmGameEnabled';
    case 'bgm_richi': return 'riichiMusicEnabled';
    case 'effects': return 'sfxEnabled';
    case 'voice_lines': return 'voiceEnabled';
  }
}

function categoryVolumeFrom(settings: AudioSettings, category: MusicCategory): number {
  return settings[volumeKeyForCategory(category)] as number;
}

function categoryEnabledFrom(settings: AudioSettings, category: MusicCategory): boolean {
  return settings[enabledKeyForCategory(category)] as boolean;
}

export class AudioManager {
  private settings: AudioSettings;
  private currentBgmId: BgmTrackId | null = null;
  private currentBgmTrackId: MusicTrackId | null = null;
  private bgmHandle: AudioPlaybackHandle | null = null;
  private bgmRelease: (() => void) | null = null;
  private bgmStarted = false;
  private disposed = false;
  private music: MusicLibraryView | null = null;
  private temporaryHandle: AudioPlaybackHandle | null = null;
  private temporaryRelease: (() => void) | null = null;
  private temporaryTrackId: MusicTrackId | null = null;
  private temporaryCategory: MusicCategory | null = null;
  private temporaryReturnPolicy: TemporaryPlaybackReturnPolicy = 'resume-suspended-track';
  private suspendedRuntime: SuspendedRuntime | null = null;
  private readonly activeSfx = new Set<AudioPlaybackHandle>();
  private readonly activeVoice = new Set<AudioPlaybackHandle>();
  private readonly releaseCallbacks = new Map<AudioPlaybackHandle, () => void>();
  private readonly playbackListeners = new Set<() => void>();
  private readonly sfxCursors: Record<GameSfxGroup, number> = { draw: 0, discard: 0, meld: 0 };
  private readonly sfxLastPlayed: Record<GameSfxGroup, MusicTrackId | null> = { draw: null, discard: null, meld: null };

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
      currentBgmTrackId: this.currentBgmTrackId,
      bgmStarted: this.bgmStarted,
      activeSfxCount: this.activeSfx.size,
      activeVoiceCount: this.activeVoice.size,
      temporaryTrackId: this.temporaryTrackId,
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

  getEffectiveCategoryVolume(category: MusicCategory): number {
    return categoryEnabledFrom(this.settings, category)
      ? this.settings.masterVolume * categoryVolumeFrom(this.settings, category)
      : 0;
  }

  getPlaybackSnapshot(): PlaybackSnapshot {
    const source: PlaybackSource = this.temporaryTrackId
      ? 'temporary'
      : this.currentBgmId
        ? 'runtime'
        : null;
    const category = this.temporaryCategory
      ?? (this.currentBgmId ? bgmCategoryFor(this.currentBgmId) : null);
    const trackId = this.temporaryTrackId ?? this.currentBgmTrackId;
    const handle = this.temporaryHandle ?? this.bgmHandle;
    return {
      source,
      trackId,
      trackName: trackId ? (this.music?.trackNameById(trackId) ?? null) : null,
      category,
      isPlaying: handle?.isPlaying?.() ?? false,
      currentTime: handle?.getCurrentTime?.() ?? 0,
      duration: handle?.getDuration?.() ?? 0,
      playbackMode: category && this.music ? this.music.playbackMode(category) : undefined,
    };
  }

  getNowPlaying(): NowPlayingInfo {
    const snapshot = this.getPlaybackSnapshot();
    return { source: snapshot.source, trackId: snapshot.trackId, trackName: snapshot.trackName };
  }

  subscribePlayback(listener: () => void): () => void {
    this.playbackListeners.add(listener);
    return () => this.playbackListeners.delete(listener);
  }

  setSettings(settings: AudioSettings): void {
    const previous = this.settings;
    this.settings = normalizeAudioSettings(settings);
    if (this.bgmHandle && this.currentBgmId) {
      this.bgmHandle.setVolume(this.getEffectiveCategoryVolume(bgmCategoryFor(this.currentBgmId)));
    }
    this.temporaryHandle?.setVolume(this.getPreviewVolume(this.temporaryCategory ?? 'bgm_main'));
    this.activeSfx.forEach((handle) => handle.setVolume(this.getEffectiveVolume('sfx')));
    this.activeVoice.forEach((handle) => handle.setVolume(this.getEffectiveVolume('voice')));

    const currentCategory = this.currentBgmId ? bgmCategoryFor(this.currentBgmId) : null;
    if (currentCategory) {
      const wasEnabled = categoryEnabledFrom(previous, currentCategory);
      const isEnabled = categoryEnabledFrom(this.settings, currentCategory);
      if (wasEnabled && !isEnabled) {
        this.bgmHandle?.pause();
        this.bgmStarted = false;
      } else if (!wasEnabled && isEnabled) {
        this.startCurrentBgm();
      }
    }
    this.notifyPlayback();
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

  setCategoryVolume(category: MusicCategory, value: number): void {
    this.setSettings({ ...this.settings, [volumeKeyForCategory(category)]: value });
  }

  setCategoryEnabled(category: MusicCategory, enabled: boolean): void {
    this.setSettings({ ...this.settings, [enabledKeyForCategory(category)]: enabled });
  }

  setRiichiMusicEnabled(enabled: boolean): void {
    this.setSettings({ ...this.settings, riichiMusicEnabled: enabled });
  }

  setMusicLibrary(library: MusicLibraryView | null): void {
    this.music = library;
    this.refreshCurrentBgm();
    this.notifyPlayback();
  }

  setTemporaryReturnPolicy(policy: TemporaryPlaybackReturnPolicy): void {
    this.temporaryReturnPolicy = policy;
  }

  playBgm(trackId: BgmTrackId, advanceAfterEnded = false): void {
    if (this.disposed || (this.currentBgmId === trackId && this.bgmStarted)) return;
    if (this.temporaryTrackId) {
      if (this.suspendedRuntime?.sceneTrackId === trackId) return;
      this.stopTemporaryForSceneChange();
    }
    this.disposeCurrentBgm();
    this.currentBgmId = trackId;
    this.currentBgmTrackId = null;
    const category = bgmCategoryFor(trackId);
    if (this.music) {
      if (!categoryEnabledFrom(this.settings, category)) {
        this.currentBgmId = null;
        return;
      }
      void this.resolveAndStartBgm(trackId, category, advanceAfterEnded);
      return;
    }
    const asset = this.registry.bgm[trackId];
    if (!asset) return;
    this.bgmHandle = this.backend.createPlayback(asset);
    this.bgmHandle.setVolume(this.getEffectiveCategoryVolume(category));
    this.notifyPlayback();
    this.startCurrentBgm();
  }

  switchBgm(trackId: BgmTrackId): void {
    this.playBgm(trackId);
  }

  playMainBgm(): void {
    this.playBgm('home');
  }

  playGameBgm(): void {
    this.playBgm('game');
  }

  playRiichiBgm(): void {
    this.playBgm('riichi');
  }

  stopBgm(): void {
    if (this.temporaryTrackId) {
      this.stopTemporaryForSceneChange();
    }
    this.disposeCurrentBgm();
    this.currentBgmId = null;
    this.currentBgmTrackId = null;
    this.notifyPlayback();
  }

  playSfx(soundId: SfxId): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    if (this.music && isGameSfxId(soundId)) {
      void this.playGameSfxInternal(soundId);
      return;
    }
    const asset = this.registry.sfx[soundId];
    if (asset) this.playOneShot(asset, 'sfx');
  }

  playGameSfx(gameSfxId: GameSfxId): void {
    if (this.disposed || !this.settings.sfxEnabled) return;
    void this.playGameSfxInternal(gameSfxId);
  }

  playVoice(voiceId: VoiceId): void {
    if (this.disposed || !this.settings.voiceEnabled) return;
    const asset = this.registry.voice[voiceId];
    if (asset) this.playOneShot(asset, 'voice');
  }

  playTemporary(track: MusicTrackDefinition): void {
    if (this.disposed || !this.music) return;
    if (this.temporaryTrackId) {
      this.disposeTemporaryHandle();
    } else {
      this.suspendRuntimeForTemporary();
    }
    this.music.setLastSelectedTrackId(track.category, track.id);
    if (track.category === 'effects' && track.gameSfxGroup) {
      this.music.setSfxLastSelectedTrackId(track.gameSfxGroup, track.id);
    }
    this.temporaryTrackId = track.id;
    this.temporaryCategory = track.category;
    this.notifyPlayback();
    void this.music.resolveTrack(track).then((resolved) => {
      if (!resolved || this.disposed || this.temporaryTrackId !== track.id) {
        if (!resolved && !this.disposed && this.temporaryTrackId === track.id) {
          this.stopTemporary();
        }
        resolved?.release();
        return;
      }
      const handle = this.backend.createPlayback({
        id: track.id,
        channel: track.category === 'effects' ? 'sfx' : 'bgm',
        src: resolved.url,
        loop: false,
        source: track.sourceType === 'builtin' ? 'project-local' : 'self-generated',
      });
      this.temporaryHandle = handle;
      this.temporaryRelease = resolved.release;
      handle.setVolume(this.getPreviewVolume(track.category));
      this.attachPlaybackEvents(handle);
      handle.onEnded(() => this.handleTemporaryEnded());
      void handle.play().catch(() => {
        if (this.temporaryHandle === handle) this.stopTemporary();
      });
    });
  }

  stopTemporary(): void {
    if (!this.temporaryTrackId && !this.temporaryHandle) return;
    this.disposeTemporaryHandle();
    this.temporaryTrackId = null;
    this.temporaryCategory = null;
    this.resumeSuspendedRuntime();
    this.notifyPlayback();
  }

  pauseCurrentPlayback(): void {
    const handle = this.temporaryHandle ?? this.bgmHandle;
    if (!handle) return;
    if (this.temporaryHandle) {
      this.temporaryHandle.pause();
    } else {
      this.bgmHandle?.pause();
      this.bgmStarted = false;
    }
    this.notifyPlayback();
  }

  resumeCurrentPlayback(): void {
    if (this.temporaryHandle) {
      void this.temporaryHandle.play().catch(() => undefined);
    } else if (this.bgmHandle && this.currentBgmId) {
      this.startCurrentBgm();
    }
    this.notifyPlayback();
  }

  seekCurrentPlayback(time: number): void {
    const handle = this.temporaryHandle ?? this.bgmHandle;
    if (!handle || !Number.isFinite(time) || time < 0) return;
    const duration = handle.getDuration?.() ?? Number.NaN;
    if (!Number.isFinite(duration) || duration <= 0) return;
    handle.seek?.(time);
    this.notifyPlayback();
  }

  previousTrack(): void {
    if (this.temporaryTrackId && this.temporaryCategory) {
      this.switchTemporaryAdjacent(-1);
    } else if (this.currentBgmId) {
      this.switchRuntimeAdjacent(-1);
    }
  }

  nextTrack(): void {
    if (this.temporaryTrackId && this.temporaryCategory) {
      this.switchTemporaryAdjacent(1);
    } else if (this.currentBgmId) {
      this.switchRuntimeAdjacent(1);
    }
  }

  resume(): void {
    if (this.disposed) return;
    this.startCurrentBgm();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeTemporaryHandle();
    this.temporaryTrackId = null;
    this.temporaryCategory = null;
    this.disposeSuspendedRuntime();
    this.disposeCurrentBgm();
    this.currentBgmId = null;
    this.currentBgmTrackId = null;
    [...this.activeSfx, ...this.activeVoice].forEach((handle) => handle.dispose());
    [...this.releaseCallbacks.values()].forEach((release) => release());
    this.releaseCallbacks.clear();
    this.activeSfx.clear();
    this.activeVoice.clear();
    this.backend.dispose();
  }

  private async resolveAndStartBgm(
    trackId: BgmTrackId,
    category: MusicCategory,
    advanceAfterEnded: boolean,
  ): Promise<void> {
    const music = this.music;
    if (!music) return;
    const track = this.pickBgmTrack(category, advanceAfterEnded);
    if (!track || this.disposed || this.currentBgmId !== trackId) return;
    await this.startRuntimeTrack(trackId, track);
  }

  private async startRuntimeTrack(trackId: BgmTrackId, track: MusicTrackDefinition): Promise<void> {
    const music = this.music;
    if (!music) return;
    const category = bgmCategoryFor(trackId);
    const resolved = await music.resolveTrack(track);
    if (!resolved || this.disposed || this.currentBgmId !== trackId) {
      resolved?.release();
      return;
    }
    const handle = this.backend.createPlayback({
      id: track.id,
      channel: 'bgm',
      src: resolved.url,
      loop: false,
      source: track.sourceType === 'builtin' ? 'project-local' : 'self-generated',
    });
    this.currentBgmTrackId = track.id;
    this.bgmRelease = resolved.release;
    this.bgmHandle = handle;
    handle.setVolume(this.getEffectiveCategoryVolume(category));
    this.attachPlaybackEvents(handle);
    handle.onEnded(() => this.handleBgmEnded(trackId));
    this.notifyPlayback();
    this.startCurrentBgm();
  }

  private handleBgmEnded(trackId: BgmTrackId): void {
    if (this.disposed || this.currentBgmId !== trackId) return;
    this.bgmStarted = false;
    this.playBgm(trackId, true);
  }

  private pickBgmTrack(category: MusicCategory, advanceAfterEnded = false): MusicTrackDefinition | null {
    const music = this.music;
    if (!music) return null;
    const playlist = [...music.tracks(category)];
    if (playlist.length === 0) return null;
    const mode = music.playbackMode(category);
    const last = music.lastSelectedTrackId(category);
    let pick: MusicTrackDefinition;
    if (mode === 'repeat-one') {
      pick = playlist.find((track) => track.id === last) ?? playlist[0];
    } else if (mode === 'shuffle') {
      let index = Math.floor(Math.random() * playlist.length);
      if (playlist.length > 1 && playlist[index].id === last) index = (index + 1) % playlist.length;
      pick = playlist[index];
    } else {
      const index = last ? playlist.findIndex((track) => track.id === last) : -1;
      pick = advanceAfterEnded && index >= 0
        ? playlist[(index + 1) % playlist.length]
        : index >= 0
          ? playlist[index]
          : playlist[0];
    }
    music.setLastSelectedTrackId(category, pick.id);
    return pick;
  }

  private async playGameSfxInternal(gameSfxId: GameSfxId): Promise<void> {
    const music = this.music;
    if (!music) return;
    const group = GAME_SFX_GROUP_BY_ACTION[gameSfxId];
    const groupTracks = [...music.tracksBySfxGroup(group)];
    const track = this.pickSfxTrack(group, groupTracks)
      ?? music.tracks('effects').find((candidate) => candidate.id === DEFAULT_TILE_SFX_TRACK_ID)
      ?? music.tracks('effects')[0];
    if (!track) return;
    const resolved = await music.resolveTrack(track);
    if (!resolved || this.disposed) {
      resolved?.release();
      return;
    }
    const handle = this.backend.createPlayback({
      id: track.id,
      channel: 'sfx',
      src: resolved.url,
      loop: false,
      source: track.sourceType === 'builtin' ? 'project-local' : 'self-generated',
    });
    this.playOneShotHandle(handle, 'sfx', () => resolved.release());
  }

  private pickSfxTrack(
    group: GameSfxGroup,
    playlist: readonly MusicTrackDefinition[],
  ): MusicTrackDefinition | null {
    const music = this.music;
    if (!music || playlist.length === 0) return null;
    const mode = music.sfxPlaybackMode(group);
    let pick: MusicTrackDefinition;
    if (mode === 'repeat-one') {
      const last = music.sfxLastSelectedTrackId(group);
      pick = playlist.find((track) => track.id === last) ?? playlist[0];
      music.setSfxLastSelectedTrackId(group, pick.id);
    } else if (mode === 'shuffle') {
      let index = Math.floor(Math.random() * playlist.length);
      if (playlist.length > 1 && playlist[index].id === this.sfxLastPlayed[group]) {
        index = (index + 1) % playlist.length;
      }
      pick = playlist[index];
      this.sfxLastPlayed[group] = pick.id;
    } else {
      const cursor = this.sfxCursors[group] ?? 0;
      pick = playlist[cursor % playlist.length];
      this.sfxCursors[group] = (cursor + 1) % playlist.length;
    }
    return pick;
  }

  private refreshCurrentBgm(): void {
    if (!this.currentBgmId || !this.music || this.disposed) return;
    const category = bgmCategoryFor(this.currentBgmId);
    const playlist = this.music.tracks(category);
    if (this.currentBgmTrackId && playlist.some((track) => track.id === this.currentBgmTrackId)) {
      this.bgmHandle?.setVolume(this.getEffectiveCategoryVolume(category));
      return;
    }
    const sceneTrackId = this.currentBgmId;
    this.disposeCurrentBgm();
    this.currentBgmId = null;
    this.currentBgmTrackId = null;
    if (categoryEnabledFrom(this.settings, category)) this.playBgm(sceneTrackId);
  }

  private getPreviewVolume(category: MusicCategory): number {
    return this.settings.masterVolume * categoryVolumeFrom(this.settings, category);
  }

  private startCurrentBgm(): void {
    const handle = this.bgmHandle;
    if (!handle || this.bgmStarted || !categoryEnabledFrom(this.settings, this.currentBgmId ? bgmCategoryFor(this.currentBgmId) : 'bgm_main') || this.disposed) return;
    this.bgmStarted = true;
    void handle.play().catch(() => {
      if (this.bgmHandle === handle) this.bgmStarted = false;
    });
  }

  private disposeCurrentBgm(): void {
    this.bgmHandle?.dispose();
    this.bgmHandle = null;
    this.bgmRelease?.();
    this.bgmRelease = null;
    this.bgmStarted = false;
  }

  private suspendRuntimeForTemporary(): void {
    if (this.bgmHandle && this.bgmStarted && this.currentBgmId) {
      const scene = this.currentBgmId;
      this.bgmHandle.pause();
      this.bgmStarted = false;
      this.suspendedRuntime = {
        sceneTrackId: scene,
        category: bgmCategoryFor(scene),
        handle: this.bgmHandle,
        release: this.bgmRelease,
        trackId: this.currentBgmTrackId,
      };
      this.bgmHandle = null;
      this.bgmRelease = null;
      this.currentBgmTrackId = null;
    } else {
      this.suspendedRuntime = null;
    }
  }

  private disposeSuspendedRuntime(): void {
    if (!this.suspendedRuntime) return;
    this.suspendedRuntime.handle?.dispose();
    this.suspendedRuntime.release?.();
    this.suspendedRuntime = null;
  }

  private resumeSuspendedRuntime(): void {
    const suspended = this.suspendedRuntime;
    if (!suspended) return;
    this.suspendedRuntime = null;
    if (!suspended.handle) {
      suspended.release?.();
      return;
    }
    this.bgmHandle = suspended.handle;
    this.bgmRelease = suspended.release;
    this.currentBgmId = suspended.sceneTrackId;
    this.currentBgmTrackId = suspended.trackId;
    this.bgmStarted = false;
    this.startCurrentBgm();
  }

  private handleTemporaryEnded(): void {
    if (this.disposed) return;
    this.disposeTemporaryHandle();
    this.temporaryTrackId = null;
    this.temporaryCategory = null;
    if (this.temporaryReturnPolicy === 'resume-suspended-track') {
      this.resumeSuspendedRuntime();
    } else {
      this.restartSuspendedRuntimePlaylist();
    }
    this.notifyPlayback();
  }

  private restartSuspendedRuntimePlaylist(): void {
    const suspended = this.suspendedRuntime;
    const targetScene = suspended?.sceneTrackId ?? null;
    this.disposeSuspendedRuntime();
    if (!targetScene) return;
    this.startSceneFromFirst(targetScene);
  }

  private stopTemporaryForSceneChange(): void {
    this.disposeTemporaryHandle();
    this.temporaryTrackId = null;
    this.temporaryCategory = null;
    this.disposeSuspendedRuntime();
    this.notifyPlayback();
  }

  private startSceneFromFirst(sceneTrackId: BgmTrackId): void {
    const music = this.music;
    if (!music) return;
    const category = bgmCategoryFor(sceneTrackId);
    const playlist = [...music.tracks(category)];
    if (playlist.length === 0) return;
    const first = playlist[0];
    music.setLastSelectedTrackId(category, first.id);
    this.disposeCurrentBgm();
    this.currentBgmId = null;
    this.currentBgmTrackId = null;
    this.currentBgmId = sceneTrackId;
    void this.startRuntimeTrack(sceneTrackId, first);
  }

  private disposeTemporaryHandle(): void {
    this.temporaryHandle?.dispose();
    this.temporaryHandle = null;
    this.temporaryRelease?.();
    this.temporaryRelease = null;
  }

  private switchTemporaryAdjacent(offset: number): void {
    const music = this.music;
    if (!music || !this.temporaryCategory || !this.temporaryTrackId) return;
    const category = this.temporaryCategory;
    const playlist = [...music.tracks(this.temporaryCategory)];
    if (playlist.length === 0) return;
    const index = playlist.findIndex((track) => track.id === this.temporaryTrackId);
    const current = index >= 0 ? index : 0;
    const target = playlist[(current + offset + playlist.length) % playlist.length];
    if (target.id === this.temporaryTrackId) return;
    this.disposeTemporaryHandle();
    this.temporaryTrackId = target.id;
    this.notifyPlayback();
    void music.resolveTrack(target).then((resolved) => {
      if (!resolved || this.disposed || this.temporaryTrackId !== target.id) {
        resolved?.release();
        return;
      }
      const handle = this.backend.createPlayback({
        id: target.id,
        channel: 'bgm',
        src: resolved.url,
        loop: false,
        source: target.sourceType === 'builtin' ? 'project-local' : 'self-generated',
      });
      this.temporaryHandle = handle;
      this.temporaryRelease = resolved.release;
      handle.setVolume(this.getPreviewVolume(category));
      this.attachPlaybackEvents(handle);
      handle.onEnded(() => this.handleTemporaryEnded());
      void handle.play().catch(() => {
        if (this.temporaryHandle === handle) this.stopTemporary();
      });
    });
  }

  private switchRuntimeAdjacent(offset: number): void {
    const music = this.music;
    if (!music || !this.currentBgmId) return;
    const category = bgmCategoryFor(this.currentBgmId);
    const playlist = [...music.tracks(category)];
    if (playlist.length === 0) return;
    const mode = music.playbackMode(category);
    let target: MusicTrackDefinition;
    if (mode === 'shuffle' && offset > 0 && playlist.length > 1) {
      const currentId = this.currentBgmTrackId;
      let index = Math.floor(Math.random() * playlist.length);
      if (playlist[index].id === currentId) index = (index + 1) % playlist.length;
      target = playlist[index];
    } else {
      const index = this.currentBgmTrackId
        ? playlist.findIndex((track) => track.id === this.currentBgmTrackId)
        : -1;
      const base = index >= 0 ? index : 0;
      target = playlist[(base + offset + playlist.length) % playlist.length];
    }
    if (target.id === this.currentBgmTrackId && playlist.length > 1 && mode === 'shuffle') {
      target = playlist[(playlist.findIndex((track) => track.id === target.id) + 1) % playlist.length];
    }
    music.setLastSelectedTrackId(category, target.id);
    const scene = this.currentBgmId;
    this.disposeCurrentBgm();
    this.currentBgmId = scene;
    this.currentBgmTrackId = null;
    void this.startRuntimeTrack(scene, target);
  }

  private attachPlaybackEvents(handle: AudioPlaybackHandle): void {
    handle.onTimeUpdate?.(() => this.notifyPlayback());
    handle.onPlay?.(() => this.notifyPlayback());
    handle.onPause?.(() => this.notifyPlayback());
  }

  private notifyPlayback(): void {
    this.playbackListeners.forEach((listener) => listener());
  }

  private playOneShot(asset: AudioAssetDefinition, channel: 'sfx' | 'voice'): void {
    const handle = this.backend.createPlayback(asset);
    this.playOneShotHandle(handle, channel);
  }

  private playOneShotHandle(
    handle: AudioPlaybackHandle,
    channel: 'sfx' | 'voice',
    release?: () => void,
  ): void {
    const active = channel === 'sfx' ? this.activeSfx : this.activeVoice;
    const limit = channel === 'sfx' ? MAX_ACTIVE_SFX : MAX_ACTIVE_VOICE;
    if (active.size >= limit) {
      const oldest = active.values().next().value as AudioPlaybackHandle | undefined;
      if (oldest) {
        this.releaseCallbacks.get(oldest)?.();
        this.releaseCallbacks.delete(oldest);
        oldest.dispose();
        active.delete(oldest);
      }
    }
    if (release) this.releaseCallbacks.set(handle, release);

    active.add(handle);
    handle.setVolume(this.getEffectiveVolume(channel));
    let removeEnded: () => void = () => undefined;
    const finalRelease = () => {
      removeEnded();
      active.delete(handle);
      this.releaseCallbacks.delete(handle);
      release?.();
      handle.dispose();
    };
    removeEnded = handle.onEnded(finalRelease);
    void handle.play().catch(finalRelease);
  }
}
