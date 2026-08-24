import { describe, expect, it } from 'vitest';
import { canonicalEffectiveGenerationConfigPayload, resolveEffectiveGenerationConfig, VOICE_FINGERPRINT_VERSION } from './effectiveGenerationConfig';
import { voiceFingerprint } from './voiceFingerprint';

const meta = { id: 'pack', name: 'Pack', locale: 'zh-CN', voiceId: 'voice-a', modelId: 'model-a' };
const synthesis = { speed: 1, format: 'mp3' };
const line = { key: 'action.ron', category: 'action', action: 'ron', line: '荣和', tts_text: '', locale: 'ja-JP', character: 'default', emotion: 'firm' };

describe('EffectiveGenerationConfig', () => {
  it('is the sole text/default/language resolver', () => {
    expect(resolveEffectiveGenerationConfig(line, meta, synthesis)).toEqual({
      text: '荣和', voiceId: 'voice-a', modelId: 'model-a', format: 'mp3',
      speed: 1, volume: 0, stability: 1, similarity: 1, effectiveLanguage: 'zh-CN', textNormalization: true,
    });
    expect(resolveEffectiveGenerationConfig({ ...line, tts_text: '<|phoneme_start|>rong2 he2<|phoneme_end|>', language_override: 'ja-JP' }, meta, synthesis))
      .toMatchObject({ text: '<|phoneme_start|>rong2 he2<|phoneme_end|>', effectiveLanguage: 'ja-JP' });
  });

  it('normalizes numeric and boolean spellings before v2 canonical hashing', () => {
    const one = resolveEffectiveGenerationConfig({ ...line, speed: '1', volume: '0', stability: '1', similarity: '1', text_normalization: 'true' }, meta, synthesis);
    const onePointZero = resolveEffectiveGenerationConfig({ ...line, speed: '1.0', volume: '0.0', stability: '1.0', similarity: '1.0', text_normalization: 'true' }, meta, synthesis);
    expect(canonicalEffectiveGenerationConfigPayload(one)).toContain(`${VOICE_FINGERPRINT_VERSION}\x1f`);
    expect(voiceFingerprint(onePointZero)).toBe(voiceFingerprint(one));
  });

  it('does not let explicitly unsupported controls create a false identity change', () => {
    const capabilities = { controls: { speed: false, volume: false, stability: false, similarity: false, language: false, textNormalization: false, pitch: false, emotion: false, instruction: false } } as const;
    const initial = resolveEffectiveGenerationConfig(line, meta, synthesis, capabilities);
    const changed = resolveEffectiveGenerationConfig({ ...line, speed: '1.5', language_override: 'ja-JP' }, meta, synthesis, capabilities);
    expect(initial.speed).toBeUndefined(); expect(initial.effectiveLanguage).toBeUndefined();
    expect(voiceFingerprint(changed)).toBe(voiceFingerprint(initial));
  });

  it('treats an incomplete capability snapshot as legacy-compatible rather than silently disabling omitted controls', () => {
    const partial = { controls: { language: true } } as const;
    const effective = resolveEffectiveGenerationConfig({ ...line, speed: '1.5' }, meta, synthesis, partial);
    expect(effective.speed).toBe(1.5);
    expect(effective.effectiveLanguage).toBe('zh-CN');
    expect(resolveEffectiveGenerationConfig({ ...line, speed: '1.5' }, meta, synthesis).speed).toBe(1.5);
  });

  it('changes only when an effective input changes, including pack voice/model identity', () => {
    const base = resolveEffectiveGenerationConfig({ ...line, tts_text: '荣和' }, meta, synthesis);
    expect(voiceFingerprint(resolveEffectiveGenerationConfig({ ...line, tts_text: '荣和', text_normalization: 'false' }, meta, synthesis))).not.toBe(voiceFingerprint(base));
    expect(voiceFingerprint(resolveEffectiveGenerationConfig({ ...line, line: '显示文本已变', tts_text: '荣和' }, meta, synthesis))).toBe(voiceFingerprint(base));
    expect(voiceFingerprint(resolveEffectiveGenerationConfig({ ...line, tts_text: '荣和' }, { ...meta, voiceId: 'voice-b' }, synthesis))).not.toBe(voiceFingerprint(base));
    expect(voiceFingerprint(resolveEffectiveGenerationConfig({ ...line, tts_text: '荣和' }, { ...meta, modelId: 'model-b' }, synthesis))).not.toBe(voiceFingerprint(base));
  });

  it('includes new controls only when v3 capabilities explicitly support them', () => {
    const stored = { ...line, pitch: '3', tts_emotion: 'metadata-must-not-leak', tts_instruction: 'speak calmly' };
    const supported = { controls: { speed: true, volume: true, stability: true, similarity: true, language: true, textNormalization: true, pitch: true, emotion: true, instruction: true } } as const;
    const unsupported = { controls: { speed: true, volume: true, stability: true, similarity: true, language: true, textNormalization: true, pitch: false, emotion: false, instruction: false } } as const;
    const enabled = resolveEffectiveGenerationConfig(stored, meta, synthesis, supported);
    const disabled = resolveEffectiveGenerationConfig(stored, meta, synthesis, unsupported);
    expect(enabled).toMatchObject({ pitch: 3, ttsEmotion: 'metadata-must-not-leak', ttsInstruction: 'speak calmly' });
    expect(disabled).not.toHaveProperty('pitch'); expect(disabled).not.toHaveProperty('ttsEmotion'); expect(disabled).not.toHaveProperty('ttsInstruction');
    expect(voiceFingerprint(disabled)).toBe(voiceFingerprint(resolveEffectiveGenerationConfig(line, meta, synthesis, unsupported)));
    // Switching back to a capable model restores the stored values; no CSV data is erased.
    expect(resolveEffectiveGenerationConfig(stored, meta, synthesis, supported).ttsInstruction).toBe('speak calmly');
  });
});
