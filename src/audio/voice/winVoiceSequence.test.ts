import { describe, expect, it } from 'vitest';
import type { WinScoredPresentationEvent } from '../../presentation/PresentationEventBus';
import { buildWinVoiceSequence, describeWinVoiceSequence, DORA_MANY_THRESHOLD, doraVoiceKey } from './winVoiceSequence';

function scored(overrides: Partial<Omit<WinScoredPresentationEvent, 'type' | 'eventId' | 'sequence' | 'winnerId' | 'winType' | 'yakuIds' | 'yaku' | 'limitTier' | 'yakumanMultiplier' | 'totalDora'>> & {
  winnerId?: 0 | 1 | 2 | 3;
  winType?: 'ron' | 'tsumo';
  yaku?: WinScoredPresentationEvent['yaku'];
  limitTier?: WinScoredPresentationEvent['limitTier'];
  yakumanMultiplier?: number;
  totalDora?: number;
} = {}): WinScoredPresentationEvent {
  const yaku = overrides.yaku ?? [];
  return {
    eventId: 'win-sequence', sequence: 1, type: 'win_scored', winnerId: overrides.winnerId ?? 1,
    winType: overrides.winType ?? 'ron', yaku, yakuIds: yaku.map((item) => item.id),
    limitTier: overrides.limitTier ?? 'none', yakumanMultiplier: overrides.yakumanMultiplier ?? 0,
    totalDora: overrides.totalDora ?? 0,
  };
}

describe('buildWinVoiceSequence', () => {
  it('普通和牌按实际番数、宝牌、最终等级形成完整序列', () => {
    const sequence = buildWinVoiceSequence(scored({
      limitTier: 'haneman', totalDora: 6,
      yaku: [
        { id: 'sanshoku-doujun', han: 2, yakuman: false },
        { id: 'pinfu', han: 1, yakuman: false },
        { id: 'ippatsu', han: 1, yakuman: false },
        { id: 'riichi', han: 1, yakuman: false },
      ],
    }));
    expect(sequence.items.map((item) => item.voiceKey)).toEqual([
      'action.ron', 'yaku.riichi', 'yaku.ippatsu', 'yaku.pinfu', 'yaku.sanshoku', 'yaku.dora_6', 'score.haneman',
    ]);
  });

  it('相同番数使用显式 canonical order，绝不依赖展示名称或 CSV 行号', () => {
    const sequence = buildWinVoiceSequence(scored({
      yaku: [
        { id: 'pinfu', han: 1, yakuman: false }, { id: 'ippatsu', han: 1, yakuman: false }, { id: 'riichi', han: 1, yakuman: false },
        { id: 'honitsu', han: 3, yakuman: false }, { id: 'junchan', han: 3, yakuman: false },
      ],
    }));
    expect(sequence.items.map((item) => item.voiceKey)).toEqual([
      'action.ron', 'yaku.riichi', 'yaku.ippatsu', 'yaku.pinfu', 'yaku.junchan', 'yaku.honitsu',
    ]);
  });

  it('役牌依据 sourceTile 映射，且宝牌只聚合播放一次', () => {
    const sequence = buildWinVoiceSequence(scored({
      totalDora: 6,
      yaku: [{ id: 'yakuhai', sourceTile: 'white', han: 1, yakuman: false }],
    }));
    expect(sequence.items.map((item) => item.voiceKey)).toEqual(['action.ron', 'yaku.haku', 'yaku.dora_6']);
    expect(doraVoiceKey(0)).toBeUndefined();
    expect(doraVoiceKey(1)).toBe('yaku.dora');
    expect(doraVoiceKey(DORA_MANY_THRESHOLD)).toBe('yaku.dora_many');
  });

  it('非满贯没有等级末尾；满贯作为宝牌后的最后一项', () => {
    expect(buildWinVoiceSequence(scored({ totalDora: 2, yaku: [{ id: 'pinfu', han: 1, yakuman: false }] })).items.map((item) => item.voiceKey))
      .toEqual(['action.ron', 'yaku.pinfu', 'yaku.dora_2']);
    expect(buildWinVoiceSequence(scored({ limitTier: 'mangan', totalDora: 1, yaku: [{ id: 'pinfu', han: 1, yakuman: false }] })).items.map((item) => item.voiceKey))
      .toEqual(['action.ron', 'yaku.pinfu', 'yaku.dora', 'score.mangan']);
  });

  it('真正役满只播放具体役满并以倍率收尾，最具体语义会去重基础役', () => {
    const sequence = buildWinVoiceSequence(scored({
      yakumanMultiplier: 2,
      yaku: [
        { id: 'kokushi', han: 0, yakuman: true }, { id: 'kokushi-13-wait', han: 0, yakuman: true },
        { id: 'suuankou', han: 0, yakuman: true }, { id: 'suuankou-tanki', han: 0, yakuman: true },
      ],
    }));
    expect(sequence.items.map((item) => item.voiceKey)).toEqual([
      'action.ron', 'yaku.kokushi_13_wait', 'yakuman.suuankou_tanki', 'score.double_yakuman',
    ]);
  });

  it('严格以 Batch 3 limitTier 和 yakumanMultiplier 选择最终结算语音', () => {
    const cases: Array<{
      name: string;
      limitTier: WinScoredPresentationEvent['limitTier'];
      yakumanMultiplier: number;
      expected: string | undefined;
      forbidden: readonly string[];
    }> = [
      { name: '普通和牌', limitTier: 'none', yakumanMultiplier: 0, expected: undefined, forbidden: ['score.mangan', 'score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '满贯', limitTier: 'mangan', yakumanMultiplier: 0, expected: 'score.mangan', forbidden: ['score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '跳满', limitTier: 'haneman', yakumanMultiplier: 0, expected: 'score.haneman', forbidden: ['score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '倍满', limitTier: 'baiman', yakumanMultiplier: 0, expected: 'score.baiman', forbidden: ['score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '三倍满', limitTier: 'sanbaiman', yakumanMultiplier: 0, expected: 'score.sanbaiman', forbidden: ['yaku.triple_yakuman'] },
      { name: '累计役满', limitTier: 'counted-yakuman', yakumanMultiplier: 0, expected: 'score.counted_yakuman', forbidden: ['score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '单倍役满', limitTier: 'yakuman', yakumanMultiplier: 1, expected: 'score.yakuman', forbidden: ['score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '双倍役满', limitTier: 'yakuman', yakumanMultiplier: 2, expected: 'score.double_yakuman', forbidden: ['score.sanbaiman', 'yaku.triple_yakuman'] },
      { name: '三倍役满', limitTier: 'yakuman', yakumanMultiplier: 3, expected: 'yaku.triple_yakuman', forbidden: ['score.sanbaiman'] },
    ];

    cases.forEach(({ name, limitTier, yakumanMultiplier, expected, forbidden }) => {
      const event = scored({ limitTier, yakumanMultiplier, totalDora: 0 });
      const diagnostic = describeWinVoiceSequence(event);
      expect(diagnostic, name).toMatchObject({ winnerId: 1, winType: 'ron', limitTier, yakumanMultiplier, totalDora: 0, yaku: [] });
      const finalKey = diagnostic.voiceKeys[diagnostic.voiceKeys.length - 1];
      expect(finalKey, name).toBe(expected ?? 'action.ron');
      forbidden.forEach((key) => expect(diagnostic.voiceKeys, name).not.toContain(key));
    });
  });
});
