import { presentationAudioCues, type PresentationAudioCues, type PresentationAudioCue } from '../presentation/PresentationAudioCue';
import { getPresentationFeatures } from '../config/presentationFeatures';
import type { SfxId } from './audioRegistry';

export interface AudioPresentationTarget {
  playSfx(soundId: SfxId): void;
}

export class AudioPresentationConsumer {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly audio: AudioPresentationTarget,
    cues: PresentationAudioCues = presentationAudioCues,
    private readonly shouldHandleEvent: () => boolean = () => true,
    private readonly onCue?: (cue: PresentationAudioCue, sound: SfxId | undefined, allowed: boolean) => void,
  ) {
    this.unsubscribe = cues.connect(this.handleCue);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private readonly handleCue = (cue: PresentationAudioCue) => {
    const allowed = this.shouldHandleEvent() && getPresentationFeatures().presentationEvents;
    const sound: SfxId | undefined = cue.kind === 'draw-contact' ? 'draw'
      : cue.kind === 'discard-impact' ? 'discard'
      : cue.kind === 'riichi-stick-impact' ? 'riichi'
      : cue.kind === 'dora-reveal' ? 'dora'
      : cue.kind === 'win-impact' ? 'rong'
      : cue.event.type === 'meld_declared' ? cue.event.meldType : undefined;
    try { this.onCue?.(cue, sound, allowed); } catch { /* Diagnostics cannot affect playback or pacing. */ }
    if (sound && allowed) this.audio.playSfx(sound);
  };
}
