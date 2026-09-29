import type { Tile, TileId } from '../types';
import { createConfig, stableJson, validateConfig } from './config';
import { missingSatisfied, scoreHand, suitOf } from './scoring';
import type { HandResult, Kong, LedgerEntry, Score, Seat, Suit, WinContext, XzAction, XzState } from './types';
export const SEATS: Seat[] = [0, 1, 2, 3];
export const participantId = (seat: Seat) => `xuezhan:${seat}`;
export function seededRandom(seed: number): () => number { let n = seed >>> 0; return () => { n += 0x6d2b79f5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function tileFor(id: number, instanceId: string): Tile { return { id: id as TileId, suit: (['man', 'pin', 'sou'] as const)[suitOf(id)], rank: id % 9 + 1, red: false, instanceId }; }
export function makeWall(seed: number, hand: number): Tile[] {
  const tiles = Array.from({ length: 108 }, (_, i) => tileFor(Math.floor(i / 4), `xz:${hand}:${i}`));
  const random = seededRandom(seed ^ Math.imul(hand, 0x9e3779b9));
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  return tiles;
}
function sortHand(hand: Tile[]): void { hand.sort((a, b) => a.id - b.id || a.instanceId.localeCompare(b.instanceId)); }
export function createXzMatch(config = createConfig(), seed = 1, initialWall?: Tile[]): XzState {
  config = validateConfig(config);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子必须为 32 位非负整数');
  const dealer = (config.rules.firstDealer < 0 ? Math.floor(seededRandom(seed)() * 4) : config.rules.firstDealer) as Seat;
  const s: XzState = { mode: 'xuezhan', schemaVersion: 1, config, seed, handNumber: 1, dealer, players: SEATS.map(id => ({ id, participantId: participantId(id), name: id ? `电脑 ${id}` : '你', score: config.rules.startingScore, hand: [], melds: [], river: [], drawn: null, missing: null, won: null, passed: null })),
    wall: [], phase: 'turn', current: dealer, turn: 0, sequence: 0, exchangeDirection: 1, exchanges: {}, drafts: {}, declarations: {}, response: null, pendingKong: null, lastKong: null, wins: [], ledger: [], handStartScores: [], results: [], actions: [], firstDiscard: true, interrupted: false, lastDraw: false, completed: false };
  if (initialWall) {
    if (initialWall.length !== 108 || new Set(initialWall.map(t => t.instanceId)).size !== 108 || Array.from({ length: 27 }, (_, id) => initialWall.filter(t => t.id === id).length).some(n => n !== 4)) throw new Error('初始牌墙必须为 108 张唯一实体、每种四张');
    s.initialWall = structuredClone(initialWall);
  }
  deal(s); assertXzInvariants(s); return s;
}
function deal(s: XzState): void {
  s.wall = s.handNumber === 1 && s.initialWall ? structuredClone(s.initialWall) : makeWall(s.seed, s.handNumber); s.turn = 0; s.current = s.dealer;
  s.players.forEach(p => { p.hand = s.wall.splice(0, 13); p.melds = []; p.river = []; p.drawn = null; p.missing = null; p.won = null; p.passed = null; });
  const tile = s.wall.shift()!; s.players[s.dealer].hand.push(tile); s.players[s.dealer].drawn = tile.instanceId;
  s.players.forEach(p => sortHand(p.hand)); s.handStartScores = s.players.map(p => p.score);
  s.exchanges = {}; s.drafts = {}; s.declarations = {}; s.response = null; s.pendingKong = null; s.lastKong = null;
  s.wins = []; s.ledger = []; s.firstDiscard = true; s.interrupted = false; s.lastDraw = false;
  const d = s.config.rules.direction;
  s.exchangeDirection = d === 'random' ? 1 + Math.floor(seededRandom(s.seed + s.handNumber * 37)() * 3) : d === 'clockwise' ? 1 : d === 'opposite' ? 2 : 3;
  s.phase = s.config.rules.exchange ? 'exchange' : s.config.rules.missing === 'declared' ? 'missing' : 'turn';
}
export function activeSeats(s: XzState): Seat[] { return SEATS.filter(id => s.players[id].won === null); }
export function orderedAfter(from: Seat): Seat[] { return [1, 2, 3].map(n => (from + n) % 4 as Seat); }
export function contextFor(s: XzState, seat: Seat): WinContext {
  if (s.phase === 'response' && s.response) return { kind: s.response.rob ? 'rob' : 'discard', kong: !!s.response.kong, last: s.response.last, earth: s.response.earth && seat !== s.dealer };
  return { kind: 'draw', kong: s.lastKong?.player === seat, last: s.lastDraw, heaven: seat === s.dealer && s.firstDiscard && !s.interrupted };
}
export function winScore(s: XzState, seat: Seat): Score | null {
  const p = s.players[seat];
  if (p.won !== null) return null;
  const response = s.phase === 'response' ? s.response : null;
  if (!response && (s.phase !== 'turn' || s.current !== seat || !p.drawn)) return null;
  if (response?.rob && !s.config.rules.robKong) return null;
  if (response && (s.config.rules.selfDrawOnly || response.from === seat)) return null;
  const score = scoreHand([...p.hand, ...(response ? [response.tile] : [])], p.melds, p.missing, s.config.rules, contextFor(s, seat));
  if (score && response && p.passed !== null && (s.config.rules.passWin === 'until-draw' || s.config.rules.passWin === 'higher' && score.base <= p.passed)) return null;
  return score;
}
function canCall(s: XzState, seat: Seat, id: number): boolean {
  const r = s.config.rules, p = s.players[seat];
  return r.missing === 'dynamic' || (p.missing !== suitOf(id) && (r.unclearedCalls || !p.hand.some(t => suitOf(t.id) === p.missing)));
}
export function legalDiscards(s: XzState, seat: Seat): Tile[] {
  if (s.phase !== 'turn' || s.current !== seat || s.players[seat].won !== null) return [];
  const p = s.players[seat];
  const missing = s.config.rules.missing === 'declared' ? p.hand.filter(t => suitOf(t.id) === p.missing) : [];
  return missing.length ? missing : p.hand;
}
export function legalActions(s: XzState, seat: Seat): XzAction[] {
  const p = s.players[seat];
  if (s.phase === 'ended') return !s.completed && seat === 0 ? [{ type: 'next' }] : [];
  if (p.won !== null) return [];
  if (s.phase === 'missing') return s.declarations[seat] === undefined ? ([0, 1, 2] as Suit[]).map(suit => ({ type: 'missing', suit })) : [];
  if (s.phase === 'exchange') return s.exchanges[seat] ? [] : [{ type: 'exchange', tiles: completeExchange(s, seat) }];
  if (s.phase === 'response') {
    const w = s.response!;
    if (!w.eligible.includes(seat) || w.replies[seat]) return [];
    const result: XzAction[] = [{ type: 'pass' }];
    if (winScore(s, seat)) result.push({ type: 'win' });
    const n = p.hand.filter(t => t.id === w.tile.id).length;
    if (!w.rob && canCall(s, seat, w.tile.id)) {
      if (n >= 2) result.push({ type: 'pon' });
      if (n === 3 && s.wall.length) result.push({ type: 'kan' });
    }
    return result;
  }
  if (s.current !== seat) return [];
  const actions: XzAction[] = legalDiscards(s, seat).map(t => ({ type: 'discard', tile: t.instanceId }));
  if (winScore(s, seat)) actions.push({ type: 'win' });
  if (s.wall.length) for (const tile of p.hand) {
    if (!canCall(s, seat, tile.id)) continue;
    if (p.melds.some(m => m.type === 'pon' && m.tiles[0].id === tile.id) || p.hand.filter(t => t.id === tile.id).length === 4 && p.hand.find(t => t.id === tile.id) === tile) actions.push({ type: 'kan', tile: tile.instanceId });
  }
  return actions;
}
export function completeExchange(s: XzState, seat: Seat): string[] {
  const p = s.players[seat], count = s.config.rules.exchange;
  const draft = [...new Set(s.drafts[seat] ?? [])].map(id => p.hand.find(t => t.instanceId === id)).filter((t): t is Tile => !!t);
  const suits = ([0, 1, 2] as Suit[]).filter(suit => p.hand.filter(t => suitOf(t.id) === suit).length >= count);
  suits.sort((a, b) => draft.filter(t => suitOf(t.id) === b).length - draft.filter(t => suitOf(t.id) === a).length || p.hand.filter(t => suitOf(t.id) === a).length - p.hand.filter(t => suitOf(t.id) === b).length || a - b);
  const candidates = p.hand.filter(t => suitOf(t.id) === suits[0]);
  return [...new Set([...draft.filter(t => suitOf(t.id) === suits[0]), ...candidates].map(t => t.instanceId))].slice(0, count);
}
export function defaultAction(s: XzState, seat: Seat): XzAction | null {
  if (s.phase === 'exchange') return s.exchanges[seat] ? null : { type: 'exchange', tiles: completeExchange(s, seat) };
  if (s.phase === 'missing') {
    const suit = ([0, 1, 2] as Suit[]).sort((a, b) => s.players[seat].hand.filter(t => suitOf(t.id) === a).length - s.players[seat].hand.filter(t => suitOf(t.id) === b).length || a - b)[0];
    return s.declarations[seat] === undefined ? { type: 'missing', suit } : null;
  }
  const actions = legalActions(s, seat);
  return actions.find(a => a.type === 'pass') ?? actions.find(a => a.type === 'discard' && a.tile === s.players[seat].drawn) ?? actions.find(a => a.type === 'discard') ?? actions[0] ?? null;
}
export function pay(s: XzState, entry: Omit<LedgerEntry, 'id' | 'sourceAction'>): void {
  if (s.ledger.some(e => e.key === entry.key)) return;
  if (entry.from === entry.to || !Number.isSafeInteger(entry.amount) || entry.amount < 0) throw new Error('非法账本支付');
  if (!entry.amount) return;
  s.players[entry.from].score -= entry.amount; s.players[entry.to].score += entry.amount;
  if (![s.players[entry.from].score, s.players[entry.to].score].every(Number.isSafeInteger)) throw new Error('积分超出安全整数');
  s.ledger.push({ ...entry, id: `h${s.handNumber}:l${s.ledger.length + 1}`, sourceAction: s.sequence });
}
function settleKong(s: XzState, kong: Kong): void {
  s.lastKong = kong; s.interrupted = true;
  if (s.config.rules.kongPay) {
    const r = s.config.rules, rate = kong.type === 'minkan' ? r.directRate : kong.type === 'kakan' ? r.addedRate : r.concealedRate;
    const payers = kong.type === 'minkan' && r.directPay === 'source' ? [kong.from!] : activeSeats(s).filter(id => id !== kong.player);
    for (const from of payers) pay(s, { key: `${kong.id}:${from}`, transactionId: kong.id, reason: 'kong', from, to: kong.player, amount: rate * r.base, sourceKong: kong.id });
  }
  draw(s, kong.player, true);
}
function draw(s: XzState, seat: Seat, supplement = false): void {
  if (activeSeats(s).length <= 1) { finish(s, 'three-winners'); return; }
  if (!s.wall.length) { finish(s, 'wall'); return; }
  const p = s.players[seat], tile = s.wall.shift()!;
  p.hand.push(tile); sortHand(p.hand); p.drawn = tile.instanceId; p.passed = null;
  s.current = seat; s.phase = 'turn'; s.turn++; s.lastDraw = s.wall.length === 0;
  if (!supplement) s.lastKong = null;
}
function continueAfter(s: XzState, from: Seat): void { draw(s, orderedAfter(from).find(id => s.players[id].won === null) ?? from); }
function openResponse(s: XzState, from: Seat, tile: Tile, rob = false): void {
  s.phase = 'response'; s.response = { id: s.sequence, from, tile, rob, replies: {}, eligible: [], kong: rob ? null : s.lastKong, last: !rob && s.lastDraw, earth: !rob && s.firstDiscard && from === s.dealer && !s.interrupted };
  // Compute candidates via the same public legal API, then freeze the response membership.
  s.response.eligible = orderedAfter(from).filter(id => s.players[id].won === null);
  s.response.eligible = s.response.eligible.filter(id => legalActions(s, id).some(a => a.type !== 'pass'));
  if (!s.response.eligible.length) resolveResponse(s);
}
function resolveResponse(s: XzState): void {
  const w = s.response!;
  if (w.eligible.some(id => !w.replies[id])) return;
  let winners = orderedAfter(w.from).filter(id => w.replies[id] === 'win');
  if (!s.config.rules.multiWin) winners = winners.slice(0, 1);
  if (winners.length) {
    const scores = winners.map(id => winScore(s, id)!);
    if (w.rob) {
      const p = s.players[w.from]; p.hand = p.hand.filter(t => t.instanceId !== w.tile.instanceId); p.drawn = null;
      // The robbed tile becomes one public physical entity; all winners reference it.
      p.river.push({ ...w.tile }); s.pendingKong = null;
    }
    settleWins(s, winners, w.from, w.tile, scores);
    if (w.kong && s.config.rules.transfer) transferKong(s, w.kong, winners);
    s.response = null; s.lastKong = null; s.firstDiscard = false;
    continueAfter(s, w.from); return;
  }
  s.response = null;
  if (w.rob) {
    const pending = s.pendingKong!, p = s.players[pending.seat], meld = p.melds[pending.meld];
    const tile = p.hand.find(t => t.instanceId === pending.tile)!;
    p.hand = p.hand.filter(t => t.instanceId !== tile.instanceId); meld.tiles.push(tile); meld.type = 'kan'; meld.kanType = 'kakan'; p.drawn = null;
    s.pendingKong = null; settleKong(s, { id: `h${s.handNumber}:k${s.sequence}`, player: p.id, type: 'kakan', from: meld.from, transferred: false }); return;
  }
  s.firstDiscard = false;
  const caller = orderedAfter(w.from).find(id => w.replies[id] === 'kan' || w.replies[id] === 'pon');
  if (caller !== undefined) {
    const kan = w.replies[caller] === 'kan', p = s.players[caller];
    const used = p.hand.filter(t => t.id === w.tile.id).slice(0, kan ? 3 : 2);
    p.hand = p.hand.filter(t => !used.includes(t));
    s.players[w.from].river.find(t => t.instanceId === w.tile.instanceId)!.claimed = true;
    p.melds.push({ type: kan ? 'kan' : 'pon', tiles: [...used, w.tile], from: w.from, opened: true, calledTile: w.tile, ...(kan ? { kanType: 'minkan' } : {}) });
    s.interrupted = true; p.drawn = null; s.current = caller; s.phase = 'turn'; s.turn++; s.lastKong = null; s.lastDraw = false;
    if (kan) settleKong(s, { id: `h${s.handNumber}:k${s.sequence}`, player: caller, type: 'minkan', from: w.from, transferred: false });
    return;
  }
  s.lastKong = null; continueAfter(s, w.from);
}
function settleWins(s: XzState, winners: Seat[], from: Seat | null, tile: Tile, scores: Score[]): void {
  const id = `h${s.handNumber}:w${s.wins.length + 1}`, active = activeSeats(s);
  winners.forEach((winner, i) => {
    const score = scores[i];
    let payments = from === null ? active.filter(p => p !== winner).map(p => ({ from: p, amount: score.payment })) : [{ from, amount: score.payment }];
    if (from === null && s.lastKong?.type === 'minkan' && s.lastKong.from !== null && s.config.rules.directResponsibility) payments = [{ from: s.lastKong.from, amount: payments.reduce((n, p) => n + p.amount, 0) }];
    payments.forEach(p => pay(s, { ...p, to: winner, key: `${id}:${winner}:${p.from}`, transactionId: id, reason: 'win', sourceKong: s.lastKong?.id ?? null }));
  });
  const order = s.players.filter(p => p.won !== null).length + 1;
  winners.forEach(winner => { s.players[winner].won = order; });
  s.wins.push({ id, winners, from, tileId: tile.instanceId, scores, kind: from === null ? 'draw' : s.response?.rob ? 'rob' : 'discard', action: s.sequence });
}
function transferKong(s: XzState, kong: Kong, winners: Seat[]): void {
  if (kong.transferred) return;
  const income = s.ledger.filter(e => e.reason === 'kong' && e.sourceKong === kong.id).reduce((n, e) => n + e.amount, 0);
  const receivers = s.config.rules.transferSplit === 'nearest' ? winners.slice(0, 1) : winners;
  receivers.forEach((to, i) => pay(s, { key: `${kong.id}:transfer:${to}`, transactionId: `${kong.id}:transfer`, reason: 'transfer', from: kong.player, to, amount: Math.floor(income / receivers.length) + (i < income % receivers.length ? 1 : 0), sourceKong: kong.id }));
  kong.transferred = true;
}
export function readyScores(s: XzState, seat: Seat): Array<{ id: number; score: Score }> {
  const p = s.players[seat];
  const owned = [...p.hand, ...p.melds.flatMap(m => m.tiles)];
  const publicTiles = [...owned, ...s.players.flatMap(other => [...other.river.filter(t => !t.claimed), ...(other.id !== seat ? other.melds.filter(m => m.kanType !== 'ankan').flatMap(m => m.tiles) : [])])];
  const unique = [...new Map(publicTiles.map(t => [t.instanceId, t])).values()];
  const waits: Array<{ id: number; score: Score }> = [];
  for (let id = 0; id < 27; id++) {
    if (owned.filter(t => t.id === id).length >= 4 || s.config.rules.readyPolicy === 'public' && unique.filter(t => t.id === id).length >= 4) continue;
    const score = scoreHand([...p.hand, tileFor(id, 'hypothetical')], p.melds, p.missing, s.config.rules, { kind: 'ready' });
    if (score) waits.push({ id, score });
  }
  return waits;
}
function finish(s: XzState, reason: HandResult['reason']): void {
  if (s.phase === 'ended') return;
  const r = s.config.rules;
  const classifications = s.players.map(p => p.won !== null ? '已胡' : !missingSatisfied(p.hand, p.melds, p.missing, r) ? '花猪' : readyScores(s, p.id).length ? '听牌' : '未听');
  if (reason === 'wall') {
    const ready = SEATS.map(id => classifications[id] === '听牌' ? Math.max(...readyScores(s, id).map(w => w.score.base)) : 0);
    const refunders = SEATS.filter(id => classifications[id] !== '已胡' && (r.refund === 'all-unwon' || r.refund === 'not-ready' && classifications[id] !== '听牌'));
    for (const e of [...s.ledger]) if (r.kongPay && e.reason === 'kong' && refunders.includes(e.to) && !s.ledger.some(t => t.reason === 'transfer' && t.sourceKong === e.sourceKong)) pay(s, { key: `refund:${e.id}`, transactionId: `end:${s.handNumber}:refund`, reason: 'refund', from: e.to, to: e.from, amount: e.amount, sourceKong: e.sourceKong });
    for (const from of SEATS) {
      if (r.pig && classifications[from] === '花猪') for (const to of SEATS.filter(id => classifications[id] !== '花猪' && (r.pigIncludesWon || classifications[id] !== '已胡'))) pay(s, { key: `pig:${from}:${to}`, transactionId: `end:${s.handNumber}:pig`, reason: 'pig', from, to, amount: r.base * (r.pigPenalty === 'cap' ? 2 ** r.cap : r.pigRate), sourceKong: null });
      if (r.readyPay && (classifications[from] === '未听' || classifications[from] === '花猪' && r.pigAlsoReady)) for (const to of SEATS.filter(id => ready[id] > 0)) pay(s, { key: `ready:${from}:${to}`, transactionId: `end:${s.handNumber}:ready`, reason: 'ready', from, to, amount: ready[to], sourceKong: null });
    }
  }
  s.phase = 'ended'; s.response = null; s.pendingKong = null;
  s.results.push({ hand: s.handNumber, reason, scores: s.players.map(p => p.score), deltas: s.players.map((p, i) => p.score - s.handStartScores[i]), wins: structuredClone(s.wins), ledger: [...s.ledger], classifications });
  s.completed = s.handNumber >= r.rounds || r.bankruptcy && s.players.some(p => p.score < 0);
}
function isLegal(s: XzState, seat: Seat, action: XzAction): boolean {
  if ((action.type === 'exchange' || action.type === 'exchange-draft') && s.phase === 'exchange' && !s.exchanges[seat]) {
    const tiles = action.tiles.map(id => s.players[seat].hand.find(t => t.instanceId === id));
    return action.tiles.length <= s.config.rules.exchange && (action.type === 'exchange-draft' || action.tiles.length === s.config.rules.exchange) && new Set(action.tiles).size === tiles.length && tiles.every(Boolean) && new Set(tiles.map(t => suitOf(t!.id))).size <= 1;
  }
  return legalActions(s, seat).some(a => stableJson(a) === stableJson(action));
}
/** Pure authority. Invalid, duplicated, stale or out-of-phase actions leave the same state. */
export function applyXz(s: XzState, seat: Seat, action: XzAction): XzState {
  if (!SEATS.includes(seat) || !isLegal(s, seat, action)) return s;
  const next: XzState = { ...structuredClone({ ...s, actions: [], results: [], config: undefined }), config: s.config, actions: [...s.actions], results: [...s.results] };
  next.sequence++; next.actions.push({ seq: next.sequence, hand: next.handNumber, seat, action: structuredClone(action) });
  const p = next.players[seat];
  switch (action.type) {
    case 'exchange-draft': next.drafts[seat] = [...action.tiles]; break;
    case 'exchange': {
      next.exchanges[seat] = [...action.tiles];
      if (SEATS.every(id => next.exchanges[id])) {
        const outgoing = next.players.map(player => player.hand.filter(t => next.exchanges[player.id]!.includes(t.instanceId)));
        next.players.forEach(player => { player.hand = player.hand.filter(t => !next.exchanges[player.id]!.includes(t.instanceId)); });
        outgoing.forEach((tiles, id) => next.players[(id + next.exchangeDirection) % 4].hand.push(...tiles));
        next.players.forEach(player => { sortHand(player.hand); if (player.drawn && !player.hand.some(t => t.instanceId === player.drawn)) player.drawn = player.hand[player.hand.length - 1].instanceId; });
        next.phase = next.config.rules.missing === 'declared' ? 'missing' : 'turn';
      }
      break;
    }
    case 'missing': next.declarations[seat] = action.suit; if (SEATS.every(id => next.declarations[id] !== undefined)) { next.players.forEach(player => { player.missing = next.declarations[player.id]!; }); next.phase = 'turn'; } break;
    case 'discard': {
      const tile = p.hand.find(t => t.instanceId === action.tile)!;
      p.hand = p.hand.filter(t => t.instanceId !== tile.instanceId); p.river.push(tile); p.drawn = null;
      openResponse(next, seat, tile); break;
    }
    case 'win':
      if (next.phase === 'response') { next.response!.replies[seat] = 'win'; resolveResponse(next); }
      else { const score = winScore(next, seat)!; const tile = p.hand.find(t => t.instanceId === p.drawn) ?? p.hand[p.hand.length - 1]; settleWins(next, [seat], null, tile, [score]); next.firstDiscard = false; next.lastKong = null; continueAfter(next, seat); }
      break;
    case 'pass': case 'pon':
      if (winScore(next, seat) && next.config.rules.passWin !== 'off') p.passed = Math.max(p.passed ?? 0, winScore(next, seat)!.base);
      next.response!.replies[seat] = action.type; resolveResponse(next); break;
    case 'kan':
      if (next.phase === 'response') {
        if (winScore(next, seat) && next.config.rules.passWin !== 'off') p.passed = Math.max(p.passed ?? 0, winScore(next, seat)!.base);
        next.response!.replies[seat] = 'kan'; resolveResponse(next);
      } else {
        const tile = p.hand.find(t => t.instanceId === action.tile)!;
        const meld = p.melds.findIndex(m => m.type === 'pon' && m.tiles[0].id === tile.id);
        next.lastKong = null;
        if (meld >= 0) {
          next.pendingKong = { seat, tile: tile.instanceId, meld }; openResponse(next, seat, tile, true);
          if (!next.config.rules.robKong && next.response) { next.response.eligible = []; resolveResponse(next); }
        } else {
          const tiles = p.hand.filter(t => t.id === tile.id); p.hand = p.hand.filter(t => t.id !== tile.id); p.drawn = null;
          p.melds.push({ type: 'kan', kanType: 'ankan', tiles, opened: false, from: seat });
          settleKong(next, { id: `h${next.handNumber}:k${next.sequence}`, player: seat, type: 'ankan', from: null, transferred: false });
        }
      }
      break;
    case 'next': {
      const r = next.config.rules, last = next.results[next.results.length - 1];
      next.dealer = r.dealerPolicy === 'first-win' && next.wins.length ? next.wins[0].winners.length > 1 ? next.wins[0].from! : next.wins[0].winners[0] : last.reason === 'wall' && r.drawDealer === 'stay' ? next.dealer : (next.dealer + 1) % 4 as Seat;
      next.handNumber++; deal(next); break;
    }
  }
  return next;
}
export function assertXzInvariants(s: XzState): void {
  if (s.players.length !== 4 || s.players.some((p, i) => p.id !== i || p.participantId !== participantId(p.id))) throw new Error('四座身份不稳定');
  const tiles = [...s.wall, ...s.players.flatMap(p => [...p.hand, ...p.river.filter(t => !t.claimed), ...p.melds.flatMap(m => m.tiles)])];
  if (tiles.length !== 108 || new Set(tiles.map(t => t.instanceId)).size !== 108) throw new Error(`实体牌不守恒：${tiles.length}`);
  for (let id = 0; id < 27; id++) if (tiles.filter(t => t.id === id).length !== 4) throw new Error(`牌种 ${id} 不是四张`);
  if (tiles.some(t => t.red || t.id > 26 || t.rank !== t.id % 9 + 1 || t.suit !== ['man', 'pin', 'sou'][suitOf(t.id)])) throw new Error('牌实体无效');
  if (new Set(s.ledger.map(e => e.key)).size !== s.ledger.length) throw new Error('账本重复');
  const expected = [...s.handStartScores];
  s.ledger.forEach(e => { if (e.amount < 0 || !Number.isSafeInteger(e.amount) || e.from === e.to) throw new Error('支付无效'); expected[e.from] -= e.amount; expected[e.to] += e.amount; });
  if (s.players.some((p, i) => p.score !== expected[i]) || s.players.reduce((n, p) => n + p.score, 0) !== s.config.rules.startingScore * 4) throw new Error('账本或总分不守恒');
  for (const w of s.wins) if (!tiles.some(t => t.instanceId === w.tileId)) throw new Error('胡牌引用丢失');
  if (s.phase === 'turn' && s.players[s.current].won !== null) throw new Error('已胡者仍在行牌');
}
