import { describe, expect, it, vi } from 'vitest';
import { MusicLibrary } from './musicLibrary';
import type { MusicLibraryStore, StoredMusicTrack } from './musicLibraryStorage';
import { BUILTIN_MUSIC_TRACKS } from './musicRegistry';

class MemoryMusicLibraryStore implements MusicLibraryStore {
  readonly name = 'memory';
  private readonly records = new Map<string, {
    track: StoredMusicTrack;
    blob?: Blob;
    fileHandle?: FileSystemFileHandle;
  }>();

  async list(): Promise<StoredMusicTrack[]> {
    return [...this.records.values()].map(({ track }) => ({ ...track }));
  }

  async getBlob(id: string): Promise<Blob | null> {
    return this.records.get(id)?.blob ?? null;
  }

  async getHandle(id: string): Promise<FileSystemFileHandle | null> {
    return this.records.get(id)?.fileHandle ?? null;
  }

  async put(track: StoredMusicTrack, blob?: Blob, fileHandle?: FileSystemFileHandle): Promise<void> {
    this.records.set(track.id, { track: { ...track }, blob, fileHandle });
  }

  async remove(id: string): Promise<void> {
    this.records.delete(id);
  }
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function mp3File(name = 'new_theme.mp3'): File {
  return new File(['fake-mp3'], name, { type: 'audio/mpeg' });
}

function wavFile(name = 'sound_effect.wav'): File {
  return new File(['fake-wav'], name, { type: 'audio/wav' });
}

function mockHandle(
  name: string,
  permission: PermissionState = 'granted',
  file: File | null | undefined = undefined,
): FileSystemFileHandle {
  const type = name.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
  return {
    name,
    kind: 'file',
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
    getFile: vi.fn(async () => {
      if (file === null) throw new Error('file missing');
      return file ?? new File(['fake'], name, { type });
    }),
  } as unknown as FileSystemFileHandle;
}

function copiedTracks(library: MusicLibrary) {
  return library.tracks('bgm_main').filter((track) => track.sourceType === 'copied');
}

describe('MusicLibrary', () => {
  it('copied：添加 MP3 / WAV 保存 Blob 副本，刷新后仍存在且顺序保持', async () => {
    const store = new MemoryMusicLibraryStore();
    const preferences = memoryStorage();
    const library = new MusicLibrary(store, preferences);
    await library.initialize();
    const result = await library.addFiles('bgm_main', [mp3File(), wavFile('second_track.wav')]);
    expect(result).toEqual({ added: ['new theme', 'second track'], rejected: [] });
    expect(copiedTracks(library).map((track) => track.name)).toEqual(['new theme', 'second track']);
    expect(await store.getBlob(copiedTracks(library)[0].id)).toBeInstanceOf(Blob);

    const reloaded = new MusicLibrary(store, preferences);
    await reloaded.initialize();
    expect(reloaded.tracks('bgm_main').filter((track) => track.sourceType === 'copied').map((track) => track.name))
      .toEqual(['new theme', 'second track']);
  });

  it('linked：通过 FileHandle 添加 MP3 / WAV，只保存 handle 不复制音频本体', async () => {
    const store = new MemoryMusicLibraryStore();
    const preferences = memoryStorage();
    const library = new MusicLibrary(store, preferences);
    await library.initialize();
    const mp3 = mockHandle('song.mp3', 'granted');
    const wav = mockHandle('effect.wav', 'granted');
    const result = await library.addLinkedHandles('bgm_main', [mp3, wav]);
    expect(result).toEqual({ added: ['song', 'effect'], rejected: [] });
    const linked = library.tracks('bgm_main').filter((track) => track.sourceType === 'linked');
    expect(linked.map((track) => track.name)).toEqual(['song', 'effect']);
    expect(await store.getHandle(linked[0].id)).toBe(mp3);
    expect(await store.getBlob(linked[0].id)).toBeNull();

    const reloaded = new MusicLibrary(store, preferences);
    await reloaded.initialize();
    expect(reloaded.tracks('bgm_main').filter((track) => track.sourceType === 'linked').map((track) => track.name))
      .toEqual(['song', 'effect']);
  });

  it('拒绝不支持格式，并允许同名文件各自独立', async () => {
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), memoryStorage());
    await library.initialize();
    const result = await library.addFiles('effects', [
      wavFile(),
      new File(['ogg'], 'voice.ogg', { type: 'audio/ogg' }),
      new File(['mp4'], 'video.mp4', { type: 'audio/mp4' }),
    ]);
    expect(result.added).toEqual(['sound effect']);
    expect(result.rejected).toEqual(['voice.ogg', 'video.mp4']);

    await library.addFiles('effects', [wavFile()]);
    const userTracks = library.tracks('effects').filter((track) => track.sourceType === 'copied');
    expect(userTracks).toHaveLength(2);
    expect(userTracks[0].id).not.toBe(userTracks[1].id);
    expect(userTracks[0].name).toBe(userTracks[1].name);
  });

  it('不支持 File System Access API 时，picker 添加返回明确提示且不影响 copied 添加', async () => {
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), memoryStorage());
    await library.initialize();
    const result = await library.addLinkedViaPicker('bgm_main');
    expect(result.added).toEqual([]);
    expect(result.rejected[0]).toContain('复制到游戏音乐库');
    const copied = await library.addFiles('bgm_main', [mp3File()]);
    expect(copied.added).toEqual(['new theme']);
  });

  it('linked 权限状态：granted/prompt/denied/文件缺失分别映射可用/重新授权/不可用', async () => {
    let promptPermission: PermissionState = 'prompt';
    const handleA = mockHandle('a.mp3', 'granted');
    const handleB = {
      name: 'b.mp3',
      kind: 'file',
      queryPermission: vi.fn(async () => promptPermission),
      requestPermission: vi.fn(async () => { promptPermission = 'granted'; return 'granted'; }),
      getFile: vi.fn(async () => new File(['x'], 'b.mp3', { type: 'audio/mpeg' })),
    } as unknown as FileSystemFileHandle;
    const handleC = mockHandle('c.mp3', 'denied');
    const handleD = mockHandle('d.mp3', 'granted', null);

    const library = new MusicLibrary(new MemoryMusicLibraryStore(), memoryStorage());
    await library.initialize();
    await library.addLinkedHandles('bgm_main', [handleA, handleB, handleC, handleD]);
    const linked = library.tracks('bgm_main').filter((track) => track.sourceType === 'linked');
    expect(library.linkedStatus(linked[0].id)).toBe('available');
    expect(library.linkedStatus(linked[1].id)).toBe('needs-permission');
    expect(library.linkedStatus(linked[2].id)).toBe('unavailable');
    expect(library.linkedStatus(linked[3].id)).toBe('unavailable');

    await library.reauthorizeTrack(linked[1].id);
    expect(library.linkedStatus(linked[1].id)).toBe('available');
  });

  it('重新选择保持原 id/分类/顺序，仅替换 handle', async () => {
    const store = new MemoryMusicLibraryStore();
    const library = new MusicLibrary(store, memoryStorage());
    await library.initialize();
    await library.addLinkedHandles('bgm_game', [mockHandle('old.mp3', 'granted')]);
    const track = library.tracks('bgm_game').find((candidate) => candidate.sourceType === 'linked')!;
    const orderBefore = library.tracks('bgm_game').map((candidate) => candidate.id);
    const newHandle = mockHandle('new_song.mp3', 'granted');
    const fakeWindow = { showOpenFilePicker: vi.fn(async () => [newHandle]) } as unknown as Window & typeof globalThis;
    const originalWindow = (globalThis as unknown as Record<string, unknown>).window;
    (globalThis as unknown as Record<string, unknown>).window = fakeWindow;
    try {
      const result = await library.relinkViaPicker(track.id);
      expect(result.added).toEqual(['new song']);
      const updated = library.tracks('bgm_game').find((candidate) => candidate.id === track.id)!;
      expect(updated.name).toBe('new song');
      expect(updated.category).toBe('bgm_game');
      expect(updated.sourceType).toBe('linked');
      expect(library.tracks('bgm_game').map((candidate) => candidate.id)).toEqual(orderBefore);
      expect(await store.getHandle(track.id)).toBe(newHandle);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as unknown as Record<string, unknown>).window;
      } else {
        (globalThis as unknown as Record<string, unknown>).window = originalWindow;
      }
    }
  });

  it('用户曲目可真正删除（metadata + Blob/handle），删除最近播放后回退第一首可用', async () => {
    const store = new MemoryMusicLibraryStore();
    const library = new MusicLibrary(store, memoryStorage());
    await library.initialize();
    await library.addFiles('bgm_main', [mp3File('a.mp3'), mp3File('b.mp3')]);
    const userTracks = copiedTracks(library);
    await library.setLastSelectedTrackId('bgm_main', userTracks[1].id);
    await library.removeTrack(userTracks[1].id);
    expect(library.tracks('bgm_main').some((track) => track.id === userTracks[1].id)).toBe(false);
    expect(await store.list()).toHaveLength(1);
    expect(library.lastSelectedTrackId('bgm_main')).not.toBe(userTracks[1].id);
  });

  it('内置曲目删除为禁用/隐藏，刷新后仍隐藏，但项目资源仍存在', async () => {
    const store = new MemoryMusicLibraryStore();
    const preferences = memoryStorage();
    const library = new MusicLibrary(store, preferences);
    await library.initialize();
    const builtin = BUILTIN_MUSIC_TRACKS.find((track) => track.category === 'bgm_main');
    expect(builtin).toBeDefined();
    expect(library.tracks('bgm_main').map((track) => track.id)).toContain(builtin!.id);
    await library.removeTrack(builtin!.id);
    expect(library.tracks('bgm_main').map((track) => track.id)).not.toContain(builtin!.id);
    expect(BUILTIN_MUSIC_TRACKS.some((track) => track.id === builtin!.id)).toBe(true);

    const reloaded = new MusicLibrary(store, preferences);
    await reloaded.initialize();
    expect(reloaded.tracks('bgm_main').map((track) => track.id)).not.toContain(builtin!.id);
  });

  it('reconcile：清理 stale builtin（order/disabled/lastSelected），新增 builtin 自动出现', async () => {
    const preferences = memoryStorage();
    const staleId = 'builtin:bgm_main:stale';
    preferences.setItem('local-mahjong.music-preferences.v1', JSON.stringify({
      version: 1,
      preferences: {
        disabledBuiltinTrackIds: [staleId],
        order: { bgm_main: [staleId] },
        playbackMode: {},
        lastSelectedTrackId: { bgm_main: staleId },
      },
    }));
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), preferences);
    await library.initialize();

    expect(library.lastSelectedTrackId('bgm_main')).not.toBe(staleId);
    const saved = JSON.parse(preferences.getItem('local-mahjong.music-preferences.v1')!) as {
      preferences: { disabledBuiltinTrackIds: string[]; order: Record<string, string[]> };
    };
    expect(saved.preferences.disabledBuiltinTrackIds).toEqual([]);
    expect(saved.preferences.order.bgm_main ?? []).not.toContain(staleId);
    const expectedBuiltin = BUILTIN_MUSIC_TRACKS
      .filter((track) => track.category === 'bgm_main')
      .map((track) => track.id);
    const listed = library.tracks('bgm_main').map((track) => track.id);
    for (const id of expectedBuiltin) {
      expect(listed).toContain(id);
    }
  });

  it('同分类拖拽排序并持久化，跨分类顺序互不影响', async () => {
    const store = new MemoryMusicLibraryStore();
    const preferences = memoryStorage();
    const library = new MusicLibrary(store, preferences);
    await library.initialize();
    await library.addFiles('bgm_main', [mp3File('a.mp3'), mp3File('b.mp3')]);
    await library.addFiles('bgm_game', [wavFile('x.wav')]);
    const userA = copiedTracks(library);
    const userGame = library.tracks('bgm_game').filter((track) => track.sourceType === 'copied');
    library.reorder('bgm_main', [userA[1].id, userA[0].id]);
    expect(copiedTracks(library).map((track) => track.id)).toEqual([userA[1].id, userA[0].id]);
    expect(userGame.map((track) => track.id)).toEqual([userGame[0].id]);

    const reloaded = new MusicLibrary(store, preferences);
    await reloaded.initialize();
    expect(reloaded.tracks('bgm_main').filter((track) => track.sourceType === 'copied').map((track) => track.id))
      .toEqual([userA[1].id, userA[0].id]);
  });

  it('每个分类独立保存播放模式', async () => {
    const preferences = memoryStorage();
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), preferences);
    await library.initialize();
    library.setPlaybackMode('bgm_main', 'shuffle');
    library.setPlaybackMode('bgm_game', 'repeat-one');
    expect(library.playbackMode('bgm_main')).toBe('shuffle');
    expect(library.playbackMode('bgm_game')).toBe('repeat-one');
    expect(library.playbackMode('effects')).toBe('sequential');

    const reloaded = new MusicLibrary(new MemoryMusicLibraryStore(), preferences);
    await reloaded.initialize();
    expect(reloaded.playbackMode('bgm_main')).toBe('shuffle');
    expect(reloaded.playbackMode('bgm_game')).toBe('repeat-one');
  });

  it('copied Blob URL 按引用释放，删除/销毁后 revoke', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:test-track');
    const revokeObjectURL = vi.fn();
    const library = new MusicLibrary(
      new MemoryMusicLibraryStore(),
      memoryStorage(),
      { createObjectURL, revokeObjectURL },
    );
    await library.initialize();
    await library.addFiles('effects', [wavFile()]);
    const track = library.tracks('effects').find((candidate) => candidate.sourceType === 'copied')!;
    const first = await library.resolveTrack(track);
    const second = await library.resolveTrack(track);
    expect(first?.url).toBe('blob:test-track');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    first?.release();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    second?.release();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-track');

    const again = await library.resolveTrack(track);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    await library.removeTrack(track.id);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-track');
  });

  it('linked 曲目可解析为对象 URL，重新授权前不可播放', async () => {
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), memoryStorage());
    await library.initialize();
    await library.addLinkedHandles('bgm_main', [mockHandle('locked.mp3', 'prompt')]);
    const track = library.tracks('bgm_main').find((candidate) => candidate.sourceType === 'linked')!;
    expect(await library.resolveTrack(track)).toBeNull();
  });

  it('tracksBySfxGroup 按组返回内置与用户音效', async () => {
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), memoryStorage());
    await library.initialize();
    await library.addCopiedFiles('effects', [wavFile('draw_user.wav')], 'draw');
    const draw = library.tracksBySfxGroup('draw');
    expect(draw.some((track) => track.name === 'draw user' && track.sourceType === 'copied' && track.gameSfxGroup === 'draw')).toBe(true);
    expect(library.tracksBySfxGroup('draw').every((track) => track.gameSfxGroup === 'draw')).toBe(true);
    expect(library.tracksBySfxGroup('discard').every((track) => track.gameSfxGroup === 'discard')).toBe(true);
  });

  it('带组添加 linked 保存 gameSfxGroup，不复制 Blob', async () => {
    const store = new MemoryMusicLibraryStore();
    const library = new MusicLibrary(store, memoryStorage());
    await library.initialize();
    await library.addLinkedHandles('effects', [mockHandle('pon.wav', 'granted')], 'meld');
    const meld = library.tracksBySfxGroup('meld').find((track) => track.name === 'pon');
    expect(meld?.gameSfxGroup).toBe('meld');
    expect(await store.getBlob(meld!.id)).toBeNull();
    expect(await store.getHandle(meld!.id)).not.toBeNull();
  });

  it('组内排序持久化且跨组互不影响', async () => {
    const store = new MemoryMusicLibraryStore();
    const preferences = memoryStorage();
    const library = new MusicLibrary(store, preferences);
    await library.initialize();
    await library.addCopiedFiles('effects', [wavFile('a.wav'), wavFile('b.wav')], 'draw');
    await library.addCopiedFiles('effects', [wavFile('x.wav')], 'discard');
    const draw = library.tracksBySfxGroup('draw').filter((track) => track.sourceType === 'copied');
    library.reorderSfxGroup('draw', [draw[1].id, draw[0].id]);
    expect(library.tracksBySfxGroup('draw').filter((track) => track.sourceType === 'copied').map((track) => track.id))
      .toEqual([draw[1].id, draw[0].id]);
    expect(library.tracksBySfxGroup('discard').some((track) => track.name === 'x')).toBe(true);

    const reloaded = new MusicLibrary(store, preferences);
    await reloaded.initialize();
    expect(reloaded.tracksBySfxGroup('draw').filter((track) => track.sourceType === 'copied').map((track) => track.id))
      .toEqual([draw[1].id, draw[0].id]);
  });

  it('sfx lastSelected 按组独立，删除目标后各自 fallback', async () => {
    const store = new MemoryMusicLibraryStore();
    const library = new MusicLibrary(store, memoryStorage());
    await library.initialize();
    await library.addCopiedFiles('effects', [wavFile('da.wav'), wavFile('db.wav')], 'draw');
    await library.addCopiedFiles('effects', [wavFile('xa.wav')], 'discard');
    const draw = library.tracksBySfxGroup('draw').filter((track) => track.sourceType === 'copied');
    const discard = library.tracksBySfxGroup('discard').filter((track) => track.sourceType === 'copied');
    library.setSfxLastSelectedTrackId('draw', draw[1].id);
    library.setSfxLastSelectedTrackId('discard', discard[0].id);
    expect(library.sfxLastSelectedTrackId('draw')).toBe(draw[1].id);
    expect(library.sfxLastSelectedTrackId('discard')).toBe(discard[0].id);

    await library.removeTrack(draw[1].id);
    expect(library.sfxLastSelectedTrackId('draw')).not.toBe(draw[1].id);
    expect(library.sfxLastSelectedTrackId('discard')).toBe(discard[0].id);
  });

  it('reconcile 清理 stale sfx order 与 lastSelected', async () => {
    const preferences = memoryStorage();
    preferences.setItem('local-mahjong.music-preferences.v1', JSON.stringify({
      version: 1,
      preferences: {
        sfxOrder: { draw: ['builtin:effects:stale'] },
        sfxLastSelectedTrackId: { draw: 'builtin:effects:stale' },
      },
    }));
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), preferences);
    await library.initialize();
    expect(library.sfxLastSelectedTrackId('draw')).not.toBe('builtin:effects:stale');
    const saved = JSON.parse(preferences.getItem('local-mahjong.music-preferences.v1')!) as {
      preferences: { sfxOrder: Record<string, string[]>; sfxLastSelectedTrackId: Record<string, string | null> };
    };
    expect(saved.preferences.sfxOrder.draw ?? []).not.toContain('builtin:effects:stale');
    expect(saved.preferences.sfxLastSelectedTrackId.draw).not.toBe('builtin:effects:stale');
  });

  it('三组 sfx 播放模式独立保存并可恢复', async () => {
    const preferences = memoryStorage();
    const library = new MusicLibrary(new MemoryMusicLibraryStore(), preferences);
    await library.initialize();
    expect(library.sfxPlaybackMode('draw')).toBe('sequential');
    library.setSfxPlaybackMode('draw', 'shuffle');
    library.setSfxPlaybackMode('discard', 'repeat-one');
    expect(library.sfxPlaybackMode('draw')).toBe('shuffle');
    expect(library.sfxPlaybackMode('discard')).toBe('repeat-one');
    expect(library.sfxPlaybackMode('meld')).toBe('sequential');

    const reloaded = new MusicLibrary(new MemoryMusicLibraryStore(), preferences);
    await reloaded.initialize();
    expect(reloaded.sfxPlaybackMode('draw')).toBe('shuffle');
    expect(reloaded.sfxPlaybackMode('discard')).toBe('repeat-one');
    expect(reloaded.sfxPlaybackMode('meld')).toBe('sequential');
  });
});
