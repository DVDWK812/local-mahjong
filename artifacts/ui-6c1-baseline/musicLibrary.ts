import { BUILTIN_MUSIC_TRACKS } from './musicRegistry';
import {
  createMusicLibraryStorage,
  type MusicLibraryStore,
  type StoredMusicTrack,
} from './musicLibraryStorage';
import {
  GAME_SFX_GROUPS,
  loadMusicPreferences,
  saveMusicPreferences,
  type MusicPreferences,
} from './musicPreferences';
import type {
  GameSfxGroup,
  MusicCategory,
  MusicTrackDefinition,
  MusicTrackId,
  PlaybackMode,
} from './musicTypes';

export type LinkedTrackStatus = 'available' | 'needs-permission' | 'unavailable';

export interface MusicLibraryUi {
  readonly initialized: boolean;
  tracks(category: MusicCategory): readonly MusicTrackDefinition[];
  tracksBySfxGroup(group: GameSfxGroup): readonly MusicTrackDefinition[];
  playbackMode(category: MusicCategory): PlaybackMode;
  sfxPlaybackMode(group: GameSfxGroup): PlaybackMode;
  lastSelectedTrackId(category: MusicCategory): MusicTrackId | null;
  sfxLastSelectedTrackId(group: GameSfxGroup): MusicTrackId | null;
  linkedStatus(trackId: MusicTrackId): LinkedTrackStatus | null;
}

export interface ResolvedMusicTrack {
  readonly url: string;
  release(): void;
}

export interface MusicLibraryView extends MusicLibraryUi {
  setLastSelectedTrackId(category: MusicCategory, trackId: MusicTrackId): void;
  setSfxLastSelectedTrackId(group: GameSfxGroup, trackId: MusicTrackId): void;
  setSfxPlaybackMode(group: GameSfxGroup, mode: PlaybackMode): void;
  trackNameById(trackId: MusicTrackId): string | null;
  reorderSfxGroup(group: GameSfxGroup, orderedIds: readonly MusicTrackId[]): void;
  resolveTrack(track: MusicTrackDefinition): Promise<ResolvedMusicTrack | null>;
}

export interface MusicAddResult {
  readonly added: readonly string[];
  readonly rejected: readonly string[];
}

interface UrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

interface FilePickerWindow {
  showOpenFilePicker?(options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle[]>;
}

type PermissionAwareFileHandle = FileSystemFileHandle & {
  queryPermission?(descriptor: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' }): Promise<PermissionState>;
};

const defaultUrlApi: UrlApi = {
  createObjectURL: (blob) => (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(blob)
    : ''),
  revokeObjectURL: (url) => {
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  },
};

const AUDIO_PICKER_TYPES = Object.freeze([{
  description: '音频文件',
  accept: {
    'audio/mpeg': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/x-wav': ['.wav'],
  },
}]);

function createTrackId(): MusicTrackId {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `user-${globalThis.crypto.randomUUID()}`;
  }
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function displayNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(mp3|wav)$/i, '');
  return base.replace(/[_-]+/g, ' ').trim() || fileName;
}

function mimeTypeForName(fileName: string, fallback = ''): string {
  if (fallback === 'audio/mpeg' || fallback === 'audio/wav' || fallback === 'audio/x-wav') return fallback;
  if (/\.mp3$/i.test(fileName)) return 'audio/mpeg';
  if (/\.wav$/i.test(fileName)) return 'audio/wav';
  return fallback || 'application/octet-stream';
}

export function isSupportedMusicFile(file: File): boolean {
  return /\.(mp3|wav)$/i.test(file.name);
}

export function isSupportedMusicFileName(fileName: string): boolean {
  return /\.(mp3|wav)$/i.test(fileName);
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as FilePickerWindow).showOpenFilePicker === 'function';
}

export class MusicLibrary implements MusicLibraryView {
  private readonly store: MusicLibraryStore;
  private preferences: MusicPreferences;
  private userTracks: StoredMusicTrack[] = [];
  private initializedFlag = false;
  private readonly urlCache = new Map<MusicTrackId, { url: string; refs: number }>();
  private readonly linkedStatusCache = new Map<MusicTrackId, LinkedTrackStatus>();

  constructor(
    store: MusicLibraryStore = createMusicLibraryStorage(),
    private readonly preferenceStorage?: Pick<Storage, 'getItem' | 'setItem'>,
    private readonly urlApi: UrlApi = defaultUrlApi,
  ) {
    this.store = store;
    this.preferences = loadMusicPreferences(preferenceStorage);
  }

  get initialized(): boolean {
    return this.initializedFlag;
  }

  async initialize(): Promise<void> {
    if (this.initializedFlag) return;
    await this.refresh();
    this.initializedFlag = true;
  }

  async refresh(): Promise<void> {
    const stored = await this.store.list();
    this.userTracks = [...stored].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.reconcile();
    await this.refreshLinkedStatuses();
  }

  reconcile(): void {
    const builtinIds = new Set(BUILTIN_MUSIC_TRACKS.map((track) => track.id));
    const userIds = new Set(this.userTracks.map((track) => track.id));
    const isValid = (id: MusicTrackId) => builtinIds.has(id) || userIds.has(id);

    const disabledBuiltinTrackIds = this.preferences.disabledBuiltinTrackIds.filter((id) => builtinIds.has(id));
    const order: Partial<Record<MusicCategory, readonly MusicTrackId[]>> = {};
    (Object.keys(this.preferences.order) as MusicCategory[]).forEach((category) => {
      const current = this.preferences.order[category] ?? [];
      const filtered = current.filter((id) => isValid(id));
      if (filtered.length > 0) order[category] = filtered;
    });
    const lastSelectedTrackId: Partial<Record<MusicCategory, MusicTrackId | null>> = {};
    (Object.keys(this.preferences.lastSelectedTrackId) as MusicCategory[]).forEach((category) => {
      const current = this.preferences.lastSelectedTrackId[category];
      if (current === null || current === undefined) return;
      if (isValid(current)) {
        lastSelectedTrackId[category] = current;
      } else {
        lastSelectedTrackId[category] = this.tracks(category)[0]?.id ?? null;
      }
    });
    const sfxOrder: Partial<Record<GameSfxGroup, readonly MusicTrackId[]>> = {};
    GAME_SFX_GROUPS.forEach((group) => {
      const current = this.preferences.sfxOrder[group] ?? [];
      const filtered = current.filter((id) => isValid(id));
      if (filtered.length > 0) sfxOrder[group] = filtered;
    });
    const sfxLastSelectedTrackId: Partial<Record<GameSfxGroup, MusicTrackId | null>> = {};
    GAME_SFX_GROUPS.forEach((group) => {
      const current = this.preferences.sfxLastSelectedTrackId[group];
      if (current === null || current === undefined) return;
      if (isValid(current)) {
        sfxLastSelectedTrackId[group] = current;
      } else {
        sfxLastSelectedTrackId[group] = this.tracksBySfxGroup(group)[0]?.id ?? null;
      }
    });
    this.preferences = {
      ...this.preferences,
      disabledBuiltinTrackIds,
      order,
      lastSelectedTrackId,
      sfxOrder,
      sfxLastSelectedTrackId,
    };
    this.persistPreferences();
  }

  tracks(category: MusicCategory): readonly MusicTrackDefinition[] {
    const builtin = BUILTIN_MUSIC_TRACKS.filter(
      (track) => track.category === category && !this.preferences.disabledBuiltinTrackIds.includes(track.id),
    );
    const user = this.userTracks.filter((track) => track.category === category);
    const all: MusicTrackDefinition[] = [...builtin, ...user];
    const order = this.effectiveOrder(category);
    const ordered: MusicTrackDefinition[] = [];
    const seen = new Set<MusicTrackId>();
    order.forEach((id) => {
      const track = all.find((candidate) => candidate.id === id);
      if (!track || seen.has(id)) return;
      seen.add(id);
      ordered.push(track);
    });
    all.forEach((track) => {
      if (!seen.has(track.id)) ordered.push(track);
    });
    return ordered;
  }

  tracksBySfxGroup(group: GameSfxGroup): readonly MusicTrackDefinition[] {
    const builtin = BUILTIN_MUSIC_TRACKS.filter(
      (track) => track.category === 'effects'
        && track.gameSfxGroup === group
        && !this.preferences.disabledBuiltinTrackIds.includes(track.id),
    );
    const user = this.userTracks.filter(
      (track) => track.category === 'effects' && track.gameSfxGroup === group,
    );
    const all: MusicTrackDefinition[] = [...builtin, ...user];
    const preferred = this.preferences.sfxOrder[group];
    const ordered: MusicTrackDefinition[] = [];
    const seen = new Set<MusicTrackId>();
    if (preferred && preferred.length > 0) {
      preferred.forEach((id) => {
        const track = all.find((candidate) => candidate.id === id);
        if (!track || seen.has(id)) return;
        seen.add(id);
        ordered.push(track);
      });
    }
    all.forEach((track) => {
      if (!seen.has(track.id)) ordered.push(track);
    });
    return ordered;
  }

  playbackMode(category: MusicCategory): PlaybackMode {
    return this.preferences.playbackMode[category] ?? 'sequential';
  }

  setPlaybackMode(category: MusicCategory, mode: PlaybackMode): void {
    this.preferences = {
      ...this.preferences,
      playbackMode: { ...this.preferences.playbackMode, [category]: mode },
    };
    this.persistPreferences();
  }

  sfxPlaybackMode(group: GameSfxGroup): PlaybackMode {
    return this.preferences.sfxPlaybackMode[group] ?? 'sequential';
  }

  setSfxPlaybackMode(group: GameSfxGroup, mode: PlaybackMode): void {
    this.preferences = {
      ...this.preferences,
      sfxPlaybackMode: { ...this.preferences.sfxPlaybackMode, [group]: mode },
    };
    this.persistPreferences();
  }

  lastSelectedTrackId(category: MusicCategory): MusicTrackId | null {
    const id = this.preferences.lastSelectedTrackId[category];
    if (id && this.tracks(category).some((track) => track.id === id)) return id;
    const first = this.tracks(category)[0];
    return first?.id ?? null;
  }

  setLastSelectedTrackId(category: MusicCategory, trackId: MusicTrackId): void {
    this.preferences = {
      ...this.preferences,
      lastSelectedTrackId: { ...this.preferences.lastSelectedTrackId, [category]: trackId },
    };
    this.persistPreferences();
  }

  sfxLastSelectedTrackId(group: GameSfxGroup): MusicTrackId | null {
    const id = this.preferences.sfxLastSelectedTrackId[group];
    if (id && this.tracksBySfxGroup(group).some((track) => track.id === id)) return id;
    return this.tracksBySfxGroup(group)[0]?.id ?? null;
  }

  setSfxLastSelectedTrackId(group: GameSfxGroup, trackId: MusicTrackId): void {
    this.preferences = {
      ...this.preferences,
      sfxLastSelectedTrackId: { ...this.preferences.sfxLastSelectedTrackId, [group]: trackId },
    };
    this.persistPreferences();
  }

  linkedStatus(trackId: MusicTrackId): LinkedTrackStatus | null {
    return this.linkedStatusCache.get(trackId) ?? null;
  }

  trackNameById(trackId: MusicTrackId): string | null {
    return this.userTracks.find((track) => track.id === trackId)?.name
      ?? BUILTIN_MUSIC_TRACKS.find((track) => track.id === trackId)?.name
      ?? null;
  }

  async addFiles(category: MusicCategory, files: readonly File[]): Promise<MusicAddResult> {
    return this.addCopiedFiles(category, files);
  }

  async addCopiedFiles(
    category: MusicCategory,
    files: readonly File[],
    gameSfxGroup?: GameSfxGroup,
  ): Promise<MusicAddResult> {
    const added: string[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!isSupportedMusicFile(file)) {
        rejected.push(file.name);
        continue;
      }
      const track: StoredMusicTrack = {
        id: createTrackId(),
        name: displayNameFromFileName(file.name),
        category,
        mimeType: mimeTypeForName(file.name, file.type),
        sourceType: 'copied',
        order: this.userTracks.filter((candidate) => candidate.category === category).length,
        createdAt: new Date().toISOString(),
        ...(gameSfxGroup ? { gameSfxGroup } : {}),
      };
      await this.store.put(track, file);
      this.userTracks = [...this.userTracks, track];
      if (gameSfxGroup) {
        this.appendSfxOrder(gameSfxGroup, track.id);
      } else {
        this.appendOrder(category, track.id);
      }
      added.push(track.name);
    }
    this.persistPreferences();
    return { added, rejected };
  }

  async addLinkedHandles(
    category: MusicCategory,
    handles: readonly FileSystemFileHandle[],
    gameSfxGroup?: GameSfxGroup,
  ): Promise<MusicAddResult> {
    const added: string[] = [];
    const rejected: string[] = [];
    for (const handle of handles) {
      if (!isSupportedMusicFileName(handle.name)) {
        rejected.push(handle.name);
        continue;
      }
      let fileType = '';
      try {
        fileType = (await handle.getFile()).type;
      } catch {
        // 无法读取元数据时仍允许按扩展名引用，播放时再报失效状态。
      }
      const track: StoredMusicTrack = {
        id: createTrackId(),
        name: displayNameFromFileName(handle.name),
        category,
        mimeType: mimeTypeForName(handle.name, fileType),
        sourceType: 'linked',
        order: this.userTracks.filter((candidate) => candidate.category === category).length,
        createdAt: new Date().toISOString(),
        ...(gameSfxGroup ? { gameSfxGroup } : {}),
      };
      await this.store.put(track, undefined, handle);
      this.userTracks = [...this.userTracks, track];
      if (gameSfxGroup) {
        this.appendSfxOrder(gameSfxGroup, track.id);
      } else {
        this.appendOrder(category, track.id);
      }
      this.linkedStatusCache.set(track.id, await this.queryLinkedStatus(track.id, handle));
      added.push(track.name);
    }
    this.persistPreferences();
    return { added, rejected };
  }

  async addLinkedViaPicker(category: MusicCategory, gameSfxGroup?: GameSfxGroup): Promise<MusicAddResult> {
    const picker = (typeof window === 'undefined' ? undefined : window) as FilePickerWindow | undefined;
    if (typeof picker?.showOpenFilePicker !== 'function') {
      return { added: [], rejected: ['当前浏览器不支持引用原文件，请使用「复制到游戏音乐库」。'] };
    }
    const handles = await picker.showOpenFilePicker({
      multiple: true,
      types: AUDIO_PICKER_TYPES as unknown as Array<{ description: string; accept: Record<string, string[]> }>,
    });
    return this.addLinkedHandles(category, handles, gameSfxGroup);
  }

  async reauthorizeTrack(trackId: MusicTrackId): Promise<void> {
    const storedHandle = await this.store.getHandle(trackId);
    const handle = storedHandle as PermissionAwareFileHandle | null;
    if (!handle) return;
    try {
      if (typeof handle.requestPermission === 'function') {
        await handle.requestPermission({ mode: 'read' });
      }
    } catch {
      // 用户拒绝或 API 不可用时保留现有状态。
    }
    await this.refreshLinkedStatuses([trackId]);
  }

  async relinkViaPicker(trackId: MusicTrackId): Promise<MusicAddResult> {
    const existing = this.userTracks.find((track) => track.id === trackId);
    if (!existing) return { added: [], rejected: [] };
    const picker = (typeof window === 'undefined' ? undefined : window) as FilePickerWindow | undefined;
    if (typeof picker?.showOpenFilePicker !== 'function') {
      return { added: [], rejected: ['当前浏览器不支持重新选择原文件。'] };
    }
    const handles = await picker.showOpenFilePicker({
      multiple: false,
      types: AUDIO_PICKER_TYPES as unknown as Array<{ description: string; accept: Record<string, string[]> }>,
    });
    const handle = handles[0];
    if (!handle || !isSupportedMusicFileName(handle.name)) {
      return { added: [], rejected: [handle?.name ?? ''] };
    }
    const updated: StoredMusicTrack = {
      ...existing,
      name: displayNameFromFileName(handle.name),
      mimeType: mimeTypeForName(handle.name),
    };
    await this.store.put(updated, undefined, handle);
    this.userTracks = this.userTracks.map((track) => track.id === trackId ? updated : track);
    this.revokeCachedUrl(trackId);
    this.linkedStatusCache.set(trackId, await this.queryLinkedStatus(trackId, handle));
    return { added: [updated.name], rejected: [] };
  }

  async removeTrack(trackId: MusicTrackId): Promise<void> {
    const track = this.userTracks.find((candidate) => candidate.id === trackId)
      ?? BUILTIN_MUSIC_TRACKS.find((candidate) => candidate.id === trackId);
    if (!track) return;
    if (track.sourceType === 'builtin') {
      this.preferences = {
        ...this.preferences,
        disabledBuiltinTrackIds: [...this.preferences.disabledBuiltinTrackIds, trackId],
      };
    } else {
      await this.store.remove(trackId);
      this.userTracks = this.userTracks.filter((candidate) => candidate.id !== trackId);
      this.revokeCachedUrl(trackId);
      this.linkedStatusCache.delete(trackId);
    }
    this.removeFromOrder(track.category, trackId);
    if (track.gameSfxGroup) {
      this.removeSfxFromOrder(track.gameSfxGroup, trackId);
      const currentSfx = this.preferences.sfxLastSelectedTrackId[track.gameSfxGroup];
      if (currentSfx === trackId) {
        const fallback = this.tracksBySfxGroup(track.gameSfxGroup)[0];
        this.preferences = {
          ...this.preferences,
          sfxLastSelectedTrackId: {
            ...this.preferences.sfxLastSelectedTrackId,
            [track.gameSfxGroup]: fallback?.id ?? null,
          },
        };
      }
    }
    const currentLast = this.preferences.lastSelectedTrackId[track.category];
    if (currentLast === trackId) {
      const fallback = this.tracks(track.category)[0];
      this.preferences = {
        ...this.preferences,
        lastSelectedTrackId: {
          ...this.preferences.lastSelectedTrackId,
          [track.category]: fallback?.id ?? null,
        },
      };
    }
    this.persistPreferences();
  }

  reorder(category: MusicCategory, orderedIds: readonly MusicTrackId[]): void {
    const ids = [...new Set(orderedIds)];
    this.preferences = {
      ...this.preferences,
      order: { ...this.preferences.order, [category]: ids },
    };
    this.persistPreferences();
  }

  reorderSfxGroup(group: GameSfxGroup, orderedIds: readonly MusicTrackId[]): void {
    const ids = [...new Set(orderedIds)];
    this.preferences = {
      ...this.preferences,
      sfxOrder: { ...this.preferences.sfxOrder, [group]: ids },
    };
    this.persistPreferences();
  }

  async resolveTrack(track: MusicTrackDefinition): Promise<ResolvedMusicTrack | null> {
    if (track.sourceType === 'builtin') {
      if (!track.url) return null;
      return { url: track.url, release: () => undefined };
    }
    let cached = this.urlCache.get(track.id);
    if (!cached) {
      let blob: Blob | null = null;
      if (track.sourceType === 'copied') {
        blob = await this.store.getBlob(track.id);
      } else {
        const handle = await this.store.getHandle(track.id);
        if (!handle) return null;
        const permission = await this.queryPermission(handle);
        if (permission !== 'granted') return null;
        try {
          blob = await handle.getFile();
        } catch {
          return null;
        }
      }
      if (!blob) return null;
      const url = this.urlApi.createObjectURL(blob);
      if (!url) return null;
      cached = { url, refs: 0 };
      this.urlCache.set(track.id, cached);
    }
    cached.refs += 1;
    return {
      url: cached.url,
      release: () => {
        cached.refs -= 1;
        if (cached.refs <= 0) {
          this.urlApi.revokeObjectURL(cached.url);
          this.urlCache.delete(track.id);
        }
      },
    };
  }

  dispose(): void {
    [...this.urlCache.values()].forEach((cached) => this.urlApi.revokeObjectURL(cached.url));
    this.urlCache.clear();
  }

  private async queryPermission(handle: FileSystemFileHandle): Promise<PermissionState> {
    const permissionHandle = handle as PermissionAwareFileHandle;
    if (typeof permissionHandle.queryPermission !== 'function') return 'denied';
    try {
      return await permissionHandle.queryPermission({ mode: 'read' });
    } catch {
      return 'denied';
    }
  }

  private async queryLinkedStatus(trackId: MusicTrackId, handle: FileSystemFileHandle): Promise<LinkedTrackStatus> {
    const permission = await this.queryPermission(handle);
    if (permission === 'prompt') return 'needs-permission';
    if (permission !== 'granted') return 'unavailable';
    try {
      await handle.getFile();
      return 'available';
    } catch {
      return 'unavailable';
    }
  }

  private async refreshLinkedStatuses(trackIds?: readonly MusicTrackId[]): Promise<void> {
    const targets = trackIds
      ? this.userTracks.filter((track) => trackIds.includes(track.id) && track.sourceType === 'linked')
      : this.userTracks.filter((track) => track.sourceType === 'linked');
    for (const track of targets) {
      const handle = await this.store.getHandle(track.id);
      if (!handle) {
        this.linkedStatusCache.set(track.id, 'unavailable');
        continue;
      }
      this.linkedStatusCache.set(track.id, await this.queryLinkedStatus(track.id, handle));
    }
  }

  private effectiveOrder(category: MusicCategory): readonly MusicTrackId[] {
    const preferred = this.preferences.order[category];
    if (preferred && preferred.length > 0) return preferred;
    return [
      ...BUILTIN_MUSIC_TRACKS.filter((track) => track.category === category).map((track) => track.id),
      ...this.userTracks.filter((track) => track.category === category).map((track) => track.id),
    ];
  }

  private appendOrder(category: MusicCategory, trackId: MusicTrackId): void {
    const current = this.preferences.order[category] ?? [];
    this.preferences = {
      ...this.preferences,
      order: { ...this.preferences.order, [category]: [...current, trackId] },
    };
  }

  private appendSfxOrder(group: GameSfxGroup, trackId: MusicTrackId): void {
    const current = this.preferences.sfxOrder[group] ?? [];
    this.preferences = {
      ...this.preferences,
      sfxOrder: { ...this.preferences.sfxOrder, [group]: [...current, trackId] },
    };
  }

  private removeFromOrder(category: MusicCategory, trackId: MusicTrackId): void {
    const current = this.preferences.order[category];
    if (!current) return;
    this.preferences = {
      ...this.preferences,
      order: { ...this.preferences.order, [category]: current.filter((id) => id !== trackId) },
    };
  }

  private removeSfxFromOrder(group: GameSfxGroup, trackId: MusicTrackId): void {
    const current = this.preferences.sfxOrder[group];
    if (!current) return;
    this.preferences = {
      ...this.preferences,
      sfxOrder: { ...this.preferences.sfxOrder, [group]: current.filter((id) => id !== trackId) },
    };
  }

  private revokeCachedUrl(trackId: MusicTrackId): void {
    const cached = this.urlCache.get(trackId);
    if (cached) {
      this.urlApi.revokeObjectURL(cached.url);
      this.urlCache.delete(trackId);
    }
  }

  private persistPreferences(): void {
    saveMusicPreferences(this.preferences, this.preferenceStorage);
  }
}
