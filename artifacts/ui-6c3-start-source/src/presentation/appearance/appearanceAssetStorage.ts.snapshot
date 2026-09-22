import { appearanceAssetCatalog, type AppearanceAssetCatalog } from './appearanceAssetCatalog';

type CatalogProtection = Pick<AppearanceAssetCatalog, 'protectedAssetIds'>;

function retainedIds(current: ReadonlySet<string>, catalog: CatalogProtection): ReadonlySet<string> | null {
  const saved = catalog.protectedAssetIds();
  return saved === null ? null : new Set([...current, ...saved]);
}

export type AppearanceAssetRecord = Readonly<{
  id: string;
  mimeType: string;
  createdAt: string;
}>;

export interface AppearanceAssetStore {
  readonly name: string;
  put(blob: Blob): Promise<AppearanceAssetRecord>;
  get(assetId: string): Promise<Blob | null>;
  replace(assetId: string, blob: Blob): Promise<AppearanceAssetRecord | null>;
  delete(assetId: string): Promise<void>;
  exists(assetId: string): Promise<boolean>;
  cleanupOrphans(referencedAssetIds: ReadonlySet<string>): Promise<string[]>;
}

export const APPEARANCE_ASSET_DB_NAME = 'local-mahjong-appearance-assets';
export const APPEARANCE_ASSET_DB_VERSION = 1;
export const APPEARANCE_ASSET_STORE_NAME = 'assets';

type StoredAppearanceAsset = AppearanceAssetRecord & { blob: Blob };

function createAssetId(): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `appearance-${suffix}`;
}

function createRecord(id: string, blob: Blob): AppearanceAssetRecord {
  return { id, mimeType: blob.type || 'application/octet-stream', createdAt: new Date().toISOString() };
}

class MemoryAppearanceAssetStore implements AppearanceAssetStore {
  readonly name = 'memory';
  private readonly records = new Map<string, StoredAppearanceAsset>();
  constructor(private readonly catalog: CatalogProtection) {}

  async put(blob: Blob): Promise<AppearanceAssetRecord> {
    const record = createRecord(createAssetId(), blob);
    this.records.set(record.id, { ...record, blob });
    return record;
  }

  async get(assetId: string): Promise<Blob | null> {
    return this.records.get(assetId)?.blob ?? null;
  }

  async replace(assetId: string, blob: Blob): Promise<AppearanceAssetRecord | null> {
    if (!this.records.has(assetId)) return null;
    const record = createRecord(assetId, blob);
    this.records.set(assetId, { ...record, blob });
    return record;
  }

  async delete(assetId: string): Promise<void> {
    this.records.delete(assetId);
  }

  async exists(assetId: string): Promise<boolean> {
    return this.records.has(assetId);
  }

  async cleanupOrphans(referencedAssetIds: ReadonlySet<string>): Promise<string[]> {
    const retained = retainedIds(referencedAssetIds, this.catalog);
    if (!retained) return [];
    const removed: string[] = [];
    for (const id of this.records.keys()) {
      if (!retained.has(id)) {
        this.records.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }
}

class IndexedDbAppearanceAssetStore implements AppearanceAssetStore {
  readonly name = APPEARANCE_ASSET_DB_NAME;

  constructor(private readonly dbFactory: IDBFactory, private readonly catalog: CatalogProtection) {}

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.dbFactory.open(APPEARANCE_ASSET_DB_NAME, APPEARANCE_ASSET_DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(APPEARANCE_ASSET_STORE_NAME)) {
          request.result.createObjectStore(APPEARANCE_ASSET_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('无法打开本地图像仓库'));
    });
  }

  private withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return this.openDatabase().then((db) => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(APPEARANCE_ASSET_STORE_NAME, mode);
      const request = operation(transaction.objectStore(APPEARANCE_ASSET_STORE_NAME));
      request.onerror = () => reject(request.error ?? new Error('本地图像仓库操作失败'));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('本地图像仓库事务失败')); };
      transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('本地图像仓库事务失败')); };
    }));
  }

  async put(blob: Blob): Promise<AppearanceAssetRecord> {
    const record = createRecord(createAssetId(), blob);
    await this.withStore<IDBValidKey>('readwrite', (store) => store.put({ ...record, blob } satisfies StoredAppearanceAsset));
    return record;
  }

  async get(assetId: string): Promise<Blob | null> {
    const record = await this.withStore<StoredAppearanceAsset | undefined>('readonly', (store) => store.get(assetId) as IDBRequest<StoredAppearanceAsset | undefined>);
    return record?.blob instanceof Blob ? record.blob : null;
  }

  async replace(assetId: string, blob: Blob): Promise<AppearanceAssetRecord | null> {
    if (!await this.exists(assetId)) return null;
    const record = createRecord(assetId, blob);
    await this.withStore<IDBValidKey>('readwrite', (store) => store.put({ ...record, blob } satisfies StoredAppearanceAsset));
    return record;
  }

  async delete(assetId: string): Promise<void> {
    await this.withStore<undefined>('readwrite', (store) => store.delete(assetId));
  }

  async exists(assetId: string): Promise<boolean> {
    const record = await this.withStore<StoredAppearanceAsset | undefined>('readonly', (store) => store.get(assetId) as IDBRequest<StoredAppearanceAsset | undefined>);
    return Boolean(record?.blob instanceof Blob);
  }

  async cleanupOrphans(referencedAssetIds: ReadonlySet<string>): Promise<string[]> {
    const retained = retainedIds(referencedAssetIds, this.catalog);
    if (!retained) return [];
    const records = await this.withStore<StoredAppearanceAsset[]>('readonly', (store) => store.getAll() as IDBRequest<StoredAppearanceAsset[]>);
    const removed = records.filter((record) => !retained.has(record.id)).map((record) => record.id);
    await Promise.all(removed.map((id) => this.delete(id)));
    return removed;
  }
}

export function createAppearanceAssetStorage(
  dbFactory: IDBFactory = typeof indexedDB === 'undefined' ? undefined as unknown as IDBFactory : indexedDB,
  catalog: CatalogProtection = appearanceAssetCatalog,
): AppearanceAssetStore {
  return dbFactory && typeof dbFactory.open === 'function'
    ? new IndexedDbAppearanceAssetStore(dbFactory, catalog)
    : new MemoryAppearanceAssetStore(catalog);
}

/** Shared local-only repository for avatar and the future appearance consumers. */
export const appearanceAssetStorage = createAppearanceAssetStorage();
