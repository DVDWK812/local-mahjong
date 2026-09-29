import type { TileId, Wind } from '../types';
import { snapshotSanmaConfig, createSanmaConfig, type SanmaConfig } from './config';
import { canReplace, createSanmaWall, nextRandom, takeLive, takeReplacement } from './wall';
import { closedHand, isOrphan, sanmaWaits } from './hand';
import { handTiles, meldTiles, scoreSanma, settleBase, transfer, waitsFor } from './scoring';
import { SANMA_SEATS, type SanmaAction, type SanmaEvent, type SanmaPlayer, type SanmaResponse, type SanmaScore, type SanmaSeat, type SanmaState, type SanmaWin } from './types';

export const participantId = (seat: SanmaSeat) => `sanma:${seat}`;
export const nextSeat = (seat: SanmaSeat): SanmaSeat => ((seat + 1) % 3) as SanmaSeat;
export const afterSeat = (seat: SanmaSeat): SanmaSeat[] => [nextSeat(seat), nextSeat(nextSeat(seat))];
const tileId = (s: SanmaState, index: number) => s.wall.tiles[index].id;
const sameWaits = (a: TileId[], b: TileId[]) => a.length > 0 && a.join(',') === b.join(',');
function player(seat: SanmaSeat, config: SanmaConfig, score = config.startingPoints): SanmaPlayer {
  return { id: seat, participantId: participantId(seat), name: config.names[seat], score, hand: [], river: [], melds: [], north: [], drawn: null, drawOrigin: 'initial',
    riichi: false, doubleRiichi: false, ippatsu: false, riichiWaits: [], temporaryFuriten: false, permanentFuriten: false, discards: 0, draws: 0, forbiddenDiscard: null, liability: {} };
}
export function createSanma(config = createSanmaConfig(), seed = 1): SanmaState {
  const c = snapshotSanmaConfig(config);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed 必须为32位无符号整数');
  const s: SanmaState = { config: c, seed, random: nextRandom(seed), roundSerial: 0, roundWind: 'east', handNumber: 1, dealer: c.initialDealer,
    honba: 0, pot: 0, players: SANMA_SEATS.map(seat => player(seat, c)), wall: createSanmaWall(seed, 0), current: c.initialDealer,
    phase: 'turn', turn: 0, sequence: 0, interrupted: false, kanCount: 0, abortAfterDiscard: false,
    response: null, result: null, completed: false, endReason: null, ranking: [], ledger: [], events: [], actions: [], roundStartScores: SANMA_SEATS.map(() => c.startingPoints) };
  deal(s); return s;
}
function emit(s: SanmaState, type: SanmaEvent['type'], actor: SanmaSeat, tile?: number, origin?: SanmaEvent['origin']) {
  s.events.push({ id: s.events.length + 1, round: s.roundSerial, type, actor, ...(tile !== undefined ? { tile } : {}), ...(origin ? { origin } : {}) });
}
function deal(s: SanmaState): void {
  for (let i = 0; i < 13; i++) for (let offset = 0; offset < 3; offset++) s.players[(s.dealer + offset) % 3].hand.push(takeLive(s.wall)!);
  draw(s, s.dealer, 'initial');
}
function draw(s: SanmaState, seat: SanmaSeat, origin: SanmaPlayer['drawOrigin']): void {
  const index = origin === 'kan' || origin === 'north' ? takeReplacement(s.wall) : takeLive(s.wall);
  if (index === undefined) throw new Error('引擎尝试非法空摸牌');
  const p = s.players[seat]; p.hand.push(index); p.drawn = index; p.drawOrigin = origin; p.draws++; p.temporaryFuriten = false; p.forbiddenDiscard = null;
  s.current = seat; s.phase = 'turn'; emit(s, 'draw', seat, index, origin);
}
function clone(s: SanmaState): SanmaState {
  return { ...s, wall: { ...s.wall, live: [...s.wall.live], replacements: [...s.wall.replacements], used: [...s.wall.used] },
    players: s.players.map(p => ({ ...p, hand: [...p.hand], river: p.river.map(r => ({ ...r })), melds: p.melds.map(m => ({ ...m, tiles: [...m.tiles] })), north: [...p.north], liability: { ...p.liability } })),
    response: s.response ? { ...s.response, choices: { ...s.response.choices } } : null,
    actions: [...s.actions], events: [...s.events], ledger: [...s.ledger] };
}
const legalCache = new WeakMap<SanmaState, Map<SanmaSeat, SanmaAction[]>>();
export function legalSanmaActions(s: SanmaState, seat: SanmaSeat): SanmaAction[] {
  let cache = legalCache.get(s); if (!cache) { cache = new Map(); legalCache.set(s, cache); }
  const cached = cache.get(seat); if (cached) return cached;
  const result = buildLegal(s, seat); cache.set(seat, result); return result;
}
function buildLegal(s: SanmaState, seat: SanmaSeat): SanmaAction[] {
  if (!SANMA_SEATS.includes(seat) || s.completed) return [];
  if (s.phase === 'ended') return seat === 0 ? [{ type: 'next' }] : [];
  if (s.phase === 'response') return s.response!.choices[seat] ? [] : s.response!.eligible[seat] ?? [];
  if (s.current !== seat) return [];
  const p = s.players[seat], actions: SanmaAction[] = [];
  const discards = p.hand.filter(i => (!p.riichi || i === p.drawn) && tileId(s, i) !== p.forbiddenDiscard);
  for (const index of discards) actions.push({ type: 'discard', tile: s.wall.tiles[index].instanceId });
  if (p.drawn !== null && scoreSanma(s, seat, p.drawn, 'tsumo')) actions.push({ type: 'tsumo' });
  if (p.drawn !== null && !s.interrupted && p.discards === 0 && new Set(p.hand.map(i => tileId(s, i)).filter(isOrphan)).size >= 9) actions.push({ type: 'abort' });
  if (!p.riichi && closedHand(p.melds) && p.score >= 1000 && s.wall.live.length >= 3) {
    for (const index of discards) if (sanmaWaits(p.hand.filter(i => i !== index).map(i => s.wall.tiles[i]), meldTiles(s, seat)).length) actions.push({ type: 'riichi', tile: s.wall.tiles[index].instanceId });
  }
  if (p.drawn === null || !canReplace(s.wall) || s.abortAfterDiscard) return actions;
  for (const index of p.hand.filter(i => tileId(s, i) === 30)) {
    if (!p.riichi || index === p.drawn && sameWaits(p.riichiWaits, sanmaWaits(p.hand.filter(i => i !== index).map(i => s.wall.tiles[i]), meldTiles(s, seat)))) actions.push({ type: 'north', tile: s.wall.tiles[index].instanceId });
  }
  if (s.kanCount >= 4) return actions;
  for (const id of new Set(p.hand.map(i => tileId(s, i)))) {
    const indices = p.hand.filter(i => tileId(s, i) === id);
    if (indices.length === 4) {
      const index: number = indices.includes(p.drawn) ? p.drawn : indices[0];
      if (!p.riichi || index === p.drawn && sameWaits(p.riichiWaits, sanmaWaits(p.hand.filter(i => !indices.includes(i)).map(i => s.wall.tiles[i]), [...meldTiles(s, seat), indices.map(i => s.wall.tiles[i])]))) actions.push({ type: 'ankan', tile: s.wall.tiles[index].instanceId });
    }
    if (!p.riichi && p.melds.some(m => m.kind === 'pon' && tileId(s, m.tiles[0]) === id)) for (const index of indices) actions.push({ type: 'kakan', tile: s.wall.tiles[index].instanceId });
  }
  return actions;
}
export function defaultSanmaAction(s: SanmaState, seat: SanmaSeat): SanmaAction | undefined {
  const legal = legalSanmaActions(s, seat);
  if (s.phase === 'response') return legal.find(a => a.type === 'pass');
  const drawn = s.players[seat].drawn;
  return legal.find(a => a.type === 'discard' && drawn !== null && a.tile === s.wall.tiles[drawn].instanceId)
    ?? legal.filter((a): a is Extract<SanmaAction, { tile: string }> => a.type === 'discard').sort((a, b) => a.tile.localeCompare(b.tile))[0]
    ?? legal.find(a => a.type === 'next');
}
export function applySanma(s: SanmaState, seat: SanmaSeat, action: SanmaAction): SanmaState {
  if (!legalSanmaActions(s, seat).some(a => JSON.stringify(a) === JSON.stringify(action))) return s;
  const n = clone(s); n.sequence++; n.random = nextRandom(n.random);
  n.actions.push({ sequence: n.sequence, actor: seat, action: { ...action } });
  if (action.type === 'next') { advanceRound(n); return n; }
  if (n.phase === 'response') {
    const response = n.response!; response.choices[seat] = action;
    if (action.type !== 'ron' && response.eligible[seat]?.some(a => a.type === 'ron')) {
      n.players[seat].temporaryFuriten = true; if (n.players[seat].riichi) n.players[seat].permanentFuriten = true;
    }
    emit(n, 'response', seat, response.tile);
    if (Object.keys(response.choices).length === Object.keys(response.eligible).length) resolveResponse(n);
    return n;
  }
  if (action.type === 'tsumo') { finishWins(n, [seat], n.players[seat].drawn!, null, 'tsumo'); return n; }
  if (action.type === 'abort') { finishDraw(n, '九种九牌', true); return n; }
  if (!('tile' in action)) return s;
  const index = n.players[seat].hand.find(i => n.wall.tiles[i].instanceId === action.tile)!;
  if (action.type === 'discard' || action.type === 'riichi') {
    const p = n.players[seat];
    p.hand = p.hand.filter(i => i !== index); p.river.push({ index, claimed: false, riichi: action.type === 'riichi', tsumogiri: index === p.drawn });
    if (p.riichi) p.ippatsu = false;
    p.drawn = null; p.discards++; p.forbiddenDiscard = null; emit(n, 'discard', seat, index);
    openResponse(n, { id: n.sequence, kind: 'discard', actor: seat, tile: index, eligible: {}, choices: {}, declarationRiichi: action.type === 'riichi' });
  } else if (action.type === 'north' || action.type === 'ankan' || action.type === 'kakan') {
    emit(n, action.type === 'north' ? 'north-declared' : 'kan-declared', seat, index);
    openResponse(n, { id: n.sequence, kind: action.type, actor: seat, tile: index, eligible: {}, choices: {},
      ...(action.type === 'kakan' ? { meldIndex: n.players[seat].melds.findIndex(m => m.kind === 'pon' && tileId(n, m.tiles[0]) === tileId(n, index)) } : {}) });
  }
  return n;
}
function openResponse(s: SanmaState, r: SanmaResponse): void {
  s.response = r; s.phase = 'response';
  for (const seat of afterSeat(r.actor)) {
    const options: SanmaAction[] = [], p = s.players[seat];
    if (scoreSanma(s, seat, r.tile, r.kind)) options.push({ type: 'ron' });
    if (r.kind === 'discard' && !p.riichi && s.wall.live.length > 0 && !s.abortAfterDiscard) {
      const matching = p.hand.filter(i => tileId(s, i) === tileId(s, r.tile));
      if (matching.length >= 2 && p.hand.some(i => tileId(s, i) !== tileId(s, r.tile))) options.push({ type: 'pon' });
      if (matching.length === 3 && s.kanCount < 4 && canReplace(s.wall)) options.push({ type: 'minkan' });
    }
    if (options.length) r.eligible[seat] = [...options, { type: 'pass' }];
  }
  if (!Object.keys(r.eligible).length) resolveResponse(s);
}
function interrupt(s: SanmaState): void { s.interrupted = true; for (const p of s.players) p.ippatsu = false; }
function commitRiichi(s: SanmaState, r: SanmaResponse): void {
  if (!r.declarationRiichi) return;
  const p = s.players[r.actor]; p.riichi = true; p.doubleRiichi = !s.interrupted && p.discards === 1; p.ippatsu = true; p.riichiWaits = waitsFor(s, r.actor);
  transfer(s, r.actor, 'pot', 1000, 'riichi'); emit(s, 'riichi', r.actor, r.tile);
}
function resolveResponse(s: SanmaState): void {
  const r = s.response!, winners = afterSeat(r.actor).filter(seat => r.choices[seat]?.type === 'ron');
  if (winners.length) { finishWins(s, winners, r.tile, r.actor, r.kind); return; }
  if (r.kind !== 'discard') {
    const p = s.players[r.actor];
    if (r.kind === 'north') {
      p.hand = p.hand.filter(i => i !== r.tile); p.north.push(r.tile); interrupt(s); emit(s, 'north', r.actor, r.tile);
    } else {
      if (r.kind === 'ankan') {
        const indices = p.hand.filter(i => tileId(s, i) === tileId(s, r.tile)); p.hand = p.hand.filter(i => !indices.includes(i));
        p.melds.push({ kind: 'ankan', tiles: indices, from: r.actor, called: null });
      } else { const meld = p.melds[r.meldIndex!]; meld.kind = 'kakan'; meld.tiles.push(r.tile); p.hand = p.hand.filter(i => i !== r.tile); }
      completeKan(s, r.actor, r.tile);
    }
    s.response = null; draw(s, r.actor, r.kind === 'north' ? 'north' : 'kan'); return;
  }
  commitRiichi(s, r);
  if (s.abortAfterDiscard) { finishDraw(s, '四杠散了', true); return; }
  const caller = afterSeat(r.actor).find(seat => r.choices[seat]?.type === 'pon' || r.choices[seat]?.type === 'minkan');
  if (caller !== undefined) {
    const p = s.players[caller], kind = r.choices[caller]!.type as 'pon' | 'minkan';
    const used = p.hand.filter(i => tileId(s, i) === tileId(s, r.tile)).sort((a, b) => Number(s.wall.tiles[a].red) - Number(s.wall.tiles[b].red)).slice(0, kind === 'pon' ? 2 : 3);
    p.hand = p.hand.filter(i => !used.includes(i)); p.melds.push({ kind, tiles: [...used, r.tile], from: r.actor, called: r.tile });
    s.players[r.actor].river.find(t => t.index === r.tile)!.claimed = true;
    recordLiability(s, caller, r.actor); interrupt(s); s.current = caller; s.turn++; s.phase = 'turn'; s.response = null; p.drawn = null;
    if (kind === 'minkan') { completeKan(s, caller, r.tile); draw(s, caller, 'kan'); }
    else { p.forbiddenDiscard = tileId(s, r.tile); emit(s, 'pon', caller, r.tile); }
    return;
  }
  s.response = null;
  if (!s.wall.live.length) { finishDraw(s, '荒牌流局', false); return; }
  s.turn++; draw(s, nextSeat(r.actor), 'live');
}
function completeKan(s: SanmaState, seat: SanmaSeat, index: number): void {
  interrupt(s); s.kanCount++;
  s.abortAfterDiscard = s.kanCount === 4 && s.players.filter(p => p.melds.some(m => m.kind !== 'pon')).length > 1;
  emit(s, 'kan', seat, index);
}
function recordLiability(s: SanmaState, seat: SanmaSeat, from: SanmaSeat): void {
  const p = s.players[seat], exposed = p.melds.filter(m => m.kind !== 'ankan').map(m => tileId(s, m.tiles[0]));
  if ([31, 32, 33].every(id => exposed.includes(id as TileId)) && p.liability.daisangen === undefined) p.liability.daisangen = from;
  if ([27, 28, 29, 30].every(id => exposed.includes(id as TileId)) && p.liability.daisuushii === undefined) p.liability.daisuushii = from;
}
function finishWins(s: SanmaState, winners: SanmaSeat[], index: number, from: SanmaSeat | null, origin: SanmaWin['origin']): void {
  const wins = winners.map(winner => {
    const score = scoreSanma(s, winner, index, origin); if (!score) throw new Error('已裁定和牌失去合法计分上下文');
    return { winner, from, tile: index, origin, score, income: 0 };
  });
  for (const win of wins) settleBase(s, win.winner, from, win.score);
  const nearest = winners[0];
  if (from !== null) transfer(s, from, nearest, s.honba * 200, 'honba');
  else for (const payer of afterSeat(nearest)) transfer(s, payer, nearest, s.honba * 100, 'honba');
  transfer(s, 'pot', nearest, s.pot, 'sticks');
  for (const w of wins) w.income = s.players[w.winner].score - s.roundStartScores[w.winner];
  s.result = { kind: 'win', reason: origin === 'north' ? '抢北荣和' : from === null ? '自摸' : '荣和', winners: wins, tenpai: [], deltas: s.players.map((p, i) => p.score - s.roundStartScores[i]), dealerRepeats: winners.includes(s.dealer) };
  finishRound(s);
}
function finishDraw(s: SanmaState, reason: string, abort: boolean): void {
  const tenpai = abort ? [] : SANMA_SEATS.filter(seat => waitsFor(s, seat).length > 0);
  const nagashi = abort ? [] : SANMA_SEATS.filter(seat => {
    const p = s.players[seat]; return closedHand(p.melds) && p.river.length > 0 && p.river.every(r => !r.claimed && isOrphan(tileId(s, r.index)));
  }).sort((a, b) => (a - s.dealer + 3) % 3 - (b - s.dealer + 3) % 3);
  if (nagashi.length) {
    const wins = nagashi.map(winner => {
      const score: SanmaScore = { isWinning: true, yaku: [], han: 5, fu: 0, dora: 0, uraDora: 0, redDora: 0, northDora: 0, totalDora: 0,
        yakumanValue: 0, yakumanMultiplier: 0, limitTier: 'mangan', shape: null,
        points: { tsumoChild: winner === s.dealer ? 4000 : 2000, tsumoDealer: 4000, total: winner === s.dealer ? 12000 : 8000, limitTier: 'mangan' } };
      return { winner, from: null, tile: s.players[winner].river[s.players[winner].river.length - 1].index, origin: 'tsumo' as const, score, income: 0 };
    });
    for (const w of wins) { settleBase(s, w.winner, null, w.score, 'nagashi'); for (const payer of afterSeat(w.winner)) transfer(s, payer, w.winner, s.honba * 100, 'honba'); }
    transfer(s, 'pot', nagashi[0], s.pot, 'sticks');
    for (const w of wins) w.income = s.players[w.winner].score - s.roundStartScores[w.winner];
    s.result = { kind: 'win', reason: '流局满贯', winners: wins, tenpai, deltas: s.players.map((p, i) => p.score - s.roundStartScores[i]), dealerRepeats: nagashi.includes(s.dealer) };
  } else {
    if (tenpai.length === 1) for (const payer of afterSeat(tenpai[0])) transfer(s, payer, tenpai[0], 1000, 'noten');
    if (tenpai.length === 2) { const payer = SANMA_SEATS.find(seat => !tenpai.includes(seat))!; for (const winner of tenpai) transfer(s, payer, winner, 1000, 'noten'); }
    s.result = { kind: abort ? 'abort' : 'exhaustive', reason, winners: [], tenpai, deltas: s.players.map((p, i) => p.score - s.roundStartScores[i]), dealerRepeats: abort || tenpai.includes(s.dealer) };
  }
  finishRound(s);
}
export function sanmaEndDecision(s: SanmaState): string | null {
  if (!s.result) return null;
  if (s.players.some(p => p.score < 0)) return '击飞';
  const wind = ['east', 'south', 'west', 'north'].indexOf(s.roundWind), scheduled = s.config.length === 'east-only' ? 0 : 1;
  const first = rankedSeats(s)[0], reached = s.players[first].score >= s.config.targetPoints;
  if (wind > scheduled && reached) return '追加场达标';
  const final = wind === scheduled && s.handNumber === 3;
  if (final && first === s.dealer && reached && (s.result.kind === 'win' && s.result.winners.some(w => w.winner === s.dealer) || s.result.kind === 'exhaustive' && s.result.tenpai.includes(s.dealer))) return s.result.kind === 'win' ? '和了止' : '听牌止';
  if (s.result.dealerRepeats) return null;
  if (final && reached) return '常规终局';
  if (wind > scheduled && s.handNumber === 3) return '追加场上限';
  return null;
}
export function rankedSeats(s: SanmaState): SanmaSeat[] { return [...SANMA_SEATS].sort((a, b) => s.players[b].score - s.players[a].score || (a - s.config.initialDealer + 3) % 3 - (b - s.config.initialDealer + 3) % 3); }
function finishRound(s: SanmaState): void {
  s.phase = 'ended'; s.response = null; emit(s, 'settlement', s.current);
  const end = sanmaEndDecision(s); if (!end) return;
  s.completed = true; s.endReason = end; const order = rankedSeats(s); transfer(s, 'pot', order[0], s.pot, 'sticks');
  s.result!.deltas = s.players.map((p, i) => p.score - s.roundStartScores[i]);
  s.ranking = order.map((player, i) => {
    const points = s.players[player].score, uma = s.config.rules.uma[i], oka = i ? 0 : 3 * (s.config.returnPoints - s.config.startingPoints) / 1000;
    return { player, rank: i + 1, points, uma, oka, result: Math.round(((points - s.config.returnPoints) / 1000 + uma + oka) * 10) / 10 };
  });
}
function advanceRound(s: SanmaState): void {
  const result = s.result!;
  s.honba = result.kind !== 'win' || result.dealerRepeats ? s.honba + 1 : 0;
  if (!result.dealerRepeats) {
    s.dealer = nextSeat(s.dealer); s.handNumber++;
    if (s.handNumber === 4) { s.handNumber = 1; s.roundWind = (['east', 'south', 'west', 'north'] as Wind[])[['east', 'south', 'west', 'north'].indexOf(s.roundWind) + 1]; }
  }
  s.roundSerial++; s.wall = createSanmaWall(s.seed, s.roundSerial); s.players = s.players.map(p => player(p.id, s.config, p.score));
  s.roundStartScores = s.players.map(p => p.score); s.result = null; s.response = null; s.interrupted = false; s.kanCount = 0; s.abortAfterDiscard = false; s.turn = 0;
  emit(s, 'next', s.dealer); deal(s);
}
