import { describe, expect, it } from 'vitest';
import { createConfig, presetRules, type XzRules } from './config';
import { applyXz, assertXzInvariants, createXzMatch, defaultAction, legalActions, readyScores, SEATS, winScore } from './engine';
import { wallForHands, loadXzScenario, xzCases } from './scenarios';
import { chooseXzAction, observeXz } from './ai';
import type { Seat, XzAction, XzState } from './types';
import type { Tile } from '../types';
import { parseXzSave, replayXz, saveXz } from './persistence';
const ids = (s: string) => s.split(' ').flatMap((part, suit) => [...part].map(n => +n - 1 + 9 * suit));
const act = (s: XzState, seat: Seat, a: XzAction) => { const next = applyXz(s, seat, a); expect(next).not.toBe(s); assertXzInvariants(next); return next; };
function pass(s: XzState) { for (const seat of SEATS) if (s.phase === 'response' && legalActions(s, seat).some(a => a.type === 'pass')) s = act(s, seat, { type: 'pass' }); return s; }
function ordered(wall: Tile[], draws: number[]) { draws.forEach((id, n) => { const at = wall.findIndex((t, i) => i >= 53 + n && t.id === id); if (at < 0) throw new Error('缺少补牌夹具'); [wall[53 + n], wall[at]] = [wall[at], wall[53 + n]]; }); return wall; }
function make(hands: number[][], rules: Partial<XzRules> = {}, draws: number[] = []) { return createXzMatch(createConfig({ ...presetRules('dynamic'), firstDealer: 0, rounds: 1, ...rules }), 90, ordered(wallForHands(hands), draws)); }
describe('独立边界金样（生产初始牌与动作）', () => {
  it('自摸按三、二、一家活跃付款；已胡积分不参与后续胡分', () => {
    let s = make([ids('123345789 45677'), ids('1122334455667'), ids(' 1234 123345789'), []], {}, [6, 9]);
    s = act(s, 0, { type: 'win' }); expect(s.players.map(p => p.score)).toEqual([106, 98, 98, 98]);
    // Seat 1 forms pure seven pairs: cap 3 => 8 + 1 = 9 from each of two active opponents.
    s = act(s, 1, { type: 'win' }); expect(s.players.map(p => p.score)).toEqual([106, 116, 89, 89]);
    // Seat 2's 11234p + three sou sequences is a 0-fan ordinary hand.
    s = act(s, 2, { type: 'win' }); expect(s.players.map(p => p.score)).toEqual([106, 116, 91, 87]); expect(s.completed).toBe(true);
  });
  it('点杠花包赔把活跃付款合并给放杠者；普通支付仍逐家', () => {
    for (const directResponsibility of [false, true]) {
      let s = make([[0], ids('111234 3456789'), [], []], { directResponsibility }, [17]);
      s = act(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 0)!.instanceId }); s = act(s, 1, { type: 'kan' }); s = pass(s);
      // One root + kong draw = 2 fan, 4 base + 1 draw bonus = 5 per active payer.
      expect(winScore(s, 1)?.payment).toBe(5); s = act(s, 1, { type: 'win' });
      expect(s.players.map(p => p.score)).toEqual(directResponsibility ? [83, 117, 100, 100] : [93, 117, 95, 95]);
    }
  });
  it('呼叫转移只分一笔3分，均分余数给最近赢家；关闭不转', () => {
    for (const transfer of [false, true]) for (const transferSplit of ['nearest', 'equal'] as const) {
      let s = make([[0], ids('111234 3456789'), ids('234345678 4569'), ids(' 1239 123345678')], { transfer, transferSplit, directRate: 3 }, [17]);
      s = act(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 0)!.instanceId }); s = act(s, 1, { type: 'kan' }); s = pass(s);
      s = act(s, 1, { type: 'discard', tile: s.players[1].drawn! }); s = act(s, 2, { type: 'win' }); s = act(s, 3, { type: 'win' }); s = pass(s);
      const entries = s.ledger.filter(e => e.reason === 'transfer');
      expect(entries.map(e => [e.to, e.amount])).toEqual(!transfer ? [] : transferSplit === 'nearest' ? [[2, 3]] : [[2, 2], [3, 1]]);
      expect(s.players.map(p => p.score)).toEqual(!transfer ? [97, 99, 102, 102] : transferSplit === 'nearest' ? [97, 96, 105, 102] : [97, 96, 104, 103]);
      // Continue the same transaction to wall end: transferred kong income cannot be refunded again.
      if (transfer) {
        s = replayXz(parseXzSave(JSON.stringify(saveXz(s))));
        for (let n = 0; n < 650 && s.phase !== 'ended'; n++) { const seat = SEATS.find(id => legalActions(s, id).length)!; s = act(s, seat, defaultAction(s, seat)!); }
        expect(s.phase).toBe('ended');
        expect(s.ledger.filter(e => e.reason === 'refund')).toEqual([]);
        expect(s.ledger.filter(e => e.reason === 'transfer').map(e => [e.to, e.amount])).toEqual(transferSplit === 'nearest' ? [[2, 3]] : [[2, 2], [3, 1]]);
      }
    }
  });
  it('清算开关与花猪叠加：固定罚额和最高查叫金额分别受控', () => {
    const base = xzCases().find(t => t.id === 'XZ-WALL')!.scenario;
    for (const pig of [true, false]) for (const readyPay of [true, false]) for (const pigAlsoReady of [true, false]) {
      const rules = { ...base.config.rules, pig, readyPay, pigAlsoReady, pigPenalty: 'fixed' as const, pigRate: 3 };
      let s = loadXzScenario({ ...base, config: createConfig(rules) }); s = pass(act(s, s.current, defaultAction(s, s.current)!));
      const expected = [100, 100, 100, 100];
      if (pig) { expected[1] -= 9; for (const id of [0, 2, 3]) expected[id] += 3; }
      if (readyPay) { expected[2] -= 5; expected[0] += 1; expected[3] += 4; if (pigAlsoReady) { expected[1] -= 5; expected[0] += 1; expected[3] += 4; } }
      expect(s.players.map(p => p.score)).toEqual(expected);
    }
  });
  it('未公开暗杠不用于死听判断；自家四张不能等待第五张', () => {
    let s = make([ids('1111'), ids('23 12334567899'), [], []], { readyPolicy: 'public' });
    s = act(s, 0, legalActions(s, 0).find(a => a.type === 'kan')!);
    expect(readyScores(s, 1).map(w => w.id)).toContain(0);
    expect(readyScores(s, 0).map(w => w.id)).not.toContain(0);
  });
  it('公开耗尽排除已见四张七筒，不读取仍藏在对手手中的四筒', () => {
    const base = xzCases().find(t => t.id === 'XZ-WALL')!.scenario;
    for (const readyPolicy of ['structural', 'public'] as const) {
      let s = loadXzScenario({ ...base, config: createConfig({ ...base.config.rules, readyPolicy }) });
      s = pass(act(s, s.current, defaultAction(s, s.current)!));
      expect(readyScores(s, 0).map(w => w.id)).toEqual(readyPolicy === 'structural' ? [12, 15] : [12]);
    }
  });
  it('过手胡按真实已放弃基值；更高基值模式允许8分而摸牌前禁止模式拒绝', () => {
    for (const passWin of ['off', 'higher', 'until-draw'] as const) {
      let s = make([[7], [8], ids('1112345678999'), ids('8 123345678999')], { passWin });
      s = act(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 7)!.instanceId });
      expect(winScore(s, 2)?.base).toBe(4); s = act(s, 2, { type: 'pass' }); s = act(s, 3, { type: 'win' }); s = pass(s);
      expect(s.current).toBe(1); expect(s.players[2].passed).toBe(passWin === 'off' ? null : 4);
      s = act(s, 1, { type: 'discard', tile: s.players[1].hand.find(t => t.id === 8)!.instanceId });
      expect(winScore(s, 2)?.base ?? null).toBe(passWin === 'until-draw' ? null : 8);
    }
  });
  it('破产仅在完整小局结算后结束；首胡多人时由出牌者坐庄', () => {
    for (const bankruptcy of [false, true]) {
      const base = xzCases().find(t => t.id === 'XZ-FIRST')!.scenario;
      let s = loadXzScenario({ ...base, config: createConfig({ ...base.config.rules, rounds: 2, startingScore: 0, bankruptcy }) });
      s = act(s, 0, { type: 'win' }); expect(s.completed).toBe(false); expect(s.players.some(p => p.score < 0)).toBe(true);
      for (let n = 0; n < 650 && s.phase !== 'ended'; n++) { const seat = SEATS.find(id => legalActions(s, id).length)!; s = act(s, seat, chooseXzAction(observeXz(s, seat), { difficulty: 'shintentai', personality: 'balanced' })!); }
      expect(s.completed).toBe(bankruptcy);
    }
    const base = xzCases().find(t => t.id === 'XZ-TRIPLE')!.scenario;
    let s = loadXzScenario({ ...base, config: createConfig({ ...base.config.rules, rounds: 2, dealerPolicy: 'first-win' }) });
    for (const seat of [1, 2, 3] as Seat[]) s = act(s, seat, { type: 'win' }); s = act(s, 0, { type: 'next' }); expect(s.dealer).toBe(0);
  });
  it('定缺持缺碰杠开关生效，指定缺门自身永远禁止', () => {
    for (const unclearedCalls of [false, true]) {
      let s = make([[0], [0, 0, 0, 9], [], []], { missing: 'declared', unclearedCalls });
      for (const seat of SEATS) s = act(s, seat, { type: 'missing', suit: seat === 1 ? 1 : 0 });
      s = act(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 0)!.instanceId });
      expect(legalActions(s, 1).some(a => a.type === 'kan')).toBe(unclearedCalls);
    }
  });
  it('实际天胡地胡只在首轮无人碰杠触发；仅自摸没有接炮', () => {
    for (const id of ['XZ-FIRST', 'XZ-TRIPLE']) {
      const base = xzCases().find(t => t.id === id)!.scenario, rules = structuredClone(base.config.rules);
      rules.patterns.heaven.enabled = true; rules.patterns.earth.enabled = true;
      const s = loadXzScenario({ ...base, config: createConfig(rules) });
      expect(winScore(s, id === 'XZ-FIRST' ? 0 : 1)?.patterns.map(p => p.id)).toContain(id === 'XZ-FIRST' ? 'heaven' : 'earth');
      if (id === 'XZ-TRIPLE') { const selfOnly = createConfig({ ...rules, selfDrawOnly: true, multiWin: false, passWin: 'off', robKong: false }); const t = loadXzScenario({ ...base, config: selfOnly }); expect(SEATS.flatMap(seat => legalActions(t, seat)).some(a => a.type === 'win')).toBe(false); }
    }
  });
  it('难度与个性在相同合法局面产生可测分歧，不是换标签', () => {
    let levels = 0, personalities = 0;
    for (let seed = 0; seed < 100; seed++) {
      let s = createXzMatch(createConfig(presetRules('dynamic')), seed), observation = observeXz(s, s.current);
      const a = (difficulty: 'chikukon' | 'kishin', personality: 'balanced' | 'defensive' | 'aggressive') => JSON.stringify(chooseXzAction(observation, { difficulty, personality }));
      if (a('chikukon', 'balanced') !== a('kishin', 'balanced')) levels++;
      for (let n = 0; n < 30 && s.phase !== 'ended'; n++) { const seat = SEATS.find(id => legalActions(s, id).length)!; s = act(s, seat, chooseXzAction(observeXz(s, seat), { difficulty: 'shintentai', personality: 'balanced' })!); }
      observation = observeXz(s, s.current);
      if (a('kishin', 'defensive') !== a('kishin', 'aggressive')) personalities++;
    }
    expect(levels).toBeGreaterThan(0); expect(personalities).toBeGreaterThan(0); console.info({ difficultyDisagreements: levels, personalityDisagreements: personalities });
  });
});
