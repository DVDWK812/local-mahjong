import type { AudioAssetDefinition } from './audioRegistry';

export interface AudioPlaybackHandle {
  play(): Promise<void>;
  pause(): void;
  setVolume(volume: number): void;
  onEnded(listener: () => void): () => void;
  dispose(): void;
}

export interface AudioBackend {
  createPlayback(asset: AudioAssetDefinition): AudioPlaybackHandle;
  dispose(): void;
}

class NoopAudioPlaybackHandle implements AudioPlaybackHandle {
  async play(): Promise<void> {}
  pause(): void {}
  setVolume(): void {}
  onEnded(): () => void { return () => undefined; }
  dispose(): void {}
}

export class NoopAudioBackend implements AudioBackend {
  createPlayback(): AudioPlaybackHandle { return new NoopAudioPlaybackHandle(); }
  dispose(): void {}
}

class BrowserAudioPlaybackHandle implements AudioPlaybackHandle {
  private readonly endedListeners = new Set<() => void>();
  private disposed = false;

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly onDispose: (handle: BrowserAudioPlaybackHandle) => void,
  ) {
    this.audio.addEventListener('ended', this.handleEnded);
  }

  async play(): Promise<void> {
    if (this.disposed) return;
    await Promise.resolve(this.audio.play());
  }

  pause(): void {
    if (!this.disposed) this.audio.pause();
  }

  setVolume(volume: number): void {
    if (!this.disposed) this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.pause();
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeAttribute('src');
    this.audio.load();
    this.endedListeners.clear();
    this.onDispose(this);
  }

  private readonly handleEnded = () => {
    [...this.endedListeners].forEach((listener) => listener());
  };
}

export class BrowserAudioBackend implements AudioBackend {
  private readonly handles = new Set<BrowserAudioPlaybackHandle>();

  createPlayback(asset: AudioAssetDefinition): AudioPlaybackHandle {
    const audio = new Audio(asset.src);
    audio.loop = asset.loop;
    audio.preload = 'auto';
    const handle = new BrowserAudioPlaybackHandle(audio, (disposed) => this.handles.delete(disposed));
    this.handles.add(handle);
    return handle;
  }

  dispose(): void {
    [...this.handles].forEach((handle) => handle.dispose());
    this.handles.clear();
  }
}

export function createDefaultAudioBackend(): AudioBackend {
  return typeof Audio === 'undefined' ? new NoopAudioBackend() : new BrowserAudioBackend();
}
