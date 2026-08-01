import { migrateSavedMatch, SavedMatchCompatibilityError } from './migration';
import { createReplayRecord, normalizeReplayRecord } from './replayRecord';
import { validateReplayRecord, validateSavedMatch } from './storageValidation';
import type { ReplayMetadata, ReplayRecord, SavedMatch, StorageAdapter } from './storageTypes';
import { CURRENT_MATCH_SAVE_KEY, REPLAY_INDEX_KEY, REPLAY_LIBRARY_KEY, REPLAY_RECORD_KEY_PREFIX } from './storageTypes';
import type { MatchLog } from '../replay/types';
import { FormatVersionError } from '../versionPolicy';

export function replayRecordKey(id: string): string {
  return `${REPLAY_RECORD_KEY_PREFIX}${id}`;
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: Storage = localStorage) {}

  async saveCurrentMatch(save: SavedMatch): Promise<void> {
    validateSavedMatch(save);
    this.storage.setItem(CURRENT_MATCH_SAVE_KEY, JSON.stringify(save));
  }

  async loadCurrentMatch(): Promise<SavedMatch | null> {
    const raw = this.storage.getItem(CURRENT_MATCH_SAVE_KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SavedMatchCompatibilityError('JSON 无法解析');
    }
    try {
      const save = migrateSavedMatch(parsed);
      validateSavedMatch(save);
      return save;
    } catch (error) {
      if (error instanceof SavedMatchCompatibilityError || error instanceof FormatVersionError) throw error;
      throw new SavedMatchCompatibilityError(error instanceof Error ? error.message : String(error));
    }
  }

  async deleteCurrentMatch(): Promise<void> {
    this.storage.removeItem(CURRENT_MATCH_SAVE_KEY);
  }

  async saveReplay(input: ReplayRecord | MatchLog): Promise<void> {
    const record = 'log' in input ? normalizeReplayRecord(input) : createReplayRecord({ log: input });
    validateReplayRecord(record);
    this.storage.setItem(replayRecordKey(record.id), JSON.stringify(record));
    const ids = await this.loadReplayIds();
    if (!ids.includes(record.id)) {
      this.storage.setItem(REPLAY_INDEX_KEY, JSON.stringify([...ids, record.id]));
    }
  }

  async listReplays(): Promise<ReplayMetadata[]> {
    const ids = await this.loadReplayIds();
    const records = await Promise.all(ids.map(async (id): Promise<ReplayMetadata> => {
      try {
        const record = await this.getReplay(id);
        if (!record) throw new Error('牌谱记录不存在');
        return metadataOf(record);
      } catch (error) {
        return corruptedMetadata(id, error);
      }
    }));
    return records.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async getReplay(id: string): Promise<ReplayRecord | null> {
    const raw = this.storage.getItem(replayRecordKey(id));
    if (!raw) return null;
    const record = normalizeReplayRecord(JSON.parse(raw));
    validateReplayRecord(record);
    return record;
  }

  async loadReplay(id: string): Promise<MatchLog | null> {
    return (await this.getReplay(id))?.log ?? null;
  }

  async renameReplay(id: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('牌谱标题不能为空');
    const record = await this.getReplay(id);
    if (!record) throw new Error('牌谱不存在');
    await this.saveReplay({ ...record, title: trimmed, updatedAt: new Date().toISOString() });
  }

  async deleteReplay(id: string): Promise<void> {
    this.storage.removeItem(replayRecordKey(id));
    const ids = await this.loadReplayIds();
    this.storage.setItem(REPLAY_INDEX_KEY, JSON.stringify(ids.filter((storedId) => storedId !== id)));
  }

  async exportReplay(id: string): Promise<string> {
    const record = await this.getReplay(id);
    if (!record) throw new Error('牌谱不存在');
    return JSON.stringify(record, null, 2);
  }

  private async loadReplayIds(): Promise<string[]> {
    const rawIndex = this.storage.getItem(REPLAY_INDEX_KEY);
    if (rawIndex) {
      try {
        const parsed = JSON.parse(rawIndex);
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    }
    const legacyRaw = this.storage.getItem(REPLAY_LIBRARY_KEY);
    if (!legacyRaw) return [];
    try {
      const legacy = JSON.parse(legacyRaw) as Record<string, unknown>;
      const ids: string[] = [];
      for (const [id, value] of Object.entries(legacy)) {
        try {
          const record = normalizeReplayRecord(value);
          validateReplayRecord(record);
          this.storage.setItem(replayRecordKey(id), JSON.stringify(record));
        } catch {
          this.storage.setItem(replayRecordKey(id), JSON.stringify(value));
        }
        ids.push(id);
      }
      this.storage.setItem(REPLAY_INDEX_KEY, JSON.stringify(ids));
      return ids;
    } catch {
      return [];
    }
  }
}

function metadataOf(record: ReplayRecord): ReplayMetadata {
  const { log: _log, version: _version, ...metadata } = record;
  return metadata;
}

function corruptedMetadata(id: string, error: unknown): ReplayMetadata {
  return {
    id,
    matchId: id,
    title: '损坏的牌谱',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    playerNames: ['未知', '未知', '未知', '未知'],
    scores: [0, 0, 0, 0],
    matchType: 'single',
    roundCount: 0,
    source: 'local-match',
    status: 'corrupted',
    error: error instanceof Error ? error.message : String(error),
  };
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export class SaveManager {
  private timer: ReturnType<typeof setTimeout> | null = null;
  status: SaveStatus = 'idle';
  lastSavedAt: string | null = null;
  lastError: string | null = null;

  constructor(private readonly adapter: StorageAdapter, private readonly debounceMs = 120) {}

  scheduleSave(save: SavedMatch): void {
    if (this.timer) clearTimeout(this.timer);
    this.status = 'saving';
    this.timer = setTimeout(() => {
      void this.saveNow(save);
    }, this.debounceMs);
  }

  async saveNow(save: SavedMatch): Promise<void> {
    try {
      await this.adapter.saveCurrentMatch(save);
      this.status = 'saved';
      this.lastSavedAt = new Date().toISOString();
      this.lastError = null;
    } catch (error) {
      this.status = 'error';
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }
}
