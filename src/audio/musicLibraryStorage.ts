import type { GameSfxGroup, MusicCategory, MusicSourceType } from './musicTypes';

export interface StoredMusicTrack {
  readonly id: string;
  readonly name: string;
  readonly category: MusicCategory;
  readonly mimeType: string;
  readonly sourceType: 'linked' | 'copied';
  readonly order: number;
  readonly createdAt: string;
  readonly gameSfxGroup?: GameSfxGroup;
}

export interface MusicLibraryStore {
  readonly name: string;
  list(): Promise<StoredMusicTrack[]>;
  getBlob(id: string): Promise<Blob | null>;
  getHandle(id: string): Promise<FileSystemFileHandle | null>;
  put(track: StoredMusicTrack, blob?: Blob, fileHandle?: FileSystemFileHandle): Promise<void>;
  remove(id: string): Promise<void>;
}

export const MUSIC_LIBRARY_DB_NAME = 'local-mahjong-music-library';
export const MUSIC_LIBRARY_DB_VERSION = 2;
export const MUSIC_LIBRARY_STORE_NAME = 'tracks';

function normalizeStoredTrack(record: Partial<StoredMusicTrack> & Record<string, unknown>): StoredMusicTrack {
  const rawSource = record.sourceType;
  const sourceType: 'linked' | 'copied' = rawSource === 'linked' ? 'linked' : 'copied';
  return {
    id: String(record.id ?? ''),
    name: typeof record.name === 'string' ? record.name : '未命名音乐',
    category: (record.category as MusicCategory | undefined) ?? 'bgm_main',
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : 'application/octet-stream',
    sourceType,
    order: typeof record.order === 'number' && Number.isFinite(record.order) ? record.order : 0,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    ...(record.gameSfxGroup === 'draw' || record.gameSfxGroup === 'discard' || record.gameSfxGroup === 'meld'
      ? { gameSfxGroup: record.gameSfxGroup }
      : {}),
  };
}

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
    this.records.set(track.id, {
      track: { ...track },
      blob,
      fileHandle,
    });
  }

  async remove(id: string): Promise<void> {
    this.records.delete(id);
  }
}

interface IndexedDbRecord extends StoredMusicTrack {
  readonly blob?: Blob;
  readonly fileHandle?: FileSystemFileHandle;
}

class IndexedDbMusicLibraryStore implements MusicLibraryStore {
  readonly name = MUSIC_LIBRARY_DB_NAME;

  constructor(private readonly dbFactory: IDBFactory) {}

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.dbFactory.open(MUSIC_LIBRARY_DB_NAME, MUSIC_LIBRARY_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction;
        if (!db.objectStoreNames.contains(MUSIC_LIBRARY_STORE_NAME)) {
          db.createObjectStore(MUSIC_LIBRARY_STORE_NAME, { keyPath: 'id' });
        }
        if (transaction && transaction.objectStoreNames.contains(MUSIC_LIBRARY_STORE_NAME)) {
          const store = transaction.objectStore(MUSIC_LIBRARY_STORE_NAME);
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const record = cursor.value as Partial<IndexedDbRecord> | undefined;
            if (record && record.sourceType !== 'linked' && record.sourceType !== 'copied') {
              cursor.update({ ...record, sourceType: 'copied' });
            }
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('无法打开音乐库数据库'));
    });
  }

  private withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return this.openDatabase().then((db) => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(MUSIC_LIBRARY_STORE_NAME, mode);
      const store = transaction.objectStore(MUSIC_LIBRARY_STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('音乐库数据库操作失败'));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error ?? new Error('音乐库数据库事务失败'));
    }));
  }

  async list(): Promise<StoredMusicTrack[]> {
    const records = await this.withStore<IndexedDbRecord[]>('readonly', (store) => store.getAll() as IDBRequest<IndexedDbRecord[]>);
    return records.map(({ blob: _blob, fileHandle: _handle, ...track }) => normalizeStoredTrack(track as unknown as Partial<StoredMusicTrack> & Record<string, unknown>));
  }

  async getBlob(id: string): Promise<Blob | null> {
    const record = await this.withStore<IndexedDbRecord | undefined>('readonly', (store) => store.get(id) as IDBRequest<IndexedDbRecord | undefined>);
    return record?.blob ?? null;
  }

  async getHandle(id: string): Promise<FileSystemFileHandle | null> {
    const record = await this.withStore<IndexedDbRecord | undefined>('readonly', (store) => store.get(id) as IDBRequest<IndexedDbRecord | undefined>);
    return record?.fileHandle ?? null;
  }

  async put(track: StoredMusicTrack, blob?: Blob, fileHandle?: FileSystemFileHandle): Promise<void> {
    await this.withStore<IDBValidKey>('readwrite', (store) => store.put({
      ...track,
      ...(blob ? { blob } : {}),
      ...(fileHandle ? { fileHandle } : {}),
    } as IndexedDbRecord));
  }

  async remove(id: string): Promise<void> {
    await this.withStore<undefined>('readwrite', (store) => store.delete(id));
  }
}

export function createMusicLibraryStorage(dbFactory: IDBFactory = typeof indexedDB === 'undefined' ? undefined as unknown as IDBFactory : indexedDB): MusicLibraryStore {
  return dbFactory && typeof dbFactory.open === 'function'
    ? new IndexedDbMusicLibraryStore(dbFactory)
    : new MemoryMusicLibraryStore();
}
