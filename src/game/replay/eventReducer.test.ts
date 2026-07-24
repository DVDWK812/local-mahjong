import { describe, expect, it } from 'vitest';
import { createInitialReplayState, reduceGameEvent } from './eventReducer';
import { sampleMatchLog } from './replayTestUtils';

describe('eventReducer', () => {
  it('replays deal, draw, and discard without mutating previous state', () => {
    const log = sampleMatchLog();
    const initial = createInitialReplayState(log);
    const afterDeal = reduceGameEvent(initial, log.rounds[0].events[2]);
    const afterDraw = reduceGameEvent(afterDeal, log.rounds[0].events[3]);
    const afterDiscard = reduceGameEvent(afterDraw, log.rounds[0].events[4]);
    expect(initial.players[0].hand).toHaveLength(0);
    expect(afterDeal.players[0].hand).toHaveLength(1);
    expect(afterDraw.players[0].hand).toHaveLength(2);
    expect(afterDiscard.players[0].river).toHaveLength(1);
  });

  it('rejects applying the same event twice', () => {
    const log = sampleMatchLog();
    const state = reduceGameEvent(createInitialReplayState(log), log.rounds[0].events[0]);
    expect(() => reduceGameEvent(state, log.rounds[0].events[0])).toThrow(/Duplicate/);
  });
});
