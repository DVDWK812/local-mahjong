import { describe, expect, it } from 'vitest';
import { applyFinishedGameToMatch, applyRoundResultToMatch, createGameStateFromMatch, createMatch, startMatch, validateMatchState } from './matchEngine';
import { abortiveResult, exhaustiveResult, ronResult, tsumoResult } from './testUtils';

describe('match initialization', () => {
  it('creates an east-only match from east 1 with configured dealer and points', () => {
    const match = createMatch({ initialDealer: 2, startingPoints: 27000 });
    expect(match.scores).toEqual([27000, 27000, 27000, 27000]);
    expect(match.initialDealer).toBe(2);
    expect(match.dealer).toBe(2);
    expect(match.roundWind).toBe('east');
    expect(match.handNumber).toBe(1);
    expect(match.honba).toBe(0);
    expect(match.riichiSticks).toBe(0);
    expect(match.currentMatchIndex).toBe(0);
    expect(match.matchResults).toEqual([]);
    expect(match.aggregateScores).toEqual([0, 0, 0, 0]);
  });

  it('starts a round with dynamic seat winds and dealer 14 tiles', () => {
    const match = startMatch({ initialDealer: 2 });
    expect(match.phase).toBe('round-active');
    expect(match.currentGame?.dealer).toBe(2);
    expect(match.currentGame?.currentPlayer).toBe(2);
    expect(match.currentGame?.players[2].seatWind).toBe('east');
    expect(match.currentGame?.players[3].seatWind).toBe('south');
    expect(match.currentGame?.players[2].hand).toHaveLength(14);
  });

  it('validates basic match invariants', () => {
    expect(validateMatchState(startMatch())).toEqual([]);
  });

  it('creates a compatible GameState from match scores, honba, and sticks', () => {
    const match = { ...createMatch(), scores: [26000, 24000, 25000, 25000] as [number, number, number, number], honba: 2, riichiSticks: 1 };
    const game = createGameStateFromMatch(match);
    expect(game.players.map((player) => player.score)).toEqual([26000, 24000, 25000, 25000]);
    expect(game.honba).toBe(2);
    expect(game.riichiSticks).toBe(1);
    expect(game.pendingCall).toBeNull();
    expect(game.pendingKakan).toBeNull();
  });
});

describe('multi-match series', () => {
  it('records each complete match, resets the table, and aggregates match scores', () => {
    let match = {
      ...startMatch({ matchLength: 'east-only', matchCount: 2, allowWestRound: false, maxExtraRoundWind: 'none' }),
      handNumber: 4 as const,
      dealer: 3 as const,
      scores: [30000, 25000, 25000, 20000] as [number, number, number, number],
    };
    const first = applyRoundResultToMatch(match, ronResult(0, 3, [1000, 0, 0, -1000], 'series-1'));
    expect(first.continueMatch).toBe(true);
    expect(first.match.phase).toBe('round-active');
    expect(first.match.currentMatchIndex).toBe(1);
    expect(first.match.matchResults).toHaveLength(1);
    expect(first.match.aggregateScores).toEqual([6, 0, 0, -6]);
    expect(first.match.scores).toEqual([25000, 25000, 25000, 25000]);
    expect(first.match.roundWind).toBe('east');
    expect(first.match.handNumber).toBe(1);
    expect(first.match.honba).toBe(0);
    expect(first.match.riichiSticks).toBe(0);

    match = {
      ...first.match,
      handNumber: 4,
      dealer: 3,
      scores: [25000, 25000, 25000, 25000],
    };
    const second = applyRoundResultToMatch(match, ronResult(0, 3, [1000, 0, 0, -1000], 'series-2'));
    expect(second.continueMatch).toBe(false);
    expect(second.match.phase).toBe('match-ended');
    expect(second.match.matchResults).toHaveLength(2);
    expect(second.match.aggregateScores).toEqual([7, 0, 0, -7]);
  });
});

describe('round result application', () => {
  it('keeps dealer, hand number, and increases honba after dealer ron', () => {
    const match = startMatch({ initialDealer: 0 });
    const applied = applyRoundResultToMatch(match, ronResult(0, 1, [3900, -3900, 0, 0]));
    expect(applied.continueMatch).toBe(true);
    expect(applied.match.dealer).toBe(0);
    expect(applied.match.handNumber).toBe(1);
    expect(applied.match.honba).toBe(1);
    expect(applied.match.scores).toEqual([28900, 21100, 25000, 25000]);
  });

  it('keeps dealer after dealer tsumo', () => {
    const applied = applyRoundResultToMatch(startMatch({ initialDealer: 0 }), tsumoResult(0, [3000, -1000, -1000, -1000]));
    expect(applied.match.dealer).toBe(0);
    expect(applied.match.handNumber).toBe(1);
    expect(applied.match.honba).toBe(1);
  });

  it('advances from east 1 to east 2 and resets honba after child win', () => {
    const applied = applyRoundResultToMatch(startMatch({ initialDealer: 0 }), ronResult(1, 0, [-3900, 3900, 0, 0]));
    expect(applied.match.dealer).toBe(1);
    expect(applied.match.roundWind).toBe('east');
    expect(applied.match.handNumber).toBe(2);
    expect(applied.match.honba).toBe(0);
  });

  it('continues dealer on exhaustive draw when dealer is tenpai and advances when dealer is noten', () => {
    const tenpai = applyRoundResultToMatch(startMatch({ initialDealer: 0 }), exhaustiveResult([0, 1], [1500, 1500, -1500, -1500], true));
    expect(tenpai.match.dealer).toBe(0);
    expect(tenpai.match.handNumber).toBe(1);
    expect(tenpai.match.honba).toBe(1);

    const noten = applyRoundResultToMatch(startMatch({ initialDealer: 0 }), exhaustiveResult([1, 2], [-1500, 1500, 1500, -1500], false, 'draw-noten'));
    expect(noten.match.dealer).toBe(1);
    expect(noten.match.handNumber).toBe(2);
    expect(noten.match.honba).toBe(1);
  });

  it('special abortive draws keep dealer, increase honba, and keep sticks', () => {
    const match = { ...startMatch(), riichiSticks: 2 };
    const applied = applyRoundResultToMatch(match, abortiveResult('suufon-renda'));
    expect(applied.match.dealer).toBe(0);
    expect(applied.match.handNumber).toBe(1);
    expect(applied.match.honba).toBe(1);
    expect(applied.match.riichiSticks).toBe(2);
  });

  it('does not apply the same round result twice', () => {
    const match = startMatch();
    const result = ronResult(1, 0, [-3900, 3900, 0, 0], 'same-round');
    const once = applyRoundResultToMatch(match, result).match;
    const twice = applyRoundResultToMatch(once, result).match;
    expect(twice.scores).toEqual(once.scores);
    expect(twice.completedHands).toBe(once.completedHands);
  });

  it('can apply a finished GameState so in-round riichi payments are inherited once', () => {
    const match = startMatch();
    const game = {
      ...match.currentGame!,
      riichiSticks: 1,
      players: match.currentGame!.players.map((player) => player.id === 0 ? { ...player, score: 24000 } : player),
      result: exhaustiveResult([], [0, 0, 0, 0], false, 'riichi-carry'),
    };
    const applied = applyFinishedGameToMatch(match, game);
    expect(applied.match.scores[0]).toBe(24000);
    expect(applied.match.riichiSticks).toBe(1);
  });
});
