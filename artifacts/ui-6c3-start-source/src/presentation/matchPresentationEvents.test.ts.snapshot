import { describe, expect, it } from 'vitest';
import { startMatch } from '../game/match/matchEngine';
import type { PresentationEvent } from './PresentationEventBus';
import { PresentationEventBus } from './PresentationEventBus';
import { MatchPresentationEventObserver } from './matchPresentationEvents';

describe('MatchPresentationEventObserver', () => {
  it('publishes match_started exactly once even when a committed state is observed repeatedly', () => {
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new MatchPresentationEventObserver(bus);
    const matchState = startMatch();
    observer.observe({ matchId: 'strict-mode-match', matchState, activePlayerIds: [0, 1, 2, 3] });
    observer.observe({ matchId: 'strict-mode-match', matchState, activePlayerIds: [0, 1, 2, 3] });
    expect(events.filter((event) => event.type === 'match_started')).toHaveLength(1);
  });

  it('publishes the final MatchResult snapshot once without deriving ranks', () => {
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new MatchPresentationEventObserver(bus);
    const base = startMatch();
    const matchState = {
      ...base,
      phase: 'match-ended' as const,
      finalResult: {
        players: [
          { player: 1 as const, rawScore: 31000, rank: 1 as const, rankTieBreakOrder: 0 },
          { player: 0 as const, rawScore: 29000, rank: 2 as const, rankTieBreakOrder: 1 },
        ],
        finalScores: [29000, 31000, 0, 0] as [number, number, number, number],
        leftoverRiichiStickPoints: 0,
        endedBy: 'manual' as const,
      },
    };
    observer.observe({ matchId: 'final-match', matchState, activePlayerIds: [0, 1] });
    observer.observe({ matchId: 'final-match', matchState, activePlayerIds: [0, 1] });
    const final = events.filter((event) => event.type === 'match_result_finalized');
    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({ activePlayerIds: [0, 1], finalResult: { players: [{ player: 1, rank: 1 }, { player: 0, rank: 2 }] } });
  });
});
