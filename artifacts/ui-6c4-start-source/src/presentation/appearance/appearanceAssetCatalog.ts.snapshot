import { useSyncExternalStore } from 'react';
import { normalizeAssetRef, TILE_APPEARANCE_IDS, type TileAppearanceId } from './appearanceSettings';

export type AppearanceLibraryScope =
  | Readonly<{ kind: 'avatar'; tileKey?: never }>
  | Readonly<{ kind: 'tileBack' | 'tableFelt' | 'riichiStick'; tileKey?: never }>
  | Readonly<{ kind: 'tileFace'; tileKey: TileAppearanceId }>;
export type AppearanceAssetKind = AppearanceLibraryScope['kind'];
export type AppearanceLibraryEntry = AppearanceLibraryScope & Readonly<{
  assetId: string;
  createdAt: number;
  mimeType: string;
  width: number;
  height: number;
}>;
export const APPEARANCE_CATALOG_KEY = 'local-mahjong.appearance-library.v1';
const EMPTY: readonly AppearanceLibraryEntry[] = Object.freeze([]);
type CatalogStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function sameLibraryScope(a: AppearanceLibraryScope, b: AppearanceLibraryScope): boolean {
  return a.kind === b.kind && a.tileKey === b.tileKey;
}

function normalizeEntry(value: unknown): AppearanceLibraryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!normalizeAssetRef({ kind: 'local', assetId: v.assetId })
    || !['avatar', 'tileBack', 'tableFelt', 'riichiStick', 'tileFace'].includes(String(v.kind))
    || (v.kind === 'tileFace' ? !TILE_APPEARANCE_IDS.includes(v.tileKey as TileAppearanceId) : v.tileKey !== undefined)
    || !['image/png', 'image/jpeg', 'image/webp'].includes(String(v.mimeType))
    || !Number.isFinite(v.createdAt) || Number(v.createdAt) < 0
    || !Number.isInteger(v.width) || Number(v.width) <= 0
    || !Number.isInteger(v.height) || Number(v.height) <= 0) return null;
  return {
    assetId: String(v.assetId), kind: v.kind, ...(v.kind === 'tileFace' ? { tileKey: v.tileKey } : {}),
    createdAt: v.createdAt, mimeType: v.mimeType, width: v.width, height: v.height,
  } as AppearanceLibraryEntry;
}

/** Metadata only. Current selection remains in Profile / AppearanceSettings. */
export class AppearanceAssetCatalog {
  private entries: readonly AppearanceLibraryEntry[] = EMPTY;
  private safeToWrite = true;
  private listeners = new Set<() => void>();

  constructor(private readonly storage?: CatalogStorage) { this.reload(); }
  getSnapshot = () => this.entries;
  getServerSnapshot = () => EMPTY;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private notify() { this.listeners.forEach((listener) => listener()); }

  reload(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(APPEARANCE_CATALOG_KEY);
      if (raw === null) { this.entries = EMPTY; this.safeToWrite = true; }
      else {
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !Array.isArray(data.entries)) throw new Error('Unknown catalog');
        const entries: AppearanceLibraryEntry[] = [];
        for (const value of data.entries) {
          const entry = normalizeEntry(value);
          // Never discard metadata and then misclassify its binary as orphaned.
          if (!entry) throw new Error('Invalid catalog');
          if (!entries.some((e) => e.assetId === entry.assetId && sameLibraryScope(e, entry))) entries.push(entry);
        }
        this.entries = entries;
        this.safeToWrite = true;
      }
    } catch { this.entries = EMPTY; this.safeToWrite = false; }
    this.notify();
  }

  list(scope: AppearanceLibraryScope): AppearanceLibraryEntry[] {
    return this.entries.filter((entry) => sameLibraryScope(entry, scope))
      .sort((a, b) => b.createdAt - a.createdAt || a.assetId.localeCompare(b.assetId));
  }
  /** null means unknown/corrupt metadata: cleanup must fail closed. */
  protectedAssetIds(): ReadonlySet<string> | null {
    this.reload();
    return this.safeToWrite ? new Set(this.entries.map((entry) => entry.assetId)) : null;
  }
  private write(entries: readonly AppearanceLibraryEntry[]): void {
    if (!this.safeToWrite) throw new Error('图像库数据无法读取，已保留原数据，请先备份并检查本机存储。');
    this.storage?.setItem(APPEARANCE_CATALOG_KEY, JSON.stringify({ version: 1, entries }));
    this.entries = entries;
    this.notify();
  }
  add(entry: AppearanceLibraryEntry): void {
    const valid = normalizeEntry(entry);
    if (!valid) throw new Error('图像库条目无效。');
    this.reload();
    this.write([...this.entries.filter((e) => !(e.assetId === entry.assetId && sameLibraryScope(e, entry))), valid]);
  }
  remove(assetId: string): void {
    this.reload();
    this.write(this.entries.filter((entry) => entry.assetId !== assetId));
  }
}

function localCatalogStorage(): CatalogStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  // Do not silently report persisted success when localStorage access is denied.
  return { getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
}
export const appearanceAssetCatalog = new AppearanceAssetCatalog(localCatalogStorage());
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === APPEARANCE_CATALOG_KEY || event.key === null) appearanceAssetCatalog.reload();
  });
}
export function useAppearanceLibraryEntries(scope: AppearanceLibraryScope): AppearanceLibraryEntry[] {
  const entries = useSyncExternalStore(appearanceAssetCatalog.subscribe, appearanceAssetCatalog.getSnapshot, appearanceAssetCatalog.getServerSnapshot);
  return entries.filter((entry) => sameLibraryScope(entry, scope))
    .sort((a, b) => b.createdAt - a.createdAt || a.assetId.localeCompare(b.assetId));
}
