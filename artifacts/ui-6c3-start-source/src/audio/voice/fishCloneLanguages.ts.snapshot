import mapping from './fishCloneLanguages.json';

export type FishCloneLanguage = string;
const entries = mapping.languages as readonly { readonly localePrefix: string; readonly cloneLanguage: FishCloneLanguage }[];
export const FISH_CLONE_LANGUAGE_CODES: readonly FishCloneLanguage[] = Object.freeze([...new Set(entries.map((entry) => entry.cloneLanguage))]);

/** Maps a UI/Pack locale to Fish Clone's documented short language code. */
export function fishCloneLanguageForLocale(locale: string | undefined): FishCloneLanguage | undefined {
  const prefix = locale?.trim().toLocaleLowerCase().split('-')[0];
  return entries.find((entry) => entry.localePrefix === prefix)?.cloneLanguage;
}

export function isFishCloneLanguage(value: unknown): value is FishCloneLanguage {
  return typeof value === 'string' && FISH_CLONE_LANGUAGE_CODES.includes(value);
}
