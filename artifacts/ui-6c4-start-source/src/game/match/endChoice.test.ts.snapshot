import { describe, expect, it } from 'vitest';
import { applyRoundResultToMatch, chooseAgariYame, chooseMatchEnd, startMatch } from './matchEngine';
import { exhaustiveResult, ronResult } from './testUtils';

describe('match end choice flow', () => {
  it('automatic agari-yame still ends immediately', () => {
    const match = {
      ...startMatch({ agariYameMode: 'automatic' }),
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [25000, 25000, 25000, 29000] as [number, number, number, number],
    };
    expect(applyRoundResultToMatch(match, ronResult(3, 0, [-2000, 0, 0, 2000], 'auto-agari')).match.phase).toBe('match-ended');
  });

  it('player-choice agari-yame waits for a decision', () => {
    const match = {
      ...startMatch({ agariYameMode: 'player-choice' }),
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [25000, 25000, 25000, 29000] as [number, number, number, number],
    };
    const applied = applyRoundResultToMatch(match, ronResult(3, 0, [-2000, 0, 0, 2000], 'choice-agari')).match;
    expect(applied.phase).toBe('match-end-choice');
    expect(applied.pendingEndChoice?.type).toBe('agari-yame');
    expect(chooseMatchEnd(applied, true).match.phase).toBe('match-ended');
    const continued = chooseMatchEnd(applied, false);
    expect(continued.match.phase).toBe('round-active');
    expect(continued.nextGameState).toBeDefined();
  });

  it('player-choice tenpai-yame waits and duplicate click is ignored after handling', () => {
    const match = {
      ...startMatch({ tenpaiYame: true, tenpaiYameMode: 'player-choice' }),
      dealer: 3 as const,
      handNumber: 4 as const,
      scores: [25000, 25000, 25000, 30000] as [number, number, number, number],
    };
    const pending = applyRoundResultToMatch(match, exhaustiveResult([3], [-1000, -1000, -1000, 3000], true, 'choice-tenpai')).match;
    expect(pending.phase).toBe('match-end-choice');
    const ended = chooseMatchEnd(pending, true).match;
    expect(ended.finalResult?.endedBy).toBe('tenpai-yame');
    expect(chooseMatchEnd(ended, true).match).toBe(ended);
  });

  it('AI yame strategy ends when dealer leads second place by at least 1000', () => {
    const pending = {
      ...startMatch(),
      phase: 'match-end-choice' as const,
      dealer: 2 as const,
      scores: [29000, 29000, 31000, 11000] as [number, number, number, number],
      pendingEndChoice: { type: 'agari-yame' as const, dealer: 2 as const, canEnd: true, canContinue: true, sourceRoundId: 'x' },
    };
    expect(chooseAgariYame(pending)).toBe(true);
  });
});
