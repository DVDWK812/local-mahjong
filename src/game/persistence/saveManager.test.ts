import { describe, expect, it } from 'vitest';
import { sampleMatchLog } from '../replay/replayTestUtils';
import { createReplayRecord, normalizeReplayRecord } from './replayRecord';
import { LocalStorageAdapter, replayRecordKey, SaveManager } from './saveManager';
import { memoryStorage, sampleSavedMatch } from './saveTestUtils';
import { validateReplayRecord } from './storageValidation';
import { createTile } from '../tileUtils';
import type { CallSet, GameState, TileId } from '../types';
import { createInitialGameState, discardTile } from '../engine';
import { executeChi } from '../chiChecker';
import { executePon } from '../callChecker';
import { executeKan } from '../kanChecker';

function callableSave(type: 'chi' | 'pon' | 'minkan') {
  const save = sampleSavedMatch();
  const base = save.gameState!;
  const tile = (id: TileId, instanceId: string) => ({ ...createTile(id, 0), instanceId });
  const called = tile(type === 'chi' ? 1 : 27, `${type}-called`);
  const ownTiles = type === 'chi'
    ? [tile(0, 'chi-own-0'), tile(2, 'chi-own-2')]
    : Array.from({ length: type === 'pon' ? 2 : 3 }, (_, index) => tile(27, `${type}-own-${index}`));
  const call: CallSet = type === 'chi'
    ? { type: 'chi', tiles: [...ownTiles, called], from: 0, opened: true, calledTile: called, sequence: [0, 1, 2], usedTileIds: [0, 2] }
    : type === 'pon'
      ? { type: 'pon', tiles: [...ownTiles, called], from: 0, opened: true }
      : { type: 'kan', kanType: 'minkan', tiles: [...ownTiles, called], from: 0, opened: true, calledTile: called };
  const gameState: GameState = {
    ...base,
    wall: [],
    deadWall: [],
    doraIndicators: [],
    kuikaeForbiddenTileIds: { 1: type === 'chi' ? [0, 2] : [27] },
    players: base.players.map((player) => {
      const cleared = { ...player, hand: [], river: [], calls: [], drawnTile: null };
      if (player.id === 0) return { ...cleared, river: [{ ...called, claimed: true, claimedBy: 1 as const }] };
      if (player.id === 1) return { ...cleared, calls: [call] };
      return cleared;
    }),
  };
  return { ...save, gameState, matchState: { ...save.matchState, currentGame: gameState } };
}

function setHand(state: GameState, playerId: 0 | 1 | 2 | 3, ids: TileId[]): GameState {
  const hand = ids.map((id, index) => createTile(id, index % 4));
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, hand, calls: [], river: [], drawnTile: null } : player),
  };
}

function actualCallSave(type: 'chi' | 'pon' | 'minkan') {
  const save = sampleSavedMatch();
  let state = createInitialGameState();
  state = { ...state, dealer: save.matchState.dealer, honba: save.matchState.honba };
  const discardId: TileId = type === 'chi' ? 1 : 27;
  state = setHand(state, 0, [discardId, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 28, 31, 33]);
  state = setHand(state, 1, type === 'chi'
    ? [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 28, 31]
    : [27, 27, ...(type === 'minkan' ? [27] : []), 1, 3, 5, 7, 9, 11, 13, 18, 20, 22] as TileId[]);
  state = setHand(state, 2, [0, 4, 8, 9, 13, 17, 18, 22, 26, 28, 29, 31, 33]);
  state = setHand(state, 3, [0, 4, 8, 9, 13, 17, 18, 22, 26, 28, 30, 31, 33]);
  state = { ...state, currentPlayer: 0, phase: 'discard' };
  const callWindow = discardTile(state, 0, state.players[0].hand[0].instanceId);
  const gameState = type === 'chi'
    ? executeChi(callWindow, 1, 0)
    : type === 'pon'
      ? executePon(callWindow, 1)
      : executeKan(callWindow, 1, 'minkan');
  return { ...save, gameState, matchState: { ...save.matchState, currentGame: gameState } };
}

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

  it.each(['chi', 'pon', 'minkan'] as const)('saves and restores a legal %s alias without losing call state', async (type) => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    await adapter.saveCurrentMatch(callableSave(type));
    const restored = (await adapter.loadCurrentMatch())!.gameState!;
    const riverTile = restored.players[0].river[0];
    const call = restored.players[1].calls[0];

    expect(riverTile).toMatchObject({ claimed: true, claimedBy: 1 });
    expect(call).toMatchObject({ from: 0, type: type === 'minkan' ? 'kan' : type });
    expect(call.tiles.some((entry) => entry.instanceId === riverTile.instanceId)).toBe(true);
    expect(restored.kuikaeForbiddenTileIds[1]).toEqual(type === 'chi' ? [0, 2] : [27]);
  });

  it.each(['chi', 'pon', 'minkan'] as const)('round-trips the real %s action state', async (type) => {
    const adapter = new LocalStorageAdapter(memoryStorage());
    const save = actualCallSave(type);
    await adapter.saveCurrentMatch(save);
    const restored = (await adapter.loadCurrentMatch())!.gameState!;
    const riverTile = restored.players[0].river.find((entry) => entry.claimed)!;
    const call = restored.players[1].calls[0];

    expect(riverTile.claimedBy).toBe(1);
    expect(call.from).toBe(0);
    expect(call.tiles.some((entry) => entry.instanceId === riverTile.instanceId)).toBe(true);
    expect(restored.kuikaeForbiddenTileIds).toEqual(save.gameState!.kuikaeForbiddenTileIds);
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
