import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../../config/presentationFeatures';
import { PresentationEventBus, presentationEventBus, type PresentationEvent } from '../PresentationEventBus';
import type { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import type { HandAnimationAction, HandAnimationController } from './HandAnimationController';
import { handAudioCue, presentationAudioCues } from '../PresentationAudioCue';

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
    const features = this.featureFlagsSource();
    if (!this.shouldHandleEvent() || !features.presentationEvents) return;
    if (!features.handAnimations) {
      // The authoritative visual is already committed when animation is disabled.
      // Preserve the independent SFX policy without enqueueing or a second clock.
      const cue = handAudioCue(event, event.type === 'tile_drawn' ? 'grasp' : 'release', event.type === 'tile_drawn' ? 0 : 1);
      if (cue) {
        const run = presentationAudioCues.run(event);
        run.emit(cue, 'static-settled', 1);
        run.close();
      }
      return;
    }
    const action = this.mapEvent(event);
    if (!isHandAnimationAction(action)) return;
    this.pacingGate?.begin(event);
    if (!this.controller.enqueue(action)) this.pacingGate?.cancel(event.eventId);
  };
}

function isHandAnimationAction(event: PresentationEvent | undefined): event is HandAnimationAction {
  return event?.type === 'tile_drawn' || event?.type === 'tile_discarded'
    || event?.type === 'meld_declared' || event?.type === 'riichi_declared';
}
