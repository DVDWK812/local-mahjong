import { describe, it, expect } from 'vitest';
import { MatchRuntime } from '../timeControl/matchRuntime';
import { SanmaTestClock, sanmaPolicy } from './runtime';
import { createSanmaConfig } from './config';
import { createSanma, applySanma, participantId } from './engine';
import { chooseSanmaAction, observeSanma } from './ai';

function setup(short: boolean) {
  const config = structuredClone(createSanmaConfig());
  if (short) config.time = { schemaVersion: 1, turn: { kind: 'banked', decisionBaseMs: 1000, bankPerHandMs: 0 } };
  const clock = new SanmaTestClock(), runtime = new MatchRuntime(createSanma(config, 308), sanmaPolicy, config.time, clock);
  runtime.activate(); return { clock, runtime };
}
describe('AI policy receipt versus authoritative deadline', () => {
  for (const short of [false, true]) {
    it(`policy survives pacing beyond deadline; short=${short}`, () => {
      const { clock, runtime: r } = setup(short);
      const action = chooseSanmaAction(observeSanma(r.state, 0))!;
      const prepared = r.preparePolicyCommand(participantId(0), s => applySanma(s, 0, action))!;
      const deadline = r.budgetView('sanma:0')!.deadline!;
      clock.advance(deadline);
      expect(r.state.actions[0].action).toEqual(action); expect(r.audit[0].source).toBe('ai-policy');
      const count = r.state.actions.length; prepared.commit(); expect(r.state.actions).toHaveLength(count); r.dispose();
    });
    it(`policy commits before deadline; short=${short}`, () => {
      const { clock, runtime: r } = setup(short); const action = chooseSanmaAction(observeSanma(r.state, 0))!;
      const p = r.preparePolicyCommand('sanma:0', s => applySanma(s, 0, action))!;
      clock.advance(100); p.commit(); expect(r.audit[0].source).toBe('ai-policy'); r.dispose();
    });
    it(`unsubmitted decision is timeout, explicit auto is distinct; short=${short}`, () => {
      const { clock, runtime: r } = setup(short); clock.advance(r.budgetView('sanma:0')!.deadline!);
      expect(r.audit[0].source).toBe('timeout'); r.dispose();
      const { runtime: auto } = setup(short); auto.setPreference('sanma:0', 'autoTsumogiri', true);
      expect(auto.audit[0].source).toBe('auto-tsumogiri'); auto.dispose();
    });
  }
  it('cancelled proposal cannot run at deadline', () => {
    const { clock, runtime: r } = setup(true); const action = chooseSanmaAction(observeSanma(r.state, 0))!;
    r.preparePolicyCommand('sanma:0', s => applySanma(s, 0, action))!.cancel(); clock.advance(1000);
    expect(r.audit[0].source).toBe('timeout'); r.dispose();
  });
});


// Default points, real MatchRuntime and policy choices for both AI seats.
import { legalSanmaActions } from './engine';
import { assertSanma } from './invariants';
import { writeFileSync, mkdirSync } from 'node:fs';
const runs: unknown[] = [];
describe('runtime full matches with policy audit', () => {
  for (const short of [false, true]) for (const length of ['east-only', 'hanchan'] as const) for (const payment of ['loss', 'split_missing_share_ceil100'] as const) {
    it(`${length}/${payment}/short=${short}/seed=308`, () => {
      const config = structuredClone(createSanmaConfig(length, payment));
      if (short) config.time = { schemaVersion: 1, turn: { kind: 'banked', decisionBaseMs: 1000, bankPerHandMs: 0 } };
      const clock = new SanmaTestClock(), r = new MatchRuntime(createSanma(config, 308), sanmaPolicy, config.time, clock); r.activate();
      for (let i = 0; i < 10000 && !r.state.completed; i++) {
        if (r.state.phase === 'ended') { r.advance(s => applySanma(s, 0, { type: 'next' })); continue; }
        const choices = ([0, 1, 2] as const).filter(id => legalSanmaActions(r.state, id).length).map(id => ({ id, action: chooseSanmaAction(observeSanma(r.state, id), id === 0 ? undefined : config.ai[id - 1])! }));
        const ai = choices.filter(c => c.id !== 0).map(c => r.preparePolicyCommand(participantId(c.id), s => applySanma(s, c.id, c.action))!);
        const human = choices.find(c => c.id === 0);
        if (human) { r.command('sanma:0', r.decision('sanma:0')?.id, s => applySanma(s, 0, human.action)); continue; }
        // Short case deliberately holds presentation to the first authoritative AI deadline.
        const remaining = [...r.time.decisions.values()].map(d => r.time.view(d).deadline! - clock.now());
        if (remaining.length) clock.advance(short ? Math.min(...remaining) : 100);
        ai.forEach(c => c?.commit()); assertSanma(r.state);
        expect(r.error).toBeNull();
      }
      expect(r.state.completed).toBe(true);
      const sources = r.audit.reduce<Record<string, number>>((a, row) => { a[row.source] = (a[row.source] ?? 0) + 1; return a; }, {});
      expect(sources['ai-policy']).toBeGreaterThan(0); expect(sources.timeout ?? 0).toBe(0);
      runs.push({ length, payment, short, seed: 308, points: [config.startingPoints, config.targetPoints, config.returnPoints], sources, steps: r.state.sequence });
      mkdirSync('test-results/sanma-closeout', { recursive: true }); writeFileSync('test-results/sanma-closeout/runtime-runs.json', JSON.stringify(runs, null, 2)); r.dispose();
    }, 120000);
  }
});
