import { afterEach, describe, expect, it, vi } from 'vitest';
import { advancePlaybackStep, playbackDelay, scheduleReplayAdvance, shouldHandleReplayShortcut } from './replayPlayback';

describe('replayPlayback', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('按倍速执行一步并可立即暂停或卸载清理', () => {
    vi.useFakeTimers();
    const advance = vi.fn();
    const cleanup = scheduleReplayAdvance(advance, 2);
    expect(playbackDelay(2)).toBe(450);
    vi.advanceTimersByTime(449);
    expect(advance).not.toHaveBeenCalled();
    cleanup();
    vi.runAllTimers();
    expect(advance).not.toHaveBeenCalled();

    scheduleReplayAdvance(advance, 4);
    vi.advanceTimersByTime(225);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('输入控件和可编辑元素不会响应左右方向键', () => {
    expect(shouldHandleReplayShortcut({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleReplayShortcut({ tagName: 'select' } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleReplayShortcut({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleReplayShortcut({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(true);
  });

  it('自动播放在本局结算步骤停止，不跨入下一局', () => {
    expect(advancePlaybackStep(2, 4)).toEqual({ stepIndex: 3, playing: true });
    expect(advancePlaybackStep(3, 4)).toEqual({ stepIndex: 4, playing: false });
    expect(advancePlaybackStep(4, 4)).toEqual({ stepIndex: 4, playing: false });
  });
});
