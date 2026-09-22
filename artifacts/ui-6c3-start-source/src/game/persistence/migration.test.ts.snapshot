import { describe, expect, it } from 'vitest';
import { migrateSavedMatch } from './migration';
import { sampleSavedMatch } from './saveTestUtils';

describe('saved match migration', () => {
  it('loads current version and rejects newer or missing versions', () => {
    expect(migrateSavedMatch(sampleSavedMatch()).saveId).toBe('save-1');
    expect(() => migrateSavedMatch({ ...sampleSavedMatch(), version: 999 })).toThrow(/newer/);
    expect(() => migrateSavedMatch({ saveId: 'bad' })).toThrow(/version/);
  });

  it('migrates legacy roundCount and initializes series progress fields', () => {
    const legacy = sampleSavedMatch() as any;
    delete legacy.ruleConfig.match.matchCount;
    legacy.ruleConfig.match.roundCount = 3;
    delete legacy.matchState.ruleConfig.matchCount;
    legacy.matchState.ruleConfig.roundCount = 3;
    delete legacy.matchState.currentMatchIndex;
    delete legacy.matchState.matchResults;
    delete legacy.matchState.aggregateScores;
    const migrated = migrateSavedMatch(legacy);
    expect(migrated.ruleConfig.match.matchCount).toBe(3);
    expect(migrated.matchState.ruleConfig.matchCount).toBe(3);
    expect(migrated.matchState.currentMatchIndex).toBe(0);
    expect(migrated.matchState.matchResults).toEqual([]);
    expect(migrated.matchState.aggregateScores).toEqual([0, 0, 0, 0]);
  });

  it('旧存档缺少三家和字段时迁移为开启', () => {
    const legacy = sampleSavedMatch() as any;
    delete legacy.ruleConfig.round.tripleRonMode;
    delete legacy.matchLog.ruleConfig.round.tripleRonMode;
    const migrated = migrateSavedMatch(legacy);
    expect(migrated.ruleConfig.round.tripleRonMode).toBe('allow');
    expect(migrated.matchLog.ruleConfig.round.tripleRonMode).toBe('allow');
  });
});
