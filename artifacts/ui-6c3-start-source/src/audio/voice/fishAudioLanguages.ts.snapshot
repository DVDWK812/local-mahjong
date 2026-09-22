export interface FishAudioLanguage {
  readonly id: string;
  readonly displayName: string;
  readonly locale: string;
  readonly flag: string;
}

/** Fish Audio supported language choices exposed by the local voice-pack creator. */
export const FISH_AUDIO_LANGUAGES: readonly FishAudioLanguage[] = Object.freeze([
  { id: 'en', displayName: 'English', locale: 'en-US', flag: '🇺🇸' },
  { id: 'zh', displayName: '简体中文', locale: 'zh-CN', flag: '🇨🇳' },
  { id: 'ru', displayName: 'Русский', locale: 'ru-RU', flag: '🇷🇺' },
  { id: 'zh-hant', displayName: '繁體中文', locale: 'zh-TW', flag: '🇹🇼' },
  { id: 'es', displayName: 'Español', locale: 'es-ES', flag: '🇪🇸' },
  { id: 'ja', displayName: '日本語', locale: 'ja-JP', flag: '🇯🇵' },
  { id: 'ko', displayName: '한국어', locale: 'ko-KR', flag: '🇰🇷' },
  { id: 'fr', displayName: 'Français', locale: 'fr-FR', flag: '🇫🇷' },
  { id: 'ar', displayName: 'العربية', locale: 'ar-SA', flag: '🇸🇦' },
  { id: 'de', displayName: 'Deutsch', locale: 'de-DE', flag: '🇩🇪' },
  { id: 'pt', displayName: 'Português', locale: 'pt-BR', flag: '🇧🇷' },
  { id: 'hi', displayName: 'हिन्दी', locale: 'hi-IN', flag: '🇮🇳' },
  { id: 'tr', displayName: 'Türkçe', locale: 'tr-TR', flag: '🇹🇷' },
  { id: 'it', displayName: 'Italiano', locale: 'it-IT', flag: '🇮🇹' },
  { id: 'id', displayName: 'Bahasa Indonesia', locale: 'id-ID', flag: '🇮🇩' },
  { id: 'th', displayName: 'ไทย', locale: 'th-TH', flag: '🇹🇭' },
  { id: 'pl', displayName: 'Polski', locale: 'pl-PL', flag: '🇵🇱' },
  { id: 'fil', displayName: 'Filipino', locale: 'fil-PH', flag: '🇵🇭' },
  { id: 'uk', displayName: 'Українська', locale: 'uk-UA', flag: '🇺🇦' },
  { id: 'nl', displayName: 'Nederlands', locale: 'nl-NL', flag: '🇳🇱' },
  { id: 'ms', displayName: 'Bahasa Melayu', locale: 'ms-MY', flag: '🇲🇾' },
  { id: 'el', displayName: 'Ελληνικά', locale: 'el-GR', flag: '🇬🇷' },
  { id: 'ro', displayName: 'Română', locale: 'ro-RO', flag: '🇷🇴' },
  { id: 'vi', displayName: 'Tiếng Việt', locale: 'vi-VN', flag: '🇻🇳' },
]);

export function fishAudioLanguageById(id: string): FishAudioLanguage {
  return FISH_AUDIO_LANGUAGES.find((language) => language.id === id) ?? FISH_AUDIO_LANGUAGES[1];
}
