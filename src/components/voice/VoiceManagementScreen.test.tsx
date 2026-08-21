import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import { VoiceManagementScreen } from './VoiceManagementScreen';

describe('VoiceManagementScreen', () => {
  it('作为独立界面显示当前校长的 114 条只读语音', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="xiaozhang" voiceVolume={0.8} onBack={() => undefined} />);
    expect(html).toContain('语音管理');
    expect(html).toContain('← 返回');
    expect(html).toContain('校长');
    expect(html).toContain('中文 · 114 条语音');
    expect(html).toContain('立直');
    expect((html.match(/voice-management-screen__row" role="row"/g) ?? []).length).toBe(114);
  });

  it('未知 Pack 显示可恢复错误，不会导致页面崩溃', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="removed-pack" voiceVolume={0.8} onBack={() => undefined} />);
    expect(html).toContain('当前语音包不可用');
    expect(html).toContain('← 返回');
  });

  it('缺失音频在独立列表中禁用试听', () => {
    const repository = new VoicePackRepository({
      index: { schemaVersion: 1, packs: [{ id: 'missing', name: '缺失音频角色', locale: 'zh-CN', path: 'missing' }] },
      packMetadata: { '../../music/voice_lines/missing/pack.json': { id: 'missing', name: '缺失音频角色', locale: 'zh-CN', voiceId: 'voice', modelId: 'model' } },
      manifests: { '../../music/voice_lines/missing/manifest.json': { character: 'missing', voiceId: 'voice', voices: { 'action.riichi': { file: 'audio/action_riichi.mp3' } } } },
      voiceLines: { '../../music/voice_lines/missing/voice_lines.json': [{ key: 'action.riichi', category: 'action', action: 'riichi', line: '立直', tts_text: '立直', locale: 'zh-CN', character: 'missing', emotion: 'firm' }] },
      audio: {},
    });
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="missing" voiceVolume={0.8} onBack={() => undefined} repository={repository} />);
    expect(html).toContain('△ 音频缺失');
    expect(html).toContain('disabled=""');
  });
});
