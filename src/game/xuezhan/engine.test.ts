import { describe, expect, it } from 'vitest';
import { createConfig, PATTERNS, PRESETS, presetRules, ruleId, stableJson, validateConfig, validateRules, type Pattern } from './config';
import { activeSeats, applyXz, assertXzInvariants, createXzMatch, defaultAction, legalActions, makeWall, pay, readyScores, SEATS, tileFor, winScore } from './engine';
import { scoreHand } from './scoring';
import { chooseXzAction, observeXz } from './ai';
import { parseXzSave, replayXz, saveXz, stateDigest } from './persistence';
import type { Seat, XzState } from './types';

const tiles = (ids: number[]) => ids.map((id, i) => tileFor(id, `unit:${i}`));
const flat = (s: string) => s.split(' ').flatMap((part, suit) => [...part].map(n => Number(n) - 1 + suit * 9));
function fixture(hands: number[][], current: Seat = 0): XzState {
  const c = createConfig(presetRules('dynamic')); c.rules.firstDealer = current; c.ruleId = ruleId(c.rules);
  const s = createXzMatch(c, 42), pool = makeWall(42, 1);
  s.players.forEach((p, id) => { p.hand = hands[id].map(n => { const i = pool.findIndex(t => t.id === n); if (i < 0) throw new Error(`fixture has fifth tile ${n}`); return pool.splice(i, 1)[0]; }); p.drawn = id === current ? p.hand[p.hand.length - 1].instanceId : null; });
  s.players.forEach(p => { while (p.hand.length < (p.id === current ? 14 : 13)) p.hand.push(pool.shift()!); });
  s.wall = pool; s.current = current; s.phase = 'turn'; assertXzInvariants(s); return s;
}
function stepAi(s: XzState): XzState {
  if (s.phase === 'ended') return applyXz(s, 0, { type: 'next' });
  for (const id of SEATS) { const a = chooseXzAction(observeXz(s, id), { difficulty: 'shintentai', personality: 'balanced' }); if (a) { const next = applyXz(s, id, a); if (next !== s) return next; } }
  throw new Error(`stuck ${s.phase}`);
}
describe('血战配置与金样', () => {
  it('四预设、稳定语义标识和拒绝未知版本/依赖/不安全金额', () => {
    for (const p of Object.keys(PRESETS) as Array<keyof typeof PRESETS>) expect(validateConfig(createConfig(presetRules(p))).rules.preset).toBe(p);
    const r = presetRules(); expect(() => validateRules({ ...r, ruleVersion: 2 })).toThrow();
    expect(() => validateRules({ ...r, selfDrawOnly: true })).toThrow();
    expect(() => validateRules({ ...r, kongPay: false })).toThrow();
    expect(() => validateRules({ ...r, cap: 0 })).toThrow();
    expect(ruleId({ ...r, preset: 'dynamic' })).toBe(ruleId(r));
    for (const base of [0, 101, NaN, 0.1]) expect(() => validateRules({ ...r, base })).toThrow();
  });
  it('平胡无需日麻役，自摸加底、加番与封顶顺序', () => {
    const r = presetRules('dynamic'), hand = tiles(flat('123345789 45677'));
    expect(scoreHand(hand, [], null, r, { kind: 'discard' })?.payment).toBe(1);
    expect(scoreHand(hand, [], null, r, { kind: 'draw' })?.payment).toBe(2);
    const pure = tiles(flat('11123456789999'));
    r.cap = 2; r.selfDraw = 'fan';
    expect(scoreHand(pure, [], null, r, { kind: 'draw' })?.payment).toBe(4);
    r.extraAfterCap = true; expect(scoreHand(pure, [], null, r, { kind: 'draw' })?.payment).toBe(8);
  });
  it('七对四张算两对、根和组合显示不重复加分；关闭七对', () => {
    const r = presetRules('dynamic'), hand = tiles(flat('11112233445566'));
    const score = scoreHand(hand, [], null, r, { kind: 'discard' })!;
    expect(score.shape).toBe('sevenPairs'); expect(score.fan).toBe(5); expect(score.label).toBe('清龙七对'); expect(score.payment).toBe(8);
    r.patterns.sevenPairs.enabled = false;
    expect(scoreHand(tiles(flat('111122 33445599')), [], null, r, { kind: 'discard' })).toBeNull();
  });
  it('自由三门不可胡；定缺两门仍含指定门不可胡，副露参与检查', () => {
    const r = presetRules('dynamic');
    expect(scoreHand(tiles(flat('12344 123456 789')), [], null, r, { kind: 'discard' })).toBeNull();
    r.missing = 'declared'; expect(scoreHand(tiles(flat('123345789 45677')), [], 1, r, { kind: 'discard' })).toBeNull();
  });
  const patternHands: Partial<Record<Pattern, string>> = { allTriplets: '11133355577799', pure: '12334556778999', sevenPairs: '11223344556688', root: '11112334556799', concealed: '123345789 45677', middle: '234345456 66688', jiang: '222555888 22255', terminals: '111789 11178999' };
  for (const [key, spec] of Object.entries(patternHands)) it(`番型金样 ${PATTERNS[key as Pattern][0]} 与关闭路径`, () => {
    const r = presetRules('dynamic'); for (const p of Object.values(r.patterns)) p.enabled = false;
    r.patterns[key as Pattern] = { enabled: true, fan: 2 };
    const result = scoreHand(tiles(flat(spec)), [], null, r, { kind: 'discard' });
    expect(result?.patterns.find(p => p.id === key)?.fan).toBe(2);
    r.patterns[key as Pattern].enabled = false;
    expect(scoreHand(tiles(flat(spec)), [], null, r, { kind: 'discard' })?.patterns.some(p => p.id === key) ?? false).toBe(false);
  });
  it('全部事件奖励只在真实上下文触发，查叫无假想奖励', () => {
    const r = presetRules('dynamic'); for (const p of Object.values(r.patterns)) p.enabled = true;
    const hand = tiles(flat('123345789 45677'));
    const cases = [['kongDraw', { kind: 'draw', kong: true }], ['kongDiscard', { kind: 'discard', kong: true }], ['robKong', { kind: 'rob' }], ['lastDraw', { kind: 'draw', last: true }], ['lastDiscard', { kind: 'discard', last: true }], ['heaven', { kind: 'draw', heaven: true }], ['earth', { kind: 'discard', earth: true }]] as const;
    for (const [id, context] of cases) expect(scoreHand(hand, [], null, r, context)?.patterns.some(p => p.id === id)).toBe(true);
    expect(scoreHand(hand, [], null, r, { kind: 'ready' })?.patterns.map(p => p.id)).toEqual(['concealed']);
  });
});
describe('血战权威流程', () => {
  it('换三换四全方向原子交换、非法选择拒绝；声明统一揭示', () => {
    for (const exchange of [3, 4] as const) for (const direction of ['random', 'clockwise', 'counterclockwise', 'opposite'] as const) {
      let s = createXzMatch(createConfig({ ...presetRules(), exchange, direction }), 87);
      const hands = s.players.map(p => p.hand.map(t => t.instanceId));
      expect(applyXz(s, 0, { type: 'exchange', tiles: [hands[0][0], hands[0][0], hands[0][0]] })).toBe(s);
      for (const id of SEATS) { s = applyXz(s, id, defaultAction(s, id)!); assertXzInvariants(s); if (id < 3) expect(s.players.map(p => p.hand.map(t => t.instanceId))).toEqual(hands); }
      expect(s.phase).toBe('missing');
      s = applyXz(s, 0, { type: 'missing', suit: 0 }); expect(s.players.every(p => p.missing === null)).toBe(true);
      for (const id of [1, 2, 3] as Seat[]) s = applyXz(s, id, defaultAction(s, id)!);
      expect(s.phase).toBe('turn'); expect(s.players[0].missing).toBe(0);
    }
  });
  it('先胡仍保留四座，第二次自摸仅两家支付，账本守恒', () => {
    let s = fixture([flat('123345789 45677'), flat('1112345678999'), flat(' 1122334455667'), flat('  1112345678999')]);
    s = applyXz(s, 0, { type: 'win' }); expect(s.players.map(p => p.score)).toEqual([106, 98, 98, 98]); expect(s.players[0].won).toBe(1); expect(s.phase).toBe('turn'); expect(s.current).toBe(1); expect(activeSeats(s)).toEqual([1, 2, 3]);
    expect(legalActions(s, 0)).toEqual([]); assertXzInvariants(s);
  });
  it('同源三响统一结算和退出；单响落选不算主动过胡', () => {
    for (const multiWin of [true, false]) {
      let s = fixture([[0], flat('2343456787891'), flat('1 123234567789'), flat('1  123234567789')]);
      s.config.rules.multiWin = multiWin;
      const tile = s.players[0].hand.find(t => t.id === 0)!;
      // The source hand contains a single 1m; the three waits use the other three.
      expect(tile).toBeDefined();
      s = applyXz(s, 0, { type: 'discard', tile: tile.instanceId });
      for (const id of [1, 2, 3] as Seat[]) { expect(winScore(s, id)).not.toBeNull(); s = applyXz(s, id, { type: 'win' }); }
      expect(s.wins[0].winners).toEqual(multiWin ? [1, 2, 3] : [1]); expect(s.players[2].passed).toBeNull(); assertXzInvariants(s);
    }
  });
  it('幂等支付、超时定缺合法弃牌、第五张不能听', () => {
    let s = createXzMatch(createConfig(presetRules('declared')), 13);
    for (const seat of SEATS) s = applyXz(s, seat, { type: 'missing', suit: 0 });
    const seat = s.current, action = defaultAction(s, seat)!;
    expect(legalActions(s, seat)).toContainEqual(action);
    const entry = { key: 'example', transactionId: 'example', reason: 'kong' as const, from: 0 as Seat, to: 1 as Seat, amount: 2, sourceKong: 'k' };
    pay(s, entry); pay(s, entry); expect(s.ledger.length).toBe(1); assertXzInvariants(s);
    expect(readyScores(s, seat).every(w => s.players[seat].hand.filter(t => t.id === w.id).length < 4)).toBe(true);
  });
  it('全预设完整小局、保存恢复与回放一致、非法版本拒绝', () => {
    for (const preset of Object.keys(PRESETS) as Array<keyof typeof PRESETS>) {
      let s = createXzMatch(createConfig({ ...presetRules(preset), rounds: 1 }), 12);
      for (let i = 0; i < 600 && !s.completed; i++) { s = stepAi(s); assertXzInvariants(s); }
      expect(s.completed).toBe(true);
      const save = saveXz(s); expect(stateDigest(replayXz(save))).toBe(stateDigest(s));
      expect(stateDigest(replayXz(parseXzSave(stableJson(save))))).toBe(stateDigest(s));
      expect(() => parseXzSave(JSON.stringify({ ...save, schemaVersion: 99 }))).toThrow();
    }
  }, 30000);
  it('AI 固定观察不含隐藏牌；难度人格确定性', () => {
    const s = createXzMatch(createConfig(presetRules('dynamic')), 1), seat = s.current;
    const a = observeXz(s, seat), other = (seat + 1) % 4;
    s.players[other].hand.reverse(); s.wall.reverse();
    expect(observeXz(s, seat)).toEqual(a);
    for (const difficulty of ['chikukon', 'shintentai', 'upper', 'kishin'] as const) for (const personality of ['balanced', 'defensive', 'aggressive'] as const) {
      const action = chooseXzAction(a, { difficulty, personality }); expect(a.legal).toContainEqual(action); expect(chooseXzAction(a, { difficulty, personality })).toEqual(action);
    }
  });
});
