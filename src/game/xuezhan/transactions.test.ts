import { describe, expect, it } from 'vitest';
import { createConfig, presetRules, ruleId, type XzRules } from './config';
import { applyXz, assertXzInvariants, createXzMatch, defaultAction, legalActions, makeWall, readyScores, SEATS, winScore } from './engine';
import { chooseXzAction, observeXz } from './ai';
import { replayXz, saveXz, stateDigest } from './persistence';
import { wallForHands } from './scenarios';
import { scoreHand } from './scoring';
import type { Seat, XzState } from './types';
const ids = (str: string) => str.split(' ').flatMap((part, suit) => [...part].map(n => +n - 1 + suit * 9));
function make(hands: number[][], change: Partial<XzRules> = {}): XzState {
  return createXzMatch(createConfig({ ...presetRules('dynamic'), rounds: 1, firstDealer: 0, ...change }), 90, wallForHands(hands));
}
function passWindow(s: XzState, call?: { seat: Seat; type: 'pon' | 'kan' }): XzState {
  for (const id of SEATS) if (s.phase === 'response' && legalActions(s, id).some(a => a.type === 'pass')) s = applyXz(s, id, call?.seat === id ? { type: call.type } : { type: 'pass' });
  return s;
}
describe('杠事务与独立支付金样', () => {
  it('暗杠各家付2底；仅自摸限制不影响开杠，取消重复命令', () => {
    for (const kongPay of [false, true]) {
      let s = make([ids('1111'), [], [], []], { kongPay, refund: kongPay ? 'not-ready' : 'off' });
      const a = legalActions(s, 0).find(a => a.type === 'kan')!, oldWall = s.wall.length;
      s = applyXz(s, 0, a); expect(s.players.map(p => p.score)).toEqual(kongPay ? [106, 98, 98, 98] : [100, 100, 100, 100]); expect(s.wall.length).toBe(oldWall - 1);
      expect(applyXz(s, 0, a)).toBe(s); expect(s.players[0].melds[0].kanType).toBe('ankan'); assertXzInvariants(s);
    }
  });
  it('直杠放杠者支付或活跃者支付；碰不支付且没有自摸资格', () => {
    for (const type of ['pon', 'kan'] as const) for (const directPay of ['source', 'active'] as const) {
      let s = make([[0], [0, 0, 0], [], []], { directPay }); const id = s.players[0].hand.find(t => t.id === 0)!.instanceId;
      s = applyXz(s, 0, { type: 'discard', tile: id }); s = passWindow(s, { seat: 1, type });
      expect(s.players[1].melds[0].type).toBe(type === 'pon' ? 'pon' : 'kan');
      expect(s.players.map(p => p.score)).toEqual(type === 'pon' ? [100, 100, 100, 100] : directPay === 'source' ? [98, 102, 100, 100] : [98, 106, 98, 98]);
      if (type === 'pon') { expect(s.players[1].drawn).toBeNull(); expect(winScore(s, 1)).toBeNull(); }
      assertXzInvariants(s);
    }
  });
  it('补杠提交成功才收款和补牌；回放逐笔一致', () => {
    let s = make([[0], [0, 0, 0], [], []]);
    s = applyXz(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 0)!.instanceId }); s = passWindow(s, { seat: 1, type: 'pon' });
    const a = legalActions(s, 1).find(a => a.type === 'kan')!; expect(a).toBeDefined(); const before = s.wall.length;
    s = applyXz(s, 1, a); s = passWindow(s);
    expect(s.players[1].melds[0].kanType).toBe('kakan'); expect(s.wall.length).toBe(before - 1); expect(s.players.map(p => p.score)).toEqual([99, 103, 99, 99]);
    expect(stateDigest(replayXz(saveXz(s)))).toBe(stateDigest(s)); assertXzInvariants(s);
  });
  it('被抢补杠无杠分、无补牌，第四张独立来源；抢杠开关真生效', () => {
    for (const robKong of [true, false]) {
      let s = make([[0], [0, 0, 0], ids('23 12323456788'), []], { robKong, passWin: 'off' });
      s = applyXz(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 0)!.instanceId }); s = passWindow(s, { seat: 1, type: 'pon' });
      const a = legalActions(s, 1).find(a => a.type === 'kan')!; const before = s.wall.length;
      s = applyXz(s, 1, a);
      if (robKong) {
        expect(s.response?.rob).toBe(true); expect(s.ledger).toHaveLength(0); expect(winScore(s, 2)?.patterns.some(p => p.id === 'robKong')).toBe(true);
        s = applyXz(s, 2, { type: 'win' }); s = passWindow(s);
        expect(s.players[1].melds[0].type).toBe('pon'); expect(s.ledger.filter(e => e.reason === 'kong')).toHaveLength(0);
        // One normal continuation draw belongs to seat 3, no supplement for seat 1.
        expect(s.current).toBe(3); expect(s.wall.length).toBe(before - 1); expect(s.players[1].drawn).toBeNull(); expect(s.wins[0].kind).toBe('rob');
      } else { expect(s.players[1].melds[0].kanType).toBe('kakan'); expect(s.ledger.filter(e => e.reason === 'kong')).toHaveLength(3); }
      assertXzInvariants(s);
    }
  });
  it('金钩钓包含暗杠；门清允许暗杠，所有面子参与缺门检查', () => {
    const r = presetRules('dynamic'); r.patterns.singlePair.enabled = true; r.patterns.concealed.enabled = true;
    const wall = makeWall(5, 1), take = (id: number, n: number) => wall.filter(t => t.id === id).slice(0, n);
    const melds = [0, 2, 4, 6].map(id => ({ type: 'kan' as const, kanType: 'ankan' as const, from: 0 as Seat, opened: false, tiles: take(id, 4) }));
    const score = scoreHand(take(8, 2), melds, null, r, { kind: 'draw' })!;
    expect(score.patterns.find(p => p.id === 'singlePair')?.fan).toBe(1); expect(score.patterns.find(p => p.id === 'concealed')?.fan).toBe(1); expect(score.patterns.find(p => p.id === 'root')?.fan).toBe(4);
    r.missing = 'declared'; expect(scoreHand(take(8, 2), melds, 0, r, { kind: 'draw' })).toBeNull();
  });
});
describe('清算计划、呼叫转移与终局边界', () => {
  it('确定性完整批次逐筆退税来源、转移不重复退款、最高查叫金额与收款对象', () => {
    let refunds = 0, transfers = 0, checks = 0;
    for (let seed = 30; seed < 130; seed++) {
      const r = { ...presetRules(seed % 2 ? 'declared-exchange' : 'dynamic'), rounds: 1, transfer: true, transferSplit: seed % 2 ? 'nearest' as const : 'equal' as const, refund: seed % 3 ? 'not-ready' as const : 'all-unwon' as const };
      let s = createXzMatch(createConfig(r), seed);
      for (let step = 0; step < 650 && !s.completed; step++) {
        const seat = SEATS.find(id => legalActions(s, id).length)!;
        const action = chooseXzAction(observeXz(s, seat), { difficulty: 'shintentai', personality: 'aggressive' })!;
        s = applyXz(s, seat, action); assertXzInvariants(s);
      }
      expect(s.completed).toBe(true);
      for (const e of s.ledger) {
        if (e.reason === 'refund') {
          refunds++; const origin = s.ledger.find(t => t.reason === 'kong' && t.sourceKong === e.sourceKong && t.from === e.to && t.to === e.from)!;
          expect(origin).toBeDefined(); expect(e.amount).toBe(origin.amount); expect(s.ledger.some(t => t.reason === 'transfer' && t.sourceKong === e.sourceKong)).toBe(false);
        }
        if (e.reason === 'ready') { checks++; expect(s.players[e.to].won).toBeNull(); expect(s.results[0].classifications[e.to]).toBe('听牌'); expect(Number.isSafeInteger(e.amount)).toBe(true); expect(e.amount).toBeGreaterThan(0); expect(e.amount).toBeLessThanOrEqual(8); }
        if (e.reason === 'transfer') transfers++;
      }
      for (const id of new Set(s.ledger.filter(e => e.reason === 'transfer').map(e => e.sourceKong))) expect(s.ledger.filter(e => e.reason === 'transfer' && e.sourceKong === id).reduce((n, e) => n + e.amount, 0)).toBe(s.ledger.filter(e => e.reason === 'kong' && e.sourceKong === id).reduce((n, e) => n + e.amount, 0));
    }
    console.info(JSON.stringify({ refunds, transfers, readyPayments: checks })); expect(refunds).toBeGreaterThan(0); expect(checks).toBeGreaterThan(0); expect(transfers).toBeGreaterThan(0);
  }, 30000);
});
