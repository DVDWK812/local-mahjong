import type { CallSet, Tile } from '../types';
import { PATTERNS, type Pattern, type XzRules } from './config';
import type { Score, Suit, WinContext } from './types';
export const suitOf = (id: number): Suit => Math.floor(id / 9) as Suit;
export function missingSatisfied(hand: readonly Tile[], melds: readonly CallSet[], missing: Suit | null, rules: XzRules): boolean {
  const suits = new Set([...hand, ...melds.flatMap(m => m.tiles)].map(t => suitOf(t.id)));
  return rules.missing === 'declared' ? missing !== null && !suits.has(missing) : suits.size < 3;
}
type Group = number[];
export function decompositions(ids: readonly number[], needed: number): Group[][] {
  const counts = Array(27).fill(0) as number[];
  ids.forEach(id => counts[id]++);
  const output: Group[][] = [];
  function melds(groups: Group[], pair: Group): void {
    const i = counts.findIndex(n => n > 0);
    if (i < 0) { if (groups.length === needed) output.push([pair, ...groups]); return; }
    if (groups.length >= needed) return;
    if (counts[i] >= 3) { counts[i] -= 3; melds([...groups, [i, i, i]], pair); counts[i] += 3; }
    if (i % 9 < 7 && counts[i + 1] && counts[i + 2]) { counts[i]--; counts[i + 1]--; counts[i + 2]--; melds([...groups, [i, i + 1, i + 2]], pair); counts[i]++; counts[i + 1]++; counts[i + 2]++; }
  }
  for (let i = 0; i < 27; i++) if (counts[i] >= 2) { counts[i] -= 2; melds([], [i, i]); counts[i] += 2; }
  return output;
}
export function scoreHand(hand: readonly Tile[], melds: readonly CallSet[], missing: Suit | null, rules: XzRules, context: WinContext): Score | null {
  if (hand.length !== 14 - melds.length * 3 || !missingSatisfied(hand, melds, missing, rules)) return null;
  const all = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = Array(27).fill(0) as number[];
  for (const tile of all) { if (tile.id > 26 || ++counts[tile.id] > 4) return null; }
  const candidates: Array<{ shape: Score['shape']; groups: Group[] }> = decompositions(hand.map(t => t.id), 4 - melds.length).map(groups => ({ shape: 'normal', groups: [...groups, ...melds.map(m => m.tiles.map(t => t.id))] }));
  if (!melds.length && rules.patterns.sevenPairs.enabled && counts.every(n => n % 2 === 0)) candidates.push({ shape: 'sevenPairs', groups: [] });
  let best: Score | null = null;
  for (const { shape, groups } of candidates) {
    const patterns: Score['patterns'] = [];
    const add = (id: Pattern, condition: boolean, times = 1) => { const p = rules.patterns[id]; if (p.enabled && condition) patterns.push({ id, name: PATTERNS[id][0], fan: p.fan * times }); };
    add('sevenPairs', shape === 'sevenPairs');
    add('allTriplets', shape === 'normal' && groups.slice(1).every(g => g.every(id => id === g[0])));
    add('pure', new Set(all.map(t => suitOf(t.id))).size === 1);
    const roots = counts.filter(n => n === 4).length;
    add('root', roots > 0, roots);
    add('concealed', melds.every(m => m.kanType === 'ankan'));
    add('middle', all.every(t => t.rank !== 1 && t.rank !== 9));
    add('singlePair', shape === 'normal' && melds.length === 4);
    add('jiang', shape === 'normal' && all.every(t => [2, 5, 8].includes(t.rank)));
    add('terminals', shape === 'normal' && groups.every(g => g.some(id => id % 9 === 0 || id % 9 === 8)));
    add('kongDraw', context.kind === 'draw' && !!context.kong);
    add('kongDiscard', context.kind === 'discard' && !!context.kong);
    add('robKong', context.kind === 'rob');
    add('lastDraw', context.kind === 'draw' && !!context.last);
    add('lastDiscard', context.kind === 'discard' && !!context.last);
    add('heaven', context.kind === 'draw' && !!context.heaven);
    add('earth', context.kind === 'discard' && !!context.earth);
    const fan = patterns.reduce((n, p) => n + p.fan, 0), cap = (f: number) => rules.cap ? Math.min(f, rules.cap) : f;
    const cappedFan = cap(fan), base = rules.base * 2 ** cappedFan;
    const extra = context.kind === 'draw' ? rules.selfDrawExtra : 0;
    const payment = rules.selfDraw === 'fan' ? rules.base * 2 ** (rules.extraAfterCap ? cappedFan + extra : cap(fan + extra)) : base + (rules.selfDraw === 'base' ? rules.base * extra : 0);
    const label = shape === 'sevenPairs' ? `${patterns.some(p => p.id === 'pure') ? '清' : ''}${roots ? '龙' : ''}七对` : patterns.some(p => p.id === 'allTriplets') && patterns.some(p => p.id === 'pure') ? '清对' : patterns.length ? patterns.map(p => p.name).join('·') : '平胡';
    const candidate: Score = { shape, patterns, fan, cappedFan, base, payment, label };
    if (!best || candidate.payment > best.payment || (candidate.payment === best.payment && candidate.fan > best.fan)) best = candidate;
  }
  return best;
}
