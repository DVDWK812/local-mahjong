import { describe, expect, it } from 'vitest';
import { MatchRuntime } from '../timeControl/matchRuntime';
import type { Clock } from '../timeControl/decisionClock';
import { xzPolicy } from './runtime';
import { createConfig, presetRules } from './config';
import { applyXz, createXzMatch, defaultAction, participantId, SEATS, legalActions } from './engine';
import { loadXzScenario, xzCases, wallForHands } from './scenarios';
import { replayXz, saveXz } from './persistence';
class ClockFixture implements Clock {
  value = 0; n = 0; jobs = new Map<number, { at: number; fn: () => void }>();
  now = () => this.value;
  schedule = (fn: () => void, ms: number) => { const id = ++this.n; this.jobs.set(id, { at: this.value + ms, fn }); return id; };
  cancel = (id: unknown) => { this.jobs.delete(id as number); };
  advance(ms: number) { const until = this.value + ms; for (let i = 0; i < 100; i++) { const next = [...this.jobs].filter(([, j]) => j.at <= until).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) { this.value = until; return; } this.jobs.delete(next[0]); this.value = next[1].at; next[1].fn(); } throw new Error('时钟未终止'); }
}
describe('血战接入共享权威时钟', () => {
  it('拒绝伪造自动偏好、预算充值、重复决策和错误决策类型', () => {
    const s = createXzMatch(createConfig(), 8), runtime = new MatchRuntime(s, xzPolicy, s.config.time, new ClockFixture()); runtime.activate();
    const saved = saveXz(s, runtime.pause()); expect(replayXz(saved).sequence).toBe(0);
    for (const mutate of [
      (v: typeof saved) => { v.runtime!.clock.decisions[0].baseMs = 999999; },
      (v: typeof saved) => { v.runtime!.clock.decisions[0].kind = 'turn'; },
      (v: typeof saved) => { v.runtime!.clock.decisions.push(v.runtime!.clock.decisions[0]); },
      (v: typeof saved) => { v.runtime!.preferences[participantId(0)].autoWin = 'yes' as never; },
    ]) { const corrupt = structuredClone(saved); mutate(corrupt); expect(() => replayXz(corrupt)).toThrow(); }
    runtime.dispose();
  });
  it('换牌30秒、定缺10秒独立；基础5秒＋Bank20秒不被准备消耗', () => {
    const clock = new ClockFixture(), state = createXzMatch(createConfig(), 4), runtime = new MatchRuntime(state, xzPolicy, state.config.time, clock);
    runtime.activate(); expect(runtime.budgetView(participantId(0))?.baseMs).toBe(30000);
    clock.advance(30000); expect(runtime.state.phase).toBe('missing'); expect(runtime.budgetView(participantId(0))?.baseMs).toBe(10000);
    clock.advance(10000); expect(runtime.state.phase).toBe('turn'); const id = participantId(runtime.state.current);
    expect(runtime.budgetView(id)).toMatchObject({ baseMs: 5000, bankMs: 20000 });
    clock.advance(7000); expect(runtime.budgetView(id)).toMatchObject({ baseMs: 0, bankMs: 18000 });
    runtime.dispose(); expect(clock.jobs.size).toBe(0);
  });
  it('准备草稿不重置截止时间，超时保留同色合法选择', () => {
    const clock = new ClockFixture(), s = createXzMatch(createConfig(), 41), runtime = new MatchRuntime(s, xzPolicy, s.config.time, clock); runtime.activate();
    const action = defaultAction(s, 0)!; if (action.type !== 'exchange') throw new Error('fixture');
    clock.advance(12000); runtime.command(participantId(0), runtime.decision(participantId(0))?.id, state => applyXz(state, 0, { type: 'exchange-draft', tiles: action.tiles.slice(0, 2) }));
    expect(runtime.budgetView(participantId(0))?.baseMs).toBe(18000); clock.advance(18000);
    expect(runtime.state.exchanges[0]).toEqual(action.tiles); runtime.dispose();
  });
  it('无准备的自由基础直接开时钟；自动和牌优先于摸切，不碰杠不抑制胡', () => {
    const clock = new ClockFixture(), s = loadXzScenario(xzCases().find(t => t.id === 'XZ-FIRST')!.scenario), runtime = new MatchRuntime(s, xzPolicy, s.config.time, clock);
    runtime.activate(); Object.assign(runtime.preference(participantId(0)), { autoWin: true, autoTsumogiri: true, suppressCalls: true }); runtime.evaluate();
    expect(runtime.state.players[0].won).toBe(1); expect(runtime.state.players[0].river).toHaveLength(0); expect(runtime.decision(participantId(0))).toBeUndefined(); runtime.dispose();
  });
  it('响应超时触发过手胡，重复命令只接收一次，旧决策ID失效', () => {
    const clock = new ClockFixture(), s = loadXzScenario(xzCases().find(t => t.id === 'XZ-TRIPLE')!.scenario), runtime = new MatchRuntime(s, xzPolicy, s.config.time, clock);
    runtime.activate(); const old = runtime.decision(participantId(1))!.id;
    const accepted = runtime.command(participantId(1), old, state => applyXz(state, 1, { type: 'pass' }), 'same');
    expect(accepted).toBe(true); expect(runtime.state.players[1].passed).toBe(1);
    expect(runtime.command(participantId(1), old, state => applyXz(state, 1, { type: 'win' }), 'same')).toBe(false);
    clock.advance(25000); expect(runtime.state.players[2].passed).toBe(1); expect(runtime.state.players[3].passed).toBe(1);
    // Seat 1 is the next actual drawer; only its pass restriction is cleared.
    expect(runtime.state.players[1].passed).toBeNull(); runtime.dispose();
  });
  it('恢复剩余预算使用新时间域；暂停和切自动开关不充值', () => {
    const clock = new ClockFixture(), s = createXzMatch(createConfig(presetRules('dynamic')), 5), runtime = new MatchRuntime(s, xzPolicy, s.config.time, clock); runtime.activate();
    clock.advance(8000); const id = participantId(s.current), budget = runtime.budgetView(id); runtime.setPreference(id, 'suppressCalls', true);
    expect(runtime.budgetView(id)?.bankMs).toBe(budget?.bankMs); const saved = saveXz(runtime.state, runtime.pause()); clock.advance(50000);
    const fresh = new ClockFixture(); fresh.value = 900000; const restored = new MatchRuntime(replayXz(saved), xzPolicy, s.config.time, fresh, 0, saved.runtime); restored.activate();
    expect(restored.budgetView(id)).toMatchObject({ baseMs: 0, bankMs: 17000 }); runtime.dispose(); restored.dispose();
  });
  it('定缺默认弃牌从合法缺牌中选，不强行打非缺摸牌', () => {
    let s = createXzMatch(createConfig(presetRules('declared')), 7);
    for (const seat of SEATS) s = applyXz(s, seat, { type: 'missing', suit: 0 });
    const a = defaultAction(s, s.current)!; expect(a.type).toBe('discard');
    if (a.type === 'discard' && s.players[s.current].hand.some(t => t.id < 9)) expect(s.players[s.current].hand.find(t => t.instanceId === a.tile)!.id).toBeLessThan(9);
  });
  it('真实碰后没有摸牌：超时确定性弃出二万，不产生摸牌或重复碰', () => {
    let s = createXzMatch(createConfig({ ...presetRules('dynamic'), firstDealer: 0 }), 77, wallForHands([[0], [0, 0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13], [], []]));
    s = applyXz(s, 0, { type: 'discard', tile: s.players[0].hand.find(t => t.id === 0)!.instanceId });
    s = applyXz(s, 1, { type: 'pon' });
    for (const seat of SEATS) if (s.phase === 'response' && legalActions(s, seat).some(a => a.type === 'pass')) s = applyXz(s, seat, { type: 'pass' });
    expect(s.current).toBe(1); expect(s.players[1].drawn).toBeNull();
    const expected = s.players[1].hand.find(t => t.id === 1)!.instanceId;
    const clock = new ClockFixture(), runtime = new MatchRuntime(s, xzPolicy, s.config.time, clock); runtime.activate(); clock.advance(25000);
    expect(runtime.state.players[1].river.map(t => t.instanceId)).toEqual([expected]);
    expect(runtime.state.players[1].melds).toHaveLength(1); runtime.dispose();
  });
});
