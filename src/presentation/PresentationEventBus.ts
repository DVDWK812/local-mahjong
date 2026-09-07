import type { AbortiveDrawReason, PlayerId, TileId } from '../game/types';
import type { LimitTier } from '../game/score/pointCalculator';
import type { YakuhaiSource, YakuId } from '../game/score/yaku/types';
import type { MatchResult } from '../game/match/types';
import type { HandDiscardHistory } from './handAnimation/HandPresentationSnapshot';

export interface PresentationTile {
  readonly id: TileId;
  readonly red: boolean;
}

export interface TileDiscardedPresentationEvent {
  readonly handHistory?: HandDiscardHistory;
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'tile_discarded';
  readonly playerId: PlayerId;
  readonly tile: PresentationTile;
  readonly riverIndex: number;
  readonly isRiichiDiscard: boolean;
}

export interface TileDrawnPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'tile_drawn';
  readonly playerId: PlayerId;
}

export interface RiichiDeclaredPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'riichi_declared';
  readonly playerId: PlayerId;
  readonly riverIndex: number;
  /** Optional for compatibility with older presentation payloads; live observer always supplies it. */
  readonly kind?: 'riichi' | 'double-riichi';
}

export interface MeldDeclaredPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'meld_declared';
  readonly playerId: PlayerId;
  readonly meldType: 'chi' | 'pon' | 'kan';
  /** Present only for a confirmed kan; retained from the authoritative CallSet. */
  readonly kanType?: 'minkan' | 'ankan' | 'kakan';
}

export interface WinDeclaredPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'win_declared';
  readonly playerId: PlayerId;
  readonly winType: 'ron' | 'tsumo';
  /** Links Ron to the already-confirmed discard without duplicating tile or river data. */
  readonly sourceEventId?: string;
}

/** Structured scoring semantics; names intentionally remain outside this event contract. */
export interface ScoredYakuPresentationEntry {
  readonly id: YakuId;
  readonly sourceTile?: YakuhaiSource;
  /** Actual awarded han for this winning result. */
  readonly han: number;
  readonly yakuman: boolean;
}

export interface WinScoredPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'win_scored';
  readonly winnerId: PlayerId;
  readonly winType: 'ron' | 'tsumo';
  readonly yakuIds: readonly YakuId[];
  readonly yaku: readonly ScoredYakuPresentationEntry[];
  readonly limitTier: LimitTier;
  readonly yakumanMultiplier: number;
  readonly totalDora: number;
}

export type VoiceAbortiveDrawReason = Extract<
  AbortiveDrawReason,
  'suufon-renda' | 'suukan-sanra' | 'suucha-riichi' | 'kyuushu-kyuuhai'
>;

interface RoundSettledPresentationEventBase {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'round_settled';
}

/** A completed round outcome that is eligible for the current voice catalogue. */
export type RoundSettledPresentationEvent =
  | (RoundSettledPresentationEventBase & {
      readonly settlementType: 'exhaustive-draw';
      /** Stable player-slot order captured from the settled game state. */
      readonly activePlayerIds: readonly PlayerId[];
      /** Authoritative exhaustive-draw result lists; never inferred by the UI. */
      readonly tenpaiPlayers: readonly PlayerId[];
      readonly notenPlayers: readonly PlayerId[];
    })
  | (RoundSettledPresentationEventBase & {
      readonly settlementType: 'abortive-draw';
      readonly reason: VoiceAbortiveDrawReason;
  /** The player who declared or triggered an abortive draw; absent for exhaustive draws. */
      readonly triggeringPlayerId?: PlayerId;
    });

/** Minimal visual-only round-end semantic, deliberately independent of voice catalogue coverage. */
export type RoundEndAnnouncedPresentationEvent =
  | {
      readonly eventId: string;
      readonly sequence: number;
      readonly type: 'round_end_announced';
      readonly settlementType: 'exhaustive-draw';
    }
  | {
      readonly eventId: string;
      readonly sequence: number;
      readonly type: 'round_end_announced';
      readonly settlementType: 'abortive-draw';
      readonly reason: AbortiveDrawReason;
    };

export interface MatchStartedPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'match_started';
  readonly matchId: string;
  /** Stable active player-slot order for this match. */
  readonly activePlayerIds: readonly PlayerId[];
}

export interface MatchResultPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'match_result_finalized';
  readonly matchId: string;
  /** Complete authoritative final result. Consumers must not recalculate ranks from points. */
  readonly finalResult: MatchResult;
  readonly activePlayerIds: readonly PlayerId[];
}

export type PresentationEvent = TileDiscardedPresentationEvent | TileDrawnPresentationEvent | RiichiDeclaredPresentationEvent | MeldDeclaredPresentationEvent | WinDeclaredPresentationEvent | WinScoredPresentationEvent | RoundSettledPresentationEvent | RoundEndAnnouncedPresentationEvent | MatchStartedPresentationEvent | MatchResultPresentationEvent;
type WithoutPresentationMetadata<T> = T extends PresentationEvent ? Omit<T, 'eventId' | 'sequence'> : never;
export type PresentationEventInput = WithoutPresentationMetadata<PresentationEvent>;
export type PresentationEventListener = (event: PresentationEvent) => void;
export type PresentationEventListenerErrorHandler = (error: unknown, event: PresentationEvent) => void;

let fallbackEventId = 0;

function createEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `presentation-${globalThis.crypto.randomUUID()}`;
  }
  fallbackEventId += 1;
  return `presentation-${Date.now().toString(36)}-${fallbackEventId.toString(36)}`;
}

export class PresentationEventBus {
  private readonly listeners = new Set<PresentationEventListener>();
  private sequence = 0;

  constructor(private readonly onListenerError?: PresentationEventListenerErrorHandler) {}

  get latestSequence(): number {
    return this.sequence;
  }

  subscribe(listener: PresentationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: PresentationEventListener): void {
    this.listeners.delete(listener);
  }

  publish(input: PresentationEventInput): PresentationEvent {
    this.sequence += 1;
    const event = Object.freeze(input.type === 'tile_discarded'
      ? {
          ...input,
          tile: Object.freeze({ ...input.tile }),
          eventId: createEventId(),
          sequence: this.sequence,
        }
      : input.type === 'round_settled' && input.settlementType === 'exhaustive-draw'
        ? {
          ...input,
          activePlayerIds: Object.freeze([...input.activePlayerIds]),
          tenpaiPlayers: Object.freeze([...input.tenpaiPlayers]),
          notenPlayers: Object.freeze([...input.notenPlayers]),
          eventId: createEventId(),
          sequence: this.sequence,
        }
        : input.type === 'match_started'
          ? {
            ...input,
            activePlayerIds: Object.freeze([...input.activePlayerIds]),
            eventId: createEventId(),
            sequence: this.sequence,
          }
          : input.type === 'match_result_finalized'
            ? {
              ...input,
              activePlayerIds: Object.freeze([...input.activePlayerIds]),
              finalResult: Object.freeze({
                ...input.finalResult,
                players: Object.freeze(input.finalResult.players.map((player) => Object.freeze({ ...player }))),
                finalScores: Object.freeze([...input.finalResult.finalScores]) as MatchResult['finalScores'],
              }),
              eventId: createEventId(),
              sequence: this.sequence,
            }
      : {
          ...input,
          eventId: createEventId(),
          sequence: this.sequence,
        }) as PresentationEvent;

    [...this.listeners].forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        try {
          this.onListenerError?.(error, event);
        } catch {
          // Error reporting is presentation-only and must not escape into game flow.
        }
      }
    });

    return event;
  }
}

export const presentationEventBus = new PresentationEventBus();
