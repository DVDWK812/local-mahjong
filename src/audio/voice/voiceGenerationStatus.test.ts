import { describe, expect, it } from 'vitest';
import { MemoryVoiceLineOverrideStorage, VoicePackEditingService } from './VoicePackEditingService';
import { VOICE_PACK_REPOSITORY } from './VoicePackRepository';
import { generationStatusSummary, getVoiceLineGenerationStatus, getVoicePackGenerationStatuses } from './voiceGenerationStatus';
import { voiceFingerprint } from './voiceFingerprint';
import { resolveEffectiveGenerationConfig, VOICE_FINGERPRINT_VERSION } from './effectiveGenerationConfig';

describe('Voice generation status', () => {
  it('与 Phase 0 Python cache 的实际 fingerprint 严格一致', () => {
    const detail = VOICE_PACK_REPOSITORY.getPack('xiaozhang'); const line = detail?.voiceLines.find((candidate) => candidate.key === 'action.riichi');
    if (!detail || !line) throw new Error('Missing xiaozhang fixture');
    expect(voiceFingerprint(resolveEffectiveGenerationConfig(line, detail.meta, detail.synthesis))).not.toBe('');
    expect(detail.generationCache['action.riichi']?.fingerprint).toBe('d10bd99d93e7c31231c1a63ae222c362aa13652e94a011f179dd5c30dd6bfe1e');
    expect(getVoiceLineGenerationStatus(detail, line)).toBe('generated');
  });

  it('现有 148 条初始均为已生成；改变十条实际 TTS 输入后只标记十条已修改', () => {
    const detail = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!detail) throw new Error('Missing xiaozhang fixture');
    const initial = generationStatusSummary(getVoicePackGenerationStatuses(detail, detail.voiceLines));
    expect(initial).toMatchObject({ generated: 148, changed: 0, 'not-generated': 0, 'missing-audio': 0 });
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    detail.voiceLines.slice(0, 10).forEach((line) => editor.updateVoiceLine('xiaozhang', line.key, { ttsText: `${line.tts_text}<|phoneme_start|>fa1<|phoneme_end|>` }));
    expect(generationStatusSummary(getVoicePackGenerationStatuses(detail, editor.getVoiceLines('xiaozhang')))).toMatchObject({ generated: 138, changed: 10, 'not-generated': 0, 'missing-audio': 0 });
  });

  it('完整 Pack 保留真实增量状态：校长与曼波均全量已生成', () => {
    const xiaozhang = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    const mambo = VOICE_PACK_REPOSITORY.getPack('voice-20260821-001');
    if (!xiaozhang || !mambo) throw new Error('Missing complete Pack fixture');
    expect(xiaozhang.voiceLines).toHaveLength(148); expect(mambo.voiceLines).toHaveLength(148);
    expect(generationStatusSummary(getVoicePackGenerationStatuses(xiaozhang, xiaozhang.voiceLines))).toMatchObject({ generated: 148, changed: 0, 'not-generated': 0, 'missing-audio': 0 });
    expect(generationStatusSummary(getVoicePackGenerationStatuses(mambo, mambo.voiceLines))).toMatchObject({ generated: 148, changed: 0, 'not-generated': 0, 'missing-audio': 0 });
    expect(getVoiceLineGenerationStatus(mambo, mambo.voiceLines.find((line) => line.key === 'flavor.close_game')!)).toBe('generated');
  });

  it('只改 display line 而有效 tts_text 不变时保持已生成；tts_text 改变才需要更新', () => {
    const source = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!source) throw new Error('Missing xiaozhang fixture');
    const line = { ...source.voiceLines[0], line: '立直', tts_text: '<|phoneme_start|>li4 zhi2<|phoneme_end|>' };
    const fingerprint = voiceFingerprint(resolveEffectiveGenerationConfig(line, source.meta, source.synthesis));
    const detail = { ...source, generationCache: { ...source.generationCache, [line.key]: { ...source.generationCache[line.key], fingerprint, fingerprintVersion: VOICE_FINGERPRINT_VERSION, ttsText: line.tts_text } } };
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

  it('单条生成参数变更只标记该条；统一参数应用会标记全部 148 条', () => {
    const detail = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!detail) throw new Error('Missing xiaozhang fixture');
    const one = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    one.updateVoiceLine('xiaozhang', 'action.ron', { speed: 1.2 });
    expect(generationStatusSummary(getVoicePackGenerationStatuses(detail, one.getVoiceLines('xiaozhang')))).toMatchObject({ generated: 147, changed: 1 });
    const stability = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    stability.updateVoiceLine('xiaozhang', 'action.ron', { stability: 0.8 });
    expect(generationStatusSummary(getVoicePackGenerationStatuses(detail, stability.getVoiceLines('xiaozhang')))).toMatchObject({ generated: 147, changed: 1 });
    const all = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    detail.voiceLines.forEach((line) => all.updateVoiceLine('xiaozhang', line.key, { speed: 1.2 }));
    expect(generationStatusSummary(getVoicePackGenerationStatuses(detail, all.getVoiceLines('xiaozhang')))).toMatchObject({ generated: 0, changed: 148 });
  });

  it('language 和文本归一化属于 fingerprint，且不会改变 UI 台词或高级发音', () => {
    const detail = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    if (!detail) throw new Error('Missing xiaozhang fixture');
    const source = detail.voiceLines.find((line) => line.key === 'action.ron');
    if (!source) throw new Error('Missing ron fixture');
    const editor = new VoicePackEditingService(VOICE_PACK_REPOSITORY, new MemoryVoiceLineOverrideStorage());
    editor.updateVoiceLine('xiaozhang', source.key, { languageOverride: 'ja-JP', textNormalization: false });
    const updated = editor.getVoiceLine('xiaozhang', source.key);
    expect(updated).toMatchObject({ line: source.line, tts_text: source.tts_text, language_override: 'ja-JP', text_normalization: 'false' });
    expect(getVoiceLineGenerationStatus(detail, updated!)).toBe('changed');
  });

  it('当前模型支持的参数单独改变时立即成为 changed，恢复原值则保持 generated', () => {
    const source = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    const line = source?.voiceLines.find((candidate) => candidate.key === 'action.ron');
    if (!source || !line) throw new Error('Missing fixture voice line');
    const controls = { speed: true, volume: true, stability: true, similarity: true, language: true, textNormalization: true, pitch: false, emotion: false, instruction: false };
    const detail = { ...source, meta: { ...source.meta, ttsControls: controls } };
    const changes = [
      { speed: '1.15' }, { volume: '-2' }, { stability: '0.75' }, { similarity: '0.75' },
      { language_override: 'ja-JP' }, { text_normalization: 'false' },
    ];
    for (const change of changes) expect(getVoiceLineGenerationStatus(detail, { ...line, ...change }), JSON.stringify(change)).toBe('changed');
    expect(getVoiceLineGenerationStatus(detail, { ...line, speed: '1.0', text_normalization: 'true' })).toBe('generated');
  });

  it('明确不支持的 pitch 只保留存储值，不改变 fingerprint 或 generation status', () => {
    const source = VOICE_PACK_REPOSITORY.getPack('xiaozhang');
    const line = source?.voiceLines.find((candidate) => candidate.key === 'action.ron');
    if (!source || !line) throw new Error('Missing fixture voice line');
    const detail = { ...source, meta: { ...source.meta, ttsControls: { speed: true, volume: true, stability: true, similarity: true, language: true, textNormalization: true, pitch: false, emotion: false, instruction: false } } };
    expect(getVoiceLineGenerationStatus(detail, { ...line, pitch: '3' })).toBe('generated');
  });
});
