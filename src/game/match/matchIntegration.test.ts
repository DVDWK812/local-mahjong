import { describe, expect, it } from 'vitest';
import { applyRoundResultToMatch, startMatch } from './matchEngine';
import { exhaustiveResult, ronResult } from './testUtils';
import type { MatchState } from './types';

describe('match integration flow', () => {
  it('runs east-only from east 1 to east 4 with one dealer repeat', () => {
    let match = startMatch({ matchLength: 'east-only', targetPoints: 26000 });
    match = applyRoundResultToMatch(match, ronResult(0, 1, [1000, -1000, 0, 0], 'east1-repeat')).match;
    expect(match.roundWind).toBe('east');
    expect(match.handNumber).toBe(1);
    match = applyRoundResultToMatch(match, ronResult(1, 0, [-1000, 1000, 0, 0], 'east1-child')).match;
    expect(match.handNumber).toBe(2);
    match = applyRoundResultToMatch(match, ronResult(2, 1, [0, -1000, 1000, 0], 'east2')).match;
    match = applyRoundResultToMatch(match, exhaustiveResult([0, 1], [1500, 1500, -1500, -1500], false, 'east3-draw')).match;
    expect(match.handNumber).toBe(4);
    match = applyRoundResultToMatch(match, ronResult(0, 3, [2000, 0, 0, -2000], 'east4-end')).match;
    expect(match.phase).toBe('match-ended');
    expect(match.finalResult).toBeDefined();
  });

  it('runs hanchan to south 4 and ends at scheduled target', () => {
    let match: MatchState = {
      ...startMatch({ matchLength: 'hanchan' }),
      roundWind: 'south' as const,
      handNumber: 4 as const,
      dealer: 3 as const,
      scores: [30000, 25000, 24000, 21000] as [number, number, number, number],
    };
    match = applyRoundResultToMatch(match, ronResult(0, 3, [1000, 0, 0, -1000], 'south4-end')).match;
    expect(match.phase).toBe('match-ended');
    expect(match.finalResult?.endedBy).toBe('scheduled-end');
  });

  it('resets per-round temporary state and inherits scores into the next round', () => {
    const applied = applyRoundResultToMatch(startMatch(), ronResult(1, 0, [-1000, 1000, 0, 0], 'reset-next'));
    const game = applied.nextGameState;
    expect(game).toBeDefined();
    expect(game?.players.map((player) => player.score)).toEqual(applied.match.scores);
    expect(game?.players.every((player) => player.river.length === 0 && player.calls.length === 0 && !player.riichi)).toBe(true);
    expect(game?.pendingCall).toBeNull();
    expect(game?.pendingKakan).toBeNull();
    expect(game?.kanState).toBeNull();
  });

  it('does not create a next game after match end', () => {
    const match = {
      ...startMatch(),
      handNumber: 4 as const,
      dealer: 3 as const,
      scores: [30000, 25000, 25000, 20000] as [number, number, number, number],
    };
    const applied = applyRoundResultToMatch(match, ronResult(0, 3, [1000, 0, 0, -1000], 'no-next'));
    expect(applied.continueMatch).toBe(false);
    expect(applied.nextGameState).toBeUndefined();
  });
});
