import type { PresentationEvent, PresentationEventBus, TileDiscardedPresentationEvent } from '../PresentationEventBus';
import type { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import type { WinPresentationController } from './WinPresentationController';

export type WinPresentationEnabledSource = () => boolean;

export class WinPresentationConsumer {
  private readonly discardEvents = new Map<string, TileDiscardedPresentationEvent>();
  private readonly consumed = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly eventBus: PresentationEventBus,
    private readonly controller: WinPresentationController,
    private readonly pacingGate: PresentationPacingGate,
    private readonly enabledSource: WinPresentationEnabledSource = () => true,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.eventBus.subscribe((event) => this.handle(event));
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.discardEvents.clear();
    this.consumed.clear();
  }

  private handle(event: PresentationEvent): void {
    if (event.type === 'tile_discarded') {
      this.discardEvents.set(event.eventId, event);
      while (this.discardEvents.size > 24) {
        const oldest = this.discardEvents.keys().next().value as string | undefined;
        if (!oldest) break;
        this.discardEvents.delete(oldest);
      }
      return;
    }
    if (event.type !== 'win_declared' || !this.enabledSource() || this.consumed.has(event.eventId)) return;

    this.consumed.add(event.eventId);
    this.pacingGate.begin(event);
    const enqueued = this.controller.enqueue({
      ...event,
      ...(event.sourceEventId ? { sourceDiscard: this.discardEvents.get(event.sourceEventId) } : {}),
    });
    if (!enqueued) this.pacingGate.cancel(event.eventId);
  }
}
