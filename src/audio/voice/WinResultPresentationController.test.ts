import { describe, expect, it, vi } from 'vitest';
import type { WinSequenceSignal } from './VoiceDirector';
import { WinResultPresentationController } from './WinResultPresentationController';
import type { WinVoiceSequence } from './winVoiceSequence';

function sequence(id: string, winnerId: 0 | 1 = 0): WinVoiceSequence {
  return {
    id,
    winnerId,
    items: [
      { kind: 'win-action', voiceKey: 'action.ron', actorId: winnerId, displayLabel: '荣和' },
      { kind: 'yaku', voiceKey: 'yaku.riichi', actorId: winnerId, yakuId: 'riichi', han: 1, displayLabel: '立直' },
      { kind: 'dora', voiceKey: 'yaku.dora_6', actorId: winnerId, totalDora: 6, displayLabel: '宝牌', displayValue: 6 },
      { kind: 'limit', voiceKey: 'score.haneman', actorId: winnerId, displayLabel: '跳满' },
    ],
  };
}

function source() {
  let listener: ((signal: WinSequenceSignal) => void) | undefined;
  const skip = vi.fn(() => true);
  return {
    subscribeWinSequence(next: (signal: WinSequenceSignal) => void) { listener = next; return () => { listener = undefined; }; },
    skipCurrentWinSequence: skip,
    emit(signal: WinSequenceSignal) { listener?.(signal); },
    skip,
  };
}

function start(s: ReturnType<typeof source>, win: WinVoiceSequence, index: number): void {
  s.emit({ type: 'itemStarted', sequence: win, item: win.items[index], index, packId: 'xiaozhang' });
}
function complete(s: ReturnType<typeof source>, win: WinVoiceSequence, index: number, status: 'played' | 'disabled' | 'missing' | 'failed' | 'stopped' = 'played'): void {
  s.emit({ type: 'itemCompleted', sequence: win, item: win.items[index], index, packId: 'xiaozhang', status });
}

describe('WinResultPresentationController', () => {
  it('只在 itemStarted 时按 Sequence 顺序追加，并在完成后才公开最终结算状态', () => {
    const s = source(); const controller = new WinResultPresentationController(s, 1);
    const win = sequence('a');
    s.emit({ type: 'sequenceStarted', sequence: win, packId: 'xiaozhang' });
    start(s, win, 0);
    expect(controller.getSnapshot().sequences[0].visibleItems.map((item) => item.displayLabel)).toEqual(['荣和']);
    complete(s, win, 0); start(s, win, 1);
    expect(controller.getSnapshot().sequences[0].visibleItems.map((item) => item.displayLabel)).toEqual(['荣和', '立直']);
    complete(s, win, 1); start(s, win, 2); complete(s, win, 2); start(s, win, 3); complete(s, win, 3);
    s.emit({ type: 'sequenceCompleted', sequence: win, packId: 'xiaozhang', status: 'completed' });
    expect(controller.getSnapshot().sequences[0].sequenceCompleted).toBe(true);
  });

  it('缺失/关闭语音仍以 UI pacing 流式显示，而不会同一帧刷完', () => {
    vi.useFakeTimers();
    const s = source(); const controller = new WinResultPresentationController(s, 100);
    const win = sequence('silent');
    s.emit({ type: 'sequenceStarted', sequence: win, packId: null });
    start(s, win, 0); complete(s, win, 0, 'missing'); start(s, win, 1); complete(s, win, 1, 'disabled');
    expect(controller.getSnapshot().sequences[0].visibleItems.map((item) => item.displayLabel)).toEqual(['荣和']);
    vi.advanceTimersByTime(100);
    expect(controller.getSnapshot().sequences[0].visibleItems.map((item) => item.displayLabel)).toEqual(['荣和', '立直']);
    vi.useRealTimers();
  });

  it('multi-ron 保留赢家 A 完整演出，赢家 B 仅在自己的 sequence 开始后出现', () => {
    const s = source(); const controller = new WinResultPresentationController(s, 1);
    const a = sequence('a', 0); const b = sequence('b', 1);
    s.emit({ type: 'sequenceStarted', sequence: a, packId: 'xiaozhang' }); start(s, a, 0);
    for (let index = 0; index < a.items.length; index += 1) { if (index > 0) start(s, a, index); complete(s, a, index); }
    s.emit({ type: 'sequenceCompleted', sequence: a, packId: 'xiaozhang', status: 'completed' });
    expect(controller.getSnapshot().sequences).toHaveLength(1);
    s.emit({ type: 'sequenceStarted', sequence: b, packId: 'mambo' }); start(s, b, 0);
    expect(controller.getSnapshot().sequences.map((item) => item.winnerId)).toEqual([0, 1]);
  });

  it('快速完成会立即显示当前赢家剩余项并停止当前结算语音', () => {
    const s = source(); const controller = new WinResultPresentationController(s, 100);
    const win = sequence('skip');
    s.emit({ type: 'sequenceStarted', sequence: win, packId: 'xiaozhang' }); start(s, win, 0);
    expect(controller.completeCurrentSequencePresentation()).toBe(true);
    expect(controller.getSnapshot().sequences[0].visibleItems).toHaveLength(4);
    expect(controller.getSnapshot().sequences[0].sequenceCompleted).toBe(true);
    expect(s.skip).toHaveBeenCalledOnce();
  });

  it('每次 itemStarted 都发布新的不可变 snapshot 和 visibleItems 数组', () => {
    const s = source(); const controller = new WinResultPresentationController(s, 1);
    const win = sequence('immutable');
    s.emit({ type: 'sequenceStarted', sequence: win, packId: 'xiaozhang' });
    const before = controller.getSnapshot();
    start(s, win, 0);
    const afterAction = controller.getSnapshot();
    complete(s, win, 0); start(s, win, 1);
    const afterYaku = controller.getSnapshot();
    expect(afterAction).not.toBe(before);
    expect(afterYaku).not.toBe(afterAction);
    expect(afterYaku.sequences[0]?.visibleItems).not.toBe(afterAction.sequences[0]?.visibleItems);
    expect(afterAction.sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和']);
    expect(afterYaku.sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和', '立直']);
  });

  it('不按静默丢弃乱序 lifecycle signal，而是保留可诊断的 sequence', () => {
    const diagnostics: string[] = [];
    const s = source(); const controller = new WinResultPresentationController(s, 1, (diagnostic) => diagnostics.push(diagnostic.code));
    const win = sequence('late-start');
    start(s, win, 0);
    expect(diagnostics).toEqual(['missing-sequence-started']);
    expect(controller.getSnapshot().sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和']);
  });
});
