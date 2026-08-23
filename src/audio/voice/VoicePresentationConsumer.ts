import { PresentationEventBus, presentationEventBus, type PresentationEvent } from '../../presentation/PresentationEventBus';
import { voiceEventFromPresentation } from './voiceEvents';

export interface VoicePresentationTarget {
  play(event: NonNullable<ReturnType<typeof voiceEventFromPresentation>>): unknown;
  playWinSequence?(event: Extract<PresentationEvent, { type: 'win_scored' }>): unknown;
}

/** The only automatic game voice adapter; it consumes confirmed presentation events once. */
export class VoicePresentationConsumer {
  private readonly unsubscribe: () => void;
  constructor(private readonly director: VoicePresentationTarget, eventBus: PresentationEventBus = presentationEventBus, private readonly shouldHandleEvent: () => boolean = () => true) {
    this.unsubscribe = eventBus.subscribe(this.handleEvent);
  }
  dispose(): void { this.unsubscribe(); }
  private readonly handleEvent = (event: PresentationEvent) => {
    if (!this.shouldHandleEvent()) return;
    if (event.type === 'win_scored') {
      this.director.playWinSequence?.(event);
      return;
    }
    const voiceEvent = voiceEventFromPresentation(event);
    if (voiceEvent) this.director.play(voiceEvent);
  };
}
