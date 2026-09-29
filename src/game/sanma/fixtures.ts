import type { TileId } from '../types';
import { createSanmaConfig, type SanmaConfig } from './config';
import { createSanma } from './engine';
import { assertSanma } from './invariants';
import { transfer, waitsFor } from './scoring';
import type { SanmaMeld, SanmaSeat, SanmaState } from './types';

export interface FixturePlayer {
  hand?: number[]; north?: number; river?: number[];
  melds?: Array<{ kind: SanmaMeld['kind']; id: number; from?: SanmaSeat }>;
  riichi?: boolean; ippatsu?: boolean; temporaryFuriten?: boolean; permanentFuriten?: boolean;
}
export interface SanmaFixture {
  players?: Partial<Record<SanmaSeat, FixturePlayer>>; current?: SanmaSeat; dealer?: SanmaSeat;
  drawn?: boolean; drawOrigin?: 'initial' | 'live' | 'kan' | 'north'; replacements?: number[]; indicators?: number[];
  liveHead?: number[]; liveCount?: number; roundWind?: SanmaState['roundWind']; handNumber?: number; honba?: number;
  scores?: number[]; pot?: number; interrupted?: boolean; drainTo?: SanmaSeat[];
}
/** Test-only full snapshot constructor. Allocates real indices; cannot manufacture fifth copies or omit tiles. */
export function sanmaFixture(spec: SanmaFixture, config: SanmaConfig = createSanmaConfig(), seed = 100): SanmaState {
  const s = createSanma(config, seed), pool = new Set(s.wall.tiles.map((_, i) => i));
  s.current = spec.current ?? 0; s.dealer = spec.dealer ?? config.initialDealer; s.interrupted = spec.interrupted ?? true;
  s.roundWind = spec.roundWind ?? 'east'; s.handNumber = spec.handNumber ?? 1; s.honba = spec.honba ?? 0;
  s.events = []; s.actions = []; s.kanCount = 0;
  const take = (id?: number): number => { const choices = [...pool].filter(i => id === undefined || s.wall.tiles[i].id === id); if (id !== undefined) choices.sort((a, b) => Number(s.wall.tiles[a].red) - Number(s.wall.tiles[b].red)); const index = choices[0]; if (index === undefined) throw new Error(`Fixture 无可分配牌：${id}`); pool.delete(index); return index; };
  for (const p of s.players) { p.hand = []; p.river = []; p.melds = []; p.north = []; p.drawn = null; p.discards = 1; p.draws = 1; }
  for (const p of s.players) {
    const fp = spec.players?.[p.id] ?? {};
    p.north = Array.from({ length: fp.north ?? 0 }, () => take(30));
    p.melds = (fp.melds ?? []).map(m => {
      const tiles = Array.from({ length: m.kind === 'pon' ? 3 : 4 }, () => take(m.id));
      const from = m.kind === 'ankan' ? p.id : m.from ?? ((p.id + 2) % 3) as SanmaSeat;
      if (m.kind !== 'pon') s.kanCount++;
      const called = m.kind === 'ankan' ? null : tiles[tiles.length - 1];
      if (called !== null) s.players[from].river.push({ index: called, claimed: true, riichi: false, tsumogiri: false });
      return { kind: m.kind, tiles, from, called };
    });
    p.hand = (fp.hand ?? []).map(take);
    p.river.push(...(fp.river ?? []).map(id => ({ index: take(id), claimed: false, riichi: false, tsumogiri: false })));
    p.riichi = fp.riichi ?? false; p.ippatsu = fp.ippatsu ?? false;
    p.temporaryFuriten = fp.temporaryFuriten ?? false; p.permanentFuriten = fp.permanentFuriten ?? false;
  }
  // Reserve scripted future locations before filling unspecified hands.
  const replacementIndices = (spec.replacements ?? []).map(take), indicatorIndices = (spec.indicators ?? []).map(take), liveHead = (spec.liveHead ?? []).map(take);
  for (const p of s.players) {
    const expected = 13 - p.melds.length * 3 + (s.current === p.id ? 1 : 0);
    if (spec.players?.[p.id]?.hand && p.hand.length !== expected) throw new Error(`Fixture 玩家${p.id}指定手牌数${p.hand.length}，应为${expected}`);
    while (p.hand.length < expected) p.hand.push(take());
    if (s.current === p.id && spec.drawn !== false) { p.drawn = p.hand[p.hand.length - 1]; p.drawOrigin = spec.drawOrigin ?? 'live'; }
    else if (s.current === p.id) p.forbiddenDiscard = p.melds[p.melds.length - 1] ? s.wall.tiles[p.melds[p.melds.length - 1].tiles[0]].id : null;
  }
  while (replacementIndices.length < 4) replacementIndices.push(take());
  while (indicatorIndices.length < 10) indicatorIndices.push(take());
  s.wall.replacements = replacementIndices; s.wall.indicators = indicatorIndices;
  s.wall.live = [...liveHead, ...pool]; s.wall.replacementCount = s.kanCount + s.players.reduce((n, p) => n + p.north.length, 0);
  if (spec.liveCount !== undefined) {
    // Past normal draws become genuine unclaimed river ownership, never deleted from the wall.
    const excess = s.wall.live.splice(spec.liveCount);
    const targets = spec.drainTo ?? [0, 1, 2];
    excess.forEach((index, i) => s.players[targets[i % targets.length]].river.push({ index, claimed: false, riichi: false, tsumogiri: false }));
  }
  s.wall.used = s.players.flatMap(p => [...p.hand, ...p.north, ...p.melds.flatMap(m => m.tiles), ...p.river.filter(r => !r.claimed).map(r => r.index)]);
  s.abortAfterDiscard = s.kanCount === 4 && s.players.filter(p => p.melds.some(m => m.kind !== 'pon')).length > 1;
  for (const p of s.players) if (p.riichi) {
    const drawn = p.drawn; if (drawn !== null) p.hand = p.hand.filter(i => i !== drawn);
    p.riichiWaits = waitsFor(s, p.id);
    if (drawn !== null) p.hand.push(drawn);
  }
  if (spec.pot) transfer(s, 0, 'pot', spec.pot, 'riichi');
  if (spec.scores) {
    if (spec.scores.reduce((a, b) => a + b, s.pot) !== config.startingPoints * 3) throw new Error('Fixture 点棒总额错误');
    for (let payer = 0; payer < 3; payer++) for (let winner = 0; winner < 3; winner++) {
      const amount = Math.min(s.players[payer].score - spec.scores[payer], spec.scores[winner] - s.players[winner].score);
      if (amount > 0) transfer(s, payer as SanmaSeat, winner as SanmaSeat, amount, 'win');
    }
  }
  s.roundStartScores = s.players.map(p => p.score);
  assertSanma(s); return s;
}
export function fixtureTile(s: SanmaState, seat: SanmaSeat, id: number): string {
  const index = s.players[seat].hand.find(i => s.wall.tiles[i].id === id); if (index === undefined) throw new Error(`手牌缺少${id}`); return s.wall.tiles[index].instanceId;
}
export const NORTH_HAND = [9, 10, 11, 12, 13, 14, 18, 19, 20, 23, 24, 27, 27, 30];
export const NORTH_WAIT = [9, 10, 11, 12, 13, 14, 18, 19, 20, 31, 31, 31, 30];
export const NORTH_WAIT_2 = [15, 16, 17, 21, 22, 23, 24, 25, 26, 32, 32, 32, 30];
export const NO_YAKU_NORTH_WAIT = [9, 10, 11, 12, 13, 14, 18, 19, 20, 24, 25, 26, 30];
export const ORPHANS_HAND = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
export const asIds = (ids: number[]) => ids as TileId[];
