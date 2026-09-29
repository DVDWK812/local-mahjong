import { evaluateWin, type WinContext } from '../scoreCalculator';
import { calculatePoints, type PointResult } from '../score/pointCalculator';
import type { Tile, Wind } from '../types';
import { sanmaDora } from './wall';
import { closedHand, sanmaWaits } from './hand';
import { SANMA_SEATS, type SanmaSeat, type SanmaState, type SanmaScore, type SanmaResponse, type SanmaLedgerEntry } from './types';

export const seatWind = (s: SanmaState, seat: SanmaSeat): Wind => (['east', 'south', 'west'] as const)[(seat - s.dealer + 3) % 3];
export const handTiles = (s: SanmaState, seat: SanmaSeat): Tile[] => s.players[seat].hand.map(i => s.wall.tiles[i]);
export const meldTiles = (s: SanmaState, seat: SanmaSeat): Tile[][] => s.players[seat].melds.map(m => m.tiles.map(i => s.wall.tiles[i]));
export const waitsFor = (s: SanmaState, seat: SanmaSeat) => sanmaWaits(handTiles(s, seat), meldTiles(s, seat));
export function indicators(s: SanmaState, ura = false): Tile[] { return Array.from({ length: s.kanCount + 1 }, (_, i) => s.wall.tiles[s.wall.indicators[i * 2 + (ura ? 1 : 0)]]); }
export function furiten(s: SanmaState, seat: SanmaSeat): boolean {
  const p = s.players[seat];
  return p.temporaryFuriten || p.permanentFuriten || p.river.some(r => waitsFor(s, seat).includes(s.wall.tiles[r.index].id));
}
export function scoreSanma(s: SanmaState, seat: SanmaSeat, index: number, source: 'tsumo' | SanmaResponse['kind']): SanmaScore | null {
  const p = s.players[seat], tile = s.wall.tiles[index], tsumo = source === 'tsumo';
  if (!tile || !tsumo && furiten(s, seat)) return null;
  const concealed = handTiles(s, seat), hand = tsumo ? concealed : [...concealed, tile];
  if (hand.length !== 14 - p.melds.length * 3) return null;
  const isRinshan = tsumo && (p.drawOrigin === 'kan' || p.drawOrigin === 'north');
  const ctx: WinContext = { winTile: tile, winningTile: tile, winType: tsumo ? 'tsumo' : 'ron', isTsumo: tsumo,
    isRiichi: p.riichi, isDoubleRiichi: p.doubleRiichi, isIppatsu: p.ippatsu, isMenzen: closedHand(p.melds),
    roundWind: s.roundWind, seatWind: seatWind(s, seat), doraIndicators: [], uraDoraIndicators: [], honba: 0, riichiSticks: 0,
    ruleConfig: s.config.rules, callsOccurred: s.interrupted, isFirstTurn: !s.interrupted && p.discards === 0,
    isTenhou: tsumo && seat === s.dealer && !s.interrupted && p.discards === 0 && p.drawOrigin === 'initial',
    isChiihou: tsumo && seat !== s.dealer && !s.interrupted && p.draws === 1 && p.discards === 0,
    isRinshan, isChankan: source === 'kakan', isHaitei: tsumo && p.drawOrigin === 'live' && s.wall.live.length === 0,
    isHoutei: source === 'discard' && s.wall.live.length === 0 && s.players[s.response?.actor ?? s.current].drawOrigin === 'live',
    // Independent flags define north-draw/rob-north yaku; no synthetic Kan event or source.
    preWinHand: tsumo ? concealed.filter(t => t.instanceId !== tile.instanceId) : concealed,
    melds: p.melds.map(m => ({ type: m.kind === 'pon' ? 'triplet' as const : 'kan' as const, tiles: m.tiles.map(i => s.wall.tiles[i]),
      ids: m.tiles.map(i => s.wall.tiles[i].id), open: m.kind !== 'ankan', kanType: m.kind === 'pon' ? undefined : m.kind,
      calledFrom: m.from, calledTile: m.called === null ? undefined : s.wall.tiles[m.called] })) };
  const raw = evaluateWin(hand, ctx);
  if (!raw.isWinning || !raw.yaku.some(y => y.yakuman || y.han > 0)) return null;
  if (source === 'ankan' && !raw.yaku.some(y => y.id === 'kokushi' || y.id === 'kokushi-13-wait')) return null;
  const full = [...hand, ...meldTiles(s, seat).flat(), ...p.north.map(i => s.wall.tiles[i])];
  const count = (ds: Tile[]) => ds.reduce((n, d) => n + full.filter(t => t.id === sanmaDora(d.id)).length, 0);
  const dora = count(indicators(s)), uraDora = p.riichi ? count(indicators(s, true)) : 0, redDora = full.filter(t => t.red).length, northDora = p.north.length;
  const totalDora = dora + uraDora + redDora + northDora;
  const han = raw.yakumanValue ? raw.han : raw.yaku.reduce((n, y) => n + y.han, 0) + totalDora;
  const points = calculatePoints(han, raw.fu, ctx, raw.yakumanValue);
  return { ...raw, han, dora, uraDora, redDora, northDora, totalDora, points, limitTier: points.limitTier };
}
export const ceil100 = (n: number) => Math.ceil(n / 100) * 100;
export function sanmaPayments(points: PointResult, winner: SanmaSeat, dealer: SanmaSeat, policy: SanmaState['config']['tsumoPolicy']): Array<{ from: SanmaSeat; amount: number }> {
  const missing = points.tsumoChild ?? 0;
  const compensation = policy === 'loss' ? 0 : ceil100(missing / 2);
  return SANMA_SEATS.filter(i => i !== winner).map(from => ({ from, amount: (winner === dealer || from !== dealer ? points.tsumoChild ?? 0 : points.tsumoDealer ?? 0) + compensation }));
}
export function transfer(s: SanmaState, from: SanmaSeat | 'pot', to: SanmaSeat | 'pot', amount: number, reason: SanmaLedgerEntry['reason']): void {
  if (!amount || from === to) return;
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('结算金额无效');
  if (from === 'pot') s.pot -= amount; else s.players[from].score -= amount;
  if (to === 'pot') s.pot += amount; else s.players[to].score += amount;
  s.ledger.push({ id: s.ledger.length + 1, round: s.roundSerial, transaction: s.sequence, from, to, amount, reason });
}
/** Liability applies only to its named yakuman component; all other components retain normal payments. */
export function settleBase(s: SanmaState, winner: SanmaSeat, from: SanmaSeat | null, score: SanmaScore, reason: 'win' | 'nagashi' = 'win'): void {
  const p = s.players[winner], liabilities = (['daisangen', 'daisuushii'] as const).flatMap(id => {
    const y = score.yaku.find(y => y.id === id), responsible = p.liability[id];
    return y && responsible !== undefined ? [{ responsible, value: y.yakumanValue ?? 1 }] : [];
  });
  const liabilityValue = liabilities.reduce((n, l) => n + l.value, 0);
  for (const l of liabilities) {
    const amount = (winner === s.dealer ? 48000 : 32000) * l.value;
    if (from === null || from === l.responsible) transfer(s, l.responsible, winner, amount, 'liability');
    else { transfer(s, from, winner, amount / 2, 'liability'); transfer(s, l.responsible, winner, amount / 2, 'liability'); }
  }
  let points = score.points;
  if (liabilityValue) {
    const remaining = Math.max(0, score.yakumanValue - liabilityValue);
    if (!remaining) return;
    const base = 8000 * remaining;
    points = from !== null ? { ron: base * (winner === s.dealer ? 6 : 4), total: 0, limitTier: 'yakuman' }
      : { tsumoDealer: base * 2, tsumoChild: base * (winner === s.dealer ? 2 : 1), total: 0, limitTier: 'yakuman' };
  }
  if (from !== null) transfer(s, from, winner, points.ron ?? 0, reason);
  else for (const payment of sanmaPayments(points, winner, s.dealer, s.config.tsumoPolicy)) transfer(s, payment.from, winner, payment.amount, reason);
}
