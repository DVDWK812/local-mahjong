import { describe, expect, it } from 'vitest';
import { calculateFinalRanking, calculateFinalScores, roundMatchScore } from './finalRanking';
import { defaultMatchRuleConfig } from './matchRules';

describe('final ranking and settlement', () => {
  it('ranks higher raw scores first', () => {
    expect(calculateFinalRanking([26000, 32000, 21000, 21000], 0).map((entry) => entry.player)).toEqual([1, 0, 2, 3]);
  });

  it('breaks ties by initial dealer order', () => {
    expect(calculateFinalRanking([25000, 25000, 25000, 25000], 2).map((entry) => entry.player)).toEqual([2, 3, 0, 1]);
  });

  it('awards leftover riichi sticks to temporary first place by default', () => {
    const result = calculateFinalScores({
      scores: [30000, 30000, 20000, 20000],
      riichiSticks: 1,
      initialDealer: 1,
      ruleConfig: defaultMatchRuleConfig,
      endedBy: 'scheduled-end',
    });
    expect(result.leftoverRiichiSticksAwardedTo).toBe(1);
    expect(result.finalScores[1]).toBe(31000);
  });

  it('can award leftover sticks to initial dealer or discard them', () => {
    expect(calculateFinalScores({
      scores: [30000, 29000, 21000, 20000],
      riichiSticks: 1,
      initialDealer: 2,
      ruleConfig: { ...defaultMatchRuleConfig, leftoverRiichiStickMode: 'initial-dealer' },
      endedBy: 'scheduled-end',
    }).finalScores[2]).toBe(22000);

    expect(calculateFinalScores({
      scores: [30000, 29000, 21000, 20000],
      riichiSticks: 1,
      initialDealer: 2,
      ruleConfig: { ...defaultMatchRuleConfig, leftoverRiichiStickMode: 'discard' },
      endedBy: 'scheduled-end',
    }).leftoverRiichiSticksAwardedTo).toBeUndefined();
  });

  it('calculates converted score, uma, and one-decimal precision without using head-bump as a placement bonus', () => {
    const result = calculateFinalScores({
      scores: [32400, 30100, 21000, 16500],
      riichiSticks: 0,
      initialDealer: 0,
      ruleConfig: { ...defaultMatchRuleConfig, useUma: true, useOka: true },
      endedBy: 'scheduled-end',
    });
    const first = result.players[0];
    expect(first.convertedScore).toBe(2.4);
    expect(first.umaAdjustment).toBe(20);
    expect(first.okaAdjustment).toBe(0);
    expect(first.finalMatchScore).toBe(22.4);
    expect(roundMatchScore(2.399999999)).toBe(2.4);
  });
});
