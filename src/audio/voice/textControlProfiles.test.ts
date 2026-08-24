import { describe, expect, it } from 'vitest';
import { textControlProfileForModel } from './textControlProfiles';

describe('textControlProfileForModel', () => {
  it('keeps Fish S2 square-bracket examples separate from MiniMax syntax', () => {
    const fish = textControlProfileForModel('fishaudio-s21pro-flash');
    expect(fish.kind).toBe('fish-s2');
    expect(fish.groups.flatMap((group) => group.controls).map((control) => control.token)).toContain('[excited]');
    const minimax = textControlProfileForModel('minimax-2.8-turbo');
    expect(minimax.kind).toBe('minimax-2.8');
    const tokens = minimax.groups.flatMap((group) => group.controls).map((control) => control.token);
    expect(tokens).toContain('<#0.5#>'); expect(tokens).toContain('(laughs)'); expect(tokens).not.toContain('[excited]');
  });
});
