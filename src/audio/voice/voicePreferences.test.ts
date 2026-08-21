import { describe, expect, it } from 'vitest';
import { resolveSelectedVoicePackId } from './voicePreferences';

const packs = [
  { id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' },
  { id: 'robot', name: '机器人', locale: 'zh-CN', path: 'robot' },
] as const;

describe('Voice Pack preference', () => {
  it('保留已保存的有效角色，并在刷新后可恢复', () => {
    expect(resolveSelectedVoicePackId('robot', packs)).toBe('robot');
  });

  it('不存在的已保存角色安全回退到第一个有效 Pack', () => {
    expect(resolveSelectedVoicePackId('removed-pack', packs)).toBe('xiaozhang');
    expect(resolveSelectedVoicePackId(null, packs)).toBe('xiaozhang');
    expect(resolveSelectedVoicePackId('removed-pack', [])).toBeNull();
  });
});
