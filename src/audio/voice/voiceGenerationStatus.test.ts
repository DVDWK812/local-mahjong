import { describe, expect, it } from 'vitest';
import { MemoryVoiceLineOverrideStorage, VoicePackEditingService } from './VoicePackEditingService';
import { VOICE_PACK_REPOSITORY } from './VoicePackRepository';
import { generationStatusSummary, getVoiceLineGenerationStatus, getVoicePackGenerationStatuses } from './voiceGenerationStatus';
import { voiceFingerprint } from './voiceFingerprint';

describe('Voice generation status', () => {
  it('与 Phase 0 Python cache 的实际 fingerprint 严格一致', () => {
    const detail = VOICE_PACK_REPOSITORY.getPack('xiaozhang'); const line = detail?.voiceLines.find((candidate) => candidate.key === 'action.riichi');
    if (!detail || !line) throw new Error('Missing xiaozhang fixture');
    expect(voiceFingerprint(detail.meta, detail.synthesis, '立直')).toBe('d10bd99d93e7c31231c1a63ae222c362aa13652e94a011f179dd5c30dd6bfe1e');
    expect(detail.generationCache['action.riichi']?.fingerprint).toBe('d10bd99d93e7c31231c1a63ae222c362aa13652e94a011f179dd5c30dd6bfe1e');
    expect(getVoiceLineGenerationStatus(detail, line)).toBe('generated');
  });

  it('现有 114 条初始全为已生成；改变十条实际 TTS 输入后只标记十条已修改', () => {
    const detail = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!detail) throw new Error('Missing xiaozhang fixture');
    const initial = generationStatusSummary(getVoicePackGenerationStatuses(detail, detail.voiceLines));
    expect(initial).toMatchObject({ generated: 114, changed: 0, 'not-generated': 0, 'missing-audio': 0 });
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    detail.voiceLines.slice(0, 10).forEach((line) => editor.updateVoiceLine('xiaozhang', line.key, { ttsText: `${line.tts_text}<|phoneme_start|>fa1<|phoneme_end|>` }));
    expect(generationStatusSummary(getVoicePackGenerationStatuses(detail, editor.getVoiceLines('xiaozhang')))).toMatchObject({ generated: 104, changed: 10, 'not-generated': 0, 'missing-audio': 0 });
  });

  it('只改 display line 而有效 tts_text 不变时保持已生成；tts_text 改变才需要更新', () => {
    const source = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!source) throw new Error('Missing xiaozhang fixture');
    const line = { ...source.voiceLines[0], line: '立直', tts_text: '<|phoneme_start|>li4 zhi2<|phoneme_end|>' };
    const fingerprint = voiceFingerprint(source.meta, source.synthesis, line.tts_text);
    const detail = { ...source, generationCache: { ...source.generationCache, [line.key]: { ...source.generationCache[line.key], fingerprint, ttsText: line.tts_text } } };
    expect(getVoiceLineGenerationStatus(detail, { ...line, line: '我要立直' })).toBe('generated');
    expect(getVoiceLineGenerationStatus(detail, { ...line, tts_text: '<|phoneme_start|>wo3 yao4 li4 zhi2<|phoneme_end|>' })).toBe('changed');
  });

  it('缺失音频与明确失败记录安全显示为对应状态', () => {
    const source = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!source) throw new Error('Missing xiaozhang fixture');
    const line = source.voiceLines[0];
    expect(getVoiceLineGenerationStatus({ ...source, voiceAvailability: { ...source.voiceAvailability, [line.key]: { ...source.voiceAvailability[line.key], status: 'missing-audio' } } }, line)).toBe('missing-audio');
    expect(getVoiceLineGenerationStatus({ ...source, failedKeys: [line.key] }, line)).toBe('failed');
  });
});
