import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../../config/presentationFeatures';
import { PresentationEventBus, presentationEventBus, type PresentationEvent } from '../PresentationEventBus';
import type { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import type { HandAnimationAction, HandAnimationController } from './HandAnimationController';

export class HandAnimationConsumer {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly controller: Pick<HandAnimationController, 'enqueue'>,
    eventBus: PresentationEventBus = presentationEventBus,
    private readonly shouldHandleEvent: () => boolean = () => true,
    private readonly featureFlagsSource: PresentationFeatureFlagsSource = getPresentationFeatures,
    private readonly mapEvent: (event: PresentationEvent) => PresentationEvent | undefined = (event) => event,
    private readonly pacingGate: Pick<PresentationPacingGate, 'begin' | 'cancel'> | null = null,
  ) {
    this.unsubscribe = eventBus.subscribe(this.handleEvent);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private readonly handleEvent = (event: PresentationEvent) => {
    if (!this.shouldHandleEvent() || !this.featureFlagsSource().handAnimations) return;
    const action = this.mapEvent(event);
    if (!isHandAnimationAction(action)) return;
    this.pacingGate?.begin(event);
    if (!this.controller.enqueue(action)) this.pacingGate?.cancel(event.eventId);
  };
}

function isHandAnimationAction(event: PresentationEvent | undefined): event is HandAnimationAction {
  return event !== undefined && event.type !== 'win_declared';
}
