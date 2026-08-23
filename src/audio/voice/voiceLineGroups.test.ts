import { describe, expect, it } from 'vitest';
import { VOICE_PACK_REPOSITORY } from './VoicePackRepository';
import { groupVoiceLines, VOICE_LINE_GROUPS, voiceLineGroupId } from './voiceLineGroups';

describe('voiceLineGroups', () => {
  const lines = VOICE_PACK_REPOSITORY.getPack('xiaozhang')?.voiceLines ?? [];

  it('covers every real VoiceLine exactly once in the nine UI-only groups', () => {
    const grouped = groupVoiceLines(lines);
    const flattened = grouped.flatMap(({ lines: groupLines }) => groupLines);

    expect(grouped.map(({ group }) => group.id)).toEqual(VOICE_LINE_GROUPS.map(({ id }) => id));
    expect(grouped.map(({ lines: groupLines }) => groupLines.length)).toEqual([11, 10, 5, 11, 16, 32, 15, 14, 34]);
    expect(flattened).toHaveLength(148);
    expect(new Set(flattened.map((line) => line.key)).size).toBe(148);
    expect(new Set(flattened.map((line) => line.key))).toEqual(new Set(lines.map((line) => line.key)));
  });

  it('keeps the distinct action and yaku riichi keys in their own semantic groups', () => {
    expect(voiceLineGroupId(lines.find((line) => line.key === 'action.riichi')!)).toBe('actions');
    expect(voiceLineGroupId(lines.find((line) => line.key === 'yaku.riichi')!)).toBe('regular-yaku');
  });

  it('omits headings with no search matches while retaining the matching source rows', () => {
    const matches = lines.filter((line) => line.key === 'action.riichi' || line.key === 'yaku.riichi');
    const grouped = groupVoiceLines(matches);

    expect(grouped.map(({ group }) => group.title)).toEqual(['核心动作', '常规役种']);
    expect(grouped.flatMap(({ lines: groupLines }) => groupLines).map((line) => line.key)).toEqual(['action.riichi', 'yaku.riichi']);
  });
});
