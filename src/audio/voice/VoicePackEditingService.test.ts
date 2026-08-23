import { describe, expect, it } from 'vitest';
import { MemoryVoiceLineOverrideStorage, VoicePackEditingService, createVoiceLineDraft, graphemeCount, hasCustomPronunciation, validateDisplayLine, voiceLineEditorKeyAction } from './VoicePackEditingService';
import { VOICE_PACK_REPOSITORY } from './VoicePackRepository';

describe('VoicePackEditingService', () => {
  it('双击起草、Enter 保存、Esc 取消均有明确的编辑状态语义', () => {
    const source = VOICE_PACK_REPOSITORY.getVoiceLine('xiaozhang', 'action.riichi');
    if (!source) throw new Error('Missing fixture voice line');
    expect(createVoiceLineDraft(source)).toEqual({ line: '立直', ttsText: '立直' });
    expect(voiceLineEditorKeyAction('Enter')).toBe('save');
    expect(voiceLineEditorKeyAction('Escape')).toBe('cancel');
    expect(voiceLineEditorKeyAction('Tab')).toBeUndefined();
  });

  it('以 grapheme 而非 UTF-8 byte 限制台词长度，并允许中文与组合 emoji', () => {
    expect(graphemeCount('立直')).toBe(2);
    expect(graphemeCount('👩‍💻'.repeat(30))).toBe(30);
    expect(validateDisplayLine('👩‍💻'.repeat(30)).valid).toBe(true);
    expect(validateDisplayLine('👩‍💻'.repeat(31))).toEqual(expect.objectContaining({ valid: false }));
  });

  it('保存 line 与无限制 tts_text 后刷新仍保留，并且不改动母版 Repository 数据', () => {
    const storage = new MemoryVoiceLineOverrideStorage();
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, storage);
    const longPhoneme = '<|phoneme_start|>fa1 fa1 fa1 fa1 fa1 fa1 fa1 fa1 fa1 fa1 fa1 fa1<|phoneme_end|>';
    const updated = editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '我要立直', ttsText: longPhoneme });
    expect(updated).toMatchObject({ line: '我要立直', tts_text: longPhoneme });
    expect(VOICE_PACK_REPOSITORY.getVoiceLine('xiaozhang', 'action.riichi')).toMatchObject({ line: '立直', tts_text: '立直' });
    const reloaded = new VoicePackEditingService(VOICE_PACK_REPOSITORY, storage);
    expect(reloaded.getVoiceLine('xiaozhang', 'action.riichi')).toMatchObject({ line: '我要立直', tts_text: longPhoneme });
  });

  it('历史 tts_text 等于旧 line 时视为默认发音，编辑台词后清空 override 以跟随新台词', () => {
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    const updated = editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '哇哦！我要立直' });
    expect(updated).toMatchObject({ line: '哇哦！我要立直', tts_text: '' });
    expect(hasCustomPronunciation(updated)).toBe(false);
  });

  it('自定义高级发音在编辑显示台词时保持不变', () => {
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    const phoneme = '<|phoneme_start|>li4 zhi2<|phoneme_end|>';
    editor.updateVoiceLine('xiaozhang', 'action.riichi', { ttsText: phoneme });
    const updated = editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '漂亮！立直！' });
    expect(updated).toMatchObject({ line: '漂亮！立直！', tts_text: phoneme });
    expect(hasCustomPronunciation(updated)).toBe(true);
  });

  it('恢复默认发音保存空 tts_text，之后台词继续自动跟随', () => {
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '我要立直', ttsText: '<|phoneme_start|>li4 zhi2<|phoneme_end|>' });
    expect(editor.resetPronunciation('xiaozhang', 'action.riichi')).toMatchObject({ line: '我要立直', tts_text: '' });
    expect(editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '再次立直' })).toMatchObject({ line: '再次立直', tts_text: '' });
  });
});
