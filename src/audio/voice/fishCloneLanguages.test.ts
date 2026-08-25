import { describe, expect, it } from 'vitest';
import { fishCloneLanguageForLocale } from './fishCloneLanguages';

describe('Fish Clone language mapping', () => {
  it('maps UI locales to Fish Clone short language codes', () => {
    expect(fishCloneLanguageForLocale('zh-CN')).toBe('zh');
    expect(fishCloneLanguageForLocale('zh-TW')).toBe('zh');
    expect(fishCloneLanguageForLocale('en-US')).toBe('en');
    expect(fishCloneLanguageForLocale('en-GB')).toBe('en');
    expect(fishCloneLanguageForLocale('ja-JP')).toBe('ja');
    expect(fishCloneLanguageForLocale('ko-KR')).toBe('ko');
  });
});
