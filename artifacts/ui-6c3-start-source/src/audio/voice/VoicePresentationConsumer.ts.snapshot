import { PresentationEventBus, presentationEventBus, type PresentationEvent } from '../../presentation/PresentationEventBus';
import { voiceEventFromPresentation } from './voiceEvents';

export interface VoicePresentationTarget {
  play(event: NonNullable<ReturnType<typeof voiceEventFromPresentation>>): unknown;
  playWinSequence?(event: Extract<PresentationEvent, { type: 'win_scored' }>): unknown;
  playExhaustiveDrawSequence?(event: Extract<PresentationEvent, { type: 'round_settled'; settlementType: 'exhaustive-draw' }>): unknown;
  playMatchStarted?(event: Extract<PresentationEvent, { type: 'match_started' }>): unknown;
  playMatchResultSequence?(event: Extract<PresentationEvent, { type: 'match_result_finalized' }>): unknown;
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
    if (event.type === 'round_settled' && event.settlementType === 'exhaustive-draw') {
      this.director.playExhaustiveDrawSequence?.(event);
      return;
    }
    if (event.type === 'match_started') {
      this.director.playMatchStarted?.(event);
      return;
    }
    if (event.type === 'match_result_finalized') {
      this.director.playMatchResultSequence?.(event);
      return;
    }
    const voiceEvent = voiceEventFromPresentation(event);
    if (voiceEvent) this.director.play(voiceEvent);
  };
}
