import { presentationEventBus, type PresentationEventBus } from '../../presentation/PresentationEventBus';
import { VoiceDirector } from './VoiceDirector';
import { VoicePresentationConsumer } from './VoicePresentationConsumer';
import { WinResultPresentationController } from './WinResultPresentationController';

/**
 * Long-lived, application-level wiring for win narration and its UI stream.
 * The same VoiceDirector instance is deliberately passed to both consumers:
 * one starts audio from semantic presentation events; the other stores the
 * director's lifecycle signals for ResultDialog.
 */
export class VoicePresentationRuntime {
  readonly controller: WinResultPresentationController;
  private readonly director: VoiceDirector;
  private readonly eventBus: PresentationEventBus;
  private readonly shouldHandleEvent: () => boolean;
  private consumer: VoicePresentationConsumer | null = null;
  private starts = 0;
  private stops = 0;

  constructor(
    director: VoiceDirector,
    eventBus: PresentationEventBus = presentationEventBus,
    shouldHandleEvent: () => boolean = () => true,
  ) {
    this.director = director;
    this.eventBus = eventBus;
    this.shouldHandleEvent = shouldHandleEvent;
    // Runtime.start owns the subscription lifecycle. This prevents a StrictMode
    // cleanup from permanently disposing a ref-held controller.
    this.controller = new WinResultPresentationController(director, undefined, undefined, false);
  }

  get startCount(): number { return this.starts; }
  get stopCount(): number { return this.stops; }
  get activeVoiceConsumerSubscriptions(): number { return this.consumer ? 1 : 0; }
  get activePresentationControllerSubscriptions(): number { return this.controller.activeSubscriptionCount; }

  /** Starts exactly one event consumer and one lifecycle controller subscription. */
  start(): boolean {
    if (this.consumer) return false;
    this.controller.start();
    this.consumer = new VoicePresentationConsumer(this.director, this.eventBus, this.shouldHandleEvent);
    this.starts += 1;
    return true;
  }

  /** Reversible teardown for React StrictMode effect cleanup. */
  stop(): boolean {
    if (!this.consumer && this.controller.activeSubscriptionCount === 0) return false;
    this.consumer?.dispose();
    this.consumer = null;
    this.controller.stop();
    this.stops += 1;
    return true;
  }

  dispose(): void {
    this.stop();
    this.controller.dispose();
  }
}
