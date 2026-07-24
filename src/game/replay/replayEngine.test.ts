import { describe, expect, it } from 'vitest';
import { createReplay, pause, play, seekToEvent, setPlaybackSpeed, stepBackward, stepForward } from './replayEngine';
import { sampleMatchLog } from './replayTestUtils';

describe('replayEngine', () => {
  it('steps forward, backward, and seeks deterministically', () => {
    const replay = createReplay(sampleMatchLog());
    const one = stepForward(replay);
    const two = stepForward(one);
    expect(two.controller.currentEventIndex).toBe(1);
    expect(stepBackward(two).controller.currentEventIndex).toBe(0);
    expect(seekToEvent(two, 4).state.players[0].river).toHaveLength(1);
  });

  it('playback status and speed do not alter replay state', () => {
    const replay = createReplay(sampleMatchLog());
    const playing = play(replay);
    const fast = setPlaybackSpeed(playing, 4);
    expect(fast.controller.status).toBe('playing');
    expect(fast.controller.speed).toBe(4);
    expect(pause(fast).controller.status).toBe('paused');
    expect(replay.state.players[0].hand).toHaveLength(0);
  });
});
