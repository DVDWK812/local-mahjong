import { describe, expect, it, vi } from 'vitest';
import { SettlementPresentationCoordinator } from './SettlementPresentationCoordinator';
import type { WinResultPresentationState } from './WinResultPresentationController';
import type { ExhaustiveDrawResult, WinRoundResult } from '../../game/types';

function winResult(winners: number[] = [0]): WinRoundResult {
  return {
    type: 'ron', pointDeltas: [-1000, 1000, 0, 0],
    winners: winners.map((winner) => ({
      winner: winner as 0 | 1 | 2 | 3, from: 1, winType: 'ron', winTile: {} as never,
      yaku: [], han: 1, fu: 30, points: 1000, pointDeltas: [-1000, 1000, 0, 0],
    })),
  };
}

function source(initial: WinResultPresentationState = { sequences: [], activeSequenceId: null }) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    completeCurrentSequencePresentation: vi.fn(() => true),
    set(next: WinResultPresentationState) { snapshot = next; listeners.forEach((listener) => listener()); },
  };
}

describe('SettlementPresentationCoordinator', () => {
  it('所有赢家 sequence 完成后保留 Stage 1 五秒，再进入按席位 reveal 的 Stage 2', () => {
    vi.useFakeTimers();
    const win = source(); const coordinator = new SettlementPresentationCoordinator(win, 5000, 300);
    coordinator.begin({ id: 'ron', result: winResult([0, 1]), playerIds: [0, 1, 2, 3], scoreAfter: [24000, 26000, 25000, 25000] });
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'round-result', roundResultComplete: false });
    win.set({
      activeSequenceId: null,
      sequences: [
        { sequenceId: 'a', winnerId: 0, visibleItems: [], sequenceCompleted: true },
        { sequenceId: 'b', winnerId: 1, visibleItems: [], sequenceCompleted: true },
      ],
    });
    expect(coordinator.getSnapshot().roundResultComplete).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(coordinator.getSnapshot().phase).toBe('round-result');
    vi.advanceTimersByTime(1);
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'point-settlement', visibleSeatCount: 1 });
    vi.advanceTimersByTime(900);
    expect(coordinator.getSnapshot().visibleSeatCount).toBe(4);
    vi.useRealTimers();
  });

  it('继续会取消等待 timer；序列未完时先请求安全完成当前语音', () => {
    vi.useFakeTimers();
    const win = source(); const coordinator = new SettlementPresentationCoordinator(win, 5000, 300);
    coordinator.begin({ id: 'ron', result: winResult(), playerIds: [0, 1], scoreAfter: [24000, 26000] });
    coordinator.continue();
    expect(win.completeCurrentSequencePresentation).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'point-settlement', visibleSeatCount: 1 });
    vi.advanceTimersByTime(6000);
    expect(coordinator.getSnapshot().phase).toBe('point-settlement');
    vi.useRealTimers();
  });

  it('重复 begin/rerender 不会重置已经启动的五秒 hold timer', () => {
    vi.useFakeTimers();
    const win = source(); const coordinator = new SettlementPresentationCoordinator(win, 5000, 300);
    const descriptor = { id: 'stable-result', result: winResult(), playerIds: [0, 1] as const, scoreAfter: [24000, 26000] };
    coordinator.begin(descriptor);
    win.set({ activeSequenceId: null, sequences: [{ sequenceId: 'winner', winnerId: 0, visibleItems: [], sequenceCompleted: true }] });
    expect(coordinator.getSnapshot().roundResultComplete).toBe(true);
    coordinator.begin(descriptor);
    vi.advanceTimersByTime(4999);
    expect(coordinator.getSnapshot().phase).toBe('round-result');
    vi.advanceTimersByTime(1);
    expect(coordinator.getSnapshot().phase).toBe('point-settlement');
    vi.useRealTimers();
  });

  it('冻结每名玩家的 after/delta/before，绝不把已结算分数再加一次 delta', () => {
    const win = source(); const coordinator = new SettlementPresentationCoordinator(win);
    coordinator.begin({
      id: 'multi-ron-points',
      result: { ...winResult(), pointDeltas: [-36600, 15300, 24300, 0] },
      playerIds: [0, 1, 2, 3],
      scoreAfter: [18200, 30800, 24300, 25000],
    });
    expect(coordinator.getSnapshot().pointRows).toEqual([
      { playerId: 0, beforePoints: 54800, delta: -36600, afterPoints: 18200 },
      { playerId: 1, beforePoints: 15500, delta: 15300, afterPoints: 30800 },
      { playerId: 2, beforePoints: 0, delta: 24300, afterPoints: 24300 },
      { playerId: 3, beforePoints: 25000, delta: 0, afterPoints: 25000 },
    ]);
    coordinator.getSnapshot().pointRows.forEach((row) => expect(row.beforePoints + row.delta).toBe(row.afterPoints));
  });

  it('荒牌和中止流局也使用两阶段流程，且 reset 清理 pending timer', () => {
    vi.useFakeTimers();
    const win = source(); const coordinator = new SettlementPresentationCoordinator(win, 5000, 300);
    const draw: ExhaustiveDrawResult = {
      type: 'exhaustive-draw', tenpaiPlayers: [], notenPlayers: [0, 1], scoreDeltas: [0, 0], pointDeltas: [0, 0], dealerContinues: true, honbaIncrement: 1, riichiSticksCarryOver: true,
    };
    coordinator.begin({ id: 'draw', result: draw, playerIds: [0, 1], scoreAfter: [25000, 25000] });
    expect(coordinator.getSnapshot().roundResultComplete).toBe(true);
    coordinator.reset();
    vi.advanceTimersByTime(5000);
    expect(coordinator.getSnapshot().settlementId).toBeNull();
    vi.useRealTimers();
  });
});
