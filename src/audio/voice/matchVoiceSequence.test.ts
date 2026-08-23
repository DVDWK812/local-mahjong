import { describe, expect, it } from 'vitest';
import { PresentationEventBus, type MatchResultPresentationEvent } from '../../presentation/PresentationEventBus';
import { buildMatchResultSequence } from './matchVoiceSequence';

function finalEvent(activePlayerIds: readonly (0 | 1 | 2 | 3)[]): MatchResultPresentationEvent {
  const bus = new PresentationEventBus();
  return bus.publish({
    type: 'match_result_finalized', matchId: 'match-final', activePlayerIds,
    finalResult: {
      // Input deliberately is not ranking order: the builder may only use authoritative rank.
      players: [
        { player: 2, rawScore: 26000, rank: 2, rankTieBreakOrder: 1 },
        { player: 0, rawScore: 32000, rank: 1, rankTieBreakOrder: 0 },
        { player: 3, rawScore: 18000, rank: 4, rankTieBreakOrder: 3 },
        { player: 1, rawScore: 24000, rank: 3, rankTieBreakOrder: 2 },
      ],
      finalScores: [32000, 24000, 26000, 18000], leftoverRiichiStickPoints: 0, endedBy: 'manual',
    },
  }) as MatchResultPresentationEvent;
}

describe('buildMatchResultSequence', () => {
  it('uses finalResult rank order and rank-specific keys, not current point order', () => {
    expect(buildMatchResultSequence(finalEvent([0, 1, 2, 3])).items).toEqual([
      { actorId: 0, voiceKey: 'game.end' }, { actorId: 2, voiceKey: 'result.second_place' },
      { actorId: 1, voiceKey: 'result.third_place' }, { actorId: 3, voiceKey: 'result.fourth_place' },
    ]);
  });

  it.each([
    { activePlayerIds: [0, 2] as const },
    { activePlayerIds: [0, 1, 2] as const },
  ])('only speaks actual active ranks in two and three player contexts', ({ activePlayerIds }) => {
    expect(buildMatchResultSequence(finalEvent(activePlayerIds)).items).toHaveLength(activePlayerIds.length);
  });
});
