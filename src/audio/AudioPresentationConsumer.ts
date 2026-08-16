import type { PresentationEvent } from '../presentation/PresentationEventBus';
import { PresentationEventBus, presentationEventBus } from '../presentation/PresentationEventBus';
import type { SfxId } from './audioRegistry';

export interface AudioPresentationTarget {
  playSfx(soundId: SfxId): void;
}

export class AudioPresentationConsumer {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly audio: AudioPresentationTarget,
    eventBus: PresentationEventBus = presentationEventBus,
    private readonly shouldHandleEvent: () => boolean = () => true,
  ) {
    this.unsubscribe = eventBus.subscribe(this.handleEvent);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private readonly handleEvent = (event: PresentationEvent) => {
    if (!this.shouldHandleEvent()) return;
    if (event.type === 'tile_discarded') this.audio.playSfx('discard');
  };
}
