import { describe, expect, it } from 'vitest';
import { FISH_AUDIO_LANGUAGES, fishAudioLanguageById } from './fishAudioLanguages';

describe('Fish Audio language choices', () => {
  it('contains every supported creation choice with a stable internal locale', () => {
    expect(FISH_AUDIO_LANGUAGES).toHaveLength(24);
    expect(FISH_AUDIO_LANGUAGES.map((language) => language.displayName)).toEqual(expect.arrayContaining([
      'English', '简体中文', 'Русский', '繁體中文', 'Español', '日本語', '한국어', 'Français', 'العربية', 'Deutsch', 'Português', 'हिन्दी', 'Türkçe', 'Italiano', 'Bahasa Indonesia', 'ไทย', 'Polski', 'Filipino', 'Українська', 'Nederlands', 'Bahasa Melayu', 'Ελληνικά', 'Română', 'Tiếng Việt',
    ]));
    expect(fishAudioLanguageById('zh')).toMatchObject({ displayName: '简体中文', locale: 'zh-CN' });
    expect(fishAudioLanguageById('ja')).toMatchObject({ displayName: '日本語', locale: 'ja-JP' });
  });
});
