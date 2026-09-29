import { describe, it, expect } from 'vitest';
import { SANMA_CASES, loadSanmaCase, runSanmaCase } from './scenarios';
import { createSanmaConfig, sanmaFingerprint } from './config';
import { createSanma, applySanma, legalSanmaActions } from './engine';
import { parseSanmaSave, replaySanma, saveSanma } from './persistence';
import { MatchRuntime } from '../timeControl/matchRuntime';
import { sanmaPolicy, SanmaTestClock } from './runtime';
import { presentSanma, sanmaInteraction, publishSanmaTransition } from '../../presentation/table/sanmaPresentation';
import { presentationEventBus, type PresentationEvent } from '../../presentation/PresentationEventBus';
import { chooseSanmaAction, observeSanma } from './ai';

describe('SANMA-5 跨配置、保存与共享展示边界', () => {
  for (const length of ['east-only', 'hanchan'] as const) for (const policy of ['loss', 'split_missing_share_ceil100'] as const) {
    it(`${length}/${policy}的每个可视化场景执行断言并经JSON序列化重建`, () => {
      const config = createSanmaConfig(length, policy);
      for (const t of SANMA_CASES) {
        const result = runSanmaCase(t, config);
        expect(result.passed, `${t.caseId}: ${result.error}`).toBe(true);
        const archive = parseSanmaSave(JSON.stringify(saveSanma(result.state, undefined, result.initial, true)));
        expect(sanmaFingerprint(replaySanma(archive)), t.caseId).toBe(sanmaFingerprint(result.state));
      }
    });
  }
  it('三个视角保持participantId、操作实例与座风；无第四席', () => {
    const state = createSanma(createSanmaConfig(), 42);
    for (const viewer of [0, 1, 2] as const) {
      const p = presentSanma(state, viewer);
      expect(p.participants).toHaveLength(3); expect(p.mapping).toHaveLength(3);
      expect(p.mapping[0]).toEqual({ seat: 'bottom', participantId: `sanma:${viewer}` });
      expect(p.participants.map(p => p.seatWind)).toEqual(['east', 'south', 'west']);
      let picked = ''; const actions = sanmaInteraction(() => {}, id => { picked = id; });
      const tile = p.hand.tiles[0].tile; actions.discard(tile.instanceId); expect(picked).toBe(tile.instanceId);
    }
  });
  it('规则快照不受赛前全局选项修改影响；存档恢复不赠时', () => {
    const config = createSanmaConfig('hanchan', 'split_missing_share_ceil100'), state = createSanma(config, 5);
    const clock = new SanmaTestClock(), runtime = new MatchRuntime(state, sanmaPolicy, config.time, clock); runtime.activate(); clock.advance(6500);
    const saved = parseSanmaSave(JSON.stringify(saveSanma(state, runtime.snapshot())));
    const other = createSanmaConfig('east-only', 'loss');
    expect(saved.state.config.tsumoPolicy).not.toBe(other.tsumoPolicy);
    const restored = new MatchRuntime(saved.state, sanmaPolicy, saved.state.config.time, new SanmaTestClock(), 0, saved.runtime); restored.activate();
    expect(restored.budgetView('sanma:0')?.bankMs).toBe(18500); runtime.dispose(); restored.dispose();
  });
  it('损坏时钟、第四席或伪造正式初始快照均拒绝', () => {
    const state = createSanma(), r = new MatchRuntime(state, sanmaPolicy, state.config.time, new SanmaTestClock()); r.activate();
    const base = saveSanma(state, r.snapshot());
    for (const corrupt of [
      (v: typeof base) => { v.runtime!.clock.decisions[0].bankMs = 999999; },
      (v: typeof base) => { v.runtime!.clock.banks['sanma:3'] = 1; },
      (v: typeof base) => { v.runtime!.clock.decisions[0].key = 'old-round'; },
      (v: typeof base) => { v.state.players[0].hand[0] = v.state.players[0].hand[1]; },
      (v: typeof base) => { v.initial.seed++; },
    ]) { const value = structuredClone(base); corrupt(value); expect(() => parseSanmaSave(JSON.stringify(value))).toThrow(); }
    r.dispose();
  });
  it('拔北宣言与成立分离，不发布kan；回放重建不再发布实时声音事件', () => {
    const t = SANMA_CASES.find(c => c.caseId === 'SM-04-NORTH')!, root = loadSanmaCase(t), events: PresentationEvent[] = [];
    const unsubscribe = presentationEventBus.subscribe(e => events.push(e));
    const action = legalSanmaActions(root, 0).find(a => a.type === 'north')!;
    const next = applySanma(root, 0, action); publishSanmaTransition(root, next);
    expect(events.some(e => e.type === 'meld_declared')).toBe(false);
    expect(events.filter(e => e.type === 'tile_drawn')).toHaveLength(1);
    const count = events.length; replaySanma(saveSanma(next, undefined, root, true)); expect(events).toHaveLength(count); unsubscribe();
  });
  it('两名AI使用相同合法Observation，并读取不同自摸支付收益', () => {
    const a = createSanma(createSanmaConfig('east-only', 'loss'), 13), b = createSanma(createSanmaConfig('east-only', 'split_missing_share_ceil100'), 13);
    expect(observeSanma(a, 1).expectedTsumoIncome).toBe(6000); expect(observeSanma(b, 1).expectedTsumoIncome).toBe(8000);
    for (const difficulty of ['chikukon', 'shintentai', 'upper', 'kishin'] as const) for (const personality of ['balanced', 'defensive', 'aggressive'] as const) {
      const o = observeSanma(a, 0), action = chooseSanmaAction(o, { playerId: 1, difficulty, personality });
      expect(o.legal).toContainEqual(action); expect(action).toEqual(chooseSanmaAction(o, { playerId: 1, difficulty, personality }));
    }
  });
});
