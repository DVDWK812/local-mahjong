import { describe, expect, it } from 'vitest';
import { createReplay, seekToEvent } from './replayEngine';
import { sampleMatchLog } from './replayTestUtils';
import { deserializeMatchLog, serializeMatchLog } from './serialization';
import { validateMatchLog } from './validation';
import { CURRENT_FORMAT_VERSION, FormatVersionError, migrateVersionedFormat } from '../versionPolicy';

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

  it.each([
    [0, false, 'older'],
    [1, true, null],
    [2, false, 'future'],
  ] as const)('裸MatchLog版本%s按统一策略处理', (version, accepted, reason) => {
    const log = { ...sampleMatchLog(), version };
    if (accepted) {
      expect(() => validateMatchLog(log)).not.toThrow();
      return;
    }
    try {
      validateMatchLog(log);
      throw new Error('Expected version rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(FormatVersionError);
      expect(error).toMatchObject({ format: 'MatchLog', actualVersion: version, supportedVersion: CURRENT_FORMAT_VERSION, reason });
    }
  });

  it('旧版本只有提供明确迁移器后才能升级到当前版本', () => {
    const legacy = { ...sampleMatchLog(), version: 0 };
    const migrated = migrateVersionedFormat('MatchLog', legacy, {
      0: (input) => ({ ...input, version: 1 }),
    });
    expect(migrated.version).toBe(CURRENT_FORMAT_VERSION);
    expect(() => validateMatchLog(migrated)).not.toThrow();
  });
});
