import { describe, expect, it } from 'vitest';
import { checkVoicePackService } from './VoicePackService';

describe('checkVoicePackService', () => {
  it('Bridge 可读取 Pack 列表时标记为 available', async () => {
    await expect(checkVoicePackService({ listPacks: async () => [] })).resolves.toBe('available');
  });

  it('Bridge 不可用时标记为 unavailable，供 UI 禁用创建确认', async () => {
    await expect(checkVoicePackService({ listPacks: async () => { throw new Error('offline'); } })).resolves.toBe('unavailable');
  });
});
