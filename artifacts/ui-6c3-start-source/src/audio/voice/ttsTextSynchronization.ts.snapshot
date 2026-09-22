import { textControlTokens, type TextControlProfile } from './textControlProfiles';
import type { VoiceLine } from './types';

export interface SynchronizedVoiceText {
  readonly line: string;
  readonly ttsText: string;
}

/**
 * The one displayable text representation used by both the editor and the
 * generator resolver: an empty override follows the current display line.
 */
export function effectiveTtsText(line: Pick<VoiceLine, 'line' | 'tts_text'>): string {
  return line.tts_text.trim() ? line.tts_text : line.line.trim();
}

/**
 * Removes only TTS control syntax while preserving the user's visible words
 * and normal punctuation. This is deliberately shared so the UI never has a
 * second, slightly different set of stripping rules.
 */
export function stripTtsControlSyntax(text: string, profile?: TextControlProfile): string {
  let visible = text;

  // Phoneme markup is TTS-only for every currently supported provider.
  visible = visible.replace(/<\|phoneme_?start\|>[\s\S]*?<\|phoneme_?end\|>/gi, '');
  // MiniMax pauses are TTS-only regardless of the currently selected model:
  // persisted text can outlive a model switch.
  visible = visible.replace(/<#\s*\d+(?:\.\d+)?\s*#>/g, '');

  // Fish S2 natural-language controls. Apply these across profiles so a
  // saved Fish control never leaks into a visible line after a model switch.
  visible = visible.replace(/\[(?:angry|sad|embarrassed|excited|whispering|soft|breathy|emphasis|laughing|chuckling|moaning|clear\s+throat|sobbing|crying\s+loudly|sighing|panting|groaning|crowd\s+laughing|background\s+laughing|audience\s+laughing|pause|long\s+pause)\]/gi, '');

  // MiniMax's documented parenthetical controls are sourced from the same
  // model profile used by the text-control palette, not copied into the UI.
  for (const token of textControlTokens(profile ?? { kind: 'none', help: '', groups: [] }).filter((token) => token.startsWith('('))) {
    visible = visible.replace(new RegExp(escapeRegex(token), 'gi'), '');
  }

  return visible
    .replace(/[\t ]+/g, ' ')
    .replace(/\s+([，。！？；：、,.!?;:])/g, '$1')
    .trim();
}

/** The normal table editor is the latest source of truth, so it clears old controls. */
export function synchronizeFromPlainText(line: string): SynchronizedVoiceText {
  return { line, ttsText: line };
}

/**
 * The advanced editor is the latest source of truth. It keeps the complete
 * request text and derives a human-readable line in the same transaction.
 * A control-only value cannot supply visible text, so retain the current line
 * rather than persisting an invalid/empty display line.
 */
export function synchronizeFromTtsText(ttsText: string, currentLine: string, profile?: TextControlProfile): SynchronizedVoiceText {
  if (!ttsText.trim()) return { line: currentLine, ttsText: '' };
  return { line: stripTtsControlSyntax(ttsText, profile) || currentLine, ttsText };
}

function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
