import { useEffect, useRef } from 'react';
import type { MatchState } from '../game/match/types';
import type { PlayerId } from '../game/types';
import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../config/presentationFeatures';
import { PresentationEventBus, presentationEventBus } from './PresentationEventBus';

export interface MatchPresentationSnapshot {
  readonly matchId: string;
  readonly matchState: MatchState;
  /** Player IDs in the match's stable seat order, not a rank order. */
  readonly activePlayerIds: readonly PlayerId[];
}

/**
 * Publishes match-level facts exactly once per match id. It observes the MatchState
 * transition; it neither calculates results nor performs any audio work itself.
 */
export class MatchPresentationEventObserver {
  private readonly startedMatchIds = new Set<string>();
  private readonly finalizedMatchIds = new Set<string>();

  constructor(
    private readonly eventBus: PresentationEventBus = presentationEventBus,
    private readonly featureFlagsSource: PresentationFeatureFlagsSource = getPresentationFeatures,
  ) {}

  observe(snapshot: MatchPresentationSnapshot | undefined): void {
    if (!snapshot || !this.featureFlagsSource().presentationEvents) return;
    const { matchId, matchState, activePlayerIds } = snapshot;
    if (matchState.phase !== 'not-started' && !this.startedMatchIds.has(matchId)) {
      this.startedMatchIds.add(matchId);
      this.eventBus.publish({ type: 'match_started', matchId, activePlayerIds });
    }
    if (matchState.phase === 'match-ended' && matchState.finalResult && !this.finalizedMatchIds.has(matchId)) {
      this.finalizedMatchIds.add(matchId);
      this.eventBus.publish({
        type: 'match_result_finalized',
        matchId,
        finalResult: matchState.finalResult,
        activePlayerIds,
      });
    }
  }
}

/** React only observes committed authoritative state; playback remains in VoicePresentationConsumer. */
export function useMatchPresentationEvents(snapshot: MatchPresentationSnapshot | undefined): void {
  const observerRef = useRef<MatchPresentationEventObserver | null>(null);
  if (!observerRef.current) observerRef.current = new MatchPresentationEventObserver();
  useEffect(() => {
    observerRef.current?.observe(snapshot);
  }, [snapshot]);
}
