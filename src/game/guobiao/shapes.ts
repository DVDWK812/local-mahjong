import type { TileId } from '../types';
import type { GbGroup, GbShape } from './types';

export const KNITTED_IDS: readonly TileId[][] = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].map(p =>
  p.flatMap((s, i) => [i + s * 9, i + 3 + s * 9, i + 6 + s * 9]) as TileId[]);
const ORPHANS = [0,8,9,17,18,26,27,28,29,30,31,32,33];
/** Enumerates every grouping and every possible winning-tile attribution. Flowers never enter this function. */
export function decomposeGb(ids: readonly TileId[], fixed: readonly GbGroup[] = [], win?: TileId): GbShape[] {
  if (fixed.some(g => !g.fixed || !['chi','pon','kan'].includes(g.kind) || typeof g.opened !== 'boolean'
    || g.kind !== 'kan' && !g.opened
    || g.ids.length !== (g.kind === 'kan' ? 4 : 3)
    || g.ids.some(id => !Number.isInteger(id) || id < 0 || id > 33)
    || (g.kind === 'chi' ? g.ids[0] >= 27 || g.ids[0] % 9 > 6 || g.ids.some((id,i) => id !== g.ids[0]+i)
      : g.ids.some(id => id !== g.ids[0])))) return [];
  const counts = Array<number>(34).fill(0); for (const id of ids) { if (!Number.isInteger(id) || id < 0 || id > 33) return []; counts[id]++; }
  const physical = [...counts]; for (const group of fixed) for (const id of group.ids) physical[id]++;
  if (physical.some(c => c > 4) || fixed.length > 4 || ids.length !== 14 - fixed.length * 3) return [];
  const shapes: GbShape[] = [];
  const add = (groups: GbGroup[], pair: TileId) => {
    const matches = groups.flatMap((g, i) => !g.fixed && (win === undefined || g.ids.includes(win)) ? [i] : []);
    if (win === undefined || pair === win) matches.push(groups.length);
    for (const winGroup of matches) shapes.push({ kind: 'ordinary', groups, pair, winGroup });
  };
  function melds(c: number[], groups: GbGroup[], pair: TileId) {
    const id = c.findIndex(n => n > 0);
    if (id < 0) { if (groups.length + fixed.length === 4) add([...fixed, ...groups], pair); return; }
    if (groups.length + fixed.length >= 4) return;
    if (c[id] >= 3) { c[id] -= 3; melds(c, [...groups, { kind: 'pon', ids: [id,id,id] as TileId[], opened: false, fixed: false }], pair); c[id] += 3; }
    if (id < 27 && id % 9 <= 6 && c[id+1] && c[id+2]) {
      c[id]--; c[id+1]--; c[id+2]--; melds(c, [...groups, { kind: 'chi', ids: [id,id+1,id+2] as TileId[], opened: false, fixed: false }], pair); c[id]++; c[id+1]++; c[id+2]++;
    }
  }
  for (let pair = 0; pair < 34; pair++) if (counts[pair] >= 2) {
    const c = [...counts]; c[pair] -= 2; melds(c, [], pair as TileId);
    if (fixed.length <= 1) for (const knitted of KNITTED_IDS) {
      const rest = [...c]; if (knitted.some(id => --rest[id] < 0)) continue;
      const groups: GbGroup[] = [0,1,2].map(i => ({ kind: 'knitted', ids: knitted.slice(i*3,i*3+3), opened: false, fixed: false }));
      melds(rest, groups, pair as TileId);
    }
  }
  if (!fixed.length) {
    if (counts.every(c => c % 2 === 0)) shapes.push({ kind: 'seven-pairs', groups: [], winGroup: -1 });
    if (ORPHANS.every(id => counts[id] >= 1) && counts.every((c,id) => !c || ORPHANS.includes(id))) shapes.push({ kind: 'orphans', groups: [], winGroup: -1 });
    if (counts.every(c => c <= 1) && KNITTED_IDS.some(k => ids.every(id => id >= 27 || k.includes(id)))) shapes.push({ kind: 'unconnected', groups: [], winGroup: -1 });
  }
  return shapes;
}
