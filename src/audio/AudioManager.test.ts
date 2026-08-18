import { describe, expect, it, vi } from 'vitest';
import type { AudioBackend, AudioPlaybackHandle } from './audioBackend';
import { AudioManager } from './AudioManager';
import type { AudioAssetDefinition, AudioAssetRegistry } from './audioRegistry';
import type { MusicLibraryView } from './musicLibrary';
import { DEFAULT_AUDIO_SETTINGS } from './audioSettings';
import type { GameSfxGroup, MusicCategory, MusicTrackDefinition, MusicTrackId, PlaybackMode } from './musicTypes';

class FakeHandle implements AudioPlaybackHandle {
  playCount = 0;
  pauseCount = 0;
  disposed = false;
  volumes: number[] = [];
  rejectNextPlay = false;
  private readonly ended = new Set<() => void>();

  async play(): Promise<void> {
    this.playCount += 1;
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false;
      throw new Error('autoplay blocked');
    }
  }

  pause(): void { this.pauseCount += 1; }
  setVolume(volume: number): void { this.volumes.push(volume); }
  onEnded(listener: () => void): () => void {
    this.ended.add(listener);
    return () => this.ended.delete(listener);
  }
  finish(): void { [...this.ended].forEach((listener) => listener()); }
  dispose(): void { this.disposed = true; }
}

class FakeBackend implements AudioBackend {
  readonly handles: FakeHandle[] = [];
  disposeCount = 0;
  rejectNextPlay = false;

  createPlayback(): AudioPlaybackHandle {
    const handle = new FakeHandle();
    handle.rejectNextPlay = this.rejectNextPlay;
    this.rejectNextPlay = false;
    this.handles.push(handle);
    return handle;
  }

  dispose(): void { this.disposeCount += 1; }
}

function asset(id: string, channel: AudioAssetDefinition['channel'], loop = false): AudioAssetDefinition {
  return { id, channel, loop, src: `data:audio/wav;base64,${id}`, source: 'self-generated' };
}

const registry: AudioAssetRegistry = {
  bgm: {
    home: asset('home', 'bgm', true),
    game: asset('game', 'bgm', true),
    riichi: asset('riichi', 'bgm', true),
  },
  sfx: { discard: asset('discard', 'sfx') },
  voice: { win: asset('voice-win', 'voice') },
};

describe('AudioManager', () => {
  it('统一计算 master × channel，有效音量不会散落到组件', () => {
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, bgmVolume: 0.4 }, new FakeBackend(), registry);
    expect(manager.getEffectiveVolume('bgm')).toBeCloseTo(0.2);
    manager.setMasterVolume(0.25);
    manager.setChannelVolume('bgm', 0.8);
    expect(manager.getEffectiveVolume('bgm')).toBeCloseTo(0.2);
  });

  it('关闭通道时有效音量为 0 且不创建 SFX / Voice', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, sfxEnabled: false, voiceEnabled: false }, backend, registry);
    manager.playSfx('discard');
    manager.playVoice('win');
    expect(manager.getEffectiveVolume('sfx')).toBe(0);
    expect(manager.getEffectiveVolume('voice')).toBe(0);
    expect(backend.handles).toHaveLength(0);
  });

  it('BGM 切换先清理旧实例，同一曲目重复调用不重启', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('game');
    manager.playBgm('game');
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].playCount).toBe(1);

    manager.switchBgm('riichi');
    expect(backend.handles[0].disposed).toBe(true);
    expect(backend.handles).toHaveLength(2);
    expect(manager.getSnapshot().currentBgmId).toBe('riichi');
  });

  it('关闭 BGM 立即暂停，重新开启按原曲恢复且不新建实例', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('home');
    manager.setChannelEnabled('bgm', false);
    expect(backend.handles[0].pauseCount).toBe(1);
    expect(manager.getEffectiveVolume('bgm')).toBe(0);
    manager.setChannelEnabled('bgm', true);
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].playCount).toBe(2);
  });

  it('stop 清理 BGM 并归零当前曲目', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('game');
    manager.stopBgm();
    expect(backend.handles[0].disposed).toBe(true);
    expect(manager.getSnapshot().currentBgmId).toBeNull();
  });

  it('短 SFX 可重复触发、结束回收，并限制最大并发为 8', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    for (let index = 0; index < 10; index += 1) manager.playSfx('discard');
    expect(backend.handles).toHaveLength(10);
    expect(manager.getSnapshot().activeSfxCount).toBe(8);
    expect(backend.handles[0].disposed).toBe(true);
    backend.handles[9].finish();
    expect(manager.getSnapshot().activeSfxCount).toBe(7);
  });

  it('Voice 使用独立音量和并发集合', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, voiceVolume: 0.6 }, backend, registry);
    manager.playVoice('win');
    expect(backend.handles[0].volumes[backend.handles[0].volumes.length - 1]).toBeCloseTo(0.3);
    expect(manager.getSnapshot().activeVoiceCount).toBe(1);
  });

  it('捕获 autoplay play rejection，之后 resume 仍可恢复', async () => {
    const backend = new FakeBackend();
    backend.rejectNextPlay = true;
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('home');
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.getSnapshot().bgmStarted).toBe(false);
    expect(() => manager.resume()).not.toThrow();
    await Promise.resolve();
    expect(backend.handles[0].playCount).toBe(2);
    expect(manager.getSnapshot().bgmStarted).toBe(true);
  });

  it('dispose 清理 BGM、所有短音频和 backend，activate 支持 StrictMode 重挂载', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('game');
    manager.playSfx('discard');
    manager.playVoice('win');
    manager.dispose();
    expect(manager.getSnapshot()).toMatchObject({
      currentBgmId: null,
      activeSfxCount: 0,
      activeVoiceCount: 0,
      disposed: true,
    });
    expect(backend.handles.every((handle) => handle.disposed)).toBe(true);
    expect(backend.disposeCount).toBe(1);
    manager.activate();
    manager.playSfx('discard');
    expect(manager.getSnapshot().disposed).toBe(false);
    expect(manager.getSnapshot().activeSfxCount).toBe(1);
  });
});

class RecordingHandle implements AudioPlaybackHandle {
  playCount = 0;
  pauseCount = 0;
  disposed = false;
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  readonly volumes: number[] = [];
  private readonly ended = new Set<() => void>();
  private readonly timeUpdates = new Set<() => void>();
  private readonly plays = new Set<() => void>();
  private readonly pauses = new Set<() => void>();

  constructor(readonly src: string) {}

  async play(): Promise<void> {
    this.playCount += 1;
    this.paused = false;
    [...this.plays].forEach((listener) => listener());
  }

  pause(): void {
    this.pauseCount += 1;
    this.paused = true;
    [...this.pauses].forEach((listener) => listener());
  }
  setVolume(volume: number): void { this.volumes.push(volume); }
  onEnded(listener: () => void): () => void {
    this.ended.add(listener);
    return () => this.ended.delete(listener);
  }
  onTimeUpdate(listener: () => void): () => void {
    this.timeUpdates.add(listener);
    return () => this.timeUpdates.delete(listener);
  }
  onPlay(listener: () => void): () => void {
    this.plays.add(listener);
    return () => this.plays.delete(listener);
  }
  onPause(listener: () => void): () => void {
    this.pauses.add(listener);
    return () => this.pauses.delete(listener);
  }
  getCurrentTime(): number { return this.currentTime; }
  getDuration(): number { return this.duration; }
  seek(time: number): void { this.currentTime = time; }
  isPlaying(): boolean { return !this.disposed && !this.paused; }
  finish(): void {
    this.paused = true;
    [...this.ended].forEach((listener) => listener());
  }
  tick(time: number): void {
    this.currentTime = time;
    [...this.timeUpdates].forEach((listener) => listener());
  }
  dispose(): void { this.disposed = true; this.paused = true; }
}

class RecordingBackend implements AudioBackend {
  readonly handles: RecordingHandle[] = [];

  createPlayback(asset: AudioAssetDefinition): AudioPlaybackHandle {
    const handle = new RecordingHandle(asset.src);
    this.handles.push(handle);
    return handle;
  }

  dispose(): void {}
}

class FakeMusicLibrary implements MusicLibraryView {
  readonly initialized = true;
  private tracksMap: Record<MusicCategory, MusicTrackDefinition[]>;
  private modes: Record<MusicCategory, PlaybackMode>;
  private last: Record<MusicCategory, MusicTrackId | null>;
  private sfxLast: Record<GameSfxGroup, MusicTrackId | null> = { draw: null, discard: null, meld: null };
  private sfxModes: Record<GameSfxGroup, PlaybackMode>;
  readonly releases: ReturnType<typeof vi.fn>[] = [];

  constructor(
    tracks: readonly MusicTrackDefinition[],
    mode: PlaybackMode = 'sequential',
  ) {
    this.tracksMap = {
      bgm_main: tracks.filter((track) => track.category === 'bgm_main'),
      bgm_game: tracks.filter((track) => track.category === 'bgm_game'),
      bgm_richi: tracks.filter((track) => track.category === 'bgm_richi'),
      effects: tracks.filter((track) => track.category === 'effects'),
      voice_lines: [],
    };
    this.modes = {
      bgm_main: mode,
      bgm_game: mode,
      bgm_richi: mode,
      effects: mode,
      voice_lines: mode,
    };
    this.sfxModes = { draw: mode, discard: mode, meld: mode };
    this.last = {
      bgm_main: null,
      bgm_game: null,
      bgm_richi: null,
      effects: null,
      voice_lines: null,
    };
  }

  tracks(category: MusicCategory): readonly MusicTrackDefinition[] {
    return this.tracksMap[category] ?? [];
  }

  tracksBySfxGroup(group: GameSfxGroup): readonly MusicTrackDefinition[] {
    return (this.tracksMap.effects ?? []).filter((track) => track.gameSfxGroup === group);
  }

  setTracks(category: MusicCategory, tracks: readonly MusicTrackDefinition[]): void {
    this.tracksMap[category] = [...tracks];
  }

  playbackMode(category: MusicCategory): PlaybackMode {
    return this.modes[category] ?? 'sequential';
  }

  setPlaybackMode(category: MusicCategory, mode: PlaybackMode): void {
    this.modes[category] = mode;
  }

  lastSelectedTrackId(category: MusicCategory): MusicTrackId | null {
    return this.last[category] ?? null;
  }

  trackNameById(trackId: MusicTrackId): string | null {
    for (const tracks of Object.values(this.tracksMap)) {
      const found = tracks.find((candidate) => candidate.id === trackId);
      if (found) return found.name;
    }
    return null;
  }

  linkedStatus(): 'available' | 'needs-permission' | 'unavailable' | null {
    return null;
  }

  sfxLastSelectedTrackId(group: GameSfxGroup): MusicTrackId | null {
    return this.sfxLast[group] ?? null;
  }

  setSfxLastSelectedTrackId(group: GameSfxGroup, trackId: MusicTrackId): void {
    this.sfxLast[group] = trackId;
  }

  sfxPlaybackMode(group: GameSfxGroup): PlaybackMode {
    return this.sfxModes[group];
  }

  setSfxPlaybackMode(group: GameSfxGroup, mode: PlaybackMode): void {
    this.sfxModes[group] = mode;
  }

  reorderSfxGroup(): void {}

  setLastSelectedTrackId(category: MusicCategory, trackId: MusicTrackId): void {
    this.last[category] = trackId;
  }

  resolveTrack(track: MusicTrackDefinition): Promise<{ url: string; release: () => void } | null> {
    const release = vi.fn();
    this.releases.push(release);
    return Promise.resolve({ url: `blob:${track.id}`, release });
  }
}

function track(id: string, category: MusicCategory, gameSfxGroup?: GameSfxGroup): MusicTrackDefinition {
  return {
    id: `builtin:${category}:${id}`,
    name: id,
    category,
    sourceType: 'builtin',
    url: `/assets/${id}.wav`,
    ...(gameSfxGroup ? { gameSfxGroup } : {}),
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AudioManager MusicLibrary', () => {
  it('顺序播放从列表取曲目，结束后续播下一首', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')], 'sequential');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].src).toBe('blob:builtin:bgm_main:a');
    expect(library.lastSelectedTrackId('bgm_main')).toBe('builtin:bgm_main:a');

    backend.handles[0].finish();
    await flush();
    expect(backend.handles).toHaveLength(2);
    expect(backend.handles[0].disposed).toBe(true);
    expect(backend.handles[1].src).toBe('blob:builtin:bgm_main:b');
  });

  it('同一场景曲目重复调用不重启', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    manager.playBgm('home');
    await flush();
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].playCount).toBe(1);
  });

  it('单曲循环使用最近播放曲目，结束后继续同一首', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')], 'repeat-one');
    library.setLastSelectedTrackId('bgm_main', 'builtin:bgm_main:b');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    expect(backend.handles[0].src).toBe('blob:builtin:bgm_main:b');
    backend.handles[0].finish();
    await flush();
    expect(backend.handles[1].src).toBe('blob:builtin:bgm_main:b');
  });

  it('随机播放避免立即重复同一首', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')], 'shuffle');
      const backend = new RecordingBackend();
      const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
      manager.setMusicLibrary(library);
      manager.playBgm('home');
      await flush();
      expect(backend.handles[0].src).toBe('blob:builtin:bgm_main:a');
      backend.handles[0].finish();
      await flush();
      expect(backend.handles[1].src).toBe('blob:builtin:bgm_main:b');
    } finally {
      random.mockRestore();
    }
  });

  it('删除当前单曲后回退下一首可用并更新最近播放', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')], 'repeat-one');
    library.setLastSelectedTrackId('bgm_main', 'builtin:bgm_main:b');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    expect(backend.handles[0].src).toBe('blob:builtin:bgm_main:b');

    library.setTracks('bgm_main', [track('a', 'bgm_main')]);
    manager.setMusicLibrary(library);
    await flush();
    expect(backend.handles[0].disposed).toBe(true);
    expect(backend.handles[1].src).toBe('blob:builtin:bgm_main:a');
    expect(library.lastSelectedTrackId('bgm_main')).toBe('builtin:bgm_main:a');
  });

  it('preview 与 runtime BGM 隔离：切换试听停止旧 preview，不污染正在播放的 BGM', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    expect(backend.handles).toHaveLength(1);

    manager.playTemporary(track('a', 'bgm_main'));
    await flush();
    expect(manager.getSnapshot().temporaryTrackId).toBe('builtin:bgm_main:a');
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    expect(backend.handles).toHaveLength(3);
    const firstPreview = backend.handles[1];
    const secondPreview = backend.handles[2];
    expect(firstPreview.disposed).toBe(true);
    expect(secondPreview.disposed).toBe(false);

    manager.stopTemporary();
    expect(secondPreview.disposed).toBe(true);
    expect(manager.getSnapshot().currentBgmId).toBe('home');
    expect(manager.getSnapshot().bgmStarted).toBe(true);
  });

  it('preview 替换与 dispose 释放对象 URL', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playTemporary(track('a', 'bgm_main'));
    await flush();
    expect(library.releases).toHaveLength(1);
    manager.dispose();
    expect(library.releases[0]).toHaveBeenCalled();
  });

  it('Game SFX 映射：draw/discard/chi/pon/kan 都绑定默认音效 track，开关关闭时不创建', async () => {
    const effects = track('default-tile', 'effects');
    const library = new FakeMusicLibrary([effects]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playSfx('draw');
    manager.playSfx('discard');
    manager.playSfx('chi');
    manager.playSfx('pon');
    manager.playSfx('kan');
    await flush();
    expect(backend.handles).toHaveLength(5);
    expect(new Set(backend.handles.map((handle) => handle.src)).size).toBe(1);

    const disabled = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, sfxEnabled: false }, new RecordingBackend());
    disabled.setMusicLibrary(library);
    disabled.playGameSfx('discard');
    await flush();
    expect(disabled.getSnapshot().activeSfxCount).toBe(0);
  });
});

describe('AudioManager Temporary Pause/Resume', () => {
  it('runtime BGM 播放时开始试听 → 暂停 runtime（仅一次），停止后同一实例恢复', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtimeHandle = backend.handles[0];
    const playsBefore = runtimeHandle.playCount;

    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    expect(runtimeHandle.pauseCount).toBe(1);
    expect(manager.getSnapshot().bgmStarted).toBe(false);

    manager.stopTemporary();
    await flush();
    expect(manager.getSnapshot().temporaryTrackId).toBeNull();
    expect(runtimeHandle.disposed).toBe(false);
    expect(runtimeHandle.playCount).toBe(playsBefore + 1);
    expect(manager.getSnapshot().bgmStarted).toBe(true);
  });

  it('Preview A → B：runtime 只暂停一次，A 停止、B 播放，中间不恢复', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtimeHandle = backend.handles[0];

    manager.playTemporary(track('a', 'bgm_main'));
    await flush();
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();

    expect(runtimeHandle.pauseCount).toBe(1);
    expect(runtimeHandle.playCount).toBe(1);
    expect(backend.handles[1].disposed).toBe(true);
    expect(backend.handles[2].disposed).toBe(false);
    expect(manager.getSnapshot().temporaryTrackId).toBe('builtin:bgm_main:b');

    manager.stopTemporary();
    await flush();
    expect(runtimeHandle.playCount).toBe(2);
    expect(manager.getSnapshot().bgmStarted).toBe(true);
  });

  it('无 runtime BGM 时试听/停止不启动任何 BGM', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playTemporary(track('a', 'bgm_main'));
    await flush();
    expect(backend.handles).toHaveLength(1);
    manager.stopTemporary();
    await flush();
    expect(backend.handles).toHaveLength(1);
    expect(manager.getSnapshot().currentBgmId).toBeNull();
    expect(manager.getSnapshot().bgmStarted).toBe(false);
  });

  it('BGM disabled 时试听/停止不自动启动 BGM', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, bgmEnabled: false }, backend);
    manager.setMusicLibrary(library);
    manager.playTemporary(track('a', 'bgm_main'));
    await flush();
    manager.stopTemporary();
    await flush();
    expect(backend.handles).toHaveLength(1);
    expect(manager.getSnapshot().currentBgmId).toBeNull();
    expect(manager.getSnapshot().bgmStarted).toBe(false);
  });

  it('当前播放信息与实际一致：无 → runtime → temporary → 停止后恢复 runtime', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    expect(manager.getNowPlaying()).toEqual({ source: null, trackId: null, trackName: null });

    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    expect(manager.getNowPlaying()).toMatchObject({ source: 'runtime', trackName: 'a' });

    manager.playTemporary(track('a', 'bgm_main'));
    await flush();
    expect(manager.getNowPlaying()).toMatchObject({ source: 'temporary', trackName: 'a' });

    manager.stopTemporary();
    await flush();
    expect(manager.getNowPlaying()).toMatchObject({ source: 'runtime', trackName: 'a' });
  });

  it('Riichi runtime：preview 停止后恢复同一个 Riichi 实例', async () => {
    const library = new FakeMusicLibrary([track('r', 'bgm_richi')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('riichi');
    await flush();
    const runtime = backend.handles[0];
    const plays = runtime.playCount;

    manager.playTemporary(track('r', 'bgm_richi'));
    await flush();
    expect(runtime.pauseCount).toBe(1);
    manager.stopTemporary();
    await flush();
    expect(runtime.disposed).toBe(false);
    expect(runtime.playCount).toBe(plays + 1);
    expect(manager.getSnapshot().currentBgmId).toBe('riichi');
  });

  it('主动停止：temporary 停止并恢复挂起 runtime 的原进度', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 85;
    runtime.duration = 200;
    runtime.paused = false;

    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    expect(runtime.pauseCount).toBe(1);
    const temporary = backend.handles[1];
    manager.stopTemporary();
    await flush();
    expect(temporary.disposed).toBe(true);
    expect(runtime.disposed).toBe(false);
    expect(runtime.playCount).toBe(2);
    expect(runtime.currentTime).toBe(85);
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'runtime', trackName: 'a', currentTime: 85 });
  });

  it('关闭 Dialog 后 temporary 继续播放，自然结束后 runtime playlist 从第一首 0 秒开始', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main'), track('c', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 85;
    runtime.duration = 200;
    runtime.paused = false;

    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    const temporary = backend.handles[1];
    manager.setTemporaryReturnPolicy('restart-runtime-playlist');
    expect(temporary.disposed).toBe(false);
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'temporary', trackName: 'b' });

    temporary.finish();
    await flush();
    expect(temporary.disposed).toBe(true);
    expect(runtime.disposed).toBe(true);
    const restarted = backend.handles[2];
    expect(restarted.src).toBe('blob:builtin:bgm_main:a');
    expect(restarted.currentTime).toBe(0);
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'runtime', trackName: 'a' });
    expect(library.lastSelectedTrackId('bgm_main')).toBe('builtin:bgm_main:a');
  });

  it('Dialog 仍打开时 temporary 自然结束 → 恢复挂起 runtime 原进度', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 85;
    runtime.duration = 200;
    runtime.paused = false;

    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    backend.handles[1].finish();
    await flush();
    expect(runtime.disposed).toBe(false);
    expect(runtime.playCount).toBe(2);
    expect(runtime.currentTime).toBe(85);
    expect(manager.getPlaybackSnapshot().source).toBe('runtime');
  });

  it('重新打开识别当前 temporary，点击停止恢复原挂起 runtime', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 42;
    runtime.paused = false;
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    manager.setTemporaryReturnPolicy('restart-runtime-playlist');

    // 模拟重新打开设置
    manager.setTemporaryReturnPolicy('resume-suspended-track');
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'temporary', trackId: 'builtin:bgm_main:b' });
    manager.stopTemporary();
    await flush();
    expect(runtime.disposed).toBe(false);
    expect(runtime.playCount).toBe(2);
    expect(runtime.currentTime).toBe(42);
  });

  it('Pause temporary 不等于 Stop：暂停保持会话，继续同一曲目，停止才恢复 runtime', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 30;
    runtime.paused = false;
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    const temporary = backend.handles[1];
    temporary.currentTime = 10;

    manager.pauseCurrentPlayback();
    expect(temporary.paused).toBe(true);
    expect(runtime.pauseCount).toBe(1);
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'temporary', isPlaying: false, currentTime: 10 });
    expect(manager.getSnapshot().temporaryTrackId).toBe('builtin:bgm_main:b');

    manager.resumeCurrentPlayback();
    await flush();
    expect(temporary.paused).toBe(false);
    expect(temporary.playCount).toBe(2);
    expect(runtime.playCount).toBe(1);

    manager.stopTemporary();
    await flush();
    expect(runtime.playCount).toBe(2);
  });

  it('Pause runtime：同一实例从原进度继续', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 65;
    runtime.duration = 180;
    manager.pauseCurrentPlayback();
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'runtime', isPlaying: false, currentTime: 65 });
    manager.resumeCurrentPlayback();
    await flush();
    expect(runtime.disposed).toBe(false);
    expect(runtime.playCount).toBe(2);
    expect(runtime.currentTime).toBe(65);
  });

  it('Seek：有效时长可跳转，无效时长安全禁用', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    const temporary = backend.handles[0];
    temporary.duration = 200;
    manager.seekCurrentPlayback(100);
    expect(temporary.currentTime).toBe(100);

    temporary.duration = Number.NaN;
    manager.seekCurrentPlayback(50);
    expect(temporary.currentTime).toBe(100);
    expect(manager.getPlaybackSnapshot().duration).toBe(Number.NaN);
  });

  it('Runtime Previous/Next：A→B、B→A、C→A、A→C，循环绕回', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main'), track('c', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const src = () => backend.handles[backend.handles.length - 1].src;
    expect(src()).toBe('blob:builtin:bgm_main:a');
    manager.nextTrack();
    await flush();
    expect(src()).toBe('blob:builtin:bgm_main:b');
    manager.previousTrack();
    await flush();
    expect(src()).toBe('blob:builtin:bgm_main:a');
    manager.nextTrack();
    await flush();
    manager.nextTrack();
    await flush();
    expect(src()).toBe('blob:builtin:bgm_main:c');
    manager.nextTrack();
    await flush();
    expect(src()).toBe('blob:builtin:bgm_main:a');
    manager.previousTrack();
    await flush();
    expect(src()).toBe('blob:builtin:bgm_main:c');
  });

  it('Repeat-one 下手动 Next：B→C 并更新 repeat target', async () => {
    const library = new FakeMusicLibrary(
      [track('a', 'bgm_main'), track('b', 'bgm_main'), track('c', 'bgm_main')],
      'repeat-one',
    );
    library.setLastSelectedTrackId('bgm_main', 'builtin:bgm_main:b');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    expect(backend.handles[0].src).toBe('blob:builtin:bgm_main:b');
    manager.nextTrack();
    await flush();
    expect(backend.handles[1].src).toBe('blob:builtin:bgm_main:c');
    expect(library.lastSelectedTrackId('bgm_main')).toBe('builtin:bgm_main:c');
  });

  it('Temporary Next：仍在同一会话，runtime 保持挂起', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main'), track('c', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.currentTime = 20;
    runtime.paused = false;
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    manager.nextTrack();
    await flush();
    expect(backend.handles[2].src).toBe('blob:builtin:bgm_main:c');
    expect(runtime.pauseCount).toBe(1);
    expect(runtime.playCount).toBe(1);
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'temporary', trackName: 'c' });
    manager.stopTemporary();
    await flush();
    expect(runtime.playCount).toBe(2);
  });

  it('Transport 不影响 SFX 通道', async () => {
    const library = new FakeMusicLibrary([
      track('a', 'bgm_main'),
      track('b', 'bgm_main'),
      track('c', 'bgm_main'),
      track('default-tile', 'effects'),
    ]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    manager.playSfx('discard');
    await flush();
    const sfxHandles = backend.handles.filter((handle) => handle.src.includes('effects') || handle.src.includes('default-tile'));
    expect(sfxHandles.length).toBeGreaterThan(0);
    const sfxCountBefore = manager.getSnapshot().activeSfxCount;
    manager.pauseCurrentPlayback();
    manager.resumeCurrentPlayback();
    manager.nextTrack();
    await flush();
    manager.seekCurrentPlayback(10);
    expect(manager.getSnapshot().activeSfxCount).toBe(sfxCountBefore);
    manager.playSfx('discard');
    await flush();
    expect(manager.getSnapshot().activeSfxCount).toBeGreaterThan(0);
  });

  it('Playback 快照随 timeupdate 订阅更新', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const runtime = backend.handles[0];
    runtime.duration = 240;
    const listener = vi.fn();
    const unsubscribe = manager.subscribePlayback(listener);
    runtime.tick(77);
    expect(listener).toHaveBeenCalled();
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'runtime', currentTime: 77, duration: 240 });
    unsubscribe();
    const before = listener.mock.calls.length;
    runtime.tick(78);
    expect(listener.mock.calls.length).toBe(before);
  });

  it('场景切换时临时播放立即结束并切换到新场景音乐', async () => {
    const library = new FakeMusicLibrary([
      track('a', 'bgm_main'),
      track('b', 'bgm_main'),
      track('g1', 'bgm_game'),
      track('g2', 'bgm_game'),
    ]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const homeRuntime = backend.handles[0];
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    const temporary = backend.handles[1];
    expect(manager.getPlaybackSnapshot().source).toBe('temporary');

    manager.playBgm('game');
    await flush();
    expect(temporary.disposed).toBe(true);
    expect(homeRuntime.disposed).toBe(true);
    const gameHandle = backend.handles[2];
    expect(gameHandle.src).toBe('blob:builtin:bgm_game:g1');
    expect(manager.getPlaybackSnapshot()).toMatchObject({ source: 'runtime', category: 'bgm_game', trackName: 'g1' });
  });

  it('stopBgm 在临时播放时立即停止临时与挂起状态，不启动音乐', async () => {
    const library = new FakeMusicLibrary([track('a', 'bgm_main'), track('b', 'bgm_main')]);
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playBgm('home');
    await flush();
    const homeRuntime = backend.handles[0];
    manager.playTemporary(track('b', 'bgm_main'));
    await flush();
    const temporary = backend.handles[1];
    manager.stopBgm();
    await flush();
    expect(temporary.disposed).toBe(true);
    expect(homeRuntime.disposed).toBe(true);
    expect(manager.getPlaybackSnapshot().source).toBeNull();
  });
});

describe('AudioManager Game SFX Variants', () => {
  function sfxLibrary(mode: PlaybackMode = 'sequential') {
    return new FakeMusicLibrary([
      track('a', 'effects', 'draw'),
      track('b', 'effects', 'draw'),
      track('c', 'effects', 'discard'),
      track('d', 'effects', 'discard'),
      track('e', 'effects', 'meld'),
      track('f', 'effects', 'meld'),
      track('default-tile', 'effects'),
    ], mode);
  }

  it('循环模式：draw 组独立 cursor 依次 A→B→A', async () => {
    const library = sfxLibrary('sequential');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    for (let index = 0; index < 3; index += 1) {
      manager.playSfx('draw');
      await flush();
    }
    const drawSrcs = backend.handles
      .filter((handle) => handle.src.includes('effects:a') || handle.src.includes('effects:b'))
      .map((handle) => handle.src);
    expect(drawSrcs).toEqual([
      'blob:builtin:effects:a',
      'blob:builtin:effects:b',
      'blob:builtin:effects:a',
    ]);
  });

  it('draw/discard cursor 相互独立', async () => {
    const library = sfxLibrary('sequential');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playSfx('draw');
    await flush();
    manager.playSfx('discard');
    await flush();
    manager.playSfx('draw');
    await flush();
    manager.playSfx('discard');
    await flush();
    const srcs = backend.handles.map((handle) => handle.src);
    expect(srcs.filter((src) => src.includes('effects:a') || src.includes('effects:b')))
      .toEqual(['blob:builtin:effects:a', 'blob:builtin:effects:b']);
    expect(srcs.filter((src) => src.includes('effects:c') || src.includes('effects:d')))
      .toEqual(['blob:builtin:effects:c', 'blob:builtin:effects:d']);
  });

  it('随机模式：同一组尽量避免立即重复', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const library = sfxLibrary('shuffle');
      const backend = new RecordingBackend();
      const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
      manager.setMusicLibrary(library);
      manager.playSfx('draw');
      await flush();
      manager.playSfx('draw');
      await flush();
      const drawSrcs = backend.handles
        .filter((handle) => handle.src.includes('effects:a') || handle.src.includes('effects:b'))
        .map((handle) => handle.src);
      expect(drawSrcs).toEqual(['blob:builtin:effects:a', 'blob:builtin:effects:b']);
    } finally {
      random.mockRestore();
    }
  });

  it('单曲循环：draw/discard/meld 各自目标独立', async () => {
    const library = sfxLibrary('repeat-one');
    library.setSfxLastSelectedTrackId('draw', 'builtin:effects:b');
    library.setSfxLastSelectedTrackId('discard', 'builtin:effects:c');
    library.setSfxLastSelectedTrackId('meld', 'builtin:effects:e');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playSfx('draw');
    manager.playSfx('discard');
    manager.playSfx('chi');
    manager.playSfx('pon');
    manager.playSfx('kan');
    await flush();
    const srcs = backend.handles.map((handle) => handle.src);
    expect(srcs).toEqual([
      'blob:builtin:effects:b',
      'blob:builtin:effects:c',
      'blob:builtin:effects:e',
      'blob:builtin:effects:e',
      'blob:builtin:effects:e',
    ]);
  });

  it('空组 fallback 到 default-tile，安全播放一次', async () => {
    const library = new FakeMusicLibrary([
      track('c', 'effects', 'discard'),
      track('default-tile', 'effects'),
    ], 'sequential');
    const backend = new RecordingBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library);
    manager.playSfx('chi');
    await flush();
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].src).toBe('blob:builtin:effects:default-tile');
  });

  it('三组播放模式独立：draw 单曲、discard 循环、meld 随机互不影响', async () => {
    const library = sfxLibrary('sequential');
    library.setSfxPlaybackMode('draw', 'repeat-one');
    library.setSfxPlaybackMode('discard', 'sequential');
    library.setSfxPlaybackMode('meld', 'shuffle');
    library.setSfxLastSelectedTrackId('draw', 'builtin:effects:b');
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const backend = new RecordingBackend();
      const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
      manager.setMusicLibrary(library);
      manager.playSfx('draw');
      manager.playSfx('draw');
      manager.playSfx('discard');
      manager.playSfx('discard');
      manager.playSfx('chi');
      manager.playSfx('chi');
      await flush();
      const srcs = backend.handles.map((handle) => handle.src);
      expect(srcs.filter((src) => src.includes('effects:a') || src.includes('effects:b')))
        .toEqual(['blob:builtin:effects:b', 'blob:builtin:effects:b']);
      expect(srcs.filter((src) => src.includes('effects:c') || src.includes('effects:d')))
        .toEqual(['blob:builtin:effects:c', 'blob:builtin:effects:d']);
      expect(srcs.filter((src) => src.includes('effects:e') || src.includes('effects:f')))
        .toEqual(['blob:builtin:effects:e', 'blob:builtin:effects:f']);
    } finally {
      random.mockRestore();
    }
  });
});
