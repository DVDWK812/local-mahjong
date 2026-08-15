import type { PlayerId, TileId } from '../game/types';

export interface PresentationTile {
  readonly id: TileId;
  readonly red: boolean;
}

export interface TileDiscardedPresentationEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: 'tile_discarded';
  readonly playerId: PlayerId;
  readonly tile: PresentationTile;
  readonly riverIndex: number;
  readonly isRiichiDiscard: boolean;
}

export type PresentationEvent = TileDiscardedPresentationEvent;
export type PresentationEventInput = Omit<PresentationEvent, 'eventId' | 'sequence'>;
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

  subscribe(listener: PresentationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: PresentationEventListener): void {
    this.listeners.delete(listener);
  }

  publish(input: PresentationEventInput): PresentationEvent {
    this.sequence += 1;
    const event = Object.freeze({
      ...input,
      tile: Object.freeze({ ...input.tile }),
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
