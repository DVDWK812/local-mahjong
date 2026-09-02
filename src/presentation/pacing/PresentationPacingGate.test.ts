import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresentationPacingGate } from './PresentationPacingGate';
import { runPacedAutomaticAction } from './automaticActionPacing';

afterEach(() => {
  vi.useRealTimers();
});

describe('PresentationPacingGate', () => {
  it('AI discard confirmed 后阻止下一次自动 draw，直到对应表现完成', async () => {
    const gate = new PresentationPacingGate();
    const automaticDraw = vi.fn();

    gate.begin({ eventId: 'discard-104', sequence: 104 });
    const progression = runPacedAutomaticAction(automaticDraw, { gate, timeoutMs: 2500 });
    await Promise.resolve();

    expect(automaticDraw).not.toHaveBeenCalled();

    gate.complete('discard-104');
    await progression;

    expect(automaticDraw).toHaveBeenCalledOnce();
  });

  it('AI draw confirmed 后阻止自动 discard，完成后只执行一次', async () => {
    const gate = new PresentationPacingGate();
    const automaticDiscard = vi.fn();
    gate.begin({ eventId: 'draw-105', sequence: 105 });

    const progression = runPacedAutomaticAction(automaticDiscard, { gate, timeoutMs: 2500 });
    await Promise.resolve();
    expect(automaticDiscard).not.toHaveBeenCalled();

    gate.complete('draw-105');
    await progression;
    expect(automaticDiscard).toHaveBeenCalledOnce();
  });

  it('Riichi discard 与 stick presentation 全部完成后才放行', async () => {
    const gate = new PresentationPacingGate();
    const nextTurn = vi.fn();
    gate.begin({ eventId: 'discard-106', sequence: 106 });
    gate.begin({ eventId: 'riichi-107', sequence: 107 });
    const progression = runPacedAutomaticAction(nextTurn, { gate, timeoutMs: 2500 });

    gate.complete('discard-106');
    await Promise.resolve();
    expect(nextTurn).not.toHaveBeenCalled();
    expect(gate.pendingCount).toBe(1);

    gate.complete('riichi-107');
    await progression;
    expect(nextTurn).toHaveBeenCalledOnce();
  });

  it('MeldDeclared pending 时阻止 caller 自动动作', async () => {
    const gate = new PresentationPacingGate();
    const callerDiscard = vi.fn();
    gate.begin({ eventId: 'meld-108', sequence: 108 });
    const progression = runPacedAutomaticAction(callerDiscard, { gate, timeoutMs: 2500 });

    await Promise.resolve();
    expect(callerDiscard).not.toHaveBeenCalled();
    gate.complete('meld-108');
    await progression;
    expect(callerDiscard).toHaveBeenCalledOnce();
  });

  it('同一 confirmed event 的手部动作与文字 overlay 作为两个参与者全部完成后才放行', async () => {
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'meld-shared-107', sequence: 107 });
    gate.begin({ eventId: 'meld-shared-107', sequence: 107 });
    const waiting = gate.waitUntilClear({ timeoutMs: 2500 });

    gate.complete('meld-shared-107');
    await Promise.resolve();
    expect(gate.pendingCount).toBe(1);

    gate.complete('meld-shared-107');
    await expect(waiting).resolves.toBe('cleared');
    expect(gate.pendingCount).toBe(0);
  });

  it('多家 Ron 的全部手牌表现与文字提示完成后才放行唯一 ResultDialog', async () => {
    const gate = new PresentationPacingGate();
    ['ron-player-1', 'ron-player-2'].forEach((eventId, index) => {
      gate.begin({ eventId, sequence: 121 + index });
      gate.begin({ eventId, sequence: 121 + index });
    });
    const resultReady = vi.fn();
    const waiting = gate.waitUntilClear({ timeoutMs: 6000 }).then(resultReady);

    gate.complete('ron-player-1');
    gate.complete('ron-player-1');
    gate.complete('ron-player-2');
    await Promise.resolve();
    expect(resultReady).not.toHaveBeenCalled();

    gate.complete('ron-player-2');
    await waiting;
    expect(resultReady).toHaveBeenCalledOnce();
    expect(gate.pendingCount).toBe(0);
  });

  it('Win 只等待更早的 Draw/Discard presentation，不等待自身 identity', async () => {
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'discard-120', sequence: 120 });
    gate.begin({ eventId: 'win-121', sequence: 121 });
    const waiting = gate.waitUntilClearBefore(121, { timeoutMs: 2500 });

    gate.complete('discard-120');

    await expect(waiting).resolves.toBe('cleared');
    expect(gate.pendingCount).toBe(1);
    gate.complete('win-121');
  });

  it('Win EventOverlay 等同一事件的 winner presentation 完成后再开始', async () => {
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'win-122', sequence: 122 });
    gate.begin({ eventId: 'win-122', sequence: 122 });
    const waiting = gate.waitUntilOnlyParticipantRemains({ eventId: 'win-122', sequence: 122 }, { timeoutMs: 2500 });
    let ready = false;
    void waiting.then(() => { ready = true; });

    await Promise.resolve();
    expect(ready).toBe(false);
    gate.complete('win-122');

    await expect(waiting).resolves.toBe('cleared');
    expect(gate.pendingCount).toBe(1);
    gate.complete('win-122');
  });

  it('cancel 单个 event 会释放 waiter', async () => {
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'draw-cancel', sequence: 109 });
    const waiting = gate.waitUntilClear({ timeoutMs: 2500 });

    gate.cancel('draw-cancel');

    await expect(waiting).resolves.toBe('cleared');
    expect(gate.pendingCount).toBe(0);
  });

  it('clear 释放全部 pending 与 waiter', async () => {
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'discard-clear', sequence: 110 });
    gate.begin({ eventId: 'riichi-clear', sequence: 111 });
    const waiting = gate.waitUntilClear({ timeoutMs: 2500 });

    gate.clear();

    await expect(waiting).resolves.toBe('cleared');
    expect(gate.pendingCount).toBe(0);
  });

  it('fail-open timeout 使用 fake timers 放行并清理已等待 identity', async () => {
    vi.useFakeTimers();
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'stuck-112', sequence: 112 });
    const action = vi.fn();
    const progression = runPacedAutomaticAction(action, { gate, timeoutMs: 2500 });

    await vi.advanceTimersByTimeAsync(2499);
    expect(action).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(progression).resolves.toEqual({ executed: true, waitStatus: 'timed-out' });
    expect(action).toHaveBeenCalledOnce();
    expect(gate.pendingCount).toBe(0);
  });

  it('未显式传 timeout 时仍使用有界默认 fail-open', async () => {
    vi.useFakeTimers();
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'default-timeout', sequence: 114 });
    const waiting = gate.waitUntilClear();

    await vi.advanceTimersByTimeAsync(2500);

    await expect(waiting).resolves.toBe('timed-out');
    expect(gate.pendingCount).toBe(0);
  });

  it('Result waiter 会等待同次提交稍后注册的 presentation，再等其清空', async () => {
    const gate = new PresentationPacingGate();
    const versionBeforeCommit = gate.version;
    const waiting = gate.waitUntilActivityClearAfter(versionBeforeCommit, { timeoutMs: 2500 });
    let settled = false;
    void waiting.then(() => { settled = true; });

    gate.begin({ eventId: 'round-end-draw', sequence: 115 });
    await Promise.resolve();
    expect(settled).toBe(false);

    gate.complete('round-end-draw');
    await expect(waiting).resolves.toBe('cleared');
  });

  it('Result waiter 在 presentation 未注册时有界 fail-open', async () => {
    vi.useFakeTimers();
    const gate = new PresentationPacingGate();
    const waiting = gate.waitUntilActivityClearAfter(gate.version, { timeoutMs: 2500 });

    await vi.advanceTimersByTimeAsync(2500);

    await expect(waiting).resolves.toBe('timed-out');
  });

  it('navigation cancel 后即使 presentation 完成也不执行 state update', async () => {
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'discard-leave', sequence: 113 });
    let cancelled = false;
    const stateUpdate = vi.fn();
    const progression = runPacedAutomaticAction(stateUpdate, { gate, isCancelled: () => cancelled });

    cancelled = true;
    gate.clear();

    await expect(progression).resolves.toEqual({ executed: false, waitStatus: 'cleared' });
    expect(stateUpdate).not.toHaveBeenCalled();
  });

  it('没有 pending（presentation disabled / bypass）时立即执行且结果一致', async () => {
    const gatedState = { value: 0 };
    const bypassedState = { value: 0 };
    const gate = new PresentationPacingGate();

    await runPacedAutomaticAction(() => { gatedState.value += 1; }, { gate });
    bypassedState.value += 1;

    expect(gatedState).toEqual(bypassedState);
  });
});
