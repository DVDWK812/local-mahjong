import { describe, expect, it, vi } from 'vitest';
import { advanceAIAction } from './ai';
import { discardTile } from './engine';
import { executeKan } from './kanChecker';
import { createInitialGameState } from './engine';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile } from './types';
import { PresentationEventBus, type PresentationEvent } from '../presentation/PresentationEventBus';
import { GamePresentationEventObserver } from '../presentation/gamePresentationEvents';
import { VoicePresentationConsumer } from '../audio/voice/VoicePresentationConsumer';

function fixedTile(id: number, instanceId: string): Tile {
  return { ...createTile(id as Tile['id'], 0), instanceId };
}

/** A deterministic post-four-kan discard: player 3 could otherwise make a fifth minkan. */
function suukanSanraDiscardState(): GameState {
  const discarded = fixedTile(31, 'four-kan-discard');
  const minkanTiles = [
    fixedTile(31, 'minkan-a'),
    fixedTile(31, 'minkan-b'),
    fixedTile(31, 'minkan-c'),
  ];
  const base = createInitialGameState();
  return {
    ...base,
    wall: [fixedTile(0, 'wall-0')],
    currentPlayer: 0,
    phase: 'discard',
    pendingAbortiveDrawAfterFourthKan: true,
    players: base.players.map((player) => {
      if (player.id === 0) return { ...player, hand: [discarded], drawnTile: discarded };
      if (player.id === 3) return { ...player, hand: minkanTiles, drawnTile: null };
      return { ...player, hand: [], drawnTile: null };
    }),
  };
}

describe('suukan sanra settlement', () => {
  it('第四杠后的弃牌直接结算四杠散了，不创建可供 AI 执行的第五杠 call-window', () => {
    const before = suukanSanraDiscardState();
    const after = discardTile(before, 0, 'four-kan-discard');

    expect(after.phase).toBe('round-ended');
    expect(after.pendingCall).toBeNull();
    expect(after.result).toMatchObject({ type: 'abortive-draw', reason: 'suukan-sanra', triggeringPlayer: 0 });
    expect(advanceAIAction(after)).toBe(after);
    expect(discardTile(after, 0, 'four-kan-discard')).toBe(after);
  });

  it('同一份结算状态只发布一次 round_settled 和四杠散了语音事件', () => {
    const before = suukanSanraDiscardState();
    const settled = discardTile(before, 0, 'four-kan-discard');
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    const play = vi.fn();
    bus.subscribe((event) => events.push(event));
    const consumer = new VoicePresentationConsumer({ play }, bus);
    const observer = new GamePresentationEventObserver(before, bus);

    observer.observe(settled);
    observer.observe(settled);

    expect(events.filter((event) => event.type === 'round_settled')).toEqual([
      expect.objectContaining({ settlementType: 'abortive-draw', reason: 'suukan-sanra', triggeringPlayerId: 0 }),
    ]);
    expect(play.mock.calls.map(([event]) => event).filter((event) => event.key === 'game.four_kans_abortive_draw')).toEqual([
      expect.objectContaining({ key: 'game.four_kans_abortive_draw', actorId: '0', priority: 85 }),
    ]);
    consumer.dispose();
  });

  it('王牌已耗尽时杠路径以带合法 result 的荒牌结算结束，而非 result=null 的终止 phase', () => {
    const base = createInitialGameState();
    const quad = [0, 1, 2, 3].map((copy) => fixedTile(27, `terminal-kan-${copy}`));
    const state = {
      ...base,
      deadWall: [],
      currentPlayer: 0 as PlayerId,
      phase: 'discard' as const,
      players: base.players.map((player) => player.id === 0 ? { ...player, hand: quad, drawnTile: quad[3] } : player),
    };
    const after = executeKan(state, 0, 'ankan', 27);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('exhaustive-draw');
  });
});
