import { describe, expect, it } from 'vitest';
import { applyRoundResultToMatch, startMatch } from './matchEngine';
import { exhaustiveResult, ronResult } from './testUtils';

describe('match end conditions', () => {
  it('ends on bankruptcy below threshold, but default threshold does not end at zero', () => {
    const zero = applyRoundResultToMatch(startMatch(), ronResult(1, 0, [-25000, 25000, 0, 0], 'zero'));
    expect(zero.match.phase).not.toBe('match-ended');

    const negative = applyRoundResultToMatch(startMatch(), ronResult(1, 0, [-26000, 26000, 0, 0], 'negative'));
    expect(negative.match.phase).toBe('match-ended');
    expect(negative.match.finalResult?.endedBy).toBe('bankruptcy');

    const thresholdOne = applyRoundResultToMatch(startMatch({ bankruptcyThreshold: 1 }), ronResult(1, 0, [-25000, 25000, 0, 0], 'zero-threshold'));
    expect(thresholdOne.match.finalResult?.endedBy).toBe('bankruptcy');
  });

  it('ends east-only after east 4 child win when someone reaches target', () => {
    const match = {
      ...startMatch({ matchLength: 'east-only' }),
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [29000, 25000, 25000, 21000] as [number, number, number, number],
    };
    const applied = applyRoundResultToMatch(match, ronResult(0, 3, [2000, 0, 0, -2000], 'east4'));
    expect(applied.match.phase).toBe('match-ended');
    expect(applied.match.finalResult?.endedBy).toBe('scheduled-end');
  });

  it('continues into extra rounds when nobody reaches target and extra rounds are allowed', () => {
    const match = {
      ...startMatch({ matchLength: 'hanchan', allowWestRound: true }),
      roundWind: 'south' as const,
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [28000, 26000, 24000, 22000] as [number, number, number, number],
    };
    const applied = applyRoundResultToMatch(match, ronResult(0, 3, [1000, 0, 0, -1000], 'south4-extra'));
    expect(applied.match.phase).toBe('round-active');
    expect(applied.match.roundWind).toBe('west');
    expect(applied.match.handNumber).toBe(1);
  });

  it('supports dealer agari-yame only when dealer is first and at target', () => {
    const yame = {
      ...startMatch({ agariYame: true }),
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [25000, 25000, 25000, 29000] as [number, number, number, number],
    };
    expect(applyRoundResultToMatch(yame, ronResult(3, 0, [-2000, 0, 0, 2000], 'agari-yame')).match.finalResult?.endedBy).toBe('agari-yame');

    const notFirst = { ...yame, scores: [35000, 25000, 25000, 15000] as [number, number, number, number] };
    expect(applyRoundResultToMatch(notFirst, ronResult(3, 0, [-2000, 0, 0, 2000], 'no-yame')).match.phase).not.toBe('match-ended');
  });

  it('supports tenpai-yame only when enabled', () => {
    const base = {
      ...startMatch({ tenpaiYame: true }),
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [25000, 25000, 25000, 30000] as [number, number, number, number],
    };
    expect(applyRoundResultToMatch(base, exhaustiveResult([3], [-1000, -1000, -1000, 3000], true, 'tenpai-yame')).match.finalResult?.endedBy).toBe('tenpai-yame');
    expect(applyRoundResultToMatch({ ...base, ruleConfig: { ...base.ruleConfig, tenpaiYame: false } }, exhaustiveResult([3], [-1000, -1000, -1000, 3000], true, 'tenpai-no-yame')).match.phase).not.toBe('match-ended');
  });

  it('ends extra rounds by sudden death target', () => {
    const match = {
      ...startMatch({ matchLength: 'hanchan', suddenDeathTarget: 30000 }),
      roundWind: 'west' as const,
      dealer: 1 as const,
      handNumber: 2 as const,
      scores: [29500, 25000, 25000, 20500] as [number, number, number, number],
    };
    expect(applyRoundResultToMatch(match, ronResult(0, 1, [1000, -1000, 0, 0], 'sudden')).match.finalResult?.endedBy).toBe('sudden-death');
  });
});
