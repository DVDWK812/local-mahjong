import type { AIPlayerSetting } from '../../components/MatchSettings';
import type { Tile } from '../types';
import { legalSanmaActions } from './engine';
import { closedHand, isOrphan, sanmaShanten, sanmaUkeire } from './hand';
import { handTiles, indicators, meldTiles, sanmaPayments } from './scoring';
import { SANMA_TILE_IDS } from './wall';
import type { SanmaAction, SanmaSeat, SanmaState } from './types';

export interface SanmaObservation {
  seat: SanmaSeat; dealer: SanmaSeat; roundWind: SanmaState['roundWind']; random: number; legal: SanmaAction[]; hand: Tile[]; melds: Tile[][];
  north: Tile[]; ownRiichi: boolean; menzen: boolean; drawnId: string | null; availableTileIds: typeof SANMA_TILE_IDS;
  opponents: Array<{ seat: SanmaSeat; riichi: boolean; score: number; river: Tile[]; melds: Tile[][]; north: Tile[] }>;
  visible: Tile[]; doraIndicators: Tile[]; liveCount: number; responseTile: Tile | null;
  tsumoPolicy: SanmaState['config']['tsumoPolicy']; expectedTsumoIncome: number;
}
/** No state, future wall, opponent hand or ura object crosses this boundary. */
export function observeSanma(s: SanmaState, seat: SanmaSeat): SanmaObservation {
  const p = s.players[seat], hand = handTiles(s, seat), melds = meldTiles(s, seat), doraIndicators = indicators(s);
  const publicTiles = s.players.flatMap(q => [...q.river.filter(r => !r.claimed).map(r => s.wall.tiles[r.index]), ...q.melds.flatMap(m => m.tiles.map(i => s.wall.tiles[i])), ...q.north.map(i => s.wall.tiles[i])]);
  return { seat, dealer: s.dealer, roundWind: s.roundWind, random: s.random, legal: structuredClone(legalSanmaActions(s, seat)), hand: hand.map(t => ({ ...t })), melds,
    north: p.north.map(i => ({ ...s.wall.tiles[i] })), ownRiichi: p.riichi, menzen: closedHand(p.melds), drawnId: p.drawn === null ? null : s.wall.tiles[p.drawn].instanceId,
    availableTileIds: SANMA_TILE_IDS, opponents: s.players.filter(q => q.id !== seat).map(q => ({ seat: q.id, riichi: q.riichi, score: q.score,
      river: q.river.map(r => ({ ...s.wall.tiles[r.index] })), melds: meldTiles(s, q.id), north: q.north.map(i => ({ ...s.wall.tiles[i] })) })),
    visible: [...hand, ...publicTiles, ...doraIndicators].map(t => ({ ...t })), doraIndicators, liveCount: s.wall.live.length,
    responseTile: s.response ? { ...s.wall.tiles[s.response.tile] } : null, tsumoPolicy: s.config.tsumoPolicy,
    expectedTsumoIncome: sanmaPayments({ tsumoDealer: 4000, tsumoChild: seat === s.dealer ? 4000 : 2000, total: 0, limitTier: 'mangan' }, seat, s.dealer, s.config.tsumoPolicy).reduce((n, p) => n + p.amount, 0) };
}
const fallbackSetting: AIPlayerSetting = { playerId: 1, difficulty: 'shintentai', personality: 'balanced' };
export function chooseSanmaAction(o: SanmaObservation, setting: AIPlayerSetting = fallbackSetting): SanmaAction | undefined {
  const legal = o.legal;
  const win = legal.find(a => a.type === 'ron' || a.type === 'tsumo'); if (win) return win;
  const next = legal.find(a => a.type === 'next'); if (next) return next;
  const riichi = legal.filter((a): a is Extract<SanmaAction, { tile: string }> => a.type === 'riichi');
  const north = legal.find(a => a.type === 'north');
  if (north && 'tile' in north) {
    const retained = o.hand.filter(t => t.instanceId !== north.tile), count = o.hand.filter(t => t.id === 30).length;
    const uniqueOrphans = new Set(o.hand.filter(t => isOrphan(t.id)).map(t => t.id)).size;
    // Preserve a useful north pair/triplet or the unique kokushi component. Bonus value uses the active payment policy.
    const bestDiscardDistance = Math.min(...legal.filter(a => a.type === 'discard' && 'tile' in a).map(a => sanmaShanten(o.hand.filter(t => t.instanceId !== (a as { tile: string }).tile), o.melds)));
    const extractionDistance = sanmaShanten(retained, o.melds);
    if (o.ownRiichi || (uniqueOrphans < 10 || count > 1) && (count === 1 || extractionDistance <= bestDiscardDistance)
      && extractionDistance <= bestDiscardDistance + (o.expectedTsumoIncome >= 8000 && count === 1 ? 1 : 0)) return north;
  }
  const kan = legal.find(a => a.type === 'ankan' || a.type === 'kakan');
  if (kan && (setting.personality !== 'defensive' || !o.opponents.some(p => p.riichi))) return kan;
  const abort = legal.find(a => a.type === 'abort');
  if (abort && new Set(o.hand.filter(t => isOrphan(t.id)).map(t => t.id)).size < 11) return abort;
  if (legal.some(a => a.type === 'pass')) {
    const call = legal.find(a => a.type === 'minkan') ?? legal.find(a => a.type === 'pon');
    if (call && o.responseTile) {
      const id = o.responseTile.id, seatWind = 27 + (o.seat - o.dealer + 3) % 3;
      const roundWind = 27 + ['east', 'south', 'west', 'north'].indexOf(o.roundWind);
      const valueHonor = id >= 31 || id === seatWind || id === roundWind;
      const openYaku = o.melds.some(m => m[0].id >= 31 || m[0].id === seatWind || m[0].id === roundWind) || o.hand.every(t => !isOrphan(t.id)) && !isOrphan(id);
      const own = [...o.hand]; let removed = 0;
      const remaining = own.filter(t => t.id !== id || ++removed > (call.type === 'pon' ? 2 : 3));
      const current = sanmaShanten(o.hand, o.melds), after = sanmaShanten(remaining, [...o.melds, [o.responseTile, o.responseTile, o.responseTile]]);
      if ((valueHonor || openYaku) && after <= current && (setting.personality !== 'defensive' || !o.opponents.some(p => p.riichi))) return call;
    }
    return legal.find(a => a.type === 'pass');
  }
  const discards = legal.filter((a): a is Extract<SanmaAction, { tile: string }> => a.type === 'discard');
  if (!discards.length) return legal[0];
  if (setting.difficulty === 'chikukon' && o.random % 7 === 0) return discards[o.random % discards.length];
  const ranked = discards.map(action => {
    const tile = o.hand.find(t => t.instanceId === action.tile)!, after = o.hand.filter(t => t !== tile), distance = sanmaShanten(after, o.melds);
    const threat = o.opponents.filter(p => p.riichi), safe = threat.every(p => p.river.some(t => t.id === tile.id));
    const defensive = setting.personality === 'defensive' ? 2.2 : setting.personality === 'aggressive' ? 0.25 : 0.8;
    const danger = threat.length && !safe ? defensive * (distance >= 1 ? 1 : 0.3) : 0;
    return { action, after, distance, value: distance + danger + (tile.red ? 0.08 : 0) };
  }).sort((a, b) => a.value - b.value);
  const best = ranked[0].value;
  const candidates = ranked.filter(a => a.value <= best + 0.001);
  const chosen = candidates.map(c => ({ ...c, waits: sanmaUkeire(c.after, o.melds, o.visible).reduce((n, w) => n + w.remaining, 0) })).sort((a, b) => b.waits - a.waits || a.action.tile.localeCompare(b.action.tile))[0].action;
  return riichi.find(a => a.tile === chosen.tile) ?? chosen;
}
