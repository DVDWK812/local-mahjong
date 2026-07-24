import { migrateSavedMatch } from './migration';
import { validateSavedMatch } from './storageValidation';
import type { ReplayMetadata, SavedMatch, StorageAdapter } from './storageTypes';
import { CURRENT_MATCH_SAVE_KEY, REPLAY_LIBRARY_KEY } from './storageTypes';
import type { MatchLog } from '../replay/types';

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: Storage = localStorage) {}

  async saveCurrentMatch(save: SavedMatch): Promise<void> {
    validateSavedMatch(save);
    this.storage.setItem(CURRENT_MATCH_SAVE_KEY, JSON.stringify(save));
  }

  async loadCurrentMatch(): Promise<SavedMatch | null> {
    const raw = this.storage.getItem(CURRENT_MATCH_SAVE_KEY);
    if (!raw) return null;
    const save = migrateSavedMatch(JSON.parse(raw));
    validateSavedMatch(save);
    return save;
  }

  async deleteCurrentMatch(): Promise<void> {
    this.storage.removeItem(CURRENT_MATCH_SAVE_KEY);
  }

  async saveReplay(log: MatchLog): Promise<void> {
    const logs = await this.loadReplayMap();
    logs[log.matchId] = log;
    this.storage.setItem(REPLAY_LIBRARY_KEY, JSON.stringify(logs));
  }

  async listReplays(): Promise<ReplayMetadata[]> {
    const logs = await this.loadReplayMap();
    return Object.values(logs).map((log) => ({
      matchId: log.matchId,
      createdAt: log.createdAt,
      playerNames: log.playerNames,
      finalScoreSummary: log.finalResult?.players.map((player) => `${player.player + 1}:${player.rawScore}`).join(', '),
    }));
  }

  async loadReplay(id: string): Promise<MatchLog | null> {
    const logs = await this.loadReplayMap();
    return logs[id] ?? null;
  }

  async deleteReplay(id: string): Promise<void> {
    const logs = await this.loadReplayMap();
    delete logs[id];
    this.storage.setItem(REPLAY_LIBRARY_KEY, JSON.stringify(logs));
  }

  private async loadReplayMap(): Promise<Record<string, MatchLog>> {
    const raw = this.storage.getItem(REPLAY_LIBRARY_KEY);
    return raw ? JSON.parse(raw) as Record<string, MatchLog> : {};
  }
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
