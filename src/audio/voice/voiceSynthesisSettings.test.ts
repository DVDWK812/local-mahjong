import { describe, expect, it } from 'vitest';
import fingerprintFixture from './voiceFingerprint.fixture.json';
import { voiceFingerprint } from './voiceFingerprint';
import { resolveEffectiveGenerationConfig } from './effectiveGenerationConfig';
import { normalizeVoiceSynthesisSettings } from './voiceSynthesisSettings';

const base = { key: 'action.riichi', category: 'action', action: 'riichi', line: '立直', tts_text: '立直', locale: 'ja-JP', character: 'default', emotion: 'firm' };
const meta = { id: 'pack', name: 'Pack', locale: 'zh-CN', voiceId: 'voice', modelId: 'fishaudio-s21pro-flash' };

describe('Voice synthesis settings contract', () => {
  it('normalizes legacy missing fields and empty fields to the frozen defaults', () => {
    expect(normalizeVoiceSynthesisSettings({})).toEqual({ speed: 1, volume: 0, stability: 1, similarity: 1, languageOverride: '', textNormalization: true, ttsEmotion: '', ttsInstruction: '' });
    expect(normalizeVoiceSynthesisSettings({ ...base, speed: '', volume: '', stability: '', similarity: '', language_override: '', text_normalization: '' })).toEqual({ speed: 1, volume: 0, stability: 1, similarity: 1, languageOverride: '', textNormalization: true, ttsEmotion: '', ttsInstruction: '' });
  });

  it('treats numeric representations equally and parses false without Boolean-string coercion', () => {
    expect(normalizeVoiceSynthesisSettings({ ...base, speed: '1.0', volume: '0', stability: '1', similarity: '1', text_normalization: 'false' })).toMatchObject({ speed: 1, volume: 0, stability: 1, similarity: 1, textNormalization: false });
    expect(normalizeVoiceSynthesisSettings({ ...base, speed: 1 as unknown as string })).toMatchObject({ speed: 1 });
  });

  it('accepts unset pitch in every legacy representation', () => {
    expect(normalizeVoiceSynthesisSettings({ ...base, pitch: '' }).pitch).toBeUndefined();
    expect(normalizeVoiceSynthesisSettings({ ...base, pitch: undefined }).pitch).toBeUndefined();
  });

  it('keeps an empty language override as inheritance from the Pack locale', () => {
    expect(resolveEffectiveGenerationConfig(base, meta, { format: 'mp3' })).toMatchObject({ effectiveLanguage: 'zh-CN', textNormalization: true });
    expect(resolveEffectiveGenerationConfig({ ...base, language_override: 'ja-JP' }, meta, { format: 'mp3' })).toMatchObject({ effectiveLanguage: 'ja-JP' });
  });

  it('matches the shared Python/browser fingerprint fixtures', () => {
    for (const fixture of fingerprintFixture.cases) {
      expect(voiceFingerprint({ text: fixture.ttsText, voiceId: fixture.voiceId, modelId: fixture.modelId, format: fixture.format,
        speed: fixture.speed, volume: fixture.volume, stability: fixture.stability, similarity: fixture.similarity,
        effectiveLanguage: fixture.language, textNormalization: fixture.textNormalization })).toBe(fixture.fingerprint);
    }
  });
});
