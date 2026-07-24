import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter, SaveManager } from './saveManager';
import { memoryStorage, sampleSavedMatch } from './saveTestUtils';

describe('saveManager', () => {
  it('saves, loads, and deletes the current match', async () => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    await adapter.saveCurrentMatch(sampleSavedMatch());
    expect((await adapter.loadCurrentMatch())?.saveId).toBe('save-1');
    await adapter.deleteCurrentMatch();
    expect(await adapter.loadCurrentMatch()).toBeNull();
  });

  it('saves, lists, loads, and deletes replays', async () => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    const save = sampleSavedMatch();
    await adapter.saveReplay(save.matchLog);
    expect(await adapter.listReplays()).toHaveLength(1);
    expect((await adapter.loadReplay(save.matchLog.matchId))?.matchId).toBe(save.matchLog.matchId);
    await adapter.deleteReplay(save.matchLog.matchId);
    expect(await adapter.listReplays()).toHaveLength(0);
  });

  it('debounced save manager reports saved and error states', async () => {
    const good = new SaveManager(new LocalStorageAdapter(memoryStorage()), 0);
    await good.saveNow(sampleSavedMatch());
    expect(good.status).toBe('saved');
    const base = new LocalStorageAdapter(memoryStorage());
    const bad = new SaveManager({
      saveCurrentMatch: async () => { throw new Error('disk full'); },
      loadCurrentMatch: () => base.loadCurrentMatch(),
      deleteCurrentMatch: () => base.deleteCurrentMatch(),
      saveReplay: (log) => base.saveReplay(log),
      listReplays: () => base.listReplays(),
      loadReplay: (id) => base.loadReplay(id),
      deleteReplay: (id) => base.deleteReplay(id),
    }, 0);
    await bad.saveNow(sampleSavedMatch());
    expect(bad.status).toBe('error');
    expect(bad.lastError).toContain('disk full');
  });
});
