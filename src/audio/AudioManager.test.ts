import { describe, expect, it } from 'vitest';
import type { AudioBackend, AudioPlaybackHandle } from './audioBackend';
import { AudioManager } from './AudioManager';
import type { AudioAssetDefinition, AudioAssetRegistry } from './audioRegistry';
import { DEFAULT_AUDIO_SETTINGS } from './audioSettings';

class FakeHandle implements AudioPlaybackHandle {
  playCount = 0;
  pauseCount = 0;
  disposed = false;
  volumes: number[] = [];
  rejectNextPlay = false;
  private readonly ended = new Set<() => void>();

  async play(): Promise<void> {
    this.playCount += 1;
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false;
      throw new Error('autoplay blocked');
    }
  }

  pause(): void { this.pauseCount += 1; }
  setVolume(volume: number): void { this.volumes.push(volume); }
  onEnded(listener: () => void): () => void {
    this.ended.add(listener);
    return () => this.ended.delete(listener);
  }
  finish(): void { [...this.ended].forEach((listener) => listener()); }
  dispose(): void { this.disposed = true; }
}

class FakeBackend implements AudioBackend {
  readonly handles: FakeHandle[] = [];
  disposeCount = 0;
  rejectNextPlay = false;

  createPlayback(): AudioPlaybackHandle {
    const handle = new FakeHandle();
    handle.rejectNextPlay = this.rejectNextPlay;
    this.rejectNextPlay = false;
    this.handles.push(handle);
    return handle;
  }

  dispose(): void { this.disposeCount += 1; }
}

function asset(id: string, channel: AudioAssetDefinition['channel'], loop = false): AudioAssetDefinition {
  return { id, channel, loop, src: `data:audio/wav;base64,${id}`, source: 'self-generated' };
}

const registry: AudioAssetRegistry = {
  bgm: {
    home: asset('home', 'bgm', true),
    game: asset('game', 'bgm', true),
    riichi: asset('riichi', 'bgm', true),
  },
  sfx: { discard: asset('discard', 'sfx') },
  voice: { win: asset('voice-win', 'voice') },
};

describe('AudioManager', () => {
  it('统一计算 master × channel，有效音量不会散落到组件', () => {
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, bgmVolume: 0.4 }, new FakeBackend(), registry);
    expect(manager.getEffectiveVolume('bgm')).toBeCloseTo(0.2);
    manager.setMasterVolume(0.25);
    manager.setChannelVolume('bgm', 0.8);
    expect(manager.getEffectiveVolume('bgm')).toBeCloseTo(0.2);
  });

  it('关闭通道时有效音量为 0 且不创建 SFX / Voice', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, sfxEnabled: false, voiceEnabled: false }, backend, registry);
    manager.playSfx('discard');
    manager.playVoice('win');
    expect(manager.getEffectiveVolume('sfx')).toBe(0);
    expect(manager.getEffectiveVolume('voice')).toBe(0);
    expect(backend.handles).toHaveLength(0);
  });

  it('BGM 切换先清理旧实例，同一曲目重复调用不重启', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('game');
    manager.playBgm('game');
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].playCount).toBe(1);

    manager.switchBgm('riichi');
    expect(backend.handles[0].disposed).toBe(true);
    expect(backend.handles).toHaveLength(2);
    expect(manager.getSnapshot().currentBgmId).toBe('riichi');
  });

  it('关闭 BGM 立即暂停，重新开启按原曲恢复且不新建实例', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('home');
    manager.setChannelEnabled('bgm', false);
    expect(backend.handles[0].pauseCount).toBe(1);
    expect(manager.getEffectiveVolume('bgm')).toBe(0);
    manager.setChannelEnabled('bgm', true);
    expect(backend.handles).toHaveLength(1);
    expect(backend.handles[0].playCount).toBe(2);
  });

  it('stop 清理 BGM 并归零当前曲目', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('game');
    manager.stopBgm();
    expect(backend.handles[0].disposed).toBe(true);
    expect(manager.getSnapshot().currentBgmId).toBeNull();
  });

  it('短 SFX 可重复触发、结束回收，并限制最大并发为 8', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    for (let index = 0; index < 10; index += 1) manager.playSfx('discard');
    expect(backend.handles).toHaveLength(10);
    expect(manager.getSnapshot().activeSfxCount).toBe(8);
    expect(backend.handles[0].disposed).toBe(true);
    backend.handles[9].finish();
    expect(manager.getSnapshot().activeSfxCount).toBe(7);
  });

  it('Voice 使用独立音量和并发集合', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, voiceVolume: 0.6 }, backend, registry);
    manager.playVoice('win');
    expect(backend.handles[0].volumes[backend.handles[0].volumes.length - 1]).toBeCloseTo(0.3);
    expect(manager.getSnapshot().activeVoiceCount).toBe(1);
  });

  it('捕获 autoplay play rejection，之后 resume 仍可恢复', async () => {
    const backend = new FakeBackend();
    backend.rejectNextPlay = true;
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('home');
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.getSnapshot().bgmStarted).toBe(false);
    expect(() => manager.resume()).not.toThrow();
    await Promise.resolve();
    expect(backend.handles[0].playCount).toBe(2);
    expect(manager.getSnapshot().bgmStarted).toBe(true);
  });

  it('dispose 清理 BGM、所有短音频和 backend，activate 支持 StrictMode 重挂载', () => {
    const backend = new FakeBackend();
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend, registry);
    manager.playBgm('game');
    manager.playSfx('discard');
    manager.playVoice('win');
    manager.dispose();
    expect(manager.getSnapshot()).toMatchObject({
      currentBgmId: null,
      activeSfxCount: 0,
      activeVoiceCount: 0,
      disposed: true,
    });
    expect(backend.handles.every((handle) => handle.disposed)).toBe(true);
    expect(backend.disposeCount).toBe(1);
    manager.activate();
    manager.playSfx('discard');
    expect(manager.getSnapshot().disposed).toBe(false);
    expect(manager.getSnapshot().activeSfxCount).toBe(1);
  });
});
