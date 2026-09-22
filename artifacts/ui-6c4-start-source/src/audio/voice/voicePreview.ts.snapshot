export interface VoicePreviewAudio {
  volume: number;
  currentTime: number;
  onended: ((event: Event) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  src?: string;
  removeAttribute?(qualifiedName: string): void;
  load?(): void;
  play(): Promise<void> | void;
  pause(): void;
}

export type VoicePreviewAudioFactory = (url: string) => VoicePreviewAudio;

/** Keeps preview audio separate from the game audio channels used by later phases. */
export class VoicePreviewController {
  private audio: VoicePreviewAudio | null = null;
  private currentKey: string | null = null;

  public constructor(
    private readonly createAudio: VoicePreviewAudioFactory,
    private readonly onStateChange: (key: string | null, error: string | null) => void,
  ) {}

  public playOrStop(key: string, url: string, volume: number): void {
    if (this.currentKey === key) {
      this.stop();
      return;
    }
    this.stop();
    const audio = this.createAudio(url);
    audio.volume = volume;
    audio.onended = () => this.finish(audio, null);
    audio.onerror = () => this.finish(audio, '播放失败');
    this.audio = audio;
    this.currentKey = key;
    this.onStateChange(key, null);
    Promise.resolve(audio.play()).catch(() => this.finish(audio, '播放失败'));
  }

  public setVolume(volume: number): void {
    if (this.audio) this.audio.volume = volume;
  }

  public stop(): void {
    const audio = this.audio;
    this.audio = null;
    this.currentKey = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      // Explicitly detach the source after pausing. This releases the Windows
      // file handle before a local Pack directory is renamed or removed.
      audio.removeAttribute?.('src');
      if ('src' in audio) audio.src = '';
      audio.load?.();
    }
    this.onStateChange(null, null);
  }

  public dispose(): void {
    this.stop();
  }

  private finish(audio: VoicePreviewAudio, error: string | null): void {
    if (this.audio !== audio) return;
    this.audio = null;
    this.currentKey = null;
    this.onStateChange(null, error);
  }
}
