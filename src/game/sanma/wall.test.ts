import { describe, it, expect } from 'vitest';
import { assertWall, canReplace, createSanmaWall, SANMA_TILE_IDS, sanmaDora, takeLive, takeReplacement } from './wall';
import { createSanma, legalSanmaActions, applySanma } from './engine';
import { assertSanma } from './invariants';
import type { SanmaAction } from './types';

describe('SANMA-0/1 墙契约与三人骨架', () => {
  it('108张、两张替换赤牌、真实三人、开局余牌54、无第四账户', () => {
    const s = createSanma(); assertSanma(s);
    expect(s.wall.tiles).toHaveLength(108); expect(s.players.map(p => p.hand.length)).toEqual([14, 13, 13]);
    expect(s.wall.live).toHaveLength(54); expect(s.players.map(p => p.participantId)).toEqual(['sanma:0', 'sanma:1', 'sanma:2']);
    expect(s.wall.tiles.filter(t => t.red).map(t => t.id).sort()).toEqual([13, 22]);
    expect(SANMA_TILE_IDS).toHaveLength(27);
  });
  it('穷举四杠四北所有顺序，实体分配与14张边界始终互斥', () => {
    let paths = 0;
    for (let bits = 0; bits < 256; bits++) {
      if (bits.toString(2).replace(/0/g, '').length !== 4) continue;
      const w = createSanmaWall(bits, 0); for (let n = 0; n < 40; n++) takeLive(w);
      const fixed = [...w.indicators], drawn = new Set<number>(); let kans = 0;
      for (let i = 0; i < 8; i++) {
        if (bits & (1 << i)) kans++;
        const tile = takeReplacement(w)!; expect(drawn.has(tile)).toBe(false); drawn.add(tile);
        expect(w.indicators).toEqual(fixed); expect(w.live).toHaveLength(53 - i); expect(w.replacements.length + w.indicators.length).toBe(14);
        expect(w.indicators.slice(0, (kans + 1) * 2).some(index => drawn.has(index))).toBe(false); assertWall(w);
      }
      expect(canReplace(w)).toBe(false); expect(takeReplacement(w)).toBeUndefined(); paths++;
    }
    expect(paths).toBe(70);
  });
  it('墙尽禁止补牌，指示牌一九万循环及西指北', () => {
    const w = createSanmaWall(42, 0); while (w.live.length) takeLive(w);
    expect(takeReplacement(w)).toBeUndefined(); assertWall(w);
    expect([sanmaDora(0), sanmaDora(8), sanmaDora(29)]).toEqual([8, 0, 30]);
  });
  it('Rules拒绝直接Chi、他人出牌与旧实例，不能只依赖UI', () => {
    const s = createSanma();
    expect(applySanma(s, 0, { type: 'chi' } as unknown as SanmaAction)).toBe(s);
    expect(legalSanmaActions(s, 1)).toEqual([]);
    expect(applySanma(s, 0, { type: 'discard', tile: 'stale' })).toBe(s);
    const a = legalSanmaActions(s, 0).find(a => a.type === 'discard')!;
    const next = applySanma(s, 0, a); assertSanma(next); expect(applySanma(next, 0, a)).toBe(next);
  });
});
