import type { AudioAssetDefinition } from './audioRegistry';

export interface AudioPlaybackHandle {
  play(): Promise<void>;
  pause(): void;
  setVolume(volume: number): void;
  onEnded(listener: () => void): () => void;
  dispose(): void;
  getCurrentTime?(): number;
  getDuration?(): number;
  seek?(time: number): void;
  isPlaying?(): boolean;
  onTimeUpdate?(listener: () => void): () => void;
  onPlay?(listener: () => void): () => void;
  onPause?(listener: () => void): () => void;
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
  getCurrentTime(): number { return 0; }
  getDuration(): number { return 0; }
  seek(): void {}
  isPlaying(): boolean { return false; }
  onTimeUpdate(): () => void { return () => undefined; }
  onPlay(): () => void { return () => undefined; }
  onPause(): () => void { return () => undefined; }
}

export class NoopAudioBackend implements AudioBackend {
  createPlayback(): AudioPlaybackHandle { return new NoopAudioPlaybackHandle(); }
  dispose(): void {}
}

class BrowserAudioPlaybackHandle implements AudioPlaybackHandle {
  private readonly endedListeners = new Set<() => void>();
  private readonly timeUpdateListeners = new Set<() => void>();
  private readonly playListeners = new Set<() => void>();
  private readonly pauseListeners = new Set<() => void>();
  private disposed = false;
  private playing = false;

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly onDispose: (handle: BrowserAudioPlaybackHandle) => void,
  ) {
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
  }

  async play(): Promise<void> {
    if (this.disposed) return;
    await Promise.resolve(this.audio.play());
    this.playing = true;
  }

  pause(): void {
    if (!this.disposed) {
      this.audio.pause();
      this.playing = false;
    }
  }

  setVolume(volume: number): void {
    if (!this.disposed) this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  onTimeUpdate(listener: () => void): () => void {
    this.timeUpdateListeners.add(listener);
    return () => this.timeUpdateListeners.delete(listener);
  }

  onPlay(listener: () => void): () => void {
    this.playListeners.add(listener);
    return () => this.playListeners.delete(listener);
  }

  onPause(listener: () => void): () => void {
    this.pauseListeners.add(listener);
    return () => this.pauseListeners.delete(listener);
  }

  getCurrentTime(): number {
    return this.disposed ? 0 : this.audio.currentTime;
  }

  getDuration(): number {
    return this.disposed ? 0 : this.audio.duration;
  }

  seek(time: number): void {
    if (this.disposed || !Number.isFinite(time) || time < 0) return;
    const duration = this.audio.duration;
    if (Number.isFinite(duration) && duration > 0) {
      this.audio.currentTime = Math.min(time, duration);
    }
  }

  isPlaying(): boolean {
    return !this.disposed && this.playing && !this.audio.paused;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing = false;
    this.audio.pause();
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeAttribute('src');
    this.audio.load();
    this.endedListeners.clear();
    this.timeUpdateListeners.clear();
    this.playListeners.clear();
    this.pauseListeners.clear();
    this.onDispose(this);
  }

  private readonly handleEnded = () => {
    this.playing = false;
    [...this.endedListeners].forEach((listener) => listener());
  };

  private readonly handleTimeUpdate = () => {
    if (this.disposed) return;
    [...this.timeUpdateListeners].forEach((listener) => listener());
  };

  private readonly handlePlay = () => {
    if (this.disposed) return;
    this.playing = true;
    [...this.playListeners].forEach((listener) => listener());
  };

  private readonly handlePause = () => {
    if (this.disposed) return;
    this.playing = false;
    [...this.pauseListeners].forEach((listener) => listener());
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
