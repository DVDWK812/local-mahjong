import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import { VoiceManagementScreen, generationOutcome, ttsOverrideForDraft } from './VoiceManagementScreen';

describe('VoiceManagementScreen', () => {
  it('作为独立界面显示当前校长的 114 条可编辑语音与生成摘要', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="xiaozhang" voiceVolume={0.8} onBack={() => undefined} />);
    expect(html).toContain('语音管理');
    expect(html).toContain('← 返回');
    expect(html).toContain('校长');
    expect(html).toContain('中文 · 114 条语音');
    expect(html).toContain('立直');
    expect(html).toContain('高级发音');
    expect(html).toContain('placeholder="动作或台词"');
    expect(html).not.toContain('placeholder="动作、台词或 key"');
    expect(html).toContain('试听始终播放已生成的音频版本');
    expect(html).toContain('已生成 114');
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

  it('新建的空音频 Pack 仍展示完整 114 条，并全部禁用试听', () => {
    const lines = Array.from({ length: 114 }, (_, index) => ({ key: `action.new_${index}`, category: 'action', action: 'new', line: '新台词', tts_text: '新台词', locale: 'zh-CN', character: 'new', emotion: 'firm' }));
    const repository = new VoicePackRepository({
      index: { schemaVersion: 1, packs: [{ id: 'new-001', name: '新角色', locale: 'zh-CN', path: 'new-001' }] },
      packMetadata: { '../../music/voice_lines/new-001/pack.json': { id: 'new-001', name: '新角色', locale: 'zh-CN', voiceId: 'voice', modelId: 'fishaudio-s21pro-flash' } },
      manifests: { '../../music/voice_lines/new-001/manifest.json': { character: 'new-001', voiceId: 'voice', voices: {} } },
      voiceLines: { '../../music/voice_lines/new-001/voice_lines.json': lines }, audio: {},
    });
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="new-001" voiceVolume={0.8} onBack={() => undefined} repository={repository} />);
    expect(html).toContain('新角色');
    expect(html).toContain('中文 · 114 条语音');
    expect(html).toContain('已生成 0');
    expect(html).toContain('未生成 114');
    expect((html.match(/disabled=""/g) ?? []).length).toBe(114);
  });

  it('生成成功或失败均不会触发导航；可恢复错误保留在当前管理页', () => {
    expect(generationOutcome({ success: true, generated: 1, failed: 0, skipped: 0, items: [] })).toEqual({ remainInManagement: true, error: null });
    expect(generationOutcome({ success: false, generated: 0, failed: 1, skipped: 0, items: [], error: { code: 'API_KEY_UNAVAILABLE', message: '未找到 Fish Audio API Key。' } }))
      .toEqual({ remainInManagement: true, error: 'API_KEY_UNAVAILABLE: 未找到 Fish Audio API Key。' });
    expect(generationOutcome({ success: false, generated: 0, failed: 1, skipped: 0, items: [] }))
      .toEqual(expect.objectContaining({ remainInManagement: true }));
  });

  it('高级发音输入为空或与台词相同即恢复为 Python fallback 的默认发音', () => {
    const line = { line: '自摸！' };
    expect(ttsOverrideForDraft(line, '')).toBe('');
    expect(ttsOverrideForDraft(line, '  自摸！  ')).toBe('');
    expect(ttsOverrideForDraft(line, '<|phoneme_start|>zi4 mo1<|phoneme_end|>')).toBe('<|phoneme_start|>zi4 mo1<|phoneme_end|>');
  });
});
