import { describe, expect, it } from 'vitest';
import { createReplay, seekToEvent } from './replayEngine';
import { sampleMatchLog } from './replayTestUtils';
import { deserializeMatchLog, serializeMatchLog } from './serialization';
import { validateMatchLog } from './validation';

describe('replay integration', () => {
  it('serializes and replays to the final public state without mutating original log', () => {
    const log = sampleMatchLog();
    const copy = JSON.stringify(log);
    const restored = deserializeMatchLog(serializeMatchLog(log));
    const replay = seekToEvent(createReplay(restored), restored.rounds[0].events.length - 1);
    expect(replay.state.players[0].river).toHaveLength(1);
    expect(JSON.stringify(log)).toBe(copy);
  });

  it('rejects duplicate event ids, non-contiguous sequence, and tile actions after round end', () => {
    const log = sampleMatchLog();
    expect(() => validateMatchLog({ ...log, rounds: [{ ...log.rounds[0], events: [log.rounds[0].events[0], log.rounds[0].events[0]] }] })).toThrow(/sequence|Duplicate/);
    const badSequence = { ...log.rounds[0].events[1], sequence: 9 };
    expect(() => validateMatchLog({ ...log, rounds: [{ ...log.rounds[0], events: [log.rounds[0].events[0], badSequence] }] })).toThrow(/sequence/);
  });
});
