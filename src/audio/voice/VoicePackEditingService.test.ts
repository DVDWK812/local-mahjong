import { describe, expect, it } from 'vitest';
import { MemoryVoiceLineOverrideStorage, VoicePackEditingService, createVoiceLineDraft, graphemeCount, hasCustomPronunciation, type VoiceLineOverrideStorage, type VoiceLinePatch, validateDisplayLine, voiceLineEditorKeyAction } from './VoicePackEditingService';
import { textControlProfileForModel } from './textControlProfiles';
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

  it('普通台词编辑作为最新来源，同步覆盖旧的 TTS 控制文本', () => {
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    editor.updateFromTtsText('xiaozhang', 'action.riichi', '哼[pause]，让你们一把！[embarrassed]', textControlProfileForModel('fishaudio-s21pro-flash'));
    const updated = editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '哇哦！我要立直' });
    expect(updated).toMatchObject({ line: '哇哦！我要立直', tts_text: '哇哦！我要立直' });
    expect(hasCustomPronunciation(updated)).toBe(false);
  });

  it('高级 TTS 文本编辑会在一次持久化事务中同步可显示台词', () => {
    class CountingStorage implements VoiceLineOverrideStorage {
      count = 0; private value: Record<string, Record<string, VoiceLinePatch>> = {};
      load(): Record<string, Record<string, VoiceLinePatch>> { return structuredClone(this.value); }
      save(value: Record<string, Record<string, VoiceLinePatch>>): void { this.count += 1; this.value = structuredClone(value); }
    }
    const storage = new CountingStorage();
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, storage);
    const updated = editor.updateFromTtsText('xiaozhang', 'action.riichi', '哼[pause]，让你们一把！[embarrassed]', textControlProfileForModel('fishaudio-s21pro-flash'));
    expect(updated).toMatchObject({ line: '哼，让你们一把！', tts_text: '哼[pause]，让你们一把！[embarrassed]' });
    expect(hasCustomPronunciation(updated)).toBe(true);
    expect(storage.count).toBe(1);
  });

  it('恢复默认发音保存空 tts_text，之后台词继续自动跟随', () => {
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '我要立直', ttsText: '<|phoneme_start|>li4 zhi2<|phoneme_end|>' });
    expect(editor.resetPronunciation('xiaozhang', 'action.riichi')).toMatchObject({ line: '我要立直', tts_text: '' });
    expect(editor.updateVoiceLine('xiaozhang', 'action.riichi', { line: '再次立直' })).toMatchObject({ line: '再次立直', tts_text: '再次立直' });
  });

  it('Bridge 确认写入后清除本地 overlay，后续计划只读取权威 CSV 数据', () => {
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    editor.updateVoiceLine('xiaozhang', 'action.riichi', { speed: 1.15 });
    expect(editor.getPatches('xiaozhang')).toEqual([{ key: 'action.riichi', speed: 1.15 }]);
    editor.acknowledgePersisted('xiaozhang', ['action.riichi']);
    expect(editor.getPatches('xiaozhang')).toEqual([]);
  });
});
