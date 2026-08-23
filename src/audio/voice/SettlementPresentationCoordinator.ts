import type { PlayerId, RoundResult } from '../../game/types';
import type { WinResultPresentationController, WinResultPresentationState } from './WinResultPresentationController';

export const ROUND_RESULT_HOLD_DURATION_MS = 5000;
export const POINT_SETTLEMENT_ROW_DURATION_MS = 320;

export type SettlementPresentationPhase = 'round-result' | 'point-settlement';

/** A frozen display-only score relation; engine settlement remains authoritative. */
export interface SettlementPointRow {
  readonly playerId: PlayerId;
  readonly beforePoints: number;
  readonly delta: number;
  readonly afterPoints: number;
}

export interface SettlementPresentationState {
  readonly settlementId: string | null;
  readonly phase: SettlementPresentationPhase;
  readonly roundResultComplete: boolean;
  readonly visibleSeatCount: number;
  readonly playerIds: readonly PlayerId[];
  readonly pointRows: readonly SettlementPointRow[];
}

export interface SettlementDescriptor {
  readonly id: string;
  readonly result: RoundResult;
  readonly playerIds: readonly PlayerId[];
  /** Scores already held by GameState after the authoritative engine settlement. */
  readonly scoreAfter: readonly number[];
}

const EMPTY_STATE: SettlementPresentationState = Object.freeze({
  settlementId: null, phase: 'round-result', roundResultComplete: false, visibleSeatCount: 0, playerIds: [], pointRows: [],
});

/** Coordinates UI-only result hold and point-settlement pacing; it never changes scores or game state. */
export class SettlementPresentationCoordinator {
  private readonly listeners = new Set<() => void>();
  private state: SettlementPresentationState = EMPTY_STATE;
  private currentResult: RoundResult | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private seatTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly winPresentation: Pick<WinResultPresentationController, 'subscribe' | 'getSnapshot' | 'completeCurrentSequencePresentation'>,
    private readonly roundResultHoldMs = ROUND_RESULT_HOLD_DURATION_MS,
    private readonly pointRowDurationMs = POINT_SETTLEMENT_ROW_DURATION_MS,
  ) {
    this.unsubscribe = winPresentation.subscribe(this.handleWinPresentationChange);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot = (): SettlementPresentationState => this.state;

  begin(descriptor: SettlementDescriptor): void {
    if (this.state.settlementId === descriptor.id) return;
    this.clearTimers();
    this.currentResult = descriptor.result;
    this.state = {
      settlementId: descriptor.id,
      phase: 'round-result',
      roundResultComplete: false,
      visibleSeatCount: 0,
      playerIds: [...descriptor.playerIds],
      pointRows: Object.freeze(descriptor.playerIds.map((playerId) => {
        const afterPoints = descriptor.scoreAfter[playerId] ?? 0;
        const delta = descriptor.result.pointDeltas[playerId] ?? 0;
        return Object.freeze({ playerId, beforePoints: afterPoints - delta, delta, afterPoints });
      })),
    };
    this.publish();
    if (isWinResult(descriptor.result)) this.completeWinResultWhenReady(this.winPresentation.getSnapshot());
    else this.completeRoundResult();
  }

  reset(): void {
    this.clearTimers();
    this.currentResult = null;
    this.state = EMPTY_STATE;
    this.publish();
  }

  dispose(): void {
    this.reset();
    this.unsubscribe();
    this.listeners.clear();
  }

  /** Stage-1 Continue: finish its presentation safely, then move directly to point settlement. */
  continue(): void {
    if (!this.state.settlementId) return;
    if (this.state.phase === 'round-result' && !this.state.roundResultComplete) this.winPresentation.completeCurrentSequencePresentation();
    this.enterPointSettlement();
  }

  private readonly handleWinPresentationChange = (): void => {
    if (!this.currentResult || !isWinResult(this.currentResult) || this.state.phase !== 'round-result') return;
    this.completeWinResultWhenReady(this.winPresentation.getSnapshot());
  };

  private completeWinResultWhenReady(presentation: WinResultPresentationState): void {
    if (!this.currentResult || !isWinResult(this.currentResult)) return;
    const allWinnersComplete = this.currentResult.winners.every((winner) => (
      presentation.sequences.find((sequence) => sequence.winnerId === winner.winner)?.sequenceCompleted === true
    ));
    if (allWinnersComplete) this.completeRoundResult();
  }

  private completeRoundResult(): void {
    if (!this.state.settlementId || this.state.roundResultComplete) return;
    this.state = { ...this.state, roundResultComplete: true };
    this.publish();
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.enterPointSettlement();
    }, this.roundResultHoldMs);
  }

  private enterPointSettlement(): void {
    if (!this.state.settlementId || this.state.phase === 'point-settlement') return;
    this.clearTimers();
    this.state = { ...this.state, phase: 'point-settlement', visibleSeatCount: this.state.playerIds.length > 0 ? 1 : 0 };
    this.publish();
    this.revealNextSeat();
  }

  private revealNextSeat(): void {
    if (this.state.phase !== 'point-settlement' || this.state.visibleSeatCount >= this.state.playerIds.length) return;
    this.seatTimer = setTimeout(() => {
      this.seatTimer = null;
      this.state = { ...this.state, visibleSeatCount: this.state.visibleSeatCount + 1 };
      this.publish();
      this.revealNextSeat();
    }, this.pointRowDurationMs);
  }

  private clearTimers(): void {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    if (this.seatTimer !== null) clearTimeout(this.seatTimer);
    this.holdTimer = null;
    this.seatTimer = null;
  }

  private publish(): void { this.listeners.forEach((listener) => listener()); }
}

function isWinResult(result: RoundResult): result is Extract<RoundResult, { type: 'ron' | 'tsumo' }> {
  return result.type === 'ron' || result.type === 'tsumo';
}
