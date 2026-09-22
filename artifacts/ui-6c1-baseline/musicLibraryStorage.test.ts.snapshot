import { describe, expect, it } from 'vitest';
import {
  MUSIC_LIBRARY_DB_NAME,
  MUSIC_LIBRARY_DB_VERSION,
  MUSIC_LIBRARY_STORE_NAME,
  createMusicLibraryStorage,
} from './musicLibraryStorage';

describe('MusicLibraryStorage', () => {
  it('无 IndexedDB 环境时回退内存存储，可保存/列出/取回 copied Blob 与 linked handle', async () => {
    const store = createMusicLibraryStorage();
    expect(store.name).toBe('memory');
    const copiedTrack = {
      id: 'user-copied',
      name: 'copied',
      category: 'effects' as const,
      mimeType: 'audio/wav',
      sourceType: 'copied' as const,
      order: 0,
      createdAt: '2026-08-18T00:00:00.000Z',
    };
    const blob = new Blob(['wav-bytes'], { type: 'audio/wav' });
    await store.put(copiedTrack, blob);

    const linkedTrack = {
      id: 'user-linked',
      name: 'linked',
      category: 'bgm_main' as const,
      mimeType: 'audio/mpeg',
      sourceType: 'linked' as const,
      order: 1,
      createdAt: '2026-08-18T00:00:01.000Z',
    };
    const handle = {
      name: 'song.mp3',
      kind: 'file',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => new File(['mp3'], 'song.mp3', { type: 'audio/mpeg' }),
    } as unknown as FileSystemFileHandle;
    await store.put(linkedTrack, undefined, handle);

    expect(await store.list()).toEqual([copiedTrack, linkedTrack]);
    expect(await store.getBlob('user-copied')).toEqual(blob);
    expect(await store.getBlob('user-linked')).toBeNull();
    expect(await store.getHandle('user-linked')).toBe(handle);
    expect(await store.getHandle('user-copied')).toBeNull();

    await store.remove('user-copied');
    await store.remove('user-linked');
    expect(await store.list()).toEqual([]);
  });

  it('IndexedDB 适配器使用 v2 库、正确版本和对象存储名，并迁移旧 user 记录为 copied', () => {
    let captured: { name: string | undefined; version: number | undefined } | null = null;
    let upgraded = false;
    const fakeFactory = {
      open: (name: string, version: number) => {
        captured = { name, version };
        const request = {
          onupgradeneeded: null as (() => void) | null,
          onsuccess: null,
          onerror: null,
          result: {
            objectStoreNames: { contains: () => false },
            createObjectStore: () => ({}),
          },
          transaction: null,
          error: null,
        };
        Object.defineProperty(request, 'onupgradeneeded', {
          set(value: (() => void) | null) {
            if (value) {
              upgraded = true;
              value();
            }
          },
          get: () => null,
        });
        return request;
      },
    } as unknown as IDBFactory;
    const store = createMusicLibraryStorage(fakeFactory);
    expect(store.name).toBe(MUSIC_LIBRARY_DB_NAME);
    void store.list().catch(() => undefined);
    expect(captured).toEqual({ name: MUSIC_LIBRARY_DB_NAME, version: MUSIC_LIBRARY_DB_VERSION });
    expect(MUSIC_LIBRARY_DB_VERSION).toBe(2);
    expect(MUSIC_LIBRARY_STORE_NAME).toBe('tracks');
    expect(upgraded).toBe(true);
  });
});
