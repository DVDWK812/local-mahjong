import { describe, expect, it } from 'vitest';
import { checkVoicePackService, LocalVoicePackService } from './VoicePackService';

describe('checkVoicePackService', () => {
  it('Bridge 可读取 Pack 列表时标记为 available', async () => {
    await expect(checkVoicePackService({ listPacks: async () => [] })).resolves.toBe('available');
  });

  it('Bridge 不可用时标记为 unavailable，供 UI 禁用创建确认', async () => {
    await expect(checkVoicePackService({ listPacks: async () => { throw new Error('offline'); } })).resolves.toBe('unavailable');
  });

  it('保留 Bridge 返回的完整模型能力快照，使 UI 与 generation resolver 使用同一份 controls', async () => {
    const originalFetch = globalThis.fetch;
    const controls = { speed: true, volume: true, pitch: false, stability: true, similarity: true, language: true, textNormalization: true, emotion: false, instruction: false };
    globalThis.fetch = async () => new Response(JSON.stringify({ pack: {
      meta: { id: 'capable', name: '可控角色', locale: 'zh-CN', voiceId: 'voice', modelId: 'model', ttsControls: controls },
      manifest: { character: 'capable', voiceId: 'voice', voices: {} }, voiceLines: [], voiceAvailability: {}, generationCache: {}, failedKeys: [], synthesis: { speed: 1, format: 'mp3' },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    try {
      await expect(new LocalVoicePackService().getPack('capable')).resolves.toMatchObject({ meta: { ttsControls: controls } });
    } finally { globalThis.fetch = originalFetch; }
  });
});
