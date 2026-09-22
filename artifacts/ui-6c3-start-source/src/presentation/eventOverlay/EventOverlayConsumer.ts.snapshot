import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../../config/presentationFeatures';
import { PresentationEventBus, presentationEventBus, type PresentationEvent } from '../PresentationEventBus';
import type { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import type { EventOverlayAction, EventOverlayController } from './EventOverlayController';

export class EventOverlayConsumer {
  private readonly consumedEventIds = new Set<string>();
  private readonly initialSequence: number;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly controller: Pick<EventOverlayController, 'enqueue'>,
    private readonly pacingGate: Pick<PresentationPacingGate, 'begin' | 'cancel'>,
    private readonly eventBus: PresentationEventBus = presentationEventBus,
    private readonly enabledSource: () => boolean = () => true,
    private readonly featureFlagsSource: PresentationFeatureFlagsSource = getPresentationFeatures,
  ) {
    this.initialSequence = eventBus.latestSequence;
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.eventBus.subscribe(this.handle);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.consumedEventIds.clear();
  }

  readonly handle = (event: PresentationEvent): void => {
    if (!isEventOverlayAction(event)
      || event.sequence <= this.initialSequence
      || this.consumedEventIds.has(event.eventId)
      || !this.enabledSource()
      || !this.featureFlagsSource().presentationEvents) return;

    this.consumedEventIds.add(event.eventId);
    this.pacingGate.begin(event);
    if (!this.controller.enqueue(event)) this.pacingGate.cancel(event.eventId);
  };
}

function isEventOverlayAction(event: PresentationEvent): event is EventOverlayAction {
  return event.type === 'riichi_declared'
    || event.type === 'meld_declared'
    || event.type === 'win_declared'
    || event.type === 'round_end_announced';
}
