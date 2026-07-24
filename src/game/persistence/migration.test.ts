import { describe, expect, it } from 'vitest';
import { migrateSavedMatch } from './migration';
import { sampleSavedMatch } from './saveTestUtils';

describe('saved match migration', () => {
  it('loads current version and rejects newer or missing versions', () => {
    expect(migrateSavedMatch(sampleSavedMatch()).saveId).toBe('save-1');
    expect(() => migrateSavedMatch({ ...sampleSavedMatch(), version: 999 })).toThrow(/newer/);
    expect(() => migrateSavedMatch({ saveId: 'bad' })).toThrow(/version/);
  });
});
