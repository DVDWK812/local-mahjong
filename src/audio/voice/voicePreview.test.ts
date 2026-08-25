import { describe, expect, it, vi } from 'vitest';
import { VoicePreviewController, type VoicePreviewAudio } from './voicePreview';

function audioFixture(play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)): VoicePreviewAudio & { readonly pause: ReturnType<typeof vi.fn>; readonly removeAttribute: ReturnType<typeof vi.fn>; readonly load: ReturnType<typeof vi.fn> } {
  return { volume: 0, currentTime: 5, src: '/voice.mp3', onended: null, onerror: null, play, pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
}

describe('Voice preview controller', () => {
  it('第二条试听会停止第一条，并只播放最新项目', () => {
    const first = audioFixture(); const second = audioFixture();
    const factory = vi.fn((url: string) => url === '/first.mp3' ? first : second);
    const states = vi.fn(); const controller = new VoicePreviewController(factory, states);
    controller.playOrStop('action.riichi', '/first.mp3', 0.8);
    controller.playOrStop('action.ron', '/second.mp3', 0.8);
    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.currentTime).toBe(0);
    expect(second.play).toHaveBeenCalledOnce();
    expect(states).toHaveBeenLastCalledWith('action.ron', null);
  });

  it('音量立即同步到正在试听的单个音频，关闭时停止并清理', () => {
    const audio = audioFixture(); const controller = new VoicePreviewController(() => audio, vi.fn());
    controller.playOrStop('action.riichi', '/voice.mp3', 0.8);
    controller.setVolume(0.35);
    controller.dispose();
    expect(audio.volume).toBe(0.35);
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.onended).toBeNull();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.src).toBe('');
    expect(audio.load).toHaveBeenCalledOnce();
  });

  it('浏览器播放失败仅反馈短暂错误，不抛出异常', async () => {
    const audio = audioFixture(vi.fn<() => Promise<void>>().mockRejectedValue(new Error('blocked')));
    const states = vi.fn(); const controller = new VoicePreviewController(() => audio, states);
    controller.playOrStop('action.riichi', '/voice.mp3', 0.8);
    await Promise.resolve();
    expect(states).toHaveBeenLastCalledWith(null, '播放失败');
  });
});
