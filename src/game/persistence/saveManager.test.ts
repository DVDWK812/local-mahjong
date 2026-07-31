import { describe, expect, it } from 'vitest';
import { sampleMatchLog } from '../replay/replayTestUtils';
import { createReplayRecord, normalizeReplayRecord } from './replayRecord';
import { LocalStorageAdapter, replayRecordKey, SaveManager } from './saveManager';
import { memoryStorage, sampleSavedMatch } from './saveTestUtils';
import { validateReplayRecord } from './storageValidation';

function replay(id: string, updatedAt: string) {
  const log = { ...sampleMatchLog(), matchId: id };
  return createReplayRecord({ log, updatedAt, title: `牌谱 ${id}` });
}

describe('saveManager', () => {
  it('saves, loads, and deletes the current match', async () => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    await adapter.saveCurrentMatch(sampleSavedMatch());
    expect((await adapter.loadCurrentMatch())?.saveId).toBe('save-1');
    await adapter.deleteCurrentMatch();
    expect(await adapter.loadCurrentMatch()).toBeNull();
  });

  it('多份牌谱跨适配器实例持久化且不会互相覆盖，并按更新时间倒序', async () => {
    const stored = memoryStorage();
    const first = new LocalStorageAdapter(stored);
    await first.saveReplay(replay('one', '2026-01-01T00:00:00.000Z'));
    await first.saveReplay(replay('two', '2026-02-01T00:00:00.000Z'));

    const afterRefresh = new LocalStorageAdapter(stored);
    expect((await afterRefresh.listReplays()).map((item) => item.id)).toEqual(['two', 'one']);
    expect((await afterRefresh.getReplay('one'))?.title).toBe('牌谱 one');
    expect((await afterRefresh.getReplay('two'))?.title).toBe('牌谱 two');
  });

  it('正常结束保存为完成牌谱，中途保存为未完成牌谱', async () => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    await adapter.saveReplay(replay('incomplete', '2026-01-01T00:00:00.000Z'));
    await adapter.saveReplay(createReplayRecord({
      log: { ...sampleMatchLog(), matchId: 'completed' },
      completed: true,
      updatedAt: '2026-02-01T00:00:00.000Z',
    }));
    const listed = await adapter.listReplays();
    expect(listed.find((item) => item.id === 'incomplete')?.status).toBe('incomplete');
    expect(listed.find((item) => item.id === 'completed')?.status).toBe('completed');
  });

  it('重命名、导出和删除牌谱', async () => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    await adapter.saveReplay(replay('sample', '2026-01-01T00:00:00.000Z'));
    await adapter.renameReplay('sample', '东一局练习');
    expect((await adapter.getReplay('sample'))?.title).toBe('东一局练习');

    const exported = normalizeReplayRecord(JSON.parse(await adapter.exportReplay('sample')));
    expect(() => validateReplayRecord(exported)).not.toThrow();
    expect(exported.id).toBe('sample');

    await adapter.deleteReplay('sample');
    expect(await adapter.getReplay('sample')).toBeNull();
  });

  it('安全读取旧版裸 MatchLog 并补齐新增字段', async () => {
    const stored = memoryStorage();
    const legacy = sampleMatchLog();
    stored.setItem('local-mahjong.replays.v1', JSON.stringify({ [legacy.matchId]: legacy }));
    const adapter = new LocalStorageAdapter(stored);
    const listed = await adapter.listReplays();
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toContain('本地对局');
    expect(listed[0].status).toBe('incomplete');
    expect((await adapter.getReplay(legacy.matchId))?.log.matchId).toBe(legacy.matchId);
  });

  it('一条损坏记录显示错误且不影响其他记录', async () => {
    const stored = memoryStorage();
    const adapter = new LocalStorageAdapter(stored);
    await adapter.saveReplay(replay('good', '2026-02-01T00:00:00.000Z'));
    await adapter.saveReplay(replay('bad', '2026-01-01T00:00:00.000Z'));
    stored.setItem(replayRecordKey('bad'), '{broken-json');

    const listed = await adapter.listReplays();
    expect(listed.find((item) => item.id === 'good')?.status).toBe('incomplete');
    expect(listed.find((item) => item.id === 'bad')?.status).toBe('corrupted');
  });

  it('保存异常会进入 error 状态而不会停留在 saving', async () => {
    const base = new LocalStorageAdapter(memoryStorage());
    const bad = new SaveManager({
      saveCurrentMatch: async () => { throw new Error('disk full'); },
      loadCurrentMatch: () => base.loadCurrentMatch(),
      deleteCurrentMatch: () => base.deleteCurrentMatch(),
      saveReplay: (record) => base.saveReplay(record),
      listReplays: () => base.listReplays(),
      getReplay: (id) => base.getReplay(id),
      loadReplay: (id) => base.loadReplay(id),
      renameReplay: (id, title) => base.renameReplay(id, title),
      deleteReplay: (id) => base.deleteReplay(id),
      exportReplay: (id) => base.exportReplay(id),
    }, 0);
    await bad.saveNow(sampleSavedMatch());
    expect(bad.status).toBe('error');
    expect(bad.lastError).toContain('disk full');
  });
});
